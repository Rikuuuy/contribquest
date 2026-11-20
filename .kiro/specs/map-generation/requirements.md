# Requirements: map-generation

## Introduction

This spec turns a validated `ContributionSet` into a validated map laid out exactly like the GitHub calendar, and covers the exploration rules that depend only on the map: fog-of-war reveal, blocked moves (void cells, the sealed Gate, the warded boss), and soul shards. It also owns the shared hash and seeded RNG.

Rules and numbers come from `prototype/index.html` (`fnv1a`, `makeRng`, `generateMap`, `buildGrid`, `neighbors`, `reachable`, `validateMap`, `reveal`, `tryMove`, the shard block of `winFight`) and `.kiro/steering/game-rules.md` ("Determinism", "Map", "Exploration").

PRD IDs covered: FR-MAP-1 to FR-MAP-4, FR-MOV-6, FR-MOV-7. Shared with presentation (this spec owns the rule, presentation owns the drawing and the input): FR-MOV-3.

## Glossary

- **Window**: the 91 `days` of a ContributionSet, oldest first, index 0–90.
- **w0**: the UTC weekday of `days[0]` (0 = Sunday).
- **Fight tile**: a tile with kind `monster`. The boss is not a fight tile for the shortfall count.
- **Elite**: a `monster` tile with tier 3 (Flaky Test Ghoul) or 4 (Merge Conflict Lich).
- **Map RNG**: mulberry32 seeded with `seed ^ 0x9e3779b9`, used only by the shortfall shuffle.

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

2.3 WHEN a grid cell has no day THE SYSTEM SHALL treat it as `void` and never walkable; void cells occur only at the top of the first column and the bottom of the last. [FR-MAP-2]

2.4 WHEN the summary needs the date range THE SYSTEM SHALL provide the window's first and last dates from the map. [FR-MAP-1]

### Requirement 3: Tile assignment

**User story:** As a player, I want each day to become a specific encounter, so that my busy days feel dangerous and my empty days feel haunted.

#### Acceptance criteria

3.1 WHEN assigning tiles THE SYSTEM SHALL apply these rules in order, first match wins, with `h = fnv1a(date)`: index 0 → `start`; the best day → `boss` tier 5 (or `gate` with `boss: true` when the best day is index 90); index 90 → `gate`; level 0 → `fog` with a gravestone decoration when `h % 6 === 0`; level 1 → `wisp`; level 2 → `chest` size 1 when `h % 3 === 0`, else `monster` tier 2; level 3 → `chest` size 2 when `h % 3 === 0`, else `monster` tier 3; level 4 → `monster` tier 4. [FR-MAP-3]

3.2 WHEN choosing the best day THE SYSTEM SHALL take the highest count among indexes 1–90, with ties going to the latest date, so the boss is never on the start tile. [FR-MAP-3, P4]

3.3 WHEN the best count is 0 THE SYSTEM SHALL put the boss on index 45 (`floor(91 / 2)`) and mark the map `emptyQuarter`. [FR-MAP-3, FR-MAP-4]

3.4 WHEN fewer than 6 tiles have kind `monster` THE SYSTEM SHALL mark the map `quiet`, shuffle all `fog` tiles with Fisher-Yates using the map RNG (`for i from len − 1 down to 1: j = floor(next() × (i + 1))`), then pop from the end and turn each into a tier-1 `monster` with `risen: true` and no decoration, until there are 6 monsters or no fog tiles remain. [FR-MAP-3, P5]

3.5 WHEN assignment is complete THE SYSTEM SHALL set `shardsNeeded = min(3, number of monster tiles with tier ≥ 3)`. [FR-MOV-7, P10]

3.6 WHEN a tile is created THE SYSTEM SHALL set `resolved`, `visited`, and `seen` to `false`. [FR-MAP-3]

3.7 WHEN generating a map THE SYSTEM SHALL take only the ContributionSet as input, so the hero's class, race, relics, or settings can never change it. [FR-CLS-1, FR-RACE-1, P18]

### Requirement 4: Validation before play

**User story:** As a player, I want a broken map to be caught before I see it, so that every run can be finished.

#### Acceptance criteria

4.1 WHEN a map is generated THE SYSTEM SHALL check that the start, Gate, and boss tiles exist, that BFS over 4-directional non-void neighbours finds start → boss and boss → Gate, and that every date appears exactly once. [FR-MAP-4, P3]

4.2 IF a check fails THEN THE SYSTEM SHALL return a `map` error ("The map could not be raised.", "The map has no route.", or "Duplicate days in the map.") offering retry and demo mode, and SHALL NOT return the map. [FR-MAP-4]

### Requirement 5: Fog of war

**User story:** As a player, I want to see my graph's shape but not what each busy day became, so that routing is a choice.

#### Acceptance criteria

5.1 WHEN the run starts and after every successful move THE SYSTEM SHALL mark as `seen` every tile with `dc² + dr² ≤ 5` from the hero, or `≤ 8` when the hero holds Code Review. Seen tiles stay seen. [FR-MOV-6]

5.2 WHEN deciding what a tile shows THE SYSTEM SHALL treat `start`, `gate`, and boss tiles as always visible and all other unseen tiles as showing only their level shade. [FR-MOV-6]

### Requirement 6: Blocked moves, the sealed Gate, and the ward

**User story:** As a player, I want to know why I cannot step somewhere, so that I know what to do next.

#### Acceptance criteria

6.1 WHEN a move targets a cell outside the grid or a void cell THE SYSTEM SHALL refuse it silently. [FR-MAP-2]

6.2 WHEN a move targets the Gate, the Gate is not the boss, and the boss is not down THE SYSTEM SHALL refuse it with "The Gate is sealed. Defeat the Phantom of your best day first." [FR-MOV-3]

6.3 WHEN a move targets an unresolved boss tile while `shards < shardsNeeded` THE SYSTEM SHALL refuse it with "The Phantom is warded. Soul shards: {shards}/{shardsNeeded}. Banish more Ghouls or Liches." [FR-MOV-7]

6.4 WHEN a move is refused THE SYSTEM SHALL leave the position, `steps`, and every tile unchanged. [FR-MOV-3, FR-MOV-7]

6.5 WHEN a move succeeds THE SYSTEM SHALL store the old position as `prev`, move the hero, add 1 to `steps`, mark the tile `visited`, and reveal around the new position. [FR-MOV-6]

### Requirement 7: Soul shards

**User story:** As a player, I want my other big days to matter, so that I explore the graph instead of walking straight to the boss.

#### Acceptance criteria

7.1 WHEN a tier 3 or tier 4 monster is banished while `shards < shardsNeeded` THE SYSTEM SHALL add 1 shard and log "Soul shard {n}/{need} collected.", or "Soul shard {n}/{need}. The Phantom's ward shatters!" when `n` reaches `need`. [FR-MOV-7]

7.2 WHEN `shardsNeeded` is 0 THE SYSTEM SHALL leave the boss unwarded from the start. [FR-MOV-7, P10]

7.3 WHEN the HUD asks for shard status THE SYSTEM SHALL provide `{ have: shards, need: shardsNeeded }`. [FR-MOV-7]
