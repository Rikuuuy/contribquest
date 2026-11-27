# Requirements: presentation

## Introduction

This spec covers what the player sees, hears, and touches: the screens and their flow, keyboard, D-pad, and pointer input, the HUD and log, the map rendering (tiles, labels, fog, lighting, the rise), the sprites (24×24 heroes with race faces, 12-wide monsters and items), the combat stage and timing-test gauges, the pacing between fight steps, combat effects, the hero's portrait, speech, and idle behaviour, the relic offer and results screens, synthesized sound and music, and the non-functional requirements (performance, responsiveness, accessibility, reliability, privacy, browser support, availability).

**v1.6 (27 Nov 2026).** Two decisions change this spec. (1) Forward-only routes: the map shows the legal next tiles highlighted, columns outside the visibility window as fog, a boss node after the last week, and a marker on the best day; movement keys pick a branch; Flee, the Gate, the ward ring, and the blocked feedback are removed. (2) The TypeScript build renders with Three.js in the billboard style of the sample the author chose (`/projects/sandbox/preview-3d/`, screenshots `3d-map-billboard.png` and `3d-battle-billboard.png`): a 3D world of tile slabs with fog, moonlight, lantern lights, and fireflies, and the existing pixel-art sprites as camera-facing planes. The combat stage becomes a 3D graveyard arena. HUD, log, menus, timing gauges, and the battle panels stay HTML (and the gauges Canvas 2D) on top. Audio stays Web Audio. Without WebGL 2 the game runs on a reduced Canvas 2D renderer, the "flat renderer" (requirement 24), which is also what the share card draws with. Changed or added criteria are marked **(v1.6)**; retired criteria keep their numbers and say so. Values not in the prototype come from the sample and from `art-style.md` ("3D billboard world").

Every value comes from `prototype/index.html` (the CSS and HTML screens, `show`, `renderHud`, `renderLog`, `renderCombat`, `showSummary`, `renderClassPick`, `renderRacePick`, `showRelicOffer`, `showEnd`, `renderTrophies`, `layout`, `drawMap`, `tileTex`, `fogTex`, `drawFogDrift`, `applyLighting`, `SPRITES`, `OUTFITS`, `RACES`, `heroKey`, `heroSpriteAt`, `heroFX`, `stageBg`, `stageHeroStrike`, `stageMonStrike`, `stageMonDeath`, `drawStage`, `drawQte`, `later`, `stageAt`, the `fx*` functions, `drawPortrait`, `heroSay`, `mapSay`, `idleTick`, `tileInfo`, `Sfx`, the key and pointer handlers, `frame`) and `.kiro/steering/art-style.md`. The renderer draws state and sends actions; it never decides an outcome (`structure.md`).

