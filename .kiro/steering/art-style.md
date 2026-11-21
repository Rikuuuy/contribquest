---
inclusion: fileMatch
fileMatchPattern: "src/render/**,src/audio/**"
---

# Art and audio style

All values are copied from `prototype/index.html`. Match the prototype pixel for pixel; side-by-side screenshots are the Phase 3 exit check.

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
- Race features: Elf ears (`s` at [7][8], [6][7], [7][15], [6][16]); Orc tusks (`u` at [9][10], [9][13]); Skeleton teeth; Vampire fangs (`u` at [9][11], [9][12]); glowing eyes for Orc, Skeleton, and Vampire. Masked outfits (Rogue) skip mouth features.
- **Auto-shading, light from the top left.** Keys `e`, `k`, `m`, `u`, `x` are flat. For every other pixel:
  - transparent on the right or below: mix 38% toward black;
  - else transparent above or on the left: mix 30% toward white (rim light);
  - else transparent two pixels right or one down-right: mix 18% toward black;
  - else on `A` or `C` where `(x + y) % 7 === 0`: mix 10% toward black (cloth texture).
- **Frames:** `idle`; `sway` (alternates with idle every 520 ms; the cape gains a pixel on the left and loses one on the right on odd rows 17–21); `step` while moving (sway plus feet apart on rows 22–23); `blink` for 130 ms every 3,400 ms; `lookL` / `lookR` (eyes shift one pixel).
- **Glows on top** (additive): race eye glow; Wanderer lantern at (20.5, 16.5); Mage orb at (19.5, 0.8); Knight blade glint sweeping rows 3–10 every 2.6 s; Rogue dagger tips at (0, 15) and (21, 15) every 3 s.
- Scale: 1× on the map (2× when tiles are ≥ 40 px), 6× on the summary portrait.

## Map

- Tiles are rounded squares (radius 6) textured per level with a seeded pixel noise, a light top edge, and a dark bottom edge. Visited tiles get a faint warm border.
- Unseen tiles get a `rgba(6,8,16,.55)` cover and show no contents. Drifting fog at 14% opacity moves across the map.
- **Lighting:** a `rgba(2,3,12,.38)` darkness layer with radial holes: the hero's lantern (2.7 tiles, 3.4 with Code Review, flickering), the boss, the Gate (wider once open), seen wisps and chests, and the start.
- **The rise:** each tile grows in with `easeOutBack` over 420 ms, delayed `col × 70 + row × 12` ms, with a brief highlight flash.
- Hero movement: 140 ms between tiles with a hop and a landing squash. Aura: a purple glow growing with the tier, plus `2 × aura` motes orbiting the hero.
- Monsters bob and breathe, face the hero, and show a "!" alert when adjacent. The warded boss has a dashed ring and three orbiting shard markers. Resolved fights leave crossed bones.

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
- Effects include ui, step, blocked, wisp, chest, encounter, boss, windup, warn, stutter, charge, hit, crit, glance, block, dodge, hurt, death, levelup, shard, ward, gate, relic, phase, rise, win, and lose.
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
