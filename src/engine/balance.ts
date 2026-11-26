// Every rule constant, listed with its value in .kiro/steering/game-rules.md.

// Map rules live in src/mapgen/rules.ts (mapgen must not import the engine) and are re-exported here.
export { ROWS, MIN_FIGHTS, MAX_SHARDS, MAP_RNG_SALT, CHEST_MOD, DECO_MOD, EMPTY_QUARTER_IDX } from '../mapgen/rules';

/** Fog reveal radius squared (`dc² + dr²`), and with the Code Review relic. */
export const REVEAL_R2 = 5;
export const REVEAL_R2_REVIEW = 8;
