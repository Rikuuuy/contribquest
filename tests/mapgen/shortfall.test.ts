import { describe, expect, it } from 'vitest';
import type { ContributionDay } from '../../src/data/schema';
import { assignTiles, bestDayIndex } from '../../src/mapgen/assign';
import { layoutDays } from '../../src/mapgen/layout';
import { fnv1a, makeRng } from '../../src/mapgen/rng';
import { minFightRoute, routeMinFights } from '../../src/mapgen/routes';
import { MAP_RNG_SALT } from '../../src/mapgen/rules';
import { applyRouteShortfall, applyShortfall } from '../../src/mapgen/shortfall';
import type { DayTile, GameMap } from '../../src/mapgen/types';
import { SATURDAY_END } from '../fixtures/profiles';
import { windowDays } from '../fixtures/sets';

function tilesFor(days: ContributionDay[]): DayTile[] {
  const { cells } = layoutDays(days);
  return assignTiles(days, cells, bestDayIndex(days));
}

/** Layout and assignment only; the shortfall steps are applied by each test. */
function rawMap(days: ContributionDay[], username = 'octo-cat'): GameMap {
  const { w0, cols, cells } = layoutDays(days);
  const best = bestDayIndex(days);
  const tiles = assignTiles(days, cells, best);
  return {
    cols,
    rows: 7,
    w0,
    tiles,
    seed: fnv1a(username.toLowerCase() + '|' + days[90]!.date),
    bossIdx: best.idx,
    bossNode: { col: cols, row: tiles[best.idx]!.row },
    emptyQuarter: best.emptyQuarter,
    quiet: false,
  };
}

const mapRng = (map: GameMap) => makeRng(map.seed ^ MAP_RNG_SALT);
const monsters = (tiles: DayTile[]) => tiles.filter((t) => t.kind === 'monster');

// Two wisp days (40 and 90); the rest is fog. Index 90 is not fog, so the fog pool is the prototype's.
const quietDays = windowDays((i) => ({ count: i === 40 || i === 90 ? 2 : 0 }));

describe('applyShortfall (count step)', () => {
  it('a quiet profile reaches exactly 6 monsters, all risen tier 1 without decoration', () => {
    const map = rawMap(quietDays, 'Quiet-Dev');
    expect(applyShortfall(map.tiles, mapRng(map))).toEqual({ quiet: true });
    const ms = monsters(map.tiles);
    expect(ms).toHaveLength(6);
    for (const t of ms) expect(t).toMatchObject({ tier: 1, risen: true, deco: false });
  });

  it('matches the prototype’s risen tiles for the same profile', () => {
    // Recorded from the prototype's generateMap in a Node vm context (same fog pool, same draws).
    const map = rawMap(quietDays, 'Quiet-Dev');
    expect(map.seed).toBe(1669825058);
    applyShortfall(map.tiles, mapRng(map));
    expect(map.tiles.filter((t) => t.risen).map((t) => t.idx)).toEqual([6, 50, 63, 67, 79, 85]);
  });

  it('only raises fog tiles and leaves non-fog tiles alone', () => {
    const tiles = tilesFor(quietDays);
    const before = structuredClone(tiles);
    applyShortfall(tiles, makeRng(fnv1a('x')));
    tiles.forEach((t, i) => {
      if (t.risen) expect(before[i]!.kind).toBe('fog');
      else expect(t).toEqual(before[i]);
    });
  });

  it('stops when the fog pool is empty', () => {
    // Wisps everywhere except two fog days: only 2 Lost Ghosts can rise.
    const days = windowDays((i) => (i === 20 || i === 30 ? { count: 0 } : { count: i === 50 ? 3 : 1 }));
    const tiles = tilesFor(days);
    const { quiet } = applyShortfall(tiles, makeRng(123));
    expect(quiet).toBe(true);
    expect(monsters(tiles).map((t) => t.idx)).toEqual([20, 30]);
    expect(tiles.filter((t) => t.kind === 'fog')).toEqual([]);
  });

  it('a busy profile is untouched, not quiet, and draws nothing', () => {
    const days = windowDays((i) => ({ count: 12 + (i % 7) }));
    const tiles = tilesFor(days);
    const before = structuredClone(tiles);
    const rng = makeRng(1);
    expect(applyShortfall(tiles, rng)).toEqual({ quiet: false });
    expect(rng.state).toBe(1);
    expect(tiles).toEqual(before);
    expect(tiles.some((t) => t.risen)).toBe(false);
  });
});

