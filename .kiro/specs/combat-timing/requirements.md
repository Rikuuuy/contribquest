# Requirements: combat-timing

## Introduction

This spec covers the fight: the turn order, monster stats and labels, the four hero classes with their stat modifiers, class difficulty and rising pressure, the six timing-test modes and their pure grading, the four monster strike patterns, boss phase 2, damage resolution for strike, guard, and flee, the end of a fight, the Calm and Auto-timing assists, and the engine reducer (`step`, `nextDeadline`) that runs it all. It also ports the prototype's skill bot so the balance simulator can grade tests the way the prototype measured them.

Every rule and number comes from `prototype/index.html` (`QTE`, `CLASSES`, `DIFFICULTY`, `ATK_MULT`, `DEF_MULT`, `pressure`, `applyStats`, `makeMonster`, `sourceLabel`, `startQte`, `qtePress`, `qteRelease`, `shieldImpact`, `finishQte`, `GRADE_LABELS`, `CLASS_HINT`, `resolveAttack`, `strikePlan`, `STRIKE_LINE`, `enemyTurn`, `checkPhase`, `resolveDefend`, `winFight`, `flee`, `resolveFlee`, `lose`, `simulateGrade`, the key handlers) and `.kiro/steering/game-rules.md` ("Hero", "Monsters", "Combat", "Timing tests").

PRD IDs covered: FR-COM-1 to FR-COM-7, FR-CLS-1 to FR-CLS-9, FR-DIF-1 to FR-DIF-5. Shared with progression (this spec applies the combat-side effect; progression owns choosing and owning): FR-PRO-3, FR-REL-2, FR-REL-3, FR-RACE-2, FR-OMEN-2.

## Glossary

- **t**: the monster tier, 1–5. **calm**: 1.6 in Calm mode, otherwise 1. **rand()**: the next draw from the run RNG.
- **Strike test**: the timing test after Attack; mode `bar`, `combo`, or `charge` by class.
- **Guard test**: the timing test for each monster strike and the flee parting strike; mode `ring`, `sidestep`, or `shield` by class.
- **P / G**: the Perfect and Good half-windows in ms around the target.
- **Pattern**: how a monster strike's guard test is timed: `normal`, `quick`, `flaky`, or `conflict`.
- **Test time**: milliseconds since the test started. Every press, release, and deadline is expressed in test time.
- **Mods**: the hero's relic and race flags that change combat (`linter`, `elf`, `force`, `pair`, `blame`, `hotfix`, `cache`, `duck`, `vampire`, `skeleton`).

## Requirements

### Requirement 1: Turn order and actions

**User story:** As a player, I want a clear choice each turn, so that I always know what happens next.

#### Acceptance criteria

1.1 WHEN the hero enters an unresolved `monster` or `boss` tile, or a `gate` tile with `boss: true` THE SYSTEM SHALL start a fight in the `choose` phase with the hero acting first. For the boss THE SYSTEM SHALL log "The air turns cold. Your best day has come back for you." [FR-COM-1]

1.2 WHILE a fight is in the `choose` phase THE SYSTEM SHALL accept exactly two actions: Attack, which starts a strike test, and Flee, which logs "You turn to run. {name} strikes at your back!" and starts one guard test with the `normal` pattern. [FR-COM-1, FR-COM-5]

1.3 WHEN the hero's strike resolves and the monster survives THE SYSTEM SHALL run the monster's strike plan, one guard test per strike, then return to `choose`. [FR-COM-1, FR-COM-5]

1.4 WHILE a test is not in progress THE SYSTEM SHALL ignore presses and releases; WHILE a test is in progress THE SYSTEM SHALL ignore Attack and Flee. [FR-COM-1]

### Requirement 2: Monsters

**User story:** As a player, I want each monster to show where it came from and to get tougher with the day it rose from.

#### Acceptance criteria

2.1 WHEN a fight starts THE SYSTEM SHALL compute `f = 1 + 0.12 × (startLevel − 1)`, `hp = round((5 + 7t) × f × (t === 5 ? 1.4 : 1))`, and `dmg = round((1 + t) × f × 1.25 × curse × classDmg)`, where `curse` is 1.15 under the Uncommitted Curse and 1 otherwise, and `classDmg` is the class difficulty `dmg`. [FR-COM-2, FR-DIF-2, FR-OMEN-2, P7]

