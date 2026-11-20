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

## Module files

| File | Contents |
| --- | --- |
| `src/main.ts` | Boot (`parseLaunch`, `loadSettings`, `readRun`), `dispatch`, `schedule`, screen flow, button wiring, storage calls |
| `src/render/dom.ts` | `$`, `esc`, `show(screen)`, `sizeCanvas(cv, w, h)` (device-pixel-ratio aware, smoothing off) |
| `src/render/motion.ts` | `REDUCED` (read once from `matchMedia`) |
| `src/render/palette.ts` | The colours in `art-style.md` (`LEVEL_COLORS`, `LEVEL_HI`, sprite palette keys, grade colours, star colours) |
| `src/render/input.ts` | `moveKey(key) → Dir \| null`, `relicKey(key) → 0 \| 1 \| 2 \| null`, `isMuteKey(e)`; pointer helpers `tileFromPoint(layout, rect, x, y)` |
| `src/render/layout.ts` | `mapTileSize(avail, cols)`, `layout(map, tile, gap, labels)`, `tileXY(L, col, row)` |
| `src/render/sprites/grids.ts` | `SPRITES` (12-wide monster, chest, grave, coffin, relic grids), `OUTFITS` (24×24 class grids and `fx` points), copied from the prototype |
| `src/render/sprites/build.ts` | `buildSprite(rows, palette)`, `outline`, `silhouette`, `spriteCache` |
| `src/render/sprites/hero.ts` | `heroPixels(cls, race, frame)` (pure: race overlay, frame edits, auto-shade → colour grid), `heroKey`, `heroFrame(now, opts)`, `heroFX(ctx, …)` |
| `src/render/sprites/draw.ts` | `drawSprite(ctx, key, cx, cy, scale, alpha, opts)`, `shadow`, `glow`, `rrect` |
| `src/render/map/tiles.ts` | `tileTex`, `fogTex` (seeded with `makeRng` for stable noise) |
| `src/render/map/draw.ts` | `drawMap(ctx, map, L, opts)` (labels, tiles, rise, contents, hero, aura) |
| `src/render/map/lighting.ts` | `applyLighting`, `drawFogDrift` |
| `src/render/map/tooltip.ts` | `tileInfo(tile) → { when, what }` (pure) |
| `src/render/fx.ts` | `makeFx`, `fxBurst`, `fxText`, `fxRing`, `fxSlash`, `fxShake`, `fxUpdate`, `fxDraw`, `fxShakeOffset` |
| `src/render/stage.ts` | Combat stage: `stageReset`, `stageAt`, `stageHeroStrike`, `stageMonStrike`, `stageMonDeath`, `drawStage`, `stageBg` |
| `src/render/qte-gauge.ts` | `drawQte(ctx, test, t, opts)`, `gaugeHeadline(test, assist) → string` (pure) |
| `src/render/pacing.ts` | `Pacer` (pure): `delayFor(fight, events)`, the phase-2 flag |
| `src/render/personality.ts` | `HERO_LINES`, `CLASS_LINES`, `linePool(hero)`, `pickLine(pool, r)`, portrait state, map bubble, `idleStep(idle, now, cls) → IdleAction[]` (pure schedule) |
| `src/render/hud.ts` | `hudView(state) → HudView` (pure), `renderHud`, `renderLog`, bump tracking, danger overlay |
| `src/render/screens/start.ts` | Start screen, teaser loop, error line with the demo link, continue button, trophy line |
| `src/render/screens/summary.ts` | Summary from `summaryView`, portrait canvas, race and class cards, options |
| `src/render/screens/map.ts` | Map screen, rAF frame loop, D-pad, pointer move and hover, tooltip, idle |
| `src/render/screens/combat.ts` | Combat panel, HP bars, grade line, buttons, gauge loop |
| `src/render/screens/relic.ts` | Relic overlay cards |
| `src/render/screens/results.ts` | End screen from `resultsView` and `trophyList` |
| `src/render/background.ts` | Night-sky background canvas (stars, moon, bats, motes, end confetti) |
| `src/audio/sfx.ts` | `createAudio(getMuted)`: `init`, `play(name)`, `setMode(mode)`, `setLowHp(v)`, `setMute(m)`; the prototype's `Sfx` |
| `src/audio/events.ts` | `soundsFor(events, ctx) → SoundName[]`, `musicModeFor(state) → MusicMode` (pure) |
| `src/style.css`, `index.html` | The prototype's CSS and screen markup, split out of the single file |

## Types

