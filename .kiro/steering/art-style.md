---
inclusion: fileMatch
fileMatchPattern: "src/render/**,src/audio/**"
---

# Art and audio style

All values are copied from `prototype/index.html`. Match the prototype pixel for pixel; side-by-side screenshots are the Phase 3 exit check.

**v1.6 (27 Nov 2026).** The TypeScript build draws the map and the combat stage as a 3D world with Three.js in the billboard style of the sample at `/projects/sandbox/preview-3d/sample-source.html` (screenshots `3d-map-billboard.png`, `3d-battle-billboard.png`). Sprites, palette, fonts, effects, and audio below still apply pixel for pixel: the sprite canvases become billboard textures. The 3D values are in "3D billboard world" at the end; the "Map" section now describes the flat renderer (WebGL fallback and share card). The visual exit check compares the 3D screens with the sample screenshots (presentation task 14.2).

## Palette

| Use | Colour |
| --- | --- |
| Page background | `#0b0e14`, with a radial glow `#241a3a` at the top |
| Map background | `#0d1117` |
| Panel / line | `#121722` / `#263042` |
| Text / muted text | `#e6edf3` / `#8b98ab` |
| Day levels 0–4 | `#161b22`, `#0e4429`, `#006d32`, `#26a641`, `#39d353` (GitHub dark-mode greens, also the "ectoplasm") |
| Day level highlights 0–4 | `#262d3a`, `#1b6b3e`, `#1d9a4c`, `#52d06c`, `#8dffa0` |
| Treasure, chests, the Gate | Orange `#ff9a3c`, gold `#ffd257`, amber `#ffb13c` |
| Ghosts, the boss, focus | Purple `#b48cff`, `#7b4bc9`, `#5d3fb0`, pale `#d9c6ff` / `#e7d8ff` |
| Danger, Miss | Red `#ff6b6b` |
| Grades | Perfect `#ffd257` with glow, Good `#39d353`, Miss `#ff6b6b` |
| Difficulty stars 1–4 | `#8dffa0`, `#9fd8ff`, `#ffb38a`, `#ff6b6b` (4 pulses) |
| Sprite outline | `#05060a` |

Text meets 4.5:1 contrast. Tile types differ by shape and icon, never by colour alone.

## Fonts

"Press Start 2P" (SIL OFL) for titles, labels, grades, and floating text only. A system sans-serif (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) for statistics and body text.

## Sprites

### General rules

- Sprites are character grids: `.` is transparent, every other character is a palette key.
- Draw at integer scale with `imageSmoothingEnabled = false` and integer translation.
- Every sprite gets a 1 px `#05060a` outline: each opaque pixel stamps the 4 neighbours, so the sprite grows 2 px in each dimension.
- Each sprite has four cached versions: base, white, red (`#ff4040`), and gold (`#ffd257`) silhouettes, used for hit flashes and afterimages.
- Monsters, chests, gravestone, coffin, and relic icons are 12 px wide grids. Higher tiers are larger or more detailed. On the map they draw at `max(1, floor(tile / 14))`; on the combat stage at 5.5 (tiers 1–3), 6 (tier 4), and 7 (boss).
- Sprites are self-drawn. No GitHub logo, no Octocat, no GitHub UI. "GitHub" appears as plain text only.

### Heroes (24×24)

- One outfit grid per class (`OUTFITS` in the prototype) with the race drawn onto the face block (rows 6–9, columns 9–14).
- Outfit palette keys: `A` main cloth, `B` accent, `C` cape, `G` gold trim, `L` boots, `M` metal, `k` dark line, `x` glow, `W` wood. Race keys: `s` skin, `S` skin shadow, `e` eyes, `m` mouth, `u` bone white `#f4efe0`.
- Face points come from the art: `e` pixels are the eyes, `m` pixels the mouth, the nose sits above the first mouth pixel, and tusks flank the mouth. Ear pixels are listed per outfit, on the far side of the face. Race features: Elf ears, Orc tusks, Skeleton teeth, Vampire fangs, and glowing eyes for Orc, Skeleton, and Vampire. Masked outfits (Rogue) skip mouth features.
- **Auto-shading, light from the top left.** Keys `e`, `k`, `m`, `u`, `x` are flat. For every other pixel:
  - transparent on the right or below: mix 38% toward black;
  - else transparent above or on the left: mix 30% toward white (rim light);
  - else transparent two pixels right or one down-right: mix 18% toward black;
  - else on `A` or `C` where `(x + y) % 7 === 0`: mix 10% toward black (cloth texture).
