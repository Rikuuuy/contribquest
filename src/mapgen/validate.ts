// Validation before play (v1.6, game-rules.md "Route validation"): tiles, unique dates, forward legal moves,
// and the minimum fights on every route.
import { tileAt } from './layout';
import { nextOptions, reachableIdx, routeMinFights } from './routes';
import { MIN_ROUTE_FIGHTS } from './rules';
import type { GameMap, MapError } from './types';

export const MAP_ERROR_TEXT = {
  missing: 'The map could not be raised.',
  route: 'The map has no route.',
  duplicate: 'Duplicate days in the map.',
} as const;

export function mapError(message: string): MapError {
  return { code: 'map', message, retry: true, demo: true };
}

export function validateMap(map: GameMap): MapError | null {
  if (map.tiles.length !== 91 || map.tiles.some((t) => !t)) return mapError(MAP_ERROR_TEXT.missing);
  if (map.tiles[0]?.kind !== 'start' || map.bossIdx < 1 || map.bossIdx > 90) return mapError(MAP_ERROR_TEXT.missing);
  if (new Set(map.tiles.map((t) => t.day.date)).size !== map.tiles.length) return mapError(MAP_ERROR_TEXT.duplicate);
  const last = map.cols - 1;
  for (const idx of reachableIdx(map)) {
    const t = map.tiles[idx];
    if (!t) return mapError(MAP_ERROR_TEXT.route);
    const opts = nextOptions(map, t);
    if (!opts.length) return mapError(MAP_ERROR_TEXT.route);
    for (const o of opts) {
      const ok =
        o.col === t.col + 1 && (o.boss ? t.col === last && o.row >= 0 && o.row < map.rows : tileAt(map, o.col, o.row) !== null);
      if (!ok) return mapError(MAP_ERROR_TEXT.route);
    }
  }
  if (routeMinFights(map) < MIN_ROUTE_FIGHTS) return mapError(MAP_ERROR_TEXT.route);
  return null;
}
