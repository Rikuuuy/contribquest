# Tasks: map-generation

Build order: task 1 first (data-import task 7 needs `rng.ts`). Tasks 2–5 need data-import task 1.2 (`ContributionDay`, `ContributionSet`). Task 6 needs `RunState` from combat-timing task 1.2. Task 7.2 needs `newRun` from the progression spec. Each task ends with its verify command passing and a commit naming the requirement IDs.

- [ ] 1. Hash, RNG, and dates
  - [ ] 1.1 Implement `fnv1a`, `makeRng`, `nextFloat`, `shuffleInPlace` in `src/mapgen/rng.ts`, ported from the prototype
    - _Requirements: 1.1, 1.2 (FR-MAP-3)_
  - [ ] 1.2 Implement the UTC helpers in `src/mapgen/dates.ts` (`parseDate`, `weekday`, `addDays`, `fmtDate`, `fmtShort`)
    - _Requirements: 2.1, 2.4 (FR-MAP-1, FR-MAP-2)_
  - [ ] 1.3 Write `tests/mapgen/rng.test.ts` (hash and draw values computed from the prototype, Fisher-Yates order) and `tests/mapgen/dates.test.ts` (weekday of known dates, `fmtDate("2026-11-03") === "Tue 3 Nov 2026"`, month and year rollover in `addDays`)
    - _Requirements: 1.1, 1.2_
    - _Verify: `npx vitest --run tests/mapgen/rng.test.ts tests/mapgen/dates.test.ts`_

- [ ] 2. Types, rules, and layout
  - [ ] 2.1 Create `src/mapgen/types.ts` and `src/mapgen/rules.ts`; re-export the rule constants from `src/engine/balance.ts` and list them in `game-rules.md` if any is missing
    - _Requirements: 3.1, 3.4, 3.5 (FR-MAP-3, FR-MOV-7)_
    - _Verify: `npm run typecheck`_
  - [ ] 2.2 Implement `layoutDays`, `tileAt`, `neighbours` in `src/mapgen/layout.ts`
    - _Requirements: 2.1, 2.2, 2.3 (FR-MAP-2)_
  - [ ] 2.3 Write `tests/mapgen/layout.test.ts`: last date on a Saturday gives 13 columns and no void cells; on a Sunday gives 14; void only at the top of column 0 and the bottom of the last column; `tileAt` outside the grid is null
    - _Requirements: 2.1, 2.2, 2.3_
    - _Verify: `npx vitest --run tests/mapgen/layout.test.ts`_

