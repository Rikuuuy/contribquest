# Requirements: presentation

## Introduction

This spec covers what the player sees, hears, and touches: the screens and their flow, keyboard, D-pad, and pointer input, the HUD and log, the map rendering (tiles, labels, fog, lighting, the rise), the sprites (24×24 heroes with race faces, 12-wide monsters and items), the combat stage and timing-test gauges, the pacing between fight steps, combat effects, the hero's portrait, speech, and idle behaviour, the relic offer and results screens, synthesized sound and music, and the non-functional requirements (performance, responsiveness, accessibility, reliability, privacy, browser support, availability).

Every value comes from `prototype/index.html` (the CSS and HTML screens, `show`, `renderHud`, `renderLog`, `renderCombat`, `showSummary`, `renderClassPick`, `renderRacePick`, `showRelicOffer`, `showEnd`, `renderTrophies`, `layout`, `drawMap`, `tileTex`, `fogTex`, `drawFogDrift`, `applyLighting`, `SPRITES`, `OUTFITS`, `RACES`, `heroKey`, `heroSpriteAt`, `heroFX`, `stageBg`, `stageHeroStrike`, `stageMonStrike`, `stageMonDeath`, `drawStage`, `drawQte`, `later`, `stageAt`, the `fx*` functions, `drawPortrait`, `heroSay`, `mapSay`, `idleTick`, `tileInfo`, `Sfx`, the key and pointer handlers, `frame`) and `.kiro/steering/art-style.md`. The renderer draws state and sends actions; it never decides an outcome (`structure.md`).

