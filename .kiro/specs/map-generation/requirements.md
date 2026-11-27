# Requirements: map-generation

## Introduction

This spec turns a validated `ContributionSet` into a validated map laid out exactly like the GitHub calendar, and covers the exploration rules that depend only on the map. It also owns the shared hash and seeded RNG.

**v1.6 (27 Nov 2026): forward-only branching routes.** Each column (week) is one floor. The hero starts on the start tile in column 0 and moves only to the next column, to row r − 1, r, or r + 1, until a final boss node after the last week. Every tile entered resolves. The Gate and the ward are removed; soul shards weaken the boss instead (combat-timing). Tile contents are visible only inside a window of columns ahead of the hero. These rules apply to the TypeScript rebuild only; `prototype/` keeps the v1.5 rules. Criteria changed or added in v1.6 are marked **(v1.6)**; retired criteria keep their numbers and say so, so task and test references stay stable.

Rules and numbers come from `prototype/index.html` (`fnv1a`, `makeRng`, `generateMap`, `buildGrid`, `validateMap`) and `.kiro/steering/game-rules.md` ("Determinism", "Map", "Routes", "Minimum fights per route", "Route validation", "Visibility window", "Exploration", "Soul shards"). The v1.6 rules are not in the prototype; they come from PRD v1.6 and `game-rules.md`.

PRD IDs covered: FR-MAP-1 to FR-MAP-4, FR-MOV-3, FR-MOV-6, FR-MOV-7, FR-MOV-8. Shared with presentation (this spec owns the rule, presentation owns the drawing and the input): FR-MOV-1, FR-MOV-2, FR-MOV-3.

## Glossary

- **Window**: the 91 `days` of a ContributionSet, oldest first, index 0–90.
- **w0**: the UTC weekday of `days[0]` (0 = Sunday).
- **Fight tile**: a tile with kind `monster`.
- **Elite**: a `monster` tile with tier 3 (Flaky Test Ghoul) or 4 (Merge Conflict Lich).
- **Map RNG**: mulberry32 seeded with `seed ^ 0x9e3779b9`, used only by the two shortfall steps.
- **Floor (v1.6)**: one column of the map (one week).
- **Legal move (v1.6)**: a target the hero may move to from its position (game-rules.md "Routes").
- **Boss node (v1.6)**: the final node after the last column, `{ col: cols, row: tiles[bossIdx].row }`. It is not a day tile.
- **Route (v1.6)**: a sequence of legal moves from the start tile to the boss node.
- **View window (v1.6)**: the columns from 0 to `pos.col + VIEW_AHEAD` (2, or 3 with Code Review).

## Requirements

### Requirement 1: Hash, seed, and RNG

**User story:** As a player, I want the same profile on the same day to give the same map and the same fights, so that a challenge link is fair.

#### Acceptance criteria

1.1 WHEN hashing a string THE SYSTEM SHALL compute 32-bit FNV-1a over its UTF-16 code units (`h = 0x811c9dc5; h ^= code; h = Math.imul(h, 0x01000193)`; result `h >>> 0`). [FR-MAP-3]

1.2 WHEN drawing a random number THE SYSTEM SHALL use mulberry32 exactly as in the prototype's `makeRng`, with its state as a uint32 that can be read and restored. [FR-MAP-3]

1.3 WHEN a map is generated THE SYSTEM SHALL set `seed = fnv1a(username.toLowerCase() + "|" + lastDate)`, where `lastDate` is the date of `days[90]`. [FR-MAP-3, P1]

1.4 WHEN the same ContributionSet is generated twice THE SYSTEM SHALL return deeply equal maps. [FR-MAP-3, P1]

### Requirement 2: Calendar layout

**User story:** As a developer, I want the map to look like my contribution graph, so that I recognise it at once.

#### Acceptance criteria

2.1 WHEN laying out the window THE SYSTEM SHALL use 7 rows (Sunday 0 at the top to Saturday 6) and `cols = ceil((w0 + 91) / 7)` columns, which is 13 when `w0 = 0` and 14 otherwise. [FR-MAP-2]

2.2 WHEN placing day `i` THE SYSTEM SHALL put it at `p = w0 + i`, column `floor(p / 7)`, row `p % 7`, so every day maps to exactly one tile in calendar order. [FR-MAP-2, P2]

