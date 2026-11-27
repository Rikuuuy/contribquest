# Tasks: combat-timing

This is the largest spec, split into ordered groups that can each be built and tested on their own. Groups 1–8 are Phase 1 (core rules); group 9 is Phase 2 (hero systems); groups 11–12 (at the end) apply the v1.6 rules. Groups need data-import task 1.2 and map-generation tasks 1–4; group 7 also needs map-generation task 6. Each task ends with its verify command passing and a commit naming the requirement IDs. A constant added to `balance.ts` is added to `game-rules.md` in the same commit.

- [ ] 1. Constants, types, and test fixtures
  - [ ] 1.1 Add the combat constants to `src/engine/balance.ts`: `QTE` (perfect 70, good 170, auraPerfect 10, calm 1.6, grace 120, counter 0.5, dmgScale 1.25), `ATK_MULT`, `DEF_MULT`, class stat numbers, `DIFFICULTY`, monster formula numbers, pattern numbers (quick 640, flaky 320/220/0.4/0.25, conflict 300/120/1.6, plan chance 0.65, imp ×0.6), phase-2 numbers (speed 0.85, pressure 0.9, damage 0.75), combo cap 120, sidestep ×1.2, charge 0.82 / 2600 / +20, deadline +30, shield +10, assist charge 300, and the relic/race combat numbers (Linter 25, Elf 15, Force 1.25, Pair 1.6, Hotfix 0.06, Vampire 2, trait +2)
    - _Requirements: 4.1, 6.1, 6.2, 8.1, 9.1, 10.1, 11.1–11.3, 13.1, 13.3, 14.2 (FR-CLS-2 to FR-CLS-8, FR-DIF-1)_
  - [ ] 1.2 Create `src/engine/state.ts` (types in design.md) and `src/engine/rand.ts`
    - _Requirements: 20.1 (FR-COM-5)_
  - [ ] 1.3 Write `tests/engine/balance.test.ts`, which parses the tables in `.kiro/steering/game-rules.md` and checks every value against `balance.ts`
    - _Requirements: 4.1 (FR-DIF-1)_
    - _Verify: `npm run typecheck && npx vitest --run tests/engine/balance.test.ts`_
  - [ ] 1.4 Add `tests/fixtures/run.ts` with `makeTestRun(options)` (fixture set → `generateMap`, hand-built hero, chosen class, race, relics, level, aura, options)
    - _Requirements: 20.1_
    - _Verify: `npm run typecheck`_

