import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadDemo } from '../../src/data/demo';
import { generateMap } from '../../src/mapgen/generate';
import type { GameMap } from '../../src/mapgen/types';

// Recorded once from the prototype: its utilities-to-map script section evaluated in a Node vm
// context, then generateMap(makeDemoSet()) written without `grid`.
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden/demo-map.json', import.meta.url), 'utf8'));

function demoMap(): GameMap {
  const r = generateMap(loadDemo(() => Date.UTC(2026, 10, 19)));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('demo map parity with the prototype', () => {
  const map = demoMap();

  it('equals the recorded prototype map (the port also stores w0)', () => {
    const { w0, ...rest } = map;
    expect(w0).toBe(2);
    expect(rest).toEqual(golden);
  });

  it('has the summary facts from design.md', () => {
    expect(map.cols).toBe(14);
    expect(map.seed).toBe(722674249);
    expect(map.bossIdx).toBe(77);
    expect(map.tiles[77]!.day).toEqual({ date: '2026-11-03', count: 31, level: 4 });
    expect(map.shardsNeeded).toBe(3);
    expect(map.quiet).toBe(false);
    expect(map.emptyQuarter).toBe(false);
  });

  it('has the measured tile counts', () => {
    const counts: Record<string, number> = {};
    for (const t of map.tiles) {
      const k = t.kind === 'monster' ? `monster${t.tier}` : t.kind;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts).toEqual({ start: 1, gate: 1, boss: 1, chest: 7, wisp: 20, fog: 32, monster2: 16, monster3: 8, monster4: 5 });
  });

  it('is deterministic', () => {
    expect(demoMap()).toEqual(map);
  });
});
