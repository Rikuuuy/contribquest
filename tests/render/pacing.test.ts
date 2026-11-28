import { describe, expect, it } from 'vitest';
import type { Fight, FightNext, GameEvent, Grade } from '../../src/engine';
import type { Tier } from '../../src/mapgen';
import { PACING, Pacer, resolvedKind } from '../../src/render/pacing';

function fight(next: FightNext | null, tier: Tier = 1): Fight {
  return {
    col: 0,
    row: 0,
    m: { name: 'Bug', tier, hp: 10, maxHp: 20, dmg: 3, xp: 5, phase2: false, bound: false },
    phase: 'wait',
    test: null,
    events: [],
    testId: 1,
    plan: ['normal', 'quick'],
    strikeIdx: 0,
    next,
    duckUsed: false,
    lines: [],
    last: null,
  };
}

const hit = (grades: Grade[], killed = false): GameEvent => ({ type: 'heroHit', grades, dmgs: grades.map(() => 3), killed });
const counter = (killed = false): GameEvent => ({ type: 'counter', dmg: 4, killed });
const monsterHit = (grade: Grade, lethal = false): GameEvent => ({ type: 'monsterHit', grade, dmg: 3, lethal });
const PHASE2: GameEvent = { type: 'phase2' };

const strike = (p: Pacer, next: FightNext, events: GameEvent[], tier: Tier = 1) =>
  p.delayFor({ fight: fight(next, tier), events, resolved: 'strike' });
const guard = (p: Pacer, next: FightNext, events: GameEvent[], tier: Tier = 1) =>
  p.delayFor({ fight: fight(next, tier), events, resolved: 'guard' });

describe('requirement 12.1: pacing table', () => {
  it('strike that kills: 950, boss 1300, plus 170 per extra combo hit', () => {
    const p = new Pacer();
    expect(strike(p, { kind: 'win' }, [hit(['good'], true)])).toBe(950);
    expect(strike(p, { kind: 'win' }, [hit(['good'], true)], 5)).toBe(1300);
    expect(strike(p, { kind: 'win' }, [hit(['good', 'perfect', 'miss'], true)])).toBe(950 + 2 * 170);
    expect(strike(p, { kind: 'win' }, [hit(['good', 'good', 'good'], true)], 5)).toBe(1300 + 340);
  });

  it('strike before the first guard: 600, or 1500 when phase 2 just began, plus combo gaps', () => {
    const p = new Pacer();
    expect(strike(p, { kind: 'strike', i: 0 }, [hit(['good'])])).toBe(600);
    expect(strike(p, { kind: 'strike', i: 0 }, [hit(['good', 'good', 'miss'])])).toBe(600 + 340);
    expect(strike(p, { kind: 'strike', i: 0 }, [hit(['perfect']), PHASE2], 5)).toBe(1500);
    expect(p.phase2Fresh).toBe(false);
    expect(strike(p, { kind: 'strike', i: 0 }, [hit(['good', 'good', 'good']), PHASE2], 5)).toBe(1500 + 340);
  });

  it('guard counter that kills: 1250, boss 1600', () => {
    const p = new Pacer();
    expect(guard(p, { kind: 'win' }, [counter(true)])).toBe(1250);
    expect(guard(p, { kind: 'win' }, [counter(true)], 5)).toBe(1600);
  });

  it('guard where the hero dies: 1100', () => {
    expect(guard(new Pacer(), { kind: 'lose' }, [monsterHit('miss', true)])).toBe(1100);
  });

  it('guard before the next strike in the plan: 750 after Perfect, else 500', () => {
    const p = new Pacer();
    expect(guard(p, { kind: 'strike', i: 1 }, [counter()])).toBe(750);
    expect(guard(p, { kind: 'strike', i: 1 }, [monsterHit('good')])).toBe(500);
    expect(guard(p, { kind: 'strike', i: 1 }, [monsterHit('miss')])).toBe(500);
  });

  it('guard back to the choice: 700 after Perfect, else 400, 1500 when phase 2 just began', () => {
    const p = new Pacer();
    expect(guard(p, { kind: 'choose' }, [counter()])).toBe(700);
    expect(guard(p, { kind: 'choose' }, [monsterHit('good')])).toBe(400);
    expect(guard(p, { kind: 'choose' }, [counter(), PHASE2], 5)).toBe(1500);
    expect(p.phase2Fresh).toBe(false);
    expect(guard(p, { kind: 'choose' }, [counter()], 5)).toBe(700);
  });

  it('v1.6: there is no flee row', () => {
    expect(Object.keys(PACING)).not.toContain('flee');
  });

  it('a fight without a next step waits 0 ms', () => {
    expect(new Pacer().delayFor({ fight: fight(null), events: [], resolved: 'guard' })).toBe(0);
  });
});

describe('requirement 12.2: the phase-2 flag', () => {
  it('is kept across a multi-strike plan and cleared on the next choice', () => {
    const p = new Pacer();
    // A Perfect counter on the first guard starts phase 2; two more guards follow.
    expect(guard(p, { kind: 'strike', i: 1 }, [counter(), PHASE2], 5)).toBe(750);
    expect(p.phase2Fresh).toBe(true);
    expect(guard(p, { kind: 'strike', i: 2 }, [monsterHit('good')], 5)).toBe(500);
    expect(p.phase2Fresh).toBe(true);
    expect(guard(p, { kind: 'choose' }, [monsterHit('miss')], 5)).toBe(1500);
    expect(p.phase2Fresh).toBe(false);
    expect(guard(p, { kind: 'choose' }, [monsterHit('miss')], 5)).toBe(400);
  });

  it('is used by the next strike delay', () => {
    const p = new Pacer();
    guard(p, { kind: 'strike', i: 1 }, [counter(), PHASE2], 5);
    expect(strike(p, { kind: 'strike', i: 0 }, [hit(['good'])], 5)).toBe(1500);
    expect(strike(p, { kind: 'strike', i: 0 }, [hit(['good'])], 5)).toBe(600);
  });

  it('is not used by a killing strike, and reset clears it', () => {
    const p = new Pacer();
    guard(p, { kind: 'strike', i: 1 }, [counter(), PHASE2], 5);
    expect(strike(p, { kind: 'win' }, [hit(['good'], true)], 5)).toBe(1300);
    expect(p.phase2Fresh).toBe(true);
    p.reset();
    expect(p.phase2Fresh).toBe(false);
  });
});

describe('resolvedKind', () => {
  it('is strike with a heroHit and guard otherwise', () => {
    expect(resolvedKind([hit(['good'])], { kind: 'strike', i: 0 })).toBe('strike');
    expect(resolvedKind([counter()], { kind: 'choose' })).toBe('guard');
    expect(resolvedKind([monsterHit('miss', true)], { kind: 'lose' })).toBe('guard');
    expect(resolvedKind([], null)).toBe('guard');
  });
});
