import { describe, expect, it } from 'vitest';
import type { ContributionDay } from '../../src/data/schema';
import { assignTiles, bestDayIndex } from '../../src/mapgen/assign';
import { generateMap } from '../../src/mapgen/generate';
import { layoutDays } from '../../src/mapgen/layout';
import { fnv1a } from '../../src/mapgen/rng';
import { applyShortfall } from '../../src/mapgen/shortfall';
import type { DayTile, GameMap } from '../../src/mapgen/types';
import { makeSet, windowDays } from '../fixtures/sets';

function tilesFor(days: ContributionDay[]): DayTile[] {
  const { cells } = layoutDays(days);
  return assignTiles(days, cells, bestDayIndex(days).idx);
}

function mapOf(days: ContributionDay[], username = 'octo-cat'): GameMap {
  const r = generateMap(makeSet(days, username));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const monsters = (tiles: DayTile[]) => tiles.filter((t) => t.kind === 'monster');

describe('applyShortfall', () => {
  // One active day (level 2, so it becomes the boss); the rest is fog.
  const quietDays = windowDays((i) => ({ count: i === 40 ? 5 : 0 }));

  it('a quiet profile reaches exactly 6 monsters, all risen tier 1 without decoration', () => {
    const map = mapOf(quietDays, 'Quiet-Dev');
    expect(map.quiet).toBe(true);
    const ms = monsters(map.tiles);
    expect(ms).toHaveLength(6);
    for (const t of ms) expect(t).toMatchObject({ tier: 1, risen: true, deco: false });
  });

  it('matches the prototype’s risen tiles for the same profile', () => {
    // Recorded from the prototype's generateMap in a Node vm context.
    const map = mapOf(quietDays, 'Quiet-Dev');
    expect(map.seed).toBe(1669825058);
    expect(map.tiles.filter((t) => t.risen).map((t) => t.idx)).toEqual([6, 50, 63, 67, 79, 85]);
  });

  it('only raises fog tiles and leaves non-fog tiles alone', () => {
    const tiles = tilesFor(quietDays);
    const before = structuredClone(tiles);
    applyShortfall(tiles, fnv1a('x'));
    tiles.forEach((t, i) => {
      if (t.risen) expect(before[i]!.kind).toBe('fog');
      else expect(t).toEqual(before[i]);
    });
  });

  it('stops when the fog pool is empty', () => {
    // Wisps everywhere except two fog days: only 2 Lost Ghosts can rise.
    const days = windowDays((i) => (i === 20 || i === 30 ? { count: 0 } : { count: i === 50 ? 3 : 1 }));
    const tiles = tilesFor(days);
    const { quiet } = applyShortfall(tiles, 123);
    expect(quiet).toBe(true);
    expect(monsters(tiles).map((t) => t.idx)).toEqual([20, 30]);
    expect(tiles.filter((t) => t.kind === 'fog')).toEqual([]);
  });

  it('a busy profile is untouched and not quiet', () => {
    const days = windowDays((i) => ({ count: 12 + (i % 7) }));
    const tiles = tilesFor(days);
    const before = structuredClone(tiles);
    expect(applyShortfall(tiles, 1)).toEqual({ quiet: false });
    expect(tiles).toEqual(before);
    expect(tiles.some((t) => t.risen)).toBe(false);
  });
});
