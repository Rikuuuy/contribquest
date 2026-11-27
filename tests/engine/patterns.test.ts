import { describe, expect, it } from 'vitest';
import { PHASE2_LINE, STRIKE_LINE, checkPhase2, patternDamageMult, strikePlan } from '../../src/engine/patterns';
import { step } from '../../src/engine/step';
import type { Monster } from '../../src/engine/state';
import type { Tier } from '../../src/mapgen/types';
import { bossFightOn, makeFightRun, makeTestRun } from '../fixtures/run';

const mon = (tier: Tier, o: Partial<Monster> = {}): Monster => ({ name: 'M', tier, hp: 40, maxHp: 40, dmg: 5, xp: 0, phase2: false, bound: false, ...o });
const draws = (...v: number[]) => {
  const f = Object.assign(() => (f.calls++, v.shift() ?? 0), { calls: 0 });
  return f;
};

describe('FR-CLS-7: strike plans', () => {
  it('tiers 1, 2, and the boss draw nothing', () => {
    const r = draws();
    expect(strikePlan(mon(1), r)).toEqual(['normal']);
    expect(strikePlan(mon(2), r)).toEqual(['normal', 'quick']);
    expect(strikePlan(mon(5), r)).toEqual(['normal', 'flaky']);
    expect(strikePlan(mon(5, { phase2: true }), r)).toEqual(['conflict', 'flaky', 'quick']);
    expect(r.calls).toBe(0);
  });

  it('tier 3 flaky and tier 4 conflict when rand() < 0.65, one draw each', () => {
    const r = draws(0.64, 0.65, 0.64, 0.65);
    expect(strikePlan(mon(3), r)).toEqual(['flaky']);
    expect(strikePlan(mon(3), r)).toEqual(['normal']);
    expect(strikePlan(mon(4), r)).toEqual(['conflict']);
    expect(strikePlan(mon(4), r)).toEqual(['normal']);
    expect(r.calls).toBe(4);
  });

  it('FR-COM-5: strike lines', () => {
    const m = { name: 'Bug Imp' };
    expect(STRIKE_LINE.normal(m)).toBe('Bug Imp lunges at you!');
    expect(STRIKE_LINE.quick(m)).toBe('Bug Imp strikes again, fast!');
    expect(STRIKE_LINE.flaky(m)).toBe('Bug Imp flickers. Is it attacking or not?');
    expect(STRIKE_LINE.conflict(m)).toBe('Bug Imp splits into two timelines! Dodge the solid one.');
  });
});

describe('FR-COM-2: guard damage multipliers', () => {
  it('Bug Imp × 0.6, boss in phase 2 × 0.75, others × 1', () => {
    expect(patternDamageMult(mon(1))).toBe(1);
    expect(patternDamageMult(mon(2))).toBe(0.6);
    expect(patternDamageMult(mon(3))).toBe(1);
    expect(patternDamageMult(mon(4))).toBe(1);
    expect(patternDamageMult(mon(5))).toBe(1);
    expect(patternDamageMult(mon(5, { phase2: true }))).toBe(0.75);
  });
});

