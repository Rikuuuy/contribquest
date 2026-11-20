# Design: combat-timing

## Overview

The fight is a state machine inside the engine reducer. Timing tests are data (`QteTest`) created with the run RNG when they start, and graded by a pure function of the test and the input events received so far. The browser feeds real event timestamps; tests and the simulator feed generated ones or inject a grade. Nothing here touches the DOM, storage, `Math.random`, or a clock.

```
main.ts                       engine (pure)
───────                       ─────────────
key / pointer ──► input.ts ──► Action ──► step(state, action) ──► new state + events
timer at nextDeadline ───────► timeout ──┘          │
render pacing done ──────────► advance ──┘          ├─ explore.ts   (move checks, reveal, shards)
                                                    ├─ combat.ts    (fight flow, damage)
                                                    ├─ qte.ts       (create test, grade, deadline)
                                                    ├─ patterns.ts  (strike plans, phase 2)
                                                    ├─ monsters.ts  (stats, names, labels)
                                                    ├─ classes.ts / difficulty.ts / mods.ts
                                                    └─ balance.ts   (every number)
```

## Fight state machine

```
            Attack                 strike resolved, monster alive
 choose ───────────► test(strike) ─────────────────► wait(strike 0)
   ▲  │ Flee                 │ monster hp 0                │ advance
   │  ▼                      ▼                              ▼
   │ test(flee) ──► wait(escape)   wait(win) ◄── counter kills ── test(guard i)
   │                    │ advance      │ advance                    │ resolved
   │                    ▼              ▼                            ▼
   │               exploring      winFight → exploring / won   wait(strike i+1) | wait(choose) | wait(lose)
   └──────────────────────────────────────────────────────── advance ┘
```

- A test starts as soon as its phase is entered: Attack and Flee start one immediately; `advance` from `wait(strike i)` picks the plan (on `i = 0`) and starts guard test `i`.
- `fight.testId` increments for every new test so `main.ts` can record `testStart = performance.now()` when it renders a new id.
- The prototype's pacing delays (600, 1500, 950, 1300, 750, 500, 700, 400, 1100, 850, 1250, 1600 ms) are presentation timing. They belong to the presentation spec's pacing table, which decides when to send `advance`. The simulator and tests send `advance` at once.

## RNG call order

All draws come from `state.rng` through `rand(draft)`, which calls `nextFloat` from `src/mapgen/rng.ts` and stores the new state. The order matches the prototype exactly, so a seed replays the same fight:

1. Strike test start: bar 1 draw (zone); combo 3 draws (`z0`, `g1`, `g2`); charge none.
2. Strike resolve: 1 draw per hit, in hit order (combo: 3).
3. Turn start (`advance` to strike 0): tier 3 and 4 draw 1 for the plan; others none.
4. Guard test start: `flaky` 2 draws (pause, then pauseAt); `conflict` 2 draws (distance, then side); others none.
5. Guard resolve: Good or Miss 1 draw; Perfect none.
6. Flee: test start none (`normal`); resolve 1 draw unless safe.

Auto-timing and `forceGrade` still perform steps 1 and 4, as the prototype did.

## Module files

| File | Contents |
| --- | --- |
| `src/engine/balance.ts` | `QTE`, `ATK_MULT`, `DEF_MULT`, `CLASSES` numbers, `DIFFICULTY`, monster formula constants, pattern constants, phase-2 constants, relic and race combat constants; re-exports the mapgen rule constants |
| `src/engine/state.ts` | `RunState`, `Hero`, `Monster`, `Fight`, `QteTest`, `InputEvent`, `Action`, `GameEvent`, `RunOptions` |
| `src/engine/rand.ts` | `rand(draft)` |
| `src/engine/classes.ts` | `CLASS_INFO` (name, strike, guard, hint text), `heroClass`, `applyStats`, `chooseClass` |
| `src/engine/difficulty.ts` | `classDiff`, `pressure`, `timingPercent`, `classCardLine` |
| `src/engine/mods.ts` | `modsOf(hero)` from relics and race |
| `src/engine/monsters.ts` | `TIER_NAMES`, `makeMonster`, `sourceLabel`, `fightTreasure` |
| `src/engine/patterns.ts` | `strikePlan`, `patternDamageMult`, `checkPhase2`, `STRIKE_LINE` |
| `src/engine/qte.ts` | `windows`, `createTest`, `grade`, `testDeadline`, `gradeText`, `GRADE_LABELS` |
| `src/engine/combat.ts` | `startFight`, `startStrike`, `resolveStrike`, `startGuard`, `resolveGuard`, `startFlee`, `resolveFlee`, `winFight`, `loseFight`, `applyDuck` |
| `src/engine/step.ts` | `step`, `nextDeadline` |
| `src/engine/input.ts` | `combatKey(key)` → `"hit" | "flee" | null` (pure key-name mapping used by `main.ts`) |
| `src/engine/skillbot.ts` | `makeSkillBot(sigma, seed)`, `skillGrade(test, bot)` |
| `src/engine/index.ts` | Public API |