- **Frames:** `idle`; `sway` (alternates with idle every 520 ms; odd rows 13–19 grow one cape pixel at the back); `step` while moving (sway plus the back foot one pixel back and the front foot one pixel forward on rows 22–23); `blink` for 130 ms every 3,400 ms; `lookL` / `lookR` (eyes shift one pixel).
- **Glows on top** (additive): race eye glow; Wanderer lantern at (20, 15.5); Mage orb at (16.5, 0.8); Knight blade glint on column 19 sweeping rows 1–8 every 2.6 s; Rogue dagger tips at (4, 16) and (21, 13) every 3 s.
- Scale: 1× on the map (2× when tiles are ≥ 40 px), 6× on the summary portrait.

## Map

(v1.6: this section is the flat renderer, used without WebGL 2, with `?renderer=flat`, and by the share card. The prototype draws it exactly as written; the v1.6 differences are marked.)

- Tiles are rounded squares (radius 6) textured per level with a seeded pixel noise, a light top edge, and a dark bottom edge. Visited tiles get a faint warm border.
- Unseen tiles get a `rgba(6,8,16,.55)` cover and show no contents. Drifting fog at 14% opacity moves across the map. (v1.6 flat renderer: the cover only, no drift.)
- **Lighting:** a `rgba(2,3,12,.38)` darkness layer with radial holes: the hero's lantern (2.7 tiles, 3.4 with Code Review, flickering), the boss, the Gate (wider once open), seen wisps and chests, and the start. (v1.6 flat renderer: no darkness layer; the visibility window replaces the lantern radius.)
- **v1.6 routes (flat):** legal tiles get a 2 px `#d9c6ff` inner frame and a small chevron from the hero's side with the key letter (W, D, S) in the pixel font; the boss node is a rounded square 1.5 T tall, one gap right of the last column, with the phantom sprite and three shard pips (`#3a3550`, lit `#ffd257`); the best-day tile has a small purple `#b48cff` flame glow; there is no Gate sprite and no warded ring.
- **The rise:** each tile grows in with `easeOutBack` over 420 ms, delayed `col × 70 + row × 12` ms, with a brief highlight flash.
- Hero movement: 140 ms between tiles with a hop and a landing squash. Aura: a purple glow growing with the tier, plus `2 × aura` motes orbiting the hero.
- Monsters bob and breathe, face the hero, and show a "!" alert when adjacent (v1.6: when on a legal tile). The warded boss has a dashed ring and three orbiting shard markers (v1.6: removed; shard pips on the boss node instead). Resolved fights leave crossed bones.

## Effects

- Particles (bursts, homing wisps, coins, souls), rings, slashes, floating text in the pixel font with a dark stroke, screen shake, hit-stop, slow motion, gold and red fight flashes, a white-out on boss entry and phase 2, the phase-2 red tint, and a pulsing red low-HP danger overlay.
- Keep animations short and fast. No animation blocks input for more than 300 ms.

### Reduced motion

When `prefers-reduced-motion: reduce` is set:

- Off: screen shake, flashes and white-outs, fog drift, the map rise, idle actions and sleep, sprite frame animation (heroes stay on `idle`), bobbing, breathing, hops, blade and dagger glints, and CSS animations.
- Stays: the timing-test gauges and their motion, because they are the game input.

## Audio

