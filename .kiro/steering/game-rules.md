---
inclusion: fileMatch
fileMatchPattern: "src/engine/**,src/mapgen/**,scripts/**"
---

# Game rules

Every value below is copied from `prototype/index.html`, except the rules marked **(v1.6)**. The prototype is the source of truth for everything else: if this file, the PRD, and the prototype disagree, the prototype wins and this file is corrected. Every constant here must exist in `src/engine/balance.ts` with the same value. Change both in the same commit.

**(v1.6) Rebuild-only rules.** PRD v1.6 (27 Nov 2026) replaces free 4-direction exploration with forward-only branching routes: one column (week) is one floor, every tile entered must be resolved, Flee is removed, the boss is a final node after the last week, and soul shards weaken the boss instead of gating it. These rules apply only to the TypeScript rebuild; `prototype/` keeps its v1.5 rules and is not edited. The v1.6 numbers are not in the prototype. They are tunable starting values chosen in the v1.6 design, to be re-measured with the simulator after implementation. Class difficulty numbers are unchanged.

Notation: `t` is the monster tier, `calm` is 1.6 in Calm mode and 1 otherwise, `rand()` is the next draw from the run's seeded RNG, and all times are milliseconds.

## Determinism

- **Hash:** 32-bit FNV-1a. `h = 0x811c9dc5`; for each UTF-16 code unit: `h ^= code; h = Math.imul(h, 0x01000193)`; return `h >>> 0`.
- **RNG (mulberry32):** state `s` (uint32). `next()`: `s = (s + 0x6D2B79F5) >>> 0; t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296`.
- **Map seed:** `fnv1a(username.toLowerCase() + "|" + lastDate)`, where `lastDate` is the last date in the map owner's 91 days.
- **Map RNG** (shortfall only): seeded with `seed ^ 0x9e3779b9`. One instance per map: the count shortfall draws first, then the route shortfall (v1.6) continues from the same state.
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
- Cells with no day are `void` and never entered. They only occur at the top of the first column and the bottom of the last.
- **(v1.6)** Each column is one floor (one week). Movement is forward-only between columns (see "Routes"); there is no 4-directional movement.

### Tile assignment

`h = fnv1a(date)` per day.

| Condition (first match wins) | Tile |
| --- | --- |
| Index 0 | `start` (the crypt) |
| Level 0 | `fog` (a quiet day); gravestone decoration if `h % 6 === 0` |
| Level 1 | `wisp` |
| Level 2 | `chest` size 1 if `h % 3 === 0`, else `monster` tier 2 (Bug Imp) |
| Level 3 | `chest` size 2 if `h % 3 === 0`, else `monster` tier 3 (Flaky Test Ghoul) |
| Level 4 | `monster` tier 4 (Merge Conflict Lich) |

- **(v1.6)** No tile has kind `boss` or `gate`. The best day and the last day (index 90) get their tile from the table like any other day. The best day's tile is flagged `bestDay: true` (not on an empty-quarter map) so it can show a marker; it is usually a Merge Conflict Lich.
- **Best day:** the highest count among indexes 1–90 (never the start). Ties go to the latest date. The boss is named after it (`bossIdx`).
- **Empty quarter:** if the best count is 0, `bossIdx` is `floor(91 / 2)` = 45 and the boss is named "The Phantom of the Empty Quarter".
- **Shortfall (count):** if fewer than **6** tiles have kind `monster`, shuffle all `fog` tiles with Fisher-Yates using the map RNG (`for i from len−1 down to 1: j = floor(next() × (i + 1))`), then pop from the end and turn each into a tier-1 `monster` (Lost Ghost, `risen: true`, no decoration) until there are 6 or the pool is empty. The map is marked `quiet`.
- **Shortfall (route, v1.6):** see "Minimum fights per route" below. It runs after the count shortfall.
- **(v1.6)** There is no `shardsNeeded` and no ward.
- **Validation:** see "Route validation" below. A failing map is an error with demo mode, never shown.

