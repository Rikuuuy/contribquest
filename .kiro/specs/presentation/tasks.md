# Tasks: presentation

These are Phase 3 (Wed 25 – Fri 27 Nov), except task 1.3, which Phase 1 needs for the first playable build, and group 10, which ends in Phase 5. Groups need the engine API from combat-timing groups 1–7 and progression groups 1–9. Copy markup, CSS, sprite grids, colours, and timings from `prototype/index.html`; `art-style.md` loads automatically for `src/render/**` and `src/audio/**`. Each task ends with its verify command passing and a commit naming the requirement IDs.

**v1.6 (27 Nov 2026).** Groups 11–14 add the Three.js billboard renderer, the routes on screen, the flat fallback, and their checks (Phase 3; group 14 ends in Phase 5 with group 10). Groups 11–14 need map-generation groups 9–10, combat-timing group 11, and progression group 13. Todo tasks whose content changed are edited in place and marked (v1.6); task 1.3 (done) keeps its record and is changed by task 12.2; tasks 3.2 and 10.3 are superseded. The world renderer's look comes from `/projects/sandbox/preview-3d/sample-source.html` and `art-style.md` ("3D billboard world").

- [ ] 1. Foundations
  - [ ] 1.1 Split the prototype's markup and CSS into `index.html` and `src/style.css` (screens, overlays, footer with "Not affiliated with GitHub."), and add `src/render/dom.ts`, `src/render/motion.ts`, `src/render/palette.ts`
    - _Requirements: 1.1, 16.3, 16.4 (Screens, NFR Accessibility, NFR Privacy)_
    - _Verify: `npm run build`_
  - [ ] 1.2 Implement `src/render/input.ts` (v1.6: `routeKey`, `isArrowKey`, no `moveKey`) and `src/render/layout.ts`; write `tests/render/input.test.ts` and `tests/render/layout.test.ts`
    - _Requirements: 2.1, 2.3, 4.1, 14.5, 16.2 (FR-MOV-1, FR-REL-1, FR-FX-8, NFR Responsiveness)_
    - _Verify: `npx vitest --run tests/render/input.test.ts tests/render/layout.test.ts`_
  - [ ] 1.3 In `src/main.ts`, add `dispatch` and `schedule` (deadline timer only; `advance` sent at once until group 6), keyboard movement, and the D-pad, so a run can be played with plain DOM output
    - _Requirements: 2.1, 2.2, 2.4, 11.5 (FR-MOV-1, FR-MOV-2, FR-COM-5, FR-COM-6)_
    - _Verify: `npm run build`_

- [ ] 2. Sprites
  - [ ] 2.1 Copy `SPRITES` and `OUTFITS` into `src/render/sprites/grids.ts` and implement `buildSprite`, `outline`, `silhouette`, `drawSprite`, `shadow`, `glow`, `rrect`
    - _Requirements: 6.2, 6.5 (FR-FX-1, Visual direction)_
    - _Verify: `npm run typecheck`_
  - [ ] 2.2 Implement `heroPixels`, `heroKey`, `heroFrame`, `heroFX` in `src/render/sprites/hero.ts`, using `RACE_INFO` from progression for face colours and features
    - _Requirements: 6.1–6.4 (FR-FX-1, FR-RACE-3)_
  - [ ] 2.3 Write `tests/render/hero-sprite.test.ts`
    - _Requirements: 6.1–6.3_
    - _Verify: `npx vitest --run tests/render/hero-sprite.test.ts`_

