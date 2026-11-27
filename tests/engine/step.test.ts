import { describe, expect, it } from 'vitest';
import { nextDeadline, resumeFight, step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { tileAt } from '../../src/mapgen/layout';
import { makeFightRun, makeTestRun } from '../fixtures/run';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const run = (s: RunState, actions: Action[]) => actions.reduce(step, s);

/** Plays a test with a press exactly on target (charge: a release on the target hold; combo: every mark). */
function perfectInputs(s: RunState): Action[] {
  const t = s.combat!.test!;
  if (t.mode === 'combo') return t.marks!.map((m) => ({ type: 'press', t: m, key: 'k' }) as Action);
  if (t.mode === 'charge') return [{ type: 'press', t: 200, key: 'k' }, { type: 'release', t: 200 + t.target, key: 'k' }];
  return [{ type: 'press', t: t.target, key: 'k' }];
}

describe('FR-COM-5: step is pure', () => {
  it('never mutates its input (deep-frozen) through a whole fight and a move', () => {
    let s = deepFreeze(makeFightRun(4));
    const actions: Action[] = [
      { type: 'attack' },
      { type: 'press', t: 50, key: 'k' },
      { type: 'timeout', t: 5000 },
      { type: 'advance' },
      { type: 'forceGrade', grade: 'good' },
      { type: 'advance' },
      { type: 'flee' },
      { type: 'forceGrade', grade: 'miss' },
      { type: 'advance' },
      { type: 'move', dir: 'down' },
      { type: 'pickRelic', i: 0 },
      { type: 'setOptions', opts: { calm: true, assist: false } },
    ];
    for (const a of actions) s = deepFreeze(step(s, a));
    expect(s.status).toBe('exploring');
  });

  it('FR-MAP-3: the same state and actions give the same states, RNG included', () => {
    const actions: Action[] = [
      { type: 'attack' },
      { type: 'forceGrade', grade: 'good' },
      { type: 'advance' },
      { type: 'press', t: 700, key: 'k' },
      { type: 'advance' },
      { type: 'attack' },
      { type: 'timeout', t: 99999 },
    ];
    const a: RunState[] = [];
    const b: RunState[] = [];
    actions.reduce((s, x) => (a.push(step(s, x)), a.at(-1)!), makeFightRun(4));
    actions.reduce((s, x) => (b.push(step(s, x)), b.at(-1)!), makeFightRun(4));
    expect(a).toEqual(b);
    expect(new Set(a.map((s) => s.rng)).size).toBeGreaterThan(2);
  });

  it('events hold only what the last step emitted', () => {
    const s = step(makeFightRun(2), { type: 'attack' });
    expect(s.events).toEqual([{ type: 'testStart', testId: 1, mode: 'bar', pattern: 'normal' }]);
    expect(step(s, { type: 'press', t: 10, key: 'k' }).events).toEqual([]);
  });
});

describe('FR-COM-1: actions by phase', () => {
  it('Attack and Flee only in choose; presses only during a test', () => {
    const s = makeFightRun(2);
    expect(step(s, { type: 'press', t: 500, key: 'k' })).toEqual({ ...s, events: [] });
    const t = step(s, { type: 'attack' });
    expect(step(t, { type: 'flee' }).combat).toEqual(t.combat);
    expect(step(t, { type: 'attack' }).combat!.testId).toBe(1);
    expect(step(t, { type: 'advance' }).combat).toEqual(t.combat);
  });

  it('each new test gets a new testId', () => {
    const s = run(makeFightRun(2), [{ type: 'attack' }, { type: 'forceGrade', grade: 'miss' }, { type: 'advance' }]);
    expect(s.combat!.testId).toBe(2);
    expect(s.events).toEqual([{ type: 'testStart', testId: 2, mode: 'ring', pattern: 'normal' }]);
  });
});

describe('FR-COM-5: nextDeadline', () => {
  it('null outside a test', () => {
    expect(nextDeadline(makeTestRun())).toBeNull();
    expect(nextDeadline(makeFightRun(2))).toBeNull();
  });

  it('per mode, and it updates with the input', () => {
    const bar = step(makeFightRun(2), { type: 'attack' });
    const tb = bar.combat!.test!;
    expect(nextDeadline(bar)).toEqual({ t: tb.dur + 30, action: { type: 'timeout', t: tb.dur + 30 } });

    const mage = step(makeFightRun(2, { cls: 'mage' }), { type: 'attack' });
    expect(nextDeadline(mage)!.t).toBe(2600);
    const held = step(mage, { type: 'press', t: 200, key: 'k' });
    expect(nextDeadline(held)!.t).toBe(200 + held.combat!.test!.fill! + 20);

    const rogue = step(makeFightRun(2, { cls: 'rogue' }), { type: 'attack' });
    expect(nextDeadline(rogue)!.t).toBe(rogue.combat!.test!.dur + 30);

    const knight = run(makeFightRun(2, { cls: 'knight' }), [{ type: 'attack' }, { type: 'forceGrade', grade: 'miss' }, { type: 'advance' }]);
    const ts = knight.combat!.test!;
    expect(ts.mode).toBe('shield');
    expect(nextDeadline(knight)!.t).toBe(ts.target + ts.P + 10);
    expect(nextDeadline(step(knight, { type: 'press', t: 300, key: 'k' }))!.t).toBe(ts.target);

    const assist = step(makeFightRun(2, { opts: { assist: true } }), { type: 'attack' });
    expect(nextDeadline(assist)!.t).toBe(assist.combat!.test!.target);
  });

  it('a timeout at the deadline grades the test', () => {
    let s = step(makeFightRun(2), { type: 'attack' });
    s = step(s, nextDeadline(s)!.action);
    expect(s.events.find((e) => e.type === 'graded')).toEqual({ type: 'graded', result: { grade: 'miss', why: 'too late' }, text: 'TOO LATE · GLANCING BLOW' });
    expect(s.combat!.phase).toBe('wait');
  });

  it('a timeout before the deadline does nothing', () => {
    const s = step(makeFightRun(2), { type: 'attack' });
    expect(step(s, { type: 'timeout', t: 10 }).combat!.phase).toBe('test');
  });

  it('FR-COM-7: Auto-timing grades Good at the deadline and ignores presses', () => {
    let s = step(makeFightRun(2, { opts: { assist: true } }), { type: 'attack' });
    const t = s.combat!.test!.target;
    s = step(s, { type: 'press', t, key: 'k' });
    expect(s.events.find((e) => e.type === 'graded')).toMatchObject({ result: { grade: 'good' } });
  });
});

describe('FR-COM-1: scripted fights', () => {
  /** Plays to the end with `pick` choosing the inputs per test; returns the final state. */
  function playOut(s: RunState, pick: (s: RunState) => Action[]): RunState {
    for (let i = 0; i < 300 && s.status === 'combat'; i++) {
      const c = s.combat!;
      if (c.phase === 'choose') s = step(s, { type: 'attack' });
      else if (c.phase === 'wait') s = step(s, { type: 'advance' });
      else {
        s = run(s, pick(s));
        if (s.combat?.phase === 'test') s = step(s, nextDeadline(s)!.action);
      }
    }
    return s;
  }

  it('to a win with real presses on target', () => {
    for (const cls of ['wanderer', 'knight', 'rogue', 'mage'] as const) {
      const s = playOut(makeFightRun(4, { cls }), perfectInputs);
      expect(s.status, cls).toBe('exploring');
      expect(s.stats.defeated).toBe(1);
      expect(s.hero.hp).toBe(s.hero.maxHp);
      expect(s.stats.dodges).toBeGreaterThan(0);
    }
  });

  it('to a loss when nothing is pressed', () => {
    const s = playOut(makeFightRun(4), () => []);
    expect([s.status, s.killer, s.hero.hp]).toEqual(['lost', 'Merge Conflict Lich', 0]);
  });

  it('a boss fight through phase 2 to a win', () => {
    let s = makeFightRun(5, { level: 8 });
    const seen = new Set<string>();
    for (let i = 0; i < 300 && s.status === 'combat'; i++) {
      const c = s.combat!;
      if (c.phase === 'choose') s = step(s, { type: 'attack' });
      else if (c.phase === 'wait') s = step(s, { type: 'advance' });
      else {
        seen.add(`${c.m.phase2 ? 2 : 1}:${c.test!.pattern}`);
        s = step(s, { type: 'forceGrade', grade: c.test!.kind === 'attack' ? 'good' : 'perfect' });
      }
    }
    expect(s.bossDown).toBe(true);
    // Phase 1 plans normal + flaky; phase 2 plans conflict + flaky + quick.
    expect(seen.has('1:normal')).toBe(true);
    expect(seen.has('2:conflict')).toBe(true);
    expect([...seen].every((x) => ['1:normal', '1:flaky', '2:normal', '2:flaky', '2:conflict', '2:quick'].includes(x))).toBe(true);
  });

  it('FR-REL-3: forceGrade goes through Rubber Duck', () => {
    const s = run(makeFightRun(2, { relics: ['duck'] }), [{ type: 'attack' }, { type: 'forceGrade', grade: 'miss' }]);
    expect(s.combat!.last).toEqual({ text: 'RUBBER DUCK · GOOD HIT', cls: 'good' });
    expect(s.combat!.duckUsed).toBe(true);
  });
});

describe('FR-COM-7: restore', () => {
  it('a fight restored with a test in progress resumes at choose without the test', () => {
    const s = run(makeFightRun(2), [{ type: 'attack' }, { type: 'press', t: 50, key: 'k' }]);
    const r = resumeFight(JSON.parse(JSON.stringify(s)));
    expect(r.combat).toMatchObject({ phase: 'choose', test: null, events: [], next: null });
    expect(r.rng).toBe(s.rng);
    expect(step(r, { type: 'attack' }).combat!.phase).toBe('test');
    const exploring = makeTestRun();
    expect(resumeFight(exploring)).toBe(exploring);
  });
});

describe('FR-MOV, FR-CLS-1: moves and class change', () => {
  it('a move counts a step; class change is refused afterwards', () => {
    let s = makeTestRun();
    s = step(s, { type: 'move', dir: 'down' });
    expect(s.stats.steps).toBe(1);
    expect(step(s, { type: 'chooseClass', cls: 'rogue' }).hero.cls).toBe('wanderer');
  });

  it('void moves do nothing; a sealed Gate is blocked with a log line', () => {
    const s = makeTestRun();
    expect(step(s, { type: 'move', dir: 'left' })).toEqual({ ...s, events: [] });
    const g = s.map.tiles[90]!;
    const near = structuredClone(s);
    near.pos = { col: g.col, row: g.row - 1 };
    if (!tileAt(near.map, near.pos.col, near.pos.row)) near.pos = { col: g.col - 1, row: g.row };
    const dir = near.pos.col === g.col ? 'down' : 'right';
    const r = step(near, { type: 'move', dir });
    expect(r.pos).toEqual(near.pos);
    expect(r.log.at(-1)).toBe('The Gate is sealed. Defeat the Phantom of your best day first.');
    expect(r.events).toEqual([{ type: 'blocked', col: g.col, row: g.row }]);
    expect(r.stats.steps).toBe(0);
  });

  it('entering a monster starts a fight; an unsealed Gate wins the run', () => {
    const s = makeTestRun();
    const m = s.map.tiles.find((t) => t.kind === 'monster' && tileAt(s.map, t.col - 1, t.row)?.kind !== 'monster')!;
    const at = structuredClone(s);
    at.pos = { col: m.col - 1, row: m.row };
    const r = step(at, { type: 'move', dir: 'right' });
    expect(r.status).toBe('combat');
    expect(r.events).toEqual([{ type: 'fightStart', boss: false }]);
    expect(r.prev).toEqual(at.pos);

    const g = s.map.tiles[90]!;
    const open = structuredClone(s);
    open.bossDown = true;
    open.pos = { col: g.col, row: g.row - 1 };
    const w = step(open, { type: 'move', dir: 'down' });
    expect(w.status).toBe('won');
    expect(w.events).toEqual([{ type: 'won' }, { type: 'runEnded', won: true }]);
  });

  it('no moves during a fight', () => {
    const s = makeFightRun(2);
    expect(step(s, { type: 'move', dir: 'up' }).pos).toEqual(s.pos);
  });
});
