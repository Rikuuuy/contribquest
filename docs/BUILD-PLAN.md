# ContribQuest build plan: from prototype to the Kiroween submission

| Field | Detail |
| --- | --- |
| Written | Thu 19 Nov 2026, 15:00 WIB |
| Internal submit target | Thu 3 Dec 2026, 21:00 WIB (14 days from now) |
| Hard deadline | Sat 5 Dec 2026, 05:00 WIB (Fri 4 Dec, 14:00 PT) |
| Kiro credit form | Closes Wed 2 Dec 2026, 03:00 WIB |
| Status | Proposal. Needs the decisions at the end before Phase 0 starts |

## Where we are

`prototype/index.html` is a single vibe-coded file (2,669 lines, 178 KB) that already plays the whole game. Everything in it was tested in the browser, and its balance was measured with bots. It has grown well past the PRD's MVP:

| Area | In the prototype |
| --- | --- |
| Data | Live GitHub calendar via the community API, 1-hour cache, demo dataset, raids (hero from one user, map from another) |
| Map | 91-day calendar layout, fog of war, lantern lighting, soul shards, boss ward |
| Combat | QTE on every action, 6 test modes (bar, combo, charge, ring, sidestep, shield), 4 monster patterns, boss phase 2 |
| Hero | 4 classes with their own QTE and difficulty, 5 races with passives, weekday traits, streak aura, 10 relics |
| Run loop | Daily omen (blessing or curse), pressure that narrows timing per kill, 14 trophies, save and continue |
| Presentation | 24×24 shaded sprites, particles, screen shake, hit-stop, slow motion, synthesized sound and music, idle behaviour |
| Social | Challenge links, share card PNG |

What it does not have, and the competition needs:

- **No `/.kiro` folder.** Kiro usage is a pass/fail gate at stage 1 and 20% of the stage 2 score. Judges look for specs, steering, and hooks in the repository.
- **No automated tests.** The bots were run by hand through a browser, 4 seeds at a time.
- **One file.** Every new feature this week touched shared code, and two bugs (the hero missing from the combat stage, a face-row typo) were only caught by screenshots.

## The recommendation

Rebuild the game as a TypeScript project from Kiro specs, using the prototype as the reference design. Keep the prototype online at `/prototype/` until the new build matches it, then switch the site root.

This is a port, not a redesign. Every rule, number, and pixel already exists and has been checked, so the work is translating it into modules with tests. That is what makes 14 days realistic.

Why rebuild instead of adding `/.kiro` around the prototype:

| | Add `/.kiro` to the prototype | Rebuild from specs (recommended) |
| --- | --- | --- |
| Kiro evidence | Specs written after the code; judges can tell | PRD → spec → task → code → test, one commit at a time |
| Tests | Hard to test a 2,700-line file that mixes DOM and rules | Pure engine with property tests and a headless simulator |
| Balance | 4 seeds per cell, run by hand, about 5 minutes each | Hundreds of seeds per cell in seconds, run by a hook |
| Risk | Low effort now, rising cost per feature | About 9 days of porting, then cheap changes |
| Player experience | Same | Same (still a static site on GitHub Pages) |

## Target architecture

```
contribquest/
├── .kiro/
│   ├── steering/      product.md, tech.md, structure.md, game-rules.md, art-style.md
│   ├── specs/         6 specs, each with requirements.md, design.md, tasks.md
│   ├── hooks/         test-on-save, rules-sync, balance-check
│   └── agents/        balance-tuner
├── src/
│   ├── data/          fetch, schema (Zod), cache, demo data, raids
│   ├── mapgen/        layout, tile assignment, shards, validation
│   ├── engine/        state, step(), combat, qte, patterns, classes, difficulty, relics, races, omen, trophies
│   ├── render/        canvas map, lighting, sprites, combat stage, particles, screens
│   ├── audio/         synthesized effects and score
│   └── main.ts        wires input, timers, and rendering to the engine
├── tests/             unit and property tests (Vitest + fast-check)
├── scripts/           simulate.ts (headless balance), make-demo-data.ts
├── prototype/         the current single-file game, kept as the reference
└── docs/              PRD, this plan, kiro-journal.md, screenshots
```