- [ ] 3. Tile assignment and shortfall
  - [ ] 3.1 Implement `bestDayIndex` and `assignTiles` in `src/mapgen/assign.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.6 (FR-MAP-3, FR-MAP-4)_
  - [ ] 3.2 Write `tests/mapgen/assign.test.ts`: each rule row, chest vs monster by `fnv1a(date) % 3`, deco by `% 6`, best day on index 0, best day on index 90 (gate + boss), ties to the latest, all-empty → index 45 and `emptyQuarter`
    - _Requirements: 3.1, 3.2, 3.3_
    - _Verify: `npx vitest --run tests/mapgen/assign.test.ts`_
  - [ ] 3.3 Implement `applyShortfall` in `src/mapgen/shortfall.ts` (map RNG `seed ^ 0x9e3779b9`, Fisher-Yates over fog, pop from the end, tier-1 `risen` monsters, `quiet`)
    - _Requirements: 3.4 (FR-MAP-3)_
  - [ ] 3.4 Write `tests/mapgen/shortfall.test.ts`: a quiet profile reaches exactly 6 monsters with `risen` and no deco; a profile without enough fog stops when the pool is empty; a busy profile is untouched and not quiet
    - _Requirements: 3.4_
    - _Verify: `npx vitest --run tests/mapgen/shortfall.test.ts`_

- [ ] 4. Validation and the public entry
  - [ ] 4.1 Implement `reachable` and `validateMap` in `src/mapgen/validate.ts`, and `generateMap` and `mapDateRange` in `src/mapgen/generate.ts` (seed, shards needed, `Result` return); add `src/mapgen/index.ts`
    - _Requirements: 1.3, 2.4, 3.5, 3.7, 4.1, 4.2 (FR-MAP-1, FR-MAP-3, FR-MAP-4, FR-MOV-7)_
  - [ ] 4.2 Write `tests/mapgen/validate.test.ts`: hand-built maps missing a start, with no route, and with a duplicate date each return their message; `generateMap` never throws
    - _Requirements: 4.1, 4.2_
    - _Verify: `npx vitest --run tests/mapgen/validate.test.ts`_

- [ ] 5. Parity and property tests
  - [ ] 5.1 Record `tests/fixtures/golden/demo-map.json` by evaluating the prototype's utilities-to-map script section in a Node `vm` context and calling `generateMap(makeDemoSet())` (tiles without `grid`); write `tests/mapgen/golden.test.ts` comparing the port's demo map to it, plus the summary facts (14 cols, seed 722674249, boss index 77, 3 shards, not quiet, the tile counts in design.md)
    - _Requirements: 1.3, 1.4, 3.1–3.5 (FR-MAP-3)_
    - _Verify: `npx vitest --run tests/mapgen/golden.test.ts`_
  - [ ] 5.2 Add `tests/arbitraries.ts` (fast-check ContributionSet arbitrary with valid usernames, any last date, 91 consecutive days, plus all-zero and dense variants) and `tests/mapgen/map.prop.test.ts` for P1, P2, P3, P4, P5, P10
    - _Requirements: 1.4, 2.2, 3.2, 3.4, 3.5, 4.1 (FR-MAP-2, FR-MAP-3, FR-MAP-4, FR-MOV-7, P1, P2, P3, P4, P5, P10)_
    - _Verify: `npx vitest --run tests/mapgen/map.prop.test.ts`_
  - [ ] 5.3 Run every fixture profile from `tests/fixtures/profiles.ts` through `generateMap` and assert `ok: true`
    - _Requirements: 4.1 (FR-MAP-4)_
    - _Verify: `npx vitest --run tests/mapgen`_

- [ ] 6. Exploration rules (needs `RunState` from combat-timing task 1.2)
  - [ ] 6.1 Implement `revealRadiusSq`, `reveal`, `isVisible`, `checkMove`, `applyMove` in `src/engine/explore.ts`; add `REVEAL_R2 = 5` and `REVEAL_R2_REVIEW = 8` to `balance.ts`
    - _Requirements: 5.1, 5.2, 6.1–6.5 (FR-MOV-3, FR-MOV-6, FR-MOV-7)_
  - [ ] 6.2 Implement `collectShard` and `shardStatus` in `src/engine/explore.ts`
    - _Requirements: 7.1, 7.2, 7.3 (FR-MOV-7)_
  - [ ] 6.3 Write `tests/engine/explore.test.ts`: reveal at radius 5 and 8 (count of tiles from a known position), start/gate/boss always visible, sealed and warded messages, refused move leaves state unchanged, successful move updates `prev`, `steps`, `visited`; shard log lines, `shattered`, no shard past the need or from tiers 1, 2, 5
    - _Requirements: 5.1, 5.2, 6.1–6.5, 7.1–7.3_
    - _Verify: `npx vitest --run tests/engine/explore.test.ts`_

- [ ] 7. Map independence (P18)
  - [ ] 7.1 Add a type-level check in `tests/mapgen/map.prop.test.ts` that `generateMap` has exactly one parameter of type `ContributionSet` (`expectTypeOf(generateMap).parameters.toEqualTypeOf<[ContributionSet]>()`)
    - _Requirements: 3.7 (FR-CLS-1, FR-RACE-1, P18)_
    - _Verify: `npx vitest --run tests/mapgen/map.prop.test.ts`_
  - [ ] 7.2 Write `tests/engine/map-independence.prop.test.ts`: for any set and any class and race, `newRun(...).map` deep-equals `generateMap(set).value` (needs `newRun` from the progression spec)
    - _Requirements: 3.7 (P18)_
    - _Verify: `npx vitest --run tests/engine/map-independence.prop.test.ts`_

- [ ] 8. Module check
  - [ ] 8.1 Run the mapgen and explore suites and the type check; confirm `src/mapgen` imports nothing from `src/engine`, `src/render`, `src/audio`, or storage/fetch code in `src/data`
    - _Requirements: all (FR-MAP-1 to FR-MAP-4, FR-MOV-6, FR-MOV-7)_
    - _Verify: `npm run typecheck && npx vitest --run tests/mapgen tests/engine/explore.test.ts && ! grep -rE "from ['\"]\.\./(engine|render|audio)|data/(fetch|load|cache|storage|settings)" src/mapgen`_
