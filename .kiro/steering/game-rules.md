---
inclusion: fileMatch
fileMatchPattern: "src/engine/**,src/mapgen/**,scripts/**"
---

# Game rules

Every value below is copied from `prototype/index.html`. The prototype is the source of truth: if this file, the PRD, and the prototype disagree, the prototype wins and this file is corrected. Every constant here must exist in `src/engine/balance.ts` with the same value. Change both in the same commit.

Notation: `t` is the monster tier, `calm` is 1.6 in Calm mode and 1 otherwise, `rand()` is the next draw from the run's seeded RNG, and all times are milliseconds.

## Determinism

- **Hash:** 32-bit FNV-1a. `h = 0x811c9dc5`; for each UTF-16 code unit: `h ^= code; h = Math.imul(h, 0x01000193)`; return `h >>> 0`.
- **RNG (mulberry32):** state `s` (uint32). `next()`: `s = (s + 0x6D2B79F5) >>> 0; t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296`.
- **Map seed:** `fnv1a(username.toLowerCase() + "|" + lastDate)`, where `lastDate` is the last date in the map owner's 91 days.
- **Map RNG** (shortfall only): seeded with `seed ^ 0x9e3779b9`.
- **Run RNG:** the run state's `rng` starts at the map seed. Relic shuffles, bar zones, combo marks, pattern choices, pauses, decoys, and damage variance all draw from it, in that call order.
- Dates are `YYYY-MM-DD` and handled in UTC. Weekday 0 is Sunday. The device clock never decides the window.

## Input data

- Window: the last **91** days of the response (`WINDOW = 91`), oldest first. Fewer than 91 days is an error.
- Each day is `{ date, count, level }` with `count` a non-negative integer and `level` in 0–4. Days are sorted by date.
- **Streak:** over the full response, not only the window. Start at the last day; if its count is 0, start from the day before (today may not be over). Count back while `count > 0`.
- `yearTotal` is the API's `total.lastYear` when it is an integer, otherwise the sum of all counts.
- `total91` is the sum of counts in the window.

### Demo dataset (`scripts/make-demo-data.ts`)

Username `demo-necromancer`, RNG seeded with `fnv1a("demo-necromancer")`, last date `2026-11-16`, year total 1287. For window index `idx` 0–90:

- `idx` 12–18: level 0 (the empty "graveyard" week). `idx` 75: level 0 (the day before the streak).
- `idx` ≥ 76: level `1 + floor(next() × 4)` (a 15-day streak to the end).
- Otherwise `x = next()`: level 0 if `x < .38`, 1 if `< .63`, 2 if `< .83`, 3 if `< .94`, else 4.
- Count for level > 0: uniform integer in the level's range, `a + floor(next() × (b − a + 1))`, with ranges L1 1–3, L2 4–6, L3 7–10, L4 11–18.
- Then `idx` 77 is overwritten with count 31, level 4 (the best day).

The generated file is frozen as `src/data/demo-data.json` and is not regenerated after Phase 0.

## Map

### Layout

- `w0 = weekday(days[0])`, `cols = ceil((w0 + 91) / 7)` (13 or 14). Day `i` sits at `p = w0 + i`: column `floor(p / 7)`, row `p % 7`. Rows are Sunday (0, top) to Saturday (6).
- Cells with no day are `void` and never walkable. They only occur at the top of the first column and the bottom of the last.
- Movement is 4-directional between non-void cells.

### Tile assignment

`h = fnv1a(date)` per day.

| Condition (first match wins) | Tile |
| --- | --- |
| Index 0 | `start` (the crypt) |
| The best day | `boss`, tier 5. If the best day is also the last day, the tile is `gate` with `boss: true` |
| Last index | `gate` |
| Level 0 | `fog`; gravestone decoration if `h % 6 === 0` |
| Level 1 | `wisp` |
| Level 2 | `chest` size 1 if `h % 3 === 0`, else `monster` tier 2 (Bug Imp) |
| Level 3 | `chest` size 2 if `h % 3 === 0`, else `monster` tier 3 (Flaky Test Ghoul) |
| Level 4 | `monster` tier 4 (Merge Conflict Lich) |