- [ ] 3. Map
  - [ ] 3.1 Implement `tileTex`, `fogTex`, and `drawMap` (labels, tiles, rise, contents, visited border, unseen cover, alerts on legal monster tiles, hero hop and aura; v1.6: legal-tile highlights from `RouteView`, boss node with shard pips, best-day flame, no Gate or warded ring) in `src/render/map/`, for the flat renderer and the share card
    - _Requirements: 4.1–4.8, 23.1–23.4, 24.3 (FR-MAP-2, FR-MOV-5, FR-MOV-6, FR-MOV-7, FR-MOV-8, FR-FX-6)_
    - _Verify: `npm run build`_
  - [ ] 3.2 Implement `applyLighting` and `drawFogDrift`, and the unseen-tile cover
    - _Requirements: 4.5 (FR-MOV-6)_
    - _Superseded in v1.6 by tasks 3.1 and 11.4: the flat renderer keeps only the unseen cover (now in 3.1), and the lighting and drifting fog move to the world renderer's `atmosphere.ts`._
  - [ ] 3.3 Implement `tileInfo` and write `tests/render/tooltip.test.ts`
    - _Requirements: 8.2 (FR-FX-3)_
    - _Verify: `npx vitest --run tests/render/tooltip.test.ts`_
  - [ ] 3.4 Add the map screen in `src/render/screens/map.ts`: the renderer host, pointer tap on a legal tile through `renderer.pick`, hero tap, hover tooltip (v1.6: `moved` comes from combat-timing task 11.3; no blocked feedback)
    - _Requirements: 8.1–8.3 (FR-MOV-3, FR-FX-3)_
    - _Verify: `npm run build && npx vitest --run tests/engine/step.test.ts`_

- [ ] 4. HUD and log
  - [ ] 4.1 Implement `hudView` (v1.6: week label, shards `{ have, max: 3 }`, the four boss lines), `renderHud` (bump and level flash), `renderLog`, and the danger overlay in `src/render/hud.ts`; write `tests/render/hud.test.ts`
    - _Requirements: 3.1–3.4 (FR-MOV-4, FR-MOV-7, FR-DIF-4, FR-REL-4, FR-FX-6)_
    - _Verify: `npx vitest --run tests/render/hud.test.ts`_

- [ ] 5. Screens
  - [ ] 5.1 Start screen: teaser loop, error line with the demo link, Continue, trophy line, privacy line; loading screen; `show()` with music modes
    - _Requirements: 1.1–1.5, 15.2 (Screens, FR-IMP-2, FR-IMP-3, FR-SAV-2, FR-TRO-3, FR-SAV-1)_
    - _Verify: `npm run build`_
  - [ ] 5.2 Summary screen from `summaryView`, race and class cards with lock state, Calm and Auto-timing options, avatar
    - _Requirements: 7.3, 7.5, 7.6 (FR-IMP-4, FR-CLS-1, FR-DIF-5, FR-RACE-1, FR-COM-7)_
    - _Verify: `npm run build`_
  - [ ] 5.3 Map entry: `enterMap`, rise, blessing delay, race line after 1900 ms
    - _Requirements: 1.6, 9.3 (FR-OMEN-2, FR-FX-4, FR-RACE-4)_
    - _Verify: `npm run build`_
  - [ ] 5.4 Relic overlay (cards with icons, 380 ms delay, first card focused, keys 1–3) and the results screen from `resultsView` and `trophyList`
    - _Requirements: 12.4, 15.1 (FR-REL-1, FR-REL-4, FR-PRO-4, FR-TRO-2)_
    - _Verify: `npm run build`_

