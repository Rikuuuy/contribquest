// Map generation module: layout, tiles, shards, validation.
export const MODULE = 'mapgen';

export { fnv1a, makeRng, nextFloat, shuffleInPlace, type Rng } from './rng';
export { parseDate, weekday, addDays, fmtDate, fmtShort } from './dates';
export * from './rules';
export type { Pos, TileKind, Tier, DayTile, GameMap, MapError, RouteOption } from './types';
export { layoutDays, tileAt, neighbours } from './layout';
export { bestDayIndex, assignTiles } from './assign';
export { applyShortfall } from './shortfall';
export { reachable, validateMap } from './validate';
export { generateMap, mapDateRange } from './generate';