- [ ] 2. Classes, difficulty, and pressure
  - [ ] 2.1 Implement `src/engine/classes.ts` (`CLASS_INFO` with the prototype's names, modes, `slow`, and `CLASS_HINT` text; `heroClass`; `applyStats`) and `src/engine/mods.ts` (`modsOf`)
    - _Requirements: 3.1, 3.3, 3.4, 3.5 (FR-CLS-1, FR-CLS-2, FR-CLS-9)_
  - [ ] 2.2 Implement `src/engine/difficulty.ts` (`classDiff`, `pressure`, `timingPercent`, `classCardLine`)
    - _Requirements: 4.1, 4.3, 5.1, 6.3 (FR-DIF-1, FR-DIF-3, FR-DIF-4, FR-DIF-5)_
  - [ ] 2.3 Write `tests/engine/classes.test.ts` and `tests/engine/difficulty.test.ts`: stats per class with Cold Brew, Stack Overflow, Orc; HP clamp; pressure at 0, 5, and 50 kills per class; phase-2 ×0.9; `timingPercent` and `maxed`; card lines for all four classes
    - _Requirements: 3.3, 3.4, 4.3, 5.1, 6.3_
    - _Verify: `npx vitest --run tests/engine/classes.test.ts tests/engine/difficulty.test.ts`_

- [ ] 3. Monsters
  - [ ] 3.1 Implement `src/engine/monsters.ts` (`TIER_NAMES`, `makeMonster`, `sourceLabel`, `fightTreasure`), using `fmtDate` from `src/mapgen/dates.ts`
    - _Requirements: 2.1–2.4, 4.2 (FR-COM-2, FR-COM-3, FR-DIF-2, FR-OMEN-2)_
  - [ ] 3.2 Write `tests/engine/monsters.test.ts`: the PRD worked example at start level 3 (Imp 24 HP, Lich 41 HP, boss 69 HP), damage with curse and each class `dmg`, XP, names, all three source labels, singular "contribution", treasure per class
    - _Requirements: 2.1–2.4, 4.2_
    - _Verify: `npx vitest --run tests/engine/monsters.test.ts`_

- [ ] 4. Timing tests: creation
  - [ ] 4.1 Implement `windows` and `createTest` in `src/engine/qte.ts` for all six modes and four patterns, drawing from `rand` in the order listed in design.md
    - _Requirements: 6.1, 6.2, 8.1, 9.1, 10.1, 11.1–11.3, 12.1, 19.1 (FR-CLS-3 to FR-CLS-8, FR-COM-7)_
  - [ ] 4.2 Write the creation part of `tests/engine/qte.test.ts`: windows for a known hero (aura, Linter, Elf, calm, each class, pressure 1 and 0.6); durations, targets, marks, fill, pause, and decoy for fixed draws; draw counts per mode and pattern
    - _Requirements: 6.1, 6.2, 8.1, 9.1, 10.1, 11.1–11.3, 12.1_
    - _Verify: `npx vitest --run tests/engine/qte.test.ts`_

- [ ] 5. Timing tests: grading
  - [ ] 5.1 Implement `grade` and `testDeadline` for bar, ring, and sidestep (single press, grace, early/late reasons, `dur + 30`)
    - _Requirements: 7.1–7.3, 8.2, 11.4 (FR-COM-5, FR-CLS-4, FR-CLS-7)_
  - [ ] 5.2 Add combo grading (skipped marks, three presses, `dur + 30`, "too late" when all miss)
    - _Requirements: 9.2, 9.3 (FR-CLS-5)_
  - [ ] 5.3 Add charge grading (first press, matching release, too slow at `dur`, too weak, overload on release and at `downAt + fill + 20`)
    - _Requirements: 7.4, 10.2–10.4 (FR-CLS-6, FR-CLS-9)_
  - [ ] 5.4 Add shield grading (hold state, early release, impact at target, late parry within P, miss at `target + P + 10` with both reasons)
    - _Requirements: 7.4, 12.2–12.4 (FR-CLS-8, FR-CLS-9)_
  - [ ] 5.5 Add assist (Good at target, charge at 300 ms, events ignored) and `gradeText` with `GRADE_LABELS` and the combo text
    - _Requirements: 7.5, 9.4, 19.2 (FR-COM-5, FR-COM-7, FR-CLS-5, FR-CLS-9)_
  - [ ] 5.6 Complete `tests/engine/qte.test.ts` with one case per row of the grading table in design.md, the release-from-another-key case, and every label
    - _Requirements: 7.1–7.5, 8.2, 9.2–9.4, 10.2–10.4, 11.4, 12.2–12.4, 19.2_
    - _Verify: `npx vitest --run tests/engine/qte.test.ts`_
  - [ ] 5.7 Write `tests/engine/qte.prop.test.ts` for P12, P15 (scoped as in design.md), and P16, plus the v1.4 properties: the flaky target equals base plus pause, and the decoy never lies within G of the target
    - _Requirements: 6.1, 6.2, 7.3, 11.2, 11.3, 19.1 (FR-COM-5, FR-CLS-3 to FR-CLS-8, FR-DIF-1, P12, P15, P16)_
    - _Verify: `npx vitest --run tests/engine/qte.prop.test.ts`_

- [ ] 6. Patterns and boss phase 2
  - [ ] 6.1 Implement `src/engine/patterns.ts` (`strikePlan`, `patternDamageMult`, `checkPhase2`, `STRIKE_LINE`)
    - _Requirements: 13.1–13.3, 14.1, 14.2 (FR-CLS-7, FR-COM-2, FR-COM-5)_
  - [ ] 6.2 Write `tests/engine/patterns.test.ts`: plans per tier with fixed draws (0.64 and 0.65 at the threshold), imp and phase-2 multipliers, phase 2 triggers once, at exactly half HP, and not when the hit kills
    - _Requirements: 13.1–13.3, 14.1, 14.2_
    - _Verify: `npx vitest --run tests/engine/patterns.test.ts`_

- [ ] 7. Fight resolution and the reducer
  - [ ] 7.1 Implement `startFight`, `resolveStrike`, `resolveGuard`, and `applyDuck` in `src/engine/combat.ts`, with the prototype's log lines
    - _Requirements: 1.1, 1.3, 2.5, 15.1–15.6 (FR-COM-1, FR-COM-3, FR-COM-5, FR-REL-2, FR-REL-3, FR-RACE-2)_
  - [ ] 7.2 Implement `resolveFlee`, `winFight` (treasure, XP through `gainXp`, pressure message with "before" read first, shard through `collectShard`, boss and Gate), and `loseFight`
    - _Requirements: 5.3, 16.1, 16.2, 17.1–17.4 (FR-COM-1, FR-COM-4, FR-DIF-4, FR-PRO-3)_
  - [ ] 7.3 Implement `step` and `nextDeadline` in `src/engine/step.ts`: `move` (via `checkMove`/`applyMove`, then monster, boss, and Gate entry), `chooseClass`, `setOptions`, `attack`, `flee`, `press`, `release`, `timeout`, `advance`, `forceGrade`; deep-clone the input first
    - _Requirements: 1.2, 1.4, 3.2, 17.3, 19.3, 20.1–20.4 (FR-COM-1, FR-COM-5, FR-COM-7, FR-CLS-1)_
  - [ ] 7.4 Write `tests/engine/combat.test.ts`: damage with fixed RNG for each strike and guard mode, trait bonus on strikes only, every combat relic and race effect, flee HP floor and return to `prev`, win and loss bookkeeping, pressure log on non-boss kills only
    - _Requirements: 5.3, 15.1–15.6, 16.1, 16.2, 17.1–17.4_
    - _Verify: `npx vitest --run tests/engine/combat.test.ts`_
  - [ ] 7.5 Write `tests/engine/step.test.ts`: input never mutated (deep-frozen), same actions → same states, `nextDeadline` per mode, a scripted fight to a win and to a loss, a boss fight through phase 2, `forceGrade` with Rubber Duck, a restored test resumes at `choose`, class change refused after a step
    - _Requirements: 1.1–1.4, 3.2, 14.2, 19.3, 20.1–20.5_
    - _Verify: `npx vitest --run tests/engine/step.test.ts`_
  - [ ] 7.6 Write `tests/engine/combat.prop.test.ts` for P7, P13, and P14 (P14 scoped to `floor × 0.9` in phase 2, as in design.md)
    - _Requirements: 2.1, 5.1, 15.1, 15.3, 15.4 (FR-COM-2, FR-COM-5, FR-DIF-3, P7, P13, P14)_
    - _Verify: `npx vitest --run tests/engine/combat.prop.test.ts`_
  - [ ] 7.7 Record `tests/fixtures/golden/demo-fight.json` from the prototype in a browser (`window.__cq.setGrade`, `forcePlan`, `teleport` on the demo run, Wanderer) and write `tests/engine/rng-order.test.ts` checking the port's RNG state and HP values after each action
    - _Requirements: 20.5 (FR-COM-5, FR-MAP-3)_
    - _Verify: `npx vitest --run tests/engine/rng-order.test.ts`_

- [ ] 8. Input mapping and wiring
  - [ ] 8.1 Implement `combatKey` in `src/engine/input.ts` (Space, Enter, A, J, K → `hit`; F, Escape → `flee`) and test it in `tests/engine/input.test.ts`
    - _Requirements: 18.1, 18.2 (FR-COM-6, FR-CLS-9)_
    - _Verify: `npx vitest --run tests/engine/input.test.ts`_
  - [ ] 8.2 In `src/main.ts`, record `testStart` on each new `testId`, send `press`/`release` with `event.timeStamp − testStart` and the key or `"pointer"` id, skip `event.repeat`, and schedule `timeout` from `nextDeadline`
    - _Requirements: 18.1, 18.3, 20.2 (FR-COM-6)_
    - _Verify: `npm run build`_

- [ ] 9. Skill bot and retry (Phase 2)
  - [ ] 9.1 Implement `makeSkillBot` and `skillGrade` in `src/engine/skillbot.ts`, ported from `simulateGrade` and `gauss`
    - _Requirements: 21.1, 21.2 (FR-DIF-1)_
  - [ ] 9.2 Write `tests/engine/skillbot.test.ts`: seeding, combo gives three grades, charge overload limit, conflict and flaky miss rates within ±2 points of `σ/600` and `σ/700` over 10 000 draws, shield rescue near 0.7
    - _Requirements: 21.1, 21.2_
    - _Verify: `npx vitest --run tests/engine/skillbot.test.ts`_
  - [ ] 9.3 Add the `retry` action (needs `newRun` from the progression spec): a lost run restarts on the same `set` and `heroSet` with no fetch; test it in `tests/engine/step.test.ts`
    - _Requirements: 17.5 (FR-COM-4)_
    - _Verify: `npx vitest --run tests/engine/step.test.ts`_

- [ ] 10. Module check
  - [ ] 10.1 Run the engine suite and the type check; confirm `src/engine` has no `Math.random`, `Date.now`, `performance.now`, `document`, `window`, or `localStorage`, and imports nothing from `src/render`, `src/audio`, or `src/main.ts`
    - _Requirements: 20.1 (all of FR-COM-1 to FR-COM-7, FR-CLS-1 to FR-CLS-9, FR-DIF-1 to FR-DIF-5)_
    - _Verify: `npm run typecheck && npx vitest --run tests/engine && ! grep -rnE "Math\.random|Date\.now|performance\.now|document\.|window\.|localStorage|from ['\"]\.\./(render|audio|main)" src/engine`_

## v1.6: no Flee, boss node, unskippable tiles

Groups 1–10 built the v1.5 rules and stay as history. Groups 11–12 change them to the v1.6 rules (PRD v1.6). They need map-generation group 9 and are built together with map-generation group 10 and progression group 13. A constant added to `balance.ts` is added to `game-rules.md` in the same commit (game-rules.md already lists the v1.6 values).

- [ ] 11. Routes, no Flee, and the boss node (v1.6)
  - [ ] 11.1 Add `SHARD_MAX = 3`, `SHARD_BOSS_HP_CUT = 0.1`, `SHARD_NO_PHASE2 = 3`, and `RELIC_COMBAT.cacheHeal = 0.1` to `src/engine/balance.ts`, with assertions in `tests/engine/balance.test.ts` that read them from `game-rules.md`
    - _Requirements: 2.6, 14.3, 17.6 (FR-MOV-7, FR-REL-1)_
    - _Verify: `npx vitest --run tests/engine/balance.test.ts`_
  - [ ] 11.2 Remove Flee: the `flee` action, `startFlee`, `resolveFlee`, `finishEscape`, `FightNext` `escape`, the `flee` test kind, the `escaped` and `gateOpen` events, `FLEE_KEYS` in `input.ts`; delete the flee cases from `tests/engine/combat.test.ts` and update `tests/engine/input.test.ts`
    - _Requirements: 1.2, 1.4, 16.1, 16.2, 18.2, 20.3, 22.5 (FR-COM-1, FR-COM-6)_
    - _Verify: `npx vitest --run tests/engine/combat.test.ts tests/engine/input.test.ts && ! grep -rnE "'flee'|startFlee|resolveFlee|finishEscape|'escape'|gateOpen" src/engine`_
  - [ ] 11.3 Change the `move` action to `{ type: "move"; to: Pos }` in `src/engine/state.ts` and `src/engine/step.ts`: status gate, `checkMove`/`applyMove`, `moved` event, `enterTile` for monster, chest, wisp, fog (`restDay` from progression task 13.1), and the boss node; remove the `blocked` event; extend `tests/engine/step.test.ts` with legal and refused moves and every entry kind
    - _Requirements: 1.1, 22.1–22.4 (FR-MOV-1, FR-MOV-3, FR-MOV-8)_
    - _Verify: `npx vitest --run tests/engine/step.test.ts`_
  - [ ] 11.4 Implement `makeBoss` and `bossShardLine` in `src/engine/monsters.ts` (and the risen-label rule in `sourceLabel`), `startBossFight` in `src/engine/combat.ts`, `bound` in `checkPhase2`; extend `tests/engine/monsters.test.ts` (69, 62, 56, 49 HP at start level 3 for 0–3 shards) and `tests/engine/patterns.test.ts` (bound boss at half HP stays in phase 1)
    - _Requirements: 1.1, 2.4, 2.6, 14.3 (FR-COM-2, FR-COM-3, FR-COM-5, FR-MOV-7)_
    - _Verify: `npx vitest --run tests/engine/monsters.test.ts tests/engine/patterns.test.ts`_
  - [ ] 11.5 Change `winFight`: the CI Cache heal after non-boss wins, and the boss win (bossDown, bossHpLeft, new log line, `monsterDown`, `endRun("won")`, no Gate); extend `tests/engine/combat.test.ts`
    - _Requirements: 17.1, 17.2, 17.3, 17.6 (FR-PRO-3, FR-REL-1)_
    - _Verify: `npx vitest --run tests/engine/combat.test.ts`_
  - [ ] 11.6 Update `tests/engine/rng-order.test.ts`: skip the recorded flee fights, drop flee from the coverage check, and replay the boss recording with `shards = 0`; do not re-record `demo-fight.json`
    - _Requirements: 20.5, 2.6 (FR-COM-5, FR-MAP-3)_
    - _Verify: `npx vitest --run tests/engine/rng-order.test.ts`_
  - [ ] 11.7 Add P23 to `tests/engine/combat.prop.test.ts` and write `tests/engine/step.prop.test.ts` for P24 (action sequences with random legal and illegal `move` targets)
    - _Requirements: 2.6, 14.3, 22.1–22.4 (FR-MOV-3, FR-MOV-7, P23, P24)_
    - _Verify: `npx vitest --run tests/engine/combat.prop.test.ts tests/engine/step.prop.test.ts`_

- [ ] 12. Module check (v1.6)
  - [ ] 12.1 Run the engine suite and the type check; confirm the engine purity rules still hold and that no Flee or Gate code is left in `src/engine`
    - _Requirements: 20.1, 22.1–22.5 (FR-COM-1 to FR-COM-7, FR-MOV-8)_
    - _Verify: `npm run typecheck && npx vitest --run tests/engine && ! grep -rnE "Math\.random|Date\.now|performance\.now|document\.|window\.|localStorage|from ['\"]\.\./(render|audio|main)" src/engine && ! grep -rnE "'flee'|resolveFlee|gateOpen|gateIdx" src/engine`_
