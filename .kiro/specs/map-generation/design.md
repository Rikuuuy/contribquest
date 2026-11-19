# Design: map-generation

## Overview

`src/mapgen` is a pure function from a `ContributionSet` to a `Result<GameMap, MapError>`. It never fetches, renders, reads storage, or sees the hero. `src/engine/explore.ts` holds the map-only exploration rules (reveal, move checks, shards) that the engine reducer calls.

```
ContributionSet ──► layout.ts (w0, cols, col/row per day)
                      │
                      ▼
                   assign.ts (best day, tile kinds, tiers, chests, deco)
                      │
                      ▼
                   shortfall.ts (map RNG, Fisher-Yates over fog, Lost Ghosts, quiet)
                      │
                      ▼
                   shards (min(3, elites)) ──► validate.ts (exists, BFS, unique dates)
                      │
                      ▼
               Result<GameMap, MapError> ──► engine (newRun, step → explore.ts)
```

Dependency rule: `src/mapgen` imports only types from `src/data/schema.ts`. `src/engine` imports `src/mapgen`. `src/engine/balance.ts` re-exports the map constants from `src/mapgen/rules.ts`, so `balance.ts` stays the one list of rule numbers without making mapgen depend on the engine.

## Module files

| File | Contents |
| --- | --- |
| `src/mapgen/rng.ts` | `fnv1a`, `makeRng`, `nextFloat` (pure state-in, state-out form), `shuffleInPlace` (Fisher-Yates) |
| `src/mapgen/dates.ts` | UTC helpers: `parseDate`, `weekday`, `addDays`, `fmtDate` ("Tue 3 Nov 2026"), `fmtShort` ("3 Nov"). Always `new Date(str + "T00:00:00Z")`, never the device clock |
| `src/mapgen/rules.ts` | `ROWS = 7`, `MIN_FIGHTS = 6`, `MAX_SHARDS = 3`, `MAP_RNG_SALT = 0x9e3779b9`, `CHEST_MOD = 3`, `DECO_MOD = 6`, `EMPTY_QUARTER_IDX = 45` |
| `src/mapgen/types.ts` | `TileKind`, `Tier`, `DayTile`, `GameMap`, `MapError`, `Pos` |
| `src/mapgen/layout.ts` | `layoutDays`, `tileAt`, `neighbours` |
| `src/mapgen/assign.ts` | `bestDayIndex`, `assignTiles` |
| `src/mapgen/shortfall.ts` | `applyShortfall` |
| `src/mapgen/validate.ts` | `reachable`, `validateMap` |
| `src/mapgen/generate.ts` | `generateMap` (the public entry), `mapDateRange` |
| `src/mapgen/index.ts` | Re-exports the public API |
| `src/engine/explore.ts` | `revealRadiusSq`, `reveal`, `isVisible`, `checkMove`, `applyMove`, `collectShard`, `shardStatus` |

## Types

```ts
// mapgen/types.ts
export type Pos = { col: number; row: number };
export type TileKind = "void" | "fog" | "wisp" | "chest" | "monster" | "boss" | "start" | "gate";
export type Tier = 1 | 2 | 3 | 4 | 5;

export type DayTile = Pos & {
  idx: number;                       // 0–90, window index
  day: ContributionDay;
  kind: Exclude<TileKind, "void">;
  tier: 0 | Tier;                    // 0 for non-fight tiles
  size?: 1 | 2;                      // chests only
  boss?: true;                       // the boss tile, including a boss on the Gate
  risen?: true;                      // Lost Ghost from the shortfall
  deco?: boolean;                    // gravestone on fog
  resolved: boolean; visited: boolean; seen: boolean;   // run-time flags, start false
};

export type GameMap = {
  cols: 13 | 14; rows: 7; w0: number;
  tiles: DayTile[];                  // 91 tiles, index = window index
  seed: number;
  bossIdx: number; gateIdx: 90;
  emptyQuarter: boolean; quiet: boolean;
  shardsNeeded: 0 | 1 | 2 | 3;
};

export type MapError = { code: "map"; message: string; retry: true; demo: true };
```

