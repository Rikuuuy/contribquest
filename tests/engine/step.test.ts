import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { endRun, newRun } from '../../src/engine/run';
import { nextDeadline, resumeFight, step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { legalMoves } from '../../src/engine/explore';
import { tileAt } from '../../src/mapgen/layout';
import { nextOptions } from '../../src/mapgen/routes';
import type { DayTile, Pos } from '../../src/mapgen/types';
import { demoSet, makeFightRun, makeTestRun } from '../fixtures/run';

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
    const f = makeFightRun(4);
    f.combat!.m.hp = 1; // the timeout's glancing blow wins the fight
    let s = deepFreeze(f);
    const actions: ((s: RunState) => Action)[] = [
      () => ({ type: 'attack' }),
      () => ({ type: 'press', t: 50, key: 'k' }),
      () => ({ type: 'timeout', t: 5000 }),
      () => ({ type: 'advance' }),
      () => ({ type: 'forceGrade', grade: 'good' }),
      () => ({ type: 'advance' }),
      (x) => ({ type: 'move', to: legalMoves(x)[0]! }),
      () => ({ type: 'pickRelic', i: 0 }),
      () => ({ type: 'setOptions', opts: { calm: true, assist: false } }),
    ];
    for (const a of actions) s = deepFreeze(step(s, a(s)));
    expect([s.stats.defeated, s.stats.steps, s.opts.calm]).toEqual([1, 1, true]);
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
  it('Attack only in choose; presses only during a test', () => {
    const s = makeFightRun(2);
    expect(step(s, { type: 'press', t: 500, key: 'k' })).toEqual({ ...s, events: [] });
    const t = step(s, { type: 'attack' });
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
    expect([s.bossDown, s.status]).toEqual([true, 'won']);
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

describe('FR-COM-4: retry', () => {
  const settings = { heroClass: 'mage', heroRace: 'elf', calm: true, assist: false } as const;
  const fresh = (heroSet: ContributionSet | null) => {
    const r = newRun(demoSet(), heroSet, settings);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };
  const lose = (s: RunState): RunState => {
    const d = structuredClone(s);
    d.pos = { ...d.map.tiles[5]! };
    d.stats.steps = 12;
    d.stats.defeated = 3;
    d.hero.hp = 0;
    d.shards = 1;
    endRun(d, 'lost', 'Imp');
    return d;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('a lost run restarts on the same set and heroSet, with the same class, race, and options, and no fetch', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const raider = { ...demoSet(), username: 'raider' };
    for (const heroSet of [null, raider]) {
      const lost = deepFreeze(lose(fresh(heroSet)));
      expect(lost.status).toBe('lost');
      const r = step(lost, { type: 'retry' });
      expect(r).toEqual(fresh(heroSet));
      expect(r.set).toEqual(lost.set);
      expect(r.heroSet).toEqual(lost.heroSet);
      expect(r.status).toBe('exploring');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the options changed during the run', () => {
    const lost = lose(step(fresh(null), { type: 'setOptions', opts: { calm: false, assist: true } }));
    expect(step(lost, { type: 'retry' }).opts).toEqual({ calm: false, assist: true });
  });

  it('is ignored while the run is still going', () => {
    const s = fresh(null);
    expect(step(s, { type: 'retry' })).toEqual({ ...s, events: [] });
    const f = makeFightRun(2);
    expect(step(f, { type: 'retry' })).toEqual({ ...f, events: [] });
  });
});

describe('v1.6 FR-MOV-1, FR-MOV-3, FR-MOV-8: forward-only moves', () => {
  /** Puts the hero on a resolved tile in the column before a target matching `pred`, from which it is a legal move. */
  function before(s: RunState, pred: (t: DayTile) => boolean): DayTile {
    for (const t of s.map.tiles) {
      if (t.col < 1 || t.resolved || !pred(t)) continue;
      const from = s.map.tiles.find(
        (p) => p.col === t.col - 1 && nextOptions(s.map, p).some((o) => o.col === t.col && o.row === t.row),
      );
      if (!from) continue;
      from.resolved = from.visited = true;
      s.pos = { col: from.col, row: from.row };
      s.stats.steps = from.col;
      return t;
    }
    throw new Error('No matching target.');
  }
  const to = (p: Pos): Action => ({ type: 'move', to: { col: p.col, row: p.row } });

  it('each legal target from the start: one column forward, one step, a moved event; class change refused after', () => {
    const s = makeTestRun();
    const opts = legalMoves(s);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      const r = step(s, to(o));
      expect(r.pos).toEqual({ col: o.col, row: o.row });
      expect(r.prev).toEqual(s.pos);
      expect(r.stats.steps).toBe(1);
      expect(r.events[0]).toEqual({ type: 'moved', from: s.pos, to: { col: o.col, row: o.row } });
      expect(tileAt(r.map, o.col, o.row)!.visited).toBe(true);
      if (r.status === 'exploring') expect(step(r, { type: 'chooseClass', cls: 'rogue' }).hero.cls).toBe('wanderer');
    }
  });

  it('refused moves (behind, sideways, two ahead, off the route) return an equal state with no events or log', () => {
    const s = makeTestRun();
    const t = before(s, (x) => x.col === 4);
    const here = s.pos;
    const legal = legalMoves(s);
    const bad: Pos[] = [
      { col: here.col - 1, row: here.row },
      { col: here.col, row: here.row },
      { col: here.col, row: here.row + 1 },
      { col: here.col + 2, row: here.row },
      { col: here.col + 1, row: here.row + 3 },
      { col: 99, row: 0 },
      { ...s.map.bossNode },
    ].filter((p) => !legal.some((o) => o.col === p.col && o.row === p.row));
    expect(bad.length).toBeGreaterThan(4);
    for (const p of bad) expect(step(s, to(p)), JSON.stringify(p)).toEqual({ ...s, events: [] });
    expect(t.col).toBe(here.col + 1);
  });

  it('FR-MOV-3: no moves during a fight or a relic offer', () => {
    const f = makeFightRun(2);
    const fo = nextOptions(f.map, f.pos)[0]!;
    expect(step(f, to(fo))).toEqual({ ...f, events: [] });
    const s = makeTestRun();
    const chest = before(s, (x) => x.kind === 'chest');
    const r = step(s, to(chest));
    expect(r.status).toBe('relic');
    const next = legalMoves(r)[0]!;
    expect(step(r, to(next))).toEqual({ ...r, events: [] });
  });

  it('fog: a quiet day, resolved at once', () => {
    const s = makeTestRun({ hero: { hp: 10 } });
    const t = before(s, (x) => x.kind === 'fog');
    const r = step(s, to(t));
    expect(r.status).toBe('exploring');
    expect(tileAt(r.map, t.col, t.row)!.resolved).toBe(true);
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'rest']);
    expect(r.hero.hp).toBeGreaterThan(10);
  });

  it('wisp: collected and resolved', () => {
    const s = makeTestRun();
    const t = before(s, (x) => x.kind === 'wisp');
    const r = step(s, to(t));
    expect([r.status, r.stats.wisps, tileAt(r.map, t.col, t.row)!.resolved]).toEqual(['exploring', 1, true]);
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'wisp', 'xp']);
  });

  it('chest: opened, resolved, and the relic offer blocks the next move until picked', () => {
    const s = makeTestRun();
    const t = before(s, (x) => x.kind === 'chest');
    let r = step(s, to(t));
    expect([r.status, r.stats.chests, tileAt(r.map, t.col, t.row)!.resolved]).toEqual(['relic', 1, true]);
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'chest', 'xp', 'relicOffer']);
    r = step(r, { type: 'pickRelic', i: 0 });
    expect(r.status).toBe('exploring');
    expect(step(r, to(legalMoves(r)[0]!)).stats.steps).toBe(r.stats.steps + 1);
  });

  it('monster: starts a fight on the tile; the tile resolves only when the fight is won', () => {
    const s = makeTestRun();
    const t = before(s, (x) => x.kind === 'monster');
    let r = step(s, to(t));
    expect(r.status).toBe('combat');
    expect(r.events).toEqual([{ type: 'moved', from: s.pos, to: { col: t.col, row: t.row } }, { type: 'fightStart', boss: false }]);
    expect([r.combat!.col, r.combat!.row]).toEqual([t.col, t.row]);
    expect(tileAt(r.map, t.col, t.row)!.resolved).toBe(false);
    r.combat!.m.hp = 1;
    r = run(r, [{ type: 'attack' }, { type: 'forceGrade', grade: 'good' }, { type: 'advance' }]);
    expect([r.status, tileAt(r.map, t.col, t.row)!.resolved]).toEqual(['exploring', true]);
  });

  it('a resolved tile entered in a hand-built state does nothing more', () => {
    const s = makeTestRun();
    const t = before(s, (x) => x.kind === 'monster');
    t.resolved = true;
    const r = step(s, to(t));
    expect([r.status, r.events.map((e) => e.type)]).toEqual(['exploring', ['moved']]);
  });

  it('the boss node: from the last column, a boss fight on the node; winning it wins the run', () => {
    const s = makeTestRun();
    const last = s.map.tiles.find((x) => x.col === s.map.cols - 1)!;
    last.resolved = last.visited = true;
    s.pos = { col: last.col, row: last.row };
    s.stats.steps = last.col;
    s.shards = 2;
    expect(legalMoves(s)).toEqual([{ ...s.map.bossNode, boss: true }]);
    let r = step(s, to(s.map.bossNode));
    expect(r.pos).toEqual(s.map.bossNode);
    expect(r.stats.steps).toBe(s.map.cols);
    expect(r.events).toEqual([{ type: 'moved', from: s.pos, to: s.map.bossNode }, { type: 'fightStart', boss: true }]);
    expect([r.status, r.combat!.col, r.combat!.row, r.combat!.m.tier]).toEqual(['combat', s.map.bossNode.col, s.map.bossNode.row, 5]);
    expect(r.combat!.lines.slice(0, 2)).toEqual([
      'The air turns cold. Your best day has come back for you.',
      '2 soul shards weaken the Phantom: 20% less HP.',
    ]);
    expect(legalMoves(r)).toEqual([]);
    r.combat!.m.hp = 1;
    r = run(r, [{ type: 'attack' }, { type: 'forceGrade', grade: 'good' }, { type: 'advance' }]);
    expect([r.status, r.bossDown]).toEqual(['won', true]);
    expect(r.events.slice(-2)).toEqual([{ type: 'won' }, { type: 'runEnded', won: true }]);
  });
});
