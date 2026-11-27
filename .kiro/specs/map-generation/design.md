# Design: map-generation

## Overview

`src/mapgen` is a pure function from a `ContributionSet` to a `Result<GameMap, MapError>`. It never fetches, renders, reads storage, or sees the hero. `src/engine/explore.ts` holds the map-only exploration rules (legal moves, the view window, shards) that the engine reducer calls.

**v1.6 (27 Nov 2026).** The map becomes a forward-only route graph: one column is one floor, each move goes one column right to row r − 1, r, or r + 1, and a boss node after the last column ends every route. `mapgen` owns the route graph (`nextOptions`), the minimum-fights guarantee (a second shortfall step), and route validation. `explore.ts` replaces the radius reveal with a column window and the 4-direction `checkMove` with `legalMoves`. The Gate, the ward, `shardsNeeded`, and the `boss`/`gate` tile kinds are removed. The prototype keeps the v1.5 rules, so prototype parity tests are narrowed to the parts that did not change (see "Testing").

```
ContributionSet ──► layout.ts (w0, cols, col/row per day)              unchanged
                      │
                      ▼
                   assign.ts (best day → bossIdx + bestDay flag, tile kinds, tiers, chests, deco)   v1.6: no boss/gate kinds
                      │
                      ▼
                   shortfall.ts  applyShortfall      (count: ≥ 6 monsters, quiet)                   unchanged
                                 applyRouteShortfall (every route ≥ MIN_ROUTE_FIGHTS)               v1.6
                      │          (one map RNG instance, seed ^ 0x9e3779b9, shared by both)
                      ▼
                   routes.ts (nextOptions, routeMinFights, minFightRoute, reachableIdx)             v1.6
                      │
                      ▼
                   validate.ts (tiles, unique dates, legal moves forward, route fights)              v1.6
                      │
                      ▼
               Result<GameMap, MapError> ──► engine (newRun, step → explore.ts)
```

Dependency rule: `src/mapgen` imports only types from `src/data/schema.ts`. `src/engine` imports `src/mapgen`. `src/engine/balance.ts` re-exports the map constants from `src/mapgen/rules.ts`, so `balance.ts` stays the one list of rule numbers without making mapgen depend on the engine.

## Key decisions (v1.6)

**Where the route graph lives.** Legal moves depend only on the map (layout and void cells), so `nextOptions(map, pos)` lives in `src/mapgen/routes.ts`. Mapgen needs it for the route shortfall and validation; the engine's `legalMoves` is a thin wrapper that reads `pos`. One implementation means the guarantee mapgen checks is exactly the rule the engine enforces.

**Edge-column fallback.** Void cells exist only at the top of column 0 and the bottom of the last column. Column 0 is never entered after the start, so the only dead end is moving from column `cols − 2` into a short last column (rows 0 to `(w0 + 90) % 7`). Options considered: (a) allow a diagonal of any length into the last column's nearest day, (b) let such tiles jump straight to the boss node, (c) clamp the target row into the column's day rows. (b) skips a floor, which breaks "one floor = one week" and the `cols`-moves route length. (a) and (c) are the same here because a column's day rows are contiguous; the design states it as "the day tile closest in row, ties to the smaller row" (the general form of (c)). It keeps every route at exactly one tile per column. The demo map exercises it: 14 columns, last column rows 0–1, so column 12 rows 3–6 all fall back to (13, 1).

**Best-day tile.** Options: (a) a normal tile by its level, flagged `bestDay`; (b) a fixed size-2 chest; (c) a new tile kind. (c) adds a kind to every switch, the save schema, and the renderer for one tile. (b) makes the player's best day a reward with no risk, which is the opposite of its meaning. (a) keeps one rule for all days; the best day is almost always level 4, so it is usually a Merge Conflict Lich (an elite that drops a shard), and the flag lets the presentation mark it "The Phantom rose from this day". On an empty quarter no tile is flagged, because no day was best.

**Minimum fights.** Options: (a) at least one monster in every window of N columns on every route; (b) a minimum count of monsters on every route. (a) needs a sliding-window DP and over-constrains busy maps. (b) is one min-cost-path DP over at most 91 tiles, is easy to state and property-test, and only changes maps where a fight-free route exists. `MIN_ROUTE_FIGHTS = 4` over 12–13 entered day tiles is about one fight every three weeks at minimum; the simulator re-measures it. Conversion targets the fight-minimal route, so each conversion raises the minimum where it matters, and prefers fog, then wisps, then chests, so healing tiles survive longest. The count shortfall (`MIN_FIGHTS = 6`, prototype rule, P5) stays first and unchanged.