describe('FR-COM-5: boss phase 2', () => {
  it('triggers once, at exactly half HP, only for the boss', () => {
    const b = mon(5, { hp: 21 });
    expect(checkPhase2(b)).toBe(false);
    b.hp = 20;
    expect(checkPhase2(b)).toBe(true);
    expect(b.phase2).toBe(true);
    b.hp = 5;
    expect(checkPhase2(b)).toBe(false);
    expect(checkPhase2(mon(4, { hp: 1 }))).toBe(false);
  });

  it('v1.6: a bound boss (3 shards) never triggers, at any HP', () => {
    const b = mon(5, { bound: true });
    for (const hp of [20, 10, 1]) {
      b.hp = hp;
      expect(checkPhase2(b)).toBe(false);
    }
    expect(b.phase2).toBe(false);
  });

  it('v1.6: a bound boss at half HP stays in phase 1 through a strike and the next turn', () => {
    let s = bossFightOn(makeTestRun(), 3);
    expect(s.combat!.m.bound).toBe(true);
    s.combat!.m.hp = Math.floor(s.combat!.m.maxHp / 2);
    s = step(s, { type: 'attack' });
    s = step(s, { type: 'forceGrade', grade: 'good' });
    expect(s.combat!.m.hp).toBeGreaterThan(0);
    expect(s.combat!.m.phase2).toBe(false);
    expect(s.events.map((e) => e.type)).not.toContain('phase2');
    s = step(s, { type: 'advance' });
    expect(s.combat!.plan).toEqual(['normal', 'flaky']);
  });

  it('does not trigger when the hit kills', () => {
    const b = mon(5, { hp: 0 });
    expect(checkPhase2(b)).toBe(false);
    expect(b.phase2).toBe(false);
  });

  it('on a strike: logs the line, emits the event, and the next turn uses the phase-2 plan', () => {
    let s = makeFightRun(5);
    s.combat!.m.hp = 35; // the boss has 69; one Good bar hit of 9 ± 10% takes it to ≤ 34.5
    s = step(s, { type: 'attack' });
    s = step(s, { type: 'forceGrade', grade: 'good' });
    expect(s.combat!.m.phase2).toBe(true);
    expect(s.events.map((e) => e.type)).toContain('phase2');
    expect(s.combat!.lines).toContain(PHASE2_LINE);
    s = step(s, { type: 'advance' });
    expect(s.combat!.plan).toEqual(['conflict', 'flaky', 'quick']);
    expect(s.combat!.test!.pattern).toBe('conflict');
  });

  it('on a counter, and a plan already in progress keeps its remaining strikes', () => {
    let s = makeFightRun(5, { cls: 'rogue' });
    s = step(s, { type: 'attack' });
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    s = step(s, { type: 'advance' });
    expect(s.combat!.plan).toEqual(['normal', 'flaky']);
    s.combat!.m.hp = 40; // a Rogue sidestep counter hits for full ATK (9)
    s = step(s, { type: 'forceGrade', grade: 'perfect' });
    expect(s.combat!.m.phase2).toBe(true);
    expect(s.events.filter((e) => e.type === 'phase2')).toHaveLength(1);
    s = step(s, { type: 'advance' });
    expect(s.combat!.plan).toEqual(['normal', 'flaky']);
    expect(s.combat!.test!.pattern).toBe('flaky');
    expect(s.combat!.test!.target).toBeGreaterThan(0);
    s = step(s, { type: 'forceGrade', grade: 'perfect' });
    expect(s.events.filter((e) => e.type === 'phase2')).toHaveLength(0);
  });

  it('phase 2 speeds guard tests up by 0.85', () => {
    let a = makeFightRun(5);
    a = step(step(step(a, { type: 'attack' }), { type: 'forceGrade', grade: 'miss' }), { type: 'advance' });
    let b = makeFightRun(5);
    b.combat!.m.phase2 = true;
    b.combat!.m.hp = 30;
    b.combat!.plan = ['normal'];
    b = step(step(b, { type: 'attack' }), { type: 'forceGrade', grade: 'miss' });
    b.combat!.next = { kind: 'strike', i: 1 };
    b.combat!.plan = ['normal', 'normal'];
    b = step(b, { type: 'advance' });
    // Same tier and class; phase 2 also lowers pressure by 0.9, which changes tm: compare against the formula.
    const tmA = 0.96 * (0.8 + 0.2 * 1);
    const tmB = 0.96 * (0.8 + 0.2 * 0.9);
    expect(a.combat!.test!.target / tmA).toBeCloseTo(750, 6);
    expect(b.combat!.test!.target / tmB).toBeCloseTo(750 * 0.85, 6);
  });
});
