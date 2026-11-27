import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { assignTiles, bestDayIndex } from '../../src/mapgen/assign';
import { generateMap } from '../../src/mapgen/generate';
import { layoutDays, tileAt } from '../../src/mapgen/layout';
import { makeRng } from '../../src/mapgen/rng';
import { nextOptions, reachableIdx, routeMinFights } from '../../src/mapgen/routes';
import { MAP_RNG_SALT, MIN_ROUTE_FIGHTS } from '../../src/mapgen/rules';
import { applyShortfall } from '../../src/mapgen/shortfall';
import type { GameMap, RouteOption } from '../../src/mapgen/types';
import { allZeroSetArb, contributionSetArb } from '../arbitraries';

function mapOf(set: ContributionSet): GameMap {
  const r = generateMap(set);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const key = (col: number, row: number) => `${col},${row}`;
const dayCells = (map: GameMap) => new Set(map.tiles.map((t) => key(t.col, t.row)));

/** 50 random walks per map: each entry picks an option index at each move. */
const walksArb = fc.array(fc.array(fc.nat({ max: 2 }), { minLength: 14, maxLength: 14 }), {
  minLength: 50,
  maxLength: 50,
});

/** Follow option choices from the start until no option is left (at most cols + 1 moves). */
function walk(map: GameMap, choices: readonly number[]): RouteOption[] {
  const path: RouteOption[] = [];
  let at: { col: number; row: number } = map.tiles[0]!;
  for (let i = 0; i <= map.cols; i++) {
    const opts = nextOptions(map, at);
    if (!opts.length) break;
    const o = opts[(choices[i] ?? 0) % opts.length]!;
    path.push(o);
    at = o;
  }
  return path;
}

/**
 * Independent minimum over all routes, written from the game-rules.md text without routes.ts:
 * next column, rows r − 1 … r + 1, else the nearest day row (smaller on ties); the boss is not counted.
 */
function recursiveMin(map: GameMap): number {
  const days = new Map(map.tiles.map((t) => [key(t.col, t.row), t]));
  const memo = new Map<string, number>();
  const go = (col: number, row: number): number => {
    const k = key(col, row);
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    const self = days.get(k)!.kind === 'monster' ? 1 : 0;
    let rest = 0;
    if (col < map.cols - 1) {
      let rows = [row - 1, row, row + 1].filter((r) => days.has(key(col + 1, r)));
      if (!rows.length) {
        const all = [0, 1, 2, 3, 4, 5, 6].filter((r) => days.has(key(col + 1, r)));
        const d = Math.min(...all.map((r) => Math.abs(r - row)));
        rows = [all.find((r) => Math.abs(r - row) === d)!];
      }
      rest = Math.min(...rows.map((r) => go(col + 1, r)));
    }
    memo.set(k, self + rest);
    return self + rest;
  };
  return go(map.tiles[0]!.col, map.tiles[0]!.row);
}

describe('map properties', () => {
  it('P18: generateMap takes exactly one ContributionSet and no hero parameter', () => {
    expectTypeOf(generateMap).parameters.toEqualTypeOf<[ContributionSet]>();
    expect(generateMap.length).toBe(1);
  });

  it('P1: generating the same set twice gives deeply equal results', () => {
    fc.assert(fc.property(contributionSetArb, (set) => {
        expect(generateMap(set)).toEqual(generateMap(set));
      }),
    );
  });

  it('P2: each date is in exactly one tile, in date order and calendar position w0 + idx', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const map = mapOf(set);
        expect(map.tiles).toHaveLength(91);
        expect(new Set(map.tiles.map((t) => t.day.date)).size).toBe(91);
        map.tiles.forEach((t, i) => {
          expect(t.idx).toBe(i);
          expect(t.day.date).toBe(set.days[i]!.date);
          expect(t.col * 7 + t.row).toBe(map.w0 + i);
          expect(t.row).toBeGreaterThanOrEqual(0);
          expect(t.row).toBeLessThan(7);
          if (i > 0) expect(t.day.date > map.tiles[i - 1]!.day.date).toBe(true);
        });
      }),
    );
  });

  it('P3 (v1.6): from every reachable tile the options go one column forward (±1 row, edge fallback, boss node)', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const r = generateMap(set);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const map = r.value;
        expect(map.tiles[0]!.kind).toBe('start');
        const days = dayCells(map);
        for (const idx of reachableIdx(map)) {
          const t = map.tiles[idx]!;
          const opts = nextOptions(map, t);
          expect(opts.length).toBeGreaterThan(0);
          if (t.col === map.cols - 1) {
            expect(opts).toEqual([{ ...map.bossNode, boss: true }]);
            continue;
          }
          const c = t.col + 1;
          const near = [t.row - 1, t.row, t.row + 1].filter((row) => days.has(key(c, row)));
          if (near.length) {
            expect(opts).toEqual(near.map((row) => ({ col: c, row, boss: false })));
          } else {
            const rows = [0, 1, 2, 3, 4, 5, 6].filter((row) => days.has(key(c, row)));
            const d = Math.min(...rows.map((row) => Math.abs(row - t.row)));
            const row = rows.find((x) => Math.abs(x - t.row) === d)!;
            expect(opts).toEqual([{ col: c, row, boss: false }]);
          }
        }
      }),
    );
  });

  it('P4 (v1.6): bossIdx is the highest count in 1–90 (latest on ties), never 0, 45 when all are 0; bestDay and bossNode match', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const map = mapOf(set);
        const counts = set.days.map((d) => d.count);
        const max = Math.max(...counts.slice(1));
        expect(map.bossIdx).not.toBe(0);
        if (max === 0) {
          expect(map.bossIdx).toBe(45);
          expect(map.emptyQuarter).toBe(true);
          expect(map.tiles.filter((t) => t.bestDay)).toEqual([]);
        } else {
          expect(map.bossIdx).toBe(counts.lastIndexOf(max));
          expect(map.emptyQuarter).toBe(false);
          expect(map.tiles.filter((t) => t.bestDay)).toEqual([map.tiles[map.bossIdx]]);
        }
        for (const t of map.tiles) expect(['boss', 'gate']).not.toContain(t.kind);
        expect(map.bossNode).toEqual({ col: map.cols, row: map.tiles[map.bossIdx]!.row });
      }),
    );
  });

  it('P4: an all-empty window always gives index 45', () => {
    fc.assert(fc.property(allZeroSetArb, (set) => {
        expect(mapOf(set).bossIdx).toBe(45);
      }),
    );
  });

  it('P5: monsters reach min(6, monsters before the shortfall + fog tiles)', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const { cells } = layoutDays(set.days);
        const before = assignTiles(set.days, cells, bestDayIndex(set.days));
        const m0 = before.filter((t) => t.kind === 'monster').length;
        const fog = before.filter((t) => t.kind === 'fog').length;
        const map = mapOf(set);
        const m = map.tiles.filter((t) => t.kind === 'monster').length;
        expect(m).toBeGreaterThanOrEqual(Math.min(6, m0 + fog));
        if (m0 + fog >= 6) expect(m).toBeGreaterThanOrEqual(6);
        expect(map.quiet).toBe(m0 < 6);
        // The count step alone is exact; the v1.6 route step may raise more afterwards.
        const counted = structuredClone(before);
        applyShortfall(counted, makeRng(map.seed ^ MAP_RNG_SALT));
        const mc = counted.filter((t) => t.kind === 'monster').length;
        if (m0 < 6) expect(mc).toBe(Math.min(6, m0 + fog));
        else expect(mc).toBe(m0);
      }),
    );
  });

  // P10 (shardsNeeded ≤ elites and ≤ 3) is retired in v1.6: there is no shardsNeeded. Shard bounds are P23.

  it('P20: every route reaches the boss node in exactly cols moves, one day tile per column 1 … cols − 1', () => {
    fc.assert(
      fc.property(contributionSetArb, walksArb, (set, walks) => {
        const map = mapOf(set);
        for (const choices of walks) {
          const path = walk(map, choices);
          expect(path).toHaveLength(map.cols);
          path.slice(0, -1).forEach((o, i) => {
            expect(o.boss).toBe(false);
            expect(o.col).toBe(i + 1);
            expect(tileAt(map, o.col, o.row)).not.toBeNull();
          });
          expect(path[path.length - 1]).toEqual({ ...map.bossNode, boss: true });
          expect(nextOptions(map, map.bossNode)).toEqual([]);
        }
      }),
    );
  });

  it('P21: every route enters at least MIN_ROUTE_FIGHTS monsters; routeMinFights equals a recursive minimum', () => {
    fc.assert(
      fc.property(contributionSetArb, walksArb, (set, walks) => {
        const map = mapOf(set);
        const min = recursiveMin(map);
        expect(routeMinFights(map)).toBe(min);
        expect(min).toBeGreaterThanOrEqual(MIN_ROUTE_FIGHTS);
        for (const choices of walks) {
          const fights = walk(map, choices).filter((o) => !o.boss && tileAt(map, o.col, o.row)!.kind === 'monster');
          expect(fights.length).toBeGreaterThanOrEqual(MIN_ROUTE_FIGHTS);
        }
      }),
    );
  });

  it('P21: an all-empty window still gets MIN_ROUTE_FIGHTS on every route', () => {
    fc.assert(
      fc.property(allZeroSetArb, (set) => {
        const map = mapOf(set);
        expect(recursiveMin(map)).toBeGreaterThanOrEqual(MIN_ROUTE_FIGHTS);
      }),
    );
  });
});
