// Validation before play: required tiles, routes, unique dates.
import { neighbours } from './layout';
import type { DayTile, GameMap, MapError } from './types';

export const MAP_ERROR_TEXT = {
  missing: 'The map could not be raised.',
  route: 'The map has no route.',
  duplicate: 'Duplicate days in the map.',
} as const;

export function mapError(message: string): MapError {
  return { code: 'map', message, retry: true, demo: true };
}

/** BFS over 4-directional non-void neighbours. */
export function reachable(map: GameMap, a: DayTile, b: DayTile): boolean {
  const seen = new Set<DayTile>([a]);
  const q: DayTile[] = [a];
  for (let i = 0; i < q.length; i++) {
    const t = q[i] as DayTile;
    if (t === b) return true;
    for (const nb of neighbours(map, t)) {
      if (!seen.has(nb)) {
        seen.add(nb);
        q.push(nb);
      }
    }
  }
  return false;
}

export function validateMap(map: GameMap): MapError | null {
  const s = map.tiles[0];
  const b = map.tiles[map.bossIdx];
  if (!s || !b) return mapError(MAP_ERROR_TEXT.missing);
  if (!reachable(map, s, b)) return mapError(MAP_ERROR_TEXT.route);
  if (new Set(map.tiles.map((t) => t.day.date)).size !== map.tiles.length) return mapError(MAP_ERROR_TEXT.duplicate);
  return null;
}