Rules that make the engine testable (they go into `tech.md` steering):

- `src/engine` and `src/mapgen` never touch the DOM, `Math.random`, `Date.now`, or `performance.now`.
- All randomness comes from the seeded RNG stored in the run state.
- Time is an input. A timing test is graded by a pure function: `grade(test, pressTimes) → perfect | good | miss`. The browser passes real event timestamps; tests and the simulator pass generated ones.
- The engine exposes `step(state, action) → state` and `nextDeadline(state)`. `main.ts` calls `step` on input and on deadlines.
- All balance constants live in `src/engine/balance.ts` and are listed in `game-rules.md`.

## Kiro setup

| Kiro feature | Plan |
| --- | --- |
| Steering | `product.md` (scope, cut list, tone), `tech.md` (stack, commands, the engine rules above), `structure.md` (module boundaries), `game-rules.md` with file-match inclusion on `src/engine/**` and `src/mapgen/**`, `art-style.md` with file-match on `src/render/**` |
| Specs | 6 specs (below). Every requirement keeps a PRD ID so it can be traced to its task, code, and test |
| Hooks | **test-on-save:** saving a file in `src/engine/**` or `src/mapgen/**` runs `vitest --run` on the related tests. **rules-sync:** saving `game-rules.md` asks the agent to check `balance.ts` still matches. **balance-check** (manual): runs the simulator and compares win rates with the targets |
| Custom agent | `balance-tuner`: runs the simulator, reads the targets in `game-rules.md`, and proposes changes to `balance.ts` only |
| Property tests | P1–P13 from the PRD, plus P14–P19 below |
| Powers / MCP | Playwright for the smoke test and README screenshots; GitHub CLI for PRs |
| Journal | `docs/kiro-journal.md`, 3–5 lines per working day. This session already counts: planning, the data spike, and the vibe-coded prototype in Kiro Web, which the write-up can compare with the spec-driven build |

### Specs

| # | Spec | Covers | PRD IDs |
| --- | --- | --- | --- |
| 1 | data-import | Username input, fetch, schema, cache, errors, demo data, raid fetch | FR-IMP-*, FR-DEM-* |
| 2 | map-generation | Layout, tile rules, boss, shortfall, shards, fog, validation | FR-MAP-*, FR-MOV-6/7 |
| 3 | combat-timing | Turns, all 6 test modes, monster patterns, boss phase 2, classes, difficulty, pressure | FR-COM-* |
| 4 | progression | XP, levels, aura, traits, races, relics, omen, trophies, save and continue | FR-PRO-*, FR-SAV-* |
| 5 | presentation | Screens, map and combat rendering, sprites, lighting, effects, audio, idle behaviour, accessibility | FR-MOV-1–5, NFRs |
| 6 | social | Challenge links, raid flow, share card | New FR-SOC-* |

Spec 3 is the largest and is split into ordered task groups so it can be built and tested in pieces.

### New property tests

| ID | Property |
| --- | --- |
| P14 | Pressure never increases during a run and never goes below the class floor |
| P15 | At equal pressure, the Perfect and Good windows are ordered Knight ≥ Wanderer ≥ Mage ≥ Rogue |
| P16 | For every test mode, an on-target press grades Perfect and a press outside the Good window grades Miss |
| P17 | A relic offer never contains an owned relic or a duplicate |
| P18 | Choosing a race or class never changes the map |
| P19 | `restore(save(state))` equals `state` for any reachable state, including class, race, relics, and pressure |

### Balance targets for the simulator

The simulator ports the prototype's skill bot: each press lands at a random offset from the target with standard deviation σ. It runs 200 seeds per cell on the demo graph and on 6 fixture graphs.

| Class | Target | Prototype measurement (4 seeds) |
| --- | --- | --- |
| Knight (Easy) | Casual players (σ 140 ms) win at least 90% | 4/4 |
| Wanderer (Normal) | Average players (σ 100 ms) win at least 80% | 4/4 |
| Mage (Hard) | Average players win 15–50%; good players (σ 60 ms) win at least 60% | 1/4 and 3/4 |
| Rogue (Nightmare) | Good players win at most 40%; expert players (σ 35 ms) win at least 80% | 1/4 and 4/4 |

