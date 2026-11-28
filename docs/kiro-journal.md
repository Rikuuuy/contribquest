# Kiro journal

A short log of how ContribQuest is built with Kiro, 3–5 lines per working day. Entries are written from `git log`, the merged pull requests, and the files Kiro produced. Dates are commit dates in UTC (WIB is UTC+7).

## Mon 16 Nov 2026: planning and the data-source spike (Kiro Web)

- **Kiro client:** Kiro Web, chat sessions.
- Planned the game and wrote PRD v1.2 (`contribquest-prd-v1.2.md`, outside the repo at first).
- Data-source spike: checked how to read a public contribution calendar without a server or a token, and chose the community API `grubersjoe/github-contributions-api` (see the README's data section).
- Built a first single-file preview with a small balance bot (`bot.js`) and took screenshots to test the idea. No repository yet.

## Tue 17 Nov 2026: the vibe-coded prototype goes into the repo

- **Kiro client:** Kiro Web, vibe coding (prompt → code → screenshot check, no specs).
- `1e57838` committed the design prototype (`prototype/index.html`), PRD v1.2, and the screenshots.
- PR #1 *Add timing tests (QTE) to every combat action*.
- PR #2 *Add sound, lighting, particles, and combat animation*.
- PR #3 *Add monster attack patterns, boss phase 2, and relics*.

## Wed 18 Nov 2026: hero systems and art, still vibe-coded

- **Kiro client:** Kiro Web, vibe coding.
- PR #4 *Add friend raids, daily omen, trophies, and share card*.
- PR #5 *Add hero classes with their own timing tests*.
- PR #6 *Add detailed hero sprites, races, and interactive idle behaviour*.
- PR #7 *Add 24px shaded heroes, class difficulty, and rising timing pressure*. Balance was checked with bots run by hand in the browser, 4 seeds per class. Two bugs (hero missing from the combat stage, a face-row typo) were only caught by screenshots, which showed the limits of one 2,669-line file.

## Thu 19 Nov 2026: build plan, then Phase 0 as a spec-driven agent workflow

- **Kiro client:** Kiro Web, a multi-step agent workflow (one subagent per step, each step committing its own work), chosen to keep credit use down and make each step reviewable.
- PR #8 *Add the build plan from prototype to submission* (`docs/BUILD-PLAN.md`): rebuild as a TypeScript project from Kiro specs, keep the prototype as the reference.
- Phase 0 on branch `phase-0/foundations`: PRD v1.5 (`9cc5542`), steering (`99f294c`), 6 specs (`e41245f`, `ed5685f`), Vite + TypeScript scaffold (`598b2ee`), Pages deploy workflow (`06fe5fd`), then hooks, the `balance-tuner` agent, `docs/build-checklist.json`, and this journal.
- No game code was ported. The prototype is unchanged and still the playable game.
- Compared with the vibe-coded days: every requirement now has a PRD ID, a task, and a verify command before any code exists.

## Thu 26 Nov 2026: Phase 1, the pure game logic ported to TypeScript

- **Kiro client:** Kiro Web, workflow run (one subagent per spec, then a final gate step).
- **Specs and tasks:** all 78 phase-1 items done (see docs/build-checklist.json): data-import 1.1–8.1 (21), map-generation 1.1–6.3 (18), combat-timing 1.1–8.2 (29), progression 1.1–3.2 (9), presentation 1.3.
- **Hooks and agents:** none fired in the web workflow. Each step ran its items' verify commands before marking them done; the final gate re-ran all 37 unique phase-1 verify commands plus `npm run typecheck && npm test && npm run build` (351 of 351 tests in 37 files).
- **Commits / PRs:** `ae2fb87` data import, `ca110f2` map generation, `31ae6a7` combat and timing, `3af4346` progression; PR *Port Phase 1 core logic to TypeScript with tests*.
- **Notes:** golden fixtures recorded by running the prototype's own code in a Node `vm` (demo map, and demo fights for all four classes) match the port exactly, including RNG state. Spec text that disagreed with the prototype (boss entry line) followed the prototype. Rendering is still not ported; `index.html` still redirects to the prototype.

## Fri 27 Nov 2026: Phase 2, the balance simulator's first full run

- **Kiro client:** Kiro Web, workflow run (one subagent per step).
- **Specs and tasks:** progression 11.1 (route bot), 11.2 (simulator), 11.3 (grade-policy regression) done. Progression 11.4 stays `todo`: its verify, `npm run simulate`, exits 1 because two balance targets are missed (below).
- **Hooks and agents:** none fired. The `balance-tuner` agent was not run in this step; the misses are handed to it below.
- **Commits / PRs:** `4a104f8` route bot, `8bf5a62` simulator, `6813e24` regression test, on branch `feature/phase-2-logic`.
- **Notes:** the prototype has no route code (its bots were driven by hand), so `routeAction` follows the PRD v1.2 rule recorded in progression design.md. Balance numbers in `src/engine/balance.ts` were not changed.

`npm run simulate` (200 seeds per cell and graph, race Human, Calm and Auto-timing off), exit code 1, 2 min 28 s:

| Class | σ (ms) | demo | allEmpty | singleActiveDay | veryDense | bestDayFirst | bestDayLast | lastDayZero | Overall | Target | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| knight | 140 | 200/200 | 155/200 | 197/200 | 200/200 | 200/200 | 200/200 | 200/200 | 96.6% | ≥ 90% | PASS |
| wanderer | 100 | 200/200 | 36/200 | 102/200 | 200/200 | 183/200 | 183/200 | 199/200 | 78.8% | ≥ 80% | FAIL |
| mage | 100 | 137/200 | 7/200 | 18/200 | 61/200 | 70/200 | 63/200 | 149/200 | 36.1% | 15–50% | PASS |
| mage | 60 | 194/200 | 74/200 | 109/200 | 193/200 | 171/200 | 164/200 | 198/200 | 78.8% | ≥ 60% | PASS |
| rogue | 60 | 140/200 | 15/200 | 42/200 | 79/200 | 49/200 | 88/200 | 170/200 | 41.6% | ≤ 40% | FAIL |
| rogue | 35 | 193/200 | 130/200 | 142/200 | 195/200 | 164/200 | 193/200 | 198/200 | 86.8% | ≥ 80% | PASS |

Wanderer grade policies on the demo graph (route target: 15–25 steps, 6–10 fights):

| Policy | Expected | Outcome | Steps | Fights | Result |
| --- | --- | --- | --- | --- | --- |
| All Perfect | win | win | 22 | 11 | PASS |
| All Good | win | win | 26 | 10 | PASS |
| Mixed 25/50/25 | win | win | 22 | 11 | PASS |
| All Miss | lose | lose | 6 | 3 | PASS |

**Follow-up for the `balance-tuner` agent** (changes go to `src/engine/balance.ts` and `game-rules.md` only):

- Wanderer σ 100 wins 78.8% overall; the target is at least 80%. The losses come from the all-empty fixture (36/200) and the single-active-day fixture (102/200).
- Rogue σ 60 wins 41.6% overall; the target is at most 40%.
- The demo route is outside the PRD's 15–25 steps and 6–10 fights: All Perfect and Mixed take 11 fights, All Good takes 26 steps. The simulator prints this but does not fail on it.

## Fri 27 Nov 2026: Phase 2 final gate, the rest of the pure game logic ported

- **Kiro client:** Kiro Web, workflow run (one subagent per step, then this final gate step).
- **Specs and tasks:** 25 of 26 phase-2 items done (see docs/build-checklist.json): progression 4.1–4.4 (relics), 5.1–5.2 (races), 6.1–6.2 (Commit Blessing), 7.1–7.4 (save/restore), 8.1 (run end), 9.1–9.2 (views), 11.1–11.3 (route bot, simulator, regression); combat-timing 9.1–9.3 (skill bot, retry), 10.1 (engine purity); map-generation 7.1–7.2 (map independence), 8.1 (module boundaries). Progression 11.4 stays `todo` because `npm run simulate` exits 1 on two balance misses (table below).
- **Hooks and agents:** none fired. The final gate ran `npm run typecheck && npm test && npm run build` (457 of 457 tests in 49 files) and all 54 unique phase-1 and phase-2 verify commands; every one passed except `npm run simulate` (progression 11.4). The `balance-tuner` agent was not run.
- **Commits / PRs:** `dcf5dc3`, `6184e8e` relics; `a8ec166` races; `57892e5` blessing; `2e0b914`, `d4c5103`, `5814744`, `fda5ee4` save/restore; `88c9d86` run end; `8b126ca`, `2a26e51` views; `65018e6`, `03a9afe`, `f0f302b` skill bot and retry; `c1a0551` engine purity; `0fba217`, `5d0ac01`, `e33298f` map independence and boundaries; `4a104f8`, `8bf5a62`, `6813e24`, `3593c8d` route bot, simulator, regression, balance run; PR *Port Phase 2 game logic to TypeScript with tests*.
- **Notes:** properties P8, P17, P18 (map independence), P19 and the v1.4 relic monotonicity property are covered by fast-check tests. Phase 1 tests were updated where Phase 2 changed behaviour (chests now end in a relic offer, wins and losses now also emit `runEnded`). Balance numbers were not changed; the misses are the same follow-ups for the `balance-tuner` agent as in the entry above.

`npm run simulate` (200 seeds per cell and graph, race Human, Calm and Auto-timing off), exit code 1, re-run in the final gate with identical results:

| Class | σ (ms) | demo | allEmpty | singleActiveDay | veryDense | bestDayFirst | bestDayLast | lastDayZero | Overall | Target | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| knight | 140 | 200/200 | 155/200 | 197/200 | 200/200 | 200/200 | 200/200 | 200/200 | 96.6% | ≥ 90% | PASS |
| wanderer | 100 | 200/200 | 36/200 | 102/200 | 200/200 | 183/200 | 183/200 | 199/200 | 78.8% | ≥ 80% | FAIL |
| mage | 100 | 137/200 | 7/200 | 18/200 | 61/200 | 70/200 | 63/200 | 149/200 | 36.1% | 15–50% | PASS |
| mage | 60 | 194/200 | 74/200 | 109/200 | 193/200 | 171/200 | 164/200 | 198/200 | 78.8% | ≥ 60% | PASS |
| rogue | 60 | 140/200 | 15/200 | 42/200 | 79/200 | 49/200 | 88/200 | 170/200 | 41.6% | ≤ 40% | FAIL |
| rogue | 35 | 193/200 | 130/200 | 142/200 | 195/200 | 164/200 | 193/200 | 198/200 | 86.8% | ≥ 80% | PASS |

## Fri 27 Nov 2026: design-only spec run for v1.6, haunted routes and the Three.js billboard renderer

- **Kiro client:** Kiro Web, workflow run (one subagent per design step, then a PR step), design-only: no game code, and `prototype/`, `src/`, `tests/`, `scripts/`, `.github/` untouched.
- **Specs and tasks:** design items `design-1.6-routes` (0.11) and `design-1.6-renderer` (0.12) done (see docs/build-checklist.json). Decision 1, forward-only branching routes (one floor = one week, no Flee, boss node, shards weaken the boss, 2-week visibility window, at least 4 fights per route, saves `cq:v2:run`): PRD v1.6, `game-rules.md` v1.6, new todo tasks map-generation 9.1–11.1, combat-timing 11.1–12.1, progression 13.1–13.8. Decision 2, Three.js billboard world with a reduced Canvas 2D fallback: `tech.md` (`three` 0.187 as the second runtime dependency), `art-style.md` "3D billboard world", `structure.md` (`src/render/world/`), presentation requirements 19–26 and new todo tasks 11.1–11.9, 12.1–12.2, 13.1–13.2, 14.1–14.3. Superseded: progression 11.4 → 13.8, presentation 3.2 → 11.4, presentation 10.3 → 14.2.
- **Hooks and agents:** none fired. The steps checked that `docs/build-checklist.json` parses, that every new presentation task has the same number and verify command in `tasks.md` and the checklist, and that `tests/engine/balance.test.ts` (which reads `game-rules.md`) still passes (14/14). The P19 property test in `tests/engine/save.prop.test.ts` timed out at 5 s in the sandbox; it reads no changed file, so it is left for CI to confirm.
- **Commits / PRs:** one branch, `feature/haunted-routes-spec` from `bc4f4a6`; one PR for the author to review, opened by the workflow's PR step. Implementation waits for approval.
- **Notes:** the 3D look comes from the sample the author liked (`preview-3d/sample-source.html`, billboard screenshots): its cameras, light rig, fog density, fireflies, and sprite sizes are now steering values. Choices made for the author to confirm are listed in the PR: the edge-column fallback, rest and wisp heals, CI Cache and Speedrun replacements, the shard numbers, the minimum-fights rule, and for the renderer a reduced flat fallback instead of full prototype parity, the Rolldown chunk split, and the quality step-down thresholds. Balance is re-measured after implementation (progression 13.8); class difficulty numbers are unchanged.

## Fri 27 Nov 2026: v1.6 forward-only week routes in the engine

- **Kiro client:** Kiro Web, workflow run (one subagent per spec group, then this balance and final gate step).
- **Specs and tasks:** 30 of 32 in-scope items done (see docs/build-checklist.json): map-generation 9.1–9.7, 10.1–10.5, 11.1; combat-timing 11.1–11.7, 12.1; progression 13.1–13.8, 10.3, 12.1. Progression 10.1 and 10.2 (UI buttons and boot restore) stay `todo`; they belong to the renderer phase.
- **Hooks and agents:** none fired. The final gate ran `npm run typecheck && npm test && npm run build` (514 of 514 tests in 53 files) and the 82 unique `verify` commands of the 146 done items in all phases; all passed. The full `npm run simulate` exited 0. The `balance-tuner` agent was not run.
- **Commits / PRs:** branch `feature/v16-routes-engine` from `1d02c48`, 33 commits (`92cc9d0` … this entry); PR *Implement forward-only week routes in the engine*.
- **Notes:** properties P20, P21, P22, P23, P24 added; P3 and P4 changed; P10 retired (its shard bounds moved to P23). P19 gained a 20 s timeout and legal-move picks. `src/main.ts` got a typecheck-only edit so the Phase 1 debug text view runs on the v1.6 engine (route keys and buttons, no Flee, boss shown as B, shards n/3); `index.html` still redirects to the prototype. No balance number was changed: every win-rate target passes on the v1.6 rules. The demo route misses the 6–10 fights target (10–12 fights, the boss included), which the simulator prints but does not fail on.

`npm run simulate` (200 seeds per cell and graph, race Human, Calm and Auto-timing off), exit code 0:

| Class | σ (ms) | demo | allEmpty | singleActiveDay | veryDense | bestDayFirst | bestDayLast | lastDayZero | Overall | Target | Result | Avg fights | Avg shards at boss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| knight | 140 | 200/200 | 200/200 | 200/200 | 200/200 | 200/200 | 200/200 | 200/200 | 100.0% | ≥ 90% | PASS | 12.57 | 2.14 |
| wanderer | 100 | 197/200 | 114/200 | 142/200 | 200/200 | 191/200 | 191/200 | 198/200 | 88.1% | ≥ 80% | PASS | 12.43 | 2.14 |
| mage | 100 | 111/200 | 20/200 | 28/200 | 93/200 | 75/200 | 60/200 | 121/200 | 36.3% | 15–50% | PASS | 10.49 | 1.90 |
| mage | 60 | 186/200 | 96/200 | 111/200 | 198/200 | 169/200 | 157/200 | 186/200 | 78.8% | ≥ 60% | PASS | 12.34 | 2.13 |
| rogue | 60 | 101/200 | 17/200 | 25/200 | 105/200 | 40/200 | 39/200 | 119/200 | 31.9% | ≤ 40% | PASS | 10.27 | 1.84 |
| rogue | 35 | 190/200 | 111/200 | 151/200 | 197/200 | 148/200 | 166/200 | 196/200 | 82.8% | ≥ 80% | PASS | 12.33 | 2.12 |

Wanderer grade policies on the demo graph (route target: 6–10 fights, the boss included; steps always equal cols):

| Policy | Expected | Outcome | Fights | Shards | Steps | Result |
| --- | --- | --- | --- | --- | --- | --- |
| All Perfect | win | win | 12 | 3 | 14 | PASS |
| All Good | win | win | 11 | 3 | 14 | PASS |
| Mixed 25/50/25 | win | win | 11 | 3 | 14 | PASS |
| All Miss | lose | lose | 10 | 3 | 14 | PASS |

**Follow-up for the `balance-tuner` agent:** the demo route takes 11–12 fights in the winning policies (10 for All Miss), above the 6–10 fights target, and the simulator averages 10.3–12.6 fights per run. Fight count is mostly set by the map (`MIN_ROUTE_FIGHTS` and the route shortfall) and the bot's tier-first policy, not by the tuner's v1.6 tunables, so this may need a spec decision rather than tuning. Win rates also moved: Knight 96.6% → 100%, Wanderer 78.8% → 88.1% (now passing), Rogue σ 60 41.6% → 31.9% (now passing).

## Sat 28 Nov 2026: renderer run A, the 3D billboard map with week routes at /next/

- **Kiro client:** Kiro Web, workflow run (four sequential subagent steps: foundations and sprites, the Three.js foundation, map scene and HUD, then routes, map screen, and the final gate).
- **Specs and tasks:** presentation 1.1, 1.2, 2.1, 2.2, 2.3, 11.1, 11.2, 11.3, 11.4, 11.5, 3.3, 4.1, 12.1, 3.4, 12.2 done (see docs/build-checklist.json). Presentation 11.8 stays `todo`: its verify passes, but `showFight` only stops 3D frames until run B adds the arena scene (11.6, 11.7). The progression 14.4 demo-route target was raised to 8–13 fights first (PRD changelog row of 28 Nov).
- **Hooks and agents:** none fired. The final gate ran `npm run typecheck && npm test && npm run build` (647 of 647 tests in 65 files) and the 94 unique `verify` commands of the 161 done items in all phases; all passed. A headless Chrome run of the built `/contribquest/next/?demo` played a demo run with the keyboard from the start tile to the end screen.
- **Commits / PRs:** branch `feature/render-a-map` from `3d34015`, 20 commits (`5e621b5` … this entry); PR *Render the map in 3D with billboard sprites and week routes*.
- **Notes:** the new build is a second Vite page (`next/index.html`, served at `/contribquest/next/`); the root still redirects to `prototype/`, and `dist/` holds `index.html`, `next/index.html`, and `prototype/index.html`. `three` loads lazily in its own chunk (137 KB gzipped, under the 180 KB budget). The fight, relic, and end screens are plain text panels until runs B and C; live usernames wait for the start and summary screens (5.x). Kiro's 12.1 commit passed its vitest verify but not `tsc` (a literal type on `fogFrom`); a follow-up fix commit caught it before the gate. `next/index.html` loads Press Start 2P from Google Fonts like the prototype, because self-hosting would copy a third-party asset.

<!--
Template for future days. Copy the block below, newest day last.

## Ddd DD Mon 2026: <one-line summary>

- **Kiro client:** <Kiro Web / Kiro IDE / CLI>, <vibe / spec tasks / hook / agent>.
- **Specs and tasks:** <spec>-<task ids> done (see docs/build-checklist.json).
- **Hooks and agents:** <what fired, what it caught>.
- **Commits / PRs:** <shas or PR numbers and titles>.
- **Notes:** <what went well, what Kiro got wrong, balance table if the simulator ran>.
-->