- **Synthesized only.** Every effect and the music are generated with Web Audio at run time. The project ships no audio files and never uses copyrighted music.
- Signal chain: master gain 0.55 → dynamics compressor → output. Music bus with a 0.34 s delay and 0.38 feedback.
- **Drone:** oscillators at 55 Hz and 55.4 Hz (sawtooth) and 82.4 Hz (triangle) through a low-pass filter (Q 4) swept by a 0.08 Hz LFO.

| Mode | Drone level | Filter | Second oscillator |
| --- | --- | --- | --- |
| off | 0 | — | — |
| menu | 0.025 | 220 Hz | 55.4 Hz |
| explore | 0.04 | 220 Hz | 55.4 Hz |
| combat | 0.06 | 380 Hz | 55.4 Hz |
| boss | 0.08 | 520 Hz | 58.3 Hz |
| boss2 | 0.1 | 820 Hz | 61.7 Hz |

- **Graveyard bells** in menu and explore: triangle notes from 220, 261.63, 293.66, 329.63, 392, 440, 523.25 Hz (30% chance an octave up), every 1.6–3.4 s.
- **Heartbeat:** every 0.78 s in combat, 0.5 s at the boss, 0.38 s in phase 2, 0.9 s on the map at low HP.
- Effects include ui, step, blocked, wisp, chest, encounter, boss, windup, warn, stutter, charge, hit, crit, glance, block, dodge, hurt, death, levelup, shard, ward, gate, relic, phase, rise, win, and lose. (v1.6 TypeScript build: `blocked` and `gate` are dropped with their events; `ward` plays when the Phantom is bound; a rest plays `wisp` at half gain.)
- Audio starts on the first key or pointer input. The Sound button and the M key toggle mute, saved in settings. The scheduler pauses while the page is hidden. Audio failures are caught and never block the game.

## Three-quarter view (added 21 Nov 2026)

- Every character is drawn in three-quarter view, never flat to the front. Heroes are 24×24 and face right; monsters are 16×16 and face right. The renderer flips sprites so the hero faces its movement direction and monsters face the hero.
- The face sits toward the facing side: the far eye is nearer the middle, the near eye nearer the edge, and the back of the hood, helmet, or hat bulges on the far side. Elf ears go on the far side of the face.
- Each hero outfit lists its face points (`eyes`, `mouth`, `ear`, `tusks`, `nose`) so race features, blink, and look frames work on every outfit.
- Heroes and monsters share one shading function (light from the top left). In the 2× combat stage, sprite scales are multiples of 0.5 so pixels stay square.

## Procedural rigs (added 21 Nov 2026)

- Characters move with per-row rigs instead of extra hand-drawn frames. A rig gives each sprite row a whole-pixel `[dx, dy]` offset; `dx` points the way the sprite faces. The shifted rows are rebuilt from the shaded sprite, outlined again, and cached by their offsets.
- `dy` only pushes rows down and never grows toward the feet, so rows overlap instead of leaving gaps. `dx` stays within ±4 px and `dy` within 0–3 px.
- Hero rig: the feet (rows 22–23) stay planted and the body leans from the ankles up. Idle sway, a 1 px head drop when breathing, a forward lean when walking, a lean back and crouch on the attack wind-up, a crouch to brace for a hit, a lunge forward, a recoil when hurt, and a hem ripple on robes and capes (none on the Rogue, half on the Knight).
- Monster rigs, one motion each: the ghost's tail waves, the imp skitters and hops, the ghoul shambles and reaches, the lich's robe hem ripples, the phantom's wisps curl. All of them lean back on the wind-up, lunge forward, and recoil when hit.
- Glow points (`heroFX`) follow the rig offset of their row. Rigs are off under reduced motion.

## Slim proportions (added 21 Nov 2026)

- Characters are slim and taller than they are wide. Hero bodies are about 7 px wide (head about 9 px with hood or helmet) inside the 24×24 grid, with separate legs, a gap between the legs, and weapons held away from the body. Avoid filled blobs: leave transparent space between limbs and torso.
- Monsters stay 16 px wide with lanky limbs (imp, ghoul) or a tapering shape (ghost, lich). The boss (the Phantom) is 16×24: a tall hooded figure whose robe is the night sky (`q` night robe, `Z` void, `z` stars; `z` and `Z` are flat).
- The boss has an ember rim light: a second `#ff8a3d` outline outside the dark one (`sprFrom(canvas, rim)`). Its stars twinkle and its eyes burn (`bossFX`); the glow points follow the rig.
- Combat stage scales: hero 2, monsters 3 / 3.5 / 4 by tier, boss 4.5. Vertical placement comes from the sprite height (`monHalf`).