- **Best day:** the highest count among indexes 1–90 (never the start). Ties go to the latest date.
- **Empty quarter:** if the best count is 0, the boss goes on index `floor(91 / 2)` = 45, named "The Phantom of the Empty Quarter".
- **Shortfall:** if fewer than **6** tiles have kind `monster` (the boss does not count), shuffle all `fog` tiles with Fisher-Yates using the map RNG (`for i from len−1 down to 1: j = floor(next() × (i + 1))`), then pop from the end and turn each into a tier-1 `monster` (Lost Ghost, `risen: true`, no decoration) until there are 6 or the pool is empty. The map is marked `quiet`.
- **Shards needed:** `min(3, number of monster tiles with tier ≥ 3)`.
- **Validation:** start, Gate, and boss exist; BFS finds start → boss and boss → Gate; every date appears exactly once. A failing map is an error with demo mode, never shown.

### Names and labels

| Tier | Name |
| --- | --- |
| 1 | Lost Ghost |
| 2 | Bug Imp |
| 3 | Flaky Test Ghoul |
| 4 | Merge Conflict Lich |
| 5 | The Phantom of {Ddd D Mmm YYYY}, or The Phantom of the Empty Quarter |

Source label: "Born from 91 days of silence" (empty-quarter boss), "Risen from an empty day: {date}" (Lost Ghost from the shortfall), otherwise "Risen from {date}: {count} contribution(s)".

## Exploration

- **Fog reveal:** after every move, tiles with `dc² + dr² ≤ 5` from the hero become `seen` (`≤ 8` with Code Review).
- **Blocked moves:** void cells; the Gate (when it is not also the boss) until the boss is down; the boss while `shards < shardsNeeded`. A blocked move does not count as a step.
- Every successful move adds 1 to `steps`, marks the tile visited, and enters it if unresolved.
- **Wisp:** +5 XP, resolved.
- **Chest:** +6 treasure (size 1) or +12 (size 2), heal `ceil(maxHp × 0.3)` up to max, +10 XP, then a relic offer. Resolved.
- **Monster or boss:** starts combat.
- **Gate:** if it is the boss, starts combat; otherwise the run is won.
- **Soul shards:** banishing a tier 3 or tier 4 monster while `shards < shardsNeeded` adds 1 shard. When `shards === shardsNeeded` the ward breaks.

## Hero

### XP and level

- Starting XP: `round(15 × √total91)`.
- XP needed for level n: `25 × n × (n − 1)` → 0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250. Cap at **level 10**.
- `startLevel` is the level at the start of the run (used by monster scaling).
- XP rewards: wisp 5, chest 10, monster `15 × t`, boss 100. Human: every XP gain × 1.1, rounded.
- A level-up recomputes stats and heals to full.

### Aura

`aura = min(floor(streak / 7), 4)`.

### Stats

- `maxHp = round((30 + 6 × (level − 1) + 5 × aura + traitHp + (Cold Brew ? 10 : 0)) × classHp)`
- `atk = 5 + 2 × (level − 1) + aura + (Stack Overflow ? 3 : 0) + classAtk + (Orc ? 2 : 0)`
- Stats are recomputed on level-up, relic pick, and class change. HP is clamped to max HP. Changing class heals to full. Class and race are locked after the first step.

### Weekday trait

Computed from the 91-day window, by summed count per weekday.

| Condition | Trait | Effect |
| --- | --- | --- |
| `total91 === 0` | Blank Slate | +5 max HP (`traitHp = 5`), no rows |
| `(Sunday + Saturday) / total91 ≥ 0.4` | Weekend Warrior | +2 ATK on rows 0 and 6 |
| Otherwise | `{Weekday} Slayer`, the weekday with the highest sum (ties go to the earlier weekday, Sunday first) | +2 ATK on that row |

The +2 applies to strike damage when the fight's tile is in a trait row. It does not apply to counters.

### Classes

| Class | Strike test | Guard test | `classHp` | `classAtk` | Other |
| --- | --- | --- | --- | --- | --- |
| Wanderer (default) | bar | ring | 1 | 0 | — |
| Knight | bar | shield | 1.25 | −1 | `slow: 1.15` (bar sweep) |
| Rogue | combo | sidestep | 0.9 | 0 | Perfect sidestep counters at 100% ATK |
| Mage | charge | ring | 0.9 | +2 | — |