### Routes (v1.6)

| Route constant | Value |
| --- | --- |
| `ROUTE_REACH` | 1 |
| `MIN_ROUTE_FIGHTS` | 4 |

- The hero starts on the start tile (column 0, row `w0`). Every move goes from column `c` to column `c + 1`. There is no moving back, sideways, or staying.
- **Legal moves** from a day tile at `(c, r)` with `c < cols − 1`: the day tiles of column `c + 1` in rows `r − 1`, `r`, `r + 1` (`ROUTE_REACH` = 1), skipping void cells and rows outside 0–6. Up to 3 choices, listed in ascending row order.
- **Edge fallback:** if none of the three is a day tile (only possible when moving into the last column, whose days end at row `(w0 + 90) % 7`), the only legal move is the day tile of column `c + 1` whose row is closest to `r` (ties go to the smaller row). Because a column's day rows are contiguous, this is the boundary row. A legal move therefore always exists. On the demo map (14 columns, last column rows 0–1), a hero at column 12, rows 3–6 moves to (13, 1).
- **Boss node:** a final node after the last week at `bossNode = { col: cols, row: tiles[bossIdx].row }`. It is not a day tile. From every last-column tile the only legal move is the boss node. Entering it starts the boss fight. A route is start → `cols − 1` day tiles → boss node, exactly `cols` moves.
- Every move adds 1 to `steps`, marks the tile visited, and enters it. A move to anything that is not a legal move is ignored: no step, no log line, no event.
- Moves are accepted only while `status === "exploring"`, so a fight or a relic offer must be finished before the next move.

### Minimum fights per route (v1.6)

Every route from the start to the boss node enters at least `MIN_ROUTE_FIGHTS` = **4** `monster` tiles (the boss does not count). After the count shortfall:

1. `best(t)` = `(t.kind === "monster" ? 1 : 0)` plus, unless `t` is in the last column, the minimum `best` over its legal moves. `routeMin = best(start)`.
2. While `routeMin < 4`: walk the fight-minimal route from the start (at each step take the first legal move, in ascending row order, with the smallest `best`). Its candidate tiles are those in columns ≥ 1 with kind `fog`; if there are none, kind `wisp`; if none, kind `chest`. Pick `candidates[floor(next() × candidates.length)]` with the map RNG and turn it into a tier-1 `monster` (Lost Ghost, `risen: true`, no decoration, no chest size). Recompute `best`.
3. The loop always ends with `routeMin ≥ 4`: each conversion removes one non-monster tile, and a route below 4 fights enters at least `cols − 1 − 3 ≥ 9` convertible tiles.

The route shortfall does not set `quiet` (that flag keeps its count-shortfall meaning for the summary text).

### Route validation (v1.6)

A map is valid when: all 91 tiles exist with the start at index 0; every date appears exactly once; every tile reachable from the start has at least one legal move, each going exactly one column forward (or to the boss node from the last column); and `routeMin ≥ MIN_ROUTE_FIGHTS`. Failures give "The map could not be raised." (missing tiles), "Duplicate days in the map.", or "The map has no route." (moves or fights).

### Visibility window (v1.6)

| Window constant | Value |
| --- | --- |
| `VIEW_AHEAD` | 2 |
| `VIEW_AHEAD_REVIEW` | 3 |

- At run start, after every move, and when Code Review is picked, every tile with `col ≤ pos.col + VIEW_AHEAD` (`VIEW_AHEAD_REVIEW` with Code Review) is marked `seen`. Seen tiles stay seen, so the tiles behind the hero stay revealed.
- A seen tile shows its contents. An unseen tile shows only its shape and level colour (fog); its contents are hidden. The boss node is always shown.
- Because `pos.col` and the window only grow, `seen ⇔ col ≤ pos.col + window` holds at every point of a run.
- While exploring, the legal moves (up to 3 tiles, or the boss node) are highlighted. They are always inside the window.

### Names and labels