PRD IDs covered: FR-MOV-1 to FR-MOV-5 (FR-MOV-3's blocking rule is in map-generation; this spec shows it), FR-FX-1 to FR-FX-8, FR-RACE-3, and the "Non-functional requirements" section. Shown here, ruled elsewhere: FR-IMP-2, FR-IMP-3, FR-IMP-4, FR-MOV-6, FR-MOV-7, FR-COM-3, FR-COM-5, FR-COM-7, FR-CLS-1, FR-CLS-9, FR-DIF-4, FR-DIF-5, FR-RACE-1, FR-RACE-4, FR-REL-1, FR-REL-4, FR-PRO-2, FR-PRO-4, FR-TRO-2, FR-TRO-3, FR-SAV-2.

Requirements with no PRD FR ID are tagged with the PRD section they come from, for example [NFR Accessibility].

## Glossary

- **Screen**: one of `start`, `loading`, `summary`, `map`, `end`. Exactly one is visible.
- **Overlay**: the combat panel and the relic offer, drawn over the map screen.
- **Tile size T**: the map tile edge in CSS pixels.
- **Reduced motion**: `matchMedia("(prefers-reduced-motion: reduce)")` matches.
- **Stage**: the 440×190 canvas in the combat panel where the hero and monster fight.
- **Pacing delay**: the wait before `main.ts` sends `advance` to the engine after a resolved test.

## Requirements

### Requirement 1: Screens and flow

**User story:** As a first-time visitor, I want to understand the app from the start screen and reach play in one click.

#### Acceptance criteria

1.1 WHEN the app opens without launch parameters THE SYSTEM SHALL show the start screen with the title "ContribQuest", the tagline "Your GitHub graph is haunted.", the username field (max 39 characters), "Raise my graph", "Play the demo", the optional friend field (social spec), the teaser map, the four "how to play" lines and the controls line from the prototype, and the privacy line (progression requirement 12.2). [Screens, FR-SAV-2]

1.2 WHILE the start screen is visible THE SYSTEM SHALL loop the teaser: the demo map rises 700 ms after each loop start and the loop restarts every 5200 ms; with reduced motion the map is drawn already risen. [Should: graph rises]

1.3 WHEN a profile is loading THE SYSTEM SHALL show the loading screen with the text from data-import (`loadingText`), never a blank screen. [FR-IMP-2]

1.4 WHEN a load or map validation fails THE SYSTEM SHALL return to the start screen and show the error message followed by "You can still play the demo." with "play the demo" as a link that starts demo mode. [FR-IMP-3, NFR Reliability]

1.5 WHEN a screen is shown THE SYSTEM SHALL hide the others, scroll to the top, clear the low-HP overlay off the map, and set the music mode: `menu` for start, loading, and summary; `explore`, `combat`, or `boss` for the map depending on the fight; `off` after the run ends. [FR-FX-7]

1.6 WHEN the map screen is entered THE SYSTEM SHALL dispatch `enterMap`, play the rise (requirement 4.6) unless reduced motion is on or the run is continued, focus the map, and after `blessingDue` send `offerBlessing` 1500 ms later with the rise or 300 ms without. [FR-OMEN-2, FR-SAV-1]

### Requirement 2: Movement input

**User story:** As a player on a keyboard or a phone, I want to move with whatever I have.

#### Acceptance criteria

2.1 WHILE the map screen is visible and the run is exploring THE SYSTEM SHALL map ArrowUp/W, ArrowDown/S, ArrowLeft/A, ArrowRight/D to `move` actions and prevent the browser default. [FR-MOV-1]

2.2 WHERE the primary pointer is coarse (`@media (pointer: coarse)`) THE SYSTEM SHALL show a 3-column D-pad under the map whose buttons send the same `move` actions. [FR-MOV-2, NFR Responsiveness]

2.3 WHILE a relic offer is open THE SYSTEM SHALL map keys 1, 2, 3 to `pickRelic` 0, 1, 2 and ignore movement. [FR-REL-1]

2.4 WHILE a fight is shown THE SYSTEM SHALL route keys through combat-timing's `combatKey` and ignore movement keys. [FR-COM-6]

### Requirement 3: HUD and log

**User story:** As a player, I want my state visible at all times without opening anything.

#### Acceptance criteria

3.1 WHILE the map screen is visible THE SYSTEM SHALL show in the HUD: the hero name; the class name in upper case with its difficulty stars; "Timing {n}%" styled as maxed at the floor (combat-timing requirement 6.3); "Lv {level}"; an HP bar with "{hp}/{maxHp}"; an XP bar with "{xp}/{next}" (no "/next" at level 10); "ATK {atk}"; "Treasure {n}"; owned relic icons with name and text as the tooltip; "Soul shards {have}/{need}"; and "Phantom warded on {fmtShort}", "Phantom exposed on {fmtShort}", or "Phantom banished. The Gate is open". [FR-MOV-4, FR-MOV-7, FR-DIF-4, FR-REL-4]

3.2 WHEN a HUD value (level, HP, XP, ATK, treasure, shards) changes THE SYSTEM SHALL play the bump animation on it, and on a level-up the HUD flash, unless reduced motion is on. [FR-PRO-2]

3.3 WHILE HP is above 0 and below 30% of max HP during exploring or combat THE SYSTEM SHALL show the pulsing red danger overlay (not with reduced motion) and tell the audio module that HP is low. [FR-FX-6, FR-FX-7]

3.4 WHILE the map screen is visible THE SYSTEM SHALL show the last 4 log lines in an `aria-live="polite"` region. [FR-MOV-3, FR-MOV-7]

### Requirement 4: Map rendering

**User story:** As a developer, I want the map to look like my contribution graph, so that I recognize my own quarter.

#### Acceptance criteria

4.1 WHEN the map screen opens THE SYSTEM SHALL size tiles as `T = clamp(floor((avail − 40) / cols) − 4, 26, 52)` with `avail = min(940, main width − 8)`, gap 4, label offsets 34 px left and 22 px top, and draw at integer coordinates with smoothing off. [FR-MAP-2, NFR Responsiveness]

4.2 WHEN labels are drawn THE SYSTEM SHALL write "Mon", "Wed", "Fri" beside rows 1, 3, 5 and a month name above column 0 and every column whose first day is a new month's day 1–7, as GitHub does. [FR-MAP-2]

4.3 WHEN a tile is drawn THE SYSTEM SHALL use the textured rounded square for its day level, the sprite for its kind (coffin, Gate, phantom, monster by tier, chest, wisp glow, gravestone), crossed bones for resolved fights, a faded chest once taken, and no wisp once collected. [FR-MOV-5, NFR Accessibility]

4.4 WHEN a tile has been visited THE SYSTEM SHALL draw a faint warm border on it. [FR-MOV-5]

4.5 WHILE a tile is not seen THE SYSTEM SHALL draw only its textured shade under a `rgba(6,8,16,.55)` cover, hiding what it holds; the start, boss, and Gate are always drawn. The darkness layer, the hero's lantern (2.7 tiles, 3.4 with Code Review), drifting fog, and the other light holes follow `art-style.md`. [FR-MOV-6]

4.6 WHEN the rise plays THE SYSTEM SHALL grow each tile with `easeOutBack` over 420 ms, delayed `col × 70 + row × 12` ms, with the highlight flash, and show tile contents only after 65% of a tile's progress. [Should: graph rises, FR-FX-6]

4.7 WHILE the boss is warded THE SYSTEM SHALL draw the dashed ring and three orbiting shard markers, greyed for each shard collected; WHILE a monster is next to the hero THE SYSTEM SHALL draw the "!" alert. [FR-MOV-7]

4.8 WHEN the hero moves THE SYSTEM SHALL animate 140 ms between tiles with a hop and a landing squash, face the direction of a horizontal move, and draw the aura glow and `2 × aura` orbiting motes. [FR-MOV-1, PRD Story 4]

### Requirement 5: Blocked moves and messages

#### Acceptance criteria

5.1 WHEN the engine emits `blocked` THE SYSTEM SHALL play the `blocked` sound, draw a purple ring on the refused tile, shake the map by 3 px, and show the engine's log line ("The Gate is sealed. Defeat the Phantom of your best day first." or the ward message). [FR-MOV-3, FR-MOV-7]

### Requirement 6: Hero sprites

**User story:** As a player, I want my hero to look like the class and race I chose.

#### Acceptance criteria

6.1 WHEN a hero sprite is built THE SYSTEM SHALL use the class outfit grid from the prototype's `OUTFITS` (24×24) with the race's face drawn on rows 6–9, columns 9–14, the race skin, eye, and mouth colours, and the race features: Elf ears, Orc tusks, Skeleton teeth, Vampire fangs, glowing eyes for Orc, Skeleton, and Vampire; a masked outfit skips mouth features. [FR-FX-1, FR-RACE-3]

6.2 WHEN a hero sprite is built THE SYSTEM SHALL auto-shade it with light from the top left as in `art-style.md`, outline it 1 px in `#05060a`, and cache base, white, red, and gold versions. [FR-FX-1]

6.3 WHEN a hero is drawn THE SYSTEM SHALL pick the frame: `step` while moving; otherwise `blink` for 130 ms every 3400 ms; otherwise `lookL`/`lookR` when looking; otherwise `sway` and `idle` alternating every 520 ms. With reduced motion the frame is always `idle`. [FR-FX-1, FR-FX-6]

6.4 WHEN a hero is drawn THE SYSTEM SHALL add the glows on top: race eye glow, Wanderer lantern, Mage orb, Knight blade glint every 2.6 s, Rogue dagger tips every 3 s (glints off with reduced motion). [FR-FX-1]

6.5 WHEN monsters, chests, the gravestone, the coffin, and relic icons are drawn THE SYSTEM SHALL use the prototype's 12-wide `SPRITES` grids at `max(1, floor(T / 14))` on the map and at 5.5, 6, and 7 on the stage for tiers 1–3, 4, and the boss. [Visual direction]

### Requirement 7: Summary portrait and choices

**User story:** As a player choosing my hero, I want it to react to me.

#### Acceptance criteria

7.1 WHILE the summary is visible THE SYSTEM SHALL draw the hero at 6× on a 170×170 canvas with the aura glow, a breathing scale, eyes that follow the pointer (more than 50 px left or right of centre), and a class flourish in each 4 s cycle (Mage sparks, Wanderer lantern pulse, Knight glint, Rogue dagger spin). [FR-FX-2]

7.2 WHEN the portrait is clicked, or focused and Enter or Space is pressed, THE SYSTEM SHALL make the hero hop (380 ms), say a line (requirement 9), and play the `wisp` sound. [FR-FX-2, FR-FX-4]

7.3 WHEN the summary is shown THE SYSTEM SHALL render progression's `summaryView`, the five race cards and four class cards as radio buttons with a 2× sprite, the class card's stars, label, text, and `classCardLine`, and disable the unchosen cards once the hero has taken a step. [FR-IMP-4, FR-CLS-1, FR-DIF-5, FR-RACE-1]

7.4 WHEN a race or class card is chosen THE SYSTEM SHALL dispatch `chooseRace` or `chooseClass`, save the setting, re-render the summary, hop the portrait, and say the race's first line or the class line ("My lantern sees every empty day.", "Hold the line. And the shield.", "Three hits. Zero tests.", "Wait for the charge..."); a class choice also plays `levelup`. [FR-FX-2, FR-RACE-4]

7.5 WHEN Calm mode or Auto-timing is toggled on the summary THE SYSTEM SHALL save it in settings and dispatch `setOptions`. [FR-COM-7, NFR Accessibility]

7.6 WHERE the hero set is not demo data THE SYSTEM SHALL show the avatar from `https://github.com/{username}.png?size=24`, hidden if it fails to load. [Should: avatar, FR-IMP-4]

### Requirement 8: Map interaction

**User story:** As a player, I want to poke at the map and learn what each day was.

#### Acceptance criteria

8.1 WHEN the player taps or clicks a tile next to the hero while exploring THE SYSTEM SHALL dispatch the `move` toward it; WHEN the hero's own tile is tapped THE SYSTEM SHALL hop the hero (320 ms), say a line, play `wisp`, and burst gold sparks. [FR-FX-3]

8.2 WHEN the pointer hovers a day tile outside combat THE SYSTEM SHALL show a tooltip "{fmtDate} · {count} contribution{s}" over a second line: "The Phantom of this day" / "The Phantom, banished" for the boss; "Hidden in the fog" for an unseen tile; the monster name, with ", banished" once resolved; otherwise "An empty day", "A soul wisp", "A chest", "The crypt where you woke", or "The Gate", with ", taken" for a resolved chest or wisp. [FR-FX-3]

8.3 WHEN combat starts or the pointer leaves the map THE SYSTEM SHALL hide the tooltip. [FR-FX-3]

### Requirement 9: Speech bubbles

#### Acceptance criteria

9.1 WHEN the hero speaks without a given line THE SYSTEM SHALL pick a random line from the shared pool ("LGTM!", "Ship it!", "Works on my machine.", "It is not a bug, it is a feature.", "One more commit...", "Who wrote this? Oh. Me.", "git push and pray."), the race's two lines, and the class line. [FR-FX-4, FR-RACE-4]

9.2 WHEN a bubble is shown THE SYSTEM SHALL keep it 2.2 s on the portrait and 2.4 s on the map, where it fades in over 120 ms and out over the last 300 ms and stays inside the map. [FR-FX-4]

9.3 WHEN the map is entered with the rise THE SYSTEM SHALL make the hero say the race's first line 1900 ms later if the run is still exploring. [FR-FX-4, FR-RACE-4]

### Requirement 10: Idle behaviour

#### Acceptance criteria

10.1 WHILE exploring with no key or pointer input for more than 3.5 s THE SYSTEM SHALL perform the class fidget at most every 4.5 s: Mage blue sparks, Knight shield glint with the `block` sound, Rogue turns around with a hop, Wanderer lantern motes. [FR-FX-5]

10.2 WHILE exploring with no input for more than 14 s THE SYSTEM SHALL show a rising "z" every 1.6 s. [FR-FX-5]

10.3 WHEN any key or pointer input arrives THE SYSTEM SHALL reset the idle timer; WHILE reduced motion is on THE SYSTEM SHALL skip idle actions. [FR-FX-5, FR-FX-6]

### Requirement 11: Combat view and timing gauges

**User story:** As a player in a fight, I want to see the test clearly and know at once how I did.

#### Acceptance criteria

11.1 WHILE a fight is shown THE SYSTEM SHALL show the stage with both sprites, both HP bars, the monster name, the source label with "· timing {n}%", the last two combat lines or the class hint (combat-timing requirement 3.5), Attack (A) and Flee (F) in `choose`, and the "Now! (Space)" button during a test unless Auto-timing is on. HP bars change 110 ms after the hit, when it lands on the stage. [FR-COM-3, FR-CLS-9]

11.2 WHEN a test starts THE SYSTEM SHALL record its start with `performance.now()`, draw the 320×110 gauge for its mode (bar, combo marks, charge fill with the red overload end, shrinking ring with Perfect and Good bands, dashed decoy for `conflict`, frozen and jittering ring during a `flaky` pause, shield icon raised while held), and show the headline: "STRIKE! SPACE IN THE GOLD", "COMBO! HIT ALL 3 GOLD MARKS", "HOLD SPACE TO CHARGE" / "RELEASE IN THE GOLD!", "DODGE! SPACE ON THE GOLD", "AGAIN! FAST!", "FLAKY! DON'T TRUST THE PAUSE", "CONFLICT! DODGE THE SOLID RING", "SIDESTEP!" in place of "DODGE!" for the sidestep, and "HOLD TO BLOCK · TAP AT IMPACT" / "SOLID RING! HOLD, TAP AT IMPACT" for the shield; "AUTO-TIMING" with Auto-timing on. [FR-COM-5, FR-CLS-4 to FR-CLS-8]

11.3 WHEN the engine emits `graded` THE SYSTEM SHALL show its text at once in an `aria-live="assertive"` element coloured Perfect gold, Good green, or Miss red (combo: Perfect for three Perfects, Good for two or more hits), with the pop animation unless reduced motion is on. [FR-COM-5]

11.4 WHEN a test starts THE SYSTEM SHALL play `windup` for strikes and quick strikes, `warn` for other guard tests, and `stutter` when a flaky ring pauses. [FR-FX-7]

11.5 WHILE a test is in progress THE SYSTEM SHALL schedule a `timeout` at the engine's `nextDeadline`, measured from the recorded test start, and cancel it when the test resolves. [FR-COM-5]

### Requirement 12: Pacing between fight steps

**User story:** As a player, I want each hit to land and read before the next test starts.

#### Acceptance criteria

12.1 WHEN a fight enters `wait` THE SYSTEM SHALL send `advance` after the prototype's delay: after a strike, 1300 ms (boss) or 950 ms if it killed, else 1500 ms if phase 2 just began, else 600 ms, plus 170 ms for each combo hit after the first; after a guard, 1600 ms (boss) or 1250 ms if the counter killed, 1100 ms if the hero died, 750 ms (Perfect) or 500 ms before the next strike in the plan, and 1500 ms if phase 2 just began, 700 ms (Perfect), or 400 ms before returning to the choice; after a flee, 850 ms. [FR-COM-1, FR-COM-5]

12.2 WHEN phase 2 begins THE SYSTEM SHALL keep a "phase 2 just began" flag until it is used by the next strike delay or the next return to the choice, as the prototype's `phase2Fresh` does. [FR-COM-5]

12.3 WHEN the fight or run changes before a scheduled `advance` fires THE SYSTEM SHALL drop that `advance`. [FR-COM-1]

12.4 WHEN a relic offer is made THE SYSTEM SHALL show it 380 ms later with the `chest` sound, focus the first card, and hide it on pick. [FR-REL-1]

### Requirement 18: Battle screen layout

**User story:** As a player, I want fights to feel like a proper RPG battle screen, so the foe, my hero, and what is happening are all readable at a glance.

#### Acceptance criteria

18.1 WHEN a fight starts THE SYSTEM SHALL show a full-width battle screen (max 1100 px) with a top bar holding the foe's portrait, name plate, HP bar with 10% ticks, HP numbers, and chips for the source day and current timing %; for the boss it SHALL also show a Phase 2 marker at 50% and a PHASE 1 / PHASE 2 chip. [FR-FX-10, FR-COM-3]

18.2 WHILE in a fight THE SYSTEM SHALL draw an 880×330 stage at 2× logical scale with a seeded graveyard background whose ground uses the source day's green, falling petals (not with reduced motion), the hero on the left and the foe on the right, and a hero nameplate above the hero with name, HP, a timing bar, and relic icons. [FR-FX-10]

18.3 WHILE in a fight THE SYSTEM SHALL keep a battle log of the last 7 lines prefixed with ">" and the newest in bold, starting with the foe's arrival and source, the hero's entry with race and class, and the class hint. [FR-FX-10]

18.4 WHILE in a fight THE SYSTEM SHALL show HERO and FOE tabs (FOE selected at the start) with HP bars, HP numbers, attack, the foe's pattern description, and the hero's class, race, difficulty, timing %, and relics, above the Attack/Flee or Now! buttons. [FR-FX-10]

18.5 WHILE the viewport is under 760 px wide THE SYSTEM SHALL move the timing test and grade line below the stage and stack the log and side panel. [FR-FX-10, NFR Responsiveness]

### Requirement 17: Timing accuracy feedback

**User story:** As a player, I want to see how early or late each press was, so I can learn the timing instead of guessing.

#### Acceptance criteria

17.1 WHILE a ring, sidestep, or shield test runs THE SYSTEM SHALL draw the moving ring green while the current time is inside the Good window and gold (thicker, glowing) inside the Perfect window, using the same offset-corrected time that grading uses. [FR-FX-9]

17.2 WHILE a ring, sidestep, or shield test runs THE SYSTEM SHALL draw an approach strip from the test start to impact plus G, with the Perfect zone in gold, the Good zone in green, the flaky pause freezing its marker, and the conflict decoy as a dashed tick. [FR-FX-9]

17.3 WHEN a press, release, or parry is graded against a target THE SYSTEM SHALL record its signed error (press time minus target, after the offset) and append "N MS EARLY", "N MS LATE", or "ON TIME" (|error| < 8 ms) to the grade line. Early shield holds and charge overloads record nothing. [FR-FX-9]

17.4 WHILE no test is running in a fight THE SYSTEM SHALL draw the hit-error meter: centre = target, ±220 ms full width, the last test's P and G as bands, the last 12 errors as ticks with the newest highlighted, and the average of the last 20 once there are at least 5. [FR-FX-9]

17.5 WHEN the timing offset slider changes THE SYSTEM SHALL save `offset` in settings and subtract it from every later press and release time. WHEN "Use my average" is pressed with at least 5 recorded errors THE SYSTEM SHALL set the offset to the current offset plus the average, rounded to 5 ms and clamped to ±150, and clear the history. [FR-FX-9]

### Requirement 13: Combat and map effects

#### Acceptance criteria

13.1 WHEN the stage shows a hit THE SYSTEM SHALL draw the prototype's effect for it 100 ms after the attack starts: Perfect slash, burst, ring, "CRIT {n}", shake 9, 90 ms hit-stop, gold flash, `crit` sound; Good slash and "{n}", `hit`; Miss grey puff, `glance`; counter "COUNTER {n}"; charge bursts and rings; a killing hit plays the death burst 150 ms later with `death` (boss: white-out). [FR-FX-6]

13.2 WHEN the stage shows a monster strike THE SYSTEM SHALL draw 110 ms later: Perfect rings, "PERFECT!", 340 ms slow motion at ×0.3, gold flash, `dodge`; Good blue sparks and "-{n}", shake 3, `block`; Miss red burst and "-{n}", shake 10, red flash, `hurt`. [FR-FX-6]

13.3 WHEN a fight starts THE SYSTEM SHALL build the stage background from the tile's level (boss sky and moon for the boss), burst dust at 300 ms with a shake of 12 (boss) or 5, play `boss` with a white-out or `encounter`, and set the music mode. [FR-FX-6, FR-FX-7]

13.4 WHEN `phase2` is emitted THE SYSTEM SHALL after 250 ms white-out, shake 14, draw the red ring and burst and the "PHASE 2" banner, tint the boss glow red, play `phase`, and set the music to `boss2`. [FR-FX-6, FR-FX-7]

13.5 WHEN map events arrive THE SYSTEM SHALL draw the prototype's map effects: step dust, wisp homing sparks and "+5 XP", chest coins, ring, "+{gold} GOLD" and "+{n} HP", "LEVEL UP!" rings 250 ms after a level-up, "+{xp} XP" souls and coins on a kill, "TIMING {n}%" 650 ms after a pressure drop, "SHARD {n}/{m}" 300 ms after a shard, "WARD BROKEN" 750 ms after the last shard, "THE GATE OPENS" 400 ms after the boss falls, the relic name on a pick, and win confetti or falling ash on the background at the end. [FR-FX-6, FR-PRO-2, FR-MOV-7]

13.6 WHILE reduced motion is on THE SYSTEM SHALL turn off screen shake, flashes and white-outs, hit-stop and slow motion, fog drift, the rise, idle actions, sprite frame animation, bobbing, breathing, hops, glints, ambient motes, and CSS animations, and SHALL keep the timing-test gauges moving. [FR-FX-6, NFR Accessibility]

### Requirement 14: Sound and music

**User story:** As a player, I want atmosphere without downloads, and a mute that sticks.

#### Acceptance criteria

14.1 WHEN audio is used THE SYSTEM SHALL synthesize every effect and the music with Web Audio at run time; the build SHALL contain no audio files. [FR-FX-7]

14.2 WHEN audio starts THE SYSTEM SHALL build the chain (master 0.55 → compressor, music bus with a 0.34 s delay and 0.38 feedback), the drone, and the 60 ms scheduler, with the mode levels, filter frequencies, bells, and heartbeat gaps (combat 0.78 s, boss 0.5 s, phase 2 0.38 s, low HP on the map 0.9 s) in `art-style.md`. [FR-FX-7]

14.3 WHEN an engine event or UI action needs a sound THE SYSTEM SHALL play the prototype's effect for it from the set ui, step, blocked, wisp, chest, encounter, boss, windup, warn, stutter, charge, hit, crit, glance, block, dodge, hurt, death, levelup, shard, ward, gate, relic, phase, rise, win, and lose. [FR-FX-7]

14.4 WHEN the first key or pointer input arrives THE SYSTEM SHALL create or resume the audio context; before that no sound plays. [FR-FX-8]

14.5 WHEN the Sound button is pressed, or M outside a text field, THE SYSTEM SHALL toggle mute, ramp the master gain to 0 or 0.55, save `mute` in settings, and update the button to "Sound: on (M)" / "Sound: off (M)" with `aria-pressed`. [FR-FX-8]

14.6 IF Web Audio is missing or any audio call throws THEN THE SYSTEM SHALL continue the game silently. WHILE the page is hidden or muted THE SYSTEM SHALL schedule no bells or heartbeats. [FR-FX-8, NFR Reliability]

### Requirement 15: Results screen

#### Acceptance criteria

15.1 WHEN the run ends THE SYSTEM SHALL show the end screen with progression's `resultsView` (title in win or lose style, line, "IN THE GRAPH" and GitHub rows, today line), the trophy heading and grid with held and new trophies marked, and the buttons "Play this graph again", "New username", "Copy challenge link", and "Save share card". [FR-PRO-4, FR-TRO-2]

15.2 WHEN the start screen is shown THE SYSTEM SHALL show the trophy line from `startTrophyLine` and, if a valid save exists, the Continue button with `continueLabel`. [FR-TRO-3, FR-SAV-1]

### Requirement 16: Non-functional requirements

#### Acceptance criteria

16.1 WHEN a 91-day map is generated THE SYSTEM SHALL finish in under 50 ms on the CI runner; WHILE playing THE SYSTEM SHALL draw with one `requestAnimationFrame` loop aiming at 60 fps, and no animation SHALL block input for more than 300 ms (pacing waits do not block input outside fights). [NFR Performance]

16.2 WHILE the viewport is 360 px wide or more THE SYSTEM SHALL keep the game playable: tiles never below 26 px, the map canvas shrinks to the screen width with `max-width: 100%` (as in the prototype; the PRD's "integer factors and scrolls" is corrected to this) and pointer positions are scaled back to tiles, the summary drops to one column below 680 px, and the HUD, log, and D-pad stay visible. [NFR Responsiveness]

16.3 WHILE playing THE SYSTEM SHALL support every action from the keyboard, give every button and canvas a text label, keep focus on the next useful control (Attack, Now!, the first relic card, the map), distinguish tile types by shape and icon, use the pixel font only for titles, labels, grades, and floating text, and keep text at 4.5:1 contrast or more. [NFR Accessibility]

16.4 WHILE playing THE SYSTEM SHALL set no cookies, load no analytics, and show "Not affiliated with GitHub." in the footer. [NFR Privacy, Visual direction]

16.5 WHEN the site is built and deployed THE SYSTEM SHALL work in current Chrome, Firefox, Safari, and Edge on desktop and Chrome and Safari on mobile, and the deployed site SHALL keep `/prototype/` reachable. [NFR Browser support, NFR Availability]