2.2 WHEN a monster is created THE SYSTEM SHALL set XP to `15 × t`, or 100 for the boss. [FR-COM-2]

2.3 WHEN naming a monster THE SYSTEM SHALL use Lost Ghost (1), Bug Imp (2), Flaky Test Ghoul (3), Merge Conflict Lich (4), and for the boss "The Phantom of {Ddd D Mmm YYYY}" or, on an empty-quarter map, "The Phantom of the Empty Quarter". [FR-COM-3]

2.4 WHEN labelling a monster's source THE SYSTEM SHALL return "Born from 91 days of silence" for the empty-quarter boss, "Risen from an empty day: {date}" for a shortfall Lost Ghost, and otherwise "Risen from {date}: {count} contribution" with "s" unless the count is 1. [FR-COM-3]

2.5 WHILE a fight is shown THE SYSTEM SHALL expose both HP values and maxima, the monster name, the source label, and "timing {n}%" (requirement 6.3) for the combat view. [FR-COM-3, FR-DIF-4]

### Requirement 3: Hero classes

**User story:** As a player, I want to pick a class that changes how I fight, so that each run can feel different.

#### Acceptance criteria

3.1 WHEN a run starts THE SYSTEM SHALL use the class from settings (`heroClass`), or Wanderer if it is unknown. [FR-CLS-1]

3.2 WHEN the player chooses a class while `steps === 0` THE SYSTEM SHALL set it, recompute stats, and heal to full; WHEN `steps > 0` THE SYSTEM SHALL refuse the change. [FR-CLS-1]

3.3 WHEN stats are computed THE SYSTEM SHALL use `maxHp = round((30 + 6 × (level − 1) + 5 × aura + traitHp + (Cold Brew ? 10 : 0)) × classHp)` and `atk = 5 + 2 × (level − 1) + aura + (Stack Overflow ? 3 : 0) + classAtk + (Orc ? 2 : 0)`, then clamp HP to max HP. [FR-CLS-2]

3.4 WHEN looking up a class THE SYSTEM SHALL use: Wanderer bar/ring, HP ×1, ATK +0; Knight bar/shield, HP ×1.25, ATK −1, bar sweep ×1.15 (`slow`); Rogue combo/sidestep, HP ×0.9, ATK +0; Mage charge/ring, HP ×0.9, ATK +2. [FR-CLS-2]

3.5 WHILE a fight is in `choose` with no log lines yet THE SYSTEM SHALL provide the hint "Level {level} day. It hits for about {dmg}. {class hint}", using the prototype's `CLASS_HINT` text for the class. [FR-CLS-9]

### Requirement 4: Class difficulty

**User story:** As a player, I want to know how hard a class is before I pick it, and harder classes should pay more.

#### Acceptance criteria

4.1 WHEN looking up difficulty THE SYSTEM SHALL use exactly: Knight 1 star Easy, pMul 1.25, gMul 1.2, speed 1.12, ramp 0.01, floor 0.92, loot 1, dmg 0.85; Wanderer 2 Normal, 0.95, 0.9, 0.96, 0.02, 0.82, 1.1, 1.5; Mage 3 Hard, 0.72, 0.62, 0.9, 0.03, 0.72, 1.25, 2.4; Rogue 4 Nightmare, 0.62, 0.68, 0.82, 0.04, 0.6, 1.5, 3.0. [FR-DIF-1]

4.2 WHEN a fight is won THE SYSTEM SHALL add treasure `round((t === 5 ? 30 : 3t) × loot)`. [FR-DIF-2]

4.3 WHEN a class card is shown THE SYSTEM SHALL provide its stars, label, and the line "Timing windows {round(pMul × 100)}%, shrinking {round(ramp × 100)}% per kill to {round(floor × pMul × 100)}%. Treasure ×{loot}." [FR-DIF-5, FR-DIF-1]

### Requirement 5: Pressure

**User story:** As a player, I want each run to get tenser the further I go, and harder classes to tighten faster.

#### Acceptance criteria

5.1 WHEN pressure is read THE SYSTEM SHALL return `max(floor, 1 − ramp × defeated)`, multiplied by 0.9 WHILE the current fight's boss is in phase 2. `defeated` counts every banished monster, the boss included. [FR-DIF-3, P14]