- [ ] 6. Combat view, gauges, and pacing
  - [ ] 6.1 Implement `Pacer`, `resolvedKind`, and `PACING` (v1.6: no flee row) in `src/render/pacing.ts`; write `tests/render/pacing.test.ts`
    - _Requirements: 12.1–12.3 (FR-COM-1, FR-COM-5)_
    - _Verify: `npx vitest --run tests/render/pacing.test.ts`_
  - [ ] 6.2 Implement `drawQte` and `gaugeHeadline` in `src/render/qte-gauge.ts`; write `tests/render/gauge.test.ts`
    - _Requirements: 11.2 (FR-COM-5, FR-CLS-4 to FR-CLS-8)_
    - _Verify: `npx vitest --run tests/render/gauge.test.ts`_
  - [ ] 6.3 Combat panel in `src/render/screens/combat.ts` (stage slot, HP bars with the 110 ms delay, source label, hint, Attack button with no Flee button (v1.6), Now! button, grade line) and the `advance` scheduling in `main.ts`
    - _Requirements: 11.1, 11.3, 11.5, 12.1–12.3 (FR-COM-3, FR-COM-5, FR-CLS-9)_
    - _Verify: `npm run build`_
  - [ ] 6.4 Timing accuracy feedback: colour cue and approach strip in `qte-gauge.ts`, `recordHit` / `offText` and the hit-error meter in `src/render/hit-meter.ts`, offset slider and "Use my average" on the summary; offset subtraction lives in the engine input adapter in `main.ts`
    - _Requirements: 17.1–17.5 (FR-FX-9)_
    - _Verify: `npx vitest --run tests/render/hit-meter.test.ts`_
  - [ ] 6.5 Battle screen layout: boss bar, nameplate, HERO/FOE tabs, 7-line battle log, and the 8:3 stage slot in `src/render/screens/combat.ts` (v1.6: the 2D graveyard `stage-bg.ts` is dropped; the arena is task 11.6, the flat stage task 13.2)
    - _Requirements: 18.1–18.5 (FR-FX-10)_
    - _Verify: `npm run build` and the Playwright smoke screenshot at 1280 and 390 px_

- [ ] 7. Effects
  - [ ] 7.1 Port the `fx*` particle system and floating text to `src/render/fx.ts` (used on the flat stage and, for text, on the overlay canvas) and the stage to `src/render/stage.ts` (strike and hit effects, hit-stop, slow motion, death, phase 2; v1.6: the reduced flat background is task 13.2)
    - _Requirements: 13.1–13.4 (FR-FX-6)_
    - _Verify: `npm run build`_
  - [ ] 7.2 Effects for every event in the design table (v1.6 rows: `moved`, `rest`, wisp heal, cache heal, `shard` with `bound`; no `blocked` or `gateOpen`) in both renderers, white-out, fight flashes, background confetti and ash
    - _Requirements: 13.5 (FR-FX-6, FR-PRO-2, FR-MOV-7)_
    - _Verify: `npm run build && ! grep -rnE "gateOpen|'blocked'|WARD BROKEN|GATE OPENS" src/render`_
  - [ ] 7.3 Reduced motion: gate every item in requirement 13.6 on `REDUCED`, and add the CSS `prefers-reduced-motion` rule
    - _Requirements: 6.3, 10.3, 13.6 (FR-FX-6, NFR Accessibility)_
    - _Verify: `npm run build`_

- [ ] 8. Portrait, speech, and idle
  - [ ] 8.1 Implement `HERO_LINES`, `CLASS_LINES`, `linePool`, `pickLine`, `idleStep` in `src/render/personality.ts`; write `tests/render/personality.test.ts`
    - _Requirements: 9.1, 10.1–10.3 (FR-FX-4, FR-FX-5, FR-RACE-4)_
    - _Verify: `npx vitest --run tests/render/personality.test.ts`_
  - [ ] 8.2 Summary portrait (6×, breathing, eye follow, flourish, click and key hop) and race and class choice lines
    - _Requirements: 7.1, 7.2, 7.4 (FR-FX-2, FR-FX-4)_
  - [ ] 8.3 Map bubble (2.4 s, fades, clamped), idle fidgets and "z", idle reset on any input
    - _Requirements: 9.2, 10.1–10.3 (FR-FX-4, FR-FX-5)_
    - _Verify: `npm run build`_

- [ ] 9. Audio
  - [ ] 9.1 Port `Sfx` to `src/audio/sfx.ts` (chain, drone, modes, bells, heartbeat, every effect, init on first input, mute ramp, hidden-page pause, all calls caught)
    - _Requirements: 14.1–14.4, 14.6 (FR-FX-7, FR-FX-8)_
  - [ ] 9.2 Implement `soundsFor` (v1.6 sound set: no `blocked` or `gate`; `rest`, cache heal, `bound`) and `musicModeFor` in `src/audio/events.ts`, wire them in `main.ts`, and add the Sound button and M key; write `tests/audio/events.test.ts`
    - _Requirements: 3.3, 11.4, 14.3, 14.5 (FR-FX-7, FR-FX-8)_
    - _Verify: `npx vitest --run tests/audio/events.test.ts && npm run build && ! find dist -iregex '.*\.\(mp3\|ogg\|wav\|m4a\|flac\)' | grep .`_