## Types

```ts
// state.ts
export type Grade = "perfect" | "good" | "miss";
export type ComboGrade = [Grade, Grade, Grade];
export type StrikeMode = "bar" | "combo" | "charge";
export type GuardMode = "ring" | "sidestep" | "shield";
export type Mode = StrikeMode | GuardMode;
export type Pattern = "normal" | "quick" | "flaky" | "conflict";
export type Why = "too early" | "too late" | "too slow" | "too weak" | "overload" | "no shield" | "shield down" | "rubber duck";
export type RelicId = "duck" | "hotfix" | "force" | "linter" | "stack" | "coffee" | "blame" | "pair" | "review" | "cache";

export type Trait = { name: string; text: string; rows: number[]; hp: number };   // built by progression
export type Hero = {
  name: string; cls: ClassId; race: RaceId;
  xp: number; level: number; startLevel: number; aura: number; trait: Trait; total91: number;
  hp: number; maxHp: number; atk: number; treasure: number;
  relics: RelicId[]; omen: "blessed" | "cursed";
};

export type Monster = { name: string; tier: Tier; hp: number; maxHp: number; dmg: number; xp: number; phase2: boolean };

export type QteTest = {
  kind: "attack" | "defend" | "flee"; mode: Mode; pattern: Pattern;
  P: number; G: number; dur: number; target: number;
  zone?: number;                      // bar, fraction of dur
  marks?: [number, number, number];   // combo, test time
  fill?: number;                      // charge
  pauseAt?: number; pause?: number;   // flaky
  decoy?: number;                     // conflict, test time of the dashed ring
};
export type InputEvent = { type: "down" | "up"; t: number; key: string };
export type GradeResult = { grade: Grade | ComboGrade; why?: Why };

export type FightNext =
  | { kind: "strike"; i: number } | { kind: "choose" } | { kind: "win" } | { kind: "lose" } | { kind: "escape" };
export type Fight = {
  col: number; row: number; m: Monster;
  phase: "choose" | "test" | "wait";
  test: QteTest | null; events: InputEvent[]; testId: number;
  plan: Pattern[]; next: FightNext | null;
  duckUsed: boolean; lines: string[];          // last 2 combat log lines
  last: { text: string; cls: Grade } | null;   // grade banner for the view
};

export type RunOptions = { calm: boolean; assist: boolean };
export type RunState = {
  version: 1;
  set: ContributionSet; heroSet: ContributionSet | null;
  map: GameMap; hero: Hero;
  pos: Pos; prev: Pos | null; rng: number;
  combat: Fight | null;
  stats: { steps: number; defeated: number; chests: number; wisps: number; crits: number; dodges: number; bossDmg: number; bossHpLeft: number | null };
  status: "exploring" | "combat" | "relic" | "won" | "lost";
  bossDown: boolean; shards: number; undying: boolean; killer: string | null;
  opts: RunOptions;
  log: string[];                                // last 4 map log lines
  events: GameEvent[];                          // emitted by the last step only, for render and audio
  // relic offer, blessing, and other progression fields are added by the progression spec
};

export type Action =
  | { type: "move"; dir: Dir }
  | { type: "chooseClass"; cls: ClassId }
  | { type: "setOptions"; opts: RunOptions }
  | { type: "attack" } | { type: "flee" }
  | { type: "press"; t: number; key: string } | { type: "release"; t: number; key: string }
  | { type: "timeout"; t: number }
  | { type: "advance" }
  | { type: "forceGrade"; grade: Grade | ComboGrade }
  | { type: "retry" };
  // progression adds pickRelic, chooseRace, newRun-related actions

export type GameEvent =
  | { type: "blocked"; col: number; row: number }
  | { type: "fightStart"; boss: boolean }
  | { type: "testStart"; testId: number; mode: Mode; pattern: Pattern }
  | { type: "graded"; result: GradeResult; text: string }
  | { type: "heroHit"; grades: Grade[]; dmgs: number[]; killed: boolean }
  | { type: "monsterHit"; grade: Grade; dmg: number; lethal: boolean }
  | { type: "counter"; dmg: number; killed: boolean }
  | { type: "heal"; amount: number; source: "vampire" | "hotfix" }
  | { type: "undying" } | { type: "phase2" }
  | { type: "timing"; pct: number; maxed: boolean }
  | { type: "shard"; have: number; need: number; shattered: boolean }
  | { type: "monsterDown"; boss: boolean } | { type: "gateOpen" }
  | { type: "escaped"; dmg: number } | { type: "won" } | { type: "lost" };

// mods.ts
export type Mods = { linter: boolean; elf: boolean; force: boolean; pair: boolean; blame: boolean;
                     hotfix: boolean; cache: boolean; duck: boolean; vampire: boolean; skeleton: boolean };
```

