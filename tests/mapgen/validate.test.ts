import { describe, expect, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { generateMap, mapDateRange } from '../../src/mapgen/generate';
import type { DayTile, GameMap } from '../../src/mapgen/types';
import { reachable, validateMap } from '../../src/mapgen/validate';
import { makeSet, windowDays } from '../fixtures/sets';

function goodMap(): GameMap {
  const r = generateMap(makeSet(windowDays((i) => ({ count: i % 9 }))));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const err = (message: string) => ({ code: 'map', message, retry: true, demo: true });

describe('validateMap', () => {
  it('accepts a generated map', () => {
    expect(validateMap(goodMap())).toBeNull();
  });

  it('a map missing its start cannot be raised', () => {
    const map = goodMap();
    map.tiles = map.tiles.slice(1);
    map.tiles.unshift(undefined as unknown as DayTile);
    expect(validateMap(map)).toEqual(err('The map could not be raised.'));
    expect(validateMap({ ...goodMap(), tiles: [] })).toEqual(err('The map could not be raised.'));
  });

  it('a map with a column cut out has no route', () => {
    const map = goodMap();
    // Remove every tile of column 5 so nothing connects the left half to the right half.
    map.tiles = map.tiles.map((t) => (t.col === 5 ? (undefined as unknown as DayTile) : t));
    expect(reachable(map, map.tiles[0]!, map.tiles[map.bossIdx]!)).toBe(map.tiles[map.bossIdx]!.col < 5);
    expect(validateMap(map)).toEqual(err('The map has no route.'));
  });

  it('a duplicate date is rejected', () => {
    const map = goodMap();
    const t = map.tiles[6]!;
    map.tiles[6] = { ...t, day: { ...t.day, date: map.tiles[5]!.day.date } };
    expect(validateMap(map)).toEqual(err('Duplicate days in the map.'));
  });
});

describe('generateMap', () => {
  it('never throws, returning a map error for unusable input', () => {
    const bad = [
      { ...makeSet([]) },
      { ...makeSet(windowDays(() => ({ count: 1 }))), username: undefined },
      { ...makeSet(windowDays(() => ({ count: 1 }))), days: null },
      null,
    ] as unknown as ContributionSet[];
    for (const set of bad) {
      let r: ReturnType<typeof generateMap> | undefined;
      expect(() => (r = generateMap(set))).not.toThrow();
      expect(r).toEqual({ ok: false, error: err('The map could not be raised.') });
    }
  });

  it('returns the window’s date range', () => {
    expect(mapDateRange(goodMap())).toEqual({ first: '2026-08-18', last: '2026-11-16' });
  });
});
