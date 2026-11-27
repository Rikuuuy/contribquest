import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadDemo } from '../../src/data/demo';
import { generateMap } from '../../src/mapgen/generate';
import { routeMinFights } from '../../src/mapgen/routes';
import type { DayTile, GameMap } from '../../src/mapgen/types';

const readJson = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/golden/${name}`, import.meta.url), 'utf8'));

// Recorded once from the prototype (v1.5 rules): its utilities-to-map script section evaluated in a Node vm
// context, then generateMap(makeDemoSet()) written without `grid`. Kept unchanged for the parity check below.
const prototypeGolden = readJson('demo-map.json');
// Recorded from the port under the v1.6 rules: generateMap(loadDemo(19 Nov 2026)) as JSON.
const goldenV2 = readJson('demo-map-v2.json');

function demoMap(): GameMap {
  const r = generateMap(loadDemo(() => Date.UTC(2026, 10, 19)));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('demo map (v1.6)', () => {
  const map = demoMap();

  it('equals the recorded v1.6 snapshot', () => {
    expect(map).toEqual(goldenV2);
  });

  it('has the v1.6 summary facts from design.md', () => {
    expect(map.cols).toBe(14);
    expect(map.w0).toBe(2);
    expect(map.seed).toBe(722674249);
    expect(map.bossIdx).toBe(77);
    expect(map.tiles[77]!.day).toEqual({ date: '2026-11-03', count: 31, level: 4 });
    expect(map.tiles[77]!.bestDay).toBe(true);
    expect(map.tiles.filter((t) => t.bestDay).map((t) => t.idx)).toEqual([77]);
    expect(map.bossNode).toEqual({ col: 14, row: 2 });
    expect(map.quiet).toBe(false);
    expect(map.emptyQuarter).toBe(false);
    expect(routeMinFights(map)).toBeGreaterThanOrEqual(4);
  });

  it('has the measured tile counts', () => {
    const counts: Record<string, number> = {};
    for (const t of map.tiles) {
      const k = t.kind === 'monster' ? `monster${t.tier}` : t.kind;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts).toEqual({ start: 1, chest: 7, wisp: 19, fog: 20, monster1: 13, monster2: 16, monster3: 9, monster4: 6 });
  });

  it('is deterministic', () => {
    expect(demoMap()).toEqual(map);
  });
});

describe('demo map parity with the prototype (v1.5 snapshot)', () => {
  const map = demoMap();
  const proto = prototypeGolden.tiles as DayTile[];

  it('keeps the prototype map fields that did not change', () => {
    expect(map.cols).toBe(prototypeGolden.cols);
    expect(map.rows).toBe(prototypeGolden.rows);
    expect(map.seed).toBe(prototypeGolden.seed);
    expect(map.bossIdx).toBe(prototypeGolden.bossIdx);
    expect(map.emptyQuarter).toBe(prototypeGolden.emptyQuarter);
    expect(map.quiet).toBe(prototypeGolden.quiet);
  });

  it('differs only at index 77, index 90, and route-shortfall tiles', () => {
    expect(map.tiles).toHaveLength(proto.length);
    const risen: number[] = [];
    map.tiles.forEach((t, i) => {
      const p = proto[i]!;
      if (i === 77) {
        expect(p).toMatchObject({ kind: 'boss', tier: 5, boss: true });
        expect(t).toMatchObject({ kind: 'monster', tier: 4, bestDay: true });
      } else if (i === 90) {
        expect(p.kind).toBe('gate');
        expect(t).toMatchObject({ kind: 'monster', tier: 3 });
      } else if (t.risen && !p.risen) {
        // Raised by the route shortfall: a non-monster prototype tile turned into a Lost Ghost.
        expect(['fog', 'wisp', 'chest']).toContain(p.kind);
        expect(t).toMatchObject({ kind: 'monster', tier: 1, risen: true, deco: false });
        expect(t.size).toBeUndefined();
        expect({ ...t, kind: p.kind, tier: p.tier, risen: undefined, deco: p.deco, size: p.size }).toEqual({
          ...p,
          risen: undefined,
        });
        risen.push(i);
      } else {
        expect(t).toEqual(p);
      }
    });
    expect(risen).toEqual([8, 12, 13, 14, 15, 19, 21, 24, 40, 54, 56, 57, 62]);
  });
});
