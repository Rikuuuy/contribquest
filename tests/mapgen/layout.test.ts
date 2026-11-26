import { describe, expect, it } from 'vitest';
import { generateMap } from '../../src/mapgen/generate';
import { layoutDays, neighbours, tileAt } from '../../src/mapgen/layout';
import type { GameMap } from '../../src/mapgen/types';
import { SATURDAY_END, SUNDAY_END } from '../fixtures/profiles';
import { makeSet, windowDays } from '../fixtures/sets';

const days = (end: string) => windowDays((i) => ({ count: (i * 7) % 5 }), end);

function mapFor(end: string): GameMap {
  const r = generateMap(makeSet(days(end)));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Cells of the grid that hold no day. */
function voidCells(map: GameMap): { col: number; row: number }[] {
  const out = [];
  for (let col = 0; col < map.cols; col++) for (let row = 0; row < 7; row++) if (!tileAt(map, col, row)) out.push({ col, row });
  return out;
}

describe('layoutDays', () => {
  it('last date on a Saturday: w0 = 0, 13 columns, no void cells', () => {
    const l = layoutDays(days(SATURDAY_END));
    expect(l.w0).toBe(0);
    expect(l.cols).toBe(13);
    expect(voidCells(mapFor(SATURDAY_END))).toEqual([]);
  });

  it('last date on a Sunday: 14 columns', () => {
    const l = layoutDays(days(SUNDAY_END));
    expect(l.w0).toBe(1);
    expect(l.cols).toBe(14);
    expect(l.cells[90]).toEqual({ col: 13, row: 0, idx: 90 });
  });

  it('places day i at p = w0 + i in calendar order', () => {
    const l = layoutDays(days('2026-11-16'));
    l.cells.forEach((c, i) => {
      expect(c.idx).toBe(i);
      expect(c.col * 7 + c.row).toBe(l.w0 + i);
    });
  });

  it('void cells occur only at the top of column 0 and the bottom of the last column', () => {
    for (const end of ['2026-11-15', '2026-11-16', '2026-11-18', '2026-11-20']) {
      const map = mapFor(end);
      const voids = voidCells(map);
      expect(voids.length).toBe(map.cols * 7 - 91);
      for (const v of voids) {
        if (v.col === 0) expect(v.row).toBeLessThan(map.w0);
        else {
          expect(v.col).toBe(map.cols - 1);
          expect(v.row).toBeGreaterThan(6 - voids.filter((x) => x.col === map.cols - 1).length);
        }
      }
    }
  });
});

describe('tileAt and neighbours', () => {
  const map = mapFor('2026-11-16');

  it('has w0 = 2 for a Monday end', () => expect(map.w0).toBe(2));

  it('returns null outside the grid', () => {
    expect(tileAt(map, -1, 0)).toBeNull();
    expect(tileAt(map, 0, -1)).toBeNull();
    expect(tileAt(map, 0, 7)).toBeNull();
    expect(tileAt(map, map.cols, 0)).toBeNull();
    expect(tileAt(map, 0, 0)).toBeNull(); // w0 = 2: void at the top of column 0
  });

  it('returns the tile for its own cell', () => {
    for (const t of map.tiles) expect(tileAt(map, t.col, t.row)).toBe(t);
  });

  it('lists 4-directional non-void neighbours', () => {
    const start = map.tiles[0]!;
    expect(start).toMatchObject({ col: 0, row: 2 });
    const ns = neighbours(map, start).map((t) => [t.col, t.row]);
    expect(ns).toEqual([
      [1, 2],
      [0, 3],
    ]);
  });
});
