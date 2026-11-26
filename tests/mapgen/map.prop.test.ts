import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { assignTiles, bestDayIndex } from '../../src/mapgen/assign';
import { generateMap } from '../../src/mapgen/generate';
import { layoutDays } from '../../src/mapgen/layout';
import type { GameMap } from '../../src/mapgen/types';
import { reachable } from '../../src/mapgen/validate';
import { allZeroSetArb, contributionSetArb } from '../arbitraries';

function mapOf(set: ContributionSet): GameMap {
  const r = generateMap(set);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('map properties', () => {
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

  it('P3: start, boss, and Gate exist and BFS finds start → boss → Gate', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const r = generateMap(set);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const map = r.value;
        const start = map.tiles[0]!;
        const boss = map.tiles[map.bossIdx]!;
        const gate = map.tiles[map.gateIdx]!;
        expect(start.kind).toBe('start');
        expect(boss.boss).toBe(true);
        expect(gate.kind).toBe('gate');
        expect(reachable(map, start, boss)).toBe(true);
        expect(reachable(map, boss, gate)).toBe(true);
      }),
    );
  });

  it('P4: the boss is on the highest count in 1–90 (latest on ties), never 0, 45 when all are 0', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const map = mapOf(set);
        const counts = set.days.map((d) => d.count);
        const max = Math.max(...counts.slice(1));
        expect(map.bossIdx).not.toBe(0);
        if (max === 0) {
          expect(map.bossIdx).toBe(45);
          expect(map.emptyQuarter).toBe(true);
        } else {
          expect(map.bossIdx).toBe(counts.lastIndexOf(max));
          expect(map.emptyQuarter).toBe(false);
        }
        expect(map.tiles.filter((t) => t.boss)).toEqual([map.tiles[map.bossIdx]]);
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
        const before = assignTiles(set.days, cells, bestDayIndex(set.days).idx);
        const m0 = before.filter((t) => t.kind === 'monster').length;
        const fog = before.filter((t) => t.kind === 'fog').length;
        const map = mapOf(set);
        const m = map.tiles.filter((t) => t.kind === 'monster').length;
        expect(m).toBeGreaterThanOrEqual(Math.min(6, m0 + fog));
        if (m0 + fog >= 6) expect(m).toBeGreaterThanOrEqual(6);
        expect(map.quiet).toBe(m0 < 6);
        if (m0 < 6) expect(m).toBe(Math.min(6, m0 + fog));
        else expect(m).toBe(m0);
      }),
    );
  });

  it('P10: shardsNeeded ≤ the number of elites and ≤ 3', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const map = mapOf(set);
        const elites = map.tiles.filter((t) => t.kind === 'monster' && t.tier >= 3).length;
        expect(map.shardsNeeded).toBeLessThanOrEqual(elites);
        expect(map.shardsNeeded).toBeLessThanOrEqual(3);
        expect(map.shardsNeeded).toBe(Math.min(3, elites));
      }),
    );
  });
});