2.3 WHEN a grid cell has no day THE SYSTEM SHALL treat it as `void` and never let the hero enter it; void cells occur only at the top of the first column and the bottom of the last. [FR-MAP-2]

2.4 WHEN the summary needs the date range THE SYSTEM SHALL provide the window's first and last dates from the map. [FR-MAP-1]

### Requirement 3: Tile assignment

**User story:** As a player, I want each day to become a specific encounter, so that my busy days feel dangerous and my empty days feel haunted.

#### Acceptance criteria

3.1 **(v1.6)** WHEN assigning tiles THE SYSTEM SHALL apply these rules in order, first match wins, with `h = fnv1a(date)`: index 0 → `start`; level 0 → `fog` with a gravestone decoration when `h % 6 === 0`; level 1 → `wisp`; level 2 → `chest` size 1 when `h % 3 === 0`, else `monster` tier 2; level 3 → `chest` size 2 when `h % 3 === 0`, else `monster` tier 3; level 4 → `monster` tier 4. No tile gets kind `boss` or `gate`; the best day and index 90 follow the table like any other day. [FR-MAP-3]

3.2 **(v1.6)** WHEN choosing the best day THE SYSTEM SHALL take the highest count among indexes 1–90, with ties going to the latest date, store it as `bossIdx` (the day the boss is named after), and flag that tile `bestDay: true` unless the map is an empty quarter. [FR-MAP-3, P4]

3.3 WHEN the best count is 0 THE SYSTEM SHALL set `bossIdx` to 45 (`floor(91 / 2)`) and mark the map `emptyQuarter`. [FR-MAP-3, FR-MAP-4]

3.4 WHEN fewer than 6 tiles have kind `monster` THE SYSTEM SHALL mark the map `quiet`, shuffle all `fog` tiles with Fisher-Yates using the map RNG (`for i from len − 1 down to 1: j = floor(next() × (i + 1))`), then pop from the end and turn each into a tier-1 `monster` with `risen: true` and no decoration, until there are 6 monsters or no fog tiles remain. [FR-MAP-3, P5]

3.5 *Retired in v1.6.* `shardsNeeded` no longer exists: shards are a bonus that weakens the boss (requirement 7), not a gate. [was FR-MOV-7, P10]

3.6 WHEN a tile is created THE SYSTEM SHALL set `resolved`, `visited`, and `seen` to `false`. [FR-MAP-3]

3.7 WHEN generating a map THE SYSTEM SHALL take only the ContributionSet as input, so the hero's class, race, relics, or settings can never change it. [FR-CLS-1, FR-RACE-1, P18]

3.8 **(v1.6)** WHEN the count shortfall (3.4) is done THE SYSTEM SHALL apply the route shortfall from game-rules.md "Minimum fights per route": while the minimum number of `monster` tiles on any route (`routeMin`) is below `MIN_ROUTE_FIGHTS` (4), take the fight-minimal route (ascending-row tie-break), choose one of its tiles in columns ≥ 1 of the lowest available class (fog, else wisp, else chest) with `floor(next() × n)` from the same map RNG instance, and turn it into a tier-1 `monster` with `risen: true`, no decoration, and no chest size. It SHALL NOT change `quiet`. [FR-MAP-3, FR-MOV-8, P21]

### Requirement 4: Validation before play

**User story:** As a player, I want a broken map to be caught before I see it, so that every run can be finished.

#### Acceptance criteria

4.1 **(v1.6)** WHEN a map is generated THE SYSTEM SHALL check that all 91 tiles exist with the start at index 0, that every date appears exactly once, that every tile reachable from the start has at least one legal move and every legal move goes exactly one column forward (or to the boss node from the last column), and that `routeMin ≥ MIN_ROUTE_FIGHTS`. [FR-MAP-4, P3, P20, P21]

4.2 IF a check fails THEN THE SYSTEM SHALL return a `map` error ("The map could not be raised." for missing tiles, "Duplicate days in the map.", or "The map has no route." for moves or fights) offering retry and demo mode, and SHALL NOT return the map. [FR-MAP-4]

### Requirement 5: Visibility window

**User story:** As a player, I want to see my graph's shape but only the next few weeks' contents, so that choosing a branch is a real decision.

#### Acceptance criteria

