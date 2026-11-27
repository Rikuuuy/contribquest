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

<!--
Template for future days. Copy the block below, newest day last.

## Ddd DD Mon 2026: <one-line summary>

- **Kiro client:** <Kiro Web / Kiro IDE / CLI>, <vibe / spec tasks / hook / agent>.
- **Specs and tasks:** <spec>-<task ids> done (see docs/build-checklist.json).
- **Hooks and agents:** <what fired, what it caught>.
- **Commits / PRs:** <shas or PR numbers and titles>.
- **Notes:** <what went well, what Kiro got wrong, balance table if the simulator ran>.
-->