PRD IDs covered: FR-MOV-1 to FR-MOV-5 (FR-MOV-3's blocking rule is in map-generation; this spec shows it), FR-MOV-8 (v1.6: the highlight and the boss node on screen; the rule is in map-generation), FR-FX-1 to FR-FX-10, FR-RACE-3, and the "Non-functional requirements" section. Shown here, ruled elsewhere: FR-IMP-2, FR-IMP-3, FR-IMP-4, FR-MOV-6, FR-MOV-7, FR-COM-3, FR-COM-5, FR-COM-7, FR-CLS-1, FR-CLS-9, FR-DIF-4, FR-DIF-5, FR-RACE-1, FR-RACE-4, FR-REL-1, FR-REL-4, FR-PRO-2, FR-PRO-4, FR-TRO-2, FR-TRO-3, FR-SAV-2.

Requirements with no PRD FR ID are tagged with the PRD section they come from, for example [NFR Accessibility].

## Glossary

- **Screen**: one of `start`, `loading`, `summary`, `map`, `end`. Exactly one is visible.
- **Overlay**: the combat panel and the relic offer, drawn over the map screen.
- **Tile size T**: the map tile edge in CSS pixels.
- **Reduced motion**: `matchMedia("(prefers-reduced-motion: reduce)")` matches.
- **Stage**: the area in the combat panel where the hero and monster fight (880×330 CSS px, requirement 18.2). (v1.6) The world renderer draws the 3D arena there (requirement 22); the flat renderer draws a reduced Canvas 2D stage.
- **Pacing delay**: the wait before `main.ts` sends `advance` to the engine after a resolved test.
- **World renderer (v1.6)**: the Three.js renderer in `src/render/world/`, the default when WebGL 2 works.
- **Flat renderer (v1.6)**: the reduced Canvas 2D renderer (`src/render/map/draw.ts`, `src/render/stage.ts`) used without WebGL 2, with `?renderer=flat`, and by the share card.
- **Billboard (v1.6)**: a textured plane showing one pixel-art sprite, turned each frame to face the camera.
- **Slab (v1.6)**: the 3D box for one day tile; its height and green tint follow the day's level.
- **Legal tile (v1.6)**: a target in the engine's `legalMoves(state)`: up to three tiles in the next column, or the boss node from the last column.
- **Fog column (v1.6)**: a column whose tiles are not `seen` (outside the visibility window, map-generation requirement 5).
- **Quality level (v1.6)**: `high`, `medium`, or `low`; sets pixel ratio, shadows, and particle counts (requirement 25).

## Requirements

### Requirement 1: Screens and flow

**User story:** As a first-time visitor, I want to understand the app from the start screen and reach play in one click.

#### Acceptance criteria

1.1 WHEN the app opens without launch parameters THE SYSTEM SHALL show the start screen with the title "ContribQuest", the tagline "Your GitHub graph is haunted.", the username field (max 39 characters), "Raise my graph", "Play the demo", the optional friend field (social spec), the teaser map, the four "how to play" lines and the controls line from the prototype, and the privacy line (progression requirement 12.2). [Screens, FR-SAV-2]

1.2 WHILE the start screen is visible THE SYSTEM SHALL loop the teaser: the demo map rises 700 ms after each loop start and the loop restarts every 5200 ms; with reduced motion the map is drawn already risen. **(v1.6)** The world renderer draws the teaser as the 3D map with the overview camera (requirement 19.4) and every tile revealed; until the `three` chunk has loaded, and with the flat renderer, the flat teaser is drawn. [Should: graph rises]

1.3 WHEN a profile is loading THE SYSTEM SHALL show the loading screen with the text from data-import (`loadingText`), never a blank screen. [FR-IMP-2]

1.4 WHEN a load or map validation fails THE SYSTEM SHALL return to the start screen and show the error message followed by "You can still play the demo." with "play the demo" as a link that starts demo mode. [FR-IMP-3, NFR Reliability]

1.5 WHEN a screen is shown THE SYSTEM SHALL hide the others, scroll to the top, clear the low-HP overlay off the map, and set the music mode: `menu` for start, loading, and summary; `explore`, `combat`, or `boss` for the map depending on the fight; `off` after the run ends. [FR-FX-7]

1.6 WHEN the map screen is entered THE SYSTEM SHALL dispatch `enterMap`, play the rise (requirement 4.6) unless reduced motion is on or the run is continued, focus the map, and after `blessingDue` send `offerBlessing` 1500 ms later with the rise or 300 ms without. [FR-OMEN-2, FR-SAV-1]

### Requirement 2: Movement input

**User story:** As a player on a keyboard or a phone, I want to move with whatever I have.

#### Acceptance criteria

2.1 **(v1.6)** WHILE the map screen is visible and the run is exploring THE SYSTEM SHALL map ArrowUp/W to the legal tile in row r − 1, ArrowRight/D to the one in row r, and ArrowDown/S to the one in row r + 1 of the next column, sending `{ type: "move", to }`, and prevent the browser default for all four arrow keys. WHEN exactly one legal tile exists (the edge-column fallback or the boss node) THE SYSTEM SHALL send it for any of those keys. A key with no legal tile, and ArrowLeft/A, SHALL send nothing. [FR-MOV-1]

2.2 **(v1.6)** WHERE the primary pointer is coarse (`@media (pointer: coarse)`) THE SYSTEM SHALL show a branch pad under the map with three buttons, "↗ Up", "→ Ahead", "↘ Down" (labelled "⚔ Boss" in the single middle button when the only legal tile is the boss node), each disabled when its branch has no legal tile, sending the same `move` actions as requirement 2.1. [FR-MOV-2, NFR Responsiveness]

2.3 WHILE a relic offer is open THE SYSTEM SHALL map keys 1, 2, 3 to `pickRelic` 0, 1, 2 and ignore movement. [FR-REL-1]

2.4 WHILE a fight is shown THE SYSTEM SHALL route keys through combat-timing's `combatKey` and ignore movement keys. **(v1.6)** F and Escape do nothing in a fight; there is no Flee. [FR-COM-6]

### Requirement 3: HUD and log

**User story:** As a player, I want my state visible at all times without opening anything.

#### Acceptance criteria

3.1 WHILE the map screen is visible THE SYSTEM SHALL show in the HUD: the hero name; the class name in upper case with its difficulty stars; "Timing {n}%" styled as maxed at the floor (combat-timing requirement 6.3); "Lv {level}"; an HP bar with "{hp}/{maxHp}"; an XP bar with "{xp}/{next}" (no "/next" at level 10); "ATK {atk}"; "Treasure {n}"; owned relic icons with name and text as the tooltip; **(v1.6)** "Week {col + 1}/{cols}" (after the last week, "Boss"); "Soul shards {have}/3"; and the boss line: "The Phantom of {fmtShort} waits after the last week" with 0 shards, "The Phantom of {fmtShort}: {10 × have}% weaker" with 1–2, "The Phantom of {fmtShort} is bound: no Phase 2" with 3, and "Phantom banished" after the win. (Was: "Soul shards {have}/{need}" and the warded, exposed, and Gate lines.) [FR-MOV-4, FR-MOV-7, FR-DIF-4, FR-REL-4]

3.2 WHEN a HUD value (level, HP, XP, ATK, treasure, shards) changes THE SYSTEM SHALL play the bump animation on it, and on a level-up the HUD flash, unless reduced motion is on. [FR-PRO-2]

3.3 WHILE HP is above 0 and below 30% of max HP during exploring or combat THE SYSTEM SHALL show the pulsing red danger overlay (not with reduced motion) and tell the audio module that HP is low. [FR-FX-6, FR-FX-7]

3.4 WHILE the map screen is visible THE SYSTEM SHALL show the last 4 log lines in an `aria-live="polite"` region. [FR-MOV-3, FR-MOV-7]

### Requirement 4: Map rendering

**User story:** As a developer, I want the map to look like my contribution graph, so that I recognize my own quarter.

**(v1.6)** This requirement now describes the flat renderer (WebGL fallback, `?renderer=flat`, and the share card). The world renderer follows requirements 19–21 and 23; criteria 4.2, 4.4, 4.6, and 4.8 apply to both.

#### Acceptance criteria

4.1 WHEN the map screen opens THE SYSTEM SHALL size tiles as `T = clamp(floor((avail − 40) / cols) − 4, 26, 52)` with `avail = min(940, main width − 8)`, gap 4, label offsets 34 px left and 22 px top, and draw at integer coordinates with smoothing off. [FR-MAP-2, NFR Responsiveness]

4.2 WHEN labels are drawn THE SYSTEM SHALL write "Mon", "Wed", "Fri" beside rows 1, 3, 5 and a month name above column 0 and every column whose first day is a new month's day 1–7, as GitHub does. [FR-MAP-2]

4.3 **(v1.6)** WHEN a tile is drawn THE SYSTEM SHALL use the textured rounded square for its day level, the sprite for its kind (coffin, monster by tier, chest, wisp glow, gravestone), crossed bones for resolved fights, a faded chest once taken, no wisp once collected, and a small purple flame marker on the `bestDay` tile. The boss node is drawn as one extra rounded square, 1.5 T tall, one gap right of the last column at the boss node's row, holding the phantom sprite (crossed bones once banished). There is no Gate sprite. [FR-MOV-5, FR-MOV-8, NFR Accessibility]

4.4 WHEN a tile has been visited THE SYSTEM SHALL draw a faint warm border on it. [FR-MOV-5]

4.5 **(v1.6)** WHILE a tile is not seen THE SYSTEM SHALL draw only its textured shade under a `rgba(6,8,16,.55)` cover, hiding what it holds; the start and the boss node are always drawn. The flat renderer draws no darkness layer, lantern holes, or fog drift (they are retired with the √5 lantern radius); the window of seen columns is the only fog. [FR-MOV-6]

4.6 WHEN the rise plays THE SYSTEM SHALL grow each tile with `easeOutBack` over 420 ms, delayed `col × 70 + row × 12` ms, with the highlight flash, and show tile contents only after 65% of a tile's progress. [Should: graph rises, FR-FX-6]

4.7 **(v1.6)** WHILE the run is exploring THE SYSTEM SHALL draw the legal-tile highlight (requirement 23.1) and the "!" alert over each unresolved monster on a legal tile, and three shard pips beside the boss node, lit gold for each shard held. (Was: the warded ring and the "!" for adjacent monsters.) [FR-MOV-7, FR-MOV-8]

4.8 **(v1.6)** WHEN the hero moves THE SYSTEM SHALL animate 140 ms between tiles with a hop and a landing squash, keep the hero facing right (every move goes one column right), and draw the aura glow and `2 × aura` orbiting motes. [FR-MOV-1, PRD Story 4]

### Requirement 5: Blocked moves and messages (retired in v1.6)

#### Acceptance criteria

5.1 *Retired in v1.6.* The engine no longer emits `blocked`: an illegal move is ignored with no event (combat-timing requirement 22), so there is no blocked sound, ring, shake, or Gate and ward message. The highlight (requirement 23.1) shows what is legal instead. [was FR-MOV-3, FR-MOV-7]

### Requirement 6: Hero sprites

**User story:** As a player, I want my hero to look like the class and race I chose.

#### Acceptance criteria

6.1 WHEN a hero sprite is built THE SYSTEM SHALL use the class outfit grid from the prototype's `OUTFITS` (24×24) with the race's face drawn on rows 6–9, columns 9–14, the race skin, eye, and mouth colours, and the race features: Elf ears, Orc tusks, Skeleton teeth, Vampire fangs, glowing eyes for Orc, Skeleton, and Vampire; a masked outfit skips mouth features. [FR-FX-1, FR-RACE-3]

6.2 WHEN a hero sprite is built THE SYSTEM SHALL auto-shade it with light from the top left as in `art-style.md`, outline it 1 px in `#05060a`, and cache base, white, red, and gold versions. [FR-FX-1]

6.3 WHEN a hero is drawn THE SYSTEM SHALL pick the frame: `step` while moving; otherwise `blink` for 130 ms every 3400 ms; otherwise `lookL`/`lookR` when looking; otherwise `sway` and `idle` alternating every 520 ms. With reduced motion the frame is always `idle`. [FR-FX-1, FR-FX-6]

6.4 WHEN a hero is drawn THE SYSTEM SHALL add the glows on top: race eye glow, Wanderer lantern, Mage orb, Knight blade glint every 2.6 s, Rogue dagger tips every 3 s (glints off with reduced motion). [FR-FX-1]

6.5 WHEN monsters, chests, the gravestone, the coffin, and relic icons are drawn THE SYSTEM SHALL use the prototype's 12-wide `SPRITES` grids at `max(1, floor(T / 14))` on the map and at 5.5, 6, and 7 on the stage for tiers 1–3, 4, and the boss. **(v1.6)** The same sprite canvases (requirement 6.2) are the textures for the world renderer's billboards (requirement 20); its sizes follow `art-style.md` "Scale rules". [Visual direction]

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

8.1 **(v1.6)** WHEN the player taps or clicks a legal tile (or the boss node when it is legal) while exploring THE SYSTEM SHALL dispatch `{ type: "move", to }` for it; a tap on any other tile SHALL only show its tooltip. The world renderer finds the tile with a raycast against the slabs, the flat renderer with `tileFromPoint`. WHEN the hero's own tile is tapped THE SYSTEM SHALL hop the hero (320 ms), say a line, play `wisp`, and burst gold sparks. [FR-FX-3]

8.2 **(v1.6)** WHEN the pointer hovers a day tile outside combat THE SYSTEM SHALL show a tooltip "{fmtDate} · {count} contribution{s}" over a second line: "Hidden in the fog" for an unseen tile; the monster name, with ", banished" once resolved; otherwise "A quiet day", "A soul wisp", "A chest", or "The crypt where you woke", with ", taken" for a resolved chest or wisp and ", rested" for a resolved quiet day. On the `bestDay` tile a third line reads "The Phantom rose from this day." (shown even in the fog). On the boss node the tooltip reads "The Phantom of {fmtDate}" over "Waits after the last week" or "Banished". (Was: "The Gate" and the boss-tile lines.) [FR-FX-3, FR-MOV-8]

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

11.1 WHILE a fight is shown THE SYSTEM SHALL show the stage with both sprites, both HP bars, the monster name, the source label with "· timing {n}%", the last two combat lines or the class hint (combat-timing requirement 3.5), Attack (A) in `choose` (**v1.6:** there is no Flee button), and the "Now! (Space)" button during a test unless Auto-timing is on. HP bars change 110 ms after the hit, when it lands on the stage. [FR-COM-3, FR-CLS-9]

11.2 WHEN a test starts THE SYSTEM SHALL record its start with `performance.now()`, draw the 320×110 gauge for its mode (bar, combo marks, charge fill with the red overload end, shrinking ring with Perfect and Good bands, dashed decoy for `conflict`, frozen and jittering ring during a `flaky` pause, shield icon raised while held), and show the headline: "STRIKE! SPACE IN THE GOLD", "COMBO! HIT ALL 3 GOLD MARKS", "HOLD SPACE TO CHARGE" / "RELEASE IN THE GOLD!", "DODGE! SPACE ON THE GOLD", "AGAIN! FAST!", "FLAKY! DON'T TRUST THE PAUSE", "CONFLICT! DODGE THE SOLID RING", "SIDESTEP!" in place of "DODGE!" for the sidestep, and "HOLD TO BLOCK · TAP AT IMPACT" / "SOLID RING! HOLD, TAP AT IMPACT" for the shield; "AUTO-TIMING" with Auto-timing on. [FR-COM-5, FR-CLS-4 to FR-CLS-8]

11.3 WHEN the engine emits `graded` THE SYSTEM SHALL show its text at once in an `aria-live="assertive"` element coloured Perfect gold, Good green, or Miss red (combo: Perfect for three Perfects, Good for two or more hits), with the pop animation unless reduced motion is on. [FR-COM-5]

11.4 WHEN a test starts THE SYSTEM SHALL play `windup` for strikes and quick strikes, `warn` for other guard tests, and `stutter` when a flaky ring pauses. [FR-FX-7]

11.5 WHILE a test is in progress THE SYSTEM SHALL schedule a `timeout` at the engine's `nextDeadline`, measured from the recorded test start, and cancel it when the test resolves. [FR-COM-5]

### Requirement 12: Pacing between fight steps

**User story:** As a player, I want each hit to land and read before the next test starts.

#### Acceptance criteria

12.1 WHEN a fight enters `wait` THE SYSTEM SHALL send `advance` after the prototype's delay: after a strike, 1300 ms (boss) or 950 ms if it killed, else 1500 ms if phase 2 just began, else 600 ms, plus 170 ms for each combo hit after the first; after a guard, 1600 ms (boss) or 1250 ms if the counter killed, 1100 ms if the hero died, 750 ms (Perfect) or 500 ms before the next strike in the plan, and 1500 ms if phase 2 just began, 700 ms (Perfect), or 400 ms before returning to the choice. (**v1.6:** the 850 ms flee delay is removed with Flee.) [FR-COM-1, FR-COM-5]

12.2 WHEN phase 2 begins THE SYSTEM SHALL keep a "phase 2 just began" flag until it is used by the next strike delay or the next return to the choice, as the prototype's `phase2Fresh` does. [FR-COM-5]

12.3 WHEN the fight or run changes before a scheduled `advance` fires THE SYSTEM SHALL drop that `advance`. [FR-COM-1]

12.4 WHEN a relic offer is made THE SYSTEM SHALL show it 380 ms later with the `chest` sound, focus the first card, and hide it on pick. [FR-REL-1]

### Requirement 18: Battle screen layout

**User story:** As a player, I want fights to feel like a proper RPG battle screen, so the foe, my hero, and what is happening are all readable at a glance.

#### Acceptance criteria

18.1 WHEN a fight starts THE SYSTEM SHALL show a full-width battle screen (max 1100 px) with a top bar holding the foe's portrait, name plate, HP bar with 10% ticks, HP numbers, and chips for the source day and current timing %; for the boss it SHALL also show a Phase 2 marker at 50% and a PHASE 1 / PHASE 2 chip. [FR-FX-10, FR-COM-3]

18.2 **(v1.6)** WHILE in a fight THE SYSTEM SHALL fill an 880×330 CSS px stage (8:3, shrinking with the screen width) with the 3D graveyard arena of requirement 22 (flat renderer: the reduced stage of requirement 24.4), the hero on the left and the foe on the right, and an HTML hero nameplate above the stage's hero side with name, HP, a timing bar, and relic icons. [FR-FX-10]

18.3 WHILE in a fight THE SYSTEM SHALL keep a battle log of the last 7 lines prefixed with ">" and the newest in bold, starting with the foe's arrival and source, the hero's entry with race and class, and the class hint. [FR-FX-10]

18.4 WHILE in a fight THE SYSTEM SHALL show HERO and FOE tabs (FOE selected at the start) with HP bars, HP numbers, attack, the foe's pattern description, and the hero's class, race, difficulty, timing %, and relics, above the Attack (v1.6: no Flee) or Now! buttons. [FR-FX-10]

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

**(v1.6)** Criteria 13.1–13.4 apply to both renderers. The world renderer draws the bursts, rings, slashes, and sparks as pooled 3D particles in the arena, shakes by moving the camera (shake n px = n / 100 world units), and draws floating text on the overlay canvas at the projected position (requirement 22.5); the flat renderer draws them on the stage canvas as the prototype does.

13.1 WHEN the stage shows a hit THE SYSTEM SHALL draw the prototype's effect for it 100 ms after the attack starts: Perfect slash, burst, ring, "CRIT {n}", shake 9, 90 ms hit-stop, gold flash, `crit` sound; Good slash and "{n}", `hit`; Miss grey puff, `glance`; counter "COUNTER {n}"; charge bursts and rings; a killing hit plays the death burst 150 ms later with `death` (boss: white-out). [FR-FX-6]

13.2 WHEN the stage shows a monster strike THE SYSTEM SHALL draw 110 ms later: Perfect rings, "PERFECT!", 340 ms slow motion at ×0.3, gold flash, `dodge`; Good blue sparks and "-{n}", shake 3, `block`; Miss red burst and "-{n}", shake 10, red flash, `hurt`. [FR-FX-6]

13.3 WHEN a fight starts THE SYSTEM SHALL build the stage background from the tile's level (boss sky and moon for the boss), burst dust at 300 ms with a shake of 12 (boss) or 5, play `boss` with a white-out or `encounter`, and set the music mode. [FR-FX-6, FR-FX-7]

13.4 WHEN `phase2` is emitted THE SYSTEM SHALL after 250 ms white-out, shake 14, draw the red ring and burst and the "PHASE 2" banner, tint the boss glow red, play `phase`, and set the music to `boss2`. [FR-FX-6, FR-FX-7]

13.5 **(v1.6)** WHEN map events arrive THE SYSTEM SHALL draw the map effects: step dust on `moved`; wisp homing sparks, "+5 XP", and "+{healed} HP" 220 ms later when `healed > 0`; on `rest`, soft green motes and "+{healed} HP" (or "RESTED" when `healed` is 0); chest coins, ring, "+{gold} GOLD" and "+{n} HP"; "+{n} HP" with the CI Cache icon on `heal` with `source: "cache"`; "LEVEL UP!" rings 250 ms after a level-up; "+{xp} XP" souls and coins on a kill; "TIMING {n}%" 650 ms after a pressure drop; "SHARD {have}/3" 300 ms after a shard, and "PHANTOM BOUND" 750 ms later when `bound`; the relic name on a pick; and win confetti or falling ash on the background at the end. (Removed: "WARD BROKEN" and "THE GATE OPENS".) [FR-FX-6, FR-PRO-2, FR-MOV-7]

13.6 WHILE reduced motion is on THE SYSTEM SHALL turn off screen shake, flashes and white-outs, hit-stop and slow motion, fog drift, the rise, idle actions, sprite frame animation, bobbing, breathing, hops, glints, ambient motes, and CSS animations, and SHALL keep the timing-test gauges moving. **(v1.6)** The world renderer's reduced-motion behaviour is requirement 26. [FR-FX-6, NFR Accessibility]

### Requirement 14: Sound and music

**User story:** As a player, I want atmosphere without downloads, and a mute that sticks.

#### Acceptance criteria

14.1 WHEN audio is used THE SYSTEM SHALL synthesize every effect and the music with Web Audio at run time; the build SHALL contain no audio files. [FR-FX-7]

14.2 WHEN audio starts THE SYSTEM SHALL build the chain (master 0.55 → compressor, music bus with a 0.34 s delay and 0.38 feedback), the drone, and the 60 ms scheduler, with the mode levels, filter frequencies, bells, and heartbeat gaps (combat 0.78 s, boss 0.5 s, phase 2 0.38 s, low HP on the map 0.9 s) in `art-style.md`. [FR-FX-7]

14.3 WHEN an engine event or UI action needs a sound THE SYSTEM SHALL play the prototype's effect for it from the set ui, step, wisp, chest, encounter, boss, windup, warn, stutter, charge, hit, crit, glance, block, dodge, hurt, death, levelup, shard, ward, relic, phase, rise, win, and lose. **(v1.6)** `blocked` and `gate` are removed with their events; `ward` now plays when the Phantom is bound (3 shards); `rest` plays `wisp` at half gain. [FR-FX-7]

14.4 WHEN the first key or pointer input arrives THE SYSTEM SHALL create or resume the audio context; before that no sound plays. [FR-FX-8]

14.5 WHEN the Sound button is pressed, or M outside a text field, THE SYSTEM SHALL toggle mute, ramp the master gain to 0 or 0.55, save `mute` in settings, and update the button to "Sound: on (M)" / "Sound: off (M)" with `aria-pressed`. [FR-FX-8]

14.6 IF Web Audio is missing or any audio call throws THEN THE SYSTEM SHALL continue the game silently. WHILE the page is hidden or muted THE SYSTEM SHALL schedule no bells or heartbeats. [FR-FX-8, NFR Reliability]

### Requirement 15: Results screen

#### Acceptance criteria

15.1 WHEN the run ends THE SYSTEM SHALL show the end screen with progression's `resultsView` (title in win or lose style, line, "IN THE GRAPH" and GitHub rows, today line), the trophy heading and grid with held and new trophies marked, and the buttons "Play this graph again", "New username", "Copy challenge link", and "Save share card". [FR-PRO-4, FR-TRO-2]

15.2 WHEN the start screen is shown THE SYSTEM SHALL show the trophy line from `startTrophyLine` and, if a valid save exists, the Continue button with `continueLabel`. [FR-TRO-3, FR-SAV-1]

### Requirement 16: Non-functional requirements

#### Acceptance criteria

16.1 WHEN a 91-day map is generated THE SYSTEM SHALL finish in under 50 ms on the CI runner; WHILE playing THE SYSTEM SHALL draw with one `requestAnimationFrame` loop aiming at 60 fps, and no animation SHALL block input for more than 300 ms (pacing waits do not block input outside fights). **(v1.6)** The world renderer's phone budgets are requirement 25. [NFR Performance]

16.2 WHILE the viewport is 360 px wide or more THE SYSTEM SHALL keep the game playable: tiles never below 26 px, the map canvas shrinks to the screen width with `max-width: 100%` (as in the prototype; the PRD's "integer factors and scrolls" is corrected to this) and pointer positions are scaled back to tiles, the summary drops to one column below 680 px, and the HUD, log, and D-pad stay visible. [NFR Responsiveness]

16.3 WHILE playing THE SYSTEM SHALL support every action from the keyboard, give every button and canvas a text label, keep focus on the next useful control (Attack, Now!, the first relic card, the map), distinguish tile types by shape and icon, use the pixel font only for titles, labels, grades, and floating text, and keep text at 4.5:1 contrast or more. [NFR Accessibility]

16.4 WHILE playing THE SYSTEM SHALL set no cookies, load no analytics, and show "Not affiliated with GitHub." in the footer. [NFR Privacy, Visual direction]

16.5 WHEN the site is built and deployed THE SYSTEM SHALL work in current Chrome, Firefox, Safari, and Edge on desktop and Chrome and Safari on mobile, and the deployed site SHALL keep `/prototype/` reachable. **(v1.6)** All of these support WebGL 2; where it is disabled or fails, the flat renderer keeps the game fully playable (requirement 24). [NFR Browser support, NFR Availability]

### Requirement 19: 3D world (v1.6)

**User story:** As a player, I want my contribution graph as a small haunted 3D world, so that the quarter feels like a place I climb through.

#### Acceptance criteria

19.1 WHEN the map screen opens with the world renderer THE SYSTEM SHALL draw one slab per day tile, 0.9 × 0.9 world units on a 1-unit grid (column → x, row → z, row 0 farthest from the camera), with height `0.18 + 0.12 × level` and the level's lit colour and emissive glow from `art-style.md`; void cells get no slab. [FR-MAP-2, Visual direction]

19.2 WHEN the map is drawn THE SYSTEM SHALL lay "Mon", "Wed", "Fri" and the month names (the rule of requirement 4.2) as flat text planes on the ground, left of column 0 and beyond row 0, in the pixel font. [FR-MAP-2]

19.3 WHILE exploring THE SYSTEM SHALL use the follow camera from `art-style.md` aimed 1.5 columns right of the hero's column at the map's middle row, and SHALL ease to a new aim over 400 ms after each move, so the hero's column and the next two columns stay in view on every supported screen size. [FR-MOV-6, NFR Responsiveness]

19.4 WHEN the rise plays, and on the start-screen teaser, THE SYSTEM SHALL use the overview camera that frames the whole map and the boss node, then (after the rise) ease to the follow camera over 600 ms. The rise grows each slab's height from 0 with `easeOutBack` over 420 ms, delayed `col × 70 + row × 12` ms, and shows tile contents after 65% of a slab's progress (requirement 4.6). [Should: graph rises, FR-FX-6]

19.5 WHEN the hero moves THE SYSTEM SHALL move the hero billboard from the old slab top to the new one in 140 ms along an arc 0.35 units high, with a landing squash (scale y 0.85 for 80 ms), and draw the purple aura glow and `2 × aura` motes as 3D points around it (requirement 4.8). [FR-MOV-1, PRD Story 4]

19.6 WHEN a tile is visited THE SYSTEM SHALL draw a thin warm `#ffb13c` frame on its slab top (requirement 4.4); WHEN a fight on a tile is won THE SYSTEM SHALL replace the monster billboard with the crossed-bones sprite; a taken chest fades to 40% opacity; a collected wisp disappears. [FR-MOV-5]

19.7 WHILE the map or a fight is shown THE SYSTEM SHALL draw all 3D content on one WebGL canvas, with the HUD, log, tooltip, speech bubble, menus, relic offer, and battle panels as HTML on top, and floating text on one 2D overlay canvas of the same size with `pointer-events: none`. [Screens, NFR Accessibility]

### Requirement 20: Billboard sprites (v1.6)

**User story:** As a player who liked the pixel art, I want the same heroes and monsters in the 3D world, crisp and readable.

#### Acceptance criteria

20.1 WHEN a character, chest, wisp, gravestone, coffin, or crossed-bones sprite is placed in the world THE SYSTEM SHALL draw it as a plane textured with the sprite canvas from requirement 6.2 (with its 1 px `#05060a` outline baked in), with nearest-neighbour filtering for both magnification and minification, no mipmaps, sRGB colour, and alpha test 0.5. [FR-FX-1, Visual direction]

20.2 WHILE a billboard is shown THE SYSTEM SHALL turn it to face the camera every frame (copying the camera's orientation), anchor it at its bottom centre on the slab top or arena floor, and mirror it horizontally (never by rotating it) to set its facing: the hero faces right, monsters face the hero. [FR-FX-1]

20.3 WHEN a sprite's frame, rig offset, or flash version changes (idle, sway, step, blink, look; white, red, gold silhouettes) THE SYSTEM SHALL swap the billboard's texture to the cached texture for that key; it SHALL NOT redraw or re-upload a texture that is already cached. [FR-FX-1, FR-FX-6]

20.4 WHEN a billboard is sized THE SYSTEM SHALL make one sprite pixel the world size given in `art-style.md` "Scale rules", so that a sprite's pixels are square and every sprite of the same role has the same pixel size. [Visual direction]

20.5 WHILE a billboard is shown THE SYSTEM SHALL let it cast a moon shadow at quality `high` and `medium`, and SHALL draw the glow points (`heroFX`, `bossFX`) as additive sprites at the matching pixel positions. [FR-FX-1]

### Requirement 21: Lighting, fog, and atmosphere (v1.6)

**User story:** As a player, I want the graveyard to feel dark and alive at night without hiding what I need to see.

#### Acceptance criteria

21.1 WHEN a world scene is built THE SYSTEM SHALL light it with the fixed rig in `art-style.md` (purple hemisphere light, cold moon directional light with shadows, warm fill light, the moon disc and halo) plus a fixed pool of four point lights that are moved and dimmed but never added or removed while a scene is shown. [Visual direction, NFR Performance]

21.2 WHILE exploring THE SYSTEM SHALL assign the point lights to the hero's lantern (warm `#ffb35c`, following the hero), the boss node (purple `#a070ff`), and the two nearest seen, unresolved chests or wisps; unused lights have intensity 0. Lanterns flicker as in `art-style.md`. [FR-MOV-6, Visual direction]

21.3 WHILE a scene is shown THE SYSTEM SHALL apply exponential distance fog in the sky colour (`FogExp2`, density 0.035 on the map, 0.05 in the arena) and draw drifting fireflies (map 60, arena 50, halved at quality `low`). [Visual direction]

21.4 WHILE a column is a fog column THE SYSTEM SHALL draw its slabs at their height and level tint darkened to 45% brightness, draw no contents on them, and lay a low, slowly drifting fog bank (translucent noise planes 0.25–0.6 units above the slabs) over all fog columns; the bank's near edge moves with the visibility window. The start and the boss node are never fogged. [FR-MOV-6]

21.5 WHEN an engine event needs light (chest open, level-up, kill, shard, phase 2, boss entry) THE SYSTEM SHALL flash one pooled point light or the hemisphere intensity for at most 300 ms; it SHALL NOT create a light. [FR-FX-6, NFR Performance]

### Requirement 22: 3D battle arena (v1.6)

**User story:** As a player in a fight, I want a moonlit graveyard arena where my hero and the foe face off like in the sample.

#### Acceptance criteria

22.1 WHEN a fight starts with the world renderer THE SYSTEM SHALL build the arena from the sample: a cobbled stone path along x, grass behind it in the source day's lit level colour, an iron fence with a rail, five tombstones, two gate pillars, and two dead trees with purple blossoms, with the placement jitter, tombstone tilt, and blossom positions seeded from the source date with `makeRng` so the same day always gives the same arena. [FR-FX-10, FR-FX-6]

22.2 WHEN the arena is built THE SYSTEM SHALL place the hero billboard on the left (x = −2.6) facing right and the foe on the right (x = 2.4) facing left, at the stage sizes in `art-style.md`, with a warm lantern light near the hero, a purple light and an ember rim light near the foe, and the battle camera from `art-style.md`. For the boss THE SYSTEM SHALL use the boss sky (darker, larger moon halo), double the purple light, and hover the Phantom 0.12 units above the floor with a slow bob. [FR-FX-10, FR-COM-3]

22.3 WHEN the hero strikes or the foe strikes THE SYSTEM SHALL move the attacker's billboard toward the target by 0.6 units and back, apply the procedural rig frames (wind-up, lunge, recoil) as texture swaps, and show the hit effects of requirements 13.1–13.2 with the same delays. [FR-FX-6]

22.4 WHEN `phase2` is emitted THE SYSTEM SHALL, after 250 ms, ease the purple light and the fog colour toward red (`#ff3a3a`, `#2a0d1a`) over 400 ms and keep them until the fight ends, alongside the effects of requirement 13.4. [FR-FX-6]

22.5 WHEN floating text is shown THE SYSTEM SHALL project its world anchor to screen space each frame with reused vectors and draw it on the overlay canvas in the pixel font with a dark stroke; it SHALL stay inside the stage. [FR-FX-6]

22.6 WHILE a fight is shown THE SYSTEM SHALL keep the timing gauge, grade line, hit-error meter, and buttons as the existing HTML and 2D canvases over or under the arena (requirements 11, 17, 18); the arena never draws the gauge. [FR-COM-5, FR-FX-9]

22.7 WHEN the viewport is under 760 px wide THE SYSTEM SHALL keep the stage at 8:3 (only its CSS width shrinks), so the battle camera and framing are the same at every width; the timing test and panels move as in requirement 18.5. [FR-FX-10, NFR Responsiveness]

### Requirement 23: Routes on screen (v1.6)

**User story:** As a player, I want to see at a glance which tiles I can step to next, what lies ahead, and where the boss waits.

#### Acceptance criteria

23.1 WHILE the run is exploring THE SYSTEM SHALL highlight every legal tile with a pale purple `#d9c6ff` frame on its slab top and a chevron pointing from the hero toward it, labelled with its key ("W", "D", "S"; one "→" when a single move exists); WHEN the pointer hovers or the matching pad button has focus THE SYSTEM SHALL brighten that highlight. Highlights differ from the visited frame by shape (chevron) and colour. No highlight is drawn during a fight, a relic offer, or after the run. [FR-MOV-8, FR-MOV-1, NFR Accessibility]

23.2 WHEN the hero reaches the last column THE SYSTEM SHALL highlight the boss node as the single legal tile and label it "Boss". [FR-MOV-8]

23.3 WHILE the map is shown THE SYSTEM SHALL draw the boss node one unit right of the last column at `bossNode.row`: a 1.6 × 1.6 dark stone altar 0.9 units high with a purple rim, the Phantom billboard hovering above it, the purple point light, and three shard pips around the altar, lit gold for each shard held; at 3 shards a gold ring circles the altar ("bound"). It is always visible, never fogged. [FR-MOV-7, FR-MOV-8]

23.4 WHILE the `bestDay` tile is drawn THE SYSTEM SHALL show a small purple flame glow on it (`art-style.md`), visible even when its column is fogged, with the tooltip line of requirement 8.2. [FR-MOV-8]

23.5 WHILE the map is shown THE SYSTEM SHALL draw columns behind the hero at full colour with their resolved contents, the hero's column and the next two (three with Code Review) as seen, and every column after that as a fog column (requirement 21.4), reading only each tile's `seen` flag; it SHALL never compute visibility itself. [FR-MOV-6]

23.6 WHEN the hero enters the boss node THE SYSTEM SHALL move the hero billboard onto the altar and start the boss fight transition (requirement 13.3). [FR-MOV-8, FR-PRO-3]

### Requirement 24: WebGL fallback (v1.6)

**User story:** As a player on an old phone or a browser with WebGL off, I want to play the full game anyway.

#### Acceptance criteria

24.1 WHEN the map screen or teaser first needs a renderer THE SYSTEM SHALL pick the world renderer only if `canvas.getContext("webgl2")` succeeds and the `three` chunk loads and creating the `WebGLRenderer` does not throw; otherwise, or with `?renderer=flat` in the URL, THE SYSTEM SHALL use the flat renderer for the rest of the page session. [NFR Reliability, NFR Browser support]

24.2 IF the WebGL context is lost and not restored within 3 s, or the `three` chunk fails to load, THEN THE SYSTEM SHALL switch to the flat renderer without losing run state, log one `console.warn` with the reason, and show "3D view unavailable, using the simple view." once in the log area. [NFR Reliability]

24.3 WHILE the flat renderer is used THE SYSTEM SHALL draw the map per requirement 4 (flat tiles, sprites, highlights, fog cover, boss node, best-day marker) and accept the same keys, pad, and taps. [FR-MOV-1, FR-MOV-2, FR-MOV-6, FR-MOV-8]

24.4 WHILE the flat renderer shows a fight THE SYSTEM SHALL draw a reduced stage on a 2D canvas at 2×: a night gradient sky, the moon, a ground band in the source day's GitHub green, a stone path, the hero and foe sprites at the stage scales in `art-style.md`, the strike lunge and recoil, hit flashes, and floating text; no particles beyond bursts, no petals, no lighting. [FR-FX-10, FR-FX-6]

24.5 WHILE the flat renderer is used THE SYSTEM SHALL keep every rule, screen, HUD value, sound, and timing gauge identical to the world renderer; only the drawing differs. [NFR Reliability]

### Requirement 25: Phone performance budgets (v1.6)

**User story:** As a player on a mid-range phone, I want a steady frame rate and a cool battery.

#### Acceptance criteria

25.1 WHEN the renderer is created THE SYSTEM SHALL set the pixel ratio to `min(devicePixelRatio, 2)`, turn antialiasing on for a fine pointer and off for a coarse pointer (pixel art needs none, and MSAA is costly on phones), and start at quality `high` on a fine pointer and `medium` on a coarse pointer. [NFR Performance]

25.2 WHILE a world scene is shown THE SYSTEM SHALL measure frame times and, when the median of the last 120 frames exceeds 22 ms, step down one quality level (`high` → `medium` → `low`) at most once every 5 s and never step back up in the session. `medium`: pixel ratio cap 1.5, 1024 px shadow map. `low`: pixel ratio 1, no shadows, half the fireflies and particles. Antialiasing stays as created (it cannot change without a new context). [NFR Performance]

25.3 WHILE the map is shown THE SYSTEM SHALL draw all slabs with at most one instanced mesh per day level (5 draw calls) and all gravestone decorations with one instanced mesh, keep the map frame under 120 draw calls and the arena frame under 80 (`renderer.info.render.calls`), and keep at most 4 point lights and 1 shadow-casting light. [NFR Performance]

25.4 WHILE the frame loop runs THE SYSTEM SHALL allocate no objects per frame: scratch vectors, matrices, colours, and particle buffers are created once and reused; particle pools have fixed sizes (map 256, arena 384) and drop new particles when full. [NFR Performance]

25.5 WHEN a scene is left or a new run starts THE SYSTEM SHALL dispose of its geometries, materials, and textures (cached sprite textures excepted), so that `renderer.info.memory` returns to the same counts after three runs. [NFR Performance, NFR Reliability]

25.6 WHILE the page is hidden, or a screen without 3D content (start without teaser, summary, results) is shown, THE SYSTEM SHALL not render 3D frames. [NFR Performance]

25.7 WHEN the site is built THE SYSTEM SHALL put `three` in its own lazily loaded chunk of at most 180 KB gzip, and the start screen SHALL appear without waiting for it. [NFR Performance]

25.8 WHILE playing on a phone-sized viewport (390 × 844 CSS px, device pixel ratio 3, 4× CPU slowdown in Chrome DevTools) THE SYSTEM SHALL keep the median frame time at or under 33 ms on the map and in the arena. [NFR Performance]

### Requirement 26: Reduced motion in the world renderer (v1.6)

#### Acceptance criteria

26.1 WHILE reduced motion is on THE SYSTEM SHALL cut the camera to each new aim instead of easing, skip the rise and the overview-to-follow move, and use no camera shake. [FR-FX-6, NFR Accessibility]

26.2 WHILE reduced motion is on THE SYSTEM SHALL stop billboard bobbing and frame animation (heroes stay on `idle`, rigs off), keep lantern intensities constant, freeze the fireflies and the fog bank in place, draw no petals, keep the legal-tile highlight static (no pulse), and move the hero between tiles without the hop or squash. [FR-FX-6, NFR Accessibility]

26.3 WHILE reduced motion is on THE SYSTEM SHALL turn off light flashes, white-outs, hit-stop, and slow motion, and draw the phase-2 tint at once. Floating text appears and fades in place without rising. [FR-FX-6, NFR Accessibility]

26.4 WHILE reduced motion is on THE SYSTEM SHALL keep the timing-test gauges moving, because they are the game input. [FR-FX-6, NFR Accessibility]
