---
inclusion: always
---

# Tech

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript, `strict: true` | No `any` at module boundaries. Prefer `type` aliases and discriminated unions for state and actions |
| Build | Vite | Static output in `dist/`. `base` is `/contribquest/` for GitHub Pages |
| Rendering | (v1.6) Three.js (`three` `^0.187.0`, WebGL 2) for the map and combat stage as a 3D billboard world; Canvas 2D for the fallback renderer, the timing gauges, the overlay text, and the share card; no game framework | Plain DOM for the HUD, log, forms, buttons, menus, and text so they stay accessible. `three` is imported only in `src/render/world/` and loaded with a dynamic `import()` into its own chunk. Was: Canvas 2D only |
| Validation | Zod | One schema validates live API data, cached data, demo data, and saved runs at the trust boundary |
| Tests | Vitest + fast-check | Unit tests and property tests (P1 to P24 in the PRD; P10 is retired) |
| E2E smoke | Playwright, through the Kiro Playwright power | Plays the hosted `?demo` run and captures screenshots |
| Hosting | GitHub Pages, deployed by a GitHub Actions workflow | The deployed site must keep `/prototype/` reachable |
| Runtime | Node 22 LTS locally and in CI | |

## Runtime dependencies

| Package | Since | Why |
| --- | --- | --- |
| `zod` | Phase 0 | One schema validates every untrusted input at the trust boundary |
| `three` | v1.6 (27 Nov 2026) | The author chose a 3D billboard world over the flat look. Shadows, distance fog, instanced meshes, point lights, tone mapping, and raycast picking by hand would be several thousand lines of WebGL code to maintain. Three.js is MIT, has no dependencies of its own, ships ES modules that Vite splits into a lazily loaded chunk (budget: 180 KB gzip), and lets the existing sprite canvases become textures unchanged. Babylon.js is larger for the same features; PixiJS has no 3D lighting or fog; OGL and regl leave lights and shadows to us |

`@types/three` (same minor version) is a dev dependency. Keep `three` on one minor version (`^0.187.0` allows patches only) and update it deliberately, because its minor releases can change rendering. Do not add other runtime dependencies without asking. The game ships no audio files and no image files besides what the build produces.

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
6. **Save is plain JSON.** `restore(save(state))` deep-equals `state` (P8, P19). An in-progress timing test is not saved; a restored fight resumes at the Attack choice (v1.6: there is no Flee). The run save is `cq:v2:run` with `version: 2`.
7. **Validate at the boundary.** Data from the network, local storage, or a URL parameter is parsed with Zod before it reaches mapgen or the engine. Invalid data becomes a readable error with demo mode, never an exception past the boundary.

Rendering and audio code may use `performance.now`, `requestAnimationFrame`, and `Math.random` for visual and sound variety only. They never decide a game outcome.

## Renderer rules (v1.6)

1. **Two renderers, one interface.** `src/render/world/` (Three.js) is the default; the flat Canvas 2D renderer is used when WebGL 2 is missing, the `three` chunk fails to load, the context is lost for more than 3 s, or the URL has `?renderer=flat`. Both implement the same `Renderer` interface, read the same state, and play the same sounds; only drawing differs.
2. **`three` stays in `src/render/world/`.** No other source file imports it, so the engine, mapgen, scripts, the flat renderer, and most tests never load WebGL code. Scene builders take their sprite canvases through `deps`, so `tests/render/*-scene.test.ts` run in Node with stubs; `WebGLRenderer` itself is only exercised through the Playwright power.
3. **Phone budgets.** Pixel ratio `min(devicePixelRatio, 2)`, lowered by the quality step-down; slabs drawn with one instanced mesh per level; at most 4 point lights and one shadow-casting light, with a constant light count per scene; under 120 draw calls on the map and 80 in a fight; no allocation inside the frame loop (reuse vectors, matrices, colours, and fixed particle pools); dispose geometries, materials, and textures when a scene is left; render no 3D frames while the page is hidden or on screens without 3D content.
4. **Reduced motion** is honoured by both renderers from one `motionFlags(reduced)` table; the timing gauges keep moving.

## Coding conventions

- ES modules, named exports, one concern per file.
- Pure functions for rules; side effects only in `src/data` (network, storage), `src/render`, `src/audio`, and `src/main.ts`.
- Tests live in `tests/`, named `<module>.test.ts` for unit tests and `<module>.prop.test.ts` for property tests. Fixtures live in `tests/fixtures/`.
- Each test names the PRD ID or property ID it checks, for example `it("FR-CLS-6: holding to full charge overloads")`.
- Secrets never appear in code or logs. The game needs none: the data source is a public API without a token.
- No analytics, cookies, or tracking.