| Tier | Name |
| --- | --- |
| 1 | Lost Ghost |
| 2 | Bug Imp |
| 3 | Flaky Test Ghoul |
| 4 | Merge Conflict Lich |
| 5 | The Phantom of {Ddd D Mmm YYYY}, or The Phantom of the Empty Quarter |

Source label: "Born from 91 days of silence" (empty-quarter boss), "Risen from an empty day: {date}" (Lost Ghost from the shortfall on a day with count 0), otherwise "Risen from {date}: {count} contribution(s)". **(v1.6)** A Lost Ghost raised by the route shortfall from a wisp or chest day keeps the normal label, because its day has contributions.

## Exploration

Every tile entered resolves and cannot be skipped **(v1.6)**. The start tile is resolved at run start.

| Rest constant | Value |
| --- | --- |
| `REST_HEAL` | 0.05 |
| `WISP_HEAL` | 0.1 |

- **(v1.6) Quiet day (fog):** heal `ceil(maxHp × REST_HEAL)` up to max, no XP, resolved. Log "A quiet day ({date}). You catch your breath: +{n} HP." or, at full HP, "A quiet day ({date}). Nothing stirs."
- **Wisp:** +5 XP, resolved. **(v1.6)** Also heal `ceil(maxHp × WISP_HEAL)` up to max, before the XP.
- **Chest:** +6 treasure (size 1) or +12 (size 2), heal `ceil(maxHp × 0.3)` up to max, +10 XP, then a relic offer. Resolved.
- **Monster:** starts combat. The fight ends only in a win or a loss.
- **(v1.6) Boss node:** starts the boss fight. Winning it wins the run. There is no Gate and no sealed or warded tile.

### Soul shards (v1.6)

| Shard constant | Value |
| --- | --- |
| `SHARD_MAX` | 3 |
| `SHARD_BOSS_HP_CUT` | 0.1 |
| `SHARD_NO_PHASE2` | 3 |

- Banishing a tier 3 or tier 4 monster while `shards < SHARD_MAX` adds 1 shard. Shards are a bonus: the boss is never blocked.
- Log: "Soul shard {n}/3. The Phantom weakens.", or at 3: "Soul shard 3/3. The Phantom is bound: no Phase 2."
- Each shard cuts the boss's max HP by 10%: `bossHp = round((5 + 7 × 5) × f × 1.4 × (1 − SHARD_BOSS_HP_CUT × shards))`. With 0 shards this equals the v1.5 boss.
- With `shards ≥ SHARD_NO_PHASE2` (3) the boss never enters phase 2.
- Boss fight start, when `shards > 0`: "{n} soul shard{s} weaken the Phantom: {10n}% less HP." or, at 3, "3 soul shards bind the Phantom: 30% less HP and no Phase 2."

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
| `review` | Code Review | **(v1.6)** Visibility window one column further: `VIEW_AHEAD_REVIEW` = 3 columns ahead instead of 2; the lantern light is wider (presentation) |
| `cache` | CI Cache | **(v1.6)** After each won fight (not the boss), heal `ceil(maxHp × 0.1)` (`RELIC_COMBAT.cacheHeal`), up to max. Replaces "Fleeing with a Good press takes no damage" |

CI Cache text in the game: "After each won fight, heal 10% of max HP." Code Review text: "See one more week ahead."

### Daily omen

- From the hero's own data (in a raid, the raider's): the last day of the window.
- `count > 0`: **Commit Blessing**. On first entering the map, a free relic offer: "Commit Blessing: you contributed today. Choose a relic."
- `count === 0`: **Uncommitted Curse**. Monster damage × 1.15 for the whole run.

## Monsters

- `f = 1 + 0.12 × (startLevel − 1)`
- `hp = round((5 + 7 × t) × f × (t === 5 ? 1.4 : 1))`
- **(v1.6)** For the boss the product inside `round` is also × `(1 − SHARD_BOSS_HP_CUT × shards)` (see "Soul shards"); shards are read when the boss fight starts.
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

