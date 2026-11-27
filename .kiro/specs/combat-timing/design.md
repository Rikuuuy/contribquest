# Design: combat-timing

## Overview

The fight is a state machine inside the engine reducer. Timing tests are data (`QteTest`) created with the run RNG when they start, and graded by a pure function of the test and the input events received so far. The browser feeds real event timestamps; tests and the simulator feed generated ones or inject a grade. Nothing here touches the DOM, storage, `Math.random`, or a clock.

**v1.6 (27 Nov 2026).** Flee is removed from the action set, the fight state machine, the test kinds, the RNG order, and the save. The `move` action takes a target position and is checked against `legalMoves` (map-generation); every tile entered resolves. The boss is built by `makeBoss` when the hero enters the boss node, with HP reduced by soul shards and phase 2 disabled at 3 shards; winning it wins the run. CI Cache heals after a won fight. `RunState.version` becomes 2. The prototype keeps v1.5, so the RNG-order parity test drops its flee recordings (see "Testing").

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
   ▲                         │ monster hp 0                │ advance
   │                         ▼                              ▼
   │                     wait(win) ◄──── counter kills ─── test(guard i)
   │                         │ advance                       │ resolved
   │                         ▼                               ▼
   │              winFight → exploring (monster)      wait(strike i+1) | wait(choose) | wait(lose)
   │                       → won (boss, v1.6)                │
   └──────────────────────────────────────────── advance ────┘
