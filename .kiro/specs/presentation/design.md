# Design: presentation

## Overview

Presentation is everything to the right of the engine in the dependency chain: `src/render` draws state and turns input into actions, `src/audio` makes sound, and `src/main.ts` wires them to `step`. The engine never waits on the screen; the screen decides when to send `advance` and `timeout`, and reads the engine's `events` to know what to animate and play.

```
          ┌──────────────────────── main.ts ─────────────────────────┐
key/pointer ─► render/input.ts ─► Action ─► dispatch(action)          │
timers ─────► timeout / advance / offerBlessing ┘     │               │
                                                      ▼               │
                                     state = step(state, action)      │
                                     writeRun(serialize(state))*      │
                                                      │               │
                     ┌────────────────────────────────┼───────────┐   │
                     ▼                                ▼           ▼   │
            render/screens/* (DOM)        render/fx, stage, map   audio/events.ts → audio/sfx.ts
            (HUD, log, summary, results)  (canvas, rAF loop)      (Web Audio)
                     │                                                │
                     └── schedule(): nextDeadline → timeout; wait → pacingDelay → advance
          └───────────────────────────────────────────────────────────┘
* every action except press, release, timeout (progression requirement 10.1)
```

`main.ts` holds the only mutable references: `state`, `settings`, the storage handle, and the timer ids. Render modules keep visual-only state (particles, animation start times, the hero's facing, the idle timer, the speech bubble) in their own objects and may use `performance.now`, `requestAnimationFrame`, and `Math.random` for variety. They never change `RunState`.

**v1.6 (27 Nov 2026).** Two changes. *Routes:* the map shows `legalMoves(state)` as highlights, fog columns from each tile's `seen`, the boss node, and the best-day marker; keys and taps send `{ type: "move", to }`; Flee, the Gate, the ward ring, `blocked`, and `gateOpen` are gone (combat-timing and map-generation v1.6). *Renderer:* the drawing back end becomes swappable behind one `Renderer` interface. The default, `src/render/world/`, uses Three.js (`three` 0.187.x) to draw the map and the combat stage as 3D scenes with billboard sprites, following the sample at `/projects/sandbox/preview-3d/sample-source.html` (its `billboard()`, light rig, `FogExp2`, `fireflies()`, and the map and battle cameras). The fallback is the flat Canvas 2D renderer (`src/render/map/draw.ts` and `src/render/stage.ts`), reduced to what the share card and a no-WebGL device need. HUD, log, menus, gauges, and audio are shared by both and unchanged in kind. The engine API is unchanged by the renderer decision.

```
main.ts ──► Renderer (interface) ──┬─► render/world/*  (Three.js, default; dynamic import of "three")
   ▲          showMap / showFight  └─► render/map/draw.ts + render/stage.ts  (flat Canvas 2D fallback)
   │          onEvents / frame / dispose
   └── render/caps.ts: pickRenderer(probe) → "world" | "flat"
shared by both: render/screens/* (HTML), render/hud.ts, render/qte-gauge.ts, render/overlay.ts (2D text canvas),
                render/sprites/* (sprite canvases = billboard textures), render/map/route-view.ts, audio/*
```

## Module files

| File | Contents |
| --- | --- |
| `src/main.ts` | Boot (`parseLaunch`, `loadSettings`, `readRun`), `dispatch`, `schedule`, screen flow, button wiring, storage calls |
| `src/render/dom.ts` | `$`, `esc`, `show(screen)`, `sizeCanvas(cv, w, h)` (device-pixel-ratio aware, smoothing off) |
| `src/render/motion.ts` | `REDUCED` (read from `matchMedia`; v1.6: kept current on `change` and announced to the renderer) |
| `src/render/palette.ts` | The colours in `art-style.md` (`LEVEL_COLORS`, `LEVEL_HI`, sprite palette keys, grade colours, star colours) |
| `src/render/input.ts` | **v1.6:** `routeKey(key) → Branch \| null` (`"up"` for ArrowUp/W, `"ahead"` for ArrowRight/D, `"down"` for ArrowDown/S; ArrowLeft/A → `null`), `isArrowKey(key)` (for `preventDefault`), `relicKey(key) → 0 \| 1 \| 2 \| null`, `isMuteKey(e)`; pointer helpers `tileFromPoint(layout, rect, x, y)` (flat renderer). `moveKey`/`Dir` removed |
| `src/render/map/route-view.ts` | **v1.6:** `routeView(state) → RouteView` (pure): legal targets with their branch and key label, fog-column start, boss node and shard pips, best-day position, week label; `targetFor(view, branch) → Pos \| null` |
| `src/render/caps.ts` | **v1.6:** `parseRendererParam(search) → "world" \| "flat" \| null`, `pickRenderer(probe) → RendererKind` (pure), `probeWebGL2() → boolean` (creates and drops a test context) |
| `src/render/renderer.ts` | **v1.6:** the `Renderer` interface and `createRenderer(kind, deps)`, which dynamic-imports `./world/index.ts` for `"world"` and falls back to the flat one on failure |
| `src/render/overlay.ts` | **v1.6:** the 2D overlay canvas over the 3D canvas (floating text, speech bubble), sized with `sizeCanvas`, `pointer-events: none` |
| `src/render/world/index.ts` | **v1.6:** `createWorldRenderer(host, deps) → Renderer`: the one `WebGLRenderer`, the frame loop, scene switching, context-loss handling |
| `src/render/world/math.ts` | **v1.6, pure, no `three` import:** `slabHeight(level)`, `tileWorld(col, row) → [x, z]`, `bossNodeWorld(map)`, `spriteWorldSize(w, h, role)`, `followAim(pos, map)`, `overviewAim(map)`, `cameraFor(view, aim, aspect) → { pos, look, fov }`, `easeOutBack`, `riseDelay(col, row)` |
| `src/render/world/quality.ts` | **v1.6, pure:** `QUALITY` table, `initialQuality(coarse)`, `FrameStats` ring buffer (fixed `Float32Array(120)`), `nextQuality(stats, current, now, lastChange) → Quality` |
| `src/render/world/textures.ts` | **v1.6:** `spriteTexture(key, canvas)` cache (`CanvasTexture`, `NearestFilter` mag and min, `generateMipmaps = false`, `SRGBColorSpace`), `glowTexture(rgba)`, `textTexture(text)` for ground labels |
| `src/render/world/billboard.ts` | **v1.6:** `makeBillboard(texKey, role) → Billboard` (a `Group` holding one plane mesh anchored at its bottom centre), `setFacing(b, dir)` (mesh `scale.x = ±1`), `setFrame(b, texKey)`, `faceCamera(list, camera)` |
| `src/render/world/atmosphere.ts` | **v1.6:** `makeLightRig(scene, quality)` (hemisphere, moon with shadow, fill, moon disc and halo, a pool of 4 point lights), `assignLights(rig, targets)`, `flicker(rig, t)`, `makeFireflies(n, spread, y0)`, `makeFogBank(map)`, `setFogStart(bank, col)` |
| `src/render/world/map-scene.ts` | **v1.6:** `buildMapScene(map, deps) → MapScene` (5 instanced slab meshes, instanced gravestones, ground labels, boss altar, best-day flame, actors), `syncMap(scene, state, view)` (seen tint, contents, visited frames, highlights, shard pips), `pickTile(scene, ndc) → Pos \| null` (raycast) |
| `src/render/world/arena-scene.ts` | **v1.6:** `buildArena(fight, tile, deps) → ArenaScene` (seeded graveyard dressing), `arenaStrike`, `arenaHit`, `arenaDeath`, `arenaPhase2` |
| `src/render/world/fx3d.ts` | **v1.6:** fixed-size particle pool on one `Points` (positions, colours, sizes in preallocated `Float32Array`s), rings and slashes from small pools, `shake`, visual clock with hit-stop and slow motion |
| `src/render/world/motion-flags.ts` | **v1.6, pure:** `motionFlags(reduced) → MotionFlags` (`cameraEase`, `rise`, `bob`, `rigs`, `frames`, `flicker`, `fireflyDrift`, `fogDrift`, `petals`, `pulse`, `hop`, `flashes`, `whiteOut`, `shake`, `hitStop`, `slowMo`, `textRise`; all false when reduced). Every world module reads these flags instead of `REDUCED` |
| `src/render/flat.ts` | **v1.6:** `createFlatRenderer(host, deps) → Renderer` wrapping `drawMap` and the reduced `stage.ts` with one 2D rAF loop |
| `src/render/world/dispose.ts` | **v1.6:** `disposeTree(object, keep)` (geometries, materials, textures except the sprite cache) |
| `src/render/layout.ts` | `mapTileSize(avail, cols)`, `layout(map, tile, gap, labels)`, `tileXY(L, col, row)` |
| `src/render/sprites/grids.ts` | `SPRITES` (12-wide monster, chest, grave, coffin, relic grids), `OUTFITS` (24×24 class grids and `fx` points), copied from the prototype |
| `src/render/sprites/build.ts` | `buildSprite(rows, palette)`, `outline`, `silhouette`, `spriteCache` |
| `src/render/sprites/hero.ts` | `heroPixels(cls, race, frame)` (pure: race overlay, frame edits, auto-shade → colour grid), `heroKey`, `heroFrame(now, opts)`, `heroFX(ctx, …)` |
| `src/render/sprites/draw.ts` | `drawSprite(ctx, key, cx, cy, scale, alpha, opts)`, `shadow`, `glow`, `rrect` |
| `src/render/map/tiles.ts` | `tileTex`, `fogTex` (seeded with `makeRng` for stable noise) |
| `src/render/map/draw.ts` | `drawMap(ctx, map, L, opts)` (labels, tiles, rise, contents, hero, aura; **v1.6:** boss node, best-day flame, highlights from `RouteView`, shard pips; `revealAll` for the share card). The flat renderer and the share card |
| `src/render/map/lighting.ts` | *Removed in v1.6* (`applyLighting`, `drawFogDrift`): the flat renderer is reduced, and the world renderer's lighting is `world/atmosphere.ts` |
| `src/render/map/tooltip.ts` | `tileInfo(tile) → { when, what }` (pure) |
| `src/render/fx.ts` | `makeFx`, `fxBurst`, `fxText`, `fxRing`, `fxSlash`, `fxShake`, `fxUpdate`, `fxDraw`, `fxShakeOffset` |
| `src/render/stage.ts` | Combat stage: `stageReset`, `stageAt`, `stageHeroStrike`, `stageMonStrike`, `stageMonDeath`, `drawStage`, `stageBg`. **v1.6:** the flat renderer's reduced stage (requirement 24.4); `stageBg` draws the gradient sky, moon, path, and ground band only |
| `src/render/qte-gauge.ts` | `drawQte(ctx, test, t, opts)`, `gaugeHeadline(test, assist) → string` (pure) |
| `src/render/pacing.ts` | `Pacer` (pure): `delayFor(fight, events)`, the phase-2 flag |
| `src/render/personality.ts` | `HERO_LINES`, `CLASS_LINES`, `linePool(hero)`, `pickLine(pool, r)`, portrait state, map bubble, `idleStep(idle, now, cls) → IdleAction[]` (pure schedule) |
| `src/render/hud.ts` | `hudView(state) → HudView` (pure), `renderHud`, `renderLog`, bump tracking, danger overlay |
| `src/render/screens/start.ts` | Start screen, teaser loop, error line with the demo link, continue button, trophy line |
| `src/render/screens/summary.ts` | Summary from `summaryView`, portrait canvas, race and class cards, options |
| `src/render/screens/map.ts` | Map screen, the renderer host element, branch pad (v1.6; was the D-pad), pointer move and hover, tooltip, idle. The frame loop belongs to the active `Renderer` |
| `src/render/screens/combat.ts` | Combat panel, HP bars, grade line, Attack and Now! buttons (v1.6: no Flee), gauge loop, the stage slot the renderer's canvas moves into |
| `src/render/screens/relic.ts` | Relic overlay cards |
| `src/render/screens/results.ts` | End screen from `resultsView` and `trophyList` |
| `src/render/background.ts` | Night-sky background canvas (stars, moon, bats, motes, end confetti) |
| `src/audio/sfx.ts` | `createAudio(getMuted)`: `init`, `play(name)`, `setMode(mode)`, `setLowHp(v)`, `setMute(m)`; the prototype's `Sfx` |
| `src/audio/events.ts` | `soundsFor(events, ctx) → SoundName[]`, `musicModeFor(state) → MusicMode` (pure) |
| `src/style.css`, `index.html` | The prototype's CSS and screen markup, split out of the single file |

## Types

```ts
// render/pacing.ts
export type PacingInput = { fight: Fight; events: readonly GameEvent[]; resolved: "strike" | "guard" };   // v1.6: "flee" removed
export class Pacer {                       // a tiny class holding the phase-2 flag; no timers inside
  phase2Fresh: boolean;
  delayFor(input: PacingInput): number;    // ms until advance
  reset(): void;                           // on fight start
}
export const PACING = {
  strikeKill: 950, strikeKillBoss: 1300, strikeNext: 600, phase2: 1500, comboGap: 170,
  counterKill: 1250, counterKillBoss: 1600, heroDown: 1100,
  nextStrikePerfect: 750, nextStrike: 500, choosePerfect: 700, choose: 400,   // v1.6: flee: 850 removed
  relicShow: 380, blessingRise: 1500, blessingNoRise: 300, raceLine: 1900, levelUpFx: 250,
  hpBarDelay: 110, fightDust: 300, phase2Fx: 250,
} as const;

// render/hud.ts
export type HudView = {
  name: string; cls: string; stars: 1 | 2 | 3 | 4; timing: { pct: number; maxed: boolean };
  level: number; hp: number; maxHp: number; xp: number; next: number | null; xpPct: number;
  atk: number; treasure: number; relics: { id: RelicId; name: string; text: string }[];
  shards: { have: number; max: 3 };              // v1.6 (was need)
  week: string;                                  // v1.6: "Week 4/14" or "Boss"
  boss: string; lowHp: boolean;                  // boss: one of the four v1.6 lines in requirement 3.1
};

// render/map/route-view.ts (v1.6, pure)
export type Branch = "up" | "ahead" | "down";
export type RouteTarget = { to: Pos; branch: Branch; key: "W" | "D" | "S" | "→"; boss: boolean; monster: boolean };
export type RouteView = {
  targets: RouteTarget[];            // [] unless status is exploring and no fight or relic offer is open
  single: boolean;                   // exactly one target: every branch key maps to it, label "→" (or "Boss")
  fogFrom: number;                   // first column with an unseen tile; cols when none
  bossNode: Pos; shards: number; bound: boolean; banished: boolean;
  bestDay: Pos | null;               // null on an empty quarter
  week: string;
};

// render/caps.ts and render/renderer.ts (v1.6)
export type RendererKind = "world" | "flat";
export type Probe = { param: RendererKind | null; webgl2: boolean };
export interface Renderer {
  kind: RendererKind;
  mount(host: HTMLElement): void;                           // moves the canvas (and overlay) into host; resizes
  showTeaser(map: GameMap): void;
  showMap(state: RunState, view: RouteView, opts: { rise: boolean }): void;
  showFight(state: RunState): void;
  onEvents(state: RunState, events: readonly GameEvent[]): void;   // effects, animations; never dispatches
  pick(clientX: number, clientY: number): Pos | null;      // tile or boss node under the pointer
  setReduced(on: boolean): void;
  stop(): void;                                             // no frames until the next show*
  dispose(): void;
}

// render/world/quality.ts (v1.6, pure)
export type Quality = "high" | "medium" | "low";
export const QUALITY = {
  high:   { ratioCap: 2,   shadows: true,  shadowMap: 2048, fireflies: 1,   particles: 1 },
  medium: { ratioCap: 1.5, shadows: true,  shadowMap: 1024, fireflies: 1,   particles: 1 },
  low:    { ratioCap: 1,   shadows: false, shadowMap: 0,    fireflies: 0.5, particles: 0.5 },
} as const;
export const FRAME_BUDGET = { window: 120, slowMs: 22, minGapMs: 5000, mapCalls: 120, arenaCalls: 80, pointLights: 4,
  poolMap: 256, poolArena: 384, threeGzipKb: 180, phoneMedianMs: 33 } as const;

// render/personality.ts
export type IdleState = { last: number; action: number; z: number; hop: number };
export type IdleAction = { kind: "fidget"; cls: ClassId } | { kind: "z" };

// audio
export type SoundName = "ui" | "step" | "wisp" | "chest" | "encounter" | "boss" | "windup" | "warn"   // v1.6: "blocked", "gate" removed
  | "stutter" | "charge" | "hit" | "crit" | "glance" | "block" | "dodge" | "hurt" | "death" | "levelup"
  | "shard" | "ward" | "relic" | "phase" | "rise" | "win" | "lose";
export type MusicMode = "off" | "menu" | "explore" | "combat" | "boss" | "boss2";
```

## Pacing

`Pacer.delayFor` encodes requirement 12.1 from the fight's `next` and the step's events:

| Resolved | Condition | Delay (ms) |
| --- | --- | --- |
| strike | `next = win`, boss / other | 1300 / 950, + 170 × (hits − 1) |
| strike | `next = strike 0`, phase-2 flag set / not | 1500 / 600, + 170 × (hits − 1); clears the flag |
| guard | `next = win` (counter killed), boss / other | 1600 / 1250 |
| guard | `next = lose` | 1100 |
| guard | `next = strike i+1`, Perfect / other | 750 / 500 (flag kept) |
| guard | `next = choose`, flag set / Perfect / other | 1500 / 700 / 400; clears the flag |
| ~~flee~~ | *Removed in v1.6* (was `next = escape`, 850) | — |

`resolvedKind(events, next)` (also in `pacing.ts`) returns `strike` when the events hold a `heroHit`, and `guard` otherwise (v1.6: the `flee` branch is removed). A `phase2` event sets the flag. `main.ts` stores the timer with the fight's `testId`; if the fight's `testId`, `phase`, or `status` changed when it fires, it sends nothing.

## Scheduling in `main.ts`

```ts
function schedule() {
  clearTimeout(timers.deadline); clearTimeout(timers.advance);
  const f = state?.combat;
  if (f?.phase === "test") {
    const d = nextDeadline(state);                    // test time
    if (d) timers.deadline = setTimeout(() => dispatch(d.action), Math.max(0, testStart + d.t - performance.now()));
  } else if (f?.phase === "wait") {
    const id = f.testId, ms = pacer.delayFor({ fight: f, events: state.events, resolved: resolvedKind(state.events, f.next) });
    timers.advance = setTimeout(() => { if (state?.combat?.testId === id && state.combat.phase === "wait") dispatch({ type: "advance" }); }, ms);
  }
}
```

Presses use `event.timeStamp − testStart`; `testStart` is set with `performance.now()` when a `testStart` event with a new `testId` is rendered (combat-timing task 8.2).

## Sprites

`heroPixels(cls, race, frame)` is the testable core: it copies `OUTFITS[cls].rows`, applies the frame edits (sway cape shift on odd rows 17–21, step feet on rows 22–23, blink, look), overlays the race face, then auto-shades, and returns a 24×24 grid of `#rrggbb | null`. `buildSprite` turns any colour grid into an outlined canvas plus its white, red, and gold silhouettes; this part needs a canvas and is checked by screenshots. Cache keys are `hero:{cls}:{race}:{frame}`.

## Event → sound and effect map

| Event | Sound | Effect |
| --- | --- | --- |
| `moved` (move action succeeded) | step | dust at the old tile; hero hop (requirement 19.5); camera ease; highlights rebuilt |
| ~~`blocked`~~ | — | *Removed in v1.6* (illegal moves emit nothing) |
| `wisp` | wisp | homing sparks, "+5 XP"; v1.6: "+{healed} HP" 220 ms later when `healed > 0` |
| `rest` (v1.6) | wisp at half gain | green motes, "+{healed} HP" or "RESTED" |
| `heal` with `source: "cache"` (v1.6) | relic | "+{n} HP" with the CI Cache icon over the hero |
| `chest` | chest | coins, ring, "+{gold} GOLD", "+{n} HP" 220 ms later |
| `levelUp` | levelup (250 ms later) | rings, sparks, "LEVEL UP!" |
| `fightStart` | encounter / boss | stage reset, dust at 300 ms, boss white-out |
| `testStart` | windup / warn; stutter at the flaky pause | gauge |
| `heroHit` | crit / hit / glance; death on kill | requirement 13.1 |
| `monsterHit` | dodge / block / hurt | requirement 13.2 |
| `counter` | hit | "COUNTER {n}" |
| `phase2` | phase; music boss2 | requirement 13.4 |
| `graded` with reason "rubber duck" | relic | — |
| `timing` | — | "TIMING {n}%" at 650 ms |
| `shard` (v1.6: `{ have, max: 3, bound }`) | shard (300 ms); ward (750 ms) if `bound` | "SHARD {have}/3", one shard pip lights; "PHANTOM BOUND", gold ring on the altar, shake 6 |
| ~~`gateOpen`~~ | — | *Removed in v1.6*; the boss win is `won` |
| `relicOffer` / `relicPicked` | chest (at 380 ms) / relic | cards / ring, burst, relic name |
| `won` / `lost` | win, relic at 900 ms if new trophies / lose; music off | background confetti / ash |

`moved` is a new event this spec asks combat-timing's `move` handler to emit (`{ type: "moved"; from: Pos; to: Pos }`), so the renderer can animate the hop and set the facing without reading `prev`. (v1.6: combat-timing task 11.3 adds it; `to` may be the boss node.)

Both renderers implement every row; the "Effect" column is drawn in 3D by the world renderer (particles from `fx3d.ts`, text on the overlay) and in 2D by the flat one. `soundsFor` is shared, so sound never depends on the renderer.

## Routes on screen (v1.6)

`routeView(state)` is the only place the presentation reads the route rules, and it reads them only through the engine: `legalMoves(state)` for targets and each tile's `seen` for fog. It never calls `nextOptions` and never computes a window, so the highlight cannot disagree with what the engine accepts (map-generation owns the rule; P22 and P24 test it). `targets` is empty unless `status` is exploring with no `combat` and no `relicOffer`. Each target gets `branch` from `to.row − pos.row` (−1 up, 0 ahead, +1 down); when there is exactly one target (the edge-column fallback, where the row difference can be larger, or the boss node), `single` is true and every branch maps to it, so `targetFor(view, branch)` never returns a tile the player could not see highlighted.

Input flow: `keydown` → `routeKey` → `targetFor(view, branch)` → `dispatch({ type: "move", to })`; a `null` sends nothing (no sound, no shake, matching the engine's silent refusal). A tap calls `renderer.pick` and dispatches only if the result equals a target's `to`; other taps show the tooltip. The branch pad's buttons are rebuilt from `targets` after every dispatch, disabled when their branch is missing, and the single-target case shows one middle button. The engine still validates every move; the presentation filter only avoids sending actions that would be ignored.

Fog columns: `fogFrom` is the first column holding an unseen tile. The world renderer tints slabs per tile from `seen` (never from `fogFrom`) and moves the fog bank's near edge to `fogFrom − 0.5`; the flat renderer draws the unseen cover per tile. The boss node and the start are drawn without fog. The best-day flame is drawn from `view.bestDay` even inside fog because the boss name already reveals the date.

## World renderer (v1.6)

**Why Three.js and why billboards.** The author picked the billboard sample over the voxel one and over the flat HTML/Canvas look. Writing WebGL by hand for shadows, distance fog, instancing, tone mapping, and point lights would be several thousand lines of shader and buffer code to maintain. Three.js gives all of these, is MIT, has no runtime dependencies of its own, and ships ES modules that Vite splits into a separate chunk. Babylon.js is larger for the same features; PixiJS is 2D and has no lights or fog in depth; OGL and regl leave lights and shadows to us. Billboards keep the existing sprite grids, outline, rigs, and flash silhouettes exactly: the canvases `buildSprite` already makes become textures, so there is one sprite pipeline for both renderers and the share card.

**One canvas, two scenes.** One `WebGLRenderer` and one `<canvas>` live for the page session. `mount(host)` moves the canvas element (and the overlay canvas) into the map host or the stage slot; moving a canvas keeps its GL context. The map scene stays built during a fight (stopped, not rendered) so returning to the map costs nothing; the arena is built per fight and disposed after it. Two renderers would double GPU memory and context limits on phones; re-creating the renderer per screen risks context loss on iOS.

**Lazy loading.** `createRenderer("world")` does `await import("./world/index.ts")`; Vite 8 bundles with Rolldown, so `vite.config.ts` sets `build.rolldownOptions.output.codeSplitting.groups` to `[{ name: "three", test: /node_modules[\\/]three[\\/]/ }]`, which emits `dist/assets/three-[hash].js` (`manualChunks` is deprecated there). The start screen renders the flat teaser immediately and swaps to the 3D teaser when the chunk resolves. Only files under `src/render/world/` may import `three` (task 14.3 greps for it), so the flat path and Node tests never load it, except `tests/render/*-scene.test.ts`, which import the world modules directly.

**Scene graph (map).** `buildMapScene` creates: the ground plane (`#120e1c`), five `InstancedMesh`es of a shared `BoxGeometry(0.9, 1, 0.9)` (one per level, so each has its own lit colour and emissive; height is the instance's y scale), one `InstancedMesh` of the gravestone prop for every `deco` tile, ground label planes, the boss altar group, and one billboard per non-fog content (a tile's billboard is created the first time its tile is `seen` and kept). Fog tinting uses `setColorAt` with the level colour × 0.45 and a `needsUpdate` on the instance colour buffer only when `seen` changed. Highlights and visited frames are two small pools of line-loop frames (`EdgesGeometry` of a flat box) reused across moves. The hero is one billboard plus a `Points` aura.

**Camera.** Both cameras are `PerspectiveCamera`s with the angles in `art-style.md`. `cameraFor(view, aim, aspect)` is pure so it can be unit tested: for `aspect < 1` it widens the FOV and pulls the camera back so seven rows and three columns ahead fit. The map camera only translates (its orientation never changes during play), so `faceCamera` copies one quaternion to every billboard each frame.

**Picking.** `pickTile` converts pointer coordinates to NDC with the canvas's bounding rect, raycasts against the five slab meshes and the altar, and maps `instanceId` back to the tile through a per-level index array built once. It reuses one `Raycaster` and one `Vector2`.

**Frame loop.** One `requestAnimationFrame` loop per renderer, started by `show*` and stopped by `stop()` and by `visibilitychange` to hidden. Each frame: advance the visual clock (`dt` capped at 50 ms; hit-stop and slow motion scale it), update tweens (rise, hop, camera ease, lunges), fx pool, fireflies (in-place writes to their `Float32Array`, `needsUpdate = true`), flicker, billboard facing, `renderer.render`, then the overlay canvas text pass, then `FrameStats.push(dt)` and the quality check. Tweens live in a fixed array of reusable records; nothing in the loop calls `new`, creates arrays or closures, or uses `Array.prototype.map/filter`.

**Quality.** `nextQuality(stats, current, now, lastChange)` steps down one level when the median of the last 120 frame times is over 22 ms and at least 5 s passed since the last change; it never steps up. Applying a level sets the pixel ratio (`min(devicePixelRatio, ratioCap)`), the moon's `castShadow` and shadow map size (disposing the old map), and the visible counts of fireflies and the particle pool (`geometry.setDrawRange`). The first 60 frames after a scene is shown are ignored (shader compile and texture upload spikes).

**Textures.** Sprite textures are cached by the sprite cache key (`hero:{cls}:{race}:{frame}`, `mon:{kind}:{tier}`, plus `:white|red|gold` and rig offsets) for the page session and never disposed; the set is bounded by classes × races × frames × versions (well under 16 MB of GPU memory at these sizes). All other textures (glow, labels, fog bank noise) belong to their scene and are disposed with it.

## Renderer selection and the fallback (v1.6)

Options considered for "no WebGL": (a) a full Canvas 2D port matching the prototype pixel for pixel (lighting, drift, the 2D graveyard stage); (b) a reduced flat renderer; (c) an error screen pointing to `/prototype/`. (a) doubles Phase 3 art work for a small share of players. (c) sends players to the v1.5 rules, which no longer match the TypeScript game. **Chosen: (b).** The share card already needs a flat `drawMap` (social design), and the sprite builders are shared, so the fallback adds only the reduced stage and the highlight/boss-node drawing. Rules, HUD, sounds, gauges, and screens are identical (requirement 24.5).

`pickRenderer({ param, webgl2 })` returns `"flat"` when `param` is `"flat"` or `webgl2` is false, else `"world"`. `?renderer=world` with no WebGL 2 still gives `"flat"`. `createRenderer` then tries the dynamic import and `new WebGLRenderer(...)`.

## Error handling (v1.6 renderer)

| Operation | Failure | Recoverable? | Result for the caller | Logged |
| --- | --- | --- | --- | --- |
| `probeWebGL2()` | `getContext("webgl2")` returns `null` or throws | Yes | `false`; flat renderer | No (normal case on some devices) |
| `import("./world/index.ts")` | network error, chunk 404 after a deploy | Yes | `createRenderer` resolves with the flat renderer; log line "3D view unavailable, using the simple view." | `console.warn` once, with the error message |
| `new WebGLRenderer()` | throws (blocklisted GPU, too many contexts) | Yes | same as above | `console.warn` once |
| `webglcontextlost` | GPU reset, tab backgrounded on iOS | Yes | `preventDefault()`; frames stop; if `webglcontextrestored` comes within 3 s, rebuild the current scene's GPU resources and continue; else `main.ts` swaps to the flat renderer with the same `state` | `console.warn` on loss and on the swap |
| Shader compile error | driver bug | Yes | three logs it; the frame continues without that material; the quality check usually steps down. No swap (rare, and the scene stays playable) | three's own `console.error` |
| Sprite texture missing a key | programming error | No (bug) | `spriteTexture` throws `Error("unknown sprite key: …")` in dev builds; in production it falls back to the gravestone texture so the run continues | `console.error` |
| `pick()` miss | pointer on sky or ground | Yes | `null`; nothing dispatched | No |
| Frame loop exception | any throw inside a frame | Yes | caught per frame; the loop keeps running; after 3 consecutive throws the renderer swaps to flat | `console.error` with the first error only |

No renderer failure ever changes `RunState`, loses the save, or blocks input: `main.ts` keeps dispatching while a swap happens, and the new renderer is shown with the current state.

## External inputs (v1.6 renderer)

| Input | Required | Type and limits | On invalid |
| --- | --- | --- | --- |
| `?renderer=` URL parameter | Optional | `"world"` or `"flat"`, case-insensitive; first occurrence wins | Ignored (treated as absent); no error shown |
| `devicePixelRatio` | Always present | number; used as `min(dpr, ratioCap)`; values ≤ 0 or `NaN` treated as 1 | Clamped |
| Host element size | Required | width and height ≥ 1 CSS px after layout | Skip the resize and render at the last size; a `ResizeObserver` retries |
| Pointer coordinates | Required for `pick` | finite numbers inside the canvas rect | `null` |
| `prefers-reduced-motion` | Optional | media query match; change events honoured live | Treated as off |

## Invariants and who enforces them (v1.6)

| Invariant | Owner | Why there |
| --- | --- | --- |
| A move is legal only if it is in `legalMoves` | Engine (`checkMove`) | The renderer's filter is a convenience; the reducer is the only gate, so a bug in the presentation can never break the rules |
| Highlighted tiles equal `legalMoves(state)` | `routeView` | One pure function, unit tested, feeds both renderers and the pad |
| Fogged contents are never drawn | Both renderers, from `tile.seen` only | `seen` is engine state (P22); reading it directly avoids a second window rule |
| `three` is imported only in `src/render/world/` | Task 14.3 grep, `tech.md` | Keeps the flat path, the share card, scripts, and Node tests free of WebGL code |
| Constant number of lights per scene | `atmosphere.ts` light pool | three recompiles shaders when the light count changes; a fixed pool avoids frame spikes |
| No per-frame allocation | `world/` modules, reviewed in task 11.8 and measured in task 14.1 | GC pauses on phones show up as dropped frames |

## Reduced motion (v1.6)

`REDUCED` (from `motion.ts`, v1.6: updated on the media query's `change` event) is passed to `renderer.setReduced` at start and on change, which recomputes `motionFlags`. The world renderer then: cuts the camera (`cameraFor` result applied at once), skips the rise and overview move, skips bob, breathe, rigs, and frame animation, sets lantern intensities to their base value, stops advancing firefly and fog-bank positions (they stay visible, still), hides petals, draws the highlight without its pulse, moves the hero instantly, skips light flashes, white-outs, hit-stop, slow motion, and shake, and applies the phase-2 tint at once. Floating text fades in place. The timing gauges are HTML/2D and keep moving. This matches requirement 13.6 for the flat renderer, so both renderers honour the same list.

## Testing

Vitest runs in Node with no DOM library (adding jsdom would be a new dependency; `tech.md` says to ask first). So the pure helpers carry the unit tests, and the DOM and canvas output is checked with the Playwright power and screenshots.

**v1.6 world renderer.** Three's scene-graph classes (`Scene`, `InstancedMesh`, `Raycaster`, `Texture`, materials) run in Node without a WebGL context, so the scene builders are unit tested in Vitest: they take `deps.spriteCanvas(key)` and `deps.textCanvas(text)`, which tests replace with `{ width, height }` stubs. Only `WebGLRenderer` needs a browser; everything that touches it (`world/index.ts`) is covered by the Playwright runs in tasks 14.1 and 14.2. The pure modules (`math.ts`, `quality.ts`, `route-view.ts`, `caps.ts`) import no `three` and carry most of the logic.

| Test file | Checks |
| --- | --- |
| `tests/render/input.test.ts` | **v1.6:** `routeKey` for Up/W, Right/D, Down/S (any case), `null` for Left/A, F, Escape; `isArrowKey`; relic keys, M outside inputs only, `tileFromPoint` with a scaled canvas |
| `tests/render/route-view.test.ts` | **v1.6:** on the demo run: start gives three targets in column 1 with branches up/ahead/down and keys W/D/S; column 12 row 4 gives the single fallback target (13, 1) with `single` and every branch mapping to it; column 13 gives the boss node only, labelled Boss; no targets during a fight, a relic offer, or after the run; targets deep-equal `legalMoves` for 200 random legal walks; `fogFrom` is 3 at the start and 4 with Code Review; `bestDay` (col 11, row 2 on the demo) and `null` on the all-empty fixture; the four boss and week strings |
| `tests/render/caps.test.ts` | **v1.6:** `parseRendererParam` (`world`, `FLAT`, absent, junk, repeated); `pickRenderer` for all four probe combinations |
| `tests/render/world-math.test.ts` | **v1.6:** `slabHeight` 0.18–0.66 for levels 0–4; `tileWorld` spacing 1 and row 0 farthest; `bossNodeWorld` one unit right of the last column; `spriteWorldSize` square pixels for every role; `cameraFor` map at 16:9 and battle at 8:3 equal the `art-style.md` values, and the map camera at 390/844 keeps columns c … c + 2 and rows 0–6 inside the view frustum; the overview camera keeps every slab and the boss node in view at 16:9 and 390/844; `riseDelay` |
| `tests/render/quality.test.ts` | **v1.6:** `initialQuality`; no change before 120 samples or within 5 s; one step down when the median is 23 ms; none at 22 ms; never below `low`; never up |
| `tests/render/billboard.test.ts` | **v1.6:** `spriteTexture` sets `NearestFilter` mag and min, no mipmaps, sRGB, and returns the same texture for the same key; `makeBillboard` plane size `(w + 2) × px` by `(h + 2) × px` with the bottom at y = 0; `setFacing` flips `scale.x` only |
| `tests/render/motion-flags.test.ts` | **v1.6:** every flag true without reduced motion and false with it |
| `tests/render/atmosphere.test.ts` | **v1.6:** the rig has 1 hemisphere, 2 directional (moon casts shadows at `high`/`medium` only), and exactly 4 point lights in every state; `assignLights` gives the hero lantern, the boss node, and the two nearest seen unresolved chests or wisps, with unused lights at intensity 0; fog densities 0.035 / 0.05; firefly draw range 60 / 30 at `high` / `low`; `setFogStart` puts the bank's near edge at `col − 0.5` |
| `tests/render/map-scene.test.ts` | **v1.6:** demo map: 5 slab meshes whose instance counts add up to 91; slab heights by level; boss altar at the boss node; no billboard on unseen tiles at the start; highlight pool shows exactly the `RouteView` targets; after `syncMap` with Code Review one more column is untinted; light pool size 4 in every state; `pickTile` on a slab centre returns its tile |
| `tests/render/arena-scene.test.ts` | **v1.6:** the same source date builds the same prop positions twice; a different date differs; boss arena has the hover offset and double purple light; light count is the same as the map's pool; `disposeTree` releases every geometry and material it created |
| `tests/render/fx3d.test.ts` | **v1.6:** the particle pool never grows past its size, drops when full, and reuses slots; hit-stop and slow-motion clock scaling; reduced motion makes `shake` a no-op |
| `tests/render/layout.test.ts` | `mapTileSize` at 360, 680, 940, and 1400 px for 13 and 14 columns (clamped to 26–52); `layout` sizes with and without labels |
| `tests/render/tooltip.test.ts` | Every `tileInfo` branch, singular "contribution"; **v1.6:** "A quiet day" / ", rested", the best-day line (also in fog), the boss node lines; no "Gate" text |
| `tests/render/pacing.test.ts` | Every row of the pacing table, including the flag kept across a multi-strike plan and cleared on the next choice; **v1.6:** no flee row |
| `tests/render/hud.test.ts` | `hudView` for the demo run: XP at level 10 has no next, **v1.6:** the four boss texts (0, 2, 3 shards, banished), "Week 1/14" and "Boss", shards `{ have, max: 3 }`, maxed timing, low HP at 29% and 30% |
| `tests/render/hero-sprite.test.ts` | `heroPixels` is 24×24 for every class, race, and frame; Elf ear pixels at [7][8], [6][7], [7][15], [6][16]; Orc tusks and Vampire fangs at their cells; no mouth features on the Rogue; auto-shade on a 3×3 synthetic grid (right edge 38% dark, top-left rim 30% light, flat keys unchanged) |
| `tests/render/gauge.test.ts` | `gaugeHeadline` for every mode, pattern, and assist |
| `tests/render/personality.test.ts` | `linePool` contents per class and race; `idleStep` fidget after 3.5 s at most every 4.5 s, "z" after 14 s every 1.6 s, nothing with reduced motion |
| `tests/audio/events.test.ts` | `soundsFor` per event row above (v1.6: `rest`, `heal` from cache, `shard` with `bound`; no `blocked` or `gate`); `musicModeFor` per screen and fight; mute stops `play` |
| `tests/perf/mapgen.perf.test.ts` | `generateMap` on the dense fixture: median of 20 runs under 50 ms |
| `tests/e2e/smoke` (Playwright power) | `npm run preview`, open `?demo` with Auto-timing, play to victory and to game over through the keyboard, check every screen appears, no console errors, no audio files requested, and `/prototype/` loads |

| `tests/e2e/perf.md` (Playwright power, v1.6) | At 390 × 844, device pixel ratio 3, 4× CPU slowdown: `?demo` with Auto-timing, 20 s on the map and one full fight; read `window.__cqStats` (median frame ms, `renderer.info.render.calls`, pixel ratio, quality, `renderer.info.memory`) and check requirement 25's numbers; play three runs and compare memory counts; repeat with `?renderer=flat` and with WebGL disabled (`--disable-gpu --disable-webgl` launch flags) to check the fallback |

`window.__cqStats` is a read-only object the world renderer updates once per second in all builds (no allocation per frame: it writes into the same object). It holds visual numbers only, never game state.

Screenshot parity (v1.6): the prototype screens are no longer the visual target for the map and stage, because the TypeScript build is 3D. Task 14.2 instead takes the map and battle at 1280 × 720 and 390 × 844 from the new build next to the sample screenshots `3d-map-billboard.png` and `3d-battle-billboard.png` in `docs/look.md`, plus the flat renderer and reduced-motion versions, and checks the HTML screens (start, summary, relic offer, results) against `docs/screenshots/` as before. Task 10.3 is superseded by 14.2.

## Properties owned

None of P1–P24. Presentation draws state and adds no game rule, so its checks are unit tests of the pure helpers above, the Playwright smoke and perf runs, and the screenshot list. `routeView` reads `legalMoves` and `seen`, whose rules are P22 and P24 in the engine specs.

## Out of scope here

Game rules and their numbers (engine specs), stored data and the fetch (data-import), raid wording, challenge links, and the share card drawing (social; it reuses `drawMap` and `drawSprite` from here).
