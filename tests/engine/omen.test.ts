import { describe, expect, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { BLESSING_TITLE, enterMap, offerBlessing, omenFor, omenLog } from '../../src/engine/omen';
import { newRun, type RunSettings } from '../../src/engine/run';
import type { RunState } from '../../src/engine/state';
import { step } from '../../src/engine/step';
import { makeSet, windowDays } from '../fixtures/sets';
import { demoSet, makeFightRun, makeTestRun } from '../fixtures/run';

const SETTINGS: RunSettings = { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false };
const CURSE = 'Uncommitted Curse: no contributions today, so monsters hit 15% harder. Commit to lift it.';

function run(set: ContributionSet, heroSet: ContributionSet | null = null): RunState {
  const r = newRun(set, heroSet, SETTINGS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const todayCount = (n: number, name?: string) =>
  makeSet(windowDays((i) => ({ count: i === 90 ? n : (i % 4) * 2 })), name);

describe('FR-OMEN-1: blessed or cursed from today’s tile', () => {
  it('blessed with at least one contribution on the last day, cursed with none', () => {
    expect(omenFor(todayCount(1))).toBe('blessed');
    expect(omenFor(todayCount(9))).toBe('blessed');
    expect(omenFor(todayCount(0))).toBe('cursed');
  });

  it('newRun: pendingBlessing only when blessed', () => {
    const b = run(todayCount(2));
    const c = run(todayCount(0));
    expect([b.hero.omen, b.pendingBlessing]).toEqual(['blessed', true]);
    expect([c.hero.omen, c.pendingBlessing]).toEqual(['cursed', false]);
  });

  it('a raid takes the omen from the raider, not the map set', () => {
    const s = run(todayCount(3, 'map-owner'), todayCount(0, 'raider'));
    expect([s.hero.omen, s.pendingBlessing]).toEqual(['cursed', false]);
    const t = run(todayCount(0, 'map-owner'), todayCount(3, 'raider'));
    expect([t.hero.omen, t.pendingBlessing]).toEqual(['blessed', true]);
  });
});

describe('FR-OMEN-3: omen log lines', () => {
  it('blessing names the hero; the curse line is fixed', () => {
    expect(omenLog('blessed', 'octo-cat')).toBe('Commit Blessing: octo-cat contributed today, so a relic awaits.');
    expect(omenLog('cursed', 'octo-cat')).toBe(CURSE);
    expect(run(todayCount(0)).log[1]).toBe(CURSE);
    expect(run(demoSet()).log[1]).toBe('Commit Blessing: demo-necromancer contributed today, so a relic awaits.');
  });
});

describe('FR-OMEN-2: enterMap and offerBlessing', () => {
  it('the blessing title', () => {
    expect(BLESSING_TITLE).toBe('Commit Blessing: you contributed today. Choose a relic.');
  });

  it('enterMap emits blessingDue once and clears pendingBlessing', () => {
    const s0 = run(demoSet());
    const s1 = step(s0, { type: 'enterMap' });
    expect([s1.pendingBlessing, s1.events]).toEqual([false, [{ type: 'blessingDue' }]]);
    const s2 = step(s1, { type: 'enterMap' });
    expect([s2.pendingBlessing, s2.events]).toEqual([false, []]);
    expect(s1.rng).toBe(s0.rng);
  });

  it('enterMap does nothing on a cursed run', () => {
    const s = step(run(todayCount(0)), { type: 'enterMap' });
    expect(s.events).toEqual([]);
  });

  it('enterMap keeps the blessing pending while not exploring', () => {
    const s = makeFightRun(2);
    s.pendingBlessing = true;
    enterMap(s);
    expect([s.pendingBlessing, s.events]).toEqual([true, []]);
  });

  it('offerBlessing offers a relic with the blessing title', () => {
    const s = step(step(run(demoSet()), { type: 'enterMap' }), { type: 'offerBlessing' });
    expect(s.status).toBe('relic');
    expect(s.relicTitle).toBe(BLESSING_TITLE);
    expect(s.relicOffer).toHaveLength(3);
    expect(s.events).toEqual([{ type: 'relicOffer', ids: s.relicOffer, title: BLESSING_TITLE }]);
  });

  it('offerBlessing is ignored outside exploring (the hero walked into a fight, or the run ended)', () => {
    const fight = makeFightRun(2);
    const rng = fight.rng;
    offerBlessing(fight);
    expect([fight.status, fight.relicOffer, fight.rng, fight.events]).toEqual(['combat', null, rng, []]);
    const ended = makeTestRun();
    ended.status = 'lost';
    offerBlessing(ended);
    expect([ended.status, ended.relicOffer]).toEqual(['lost', null]);
  });
});