### Class difficulty

| Class | Stars | Label | pMul | gMul | speed | ramp | floor | loot | dmg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Knight | 1 | Easy | 1.25 | 1.2 | 1.12 | 0.01 | 0.92 | 1 | 0.85 |
| Wanderer | 2 | Normal | 0.95 | 0.9 | 0.96 | 0.02 | 0.82 | 1.1 | 1.5 |
| Mage | 3 | Hard | 0.72 | 0.62 | 0.9 | 0.03 | 0.72 | 1.25 | 2.4 |
| Rogue | 4 | Nightmare | 0.62 | 0.68 | 0.82 | 0.04 | 0.6 | 1.5 | 3.0 |

### Pressure

- `pressure = max(floor, 1 − ramp × defeated)`, then × **0.9** while the boss is in phase 2.
- `defeated` counts every banished monster, including the boss.
- HUD: "Timing n%" with `n = round(pressure × pMul × 100)`, styled as maxed when `pressure ≤ floor + 0.001`.
- FR-DIF-4: when a non-boss kill lowers pressure, log "The graph grows restless: timing windows n%." The prototype computes the "before" value after incrementing `defeated`, so this message never fires there; the port follows FR-DIF-4.

### Races

| Race | Passive |
| --- | --- |
| Human (default) | +10% XP from everything (rounded) |
| Elf | Perfect window +15 ms × calm, added before class and pressure scaling |
| Orc | +2 ATK |
| Skeleton | Once per run, a hit that would leave 0 HP leaves 1 HP ("UNDYING!") |
| Vampire | Each Perfect strike hit heals 2 HP, up to max HP (a combo can heal up to 6) |

### Relics

Each chest (and the Commit Blessing) offers 3 relics: all unowned relics, shuffled with Fisher-Yates using the run RNG, first three taken. No offer when all 10 are owned. The player keeps one.

| ID | Name | Effect |
| --- | --- | --- |
| `duck` | Rubber Duck | The first Miss in each fight becomes Good. In a combo, only the first missed hit changes |
| `hotfix` | Hotfix | Each perfect dodge heals `ceil(maxHp × 0.06)`, up to max |
| `force` | Force Push | Perfect strike multiplier × 1.25 |
| `linter` | Linter | Perfect window +25 ms (before calm) |
| `stack` | Stack Overflow | +3 ATK |
| `coffee` | Cold Brew | +10 max HP (before class scaling), and heal 10 on pick |
| `blame` | Git Blame | Counters deal 100% ATK instead of 50% |
| `pair` | Pair Programmer | Miss strike multiplier × 1.6 |
| `review` | Code Review | Reveal radius `dc² + dr² ≤ 8`; lantern light radius 3.4 tiles instead of 2.7 |
| `cache` | CI Cache | Fleeing with a Good press takes no damage |

### Daily omen

- From the hero's own data (in a raid, the raider's): the last day of the window.
- `count > 0`: **Commit Blessing**. On first entering the map, a free relic offer: "Commit Blessing: you contributed today. Choose a relic."
- `count === 0`: **Uncommitted Curse**. Monster damage × 1.15 for the whole run.

## Monsters

- `f = 1 + 0.12 × (startLevel − 1)`
- `hp = round((5 + 7 × t) × f × (t === 5 ? 1.4 : 1))`
- `dmg = round((1 + t) × f × 1.25 × (cursed ? 1.15 : 1) × classDmg)` (1.25 is `QTE.dmgScale`; `classDmg` is the difficulty `dmg`)
- XP `15 × t`, boss 100.
- Fight treasure: `round((t === 5 ? 30 : 3 × t) × loot)`.

### Strike patterns (`strikePlan`)

Each turn after the hero's attack, a surviving monster performs its plan; each strike is its own guard test.

| Monster | Plan |
| --- | --- |
| Tier 1 Lost Ghost | `normal` |
| Tier 2 Bug Imp | `normal`, `quick` |
| Tier 3 Flaky Test Ghoul | `flaky` if `rand() < 0.65`, else `normal` |
| Tier 4 Merge Conflict Lich | `conflict` if `rand() < 0.65`, else `normal` |
| Tier 5 boss | `normal`, `flaky` |
| Tier 5 boss, phase 2 | `conflict`, `flaky`, `quick` |

