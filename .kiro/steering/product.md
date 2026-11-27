---
inclusion: always
---

# Product: ContribQuest, The Haunted Graph

## What the game is

ContribQuest is a browser RPG that turns the last 91 days of a public GitHub contribution calendar into a haunted map. The map uses the same 7-row layout as the GitHub graph. Every day is one tile, and every week (column) is one floor:

- The hero climbs the graph one week at a time, choosing one of up to three branches into the next week. Every tile entered must be faced: there is no fleeing and no skipping.
- Empty days become quiet graveyard fog, where the hero catches its breath.
- Busy days spawn monsters and chests.
- The best day of the 91 raises the boss, "The Phantom of {date}", waiting after the last week. Banishing elites on the way collects soul shards that weaken it.
- The current streak powers the hero's aura.
- Only the next two weeks are clearly visible; the rest of the graph is shape and colour under fog.

Every combat action is a timing test. The hero has a class (Wanderer, Knight, Rogue, Mage), and each class has its own strike and guard tests and its own difficulty (Easy to Nightmare). The hero also has a race (Human, Elf, Orc, Skeleton, Vampire) with one passive. Other systems: relics from chests, a daily omen from today's tile, 14 trophies, raids on a friend's graph, challenge links, and a share card.

It is a static site with no backend, hosted on GitHub Pages. Demo mode (`?demo`) always works, even when the data source is down.

The full requirements are in `docs/PRD.md` (v1.6) and the build plan is in `docs/BUILD-PLAN.md`. `prototype/index.html` is the reference implementation. When the PRD and the prototype disagree, the prototype wins and the PRD gets corrected, except for the v1.6 decisions below.

## This build is a port, plus two decided changes

The rebuild translates the prototype into tested TypeScript modules. Every rule, number, and pixel already exists in the prototype and was checked in the browser, except for two changes the author decided on 27 Nov 2026 (PRD v1.6):

1. **Forward-only branching routes** ("one floor = one week"): no free walking, no Flee, every tile resolves, the boss is a final node after the last week, and soul shards weaken it instead of gating it. The rules and their tunable numbers are in `game-rules.md`, marked (v1.6).
2. **A Three.js billboard renderer**: a 3D graveyard world with the existing pixel-art sprites as camera-facing planes (see `tech.md` and `art-style.md`).

- Copy every other rule and number from the prototype. Never invent balance values beyond the v1.6 tunables. If a value is missing, ask.
- Besides these two changes, the only new gameplay in this build is the first-fight tutorial. Other new feature ideas wait until after 3 Dec 2026.
- Parity with the prototype (the Phase 4 checkpoint) is checked for everything except the v1.6 changes.
- Keep `prototype/` online at `/prototype/` and do not edit it. The site root switches to the new build only after parity is checked (Phase 4, Sat 28 Nov).

## Kiroween 2026 constraints

| Constraint | Detail |
| --- | --- |
| Category | Frankenstein (one category per submission) |
| Kiro usage | Pass/fail gate at stage 1 and 20% of the stage 2 score. `/.kiro` (steering, specs, hooks, agents) is committed and never added to `.gitignore` |
| Traceability | Every spec requirement keeps its PRD ID (for example FR-CLS-4), so each one traces PRD → spec → task → code → test |
| Eligibility | Built from scratch between 30 Oct and 4 Dec 2026. Libraries and asset packs are allowed; any other pre-existing code must be declared |
| License | MIT, in `LICENSE` at the repository root |
| Kiro credit form | Closes Wed 2 Dec 2026, 03:00 WIB |
| Internal submit target | Thu 3 Dec 2026, 21:00 WIB |
| Hard deadline | Sat 5 Dec 2026, 05:00 WIB (Fri 4 Dec, 14:00 PT). No edits after it |
| Judging | 16 Dec 2026 to 29 Jan 2027. The hosted app stays online and unchanged until at least 30 Jan 2027. Tag `v1.0-submission`; no pushes to the deployed branch during judging |
| Video | Under 3 minutes (target 2:55), showing the app working end to end |
| Trademarks | No GitHub logo, Octocat, or GitHub UI screenshots in the game or the video. "GitHub" appears as plain text, with "Not affiliated with GitHub." in the footer and README |
| Prizes | Also entering Best Student Project (Frankenstein), the Bonus Blog Prize, and the Social Blitz Prize (`#KiroweenHackathon26`) |

## Scope freeze

- **Tue 1 Dec 2026 is the feature freeze.** After it, merge only bug fixes, accessibility fixes, documentation, screenshots, and submission material. No feature PRs.
- Wed 2 to Thu 3 Dec: video, dev.to post, write-up, Devpost form, social post.
- Fri 4 to Sat 5 Dec, 05:00 WIB: emergency fixes only.
- Do not propose new features, refactors, or redesigns after the freeze. If something seems worth doing, write it down for after judging.

## Cut list

Checkpoint on Sat 28 Nov. If parity with the prototype is not reached by then, cut features in this order. Cut features stay playable in the prototype.

1. Share card
2. Idle behaviour and speech bubbles
3. Trophies
4. Races (keep Human)
5. Raids

Never cut: demo mode, the timing tests and classes, class difficulty, the boss and phase 2, the results screen, sound, the first-fight tutorial, and the submission work (Phase 6).

## Tone of voice

- Playful and spooky, never gory. Developer humour is welcome: monsters are bugs, flaky tests, and merge conflicts, and relics are Rubber Duck, Hotfix, and Git Blame.
- Copy is short and plain English. Name the real date and the real count so players recognise their own data: "Risen from Tue 3 Nov 2026: 14 contributions."
- The haunted theme lives in names, palette, and sprites. It never adds mechanics.
- Examples from the prototype to match:
  - "Your GitHub graph is haunted."
  - "You wake in a crypt on {date}. Somewhere ahead waits the Phantom of your best day."
  - "Soul shard 2/3. The Phantom weakens."
  - "The Phantom remembers every day you skipped. PHASE 2!"
  - "A quiet graph. Few spirits stir here, so some lost ghosts have risen from your empty days."
- Never shame the player for an empty graph or a missed day. The Uncommitted Curse is a nudge to commit, not a scolding.
- All new files, code comments, and UI text are in English.