- [ ] 10. Non-functional checks and parity
  - [ ] 10.1 Write `tests/perf/mapgen.perf.test.ts` (dense fixture, median of 20 runs under 50 ms)
    - _Requirements: 16.1 (NFR Performance)_
    - _Verify: `npx vitest --run tests/perf/mapgen.perf.test.ts`_
  - [ ] 10.2 With the Playwright power against `npm run preview`: play `?demo` to victory and to game over by keyboard only, at 1280 px and 360 px, check every screen, no console errors, no audio file requests, `/prototype/` loads; save the script as `tests/e2e/smoke.md`
    - _Requirements: 1.1–1.6, 2.1, 16.2, 16.3, 16.5 (NFR Responsiveness, NFR Accessibility, NFR Browser support, NFR Availability)_
    - _Verify: `npm run build` then the Playwright power run described in `tests/e2e/smoke.md`_
  - [ ] 10.3 Retake every prototype screenshot in `docs/screenshots/` from the new build with the Playwright power, compare side by side in `docs/parity.md`, and fix differences; check text contrast of the palette pairs (4.5:1) in the same file
    - _Requirements: 4.1–4.8, 6.1–6.5, 11.1–11.3, 13.1–13.5, 16.3 (FR-FX-1 to FR-FX-6, FR-RACE-3, NFR Accessibility)_
    - _Verify: every row in `docs/parity.md` is ticked_
    - _Superseded in v1.6 by task 14.2: the map and stage are 3D now, so they are compared with the billboard sample screenshots instead of the prototype; the HTML screens and the contrast check move into 14.2._
  - [ ] 10.4 Module check: render and audio decide no outcome and import no storage directly
    - _Requirements: all (FR-MOV-1 to FR-MOV-5, FR-FX-1 to FR-FX-8, NFRs)_
    - _Verify: `npm run typecheck && npx vitest --run tests/render tests/audio && ! grep -rnE "localStorage|from ['\"]\.\./\.\./data/(fetch|cache)" src/render src/audio`_