5.2 WHEN windows and test speed are computed THE SYSTEM SHALL use the pressure at the moment the test starts. [FR-DIF-3]

5.3 WHEN a non-boss kill lowers pressure (after < before − 0.001, with "before" read before `defeated` is incremented) THE SYSTEM SHALL log "The graph grows restless: timing windows {n}%." and emit a `timing` event carrying `n` and whether the floor is reached. [FR-DIF-4]

### Requirement 6: Timing windows and speed

**User story:** As a player, I want the windows to reflect my streak, my class, and my options, so that skill and consistency both count.

#### Acceptance criteria

6.1 WHEN a test starts THE SYSTEM SHALL compute `tm = speed × (0.8 + 0.2 × pressure)`, `P = (70 + 10 × aura + (Linter ? 25 : 0)) × calm + (Elf ? 15 × calm : 0)`, then `P = P × pMul × pressure` and `G = max(170 × calm × gMul × pressure, 1.4 × P)`. [FR-CLS-3, FR-RACE-2, FR-REL-1, P12, P15]

6.2 WHEN the mode is `sidestep` THE SYSTEM SHALL multiply P by 1.2 after G is computed. WHEN the mode is `combo` THE SYSTEM SHALL cap G at `120 × calm × gMul × pressure`. [FR-CLS-5, FR-CLS-7]

6.3 WHEN the HUD or combat view asks for the timing percentage THE SYSTEM SHALL return `round(pressure × pMul × 100)` and whether `pressure ≤ floor + 0.001`. [FR-DIF-4]

### Requirement 7: Grading rules common to every mode

**User story:** As a player, I want grading to be fair and mashing not to work.

#### Acceptance criteria

7.1 WHEN a press arrives before test time 120 ms THE SYSTEM SHALL ignore it. [FR-COM-5]

7.2 WHEN grading THE SYSTEM SHALL use a pure function of the test and the list of timed input events (press or release, test time, key id), so the same inputs always give the same grade. [FR-COM-5, FR-COM-6]

7.3 WHEN a single-press mode receives a press at offset `off` from the target THE SYSTEM SHALL grade Perfect if `|off| ≤ P`, Good if `|off| ≤ G`, otherwise Miss with reason "too early" (before the target) or "too late". [FR-COM-5, P12, P16]

7.4 WHEN a release arrives THE SYSTEM SHALL count it only if it comes from the key or pointer that started the hold. [FR-CLS-9]

7.5 WHEN a test is graded THE SYSTEM SHALL produce the display text `{REASON · }{label}` with the reason in upper case, using the labels bar "CRITICAL! / GOOD HIT / GLANCING BLOW", charge "CRITICAL SPELL! / SPELL HIT / FIZZLE", ring "PERFECT DODGE! / BLOCKED / HIT!", sidestep "PERFECT SIDESTEP! / GRAZED / HIT!", shield "PERFECT PARRY! / BLOCKED / HIT!". [FR-COM-5, FR-CLS-9]

### Requirement 8: Bar (strike)

#### Acceptance criteria

8.1 WHEN a bar test starts THE SYSTEM SHALL set `dur = (1200 − 40t) × calm × tm × slow` (`slow` is 1.15 for the Knight, otherwise 1), `zone = 0.5 + 0.3 × rand()`, and target `zone × dur`. [FR-CLS-4]

8.2 WHEN no press has graded the test by `dur + 30` THE SYSTEM SHALL grade Miss "too late". [FR-CLS-4]

8.3 WHEN a bar strike resolves THE SYSTEM SHALL use multipliers Perfect ×1.6, Good ×1, Miss ×0.5. [FR-CLS-4]

### Requirement 9: Combo (strike)

#### Acceptance criteria

9.1 WHEN a combo test starts THE SYSTEM SHALL set `dur = (1500 − 40t) × calm × tm`, draw `z0 = 0.22 + 0.06 × rand()`, `g1 = 0.22 + 0.05 × rand()`, `g2 = 0.22 + 0.05 × rand()` in that order, and place marks at `z0`, `z0 + g1`, `z0 + g1 + g2` times `dur`. [FR-CLS-5]

9.2 WHEN a press arrives THE SYSTEM SHALL first mark as Miss every remaining mark passed by more than G, then grade the press against the next mark. WHEN three marks are graded THE SYSTEM SHALL finish the test. [FR-CLS-5]