`ClassId`, `RaceId`, and `ContributionSet` come from `src/data/schema.ts`; `GameMap`, `Pos`, `Tier`, and `Dir` from `src/mapgen` and `src/engine/explore.ts`.

## Function signatures

```ts
// classes.ts
export function heroClass(h: Pick<Hero, "cls">): ClassInfo;
export function applyStats(h: Hero): void;                         // maxHp, atk, clamp hp (FR-CLS-2)

// difficulty.ts
export function classDiff(cls: ClassId): Difficulty;
export function pressure(s: Pick<RunState, "hero" | "stats" | "combat">): number;
export function timingPercent(s: Pick<RunState, "hero" | "stats" | "combat">): { pct: number; maxed: boolean };
export function classCardLine(cls: ClassId): string;

// monsters.ts
export function makeMonster(tile: DayTile, hero: Hero, map: GameMap): Monster;
export function sourceLabel(tile: DayTile, map: GameMap): string;
export function fightTreasure(tier: Tier, cls: ClassId): number;

// patterns.ts
export function strikePlan(m: Monster, rand: () => number): Pattern[];
export function patternDamageMult(m: Monster): number;              // 0.6 imp, 0.75 boss phase 2, else 1
export function checkPhase2(m: Monster): boolean;                   // true when it just triggered

// qte.ts
export type TestContext = { tier: Tier; mode: Mode; pattern: Pattern; aura: number; mods: Mods;
                            calm: boolean; diff: Difficulty; pressure: number; slow: number; patSpeed: number };
export function windows(ctx: TestContext): { P: number; G: number; tm: number };
export function createTest(kind: QteTest["kind"], ctx: TestContext, rand: () => number): QteTest;
export function grade(test: QteTest, events: readonly InputEvent[], now: number, assist: boolean): GradeResult | null;
export function testDeadline(test: QteTest, events: readonly InputEvent[], assist: boolean): number;
export function gradeText(mode: Mode, r: GradeResult): { text: string; cls: Grade };

// combat.ts (all take the reducer's draft)
export function startFight(s: RunState, tile: DayTile): void;
export function resolveStrike(s: RunState, r: GradeResult): void;
export function resolveGuard(s: RunState, r: GradeResult, i: number): void;
export function resolveFlee(s: RunState, r: GradeResult): void;
export function winFight(s: RunState): void;
export function applyDuck(s: RunState, r: GradeResult): GradeResult;

// step.ts
export function step(state: RunState, action: Action): RunState;   // structuredClone, then mutate the draft
export function nextDeadline(state: RunState): { t: number; action: Action } | null;

// skillbot.ts
export type SkillBot = { sigma: number; rng: Rng };
export function makeSkillBot(sigma: number, seed: number): SkillBot;   // makeRng(sigma * 7919 + seed * 104729)
export function skillGrade(test: QteTest, bot: SkillBot): Grade | ComboGrade;
```

## How `grade` works