- [ ] 11. Three.js billboard world (v1.6)
  - [ ] 11.1 Add `three` (`^0.187.0`) to `dependencies` and `@types/three` (`^0.187.0`) to `devDependencies`; put `three` in its own chunk named `three` with `build.rolldownOptions.output.codeSplitting.groups` (`{ name: "three", test: /node_modules[\\/]three[\\/]/ }`) in `vite.config.ts` (Vite 8 uses Rolldown, where `manualChunks` is deprecated); add the empty `src/render/world/index.ts` entry loaded with a dynamic `import()`
    - _Requirements: 25.7 (NFR Performance, Technology)_
    - _Verify: `npm ls three @types/three && npm run build && f=$(ls dist/assets/three-*.js) && test "$(gzip -9c $f | wc -c)" -le 184320`_
  - [ ] 11.2 Implement the pure world maths in `src/render/world/math.ts` (`slabHeight`, `tileWorld`, `bossNodeWorld`, `spriteWorldSize`, `followAim`, `overviewAim`, `cameraFor`, `easeOutBack`, `riseDelay`) and the reduced-motion flags in `src/render/world/motion-flags.ts`; write `tests/render/world-math.test.ts` and `tests/render/motion-flags.test.ts`
    - _Requirements: 19.1, 19.3, 19.4, 20.4, 22.7, 26.1–26.4 (FR-MAP-2, FR-MOV-6, FR-FX-6, NFR Responsiveness, NFR Accessibility)_
    - _Verify: `npx vitest --run tests/render/world-math.test.ts tests/render/motion-flags.test.ts`_
  - [ ] 11.3 Implement `src/render/world/textures.ts` (sprite texture cache from the `buildSprite` canvases, glow and label textures) and `src/render/world/billboard.ts` (`makeBillboard`, `setFacing`, `setFrame`, `faceCamera`); write `tests/render/billboard.test.ts`
    - _Requirements: 20.1–20.5 (FR-FX-1, Visual direction)_
    - _Verify: `npx vitest --run tests/render/billboard.test.ts`_
  - [ ] 11.4 Implement `src/render/world/atmosphere.ts`: the light rig with the pool of 4 point lights, `assignLights`, `flicker`, `FogExp2`, fireflies, and the fog bank over fog columns; write `tests/render/atmosphere.test.ts`
    - _Requirements: 21.1–21.5 (FR-MOV-6, Visual direction, NFR Performance)_
    - _Verify: `npx vitest --run tests/render/atmosphere.test.ts`_
  - [ ] 11.5 Implement `src/render/world/map-scene.ts`: instanced slabs per level, instanced gravestones, ground labels, rise, seen tint, content billboards, visited frames, crossed bones, hero hop and aura, `pickTile`; write `tests/render/map-scene.test.ts`
    - _Requirements: 19.1–19.6, 21.4, 25.3 (FR-MAP-2, FR-MOV-1, FR-MOV-5, FR-MOV-6, FR-FX-6)_
    - _Verify: `npx vitest --run tests/render/map-scene.test.ts`_
  - [ ] 11.6 Implement `src/render/world/arena-scene.ts`: the seeded graveyard arena from the sample, hero and foe billboards, boss variant, strike lunges and rig swaps, phase-2 tint, petals, battle camera; write `tests/render/arena-scene.test.ts`
    - _Requirements: 18.2, 22.1–22.4, 22.7 (FR-FX-10, FR-FX-6, FR-COM-3)_
    - _Verify: `npx vitest --run tests/render/arena-scene.test.ts`_
  - [ ] 11.7 Implement `src/render/world/fx3d.ts` (fixed particle pool, rings, slashes, camera shake, visual clock with hit-stop and slow motion) and `src/render/overlay.ts` (floating text and speech bubble at projected positions); write `tests/render/fx3d.test.ts`
    - _Requirements: 13.1–13.5, 19.7, 22.5, 25.4 (FR-FX-4, FR-FX-6, NFR Performance)_
    - _Verify: `npx vitest --run tests/render/fx3d.test.ts`_
  - [ ] 11.8 Implement `src/render/world/quality.ts` and `src/render/world/index.ts` (one `WebGLRenderer`, pixel ratio cap, antialias by pointer, `mount`, frame loop with no per-frame allocation, quality step-down, `window.__cqStats`, context loss and restore, `stop` on hidden pages and 2D-only screens) and `src/render/world/dispose.ts`; write `tests/render/quality.test.ts`
    - _Requirements: 19.7, 24.2, 25.1–25.6 (NFR Performance, NFR Reliability)_
    - _Verify: `npx vitest --run tests/render/quality.test.ts && npm run build`_
  - [ ] 11.9 Reduced motion in the world renderer: drive every world module from `motionFlags(REDUCED)` and honour live `prefers-reduced-motion` changes through `renderer.setReduced`
    - _Requirements: 26.1–26.4 (FR-FX-6, NFR Accessibility)_
    - _Verify: `npx vitest --run tests/render/motion-flags.test.ts tests/render/fx3d.test.ts && npm run build && ! grep -rn "matchMedia" src/render/world`_

- [ ] 12. Routes on screen (v1.6)
  - [ ] 12.1 Implement `routeView` and `targetFor` in `src/render/map/route-view.ts`; write `tests/render/route-view.test.ts`
    - _Requirements: 2.1, 2.2, 3.1, 23.1–23.5 (FR-MOV-1, FR-MOV-2, FR-MOV-6, FR-MOV-8)_
    - _Verify: `npx vitest --run tests/render/route-view.test.ts`_
  - [ ] 12.2 Change the movement wiring from task 1.3 in `src/main.ts`: keys through `routeKey` and `targetFor` send `{ type: "move", to }`, the D-pad becomes the three-button branch pad rebuilt from `RouteView`, taps go through `renderer.pick`, and the Flee button and F/Escape handling are removed
    - _Requirements: 2.1, 2.2, 2.4, 8.1, 11.1, 23.1, 23.2, 23.6 (FR-MOV-1, FR-MOV-2, FR-MOV-8, FR-COM-1, FR-COM-6)_
    - _Verify: `npx vitest --run tests/render/input.test.ts tests/render/route-view.test.ts && npm run build && ! grep -rnE "['\"]flee['\"]|moveKey" src/main.ts src/render`_

