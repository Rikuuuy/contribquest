// Calendar layout: 7 rows (Sunday on top), one column per week, as on the GitHub graph.
import type { ContributionDay } from '../data/schema';
import { weekday } from './dates';
import { ROWS } from './rules';
import type { DayTile, GameMap, Pos } from './types';

export type Cell = Pos & { idx: number };

export function layoutDays(days: readonly ContributionDay[]): { w0: number; cols: 13 | 14; cells: Cell[] } {
  const first = days[0];
  const w0 = first ? weekday(first.date) : 0;
  const cols = Math.ceil((w0 + days.length) / ROWS) as 13 | 14;
  const cells = days.map((_, idx) => {
    const p = w0 + idx;
    return { col: Math.floor(p / ROWS), row: p % ROWS, idx };
  });
  return { w0, cols, cells };
}

/** The tile at a grid cell, or null for a void cell or a cell outside the grid. */
export function tileAt(map: GameMap, col: number, row: number): DayTile | null {
  if (row < 0 || row >= ROWS || col < 0 || col >= map.cols) return null;
  const idx = col * ROWS + row - map.w0;
  if (idx < 0 || idx >= map.tiles.length) return null;
  return map.tiles[idx] ?? null;
}

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 4-directional non-void neighbours, in the prototype's order. */
export function neighbours(map: GameMap, t: Pos): DayTile[] {
  const out: DayTile[] = [];
  for (const [dc, dr] of DIRS) {
    const n = tileAt(map, t.col + dc, t.row + dr);
    if (n) out.push(n);
  }
  return out;
}