```

- A test starts as soon as its phase is entered: Attack starts one immediately; `advance` from `wait(strike i)` picks the plan (on `i = 0`) and starts guard test `i`.
- **v1.6:** there is no Flee branch and no `wait(escape)`. The only exits are `winFight` and `loseFight`.
- `fight.testId` increments for every new test so `main.ts` can record `testStart = performance.now()` when it renders a new id.
- The prototype's pacing delays (600, 1500, 950, 1300, 750, 500, 700, 400, 1100, 850, 1250, 1600 ms) are presentation timing. They belong to the presentation spec's pacing table, which decides when to send `advance`. The simulator and tests send `advance` at once.

## RNG call order

All draws come from `state.rng` through `rand(draft)`, which calls `nextFloat` from `src/mapgen/rng.ts` and stores the new state. The order matches the prototype exactly, so a seed replays the same fight:

1. Strike test start: bar 1 draw (zone); combo 3 draws (`z0`, `g1`, `g2`); charge none.
2. Strike resolve: 1 draw per hit, in hit order (combo: 3).
3. Turn start (`advance` to strike 0): tier 3 and 4 draw 1 for the plan; others none.
4. Guard test start: `flaky` 2 draws (pause, then pauseAt); `conflict` 2 draws (distance, then side); others none.
5. Guard resolve: Good or Miss 1 draw; Perfect none.
6. *(Removed in v1.6: the flee draw.)* Moving, resting, the boss build, and CI Cache draw nothing.

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
| `src/engine/monsters.ts` | `TIER_NAMES`, `makeMonster`, **v1.6:** `makeBoss`, `bossShardLine`; `sourceLabel`, `fightTreasure` |
| `src/engine/patterns.ts` | `strikePlan`, `patternDamageMult`, `checkPhase2` (v1.6: false while `bound`), `STRIKE_LINE` |
| `src/engine/qte.ts` | `windows`, `createTest`, `grade`, `testDeadline`, `gradeText`, `GRADE_LABELS` |
| `src/engine/combat.ts` | `startFight`, **v1.6:** `startBossFight`; `startStrike`, `resolveStrike`, `startGuard`, `resolveGuard`, `winFight`, `loseFight`, `applyDuck`. v1.6 removes `startFlee`, `resolveFlee`, `finishEscape` |
| `src/engine/step.ts` | `step`, `nextDeadline`; **v1.6:** `move` uses `checkMove(s, to)` and `enterTile` |
| `src/engine/input.ts` | `combatKey(key)` → `"hit" | null` (v1.6: the `"flee"` result and `FLEE_KEYS` are removed) |
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

export type Monster = { name: string; tier: Tier; hp: number; maxHp: number; dmg: number; xp: number; phase2: boolean;
                        bound: boolean };                     // v1.6: true only for a boss fought with 3 shards

export type QteTest = {
  kind: "attack" | "defend"; mode: Mode; pattern: Pattern;    // v1.6: "flee" removed
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
  | { kind: "strike"; i: number } | { kind: "choose" } | { kind: "win" } | { kind: "lose" };   // v1.6: "escape" removed
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
  version: 2;                                   // v1.6 (was 1)
  set: ContributionSet; heroSet: ContributionSet | null;
  map: GameMap; hero: Hero;
  pos: Pos;                                     // a day tile, or map.bossNode during the boss fight and after the run
  prev: Pos | null;                             // v1.6: kept for the presentation only; nothing moves the hero back
  rng: number;
  combat: Fight | null;
  stats: { steps: number; defeated: number; chests: number; wisps: number; crits: number; dodges: number; bossDmg: number; bossHpLeft: number | null };
  status: "exploring" | "combat" | "relic" | "won" | "lost";
  bossDown: boolean; shards: number;            // v1.6: shards 0–3, a bonus (no ward)
  undying: boolean; killer: string | null;
  opts: RunOptions;
  log: string[];                                // last 4 map log lines
  events: GameEvent[];                          // emitted by the last step only, for render and audio
  // relic offer, blessing, and other progression fields are added by the progression spec
};

export type Action =
  | { type: "move"; to: Pos }                   // v1.6: a legal-move target (was { dir: Dir })
  | { type: "chooseClass"; cls: ClassId }
  | { type: "setOptions"; opts: RunOptions }
  | { type: "attack" }                          // v1.6: { type: "flee" } removed
  | { type: "press"; t: number; key: string } | { type: "release"; t: number; key: string }
  | { type: "timeout"; t: number }
  | { type: "advance" }
  | { type: "forceGrade"; grade: Grade | ComboGrade }
  | { type: "retry" };
  // progression adds pickRelic, chooseRace, newRun-related actions

export type GameEvent =
  | { type: "moved"; from: Pos; to: Pos }        // v1.6 (requested by presentation); "blocked" removed
  | { type: "fightStart"; boss: boolean }
  | { type: "testStart"; testId: number; mode: Mode; pattern: Pattern }
  | { type: "graded"; result: GradeResult; text: string }
  | { type: "heroHit"; grades: Grade[]; dmgs: number[]; killed: boolean }
  | { type: "monsterHit"; grade: Grade; dmg: number; lethal: boolean }
  | { type: "counter"; dmg: number; killed: boolean }
  | { type: "heal"; amount: number; source: "vampire" | "hotfix" | "cache" }   // v1.6: "cache"
  | { type: "undying" } | { type: "phase2" }
  | { type: "timing"; pct: number; maxed: boolean }
  | { type: "shard"; have: number; max: 3; bound: boolean }                   // v1.6 (was need, shattered)
  | { type: "monsterDown"; boss: boolean }
  | { type: "won" } | { type: "lost" };
  // v1.6: "gateOpen" and "escaped" removed; progression adds "rest"

// mods.ts (v1.6: `cache` now means the CI Cache heal after a won fight)
export type Mods = { linter: boolean; elf: boolean; force: boolean; pair: boolean; blame: boolean;
                     hotfix: boolean; cache: boolean; duck: boolean; vampire: boolean; skeleton: boolean };
```

