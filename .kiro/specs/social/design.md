# Design: social

## Overview

Social adds no game rule. It is text built from the run state, one canvas drawing, and two browser calls (clipboard and download) in `main.ts`. The text builders are pure and live in `src/engine/social.ts` so they can be tested in Node; the card drawing lives in `src/render/share-card.ts` and reuses the presentation spec's `drawMap`, `drawSprite`, and `glow`.

```
start form / ?u=&vs= / ?vs= ──► data/launch.parseLaunch ──► main.ts
                                                       │
            ┌──────────────── challenge ───────────────┤──── user (+ friend) ────► data/load.loadRun ──► newRun(set, heroSet)
            ▼                                          │
  render/screens/start.ts: prefill friend, prompt      │
                                                       ▼
results screen ──► engine/social.challengeUrl(state, location) ──► challengeText ──► navigator.clipboard (main.ts)
               └─► render/share-card.drawShareCard(ctx, state, link) ──► canvas.toDataURL ──► <a download> (main.ts)

raid wording: engine/social.raidNames(state) ──► progression's newRun log, summaryView, resultsView, continueLabel
```

## Module files

| File | Contents |
| --- | --- |
| `src/engine/social.ts` | `raidNames`, `challengeSearch`, `challengeUrl`, `challengeText`, `cardTitle`, `cardRows`, `cardLinkLine`, `cardFileName` (all pure) |
| `src/engine/run.ts`, `views.ts`, `save.ts` | Raid branches added to `newRun`'s first log line, `summaryView`, `resultsView`, `continueLabel` (progression files) |
| `src/render/share-card.ts` | `SHARE_CARD` layout constants, `drawShareCard(ctx, state, linkLine)` |
| `src/render/screens/start.ts` | Friend field, challenge prompt (`challengePrompt(friend)`) |
| `src/render/screens/results.ts` | "Copy challenge link" and "Save share card" buttons, note line, preview image |
| `src/main.ts` | Clipboard write with fallback, PNG download |

## Types and signatures

```ts
// engine/social.ts
export type RaidNames = { raid: boolean; you: string; owner: string };      // you = heroSet ?? set
export function raidNames(s: Pick<RunState, "set" | "heroSet">): RaidNames;

export type PageUrl = { origin: string; host: string; pathname: string; hash?: string };   // from location in main.ts
export function challengeSearch(s: Pick<RunState, "set">): string;          // "?demo" | "?vs=<encoded owner>"
export function challengeUrl(s: Pick<RunState, "set">, page: PageUrl): string;   // origin + pathname + search + hash
export function challengeText(s: RunState, url: string): string;
export function cardTitle(s: RunState): { text: string; won: boolean };
export function cardRows(s: RunState): [label: string, value: string][];    // 8 rows, requirement 4.5
export function cardLinkLine(s: Pick<RunState, "set">, page: PageUrl): string;  // "Can you survive this graph? host/path?query"
export function cardFileName(s: Pick<RunState, "set">): string;             // "contribquest-<owner>.png"

// render/share-card.ts
export const SHARE_CARD = {
  w: 1200, h: 630, bgTop: "#22163a", bgBottom: "#0b0e14", stars: 120, starSeed: 5,
  moon: { x: 1090, y: 90, r: 38, glow: 140 }, title: { x: 40, y: 36, size: 40 },
  subtitle: { x: 40, y: 100, size: 18 }, map: { x: 40, y: 150, tile: 38, gap: 4 },
  rows: { y: 160, dy: 42, size: 22 }, relics: { dx: 46, y: 530, scale: 3 }, link: { x: 40, size: 16 },
} as const;
export function drawShareCard(ctx: CanvasRenderingContext2D, s: RunState, linkLine: string): void;

// render/screens/start.ts
export function challengePrompt(friend: string): string;
```

`drawMap` gets a `revealAll: true` option (presentation `src/render/map/draw.ts`) that treats every tile as seen for that one draw, so the card never mutates `state.map` (requirement 5.2).

The prototype reads `location.href` inside `makeShareCard` and the share handler; the port passes a `PageUrl` from `main.ts` so the builders stay pure. The prototype set `url.search` on `new URL(location.href)`, which keeps any hash, so `challengeUrl` appends `page.hash` when present. The card's link line has no hash (`host + pathname + search`), as in the prototype.

## Data flow

- **Raid start:** `loadRun` returns `{ set: friend, heroSet: you }` or `{ set: you, heroSet: null }`; `newRun(set, heroSet, settings)` treats a same-name hero set as no raid (progression requirement 1.1).
- **Raid wording:** every raid string is produced by the progression functions, each of which calls `raidNames(state)` and branches on `raid`. Keeping the text in one place per screen avoids two copies of the summary and results builders.
- **Challenge prompt:** `parseLaunch` returns `{ kind: "challenge", friend }`; the start screen fills `#vs`, shows `challengePrompt(friend)` in the purple style, and focuses `#username`. Submitting runs the normal raid start.
- **Copy:** `challengeText(state, challengeUrl(state, page))`; `main.ts` awaits `navigator.clipboard.writeText` inside `try` and shows either the success note or the text.
- **Card:** `main.ts` creates the canvas, calls `drawShareCard`, then `toDataURL("image/png")`, sets the preview `<img>`, and clicks a temporary `<a download={cardFileName(state)}>`.

## Testing

| Test file | Checks |
| --- | --- |
| `tests/engine/social.test.ts` | `raidNames` for normal, raid, and same-name runs; `challengeSearch` for demo and live and a name needing encoding; `challengeUrl` keeps origin, path, and hash and replaces any query; all four `challengeText` variants, with the double space and class name; `cardTitle` four variants; `cardRows` values and order for the demo run; `cardLinkLine`; `cardFileName` |
| `tests/engine/raid-text.test.ts` | Raid branches of the first log line, `summaryView` title and labels and the "its" quiet line, `resultsView` titles, line, GitHub heading and the two contribution rows, `continueLabel` |
| `tests/render/start.test.ts` | `challengePrompt` text |
| `tests/data/load.test.ts` (data-import) | Raid fetch in parallel and either-side failure, already listed there |
| Playwright power smoke (presentation) | `?u=<a>&vs=<b>` with the API stubbed by route interception shows the raid title; `?vs=x` shows the prompt; the share card download is 1200×630 and the copied text matches `challengeText` |

## Properties owned

None of P1–P19. Social adds no game rule; it is covered by the unit tests above and the smoke test.

## Out of scope here

The fetch, cache, and error mapping for both profiles (data-import), the Graph Raider and Know Thyself trophies (progression), and the map, sprite, and font drawing primitives (presentation).