## 3D billboard world (added 27 Nov 2026, v1.6)

The world renderer (`src/render/world/`, Three.js) follows the billboard sample at `/projects/sandbox/preview-3d/sample-source.html`. Values marked "sample" are copied from it. Positions are in world units; one unit is one tile pitch. x runs along the weeks (columns), z along the weekdays (row 0, Sunday, is farthest from the camera), y is up.

### Renderer

- `WebGLRenderer` (WebGL 2), output colour space sRGB, ACES filmic tone mapping at exposure 1.15 (sample). Antialiasing on for a fine pointer, off for a coarse pointer.
- Pixel ratio `min(devicePixelRatio, 2)`; quality `medium` caps it at 1.5 and `low` at 1 (presentation requirement 25).
- Shadows from the moon only: PCF soft at `high` (2048 px map), PCF at `medium` (1024 px), off at `low`.

### Camera angles

| Camera | Projection | Position | Looks at | Notes |
| --- | --- | --- | --- | --- |
| Map follow | Perspective, FOV 40°, near 0.1, far 200 | aim + 0.8 × (−1.6, 7.2, 9.0) | aim = (hero x + 1.5, 0, z of row 3) | Sample framing: about 38° down, 10° yaw from the left. Translates only; its orientation never changes during play. Eases 400 ms (ease-out cubic) after each move |
| Map follow, portrait (aspect < 1) | FOV 55° | aim + 0.85 × (−1.6, 7.2, 9.0) | same aim | Keeps the hero's column, the next two, and all 7 rows in view at 390 × 844 |
| Map overview (rise, teaser) | FOV 40° (55° portrait) | centre + k × (−1.6, 7.2, 9.0) | centre of the map including the boss node | `k ≥ 1`, the smallest value that fits all columns and the boss node with 1 unit margin. Eases to the follow camera over 600 ms after the rise |
| Battle | Perspective, FOV 40° | (−0.6, 2.3, 7.4) | (0.1, 1.45, 0) | Sample: near eye level, hero on the left, foe on the right. The stage is always 8:3, so it never changes with the screen width |

Camera shake moves the camera position only, by `n / 100` units for a prototype shake of `n` px, decaying over the prototype's duration.

### Lighting

| Light | Colour | Intensity | Where | Notes |
| --- | --- | --- | --- | --- |
| Hemisphere | sky `#6a58b8`, ground `#10081c` | 0.9 | — | sample |
| Moon (directional) | `#b9c4ff` | 1.6 | from aim + (−8, 14, 6); shadow camera ±14, near 1, far 50, bias −0.0008 | sample; the only shadow caster |
| Fill (directional) | `#ffd9b0` | 0.7 | from aim + (2, 4, 12) | sample |
| Moon disc and halo | disc `#f3ecd0`, radius 2.2; additive halo sprite 16 units, opacity 0.6 | — | aim + (−22, 18, −40) | sample; not fogged |
| Point light pool | 4 lights, always present | 0 when unused | — | Never added or removed while a scene is shown |
| Map: hero lantern | `#ffb35c` | 2.6, distance 6, decay 1.6 | hero + (0.35, 0.55, 0.1), with an additive glow sprite 0.9 units | sample |
| Map: boss node | `#a070ff` | 3, distance 5, decay 1.4 | altar top + (0, 1.2, 0.4) | sample (on the best day there) |
| Map: nearest seen chest / wisp (2 lights) | chest `#ffb35c` / wisp `#8dffb0` | 1.2 / 1.0, distance 3, decay 1.6 | 0.5 above the slab | |
| Arena: hero lantern | `#ffb35c` | 3 | (−1.6, 1.6, 0.6) | sample |
| Arena: far lantern | `#ffb35c` | 2 | (0, 2.4, −4.0) | sample |
| Arena: foe glow | `#b060ff` | 8, distance 9, decay 1.4 (boss: 16) | (2.2, 2.4, 1.4) | sample; eases to `#ff3a3a` in phase 2 |
| Arena: ember rim | `#ff7a3d` | 5, distance 6, decay 1.5 | (3.6, 1.6, −1.4) | sample |

