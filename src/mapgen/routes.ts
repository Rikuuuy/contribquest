// v1.6 forward-only route graph (game-rules.md "Routes", "Minimum fights per route").
// One implementation for mapgen (route shortfall, validation) and the engine (legal moves).
import { tileAt } from './layout';
import { ROUTE_REACH, ROWS } from './rules';
import type { DayTile, GameMap, Pos, RouteOption } from './types';

/** Legal move targets from `from`, in ascending row order; `[]` at the boss node or off the map. */
export function nextOptions(map: GameMap, from: Pos): RouteOption[] {
  if (from.col === map.cols - 1 && tileAt(map, from.col, from.row)) return [{ ...map.bossNode, boss: true }];
  if (from.col >= map.cols || !tileAt(map, from.col, from.row)) return [];
  const c = from.col + 1;
  const out: RouteOption[] = [];
  for (let r = from.row - ROUTE_REACH; r <= from.row + ROUTE_REACH; r++) {
    if (tileAt(map, c, r)) out.push({ col: c, row: r, boss: false });
  }
  if (out.length) return out;
  // Edge fallback: the day of column c closest in row, ties to the smaller row.
  let best: DayTile | null = null;
  for (let r = 0; r < ROWS; r++) {
    const t = tileAt(map, c, r);
    if (t && (!best || Math.abs(r - from.row) < Math.abs(best.row - from.row))) best = t;
  }
  return best ? [{ col: c, row: best.row, boss: false }] : [];
}

/** Tile idx reachable from the start by legal moves (the start included). */
export function reachableIdx(map: GameMap): Set<number> {
  const out = new Set<number>();
  const start = map.tiles[0];
  if (!start) return out;
  const q: DayTile[] = [start];
  out.add(start.idx);
  for (let i = 0; i < q.length; i++) {
    for (const o of nextOptions(map, q[i] as DayTile)) {
      const t = o.boss ? null : tileAt(map, o.col, o.row);
      if (t && !out.has(t.idx)) {
        out.add(t.idx);
        q.push(t);
      }
    }
  }
  return out;
}

/** Backward DP: fewest `monster` tiles entered from each reachable tile to the boss node (boss not counted). */
function bestFights(map: GameMap): Map<number, number> {
  const reach = reachableIdx(map);
  const tiles = map.tiles.filter((t) => t && reach.has(t.idx)).sort((a, b) => b.col - a.col);
  const best = new Map<number, number>();
  for (const t of tiles) {
    const self = t.kind === 'monster' ? 1 : 0;
    if (t.col === map.cols - 1) {
      best.set(t.idx, self);
      continue;
    }
    let min = Infinity;
    for (const o of nextOptions(map, t)) {
      const n = o.boss ? null : tileAt(map, o.col, o.row);
      const v = n ? best.get(n.idx) : undefined;
      if (v !== undefined && v < min) min = v;
    }
    best.set(t.idx, self + min);
  }
  return best;
}

/** Minimum number of `monster` tiles on any route from the start to the boss node. */
export function routeMinFights(map: GameMap): number {
  const start = map.tiles[0];
  return start ? (bestFights(map).get(start.idx) ?? Infinity) : Infinity;
}

/** The fight-minimal route, start first, one tile per column 0 … cols − 1 (first option on ties). */
export function minFightRoute(map: GameMap): DayTile[] {
  const best = bestFights(map);
  const route: DayTile[] = [];
  let t = map.tiles[0];
  while (t) {
    route.push(t);
    let next: DayTile | undefined;
    let min = Infinity;
    for (const o of nextOptions(map, t)) {
      const n = o.boss ? null : tileAt(map, o.col, o.row);
      const v = n ? best.get(n.idx) : undefined;
      if (n && v !== undefined && v < min) {
        min = v;
        next = n;
      }
    }
    t = next;
  }
  return route;
}