The map stores no grid. `tileAt(map, col, row)` computes `idx = col × 7 + row − w0` and returns `map.tiles[idx]` when `0 ≤ idx < 91` and `0 ≤ row < 7`, otherwise `null` (void or outside). This keeps the save plain JSON with no duplicated tiles. The prototype's `grid` was a derived cache of the same thing.

```ts
// engine/explore.ts — operates on the reducer's draft (step clones its input first)
export type ExploreState = {
  map: GameMap; pos: Pos; prev: Pos | null;
  bossDown: boolean; shards: number;
  stats: { steps: number };
  hero: { relics: readonly string[] };
  log: string[];
};
export type Dir = "up" | "down" | "left" | "right";
export type MoveCheck =
  | { ok: true; tile: DayTile }
  | { ok: false; reason: "void" }                     // outside the grid or a void cell, no message
  | { ok: false; reason: "sealed" | "warded"; message: string };
```

## Function signatures

```ts
// rng.ts
export function fnv1a(str: string): number;
export type Rng = { state: number; next(): number };
export function makeRng(seed: number): Rng;
export function nextFloat(state: number): [value: number, state: number];   // used by the engine's draft RNG
export function shuffleInPlace<T>(arr: T[], next: () => number): void;

// layout.ts
export function layoutDays(days: readonly ContributionDay[]): { w0: number; cols: 13 | 14; cells: (Pos & { idx: number })[] };
export function tileAt(map: GameMap, col: number, row: number): DayTile | null;
export function neighbours(map: GameMap, t: Pos): DayTile[];               // 4-directional, non-void

// assign.ts
export function bestDayIndex(days: readonly ContributionDay[]): { idx: number; emptyQuarter: boolean };
export function assignTiles(days: readonly ContributionDay[], cells: (Pos & { idx: number })[], best: number): DayTile[];

// shortfall.ts
export function applyShortfall(tiles: DayTile[], seed: number): { quiet: boolean };   // mutates the fresh tiles

// validate.ts
export function reachable(map: GameMap, a: DayTile, b: DayTile): boolean;            // BFS
export function validateMap(map: GameMap): MapError | null;

// generate.ts
export function generateMap(set: ContributionSet): Result<GameMap, MapError>;
export function mapDateRange(map: GameMap): { first: string; last: string };

// engine/explore.ts
export function revealRadiusSq(relics: readonly string[]): 5 | 8;                   // 8 with "review"
export function reveal(s: ExploreState): void;
export function isVisible(t: DayTile): boolean;                                     // seen || start || gate || boss
export function checkMove(s: ExploreState, dir: Dir): MoveCheck;
export function applyMove(s: ExploreState, tile: DayTile): void;                    // prev, pos, steps, visited, reveal
export function collectShard(s: ExploreState, tier: number): { got: boolean; shattered: boolean };
export function shardStatus(s: Pick<ExploreState, "map" | "shards">): { have: number; need: number };
```

`checkMove` order follows `tryMove`: outside/void → `void`; `kind === "gate" && !boss && !bossDown` → `sealed`; `boss && !resolved && shards < shardsNeeded` → `warded`; otherwise ok. The reducer (combat-timing spec) appends the refusal message to the log and emits a `blocked` event for the sound and ring effect. `applyMove` does not enter the tile; the reducer does that, so encounters stay in the engine.

`collectShard` only counts tiers 3 and 4 while `shards < shardsNeeded`, writes the log line, and reports `shattered` so the presentation can play the "WARD BROKEN" effect.

## Data flow inside `generateMap`

1. `seed = fnv1a(set.username.toLowerCase() + "|" + days[90].date)`.
2. `layoutDays` → `w0`, `cols`, cell per index.
3. `bestDayIndex`: scan indexes 1–90 with `count >= bestCount` (latest wins ties); if the best count is 0, use 45 and `emptyQuarter = true`.
4. `assignTiles` with the rule table in requirement 3.1.
5. `applyShortfall(tiles, seed)` with `makeRng(seed ^ 0x9e3779b9)`.
6. `shardsNeeded = min(3, count(kind === "monster" && tier >= 3))`.
7. `validateMap`; on failure return `{ ok: false, error }`.