`grade(test, events, now, assist)` replays the events in time order through the mode's small state machine, firing deadlines at their test time before any later event, and returns the first decision at or before `now`, or `null` if none yet. An event at the same time as a deadline is processed first. Presses before `QTE.grace` (120 ms) are ignored. With `assist`, events are ignored and the result is Good at the target (charge: 300 ms).

| Mode | Replay rule | Deadline |
| --- | --- | --- |
| bar, ring, sidestep | First counted press grades against `target` (P, G, else Miss "too early"/"too late") | `dur + 30` → Miss "too late" |
| combo | Each press: mark passed marks (`t > mark + G`) Miss, then grade against the next mark; done at 3 | `dur + 30` → remaining Miss; "too late" if all Miss |
| charge | First counted press sets `downAt` and `holdKey`; its matching release grades on `held = t − downAt` | before a press: `dur` → "too slow"; after: `downAt + fill + 20` → "overload" |
| shield | Press before impact: `holding = true`, `downAt = t`, `holdKey = key`; matching release: `holding = false`. At `target`: held → Perfect if `target − downAt ≤ P` else Good. Press after impact within P → Perfect | `target + P + 10` → Miss "no shield" / "shield down" |

`testDeadline` returns the next of these times given the events so far; `nextDeadline(state)` wraps it as `{ t, action: { type: "timeout", t } }`. On `press`, `release`, or `timeout`, the reducer appends the event (timeouts append nothing) and calls `grade` with `now = action.t`.

`gradeText` reproduces `finishQte`'s text: combo "PERFECT COMBO!" or "{n}/3 HITS · P G M", single grades from `GRADE_LABELS[mode]` (flee uses the class guard mode's labels), with `WHY · ` prefixed in upper case.

## Combat formulas (all constants from `balance.ts`)

- Windows: requirement 6.1–6.2. Durations: requirements 8.1, 9.1, 10.1, 11.1–11.3.
- Strike: `max(1, round((atk + trait) × ATK_MULT[mode][g] × (force && g = perfect ? 1.25 : 1) × (pair && g = miss ? 1.6 : 1) × (0.9 + 0.2 × rand())))` per hit.
- Guard Good/Miss: `max(1, round(m.dmg × patternDamageMult(m) × DEF_MULT[guard][g] × (0.9 + 0.2 × rand())))`.
- Counter: `max(1, round(atk × (blame || guard === "sidestep" ? 1 : 0.5)))`, with no trait bonus.
- Flee: `safe = g === "perfect" || (g === "good" && cache)`; damage as the guard formula without the pattern multiplier; `hp = max(1, hp − dmg)`.
- Phase 2 check after every strike and counter that leaves the boss alive.
- Rubber Duck (`applyDuck`) runs on every grade result before resolution, including `forceGrade`.

## Calls into other specs

| Call | Owner | Used for |
| --- | --- | --- |
| `checkMove`, `applyMove`, `collectShard` | map-generation (`src/engine/explore.ts`) | The `move` action and the shard on a kill |
| `gainXp(s, amount)` | progression | XP after a kill (Human +10% applies there) |
| `collectWisp`, `openChest` | progression | The `move` action's wisp and chest branches |
| `newRun(set, heroSet, settings)` | progression | `retry` and the tests' run fixtures |
| `endRun(s)` (trophies) | progression | After `won` or `lost` |

Until those exist, unit tests build `RunState` with `tests/fixtures/run.ts` (`makeTestRun({ cls, race, relics, level, aura, tier, ... })`), which uses `generateMap` on a fixture set and a hand-built hero.

## Testing