```ts
// render/pacing.ts
export type PacingInput = { fight: Fight; events: readonly GameEvent[]; resolved: "strike" | "guard" | "flee" };
export class Pacer {                       // a tiny class holding the phase-2 flag; no timers inside
  phase2Fresh: boolean;
  delayFor(input: PacingInput): number;    // ms until advance
  reset(): void;                           // on fight start
}
export const PACING = {
  strikeKill: 950, strikeKillBoss: 1300, strikeNext: 600, phase2: 1500, comboGap: 170,
  counterKill: 1250, counterKillBoss: 1600, heroDown: 1100,
  nextStrikePerfect: 750, nextStrike: 500, choosePerfect: 700, choose: 400, flee: 850,
  relicShow: 380, blessingRise: 1500, blessingNoRise: 300, raceLine: 1900, levelUpFx: 250,
  hpBarDelay: 110, fightDust: 300, phase2Fx: 250,
} as const;

// render/hud.ts
export type HudView = {
  name: string; cls: string; stars: 1 | 2 | 3 | 4; timing: { pct: number; maxed: boolean };
  level: number; hp: number; maxHp: number; xp: number; next: number | null; xpPct: number;
  atk: number; treasure: number; relics: { id: RelicId; name: string; text: string }[];
  shards: { have: number; need: number }; boss: string; lowHp: boolean;
};

// render/personality.ts
export type IdleState = { last: number; action: number; z: number; hop: number };
export type IdleAction = { kind: "fidget"; cls: ClassId } | { kind: "z" };

// audio
export type SoundName = "ui" | "step" | "blocked" | "wisp" | "chest" | "encounter" | "boss" | "windup" | "warn"
  | "stutter" | "charge" | "hit" | "crit" | "glance" | "block" | "dodge" | "hurt" | "death" | "levelup"
  | "shard" | "ward" | "gate" | "relic" | "phase" | "rise" | "win" | "lose";
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
| flee | `next = escape` | 850 |

`resolvedKind(events, next)` (also in `pacing.ts`) returns `flee` when `next` is `escape`, `strike` when the events hold a `heroHit`, and `guard` otherwise. A `phase2` event sets the flag. `main.ts` stores the timer with the fight's `testId`; if the fight's `testId`, `phase`, or `status` changed when it fires, it sends nothing.

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
| `moved` (move action succeeded) | step | dust at the old tile |
| `blocked` | blocked | purple ring, shake 3 |
| `wisp` | wisp | homing sparks, "+5 XP" |
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
| `shard` | shard (300 ms); ward (750 ms) if shattered | "SHARD n/m"; "WARD BROKEN", shake 6 |
| `gateOpen` | gate (400 ms) | white-out, shake 10, "THE GATE OPENS" |
| `relicOffer` / `relicPicked` | chest (at 380 ms) / relic | cards / ring, burst, relic name |
| `won` / `lost` | win, relic at 900 ms if new trophies / lose; music off | background confetti / ash |

`moved` is a new event this spec asks combat-timing's `move` handler to emit (`{ type: "moved"; from: Pos; to: Pos }`), so the renderer can animate the hop and set the facing without reading `prev`.

## Testing

Vitest runs in Node with no DOM library (adding jsdom would be a new dependency; `tech.md` says to ask first). So the pure helpers carry the unit tests, and the DOM and canvas output is checked with the Playwright power and screenshots.

| Test file | Checks |
| --- | --- |
| `tests/render/input.test.ts` | Movement keys, relic keys, M outside inputs only, `tileFromPoint` with a scaled canvas |
| `tests/render/layout.test.ts` | `mapTileSize` at 360, 680, 940, and 1400 px for 13 and 14 columns (clamped to 26–52); `layout` sizes with and without labels |
| `tests/render/tooltip.test.ts` | Every `tileInfo` branch, singular "contribution" |
| `tests/render/pacing.test.ts` | Every row of the pacing table, including the flag kept across a multi-strike plan and cleared on the next choice |
| `tests/render/hud.test.ts` | `hudView` for the demo run: XP at level 10 has no next, the three boss texts, maxed timing, low HP at 29% and 30% |
| `tests/render/hero-sprite.test.ts` | `heroPixels` is 24×24 for every class, race, and frame; Elf ear pixels at [7][8], [6][7], [7][15], [6][16]; Orc tusks and Vampire fangs at their cells; no mouth features on the Rogue; auto-shade on a 3×3 synthetic grid (right edge 38% dark, top-left rim 30% light, flat keys unchanged) |
| `tests/render/gauge.test.ts` | `gaugeHeadline` for every mode, pattern, and assist |
| `tests/render/personality.test.ts` | `linePool` contents per class and race; `idleStep` fidget after 3.5 s at most every 4.5 s, "z" after 14 s every 1.6 s, nothing with reduced motion |
| `tests/audio/events.test.ts` | `soundsFor` per event row above; `musicModeFor` per screen and fight; mute stops `play` |
| `tests/perf/mapgen.perf.test.ts` | `generateMap` on the dense fixture: median of 20 runs under 50 ms |
| `tests/e2e/smoke` (Playwright power) | `npm run preview`, open `?demo` with Auto-timing, play to victory and to game over through the keyboard, check every screen appears, no console errors, no audio files requested, and `/prototype/` loads |

Screenshot parity: each screenshot in `docs/screenshots/` that shows a prototype screen is retaken from the new build with the Playwright power at the same size and compared side by side in `docs/parity.md` (Phase 3 exit check).

## Properties owned

None of P1–P19. Presentation draws state and adds no game rule, so its checks are unit tests of the pure helpers above, the Playwright smoke test, and the screenshot parity list.

## Out of scope here

Game rules and their numbers (engine specs), stored data and the fetch (data-import), raid wording, challenge links, and the share card drawing (social; it reuses `drawMap` and `drawSprite` from here).
