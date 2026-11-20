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

<!--
Template for future days. Copy the block below, newest day last.

## Ddd DD Mon 2026: <one-line summary>

- **Kiro client:** <Kiro Web / Kiro IDE / CLI>, <vibe / spec tasks / hook / agent>.
- **Specs and tasks:** <spec>-<task ids> done (see docs/build-checklist.json).
- **Hooks and agents:** <what fired, what it caught>.
- **Commits / PRs:** <shas or PR numbers and titles>.
- **Notes:** <what went well, what Kiro got wrong, balance table if the simulator ran>.
-->
