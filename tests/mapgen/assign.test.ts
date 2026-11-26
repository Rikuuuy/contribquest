import { describe, expect, it } from 'vitest';
import type { ContributionDay } from '../../src/data/schema';
import { assignTiles, bestDayIndex } from '../../src/mapgen/assign';
import { layoutDays } from '../../src/mapgen/layout';
import { fnv1a } from '../../src/mapgen/rng';
import type { DayTile } from '../../src/mapgen/types';
import { windowDays } from '../fixtures/sets';

const LEVEL_COUNT = [0, 2, 5, 8, 12] as const;

/** Levels cycle 0–4 so every rule row appears; index 60 is the best day unless overridden. */
function mixedDays(best = 60, bestCount = 50): ContributionDay[] {
  return windowDays((i) => {
    if (i === best) return { count: bestCount };
    const level = (i % 5) as ContributionDay['level'];
    return { count: LEVEL_COUNT[level], level };
  });
}

function tilesFor(days: ContributionDay[]): DayTile[] {
  const { cells } = layoutDays(days);
  return assignTiles(days, cells, bestDayIndex(days).idx);
}

describe('assignTiles rule rows', () => {
  const days = mixedDays();
  const tiles = tilesFor(days);
  const plain = tiles.filter((t) => t.idx !== 0 && t.idx !== 60 && t.idx !== 90);

  it('index 0 is the start, the best day the boss (tier 5), index 90 the Gate', () => {
    expect(tiles[0]).toMatchObject({ kind: 'start', tier: 0 });
    expect(tiles[60]).toMatchObject({ kind: 'boss', tier: 5, boss: true });
    expect(tiles[90]).toMatchObject({ kind: 'gate', tier: 0 });
    expect(tiles[90]!.boss).toBeUndefined();
  });

  it('level 0 is fog with a gravestone when fnv1a(date) % 6 === 0', () => {
    const fog = plain.filter((t) => t.day.level === 0);
    for (const t of fog) {
      expect(t.kind).toBe('fog');
      expect(t.deco).toBe(fnv1a(t.day.date) % 6 === 0);
    }
    expect(fog.some((t) => t.deco)).toBe(true);
    expect(fog.some((t) => !t.deco)).toBe(true);
  });

  it('level 1 is a wisp', () => {
    for (const t of plain.filter((t) => t.day.level === 1)) expect(t).toMatchObject({ kind: 'wisp', tier: 0 });
  });

  it.each([
    [2, 1, 2],
    [3, 2, 3],
  ] as const)('level %i is a chest of size %i when fnv1a(date) %% 3 === 0, else a tier %i monster', (level, size, tier) => {
    const ts = plain.filter((t) => t.day.level === level);
    for (const t of ts) {
      if (fnv1a(t.day.date) % 3 === 0) expect(t).toMatchObject({ kind: 'chest', size, tier: 0 });
      else {
        expect(t).toMatchObject({ kind: 'monster', tier });
        expect(t.size).toBeUndefined();
      }
    }
    expect(ts.some((t) => t.kind === 'chest')).toBe(true);
    expect(ts.some((t) => t.kind === 'monster')).toBe(true);
  });

  it('level 4 is a tier 4 monster', () => {
    for (const t of plain.filter((t) => t.day.level === 4)) expect(t).toMatchObject({ kind: 'monster', tier: 4 });
  });

  it('every tile starts unresolved, unvisited, unseen', () => {
    for (const t of tiles) expect([t.resolved, t.visited, t.seen]).toEqual([false, false, false]);
  });
});

describe('bestDayIndex', () => {
  it('ignores a best day on index 0 and uses the next best', () => {
    const days = windowDays((i) => ({ count: i === 0 ? 99 : i === 30 ? 20 : 1 }));
    expect(bestDayIndex(days)).toEqual({ idx: 30, emptyQuarter: false });
    expect(tilesFor(days)[0]!.kind).toBe('start');
  });

  it('a best day on index 90 makes the Gate the boss', () => {
    const days = mixedDays(90);
    const tiles = tilesFor(days);
    expect(bestDayIndex(days).idx).toBe(90);
    expect(tiles[90]).toMatchObject({ kind: 'gate', tier: 5, boss: true });
    expect(tiles.filter((t) => t.kind === 'boss')).toEqual([]);
  });

  it('ties go to the latest date', () => {
    const days = windowDays((i) => ({ count: i === 10 || i === 50 || i === 70 ? 9 : 1 }));
    expect(bestDayIndex(days).idx).toBe(70);
  });

  it('an all-empty window puts the boss on index 45 and marks emptyQuarter', () => {
    const days = windowDays(() => ({ count: 0 }));
    expect(bestDayIndex(days)).toEqual({ idx: 45, emptyQuarter: true });
    expect(tilesFor(days)[45]).toMatchObject({ kind: 'boss', tier: 5, boss: true });
  });

  it('a count only on index 0 still counts as empty', () => {
    const days = windowDays((i) => ({ count: i === 0 ? 7 : 0 }));
    expect(bestDayIndex(days)).toEqual({ idx: 45, emptyQuarter: true });
  });
});