Damage multiplier on guard tests: Bug Imp × 0.6, boss in phase 2 × 0.75, others × 1.

### Boss phase 2

- Triggers once, the first time the boss survives a hit (strike or counter) with `hp ≤ maxHp / 2`.
- Effects: the phase-2 plan above, guard-test speed × 0.85 (`pat.speed`), pressure × 0.9, strike damage × 0.75.
- Log: "The Phantom remembers every day you skipped. PHASE 2!"

## Combat

- The hero acts first: Attack or Flee.
- **Strike damage per hit:** `max(1, round((atk + traitBonus) × mult × (0.9 + 0.2 × rand())))`, where `mult = ATK_MULT[mode][grade]`, × 1.25 on Perfect with Force Push, × 1.6 on Miss with Pair Programmer. A combo sums its three hits.
- **Guard (monster strike):** Perfect takes 0 and counters for `max(1, round(atk × c))`, with `c = 1` for Git Blame or the sidestep guard and `c = 0.5` otherwise. Good and Miss take `max(1, round(dmg × patternMult × DEF_MULT[guard][grade] × (0.9 + 0.2 × rand())))`.
- **Flee:** one guard test. Safe on Perfect, or on Good with CI Cache; otherwise damage is `max(1, round(dmg × DEF_MULT[guard][grade] × (0.9 + 0.2 × rand())))` with no pattern multiplier. HP never drops below 1 from fleeing. The hero returns to the previous tile and the monster stays.
- **Defeat:** HP 0 ends the run as lost (unless Skeleton's Undying triggers).
- **Win fight:** tile resolved, `defeated + 1`, treasure and XP, shard check. Beating the boss sets `bossDown` and opens the Gate; if the boss was on the Gate, the run is won immediately.
- Stats tracked: `steps`, `defeated`, `chests`, `wisps`, `crits` (Perfect strike hits), `dodges` (Perfect guards, including flee), `bossDmg` (damage taken from the boss), `bossHpLeft` (hero HP when the boss falls).

### Damage multipliers

| Strike mode | Perfect | Good | Miss |
| --- | --- | --- | --- |
| bar | 1.6 | 1 | 0.5 |
| charge | 1.9 | 1.1 | 0.4 |
| combo (each of 3 hits) | 0.55 | 0.35 | 0.08 |

| Guard mode | Perfect | Good | Miss |
| --- | --- | --- | --- |
| ring | 0 | 0.4 | 1 |
| shield | 0 | 0.3 | 1 |
| sidestep | 0 | 0.8 | 1 |

## Timing tests (QTE)

### Constants

| Constant | Value |
| --- | --- |
| `QTE.perfect` | 70 |
| `QTE.good` | 170 |
| `QTE.auraPerfect` | 10 per aura tier |
| `QTE.calm` | 1.6 |
| `QTE.grace` | 120 (presses before this are ignored) |
| `QTE.counter` | 0.5 |
| `QTE.dmgScale` | 1.25 |

### Windows and speed

```
tm = speed × (0.8 + 0.2 × pressure)
P  = (70 + 10 × aura + (Linter ? 25 : 0)) × calm + (Elf ? 15 × calm : 0)
P  = P × pMul × pressure
G  = max(170 × calm × gMul × pressure, 1.4 × P)
sidestep:  P = P × 1.2            (after G is computed)
combo:     G = min(G, 120 × calm × gMul × pressure)
```

A press at offset `|off| ≤ P` is Perfect, `≤ G` is Good, otherwise Miss.

### Modes

| Mode | Timing | Grading | Deadline |
| --- | --- | --- | --- |
| bar | `dur = (1200 − 40t) × calm × tm × slow`; target `zone × dur` with `zone = 0.5 + 0.3 × rand()` | One press against the target | Miss "too late" at `dur + 30` |
| combo | `dur = (1500 − 40t) × calm × tm`; marks at `z0`, `z0 + g1`, `z0 + g1 + g2` (× dur) with `z0 = 0.22 + 0.06 × rand()`, `g1, g2 = 0.22 + 0.05 × rand()` | Each press grades against the next mark; marks passed by more than G are Miss | Remaining marks Miss at `dur + 30` |
| charge | `fill = (1000 − 30t) × calm × tm`; target hold `0.82 × fill`; `dur = 2600 × calm` | Graded on hold length at release. Hold ≥ fill is Miss "overload" | No press by `dur`: Miss "too slow". Overload Miss at `fill + 20` after the press |
| ring | `base = (quick ? 640 : 1150 − 80t) × calm × tm × patSpeed`; target `base`; `dur = target + G` | One press against the target | Miss "too late" at `dur + 30` |
| sidestep | Same as ring, with the sidestep P | Same as ring | Same as ring |
| shield | Same timing as ring; impact at target | Holding at impact: Good, or Perfect if the hold started within P before impact. A press within P after impact: Perfect. Release before impact drops the shield | Not holding at impact: Miss at `target + P + 10` |

Patterns change the guard timing:

- `flaky`: a pause of `(320 + 220 × rand()) × calm × tm` at `base × (0.4 + 0.25 × rand())`; target becomes `base + pause`.
- `conflict`: a decoy ring at `base ± max(1.6 × G, (300 + 120 × rand()) × calm × tm)` (minus if `rand() < 0.5`). Only the solid ring counts.

Release only counts for the key or pointer that started the hold.

### Assist

- Calm mode: `calm = 1.6` in every formula above.
- Auto-timing: every test resolves as Good at the target (charge: after 300 ms).

## Trophies

Awarded when a run ends (win or loss), stored with the date earned. Class wins are stored separately; `classWins` counts distinct classes with a win.

| ID | Name | Condition |
| --- | --- | --- |
| `first` | First Exorcism | Won |
| `self` | Know Thyself | Won, not a raid, source not demo |
| `raider` | Graph Raider | Won a raid |
| `blessed` | Shipped Today | Won with the Commit Blessing |
| `cursed` | Against the Curse | Won under the Uncommitted Curse |
| `flawless` | Zero Regressions | Boss down and `bossDmg === 0` |
| `close` | Hotfix in Prod | Boss down and `bossHpLeft ≤ 5` |
| `dodges` | Untouchable | `dodges ≥ 10` |
| `crits` | Critical Path | `crits ≥ 10` |
| `relics` | Dependency Hell | 4 or more relics held |
| `speed` | Speedrun | Won with `steps ≤ 20` |
| `nochest` | No Dependencies | Won with `chests === 0` |
| `nightmare` | Nightmare Mode | Won with a 4-star class |
| `fullstack` | Full Stack | Wins with all 4 classes |

## Balance simulator (`scripts/simulate.ts`)

### Skill bot

Ported from the prototype's `simulateGrade`. Each press lands at `offset = gauss() × σ` (Box-Muller from the RNG).

- One press: `|offset| ≤ P` Perfect, `≤ G` Good, else Miss.
- Combo: three independent presses.
- Charge: Miss if `offset > fill − target` (overload), otherwise graded as one press.
- `conflict`: Miss with probability `σ / 600` (fell for the decoy) before grading.
- `flaky`: Miss with probability `σ / 700` (pressed at the old pace) before grading.
- Shield: a Miss becomes Good with probability 0.7 (holding early saves most misses).

Route rule (PRD, v1.2): collect shards, heal at chests when below 45% HP (75% before the boss), then fight the boss and walk to the Gate.

### Targets

200 seeds per cell, on the demo graph and on 6 fixture graphs.

| Class | Target |
| --- | --- |
| Knight (Easy) | Casual players (σ 140 ms) win at least 90% |
| Wanderer (Normal) | Average players (σ 100 ms) win at least 80% |
| Mage (Hard) | Average players (σ 100 ms) win 15–50%; good players (σ 60 ms) win at least 60% |
| Rogue (Nightmare) | Good players (σ 60 ms) win at most 40%; expert players (σ 35 ms) win at least 80% |

The Wanderer grade-policy runs from the PRD (All Perfect wins easily, All Good wins if it heals before the boss, Mixed 25/50/25 wins, All Miss loses) stay as a regression check.
