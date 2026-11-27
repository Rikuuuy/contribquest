import { describe, expect, it } from 'vitest';
import { legalMoves, reveal } from '../../src/engine/explore';
import { rankOption, routeAction } from '../../src/engine/routebot';
import type { RunState } from '../../src/engine/state';
import { tileAt, type DayTile, type Tier } from '../../src/mapgen';
import { makeTestRun } from '../fixtures/run';

// Demo map: 14 columns, so the last SIM.bossWeeks = 2 columns are 12 and 13. Interior columns have all 7 rows,
// so from (col, 3) the legal moves are (col + 1, 2), (col + 1, 3), (col + 1, 4), in that order.

/** The hero on (col, 3) with the window revealed, at `pct`% HP. */
function at(col: number, pct = 100): RunState {
  const s = makeTestRun();
  s.pos = { col, row: 3 };
  reveal(s);
  s.hero.hp = Math.round((s.hero.maxHp * pct) / 100);
  return s;
}

function put(s: RunState, col: number, row: number, kind: DayTile['kind'], tier: 0 | Tier = 0): void {
  const t = tileAt(s.map, col, row);
  if (!t) throw new Error(`no tile at ${col},${row}`);
  Object.assign(t, { kind, tier, resolved: false });
}

type Kind = [DayTile['kind'], (0 | Tier)?];

/** Sets the three targets from (col, 3) to the given kinds, top to bottom. */
function options(s: RunState, kinds: [Kind, Kind, Kind]): void {
  const c = s.pos.col + 1;
  kinds.forEach(([kind, tier], i) => put(s, c, 2 + i, kind, tier ?? 0));
}

const to = (col: number, row: number) => ({ type: 'move', to: { col, row } });
const FOG: Kind = ['fog'];

describe('FR-PRO-1, FR-PRO-3: v1.6 route policy', () => {
  it('a demo interior column has three legal moves in row order', () => {
    expect(legalMoves(at(5))).toEqual([
      { col: 6, row: 2, boss: false },
      { col: 6, row: 3, boss: false },
      { col: 6, row: 4, boss: false },
    ]);
  });

  it('at 46% HP a Lich beats a chest; at 44% the chest beats the Lich', () => {
    for (const [pct, row] of [
      [46, 2],
      [44, 4],
    ] as const) {
      const s = at(5, pct);
      options(s, [['monster', 4], FOG, ['chest']]);
      expect(s.hero.hp / s.hero.maxHp < 0.45).toBe(pct === 44);
      expect(routeAction(s)).toEqual(to(6, row));
    }
  });

  it('in heal mode: wisp beats fog, then a Ghost beats an Imp', () => {
    const s = at(5, 44);
    options(s, [FOG, ['monster', 2], ['wisp']]);
    expect(routeAction(s)).toEqual(to(6, 4));
    const m = at(5, 44);
    options(m, [['monster', 2], ['monster', 1], ['monster', 4]]);
    expect(routeAction(m)).toEqual(to(6, 3));
    const f = at(5, 44);
    options(f, [['monster', 1], FOG, ['monster', 3]]);
    expect(routeAction(f)).toEqual(to(6, 3));
  });

  it('the 75% threshold applies only when the target column is ≥ cols − 2', () => {
    const s = at(11);
    expect(s.map.cols - 2).toBe(12);
    for (const [col, pct, row] of [
      [11, 74, 4],
      [11, 76, 2],
      [10, 74, 2],
    ] as const) {
      const r = at(col, pct);
      options(r, [['monster', 3], FOG, ['chest']]);
      expect(routeAction(r), `${col} ${pct}`).toEqual(to(col + 1, row));
    }
  });

  it('when healthy: tier 4 > 3 > 2 > 1 > chest > wisp > fog', () => {
    const order: Kind[] = [['monster', 4], ['monster', 3], ['monster', 2], ['monster', 1], ['chest'], ['wisp'], FOG];
    const s = at(5);
    const ranks = order.map(([kind, tier]) => {
      put(s, 6, 3, kind, tier ?? 0);
      return rankOption(s, { col: 6, row: 3, boss: false });
    });
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (let i = 0; i + 1 < order.length; i++) {
      const r = at(5);
      options(r, [order[i + 1]!, FOG, order[i]!]);
      expect(routeAction(r), `${i}`).toEqual(to(6, 4));
    }
  });

  it('ties go to the lower row (the first legal move)', () => {
    const s = at(5);
    options(s, [FOG, ['chest'], ['chest']]);
    expect(routeAction(s)).toEqual(to(6, 3));
    const h = at(5, 20);
    options(h, [['wisp'], FOG, ['wisp']]);
    expect(routeAction(h)).toEqual(to(6, 2));
  });

  it('takes a single option: the edge fallback and the boss node', () => {
    const s = at(5);
    // A tile whose next column has no day within one row (the fallback), or only one.
    const from = s.map.tiles.find((t) => t.col < s.map.cols - 1 && legalMoves({ ...s, pos: t }).length === 1)!;
    expect(from).toBeDefined();
    s.pos = { col: from.col, row: from.row };
    reveal(s);
    const [only] = legalMoves(s);
    expect(routeAction(s)).toEqual(to(only!.col, only!.row));
    const last = at(5);
    const end = last.map.tiles.find((t) => t.col === last.map.cols - 1)!;
    last.pos = { col: end.col, row: end.row };
    expect(legalMoves(last)).toEqual([{ ...last.map.bossNode, boss: true }]);
    expect(routeAction(last)).toEqual(to(last.map.bossNode.col, last.map.bossNode.row));
  });

  it('every ranked option is seen; ranking an unseen tile throws', () => {
    const s = at(5);
    for (const o of legalMoves(s)) expect(tileAt(s.map, o.col, o.row)?.seen).toBe(true);
    expect(() => rankOption(s, { col: 9, row: 3, boss: false })).toThrow(/not seen/);
  });

  it('sends advance when there is no legal move, and picks the first relic during an offer', () => {
    const s = at(5);
    s.pos = { ...s.map.bossNode };
    expect(routeAction(s)).toEqual({ type: 'advance' });
    const r = at(5);
    r.status = 'relic';
    r.relicOffer = ['duck', 'force', 'cache'];
    expect(routeAction(r)).toEqual({ type: 'pickRelic', i: 0 });
  });
});
