// The public entry: ContributionSet → validated GameMap. Takes nothing about the hero (P18).
import type { Result } from '../data/errors';
import type { ContributionSet } from '../data/schema';
import { assignTiles, bestDayIndex } from './assign';
import { layoutDays } from './layout';
import { fnv1a } from './rng';
import { ROWS } from './rules';
import { applyShortfall } from './shortfall';
import type { GameMap, MapError } from './types';
import { MAP_ERROR_TEXT, mapError, validateMap } from './validate';

export function generateMap(set: ContributionSet): Result<GameMap, MapError> {
  try {
    const days = set.days;
    const last = days[days.length - 1];
    if (!last) return { ok: false, error: mapError(MAP_ERROR_TEXT.missing) };
    const seed = fnv1a(set.username.toLowerCase() + '|' + last.date);
    const { w0, cols, cells } = layoutDays(days);
    const best = bestDayIndex(days);
    const tiles = assignTiles(days, cells, best.idx);
    const { quiet } = applyShortfall(tiles, seed);
    const map: GameMap = {
      cols,
      rows: ROWS as 7,
      w0,
      tiles,
      seed,
      bossIdx: best.idx,
      bossNode: { col: cols, row: (tiles[best.idx] as GameMap['tiles'][number]).row },
      emptyQuarter: best.emptyQuarter,
      quiet,
    };
    const error = validateMap(map);
    return error ? { ok: false, error } : { ok: true, value: map };
  } catch {
    return { ok: false, error: mapError(MAP_ERROR_TEXT.missing) };
  }
}

/** First and last dates of the window, for the summary. */
export function mapDateRange(map: GameMap): { first: string; last: string } {
  return {
    first: (map.tiles[0] as GameMap['tiles'][number]).day.date,
    last: (map.tiles[map.tiles.length - 1] as GameMap['tiles'][number]).day.date,
  };
}