## Timeline (WIB)

| Phase | Dates | Work | Exit check |
| --- | --- | --- | --- |
| 0. Foundations | Thu 19 – Fri 20 Nov | PRD v1.5 (adds everything built since v1.4), steering, 6 specs, Vite + TS + Vitest + fast-check scaffold, Pages deploy workflow, hooks, journal | You approve the specs; `npm test` passes; the prototype still loads at `/prototype/` |
| 1. Core rules | Sat 21 – Sun 22 | data, mapgen, engine core: movement, encounters, all test modes, monster patterns, boss phase 2; P1–P13, P16 | Property tests pass; a headless run can be played to the end |
| 2. Hero systems | Mon 23 – Tue 24 | Classes, difficulty and pressure, races, relics, traits, omen, shards, save and continue; simulator; P14, P15, P17–P19 | Simulator meets the balance targets |
| 3. Presentation | Wed 25 – Fri 27 | Screens, map rendering, lighting and fog, 24×24 sprites, combat stage and effects, audio, idle behaviour | Side-by-side screenshots match the prototype |
| 4. Social and parity | Sat 28 | Raids, challenge links, share card, trophies; parity checklist; site root switches to the new build | Every prototype feature checked on the hosted build |
| 5. Polish | Sun 29 – Mon 30 | First-fight tutorial, accessibility pass, phone testing (you), Playwright smoke test, bug fixes | A friend can finish the demo without help |
| Freeze | Tue 1 Dec | Feature freeze. README, screenshots, journal. **Submit the credit form today if not done** | No more feature PRs |
| 6. Submission | Wed 2 – Thu 3 | Wed: record the video, upload to YouTube, publish the dev.to post. Thu: write-up, Devpost form, `#KiroweenHackathon26` post, submit by 21:00 | Submitted |
| Buffer | Fri 4 – Sat 5, 05:00 | Emergency fixes only | |
| Judging | 16 Dec – 29 Jan | Tag `v1.0-submission`; no pushes to the deployed branch | Site stays up and unchanged |

The new first-fight tutorial is the only new gameplay work in this plan. Everything else is a port. New feature ideas wait until after 3 Dec.

### If we fall behind

Checkpoint on Sat 28 Nov. If parity is not reached, cut in this order and keep the cut features in the prototype:

1. Share card
2. Idle behaviour and speech bubbles
3. Trophies
4. Races (keep Human)
5. Raids

Never cut: demo mode, the timing tests and classes, difficulty, the boss and phase 2, the results screen, sound, the tutorial, and Phase 6.

## Risks

| Risk | Mitigation |
| --- | --- |
| The port takes longer than 9 days | Checkpoint and cut list above; the prototype stays playable throughout |
| Balance drifts during the port | The simulator and its targets run on every engine change through the hook |
| Touch controls (hold buttons) are still untested on a real phone | You test on Sun 29 – Mon 30 |
| Audio levels were never heard, only checked for errors | You listen during Phase 3 |
| The community API is down during judging | Demo mode on every error screen; README tells judges to use `?demo` |
| A rule or deploy setting needs a GitHub permission I don't have | You change it in Settings; I list the exact clicks each time |

## Decisions needed before Phase 0

1. **Port everything, or trim now?** Recommended: port everything, using the cut list only if the 28 Nov checkpoint is missed.
2. **Deploy through GitHub Actions.** The built site needs an Actions workflow. You will need to switch Settings → Pages → Source to "GitHub Actions" once, after the workflow PR is merged.
3. **Kiro credit form.** Has it been submitted? It closes Wed 2 Dec, 03:00 WIB.
4. **Student status.** If you are a student, the Best Student Project prize (Frankenstein) is worth entering, and the Devpost form needs your student email and LinkedIn.
5. **Kiro IDE.** Will you also open the repo in Kiro IDE locally? It is optional. Running a few spec tasks there adds evidence for the "which Kiro clients" question in the write-up.
