# Tasks: progression

Groups 1–3 are Phase 1 (a headless run must reach the end). Groups 4–9 and 11 are Phase 2 (hero systems and the simulator). Group 8's trophies are Phase 4 in the timeline but small; build them when group 7 is done if time allows. Groups need data-import tasks 1.2 and 4.1, map-generation tasks 1–6, and combat-timing groups 1–2; group 3 is used by combat-timing task 7.3. Each task ends with its verify command passing and a commit naming the requirement IDs. A constant added to `balance.ts` is added to `game-rules.md` in the same commit.

- [ ] 1. XP, aura, and trait
  - [ ] 1.1 Add the progression constants from design.md to `src/engine/balance.ts`, and implement `xpForLevel`, `levelFor`, `startingXp`, `auraTier` in `src/engine/progression.ts`
    - _Requirements: 2.1, 2.4, 3.1 (FR-PRO-1, FR-PRO-2)_
  - [ ] 1.2 Implement `makeTrait` in `src/engine/trait.ts` using `weekday` from `src/mapgen/dates.ts`
    - _Requirements: 3.2, 3.3, 3.4 (Weekday trait)_
  - [ ] 1.3 Write `tests/engine/progression.test.ts` (table, cap, PRD examples, aura) and `tests/engine/trait.test.ts`
    - _Requirements: 2.1, 3.1–3.4 (FR-PRO-2)_
    - _Verify: `npx vitest --run tests/engine/progression.test.ts tests/engine/trait.test.ts tests/engine/balance.test.ts`_
  - [ ] 1.4 Write `tests/engine/progression.prop.test.ts` for P6 and P11
    - _Requirements: 1.2, 3.1–3.4 (PRD Story 4, P6, P11)_
    - _Verify: `npx vitest --run tests/engine/progression.prop.test.ts`_

- [ ] 2. Starting a run
  - [ ] 2.1 Add `relicOffer`, `relicTitle`, `pendingBlessing`, `newTrophies`, the new actions, and the new events to `src/engine/state.ts`
    - _Requirements: 6.1, 7.1, 9.4 (FR-REL-1, FR-OMEN-1, FR-TRO-2)_
    - _Verify: `npm run typecheck`_
  - [ ] 2.2 Implement `makeHero`, `newRun`, and `omenFor` (`src/engine/run.ts`, `src/engine/omen.ts`) with the opening log lines
    - _Requirements: 1.1–1.5, 7.1, 7.3 (FR-PRO-1, FR-CLS-1, FR-RACE-1, FR-OMEN-1, FR-OMEN-3, FR-MAP-4)_
  - [ ] 2.3 Write `tests/engine/run.test.ts`; then enable `tests/engine/map-independence.prop.test.ts` (P18, map-generation spec) now that `newRun` exists
    - _Requirements: 1.1–1.5, 7.1, 7.3 (P18)_
    - _Verify: `npx vitest --run tests/engine/run.test.ts tests/engine/map-independence.prop.test.ts`_

- [ ] 3. Wisps, chests, and XP gain
  - [ ] 3.1 Implement `gainXp`, `collectWisp`, `openChest` in `src/engine/progression.ts` (`openChest` calls `offerRelic`; until group 4 exists, a stub that does nothing keeps the order testable)
    - _Requirements: 2.2, 2.3, 4.1, 4.2 (FR-PRO-1, FR-PRO-2, FR-RACE-2)_
  - [ ] 3.2 Extend `tests/engine/progression.test.ts`: Human rounding, level-up heal and log, two thresholds in one gain, wisp and chest logs, chest heal before XP, `levelUp`, `wisp`, `chest`, and `xp` events
    - _Requirements: 2.2, 2.3, 4.1, 4.2_
    - _Verify: `npx vitest --run tests/engine/progression.test.ts`_