`ClassId`, `RaceId`, and `ContributionSet` come from `src/data/schema.ts`; `GameMap`, `Pos`, `Tier`, and (v1.6) `RouteOption` from `src/mapgen`. The v1.5 `Dir` type is removed with 4-direction movement.

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
export function makeMonster(tile: DayTile, hero: Hero, map: GameMap): Monster;   // tiers 1–4, bound: false
export function makeBoss(map: GameMap, hero: Hero, shards: number): Monster;      // v1.6: tier 5 from tiles[bossIdx], shard HP cut, bound
export function bossShardLine(shards: number): string | null;                    // v1.6: requirement 2.6 text, null at 0
export function sourceLabel(tile: DayTile, map: GameMap): string;                // v1.6: "empty day" label only when risen && count === 0
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
export function startFight(s: RunState, tile: DayTile): void;                     // monster tiles
export function startBossFight(s: RunState): void;                                // v1.6: makeBoss, fight at map.bossNode, boss logs
export function resolveStrike(s: RunState, r: GradeResult): void;
export function resolveGuard(s: RunState, r: GradeResult, i: number): void;
export function winFight(s: RunState): void;                                      // v1.6: CI Cache heal; boss → bossDown, endRun("won")
export function applyDuck(s: RunState, r: GradeResult): GradeResult;
// v1.6: resolveFlee, startFlee, finishEscape removed

// step.ts
export function step(state: RunState, action: Action): RunState;   // structuredClone, then mutate the draft
export function nextDeadline(state: RunState): { t: number; action: Action } | null;
function enterTile(s: RunState, target: RouteOption, tile: DayTile | null): void;  // v1.6, internal: requirement 22.2

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

`gradeText` reproduces `finishQte`'s text: combo "PERFECT COMBO!" or "{n}/3 HITS · P G M", single grades from `GRADE_LABELS[mode]`, with `WHY · ` prefixed in upper case.

## Combat formulas (all constants from `balance.ts`)

- Windows: requirement 6.1–6.2. Durations: requirements 8.1, 9.1, 10.1, 11.1–11.3.
- Strike: `max(1, round((atk + trait) × ATK_MULT[mode][g] × (force && g = perfect ? 1.25 : 1) × (pair && g = miss ? 1.6 : 1) × (0.9 + 0.2 × rand())))` per hit.
- Guard Good/Miss: `max(1, round(m.dmg × patternDamageMult(m) × DEF_MULT[guard][g] × (0.9 + 0.2 × rand())))`.
- Counter: `max(1, round(atk × (blame || guard === "sidestep" ? 1 : 0.5)))`, with no trait bonus.
- *(v1.6: the flee formula is removed.)*
- Phase 2 check after every strike and counter that leaves the boss alive; **v1.6:** `checkPhase2` returns false while `m.bound`.
- **v1.6 boss:** `makeBoss` computes `f` as for any monster, `hp = round((MONSTER.hpBase + MONSTER.hpPerTier × 5) × f × MONSTER.bossHp × (1 − SHARD_BOSS_HP_CUT × min(shards, SHARD_MAX)))`, `dmg` and `xp` exactly as `makeMonster` with `t = 5`, `bound = shards ≥ SHARD_NO_PHASE2`. At 0 shards the result deep-equals the v1.5 boss (plus `bound: false`), which keeps the boss part of the RNG-order parity test valid.
- **v1.6 CI Cache:** in `winFight`, after `gainXp`, the pressure message, and `collectShard`, for a non-boss monster: `n = min(maxHp − hp, ceil(maxHp × RELIC_COMBAT.cacheHeal))`. It cannot lower damage dealt or raise damage taken, so the v1.4 relic monotonicity property still holds.
- Rubber Duck (`applyDuck`) runs on every grade result before resolution, including `forceGrade`.

## Calls into other specs

| Call | Owner | Used for |
| --- | --- | --- |
| `legalMoves`, `checkMove`, `applyMove`, `collectShard` | map-generation (`src/engine/explore.ts`) | The `move` action and the shard on a kill (v1.6 signatures) |
| `gainXp(s, amount)` | progression | XP after a kill (Human +10% applies there) |
| `collectWisp`, `openChest`, `restDay` | progression | The `move` action's wisp, chest, and (v1.6) fog branches |
| `newRun(set, heroSet, settings)` | progression | `retry` and the tests' run fixtures |
| `endRun(s)` (trophies) | progression | After `won` or `lost` |