- [ ] 13. WebGL fallback (v1.6)
  - [ ] 13.1 Implement `src/render/caps.ts` (`parseRendererParam`, `pickRenderer`, `probeWebGL2`) and `src/render/renderer.ts` (`Renderer` interface, `createRenderer` with the dynamic import, the swap to flat on import, creation, context-loss, or repeated frame failures, the one-time log line); write `tests/render/caps.test.ts`
    - _Requirements: 24.1, 24.2, 24.5 (NFR Reliability, NFR Browser support)_
    - _Verify: `npx vitest --run tests/render/caps.test.ts && npm run build`_
  - [ ] 13.2 Implement the flat renderer: wrap `drawMap` (task 3.1) and the reduced stage in `src/render/stage.ts` (gradient sky, moon, path, ground band in the GitHub green, sprites at the stage scales, lunge and recoil, flashes, floating text) behind the `Renderer` interface in `src/render/flat.ts`
    - _Requirements: 24.3–24.5 (FR-FX-10, FR-FX-6, NFR Reliability)_
    - _Verify: `npm run build && ! grep -rnE "from ['\"]three" src/render/flat.ts src/render/stage.ts src/render/map`_

- [ ] 14. Renderer checks and look (v1.6; ends in Phase 5 with group 10)
  - [ ] 14.1 With the Playwright power against `npm run preview`, run the phone performance and fallback checks and save the script as `tests/e2e/perf.md`: 390 × 844 at device pixel ratio 3 with 4× CPU slowdown (median frame ≤ 33 ms on the map and in a fight, draw calls ≤ 120 / 80, pixel ratio ≤ 2, ≤ 4 point lights, memory counts equal after three runs), then `?renderer=flat` and a browser launched with WebGL disabled (both play `?demo` to victory)
    - _Requirements: 24.1–24.5, 25.1–25.8 (NFR Performance, NFR Reliability, NFR Browser support)_
    - _Verify: `npm run build` then the Playwright power run described in `tests/e2e/perf.md`, with every check passing_
  - [ ] 14.2 Take the map and a boss fight at 1280 × 720 and 390 × 844 from the new build with the Playwright power and put them next to `3d-map-billboard.png` and `3d-battle-billboard.png` in `docs/look.md`; add the flat renderer and reduced-motion shots, the HTML screens (start, summary, relic offer, results) next to `docs/screenshots/`, the legal-tile highlight, fog columns, boss node, and best-day marker, and the text contrast check of the palette pairs (4.5:1)
    - _Requirements: 6.1–6.5, 11.1–11.3, 16.3, 19.1–19.7, 20.1–20.5, 21.1–21.4, 22.1–22.4, 23.1–23.5, 24.3, 24.4, 26.1–26.3 (FR-FX-1 to FR-FX-10, FR-MOV-6, FR-MOV-8, NFR Accessibility)_
    - _Verify: every row in `docs/look.md` is ticked_
  - [ ] 14.3 Module check for the renderer: `three` is the second and last runtime dependency and is imported only under `src/render/world/`
    - _Requirements: 24.5, 25.7 (Technology, NFR Performance)_
    - _Verify: `npm run typecheck && npx vitest --run tests/render tests/audio && node -e "const d=Object.keys(require('./package.json').dependencies).sort().join();process.exit(d==='three,zod'?0:1)" && ! grep -rlE "from ['\"]three['\"/]" src | grep -v '^src/render/world/'`_