- [ ] 4. Relics
  - [ ] 4.1 Implement `RELICS`, `relicById`, `offerRelic`, `pickRelic` in `src/engine/relics.ts`; replace the stub in `openChest`
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6 (FR-REL-1, FR-REL-4)_
  - [ ] 4.2 Handle `pickRelic` in `step`, and ignore every other gameplay action while `status === "relic"`
    - _Requirements: 6.3 (FR-REL-1)_
  - [ ] 4.3 Write `tests/engine/relics.test.ts`
    - _Requirements: 6.1–6.6_
    - _Verify: `npx vitest --run tests/engine/relics.test.ts`_
  - [ ] 4.4 Write `tests/engine/relics.prop.test.ts` for P17 and the v1.4 relic monotonicity property (uses combat-timing's `resolveStrike` and `resolveGuard` with a fixed RNG)
    - _Requirements: 6.1, 6.2, 6.6 (FR-REL-1, FR-REL-2, FR-REL-3, P17)_
    - _Verify: `npx vitest --run tests/engine/relics.prop.test.ts`_

- [ ] 5. Races
  - [ ] 5.1 Implement `RACE_INFO` (names, texts, lines, and the face colours and flags from the prototype's `RACES`) and `chooseRace` in `src/engine/races.ts`; handle `chooseRace` in `step`
    - _Requirements: 5.1–5.4 (FR-RACE-1, FR-RACE-2, FR-RACE-4)_
  - [ ] 5.2 Write `tests/engine/races.test.ts`
    - _Requirements: 5.1–5.4_
    - _Verify: `npx vitest --run tests/engine/races.test.ts`_

- [ ] 6. Daily omen
  - [ ] 6.1 Implement `enterMap`, `offerBlessing`, `BLESSING_TITLE` in `src/engine/omen.ts`; handle both actions in `step`
    - _Requirements: 7.2, 7.4 (FR-OMEN-2, FR-OMEN-3)_
  - [ ] 6.2 Write `tests/engine/omen.test.ts`
    - _Requirements: 7.1–7.4_
    - _Verify: `npx vitest --run tests/engine/omen.test.ts`_

- [ ] 7. Save, restore, and continue
  - [ ] 7.1 Add `TrophyHaveSchema` and `ClassWinsSchema` to `src/data/schema.ts`, and implement `src/data/runstore.ts`; write `tests/data/runstore.test.ts`
    - _Requirements: 9.2, 9.3, 10.1, 11.2 (FR-SAV-1, FR-SAV-3, FR-TRO-1)_
    - _Verify: `npx vitest --run tests/data/runstore.test.ts`_
  - [ ] 7.2 Implement `SavedRunSchema`, `serialize`, `restore`, `continueLabel` in `src/engine/save.ts`
    - _Requirements: 10.2–10.5 (FR-SAV-1, FR-COM-7)_
  - [ ] 7.3 Write `tests/engine/save.test.ts`, including a save captured from the prototype (`localStorage["cq:v1:run"]` after a few demo moves, stored in `tests/fixtures/prototype-save.json`) that must be rejected
    - _Requirements: 10.2–10.5_
    - _Verify: `npx vitest --run tests/engine/save.test.ts`_
  - [ ] 7.4 Write `tests/engine/save.prop.test.ts` for P8 and P19 with the action-sequence arbitrary
    - _Requirements: 10.2, 10.4 (FR-SAV-1, FR-REL-4, P8, P19)_
    - _Verify: `npx vitest --run tests/engine/save.prop.test.ts`_

- [ ] 8. End of a run and trophies
  - [ ] 8.1 Implement `endRun` in `src/engine/run.ts` and hand it to combat-timing's `winFight`, Gate entry, and `loseFight`
    - _Requirements: 8.1 (FR-PRO-3, FR-COM-4)_
  - [ ] 8.2 Implement `TROPHIES`, `trophyFacts`, `awardTrophies`, `trophyList`, `startTrophyLine` in `src/engine/trophies.ts`; handle `trophiesAwarded` in `step` (v1.6: Speedrun uses `defeated ≤ TROPHY_SPEED_FIGHTS`, requirement 9.3; `TrophyFacts` includes `defeated`)
    - _Requirements: 9.1–9.6 (FR-TRO-1, FR-TRO-2, FR-TRO-3)_
  - [ ] 8.3 Write `tests/engine/trophies.test.ts`
    - _Requirements: 8.1, 9.1–9.6_
    - _Verify: `npx vitest --run tests/engine/trophies.test.ts`_

- [ ] 9. Summary and results facts
  - [ ] 9.1 Implement `summaryView` and `resultsView` in `src/engine/views.ts` (normal runs; the social spec adds raid branches)
    - _Requirements: 8.2–8.5, 13.1–13.4 (FR-PRO-4, FR-IMP-4, FR-OMEN-3, FR-PRO-2, FR-REL-4)_
  - [ ] 9.2 Write `tests/engine/views.test.ts`
    - _Requirements: 8.2–8.5, 13.1–13.4_
    - _Verify: `npx vitest --run tests/engine/views.test.ts`_

- [ ] 10. Wiring in `main.ts` (with the presentation spec's screens)
  - [ ] 10.1 Save after every non-input action; restore on boot and show "Continue …"; `runEnded` → trophies → `trophiesAwarded`; `blessingDue` → `offerBlessing` after the delay; `raceChosen` → save `heroRace`
    - _Requirements: 7.2, 9.2–9.4, 10.1, 10.5 (FR-SAV-1, FR-TRO-1, FR-OMEN-2, FR-RACE-1)_
  - [ ] 10.2 "Play this graph again", "New username", and "Different username" buttons
    - _Requirements: 11.1, 11.2 (FR-SAV-3, FR-COM-4)_
  - [ ] 10.3 Add `tests/privacy.test.ts`: every `https://` URL in `src/` is `API_BASE` or `https://github.com/`, and `src/` has no `document.cookie`, `sendBeacon`, or analytics import
    - _Requirements: 12.1, 12.2 (FR-SAV-2)_
    - _Verify: `npm run build && npx vitest --run tests/privacy.test.ts`_

- [ ] 11. Balance simulator
  - [ ] 11.1 Implement `routeAction` in `src/engine/routebot.ts` and write `tests/engine/routebot.test.ts`
    - _Requirements: 14.2 (FR-PRO-1, FR-PRO-3)_
    - _Verify: `npx vitest --run tests/engine/routebot.test.ts`_
  - [ ] 11.2 Write `scripts/simulate.ts` (graphs, cells, 200 seeds, report, exit code, `--seeds` and `--cell` flags) and the `simulate` npm script
    - _Requirements: 14.1, 14.3 (FR-DIF-1)_
    - _Verify: `npm run simulate -- --seeds 5`_
  - [ ] 11.3 Write `tests/sim/regression.test.ts` for the Wanderer grade policies and print the demo route's steps and fights
    - _Requirements: 14.4 (FR-COM-5, FR-PRO-1)_
    - _Verify: `npx vitest --run tests/sim/regression.test.ts`_
  - [ ] 11.4 Run the full simulator, record the table in `docs/kiro-journal.md`, and hand any missed target to the `balance-tuner` agent (changes go to `balance.ts` and `game-rules.md` only)
    - _Requirements: 14.3 (FR-DIF-1)_
    - _Verify: `npm run simulate`_
    - _Superseded in v1.6 by task 13.8: the v1.5 run was recorded on 27 Nov 2026 (two misses), and the targets are re-measured on the v1.6 rules instead of tuning the v1.5 ones._

- [ ] 12. Module check
  - [ ] 12.1 Run the engine and data suites and the type check; confirm the progression files obey the engine rules
    - _Requirements: all (FR-PRO-1 to FR-PRO-4, FR-SAV-1 to FR-SAV-3, FR-RACE-1, FR-RACE-2, FR-RACE-4, FR-REL-1 to FR-REL-4, FR-OMEN-1 to FR-OMEN-3, FR-TRO-1 to FR-TRO-3)_
    - _Verify: `npm run typecheck && npx vitest --run tests/engine tests/data tests/sim && ! grep -rnE "Math\.random|Date\.now|performance\.now|document\.|window\.|localStorage" src/engine`_

## v1.6: routes, rests, and the v2 save

Groups 1–12 are the v1.5 port and stay as history. Group 13 applies the v1.6 rules (PRD v1.6). It needs map-generation group 9 and is built together with map-generation group 10 and combat-timing group 11 (task 13.1 provides `restDay` for combat-timing task 11.3). Task 12.1 (still todo) is the module check after this group. A constant added to `balance.ts` is added to `game-rules.md` in the same commit (game-rules.md already lists the v1.6 values).

- [ ] 13. Routes, rests, relic texts, save v2, and the route bot (v1.6)
  - [ ] 13.1 Add `REST_HEAL = 0.05`, `WISP_HEAL = 0.1`, `TROPHY_SPEED_FIGHTS = 6`, and `SIM.bossWeeks = 2` to `balance.ts` with assertions in `tests/engine/balance.test.ts`; implement `restDay` and the wisp heal in `src/engine/progression.ts` with the `rest` event and the new `wisp` event field; extend `tests/engine/progression.test.ts`
    - _Requirements: 4.1, 4.3, 9.3, 14.2 (FR-PRO-1, FR-MOV-3)_
    - _Verify: `npx vitest --run tests/engine/progression.test.ts tests/engine/balance.test.ts`_
  - [ ] 13.2 Change the Code Review and CI Cache texts in `RELICS`, and make `pickRelic` call the column-window `reveal` for Code Review; extend `tests/engine/relics.test.ts` and keep `tests/engine/relics.prop.test.ts` (P17, relic monotonicity with the CI Cache heal) green
    - _Requirements: 6.4, 6.5 (FR-REL-1, FR-REL-4)_
    - _Verify: `npx vitest --run tests/engine/relics.test.ts tests/engine/relics.prop.test.ts`_
  - [ ] 13.3 Update `newRun` (`version: 2`, start resolved, column window, the always-shown shard log line) and `tests/engine/run.test.ts`; keep P18 green
    - _Requirements: 1.3, 1.4 (FR-PRO-1, FR-MOV-6, FR-MOV-7, P18)_
    - _Verify: `npx vitest --run tests/engine/run.test.ts tests/engine/map-independence.prop.test.ts`_
  - [ ] 13.4 Move the save to v2: `RUN_KEY = "cq:v2:run"` in `src/data/constants.ts`, the v1.6 `SavedRunSchema` and the `pos` check in `restore` (`src/engine/save.ts`), `runstore.ts` never touching `cq:v1:run`; update `tests/data/runstore.test.ts`, `tests/engine/save.test.ts` (v1.5 saves rejected, bad `pos` rejected), and `tests/engine/save.prop.test.ts` (P8, P19 on v1.6 states)
    - _Requirements: 10.1–10.4, 10.6, 11.2 (FR-SAV-1, FR-SAV-3, P8, P19)_
    - _Verify: `npx vitest --run tests/data/runstore.test.ts tests/engine/save.test.ts tests/engine/save.prop.test.ts && ! grep -rn "cq:v1:run" src`_
  - [ ] 13.5 Change the won title in `resultsView` and update `tests/engine/views.test.ts`
    - _Requirements: 8.2 (FR-PRO-4)_
    - _Verify: `npx vitest --run tests/engine/views.test.ts`_
  - [ ] 13.6 Rewrite `routeAction` and add `rankOption` in `src/engine/routebot.ts` (legal moves, heal mode, tier order, `SIM` constants, seen check), update `playRun` for the new `move` action, and rewrite `tests/engine/routebot.test.ts`
    - _Requirements: 14.1, 14.2 (FR-PRO-1, FR-PRO-3, FR-MOV-8)_
    - _Verify: `npx vitest --run tests/engine/routebot.test.ts`_
  - [ ] 13.7 Add the average fights and shards columns to `scripts/simulate.ts`, and change `tests/sim/regression.test.ts` to print fights, shards, and steps for the demo route instead of checking the 15–25 steps target
    - _Requirements: 14.3, 14.4 (FR-DIF-1, FR-COM-5)_
    - _Verify: `npx vitest --run tests/sim/regression.test.ts && npm run simulate -- --seeds 5 | grep -qi "fights"`_
  - [ ] 13.8 Re-measure on the v1.6 rules: run the full simulator and the grade-policy regression, record both tables in `docs/kiro-journal.md`, and hand any missed target to the `balance-tuner` agent, which may change only the v1.6 tunables (`REST_HEAL`, `WISP_HEAL`, `SHARD_BOSS_HP_CUT`, `RELIC_COMBAT.cacheHeal`, `TROPHY_SPEED_FIGHTS`) in `balance.ts` and `game-rules.md`; `DIFFICULTY` stays unchanged
    - _Requirements: 14.3, 14.5 (FR-DIF-1)_
    - _Verify: `npm run simulate && ! git diff main -- src/engine/balance.ts | grep -q "pMul:"` (targets met, and no `DIFFICULTY` line changed)_
