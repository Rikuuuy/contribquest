---
inclusion: always
---

# Structure

Data flows one way: **fetch → validate → normalize → generate map → engine → render.** The layout comes from `docs/BUILD-PLAN.md`.

```
contribquest/
├── .kiro/
│   ├── steering/      product.md, tech.md, structure.md, game-rules.md, art-style.md
│   ├── specs/         data-import, map-generation, combat-timing, progression, presentation, social
│   │                  (each with requirements.md, design.md, tasks.md)
│   ├── hooks/         test-on-save, rules-sync, balance-check
│   └── agents/        balance-tuner
├── src/
│   ├── data/          fetch, schema (Zod), cache, demo data, raids
│   ├── mapgen/        layout, tile assignment, shards, validation
│   ├── engine/        state, step(), combat, qte, patterns, classes, difficulty, relics, races, omen, trophies, balance.ts
│   ├── render/        canvas map, lighting, sprites, combat stage, particles, screens
│   ├── audio/         synthesized effects and score
│   └── main.ts        wires input, timers, and rendering to the engine
├── tests/             unit and property tests (Vitest + fast-check), fixtures/
├── scripts/           simulate.ts (headless balance), make-demo-data.ts
├── prototype/         the single-file reference game (read-only)
└── docs/              PRD.md, BUILD-PLAN.md, kiro-journal.md, screenshots/
```

## Modules

| Module | Owns | Must not |
| --- | --- | --- |
| `src/data` | Username validation, the fetch with its 8 s timeout, HTTP error mapping, Zod schemas, normalising to the 91-day window, streak and year total, the 1-hour cache, demo data, the raid's second fetch, and all `localStorage` reads and writes (settings, cache, save, trophies, class wins) | Know about tiles, combat, or rendering. Store tokens or raw API payloads |
| `src/mapgen` | Turning a validated `ContributionSet` into a validated map: layout, tile kinds and tiers, boss, Gate, shortfall, shards needed, route validation | Fetch, render, read storage, or depend on the hero, class, race, or relics (P18: they never change the map) |
| `src/engine` | Run state, `step(state, action)`, `nextDeadline(state)`, movement, fog reveal, encounters, combat, timing tests and `grade()`, monster patterns, boss phase 2, classes, difficulty and pressure, races, relics, omen, XP and levels, trophies facts, pure `save`/`restore` serialisation, and every constant in `balance.ts` | Touch the DOM, storage, network, `Math.random`, `Date.now`, or `performance.now`. Import from `render`, `audio`, `data` side-effecting code, or `main.ts` |
| `src/render` | Drawing state to canvases (map, lighting, fog, sprites, combat stage, particles, QTE gauge, share card) and DOM screens (start, summary, map HUD, combat, relic offer, results) | Own or change game rules. Mutate engine state directly. Decide any outcome with `Math.random` |
| `src/audio` | Web Audio synthesis of every effect and the music, music modes, mute | Load audio files. Block the game when audio fails or is unavailable |
| `src/main.ts` | Wiring: input events become actions, timestamps become press times, deadlines become timer actions, state changes trigger render and audio, storage is called through `src/data` | Contain game rules or balance numbers |
| `tests/` | Unit and property tests, mirroring `src/` by module | Depend on the network. Use real timers where a generated press time works |
| `scripts/` | `simulate.ts` (skill-bot balance simulator), `make-demo-data.ts` (generates `src/data/demo-data.json` once) | Import `render`, `audio`, or anything that needs a DOM |
| `prototype/` | The reference implementation | Be edited. It is read for rules and numbers only |

## Dependency direction

```
data (types, schemas) ──► mapgen ──► engine ──► render, audio ──► main.ts
```

- A module may import from modules to its left, never to its right.
- `scripts/` and `tests/` may import `data` (pure parts), `mapgen`, and `engine`.
- Types shared across modules (`ContributionDay`, `ContributionSet`) come from the Zod schemas in `src/data` via `z.infer`.

## Where things go

- A new rule or number: `src/engine/balance.ts` plus `game-rules.md`, in the same commit.
- A new visual: `src/render`, following `art-style.md`.
- A new sound: `src/audio`, synthesized.
- Persistence keys: `cq:v1:settings`, `cq:v1:cache:<lowercase username>`, `cq:v1:run`, `cq:v1:trophies`, `cq:v1:classwins`. Read and written only in `src/data`.