9.3 WHEN test time reaches `dur + 30` THE SYSTEM SHALL mark every remaining mark Miss, with reason "too late" if all three are Miss. [FR-CLS-5]

9.4 WHEN a combo resolves THE SYSTEM SHALL deal three separate hits with multipliers Perfect ×0.55, Good ×0.35, Miss ×0.08 each, and show "PERFECT COMBO!" for three Perfects, otherwise "{n}/3 HITS · " followed by the initials of the three grades. [FR-CLS-5, FR-CLS-9]

### Requirement 10: Charge (strike)

#### Acceptance criteria

10.1 WHEN a charge test starts THE SYSTEM SHALL set `fill = (1000 − 30t) × calm × tm`, target hold `0.82 × fill`, and `dur = 2600 × calm`. [FR-CLS-6]

10.2 WHEN no press arrives by `dur` THE SYSTEM SHALL grade Miss "too slow". [FR-CLS-6]

10.3 WHEN the holding key is released after holding `held` ms THE SYSTEM SHALL grade Miss "overload" if `held ≥ fill`, Perfect if `|held − target| ≤ P`, Good if `≤ G`, otherwise Miss "too weak" (short) or "overload" (long). [FR-CLS-6]

10.4 WHEN the hold is still down at `pressTime + fill + 20` THE SYSTEM SHALL grade Miss "overload". [FR-CLS-6]

10.5 WHEN a charge strike resolves THE SYSTEM SHALL use multipliers Perfect ×1.9, Good ×1.1, Miss ×0.4. [FR-CLS-6]

### Requirement 11: Ring and sidestep (guard) with monster patterns

#### Acceptance criteria

11.1 WHEN a ring or sidestep test starts THE SYSTEM SHALL set `base = (quick ? 640 : 1150 − 80t) × calm × tm × patSpeed` (`patSpeed` 0.85 while the boss is in phase 2, otherwise 1), target `base`, and `dur = target + G`. [FR-CLS-7]

11.2 WHEN the pattern is `flaky` THE SYSTEM SHALL draw `pause = (320 + 220 × rand()) × calm × tm`, then `pauseAt = base × (0.4 + 0.25 × rand())`, and set target `base + pause`. [FR-CLS-7]

11.3 WHEN the pattern is `conflict` THE SYSTEM SHALL draw the decoy distance `max(1.6 × G, (300 + 120 × rand()) × calm × tm)`, then its side (before the target if `rand() < 0.5`), and grade only against the solid ring. [FR-CLS-7]

11.4 WHEN no press has graded the test by `dur + 30` THE SYSTEM SHALL grade Miss "too late". [FR-CLS-7]

11.5 WHEN a ring guard resolves THE SYSTEM SHALL use Perfect ×0 plus a counter, Good ×0.4, Miss ×1. WHEN a sidestep guard resolves THE SYSTEM SHALL use Perfect ×0 plus a counter at 100% ATK, Good ×0.8, Miss ×1. [FR-CLS-7]

### Requirement 12: Shield (guard)

#### Acceptance criteria

12.1 WHEN a shield test starts THE SYSTEM SHALL time it like the ring (requirement 11.1–11.3) with impact at the target. [FR-CLS-8]

12.2 WHEN the shield is held at impact THE SYSTEM SHALL grade Perfect if the hold started within P before impact, otherwise Good. A release before impact drops the shield. [FR-CLS-8]

12.3 WHEN a press arrives after impact and within P of it THE SYSTEM SHALL grade Perfect. [FR-CLS-8]

12.4 WHEN the shield is not held at impact and no Perfect press follows by `target + P + 10` THE SYSTEM SHALL grade Miss "no shield" (never raised) or "shield down" (released early). [FR-CLS-8]

12.5 WHEN a shield guard resolves THE SYSTEM SHALL use Perfect ×0 plus a counter at 50% ATK, Good ×0.3, Miss ×1. [FR-CLS-8]

### Requirement 13: Monster strike plans

**User story:** As a player, I want each monster to attack in a way that matches its name.

#### Acceptance criteria