5.1 **(v1.6)** WHEN the run starts, after every move, and when Code Review is picked THE SYSTEM SHALL mark as `seen` every tile with `col ≤ pos.col + VIEW_AHEAD` (2), or `+ VIEW_AHEAD_REVIEW` (3) when the hero holds Code Review. Seen tiles stay seen. [FR-MOV-6, P22]

5.2 **(v1.6)** WHEN deciding what a tile shows THE SYSTEM SHALL show its contents only when `seen`; an unseen tile shows only its shape and level shade. The boss node is always shown. [FR-MOV-6, P22]

5.3 **(v1.6)** WHILE exploring THE SYSTEM SHALL provide the legal moves (requirement 6.1) so the presentation can highlight them; every legal move target SHALL be inside the view window. [FR-MOV-8, P22]

### Requirement 6: Legal moves

**User story:** As a player, I want each week to offer up to three branches forward, so that my route is a choice and never a dead end.

#### Acceptance criteria

6.1 **(v1.6)** WHEN the hero is on a day tile at `(c, r)` with `c < cols − 1` THE SYSTEM SHALL offer as legal moves the day tiles of column `c + 1` in rows `r − 1`, `r`, `r + 1` that exist (not void, inside rows 0–6), in ascending row order. [FR-MOV-1, FR-MOV-8, P3]

6.2 **(v1.6)** WHEN none of those three cells is a day tile THE SYSTEM SHALL offer exactly one legal move: the day tile of column `c + 1` whose row is closest to `r`, ties going to the smaller row. [FR-MOV-8, P3]

6.3 **(v1.6)** WHEN the hero is on a tile in the last column THE SYSTEM SHALL offer exactly one legal move: the boss node. [FR-MOV-8, P20]

6.4 **(v1.6)** WHEN a move targets anything that is not a legal move (behind, sideways, staying, two columns ahead, a void cell, or any move while not exploring) THE SYSTEM SHALL ignore it and leave the position, `steps`, every tile, and the log unchanged, with no event. [FR-MOV-3, P24]

6.5 **(v1.6)** WHEN a legal move is made THE SYSTEM SHALL store the old position as `prev`, move the hero, add 1 to `steps`, mark the target tile `visited` (day tiles only), and update the view window. [FR-MOV-6, P24]

6.6 *Retired in v1.6.* The sealed Gate and the warded boss no longer exist, so no move is refused with a message. [was FR-MOV-3, FR-MOV-7]

### Requirement 7: Soul shards

**User story:** As a player, I want my other big days to matter, so that fighting elites on the way pays off at the boss.

#### Acceptance criteria

7.1 **(v1.6)** WHEN a tier 3 or tier 4 monster is banished while `shards < SHARD_MAX` (3) THE SYSTEM SHALL add 1 shard and log "Soul shard {n}/3. The Phantom weakens.", or "Soul shard 3/3. The Phantom is bound: no Phase 2." when `n` reaches 3. Banishing more elites after that adds nothing and logs nothing. [FR-MOV-7, P23]

7.2 *Retired in v1.6.* There is no ward, so there is no "unwarded from the start" case. [was FR-MOV-7, P10]

7.3 **(v1.6)** WHEN the HUD asks for shard status THE SYSTEM SHALL provide `{ have: shards, max: 3 }`. The boss's weakening from shards is applied by combat-timing requirement 2.6. [FR-MOV-7]

### Requirement 8: Boss node and route completeness (v1.6)

**User story:** As a player, I want every branch I take to lead to the Phantom, so that my choices change the fights, not whether I can finish.

#### Acceptance criteria

8.1 **(v1.6)** WHEN a map is generated THE SYSTEM SHALL provide `bossNode = { col: cols, row: tiles[bossIdx].row }`, reachable by one legal move from every tile in the last column. [FR-MOV-8, FR-PRO-3, P20]

8.2 **(v1.6)** WHEN any route is followed from the start THE SYSTEM SHALL reach the boss node in exactly `cols` legal moves, entering exactly one day tile in each of columns 1 to `cols − 1`. [FR-MAP-4, P20]

8.3 **(v1.6)** WHEN any route is followed from the start THE SYSTEM SHALL enter at least `MIN_ROUTE_FIGHTS` (4) `monster` tiles, the boss not counted. [FR-MAP-4, FR-MOV-8, P21]
