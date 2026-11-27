import { describe, expect, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { generateMap, mapDateRange } from '../../src/mapgen/generate';
import type { DayTile, GameMap } from '../../src/mapgen/types';
import { routeMinFights } from '../../src/mapgen/routes';
import { validateMap } from '../../src/mapgen/validate';
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

  it('a map whose index 0 is not the start, or whose bossIdx is out of range, cannot be raised', () => {
    const map = goodMap();
    map.tiles[0]!.kind = 'fog';
    expect(validateMap(map)).toEqual(err('The map could not be raised.'));
    expect(validateMap({ ...goodMap(), bossIdx: 0 })).toEqual(err('The map could not be raised.'));
  });

  it('a tile with no forward option has no route', () => {
    // One column too many: the real last column now points at an empty column instead of the boss node.
    const map = goodMap();
    map.cols = (map.cols + 1) as GameMap['cols'];
    map.bossNode = { ...map.bossNode, col: map.cols };
    expect(validateMap(map)).toEqual(err('The map has no route.'));
  });

  it('a boss node out of place has no route', () => {
    const map = goodMap();
    map.bossNode = { col: map.cols + 1, row: map.bossNode.row };
    expect(validateMap(map)).toEqual(err('The map has no route.'));
  });

  it('a route below 4 fights has no route', () => {
    const map = goodMap();
    expect(routeMinFights(map)).toBeGreaterThanOrEqual(4);
    for (const t of map.tiles) if (t.kind === 'monster') Object.assign(t, { kind: 'fog', tier: 0 });
    expect(routeMinFights(map)).toBe(0);
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