13.1 WHEN a monster's turn starts THE SYSTEM SHALL choose its plan: tier 1 `normal`; tier 2 `normal`, `quick`; tier 3 `flaky` if `rand() < 0.65` else `normal`; tier 4 `conflict` if `rand() < 0.65` else `normal`; the boss `normal`, `flaky`, or in phase 2 `conflict`, `flaky`, `quick`. [FR-CLS-7]

13.2 WHEN each strike starts THE SYSTEM SHALL log the prototype's `STRIKE_LINE` text for its pattern. [FR-COM-5]

13.3 WHEN a guard test takes damage THE SYSTEM SHALL apply the pattern multiplier: Bug Imp ×0.6, boss in phase 2 ×0.75, otherwise ×1. [FR-COM-2]

### Requirement 14: Boss phase 2

**User story:** As a player, I want the boss fight to turn once I have it on the ropes.

#### Acceptance criteria

14.1 WHEN the boss survives a strike hit or a counter with `hp ≤ maxHp / 2` for the first time THE SYSTEM SHALL enter phase 2, log "The Phantom remembers every day you skipped. PHASE 2!", and emit a `phase2` event. [FR-COM-5]

14.2 WHILE the boss is in phase 2 THE SYSTEM SHALL use the phase-2 plan for every new turn, guard speed ×0.85, pressure ×0.9, and strike damage ×0.75; a plan already in progress keeps its remaining strikes. [FR-COM-5, FR-DIF-3]

### Requirement 15: Damage resolution

**User story:** As a player, I want a better press always to be at least as good for me.

#### Acceptance criteria

15.1 WHEN a strike resolves THE SYSTEM SHALL deal, per hit and in hit order, `max(1, round((atk + traitBonus) × mult × (0.9 + 0.2 × rand())))`, where `traitBonus` is 2 if the fight's row is a trait row, `mult` is the mode's multiplier for the grade, × 1.25 on Perfect with Force Push, × 1.6 on Miss with Pair Programmer. [FR-COM-5, FR-REL-2, P13]

15.2 WHEN a strike resolves THE SYSTEM SHALL add one to `crits` per Perfect hit and, for a Vampire below max HP, heal `min(maxHp − hp, 2 × perfectHits)`. [FR-COM-5, FR-RACE-2]

15.3 WHEN a guard is Perfect THE SYSTEM SHALL take 0 damage, add one to `dodges`, counter for `max(1, round(atk × c))` with `c = 1` for Git Blame or the sidestep guard and 0.5 otherwise, and with Hotfix below max HP heal `min(maxHp − hp, ceil(maxHp × 0.06))`. [FR-COM-5, FR-CLS-7, FR-CLS-8, FR-REL-1, P13]

15.4 WHEN a guard is Good or Miss THE SYSTEM SHALL take `max(1, round(dmg × patternMult × guardMult × (0.9 + 0.2 × rand())))`, add it to `bossDmg` when the monster is the boss, and log the prototype's block, graze, or hit line. [FR-COM-5, P13]

15.5 WHEN a hit would leave a Skeleton at 0 HP for the first time in the run THE SYSTEM SHALL leave 1 HP and log "Your bones rattle back together. UNDYING!". [FR-RACE-2]

15.6 WHEN the first Miss of a fight occurs while the hero holds Rubber Duck THE SYSTEM SHALL turn it into Good with reason "rubber duck"; in a combo only the first missed hit changes. [FR-REL-3]

### Requirement 16: Fleeing

#### Acceptance criteria

16.1 WHEN the flee guard is Perfect, or Good with CI Cache, THE SYSTEM SHALL take no damage; otherwise THE SYSTEM SHALL take `max(1, round(dmg × guardMult × (0.9 + 0.2 × rand())))` with no pattern multiplier. [FR-COM-1, FR-REL-1]

16.2 WHEN fleeing THE SYSTEM SHALL never drop HP below 1, add one to `dodges` on Perfect, return the hero to the previous tile, leave the monster unresolved, end the fight, and log "You escaped but took {n} damage. It still haunts that day." or "A perfect escape. It still haunts that day." [FR-COM-1]

### Requirement 17: End of a fight

#### Acceptance criteria

17.1 WHEN the monster's HP reaches 0 THE SYSTEM SHALL mark the tile resolved, add one to `defeated`, add treasure (requirement 4.2) and the monster's XP, log "{name} is banished: +{xp} XP, +{gold} treasure.", apply the pressure message (5.3), and collect a soul shard (map-generation requirement 7.1). [FR-COM-1, FR-PRO-1]