| Test file | Checks |
| --- | --- |
| `tests/engine/balance.test.ts` | Every constant in this spec equals the value in `game-rules.md` (the table is parsed from the steering file, so a drift fails) |
| `tests/engine/classes.test.ts` | `applyStats` for each class with and without Cold Brew, Stack Overflow, Orc; HP clamp; `chooseClass` refused after a step; class card line text for all four |
| `tests/engine/difficulty.test.ts` | Pressure values per class at 0, 5, 50 kills; phase-2 ×0.9; `timingPercent` and `maxed` |
| `tests/engine/monsters.test.ts` | Worked example from the PRD (start level 3: Imp 24 HP, Lich 41 HP, boss 69 HP before class and curse); curse and class `dmg`; names and labels incl. empty quarter and risen ghosts |
| `tests/engine/qte.test.ts` | Each mode: durations and targets for known draws; grace; early/late reasons; combo skipped marks and timeout; charge too slow, too weak, overload by release and by deadline; shield hold, early release, late parry, both miss reasons; release from another key ignored; assist; labels and combo text |
| `tests/engine/patterns.test.ts` | Plans per tier with fixed draws; damage multipliers; phase 2 triggers once on strike and on counter; plan in progress kept |
| `tests/engine/combat.test.ts` | Strike, guard, and flee damage with fixed RNG; trait bonus on strikes only; Vampire, Hotfix, Skeleton, Rubber Duck, Git Blame, CI Cache, Force Push, Pair Programmer; flee keeps HP ≥ 1 and returns to `prev`; win and loss bookkeeping; pressure log fires on non-boss kills only |
| `tests/engine/step.test.ts` | `step` never mutates its input (deep-freeze); same seed + same actions → same states; `nextDeadline` per mode; a scripted fight from Attack to win and to loss; `forceGrade`; restore drops a test and resumes at `choose` |
| `tests/engine/rng-order.test.ts` | Parity: with the demo map, Wanderer, and a fixed `forceGrade` sequence, the RNG state after each step equals the value recorded from the prototype through `window.__cq` (`setGrade`, `forcePlan`), recorded once into `tests/fixtures/golden/demo-fight.json` |
| `tests/engine/qte.prop.test.ts` | P12, P15, P16 |
| `tests/engine/combat.prop.test.ts` | P7, P13, P14 |
| `tests/engine/skillbot.test.ts` | Bot seeding, combo three presses, charge overload limit, conflict and flaky miss rates over 10 000 draws within ±2 percentage points of `σ/600` and `σ/700`, shield rescue rate near 0.7 |

## Properties owned

| Property | Statement, as tested |
| --- | --- |
| P7 | For a fixed start level, class, and omen, monster HP and damage never decrease as the tier rises from 1 to 5 |
| P12 | For any test and press time: inside P → Perfect, inside G → Good, outside → Miss; P and G never shrink as aura rises 0→4, or when Calm mode is turned on |
| P13 | For any fight state and fixed RNG draw, damage taken is Perfect (0) ≤ Good ≤ Miss, and damage dealt is Miss ≤ Good ≤ Perfect, for every strike and guard mode and relic set |
| P14 | Over any sequence of kills, pressure never increases (outside the phase-2 ×0.9, which only lowers it) and never goes below `floor × 0.9` in phase 2 or `floor` otherwise |
| P15 | At equal pressure, aura, mods, and calm: the base Perfect window, and the P and G of each class's own strike test (Knight bar, Wanderer bar, Mage charge, Rogue combo), are ordered Knight ≥ Wanderer ≥ Mage ≥ Rogue |
| P16 | For every mode and pattern, a press (or hold release, or shield hold) exactly on target grades Perfect, and one outside G grades Miss |

P14's floor bound includes the phase-2 multiplier because the prototype applies ×0.9 after the floor.

**P15 and guard tests.** The PRD states P15 for "the Perfect and Good windows" without a mode. With the prototype's numbers it does not hold for guard tests, so the property is scoped to the base P and the strike tests. At pressure 1, aura 0, no calm (ms): Mage ring P 50.4 / G 105.4; Rogue sidestep P 52.1 / G 115.6. The Rogue's sidestep P is ×1.2, and its `gMul` (0.68) is above the Mage's (0.62). The prototype balances this with the sidestep's Good ×0.8 damage. Base G is not ordered either (Rogue 115.6 > Mage 105.4); the Rogue's strike G is capped by the combo at 81.6. The prototype wins, so `balance.ts` keeps these values and the PRD's P15 wording is corrected when the PRD is next revised.

## Out of scope here

Drawing the combat stage, the QTE gauge, pattern headlines, and effects (presentation); the pacing delays (presentation); relic offers, race choice, XP and levels, the omen, trophies, save and restore (progression); the full-run balance simulator `scripts/simulate.ts` and its route rule (progression, which owns the pieces a full run needs; it calls `skillGrade` from this spec).
