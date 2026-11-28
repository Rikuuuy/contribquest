import { describe, expect, it } from 'vitest';
import { createAudio, heartbeatGap, MASTER_GAIN, type SoundName } from '../../src/audio/sfx';

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