## The `move` action (v1.6)

`step(s, { type: "move", to })`:

1. If `s.status !== "exploring"`, return the clone (events `[]`). This is what makes relic offers and fights unskippable (requirement 22.4).
2. `check = checkMove(s, to)`. If `!check.ok`, return the clone. No log line and no event: the presentation only offers legal targets, so a refused move means a stale or scripted input.
3. `applyMove(s, check)`, push `moved { from: prev, to: pos }`.
4. `enterTile(s, check.target, check.tile)`: boss node → `startBossFight(s)`; otherwise by `tile.kind`: `monster` → `startFight`; `chest` → `openChest`; `wisp` → `collectWisp`; `fog` → `restDay`; `start` cannot be a target. Tiles reached by a legal move are never already resolved, because columns are never revisited; the reducer still checks `tile.resolved` and does nothing for a resolved tile, as a defence for hand-built test states.

`startBossFight(s)` builds the fight with `col`/`row` = `map.bossNode`, `m = makeBoss(map, hero, shards)`, logs the boss line and `bossShardLine`, and emits `fightStart { boss: true }`. `winFight` for the boss sets `bossDown`, `bossHpLeft`, logs "The Phantom falls. Your graph is exorcised.", emits `monsterDown { boss: true }`, and calls `endRun(s, "won")`. Combat code reads the tile only through `map.tiles[bossIdx]` for the boss, never through `tileAt(bossNode)` (which is `null`).

## Error handling (v1.6)

| Operation | Failure | Recoverable? | Caller receives | Logged |
| --- | --- | --- | --- | --- |
| `step` with `move` | Not exploring, or `to` not a legal move | Yes (ignored input) | The input state's clone with `events: []` | No |
| `step` with an unknown action type (for example a stale `flee` from old UI code) | Not in the `Action` union | Yes | Type error at compile time; at run time the `switch` default returns the clone unchanged | No |
| `startBossFight` | `map.tiles[bossIdx]` missing | No (cannot happen for a validated map) | Throws `Error("boss tile missing")`; `main.ts` treats an engine exception as a fatal error screen with demo mode | `console.error` in `main.ts` only |
| `restore` with a v1 save, a `flee` test, an `escape` next, or a `gate`/`boss` tile kind | Schema mismatch | Yes | `null` (no save), see progression requirement 10.3 | No |

## Invariants (v1.6)

