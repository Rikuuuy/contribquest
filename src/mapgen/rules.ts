// Map rule constants, from prototype/index.html and game-rules.md ("Map").
// src/engine/balance.ts re-exports these so balance.ts stays the one list of rule numbers.

/** Calendar rows, Sunday (0) to Saturday (6). */
export const ROWS = 7;
/** Below this many `monster` tiles the shortfall raises Lost Ghosts. */
export const MIN_FIGHTS = 6;
/** Cap on soul shards needed to break the boss's ward. */
export const MAX_SHARDS = 3;
/** XOR salt for the map RNG seed (shortfall only). */
export const MAP_RNG_SALT = 0x9e3779b9;
/** Level 2/3 day becomes a chest when `fnv1a(date) % CHEST_MOD === 0`. */
export const CHEST_MOD = 3;
/** Fog day gets a gravestone when `fnv1a(date) % DECO_MOD === 0`. */
export const DECO_MOD = 6;
/** Boss index when every count in 1–90 is 0 (`floor(91 / 2)`). */
export const EMPTY_QUARTER_IDX = 45;
