import { describe, expect, it } from 'vitest';
import type { ContributionDay } from '../../src/data/schema';
import { loadDemo } from '../../src/data/demo';
import { assignTiles, bestDayIndex } from '../../src/mapgen/assign';
import { generateMap } from '../../src/mapgen/generate';
import { layoutDays, tileAt } from '../../src/mapgen/layout';
import { minFightRoute, nextOptions, reachableIdx, routeMinFights } from '../../src/mapgen/routes';
import type { GameMap } from '../../src/mapgen/types';
import { SATURDAY_END } from '../fixtures/profiles';
import { windowDays } from '../fixtures/sets';

function demoMap(): GameMap {
  const r = generateMap(loadDemo(() => Date.UTC(2026, 10, 19)));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** A map straight from layout and assignment, with no shortfall, so tests can set kinds by hand. */
function rawMap(days: ContributionDay[]): GameMap {
  const { w0, cols, cells } = layoutDays(days);
  const best = bestDayIndex(days);
  const tiles = assignTiles(days, cells, best);
  return {
    cols,
    rows: 7,
    w0,
    tiles,
    seed: 0,
    bossIdx: best.idx,
    bossNode: { col: cols, row: tiles[best.idx]!.row },
    emptyQuarter: best.emptyQuarter,
    quiet: false,
  };
}

const opt = (col: number, row: number, boss = false) => ({ col, row, boss });

describe('nextOptions', () => {
  const demo = demoMap();

  it('offers three options from a middle row, in ascending row order', () => {
    expect(nextOptions(demo, { col: 5, row: 3 })).toEqual([opt(6, 2), opt(6, 3), opt(6, 4)]);
  });

  it('offers two options from row 0 and from row 6', () => {
    expect(nextOptions(demo, { col: 5, row: 0 })).toEqual([opt(6, 0), opt(6, 1)]);
    expect(nextOptions(demo, { col: 5, row: 6 })).toEqual([opt(6, 5), opt(6, 6)]);
  });

  it('from the start (column 0) goes to column 1', () => {
    const start = demo.tiles[0]!;
    expect(start).toMatchObject({ col: 0, row: 2 });
    expect(nextOptions(demo, start)).toEqual([opt(1, 1), opt(1, 2), opt(1, 3)]);
  });

  it('on the demo map, column 12 rows 3–6 fall back to (13, 1); row 2 reaches it by the normal rule', () => {
    expect(demo.cols).toBe(14);
    expect(tileAt(demo, 13, 1)).not.toBeNull();
    expect(tileAt(demo, 13, 2)).toBeNull();
    for (const row of [2, 3, 4, 5, 6]) expect(nextOptions(demo, { col: 12, row })).toEqual([opt(13, 1)]);
    expect(nextOptions(demo, { col: 12, row: 1 })).toEqual([opt(13, 0), opt(13, 1)]);
    expect(nextOptions(demo, { col: 12, row: 0 })).toEqual([opt(13, 0), opt(13, 1)]);
  });

  it('a 13-column map never needs the fallback', () => {
    const map = rawMap(windowDays(() => ({ count: 1 }), SATURDAY_END));
    expect(map.cols).toBe(13);
    expect(map.w0).toBe(0);
    for (const t of map.tiles) {
      if (t.col === map.cols - 1) continue;
      const opts = nextOptions(map, t);
      expect(opts.length).toBe(t.row === 0 || t.row === 6 ? 2 : 3);
      for (const o of opts) {
        expect(o.col).toBe(t.col + 1);
        expect(Math.abs(o.row - t.row)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('from every last-column tile the only option is the boss node', () => {
    expect(demo.bossNode).toEqual({ col: 14, row: 2 });
    for (const t of demo.tiles.filter((x) => x.col === demo.cols - 1)) {
      expect(nextOptions(demo, t)).toEqual([opt(14, 2, true)]);
    }
  });

  it('the boss node, void cells, and cells off the map have no options', () => {
    expect(nextOptions(demo, demo.bossNode)).toEqual([]);
    expect(nextOptions(demo, { col: 0, row: 0 })).toEqual([]);
    expect(nextOptions(demo, { col: 13, row: 5 })).toEqual([]);
    expect(nextOptions(demo, { col: -1, row: 3 })).toEqual([]);
  });
});

describe('reachableIdx', () => {
  it('spreads one row per column from the start (demo start at row 2)', () => {
    const demo = demoMap();
    const reach = reachableIdx(demo);
    // Column 0: only the start. Column 1: rows 1–3. From column 4 on, every row.
    for (const t of demo.tiles) expect(reach.has(t.idx)).toBe(Math.abs(t.row - 2) <= t.col);
    expect(reach.has(0)).toBe(true);
  });
});

describe('routeMinFights and minFightRoute', () => {
  // 13 columns, w0 = 0, start at (0, 0). All fog except column 5 (all monsters) and column 8 rows 0–5.
  // The cheapest route meets column 5 once and slips past column 8 on row 6: 1 fight.
  function dpMap(): GameMap {
    const map = rawMap(windowDays(() => ({ count: 0 }), SATURDAY_END));
    for (const t of map.tiles) {
      if (t.idx === 0) continue;
      const fight = t.col === 5 || (t.col === 8 && t.row <= 5);
      Object.assign(t, fight ? { kind: 'monster', tier: 2 } : { kind: 'fog', tier: 0 });
    }
    return map;
  }

  it('finds the minimum number of fights over all routes', () => {
    expect(routeMinFights(dpMap())).toBe(1);
  });

  it('walks the fight-minimal route taking the lowest row on ties', () => {
    const route = minFightRoute(dpMap());
    expect(route.map((t) => t.col)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(route.map((t) => t.row)).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2]);
    expect(route.filter((t) => t.kind === 'monster')).toHaveLength(1);
  });

  it('counts the start and last column correctly (all monsters → cols − 1 fights)', () => {
    const map = dpMap();
    for (const t of map.tiles) if (t.idx !== 0) Object.assign(t, { kind: 'monster', tier: 2 });
    expect(routeMinFights(map)).toBe(map.cols - 1);
  });
});
