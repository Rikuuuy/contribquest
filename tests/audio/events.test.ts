import { describe, expect, it } from 'vitest';
import { musicModeFor, SOUND_AT, soundsFor, type SoundCue } from '../../src/audio/events';
import { createAudio, heartbeatGap, MASTER_GAIN, type SoundName } from '../../src/audio/sfx';
import type { GameEvent, QteTest, RunState } from '../../src/engine';
import { makeFightRun, makeTestRun } from '../fixtures/run';

/** A minimal Web Audio stand-in that counts the nodes an effect creates. */
function fakeAudio() {
  const made = { osc: 0, src: 0, contexts: 0 };
  const targets: { value: number; to: number }[] = [];
  const param = () => {
    const p = {
      value: 0,
      setValueAtTime: () => p,
      linearRampToValueAtTime: () => p,
      exponentialRampToValueAtTime: () => p,
      setTargetAtTime: (to: number) => {
        targets.push({ value: p.value, to });
        return p;
      },
    };
    return p;
  };
  const node = () => ({ connect: () => undefined, gain: param(), frequency: param(), Q: param(), delayTime: param(), type: '' });
  class Ctx {
    currentTime = 0;
    sampleRate = 8;
    state = 'running';
    destination = node();
    constructor() {
      made.contexts++;
    }
    createDynamicsCompressor = node;
    createGain = node;
    createDelay = node;
    createBiquadFilter = node;
    createOscillator = () => {
      made.osc++;
      return { ...node(), start: () => undefined, stop: () => undefined };
    };
    createBufferSource = () => {
      made.src++;
      return { ...node(), buffer: null, start: () => undefined, stop: () => undefined };
    };
    createBuffer = (_c: number, n: number) => {
      const d = new Float32Array(n);
      return { getChannelData: () => d };
    };
    resume = () => Promise.resolve();
  }
  return { made, targets, Ctx: Ctx as unknown as new () => AudioContext };
}

const ALL: SoundName[] = ['ui', 'step', 'wisp', 'chest', 'encounter', 'boss', 'windup', 'warn', 'stutter', 'charge', 'hit', 'crit', 'glance', 'block', 'dodge', 'hurt', 'death', 'levelup', 'shard', 'ward', 'relic', 'phase', 'rise', 'win', 'lose'];

describe('createAudio', () => {
  it('stays silent without Web Audio and never throws', () => {
    const a = createAudio(() => false, { AudioContext: null });
    a.init();
    expect(a.ready).toBe(false);
    for (const n of ALL) expect(() => a.play(n)).not.toThrow();
    expect(() => a.setMode('boss2')).not.toThrow();
    expect(() => a.setMute(true)).not.toThrow();
  });

  it('plays nothing before the first input', () => {
    const f = fakeAudio();
    const a = createAudio(() => false, { AudioContext: f.Ctx, setInterval: () => 0 });
    a.play('hit');
    expect(f.made.contexts).toBe(0);
    expect(f.made.osc + f.made.src).toBe(0);
  });

  it('builds the chain once and plays every effect with oscillators or noise', () => {
    const f = fakeAudio();
    const a = createAudio(() => false, { AudioContext: f.Ctx, setInterval: () => 0 });
    a.init();
    a.init();
    expect(f.made.contexts).toBe(1);
    expect(a.ready).toBe(true);
    for (const n of ALL) {
      const before = f.made.osc + f.made.src;
      a.play(n);
      expect(f.made.osc + f.made.src, n).toBeGreaterThan(before);
    }
  });

  it('mute stops play and ramps the master gain', () => {
    let muted = false;
    const f = fakeAudio();
    const a = createAudio(() => muted, { AudioContext: f.Ctx, setInterval: () => 0 });
    a.init();
    muted = true;
    a.setMute(true);
    const before = f.made.osc + f.made.src;
    a.play('crit');
    expect(f.made.osc + f.made.src).toBe(before);
    muted = false;
    a.setMute(false);
    expect(f.targets.slice(-2).map((t) => t.to)).toEqual([0, MASTER_GAIN]);
    a.play('crit');
    expect(f.made.osc + f.made.src).toBeGreaterThan(before);
  });

  it('schedules no bells or heartbeats while hidden or muted', () => {
    let tick: () => void = () => undefined;
    let hidden = true;
    let muted = false;
    const f = fakeAudio();
    const a = createAudio(() => muted, { AudioContext: f.Ctx, hidden: () => hidden, setInterval: (fn) => (tick = fn) });
    a.init();
    a.setMode('combat');
    const base = f.made.osc;
    tick();
    expect(f.made.osc).toBe(base);
    hidden = false;
    muted = true;
    tick();
    expect(f.made.osc).toBe(base);
    muted = false;
    tick();
    expect(f.made.osc).toBeGreaterThan(base);
  });

  it('uses the art-style heartbeat gaps', () => {
    expect(heartbeatGap('combat', false)).toBe(0.78);
    expect(heartbeatGap('boss', false)).toBe(0.5);
    expect(heartbeatGap('boss2', false)).toBe(0.38);
    expect(heartbeatGap('explore', true)).toBe(0.9);
    expect(heartbeatGap('explore', false)).toBe(0);
    expect(heartbeatGap('menu', true)).toBe(0);
  });
});