- Triggers once, the first time the boss survives a hit (strike or counter) with `hp ≤ maxHp / 2`. **(v1.6)** Never triggers when the hero holds 3 soul shards.
- Effects: the phase-2 plan above, guard-test speed × 0.85 (`pat.speed`), pressure × 0.9, strike damage × 0.75.
- Log: "The Phantom remembers every day you skipped. PHASE 2!"

## Combat

- The hero acts first. **(v1.6)** The only action is Attack; Flee is removed, so every fight ends in a win or a loss.
- **(v1.6)** The boss fight's row (for the weekday trait) is the best day's row, which is also `bossNode.row`.
- **Strike damage per hit:** `max(1, round((atk + traitBonus) × mult × (0.9 + 0.2 × rand())))`, where `mult = ATK_MULT[mode][grade]`, × 1.25 on Perfect with Force Push, × 1.6 on Miss with Pair Programmer. A combo sums its three hits.
- **Guard (monster strike):** Perfect takes 0 and counters for `max(1, round(atk × c))`, with `c = 1` for Git Blame or the sidestep guard and `c = 0.5` otherwise. Good and Miss take `max(1, round(dmg × patternMult × DEF_MULT[guard][grade] × (0.9 + 0.2 × rand())))`.
- **Flee (removed in v1.6):** the rebuild has no Flee action, no parting strike, and no escape. The prototype keeps it.
- **Defeat:** HP 0 ends the run as lost (unless Skeleton's Undying triggers).
- **Win fight:** tile resolved, `defeated + 1`, treasure and XP, shard check, then **(v1.6)** CI Cache's heal (non-boss fights). **(v1.6)** Beating the boss sets `bossDown`, records `bossHpLeft`, logs "The Phantom falls. Your graph is exorcised.", and wins the run.
- Logs: the map log keeps the last 4 lines, the combat log the last 7.
- Stats tracked: `steps`, `defeated`, `chests`, `wisps`, `crits` (Perfect strike hits), `dodges` (Perfect guards), `bossDmg` (damage taken from the boss), `bossHpLeft` (hero HP when the boss falls). **(v1.6)** `steps` always ends at `cols` on a won run.

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
| `speed` | Speedrun | **(v1.6)** Won with `defeated ≤ TROPHY_SPEED_FIGHTS` (6, the boss included). Replaces `steps ≤ 20`, which every route now meets |
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

Route rule **(v1.6)**, replacing the v1.2 "collect shards, then boss, then Gate" walk. At each column the bot picks one of the legal moves (it only reads tiles inside the visibility window). It switches to heal mode below 45% HP (75% before the boss), where "before the boss" means the move's target column is one of the last `SIM.bossWeeks` = 2 columns (`col ≥ cols − 2`):

- Heal mode: chest, then wisp, then fog, then monster by lowest tier first.
- Otherwise: monster by highest tier first (tier 4, 3, 2, 1; elites give shards and the most XP), then chest, then wisp, then fog.
- Ties go to the lower row (the first legal move). From the last column the only move is the boss node.

The bot never resolves anything by choice: it attacks in every fight and picks the first relic offered. Balance targets below are re-measured after the v1.6 rules are implemented; class difficulty numbers stay as they are.

A simulated run stops after 2000 actions (counted as a loss). The Mixed grade policy draws from `makeRng(1234)`.

### Targets

200 seeds per cell, on the demo graph and on 6 fixture graphs.

| Class | Target |
| --- | --- |
| Knight (Easy) | Casual players (σ 140 ms) win at least 90% |
| Wanderer (Normal) | Average players (σ 100 ms) win at least 80% |
| Mage (Hard) | Average players (σ 100 ms) win 15–50%; good players (σ 60 ms) win at least 60% |
| Rogue (Nightmare) | Good players (σ 60 ms) win at most 40%; expert players (σ 35 ms) win at least 80% |

The Wanderer grade-policy runs from the PRD (All Perfect wins easily, All Good wins if it heals before the boss, Mixed 25/50/25 wins, All Miss loses) stay as a regression check.