**Visibility window.** Because the hero only moves right and relics are never lost, "seen" can stay a sticky per-tile flag and still equal `col ≤ pos.col + window` at every moment (P22). That keeps save data and the renderer unchanged in shape: they read `seen` as before.

## Module files

| File | Contents |
| --- | --- |
| `src/mapgen/rng.ts` | `fnv1a`, `makeRng`, `nextFloat` (pure state-in, state-out form), `shuffleInPlace` (Fisher-Yates) |
| `src/mapgen/dates.ts` | UTC helpers: `parseDate`, `weekday`, `addDays`, `fmtDate` ("Tue 3 Nov 2026"), `fmtShort` ("3 Nov"). Always `new Date(str + "T00:00:00Z")`, never the device clock |
| `src/mapgen/rules.ts` | `ROWS = 7`, `MIN_FIGHTS = 6`, `MAP_RNG_SALT = 0x9e3779b9`, `CHEST_MOD = 3`, `DECO_MOD = 6`, `EMPTY_QUARTER_IDX = 45`; **v1.6:** `ROUTE_REACH = 1`, `MIN_ROUTE_FIGHTS = 4`; `MAX_SHARDS` removed (the engine's `SHARD_MAX` replaces it) |
| `src/mapgen/types.ts` | `TileKind`, `Tier`, `DayTile`, `GameMap`, `MapError`, `Pos`, **v1.6:** `RouteOption` |
| `src/mapgen/layout.ts` | `layoutDays`, `tileAt`, `neighbours` (kept for the layout tests; no longer used for movement) |
| `src/mapgen/assign.ts` | `bestDayIndex`, `assignTiles` |
| `src/mapgen/shortfall.ts` | `applyShortfall` (count), **v1.6:** `applyRouteShortfall` |
| `src/mapgen/routes.ts` | **v1.6:** `nextOptions`, `routeMinFights`, `minFightRoute`, `reachableIdx` |
| `src/mapgen/validate.ts` | `validateMap` (v1.6 checks); `reachable` (BFS) removed |
| `src/mapgen/generate.ts` | `generateMap` (the public entry), `mapDateRange` |
| `src/mapgen/index.ts` | Re-exports the public API |
| `src/engine/explore.ts` | **v1.6:** `viewAhead`, `reveal`, `isVisible`, `legalMoves`, `checkMove`, `applyMove`, `collectShard`, `shardStatus` |

## Types

```ts
// mapgen/types.ts (v1.6)
export type Pos = { col: number; row: number };
export type TileKind = "void" | "fog" | "wisp" | "chest" | "monster" | "start";   // "boss" and "gate" removed
export type Tier = 1 | 2 | 3 | 4 | 5;                                             // 5 is only used by the boss Monster

export type DayTile = Pos & {
  idx: number;                       // 0–90, window index
  day: ContributionDay;
  kind: Exclude<TileKind, "void">;
  tier: 0 | 1 | 2 | 3 | 4;           // 0 for non-fight tiles
  size?: 1 | 2;                      // chests only
  bestDay?: true;                    // v1.6: the day the boss is named after (not on an empty quarter)
  risen?: true;                      // Lost Ghost from either shortfall step
  deco?: boolean;                    // gravestone on fog
  resolved: boolean; visited: boolean; seen: boolean;   // run-time flags, start false
};

export type GameMap = {
  cols: 13 | 14; rows: 7; w0: number;
  tiles: DayTile[];                  // 91 tiles, index = window index
  seed: number;
  bossIdx: number;                   // the best day (naming, source label, trait row)
  bossNode: Pos;                     // v1.6: { col: cols, row: tiles[bossIdx].row }
  emptyQuarter: boolean; quiet: boolean;
  // v1.6: gateIdx and shardsNeeded removed
};

export type RouteOption = { col: number; row: number; boss: boolean };   // boss: true only for the boss node
export type MapError = { code: "map"; message: string; retry: true; demo: true };
```

The map stores no grid. `tileAt(map, col, row)` computes `idx = col × 7 + row − w0` and returns `map.tiles[idx]` when `0 ≤ idx < 91` and `0 ≤ row < 7`, otherwise `null` (void or outside). This keeps the save plain JSON with no duplicated tiles.

```ts
// engine/explore.ts (v1.6) — operates on the reducer's draft (step clones its input first)
export type ExploreState = {
  map: GameMap; pos: Pos; prev: Pos | null;
  shards: number;
  stats: { steps: number };
  hero: { relics: readonly string[] };
  log: string[];
};
export type MoveCheck = { ok: true; target: RouteOption; tile: DayTile | null } | { ok: false };   // tile null for the boss node
```

## Function signatures

```ts
// rng.ts, dates.ts, layout.ts: unchanged

// assign.ts
export function bestDayIndex(days: readonly ContributionDay[]): { idx: number; emptyQuarter: boolean };
export function assignTiles(days: readonly ContributionDay[], cells: (Pos & { idx: number })[],
                            best: { idx: number; emptyQuarter: boolean }): DayTile[];

// shortfall.ts
export function applyShortfall(tiles: DayTile[], rng: Rng): { quiet: boolean };        // count step; draws only when it runs
export function applyRouteShortfall(map: GameMap, rng: Rng): number;                    // v1.6; returns tiles converted

// routes.ts (v1.6)
export function nextOptions(map: GameMap, from: Pos): RouteOption[];                     // game-rules "Routes"
export function routeMinFights(map: GameMap): number;                                    // DP, boss not counted
export function minFightRoute(map: GameMap): DayTile[];                                  // columns 0..cols−1, start first
export function reachableIdx(map: GameMap): Set<number>;                                 // tile idx reachable from the start

// validate.ts
export function validateMap(map: GameMap): MapError | null;

// generate.ts
export function generateMap(set: ContributionSet): Result<GameMap, MapError>;
export function mapDateRange(map: GameMap): { first: string; last: string };

// engine/explore.ts (v1.6)
export function viewAhead(relics: readonly string[]): 2 | 3;                             // 3 with "review"
export function reveal(s: ExploreState): void;                                           // seen for col ≤ pos.col + viewAhead
export function isVisible(t: DayTile): boolean;                                          // t.seen
export function legalMoves(s: ExploreState): RouteOption[];                              // nextOptions(map, pos); [] at the boss node
export function checkMove(s: ExploreState, to: Pos): MoveCheck;                          // ok only if `to` equals a legal move
export function applyMove(s: ExploreState, m: Extract<MoveCheck, { ok: true }>): void;   // prev, pos, steps, visited, reveal
export function collectShard(s: ExploreState, tier: number): { got: boolean; bound: boolean };
export function shardStatus(s: Pick<ExploreState, "shards">): { have: number; max: 3 };
```

The applyShortfall signature changes from `(tiles, seed)` to `(tiles, rng)` so both steps share one RNG instance; `generateMap` creates it with `makeRng(seed ^ MAP_RNG_SALT)`. Draw order for the count step is unchanged, so its output matches the prototype.

### `nextOptions(map, from)`

1. If `from.col === map.cols − 1`: return `[{ ...map.bossNode, boss: true }]`.
2. If `from.col >= map.cols` (at the boss node) or `tileAt(map, from.col, from.row)` is null: return `[]`.
3. `c = from.col + 1`. Collect `tileAt(map, c, r)` for `r` in `from.row − ROUTE_REACH … from.row + ROUTE_REACH`, ascending, keeping non-null.
4. If the list is empty: among the day tiles of column `c`, return the one with the smallest `|row − from.row|`, ties to the smaller row. (Every column 1 … cols − 1 has at least one day, so this always returns one option.)

### `routeMinFights` and `minFightRoute`

Backward DP over columns `cols − 1` down to 0, on reachable tiles only: `best[t] = (t.kind === "monster" ? 1 : 0) + (t.col === cols − 1 ? 0 : min(best[o] for o in nextOptions(t)))`. `routeMinFights = best[start]`. `minFightRoute` walks forward from the start, taking the first option (ascending row) with the smallest `best`. Both are O(91 × 3).

### `applyRouteShortfall(map, rng)`

Loop while `routeMinFights(map) < MIN_ROUTE_FIGHTS`: `route = minFightRoute(map)` without the start; `candidates` = its fog tiles, else its wisps, else its chests (route order); `t = candidates[floor(rng.next() × candidates.length)]`; set `kind = "monster"`, `tier = 1`, `risen = true`, `deco = false`, delete `size`. Return the number converted. Termination and the guarantee are argued in game-rules.md; the loop also has a hard cap of 91 iterations as a defence, after which validation rejects the map.

### Data flow inside `generateMap`

1. `seed = fnv1a(set.username.toLowerCase() + "|" + days[90].date)`; `rng = makeRng(seed ^ MAP_RNG_SALT)`.
2. `layoutDays` → `w0`, `cols`, cell per index.
3. `bestDayIndex`: scan indexes 1–90 with `count >= bestCount` (latest wins ties); if the best count is 0, use 45 and `emptyQuarter = true`.
4. `assignTiles` with the rule table in requirement 3.1, setting `bestDay` on `bossIdx` unless `emptyQuarter`.
5. `applyShortfall(tiles, rng)` → `quiet`.
6. Build the map with `bossNode = { col: cols, row: tiles[bossIdx].row }`.
7. `applyRouteShortfall(map, rng)`.
8. `validateMap`; on failure return `{ ok: false, error }`.

The map RNG is separate from the run RNG, so neither shortfall shifts combat rolls. The run RNG starts at `seed` (combat-timing spec).

### `validateMap` checks, in order

| Check | Message on failure |
| --- | --- |
| 91 tiles, `tiles[0].kind === "start"`, `bossIdx` in 1–90 | "The map could not be raised." |
| Every date unique | "Duplicate days in the map." |
| For every idx in `reachableIdx(map)`: `nextOptions` is non-empty and every option has `col === tile.col + 1` (boss node only from the last column) | "The map has no route." |
| `routeMinFights(map) ≥ MIN_ROUTE_FIGHTS` | "The map has no route." |

### Engine side (`explore.ts`)

- `checkMove(s, to)` compares `to` with `legalMoves(s)` by `col` and `row`. Anything else, including any `to` while the hero is on the boss node, is `{ ok: false }`. The reducer (combat-timing requirement 22) then returns the cloned state unchanged with no event.
- `applyMove` sets `prev`, `pos = { col, row }`, `steps + 1`, `tile.visited = true` for day tiles, then `reveal`. It does not enter the tile; the reducer does that, so encounters stay in the engine.
- `reveal(s)` marks every tile with `t.col ≤ s.pos.col + viewAhead(s.hero.relics)` as seen. `pickRelic("review")` calls it again (progression).
- `collectShard` counts only tiers 3 and 4 while `shards < SHARD_MAX`, writes the log line from requirement 7.1, and reports `bound` (shards just reached `SHARD_NO_PHASE2`) for the presentation effect.

## Error handling

| Operation | Failure | Recoverable? | Caller receives | Logged |
| --- | --- | --- | --- | --- |
| `generateMap` | Any check in `validateMap` fails | Yes (retry or demo) | `{ ok: false, error: MapError }` with the message above | No (pure); the start screen shows the message |
| `generateMap` | An unexpected exception inside generation | Yes | Caught; `{ ok: false, error }` "The map could not be raised." | No |
| `applyRouteShortfall` | Hits the 91-iteration cap (should be impossible) | Yes | Returns; `validateMap` then fails with "The map has no route." | No |
| `nextOptions` | `from` is not a day tile or is the boss node | — | `[]` (no move possible), never throws | No |
| `checkMove` | `to` is not a legal move | — | `{ ok: false }`; the reducer ignores the action | No |

`src/mapgen` and `src/engine` never log to the console (engine rule 1); every message is data.

## Invariants and who enforces them

| Invariant | Enforced by | Why there |
| --- | --- | --- |
| Moves go forward exactly one column, to a legal option | `nextOptions` (definition) and `checkMove` (enforcement) | One definition used by both mapgen validation and the engine, so a validated map is exactly the graph the player walks |
| Every reachable tile has a legal move; every route reaches the boss node | `nextOptions` by construction; `validateMap` re-checks | Validation is the trust boundary before play (FR-MAP-4) |
| Every route has ≥ 4 fights | `applyRouteShortfall`; `validateMap` re-checks | A pure function of the map, so it belongs in generation, not in the engine |
| `seen ⇔ col ≤ pos.col + window` | `reveal`, called by `newRun`, `applyMove`, and `pickRelic` | The engine owns state; the renderer only reads `seen` |
| `shards ≤ 3` | `collectShard` | Single writer of `shards` |
| A restored `pos` is a reachable day tile or the boss node with a fight | `restore` (progression) | Save data is external input, validated at the boundary |

## Testing

| Test file | Checks |
| --- | --- |
| `tests/mapgen/rng.test.ts`, `dates.test.ts`, `layout.test.ts` | Unchanged |
| `tests/mapgen/assign.test.ts` | **v1.6:** every rule row; index 0 start; the best day and index 90 follow the level table; `bestDay` only on `bossIdx`, not on an empty quarter; no `boss` or `gate` kind; ties to the latest; all-empty gives index 45 and `emptyQuarter` |
| `tests/mapgen/shortfall.test.ts` | Count step unchanged (now given an RNG); **v1.6** route step: a fixture with a fight-free route reaches `routeMin ≥ 4`; fog converted before wisps before chests; the same map RNG instance continues after the count step; `quiet` unchanged by the route step |
| `tests/mapgen/routes.test.ts` | **v1.6:** `nextOptions` for a middle row (3 options), row 0 and row 6 (2 options), the demo's fallback (column 12 rows 3–6 → (13, 1); row 2 → only (13, 1) by the normal rule), a 13-column map (no fallback), last column → boss node only, boss node → `[]`; `routeMinFights` and `minFightRoute` on a hand-built map with a known answer |
| `tests/mapgen/validate.test.ts` | **v1.6:** hand-built maps with a missing start, a duplicate date, a tile with no forward option, and a route below 4 fights each return their message; `generateMap` never throws |
| `tests/mapgen/golden.test.ts` | **v1.6:** demo summary facts: 14 cols, seed 722674249, `bossIdx` 77 (2026-11-03, 31 contributions) with `bestDay`, `bossNode` (14, 2), not quiet, `routeMin ≥ 4`. A new snapshot `tests/fixtures/golden/demo-map-v2.json` recorded from the port. Prototype parity: compared with `demo-map.json` (recorded from the prototype, kept), the only tiles that differ are index 77, index 90, and tiles converted by the route shortfall (each now a `risen` tier-1 monster) |
| `tests/mapgen/map.prop.test.ts` | P1, P2, P3 (v1.6), P4 (v1.6), P5, P20, P21; P10 removed |
| `tests/engine/explore.test.ts` | **v1.6:** window at start (columns 0–2 seen), after a move, with Code Review (0–3), seen tiles stay seen; `legalMoves` matches `nextOptions`; `checkMove` refuses behind, same column, two ahead, void, and an unlisted row; `applyMove` updates `prev`, `steps`, `visited`; boss node move; shard log lines, `bound` at 3, nothing past 3, nothing from tiers 1, 2 |
| `tests/engine/explore.prop.test.ts` | **v1.6:** P22 |
| `tests/engine/map-independence.prop.test.ts` | P18 (unchanged) |

Property tests use `tests/arbitraries.ts` (any last date, so both 13- and 14-column maps and every last-column height are generated) plus the all-zero and dense variants. A map can have up to about 3^13 routes, too many to enumerate per case, so P20 and P21 use two checks: 50 random walks per map with fast-check-chosen option indices (each must reach the boss node in `cols` moves with at least 4 fights), and `routeMinFights` compared with a plain recursive minimum written in the test file.

## Properties owned

| Property | Status | Statement, as tested |
| --- | --- | --- |
| P1 | Kept | `generateMap(set)` twice gives deeply equal results |
| P2 | Kept | Each of the 91 dates appears in exactly one tile, and tile `idx` order equals date order and calendar position `w0 + idx` |
| P3 | **Changed in v1.6** | From every tile reachable from the start, `nextOptions` is non-empty; every option is in column `col + 1` and in rows `row − 1 … row + 1` unless none of those is a day (then it is the single nearest day of the next column); from the last column the only option is the boss node. (Was: start, boss, and Gate exist and BFS finds start → boss → Gate) |
| P4 | **Changed in v1.6** | `bossIdx` has the highest count among 1–90 (latest on ties), is never 0, and is 45 when every count in 1–90 is 0; exactly the tile at `bossIdx` has `bestDay` (none on an empty quarter); no tile has kind `boss` or `gate`; `bossNode = { col: cols, row: tiles[bossIdx].row }`. (Was: the boss sits on that day) |
| P5 | Kept | The number of `monster` tiles is at least `min(6, monsters before the shortfall + fog tiles)` |
| P10 | **Retired in v1.6** | Was: `shardsNeeded ≤` elites and `≤ 3`. There is no `shardsNeeded`; shard bounds move to P23 (combat-timing) |
| P18 | Kept | For any set, class, and race, the map in `newRun` deep-equals `generateMap(set)`; `generateMap` has no hero parameter |
| P20 | **New in v1.6** | Every route from the start (any sequence of option choices) reaches the boss node in exactly `cols` moves, entering one day tile in each column 1 … cols − 1 |
| P21 | **New in v1.6** | Every route from the start enters at least `MIN_ROUTE_FIGHTS` (4) `monster` tiles; `routeMinFights(map)` equals an independent recursive minimum and is ≥ 4 |
| P22 | **New in v1.6** | For any state reached by an action sequence from `newRun`, `tile.seen ⇔ tile.col ≤ pos.col + viewAhead(relics)` (boss node: every tile is seen), and every `legalMoves` target is seen or is the boss node |

## Out of scope here

Drawing tiles, fog, the highlighted legal moves, lighting, labels, and tooltips, and mapping keys and taps to `move` targets (presentation); entering tiles and combat, and the boss fight (combat-timing); the Code Review relic itself, the rest and wisp heals, and the run's opening log lines (progression).