const one = (e: GameEvent, ctx = {}): SoundCue[] => soundsFor([e], ctx);
const names = (cues: SoundCue[]) => cues.map((c) => c.name);

describe('soundsFor: one row per event (design "Event → sound and effect map")', () => {
  it('map events: step, wisp, rest at half gain, cache heal, chest, level up at 250 ms', () => {
    expect(one({ type: 'moved', from: { col: 0, row: 1 }, to: { col: 1, row: 1 } })).toEqual([{ name: 'step', at: 0 }]);
    expect(one({ type: 'moved', from: { col: 1, row: 1 }, to: { col: 1, row: 1 } })).toEqual([]);
    expect(one({ type: 'wisp', col: 1, row: 1, xp: 5, healed: 0 })).toEqual([{ name: 'wisp', at: 0 }]);
    expect(one({ type: 'rest', col: 1, row: 1, healed: 3 })).toEqual([{ name: 'wisp', at: 0, gain: 0.5 }]);
    expect(one({ type: 'heal', amount: 4, source: 'cache' })).toEqual([{ name: 'relic', at: 0 }]);
    expect(one({ type: 'heal', amount: 4, source: 'vampire' })).toEqual([]);
    expect(one({ type: 'chest', col: 1, row: 1, gold: 6, healed: 2 })).toEqual([{ name: 'chest', at: 0 }]);
    expect(one({ type: 'levelUp', level: 3 })).toEqual([{ name: 'levelup', at: 250 }]);
  });

  it('fight start: encounter, or boss for the Phantom', () => {
    expect(names(one({ type: 'fightStart', boss: false }))).toEqual(['encounter']);
    expect(names(one({ type: 'fightStart', boss: true }))).toEqual(['boss']);
  });

  it('test start: windup for strikes and quick strikes, warn otherwise, stutter at the flaky pause', () => {
    expect(names(one({ type: 'testStart', testId: 1, mode: 'bar', pattern: 'normal' }))).toEqual(['windup']);
    expect(names(one({ type: 'testStart', testId: 1, mode: 'ring', pattern: 'quick' }))).toEqual(['windup']);
    expect(names(one({ type: 'testStart', testId: 1, mode: 'ring', pattern: 'normal' }))).toEqual(['warn']);
    const test = { pauseAt: 640 } as QteTest;
    expect(one({ type: 'testStart', testId: 1, mode: 'ring', pattern: 'flaky' }, { test })).toEqual([
      { name: 'warn', at: 0 },
      { name: 'stutter', at: 640 },
    ]);
  });

  it('hero hits: crit, hit, glance 100 ms after each swing, 170 ms apart; death 150 ms after the kill', () => {
    expect(one({ type: 'heroHit', grades: ['perfect', 'good', 'miss'], dmgs: [5, 3, 1], killed: true })).toEqual([
      { name: 'crit', at: 100 },
      { name: 'hit', at: 270 },
      { name: 'glance', at: 440 },
      { name: 'death', at: 590 },
    ]);
    expect(one({ type: 'heroHit', grades: ['good'], dmgs: [3], killed: false })).toEqual([{ name: 'hit', at: 100 }]);
  });

  it('monster hits: dodge, block, hurt at 110 ms; the counter hit after the dodge', () => {
    expect(one({ type: 'monsterHit', grade: 'perfect', dmg: 0, lethal: false })).toEqual([{ name: 'dodge', at: 110 }]);
    expect(one({ type: 'monsterHit', grade: 'good', dmg: 2, lethal: false })).toEqual([{ name: 'block', at: 110 }]);
    expect(one({ type: 'monsterHit', grade: 'miss', dmg: 5, lethal: true })).toEqual([{ name: 'hurt', at: 110 }]);
    expect(names(one({ type: 'counter', dmg: 4, killed: true }))).toEqual(['hit', 'death']);
    expect(one({ type: 'counter', dmg: 4, killed: false })[0]?.at).toBe(SOUND_AT.counter + SOUND_AT.heroImpact);
  });

  it('phase 2, rubber duck, charge press', () => {
    expect(one({ type: 'phase2' })).toEqual([{ name: 'phase', at: 250 }]);
    expect(names(one({ type: 'graded', result: { grade: 'good', why: 'rubber duck' }, text: 'x' }))).toEqual(['relic']);
    expect(names(one({ type: 'graded', result: { grade: 'good' }, text: 'x' }))).toEqual([]);
    expect(names(soundsFor([], { press: 'charge' }))).toEqual(['charge']);
    expect(names(soundsFor([], { press: 'bar' }))).toEqual([]);
  });

  it('shards: shard at 300 ms, ward at 750 ms when the Phantom is bound', () => {
    expect(one({ type: 'shard', have: 1, max: 3, bound: false })).toEqual([{ name: 'shard', at: 300 }]);
    expect(one({ type: 'shard', have: 3, max: 3, bound: true })).toEqual([
      { name: 'shard', at: 300 },
      { name: 'ward', at: 750 },
    ]);
  });

  it('relics and the end of the run', () => {
    expect(one({ type: 'relicOffer', ids: ['duck', 'cache', 'force'], title: 't' })).toEqual([{ name: 'chest', at: 380 }]);
    expect(names(one({ type: 'relicPicked', id: 'duck' }))).toEqual(['relic']);
    expect(names(one({ type: 'runEnded', won: true }))).toEqual(['win']);
    expect(one({ type: 'runEnded', won: true }, { newTrophies: 2 })).toEqual([
      { name: 'win', at: 0 },
      { name: 'relic', at: 900 },
    ]);
    expect(names(one({ type: 'runEnded', won: false }))).toEqual(['lose']);
  });

  it('never emits the removed v1.6 sounds', () => {
    const all: SoundCue[] = [];
    for (const won of [true, false]) all.push(...one({ type: 'runEnded', won }));
    all.push(...one({ type: 'shard', have: 3, max: 3, bound: true }), ...one({ type: 'monsterDown', boss: true }));
    expect(names(all)).not.toContain('blocked');
    expect(names(all)).not.toContain('gate');
  });
});

describe('musicModeFor', () => {
  it('menu screens play menu, the end screen is off', () => {
    expect(musicModeFor('start', null)).toBe('menu');
    expect(musicModeFor('summary', makeTestRun())).toBe('menu');
    expect(musicModeFor('loading', null)).toBe('menu');
    expect(musicModeFor('end', makeTestRun())).toBe('off');
  });

  it('the map plays explore; a finished run is off', () => {
    const s = makeTestRun();
    expect(musicModeFor('map', s)).toBe('explore');
    expect(musicModeFor('map', { ...s, status: 'won' } as RunState)).toBe('off');
    expect(musicModeFor('map', { ...s, status: 'lost' } as RunState)).toBe('off');
  });

  it('fights play combat, boss, and boss2 in phase 2', () => {
    expect(musicModeFor('map', makeFightRun(2))).toBe('combat');
    const boss = makeFightRun(5);
    expect(musicModeFor('map', boss)).toBe('boss');
    const p2 = { ...boss, combat: { ...boss.combat!, m: { ...boss.combat!.m, phase2: true } } };
    expect(musicModeFor('map', p2)).toBe('boss2');
  });
});