| Invariant | Owner | Why |
| --- | --- | --- |
| The hero only moves forward by one column per accepted move | `checkMove` (map-generation) called only from `step` | `step` is the single writer of `pos` |
| No tile can be left unresolved | `step`: moves are accepted only while `exploring`, and each entry either resolves at once or opens a fight or relic offer that blocks moves | The status gate lives in one place, before any action-specific code |
| Every fight ends in `win` or `lose` | The fight state machine has no other exit | Removing `escape` from `FightNext` makes it a type error to add one back by accident |
| Boss weakening uses the shards held at fight start | `makeBoss` | Shards cannot change during the boss fight (it is the last node), so reading them once is exact |

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
| `tests/engine/combat.test.ts` | Strike and guard damage with fixed RNG; trait bonus on strikes only (v1.6: the boss fight uses the best day's row); Vampire, Hotfix, Skeleton, Rubber Duck, Git Blame, Force Push, Pair Programmer; **v1.6:** CI Cache heals `ceil(maxHp × 0.1)` after a non-boss win, capped at max HP, not after the boss; win and loss bookkeeping; the boss win ends the run as won with the new log line; pressure log fires on non-boss kills only. The v1.5 flee cases are deleted |
| `tests/engine/monsters.test.ts` | Adds **v1.6** `makeBoss` at 0–3 shards (start level 3, f = 1.24: 69, 62, 56, 49 HP, from `round(40 × 1.24 × 1.4 × (1, 0.9, 0.8, 0.7))` = round of 69.44, 62.50, 55.55, 48.61), `bound` only at 3, `bossShardLine` texts, the risen label rule |
| `tests/engine/patterns.test.ts` | Adds **v1.6**: a bound boss at half HP does not enter phase 2 |
| `tests/engine/step.test.ts` | `step` never mutates its input (deep-freeze); same seed + same actions → same states; `nextDeadline` per mode; a scripted fight from Attack to win and to loss; `forceGrade`; restore drops a test and resumes at `choose`; **v1.6:** `move` to each legal target, refused moves (behind, sideways, two ahead, during a fight, during a relic offer) return an equal state with no events; fog, wisp, chest, and monster entries; the boss node fight to a win ends the run |
| `tests/engine/input.test.ts` | **v1.6:** F and Escape map to `null` |
| `tests/engine/rng-order.test.ts` | Parity: with the demo map, Wanderer, and a fixed `forceGrade` sequence, the RNG state after each step equals the value recorded from the prototype through `window.__cq` (`setGrade`, `forcePlan`), recorded once into `tests/fixtures/golden/demo-fight.json`. **v1.6:** recordings whose plan is `flee` are skipped, and the coverage check no longer requires a flee; the boss recording is compared at 0 shards (where `makeBoss` equals the v1.5 boss) by setting `shards = 0` before the fight. The JSON fixture is not re-recorded |
| `tests/engine/qte.prop.test.ts` | P12, P15, P16 |
| `tests/engine/combat.prop.test.ts` | P7, P13, P14, **v1.6:** P23 |
| `tests/engine/step.prop.test.ts` | **v1.6:** P24 |
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
| P23 | **New in v1.6.** For any hero and map, `makeBoss` at shards 0, 1, 2, 3 gives max HP that never increases with shards and is always ≥ 1, equal damage and XP, `bound` exactly when shards = 3, and at 0 shards the v1.5 boss stats; over any action sequence `shards` stays in 0–3; and a bound boss never sets `phase2` (replaces the retired P10) |
| P24 | **New in v1.6.** For any action sequence from `newRun` (random legal and illegal `move` targets, `attack`, `forceGrade`, `advance`, `pickRelic`): `pos.col` never decreases; every accepted move raises `pos.col` and `steps` by exactly 1, so `steps === pos.col`; a `move` while `status` is `combat` or `relic` changes nothing; and whenever `status` is `exploring`, every visited tile is resolved |

P13 is unchanged in meaning; its v1.5 test cases for the flee formula are deleted with the formula.

P14's floor bound includes the phase-2 multiplier because the prototype applies ×0.9 after the floor.

**P15 and guard tests.** The PRD states P15 for "the Perfect and Good windows" without a mode. With the prototype's numbers it does not hold for guard tests, so the property is scoped to the base P and the strike tests. At pressure 1, aura 0, no calm (ms): Mage ring P 50.4 / G 105.4; Rogue sidestep P 52.1 / G 115.6. The Rogue's sidestep P is ×1.2, and its `gMul` (0.68) is above the Mage's (0.62). The prototype balances this with the sidestep's Good ×0.8 damage. Base G is not ordered either (Rogue 115.6 > Mage 105.4); the Rogue's strike G is capped by the combo at 81.6. The prototype wins, so `balance.ts` keeps these values and the PRD's P15 wording is corrected when the PRD is next revised.

## Out of scope here

Drawing the combat stage, the QTE gauge, pattern headlines, and effects (presentation); the pacing delays (presentation); relic offers, race choice, XP and levels, the omen, trophies, save and restore (progression); the full-run balance simulator `scripts/simulate.ts` and its route rule (progression, which owns the pieces a full run needs; it calls `skillGrade` from this spec).