- **Flicker** (lanterns only): `base × (0.85 + 0.1 × sin(13t) + 0.05 × sin(31t))`, t in seconds (sample). Off with reduced motion.
- **Event flashes:** one pooled light or the hemisphere intensity ramps to at most 2× for at most 300 ms (chest gold, level-up gold, kill white, shard pale purple, phase 2 red, boss entry white). Off with reduced motion.

### Fog and atmosphere

- **Sky and distance fog:** background and `FogExp2` colour `#140d26`; density 0.035 on the map, 0.05 in the arena (sample). Boss arena: `#0d0718`, moon halo opacity 0.8. Phase 2: fog and background ease to `#2a0d1a` over 400 ms.
- **Fog columns (visibility window):** every slab whose tile is not `seen` keeps its shape and level tint at 45% brightness with no emissive glow and no contents. A fog bank of three stacked planes covers the fog columns: a seeded, squared value-noise texture (`#7a70a8`) at opacity 0.42, 0.30, 0.20, at heights 0.22, 0.42, 0.66 above the level-4 slab top. Vertex alpha fades the bank in over 1.8 units from its near edge and out over 1 unit at the far and side edges, so it reads as mist, not a sheet. Its near edge sits half a unit before the first fog column and moves with the window over 400 ms. Each layer has its own texture repeat and drifts along x at 0.05 units per second times 1, −0.7, and 1.6, so the layers slide past each other. The start and the boss node are never fogged.
- **Fireflies:** one `Points` cloud, size 0.22, colour `#8dffb0`, additive, opacity 0.85, between 0.5 and 3 units above the ground (sample); 60 on the map, 50 in the arena, half at quality `low`. Each drifts on a slow sine path.
- **Petals** (arena only): 40 points in `#c77dce`, falling at 0.3 units per second with a sideways sway.

### Slabs and map props

| Item | Shape | Material |
| --- | --- | --- |
| Day slab | Box 0.9 × h × 0.9 on the 1-unit grid; `h = 0.18 + 0.12 × level` | Standard, roughness 0.9, flat shading. Lit colours by level 0–4: `#1d1a2a`, `#1e3a2c`, `#226337`, `#2c8f45`, `#3fd35f` (sample; the GitHub greens tuned for moonlight). Emissive in the same colour at 0.12 for level 3 and 0.35 for level 4 |
| Ground | Plane 200 × 200 | `#120e1c`, roughness 1 |
| Gravestone (`deco` tiles) | Sample tombstone: slab 0.34 × 0.42 × 0.1, half-cylinder top, small dark cross; tilt ±0.075 rad from the tile seed | `#5a5670`, roughness 0.95, flat shading |
| Visited frame | Line loop just inside the slab top | `#ffb13c`, opacity 0.6 |
| Legal-tile highlight | Line loop on the slab top plus a flat chevron pointing from the hero, and the key letter (W, D, S, "→", "Boss") as a pixel-font plane | `#d9c6ff`; opacity pulses 0.55–1.0 at 1.2 Hz (static at 1.0 with reduced motion); brighter (`#ffffff` chevron) on hover or pad focus |
| Boss node altar | Box 1.6 × 0.9 × 1.6, one unit right of the last column at the boss node's row, with a thin emissive rim strip | `#2a2640`, rim `#7b4bc9` emissive 0.6 |
| Shard pips | Three spheres, radius 0.08, at 120° around the altar, 1.0 above it | Unlit `#3a3550`; lit `#ffd257` with emissive 0.8 |
| Bound ring | Torus radius 1.0, tube 0.03, around the altar top | `#ffd257` emissive 0.8; only at 3 shards |
| Best-day flame | Additive glow sprite 0.4 units, 0.5 above the slab, flickering | `#b48cff` |
| Ground labels | Pixel-font text planes 0.28 units high, flat on the ground | `#8b98ab` at 70% opacity |
| Arena | Sample: cobbled path 14 × 0.12 × 3.2 (`#4b4860`) with 0.46 × 0.04 × 1.1 cobbles (`#5d5a74` / `#55526a`), grass plane behind in the source day's lit level colour, iron fence bars every 0.35 with a rail (`#1c1a26`, metalness 0.6), five tombstones at 1.4×, two stone pillars 0.5 × 3 × 0.5, two dead trees (`#2a1c22`) with nine low-poly blossoms each (`#7a3d7a`, emissive `#3a1040` 0.4). Positions jitter by up to 0.3 from a `makeRng` seeded with the source date | |

