# Tasks: presentation

These are Phase 3 (Wed 25 – Fri 27 Nov), except task 1.3, which Phase 1 needs for the first playable build, and group 10, which ends in Phase 5. Groups need the engine API from combat-timing groups 1–7 and progression groups 1–9. Copy markup, CSS, sprite grids, colours, and timings from `prototype/index.html`; `art-style.md` loads automatically for `src/render/**` and `src/audio/**`. Each task ends with its verify command passing and a commit naming the requirement IDs.

- [ ] 1. Foundations
  - [ ] 1.1 Split the prototype's markup and CSS into `index.html` and `src/style.css` (screens, overlays, footer with "Not affiliated with GitHub."), and add `src/render/dom.ts`, `src/render/motion.ts`, `src/render/palette.ts`
    - _Requirements: 1.1, 16.3, 16.4 (Screens, NFR Accessibility, NFR Privacy)_
    - _Verify: `npm run build`_
  - [ ] 1.2 Implement `src/render/input.ts` and `src/render/layout.ts`; write `tests/render/input.test.ts` and `tests/render/layout.test.ts`
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
  - [ ] 3.1 Implement `tileTex`, `fogTex`, and `drawMap` (labels, tiles, rise, contents, visited border, warded ring, alerts, hero hop and aura) in `src/render/map/`
    - _Requirements: 4.1–4.4, 4.6–4.8 (FR-MAP-2, FR-MOV-5, FR-MOV-7, FR-FX-6)_
  - [ ] 3.2 Implement `applyLighting` and `drawFogDrift`, and the unseen-tile cover
    - _Requirements: 4.5 (FR-MOV-6)_
  - [ ] 3.3 Implement `tileInfo` and write `tests/render/tooltip.test.ts`
    - _Requirements: 8.2 (FR-FX-3)_
    - _Verify: `npx vitest --run tests/render/tooltip.test.ts`_
  - [ ] 3.4 Ask combat-timing's `move` handler to emit `moved`, and add the map screen's rAF loop, pointer tap-to-move, hero tap, hover tooltip, and blocked feedback in `src/render/screens/map.ts`
    - _Requirements: 5.1, 8.1–8.3 (FR-MOV-3, FR-FX-3)_
    - _Verify: `npm run build && npx vitest --run tests/engine/step.test.ts`_

- [ ] 4. HUD and log
  - [ ] 4.1 Implement `hudView`, `renderHud` (bump and level flash), `renderLog`, and the danger overlay in `src/render/hud.ts`; write `tests/render/hud.test.ts`
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
  - [ ] 6.1 Implement `Pacer`, `resolvedKind`, and `PACING` in `src/render/pacing.ts`; write `tests/render/pacing.test.ts`
    - _Requirements: 12.1–12.3 (FR-COM-1, FR-COM-5)_
    - _Verify: `npx vitest --run tests/render/pacing.test.ts`_
  - [ ] 6.2 Implement `drawQte` and `gaugeHeadline` in `src/render/qte-gauge.ts`; write `tests/render/gauge.test.ts`
    - _Requirements: 11.2 (FR-COM-5, FR-CLS-4 to FR-CLS-8)_
    - _Verify: `npx vitest --run tests/render/gauge.test.ts`_
  - [ ] 6.3 Combat panel in `src/render/screens/combat.ts` (sprites, HP bars with the 110 ms delay, source label, hint, buttons, Now! button, grade line) and the `advance` scheduling in `main.ts`
    - _Requirements: 11.1, 11.3, 11.5, 12.1–12.3 (FR-COM-3, FR-COM-5, FR-CLS-9)_
    - _Verify: `npm run build`_
  - [ ] 6.4 Timing accuracy feedback: colour cue and approach strip in `qte-gauge.ts`, `recordHit` / `offText` and the hit-error meter in `src/render/hit-meter.ts`, offset slider and "Use my average" on the summary; offset subtraction lives in the engine input adapter in `main.ts`
    - _Requirements: 17.1–17.5 (FR-FX-9)_
    - _Verify: `npx vitest --run tests/render/hit-meter.test.ts`_
  - [ ] 6.5 Battle screen layout: boss bar, nameplate, HERO/FOE tabs, 7-line battle log in `src/render/screens/combat.ts`; graveyard stage background at 2× in `src/render/stage-bg.ts`
    - _Requirements: 18.1–18.5 (FR-FX-10)_
    - _Verify: `npm run build` and the Playwright smoke screenshot at 1280 and 390 px_

- [ ] 7. Effects
  - [ ] 7.1 Port the `fx*` particle system to `src/render/fx.ts` and the stage to `src/render/stage.ts` (background, strike and hit effects, hit-stop, slow motion, death, phase 2)
    - _Requirements: 13.1–13.4 (FR-FX-6)_
  - [ ] 7.2 Map effects for every event in the design table, white-out, fight flashes, background confetti and ash
    - _Requirements: 13.5 (FR-FX-6, FR-PRO-2, FR-MOV-7)_
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
  - [ ] 9.2 Implement `soundsFor` and `musicModeFor` in `src/audio/events.ts`, wire them in `main.ts`, and add the Sound button and M key; write `tests/audio/events.test.ts`
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
  - [ ] 10.4 Module check: render and audio decide no outcome and import no storage directly
    - _Requirements: all (FR-MOV-1 to FR-MOV-5, FR-FX-1 to FR-FX-8, NFRs)_
    - _Verify: `npm run typecheck && npx vitest --run tests/render tests/audio && ! grep -rnE "localStorage|from ['\"]\.\./\.\./data/(fetch|cache)" src/render src/audio`_