17.2 WHEN the boss falls THE SYSTEM SHALL set `bossDown`, record `bossHpLeft` as the hero's HP, and log "The Phantom falls. The Gate is unsealed!"; WHEN the boss stood on the Gate THE SYSTEM SHALL end the run as won. [FR-PRO-3]

17.3 WHEN the hero enters the unsealed Gate THE SYSTEM SHALL end the run as won. [FR-PRO-3]

17.4 WHEN the hero's HP reaches 0 THE SYSTEM SHALL end the run as lost and record the monster's name. [FR-COM-4]

17.5 WHEN the player retries after a loss THE SYSTEM SHALL start a new run on the same ContributionSet (and raid hero set) from memory, with no fetch. [FR-COM-4]

### Requirement 18: Input

**User story:** As a player on keyboard or touch, I want my press to count at the moment I made it.

#### Acceptance criteria

18.1 WHILE a test is in progress THE SYSTEM SHALL treat Space, Enter, A, J, and K, and a pointer press on the "Now!" button or the test area, as a press; key-up and pointer-up, -cancel, or -leave as a release. Auto-repeated key events are ignored. [FR-COM-6, FR-CLS-9]

18.2 WHILE a fight is in `choose` THE SYSTEM SHALL map F or Escape to Flee and the hit keys to Attack. [FR-COM-1, FR-COM-6]

18.3 WHEN a press or release is passed to the engine THE SYSTEM SHALL use the input event's `timeStamp` minus the test's start time, not the time it is processed. [FR-COM-6]

### Requirement 19: Assists and reload

**User story:** As a player who cannot use fast inputs, I want the timing to slow down or go away.

#### Acceptance criteria

19.1 WHILE Calm mode is on THE SYSTEM SHALL use `calm = 1.6` in every duration and window. [FR-COM-7, P12]

19.2 WHILE Auto-timing is on THE SYSTEM SHALL ignore presses and grade every test Good at its target time (charge: at 300 ms). The random draws for the test still happen, so the RNG sequence is the same. [FR-COM-7]

19.3 WHEN a run is restored with a fight that had a test in progress THE SYSTEM SHALL drop the test and resume the fight at `choose`. [FR-COM-7]

### Requirement 20: Engine reducer and deadlines

**User story:** As a developer, I want the whole fight to run headlessly from inputs and times, so that tests and the simulator play it without a browser.

#### Acceptance criteria

20.1 WHEN an action is applied THE SYSTEM SHALL return a new state from `step(state, action)` without mutating the input, and SHALL take every random number from the run RNG stored in the state. [FR-COM-5]

20.2 WHILE a test is in progress THE SYSTEM SHALL report its next deadline in test time from `nextDeadline(state)`, and grade on a `timeout` action at that time; otherwise `nextDeadline` returns `null`. [FR-COM-5]

20.3 WHEN a test resolves THE SYSTEM SHALL move the fight to `wait` with the next step named (`strike i`, `choose`, `win`, `lose`, or `escape`), and continue only on an `advance` action, so the presentation controls pacing. [FR-COM-1]

20.4 WHEN the simulator or a test injects a grade with `forceGrade` THE SYSTEM SHALL resolve the current test with it, applying Rubber Duck as for a real grade. [FR-COM-5]

20.5 WHEN the same state receives the same actions THE SYSTEM SHALL produce the same states, including the RNG state. [FR-COM-5, FR-MAP-3]

### Requirement 21: Skill bot

**User story:** As a developer tuning balance, I want a bot that presses like a person, so that win rates per class can be measured.

#### Acceptance criteria

21.1 WHEN the skill bot grades a test with skill σ THE SYSTEM SHALL place each press at `gauss() × σ` from the target (Box-Muller from the bot's own RNG, seeded `σ × 7919 + seed × 104729`), grade one press Perfect within P, Good within G, else Miss; three independent presses for a combo; for charge Miss if the offset exceeds `fill − target`. [FR-DIF-1]

21.2 WHEN the pattern is `conflict` THE SYSTEM SHALL grade Miss with probability `σ / 600` before grading; WHEN `flaky`, Miss with probability `σ / 700`; WHEN the guard is a shield, turn a Miss into Good with probability 0.7. [FR-DIF-1]