### Billboards

- A billboard is a `PlaneGeometry((w + 2) × px, (h + 2) × px)` with the sprite canvas (1 px `#05060a` outline included) as its texture: `NearestFilter` for magnification and minification, no mipmaps, sRGB. Material: standard, roughness 1, metalness 0, `alphaTest 0.5`, not transparent (cut-out pixels need no sorting), double-sided. It casts moon shadows at `high` and `medium`.
- Anchored at its bottom centre on the slab top (+0.01) or the arena floor (y 0.15). Each frame every billboard copies the camera's orientation (sample), so sprites never foreshorten.
- Facing is set by mirroring the plane (`scale.x = −1`), never by rotating it. On the map the hero faces right; monsters face left, toward the incoming hero. In the arena the hero faces right and the foe faces left.
- Glow points (`heroFX`, `bossFX`, keys `x`, `z`, `e`) are additive glow sprites placed at their pixel positions on the plane and follow the rig offsets.
- Hit flashes, frames, and rig offsets swap the texture to the cached canvas for that key; they never redraw a canvas per frame.

### Scale rules

- One world unit is one tile pitch; slabs are 0.9 wide with a 0.1 gap. One sprite pixel is `px` world units; pixels are always square (x and y scale together, except the mirror and the 80 ms landing squash, y × 0.85 and x × 1.08).
- **Map:** hero `px = 1/24`; monsters tiers 1–2 `1/26`, tiers 3–4 `1/24`; chest, wisp, coffin, gravestone sprite, and crossed bones `1/28`; the Phantom on the boss node `1/19`. The hero is about 1.1 units tall, so it stands on a 1-unit tile and neighbouring sprites do not overlap. (The sample's 1/17 made sprites crowd each other in play.)
- **Passed columns:** contents of tiles in columns behind the hero that it did not visit are hidden; those tiles can no longer be reached.
- **Arena:** `px = stage scale / 32`, using the stage scales in "Slim proportions": hero 2 (`1/16`), monsters 3, 3.5, 4 by tier, boss 4.5 (about `1/7`, close to the sample's `1/7.5`). The hero stands at x = −2.6, the foe at x = 2.4; the boss hovers 0.12 above the floor with a ±0.08 bob at 1.4 rad/s (sample).
- **Motion sizes:** hop arc 0.35 units over 140 ms; strike lunge 0.6 units out and back; idle bob `|sin(2t + k)| × 0.02` (sample); aura motes 0.06; particles 0.05–0.12.
- Floating text and speech bubbles are drawn on the 2D overlay canvas at the projected anchor, in the prototype's pixel-font sizes, not as 3D text.

### Reduced motion (3D additions)

Also off with `prefers-reduced-motion: reduce`: camera eases (cuts instead), the rise and the overview move, camera shake, billboard bob and frame animation (rigs off, heroes on `idle`), the hop and squash, lantern flicker, light flashes, firefly and fog-bank drift (both stay visible, frozen), petals, the highlight pulse, and rising floating text (it fades in place). The phase-2 tint is applied at once. The timing gauges keep moving.
