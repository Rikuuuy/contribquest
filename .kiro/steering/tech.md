---
inclusion: always
---

# Tech

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript, `strict: true` | No `any` at module boundaries. Prefer `type` aliases and discriminated unions for state and actions |
| Build | Vite | Static output in `dist/`. `base` is `/contribquest/` for GitHub Pages |
| Rendering | Canvas 2D, no game framework | Plain DOM for forms, buttons, and text so they stay accessible |
| Validation | Zod | One schema validates live API data, cached data, demo data, and saved runs at the trust boundary |
| Tests | Vitest + fast-check | Unit tests and property tests (P1 to P19 in the PRD) |
| E2E smoke | Playwright, through the Kiro Playwright power | Plays the hosted `?demo` run and captures screenshots |
| Hosting | GitHub Pages, deployed by a GitHub Actions workflow | The deployed site must keep `/prototype/` reachable |
| Runtime | Node 22 LTS locally and in CI | |

Do not add other runtime dependencies without asking. The game ships no audio files and no image files besides what the build produces.

## npm scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (interactive use only; agents and hooks never start it) |
| `npm run build` | Type-check with `tsc --noEmit`, then `vite build` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | `vitest --run`: every unit and property test, once |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run simulate` | Run `scripts/simulate.ts` (headless balance simulator, with `tsx`) and print win rates per class and skill level against the targets in `game-rules.md` |

Agents and hooks run tests in single-run mode (`vitest --run`), never in watch mode. To run the tests related to one file: `npx vitest --run related <file>`.

## Engine rules

These rules keep the game testable and replayable. They apply to everything under `src/engine/` and `src/mapgen/`.

1. **No platform access.** Code in `src/engine` and `src/mapgen` never touches the DOM, `window`, `document`, `localStorage`, `fetch`, `Math.random`, `Date.now`, `new Date()` without an argument, or `performance.now`. It imports nothing from `src/render`, `src/audio`, or `src/main.ts`.
2. **Seeded randomness only.** All randomness comes from the seeded RNG whose state is stored in the run state (`rng`). Every random draw advances that state, so a saved run replays identically. The map seed is `fnv1a(username.toLowerCase() + "|" + lastDate)`; the algorithms are in `game-rules.md`.
3. **Time is an input.** A timing test is graded by a pure function, `grade(test, pressTimes) → "perfect" | "good" | "miss"` (an array of three grades for the combo). Press and release times are milliseconds since the test started. The browser passes real event timestamps; tests and the simulator pass generated ones.
4. **One reducer.** The engine exposes `step(state, action) → state` and `nextDeadline(state) → number | null`. `step` never mutates its input. `main.ts` calls `step` on player input and when the deadline from `nextDeadline` passes (for example a test timing out as "too late", or a shield test reaching impact).
5. **One balance file.** Every balance constant lives in `src/engine/balance.ts` and is listed with its value in `game-rules.md`. Logic files import constants from `balance.ts` and contain no magic numbers. When a constant changes, `game-rules.md` changes in the same commit.
6. **Save is plain JSON.** `restore(save(state))` deep-equals `state` (P8, P19). An in-progress timing test is not saved; a restored fight resumes at the Attack/Flee choice.
7. **Validate at the boundary.** Data from the network, local storage, or a URL parameter is parsed with Zod before it reaches mapgen or the engine. Invalid data becomes a readable error with demo mode, never an exception past the boundary.

Rendering and audio code may use `performance.now`, `requestAnimationFrame`, and `Math.random` for visual and sound variety only. They never decide a game outcome.

## Coding conventions

- ES modules, named exports, one concern per file.
- Pure functions for rules; side effects only in `src/data` (network, storage), `src/render`, `src/audio`, and `src/main.ts`.
- Tests live in `tests/`, named `<module>.test.ts` for unit tests and `<module>.prop.test.ts` for property tests. Fixtures live in `tests/fixtures/`.
- Each test names the PRD ID or property ID it checks, for example `it("FR-CLS-6: holding to full charge overloads")`.
- Secrets never appear in code or logs. The game needs none: the data source is a public API without a token.
- No analytics, cookies, or tracking.