describe('applyRouteShortfall (route step, v1.6)', () => {
  it('lifts a fight-free route to MIN_ROUTE_FIGHTS with risen tier-1 monsters in columns ≥ 1', () => {
    const map = rawMap(windowDays(() => ({ count: 0 })));
    expect(routeMinFights(map)).toBe(0);
    const before = structuredClone(map.tiles);
    const n = applyRouteShortfall(map, mapRng(map));
    expect(routeMinFights(map)).toBe(4);
    expect(n).toBeGreaterThanOrEqual(4);
    const changed = map.tiles.filter((t, i) => t.kind !== before[i]!.kind);
    expect(changed).toHaveLength(n);
    for (const t of changed) {
      expect(t).toMatchObject({ kind: 'monster', tier: 1, risen: true, deco: false });
      expect(t.col).toBeGreaterThanOrEqual(1);
    }
  });

  // 13 columns, start at (0, 0). Every tile off row 0 is a monster, so the fight-minimal route stays on row 0.
  function corridor(kinds: (col: number) => 'fog' | 'wisp' | 'chest'): GameMap {
    const map = rawMap(windowDays(() => ({ count: 0 }), SATURDAY_END));
    for (const t of map.tiles) {
      if (t.idx === 0) continue;
      if (t.row > 0) Object.assign(t, { kind: 'monster', tier: 2, deco: false });
      else {
        const kind = kinds(t.col);
        Object.assign(t, { kind, tier: 0, deco: false }, kind === 'chest' ? { size: 2 } : {});
      }
    }
    return map;
  }

  it('converts fog before wisps, and wisps before chests', () => {
    const map = corridor((c) => (c <= 2 ? 'fog' : c <= 5 ? 'wisp' : 'chest'));
    expect(minFightRoute(map).every((t) => t.row === 0)).toBe(true);
    expect(applyRouteShortfall(map, mapRng(map))).toBe(4);
    const row0 = map.tiles.filter((t) => t.row === 0 && t.col >= 1);
    const risen = (cols: number[]) => row0.filter((t) => cols.includes(t.col) && t.risen).length;
    expect(risen([1, 2])).toBe(2);
    expect(risen([3, 4, 5])).toBe(2);
    expect(risen([6, 7, 8, 9, 10, 11, 12])).toBe(0);
  });

  it('converts chests when the route has no fog or wisp, dropping the chest size', () => {
    const map = corridor(() => 'chest');
    expect(applyRouteShortfall(map, mapRng(map))).toBe(4);
    const risen = map.tiles.filter((t) => t.risen);
    expect(risen).toHaveLength(4);
    for (const t of risen) {
      expect(t.row).toBe(0);
      expect(t.size).toBeUndefined();
    }
  });

  it('continues the same map RNG instance the count step used', () => {
    const shared = rawMap(quietDays, 'Quiet-Dev');
    const rng = mapRng(shared);
    applyShortfall(shared.tiles, rng);
    const afterCount = rng.state;
    expect(afterCount).not.toBe((shared.seed ^ MAP_RNG_SALT) >>> 0);
    applyRouteShortfall(shared, rng);
    expect(rng.state).not.toBe(afterCount);

    // Replaying the route step from the post-count state gives the same tiles.
    const replay = rawMap(quietDays, 'Quiet-Dev');
    applyShortfall(replay.tiles, mapRng(replay));
    const resumed = makeRng(afterCount);
    applyRouteShortfall(replay, resumed);
    expect(replay.tiles).toEqual(shared.tiles);
  });

  it('does not change quiet and leaves maps that already meet the minimum untouched', () => {
    const quiet = rawMap(quietDays, 'Quiet-Dev');
    quiet.quiet = applyShortfall(quiet.tiles, mapRng(quiet)).quiet;
    applyRouteShortfall(quiet, mapRng(quiet));
    expect(quiet.quiet).toBe(true);

    const busy = rawMap(windowDays((i) => ({ count: 12 + (i % 7) })));
    const before = structuredClone(busy);
    const rng = makeRng(7);
    expect(applyRouteShortfall(busy, rng)).toBe(0);
    expect(rng.state).toBe(7);
    expect(busy).toEqual(before);
  });
});