The map RNG is separate from the run RNG, so the shortfall never shifts combat rolls. The run RNG starts at `seed` (combat-timing spec).

## Testing

| Test file | Checks |
| --- | --- |
| `tests/mapgen/rng.test.ts` | `fnv1a("")`, `fnv1a("a")` and the demo seed against values computed by the prototype; first 5 mulberry32 draws for seed 1; Fisher-Yates matches the prototype loop |
| `tests/mapgen/layout.test.ts` | Last date on a Saturday (`w0 = 0`, 13 cols, no void) and on a Sunday (14 cols); void cells only at the top of column 0 and the bottom of the last column; `tileAt` returns null outside |
| `tests/mapgen/assign.test.ts` | Every rule row; best day on index 0 uses the next best; best day on index 90 gives `gate` + `boss`; ties go to the latest; all-empty gives index 45 and `emptyQuarter` |
| `tests/mapgen/shortfall.test.ts` | Quiet profile reaches 6 monsters, `risen` set, deco cleared; a profile with too little fog stops when the pool is empty |
| `tests/mapgen/validate.test.ts` | Hand-built broken maps give each of the three messages; no exception escapes `generateMap` |
| `tests/mapgen/golden.test.ts` | Demo map parity with the prototype: 14 cols, seed 722674249, boss at index 77 (2026-11-03, 31 contributions), 3 shards needed, not quiet; tile counts start 1, gate 1, boss 1, chest 7, wisp 20, fog 32, Bug Imp 16, Ghoul 8, Lich 5 (measured from the prototype's `generateMap(makeDemoSet())` on 19 Nov 2026); plus a full-tile JSON snapshot in `tests/fixtures/golden/demo-map.json` recorded from the prototype |
| `tests/mapgen/map.prop.test.ts` | P1, P2, P3, P4, P5, P10 over fast-check ContributionSets (`tests/arbitraries.ts`: valid username, any last date, 91 consecutive days, independent counts and levels, plus biased generators for all-zero and very dense windows) |
| `tests/engine/explore.test.ts` | Reveal radius 5 and 8; start/gate/boss always visible; sealed Gate and warded boss messages; blocked move changes nothing; shard log lines and `shattered`; `shardsNeeded = 0` |
| `tests/engine/map-independence.prop.test.ts` | P18 (needs `newRun` from the progression spec) |

The golden snapshot is recorded once by evaluating the prototype's script from `/* ---------- utilities` up to `/* ---------- hero and balance` in a Node `vm` context (that part has no DOM access), calling `generateMap(makeDemoSet())`, and writing the tiles without `grid`. It is a fixture, not a dependency: the test only reads the JSON.

## Properties owned

| Property | Statement, as tested |
| --- | --- |
| P1 | `generateMap(set)` twice gives deeply equal results |
| P2 | Each of the 91 dates appears in exactly one tile, and tile `idx` order equals date order and calendar position `w0 + idx` |
| P3 | Start, boss, and Gate exist, and BFS finds start → boss → Gate |
| P4 | The boss index has the highest count among 1–90 (latest on ties), is never 0, and is 45 when every count in 1–90 is 0 |
| P5 | The number of `monster` tiles is at least `min(6, monsters before the shortfall + fog tiles)`; it is at least 6 whenever the window has enough fog. The prototype stops when the fog pool is empty, so the property is stated with that bound |
| P10 | `shardsNeeded ≤` the number of elites and `≤ 3`, so the ward can always be broken |
| P18 | For any set, class, and race, the map in `newRun` deep-equals `generateMap(set)`; `generateMap` has no hero parameter |

## Out of scope here

Drawing tiles, fog, lighting, labels, and tooltips (presentation); entering tiles and combat (combat-timing); the Code Review relic itself and the run's opening log lines (progression).
