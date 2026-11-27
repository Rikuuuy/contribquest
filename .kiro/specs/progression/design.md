# Design: progression

## Overview

Progression is the part of the engine that starts, grows, ends, saves, and restores a run. Like the rest of `src/engine`, it is pure: every function takes the reducer's draft (or plain values) and returns data. The two places that touch storage are thin wrappers in `src/data` (`runstore.ts`), called only from `main.ts`. The balance simulator in `scripts/simulate.ts` drives the same `step` function the browser uses.

```
settings (data) ─┐
map set ─────────┼─► newRun ──► RunState ──► step(state, action) ─┬─► collectWisp / openChest ─► gainXp ─► offerRelic
hero set ────────┘     │                                           ├─► pickRelic, chooseRace, enterMap, offerBlessing
                       │                                           └─► endRun (from combat) ─► runEnded event
                       ▼
               serialize(state) ──► data/runstore.writeRun ──► cq:v2:run   (v1.6; cq:v1:run is the prototype's, never touched)
               restore(unknown) ◄── data/runstore.readRun  ◄── cq:v2:run

runEnded ──► main.ts: readTrophies + readClassWins ──► awardTrophies (pure) ──► writeTrophies, writeClassWins
                                                                    └──► step(state, { type: "trophiesAwarded", ids })

scripts/simulate.ts ──► newRun ──► loop { routeAction(state) | forceGrade(skillGrade) | advance | pickRelic(0) } ──► report
```

## Module files

| File | Contents |
| --- | --- |
| `src/engine/progression.ts` | `xpForLevel`, `levelFor`, `startingXp`, `auraTier`, `gainXp`, `collectWisp`, `openChest` |
| `src/engine/trait.ts` | `makeTrait` |
| `src/engine/races.ts` | `RACE_INFO` (name, text, lines, plus the face colours used by presentation), `chooseRace` |
| `src/engine/relics.ts` | `RELICS`, `relicById`, `offerRelic`, `pickRelic`, `CHEST_TITLE` |
| `src/engine/omen.ts` | `omenFor`, `enterMap`, `offerBlessing`, `BLESSING_TITLE`, `omenLog` |
| `src/engine/run.ts` | `makeHero`, `newRun`, `endRun` |
| `src/engine/trophies.ts` | `TROPHIES`, `TrophyId`, `trophyFacts`, `awardTrophies`, `trophyList`, `startTrophyLine` |
| `src/engine/save.ts` | `SavedRunSchema` (Zod), `serialize`, `restore`, `continueLabel` |
| `src/engine/views.ts` | `summaryView`, `resultsView` (plain data for the screens; no DOM) |
| `src/engine/routebot.ts` | `routeAction` (the simulator's route rule) |
| `src/data/runstore.ts` | `readRun`, `writeRun`, `clearRun`, `readTrophies`, `writeTrophies`, `readClassWins`, `writeClassWins` (non-throwing, built on `src/data/storage.ts`) |
| `scripts/simulate.ts` | CLI: cells, seeds, graphs, report, exit code |
| `src/engine/balance.ts` | Adds the progression constants listed below |

Constants added to `balance.ts` (and to `game-rules.md` in the same commit): `XP_BASE = 25`, `MAX_LEVEL = 10`, `START_XP_MUL = 15`, `AURA_DAYS = 7`, `AURA_MAX = 4`, `WISP_XP = 5`, `CHEST_XP = 10`, `BOSS_XP = 100`, `CHEST_GOLD = { 1: 6, 2: 12 }`, `CHEST_HEAL = 0.3`, `HUMAN_XP = 1.1`, `TRAIT_ATK = 2`, `BLANK_SLATE_HP = 5`, `WEEKEND_SHARE = 0.4`, `RELIC_OFFER = 3`, `COLD_BREW_HEAL = 10`, `SIM = { seeds: 200, maxActions: 2000, healBelow: 0.45, healBeforeBoss: 0.75, mixedSeed: 1234 }`.

**v1.6 constants** (tunable starting values, re-measured after implementation): `REST_HEAL = 0.05`, `WISP_HEAL = 0.1`, `TROPHY_SPEED_FIGHTS = 6`, and `SIM.bossWeeks = 2`. `routebot.ts` stops defining its own `HEAL_BELOW` and `HEAL_BELOW_BOSS_NEXT` and reads `SIM.healBelow` and `SIM.healBeforeBoss`, so the numbers have one home.

## v1.6 changes (27 Nov 2026)

PRD v1.6 makes runs forward-only routes with unskippable tiles and no Flee. Progression's share:

- **Rest and wisp heals.** A quiet day (fog) was a no-op tile in v1.5; now that the hero must enter one tile per week, a small rest makes a fog branch a real alternative to a fight. Options considered for fog: nothing, a small heal, or a small XP gain. XP would reward avoiding fights, which the minimum-fights rule exists to prevent; nothing would make fog strictly worse than a wisp. A heal of 5% (`REST_HEAL`) is chosen, below the wisp's 10% (`WISP_HEAL`) and the chest's 30%, so the healing order follows the contribution level. The user's brief says wisps heal, so wisps keep +5 XP and gain the 10% heal.
- **CI Cache.** Its v1.5 effect only worked while fleeing. Options: remove it (leaves 9 relics and changes the offer shuffle length), "the first guard Miss per fight counts as Good" (overlaps Rubber Duck), or "heal 10% after each won fight". The heal is chosen: fleeing was the player's way to save HP, and with mandatory fights, recovering between them is the closest replacement. It never lowers damage dealt or raises damage taken, so the relic monotonicity property holds, and the relic list and offer draw counts stay as they are.
- **Code Review** widens the visibility window by one column instead of the lantern radius.
- **Speedrun trophy.** `steps ≤ 20` is met by every v1.6 run (steps always equal `cols`, 13 or 14), so the trophy would be free. Options: retire it (14 → 13 trophies, and the "n/14" texts change), or count fights. It now means "won after 6 or fewer banishes, the boss included" (`defeated ≤ 6`): fewer fights is the faster run, and with `MIN_ROUTE_FIGHTS = 4` plus the boss the floor is 5, so it needs a deliberate quiet route. The id `speed` stays, so stored trophies keep their dates.
- **Results title** drops the Gate: "The Phantom is banished. Your graph is exorcised."
- **Save** moves to `version: 2` and the key `cq:v2:run`. The v1 key stays untouched because the prototype on the same origin uses it.
- **Route bot** picks among the legal moves by a per-column policy instead of BFS goals.

## Types

These extend `src/engine/state.ts` from combat-timing.

```ts
export type RaceId = "human" | "elf" | "orc" | "skeleton" | "vampire";   // enum from src/data/schema.ts
export type Omen = "blessed" | "cursed";
export type TrophyId = "first" | "self" | "raider" | "blessed" | "cursed" | "flawless" | "close"
                     | "dodges" | "crits" | "relics" | "speed" | "nochest" | "nightmare" | "fullstack";

// added to RunState
relicOffer: RelicId[] | null;
relicTitle: string | null;
pendingBlessing: boolean;
newTrophies: TrophyId[];

// added to Action
| { type: "pickRelic"; i: number }
| { type: "chooseRace"; race: RaceId }
| { type: "enterMap" }
| { type: "offerBlessing" }
| { type: "trophiesAwarded"; ids: TrophyId[] }

// added to GameEvent
| { type: "xp"; amount: number }
| { type: "levelUp"; level: number }
| { type: "wisp"; col: number; row: number; xp: number; healed: number }   // v1.6: healed
| { type: "rest"; col: number; row: number; healed: number }               // v1.6
| { type: "chest"; col: number; row: number; gold: number; healed: number }
| { type: "relicOffer"; ids: RelicId[]; title: string }
| { type: "relicPicked"; id: RelicId }
| { type: "raceChosen"; race: RaceId }
| { type: "blessingDue" }
| { type: "runEnded"; won: boolean }

export type Relic = { id: RelicId; name: string; text: string };
export type RaceInfo = { name: string; text: string; lines: [string, string];
                         skin: [string, string]; eye: string; mouth: string;
                         ears?: true; tusks?: true; teeth?: true; fangs?: true; glow?: string };

export type TrophyFacts = { won: boolean; raid: boolean; source: "live" | "cache" | "demo"; omen: Omen;
  bossDown: boolean; bossDmg: number; bossHpLeft: number | null; dodges: number; crits: number;
  relics: number; steps: number; defeated: number;                    // v1.6: defeated (Speedrun)
  chests: number; classWins: number; nightmare: boolean };
export type TrophyHave = Partial<Record<TrophyId, string>>;          // id → "YYYY-MM-DD"
export type ClassWins = Partial<Record<ClassId, true>>;

export type SummaryView = {
  title: string; range: string; identity: string; aura: string; avatarUrl: string | null;
  stats: { k: string; v: string; sub: string }[];
  trait: { name: string; text: string };
  omen: { kind: Omen; k: string; v: string; text: string };
  quiet: string | null;
  xpTable: { level: number; xp: number; current: boolean }[];
};
export type ResultsView = {
  won: boolean; title: string; sub: string;
  game: [string, string][]; ghTitle: string; gh: [string, string][];
  today: string;
};
```

## Function signatures

```ts
// progression.ts
export function xpForLevel(n: number): number;                         // 25 × n × (n − 1)
export function levelFor(xp: number): number;                          // 1..10
export function startingXp(total91: number): number;                   // round(15 × √total91)
export function auraTier(streak: number): number;                      // min(floor(streak / 7), 4)
export function gainXp(s: RunState, amount: number): void;             // Human ×1.1, level-up, events
export function collectWisp(s: RunState, tile: DayTile): void;           // v1.6: heal ceil(maxHp × WISP_HEAL) before the XP
export function openChest(s: RunState, tile: DayTile): void;            // heal, gold, log, XP, then offerRelic
export function restDay(s: RunState, tile: DayTile): void;              // v1.6: fog tile, heal ceil(maxHp × REST_HEAL), rest event

// trait.ts
export function makeTrait(days: readonly ContributionDay[], total91: number): Trait;

// races.ts
export const RACE_INFO: Record<RaceId, RaceInfo>;
export function chooseRace(s: RunState, race: RaceId): void;           // refused when steps > 0

// relics.ts
export const RELICS: readonly Relic[];
export function relicById(id: RelicId): Relic;
export function offerRelic(s: RunState, title?: string): void;         // draws from s.rng
export function pickRelic(s: RunState, i: number): void;

// omen.ts
export function omenFor(heroSet: ContributionSet): Omen;
export function enterMap(s: RunState): void;                           // emits blessingDue once
export function offerBlessing(s: RunState): void;

// run.ts
export type RunSettings = Pick<Settings, "heroClass" | "heroRace" | "calm" | "assist">;
export function makeHero(heroSet: ContributionSet, settings: RunSettings): Hero;
export function newRun(set: ContributionSet, heroSet: ContributionSet | null, settings: RunSettings): Result<RunState, MapError>;
export function endRun(s: RunState, outcome: "won" | "lost", killer?: string): void;

// trophies.ts
export const TROPHIES: readonly { id: TrophyId; name: string; text: string; test: (f: TrophyFacts) => boolean }[];
export function trophyFacts(s: RunState, classWins: ClassWins): TrophyFacts;
export function awardTrophies(s: RunState, have: TrophyHave, wins: ClassWins, today: string):
  { have: TrophyHave; wins: ClassWins; fresh: TrophyId[] };             // pure: returns new records
export function trophyList(have: TrophyHave, fresh: readonly TrophyId[]):
  { head: string; items: { id: TrophyId; name: string; text: string; got: boolean; isNew: boolean }[] };
export function startTrophyLine(have: TrophyHave): string;

// save.ts
export type SavedRun = Omit<RunState, "events">;
export function serialize(s: RunState): SavedRun;                      // JSON-safe, no events
export function restore(json: unknown): RunState | null;               // Zod; test phase → choose; events []
export function continueLabel(saved: SavedRun): string;

// views.ts
export function summaryView(s: RunState): SummaryView;
export function resultsView(s: RunState): ResultsView;

// routebot.ts
export function routeAction(s: RunState): Action;                      // v1.6: { type: "move", to } from legalMoves (or pickRelic)
export function rankOption(s: RunState, o: RouteOption): number;       // v1.6: lower is preferred; exported for tests

// data/runstore.ts
export function readRun(storage: StorageLike | null): unknown | null;
export function writeRun(storage: StorageLike | null, saved: SavedRun): void;
export function clearRun(storage: StorageLike | null): void;
export function readTrophies(storage: StorageLike | null): unknown;    // engine validates
export function writeTrophies(storage: StorageLike | null, have: TrophyHave): void;
export function readClassWins(storage: StorageLike | null): unknown;
export function writeClassWins(storage: StorageLike | null, wins: ClassWins): void;
```

`src/data` may not import `src/engine`, so `runstore.ts` reads and writes `unknown` JSON and takes the engine types only as structural parameters declared in `src/data/schema.ts` (`TrophyHaveSchema`, `ClassWinsSchema`). `restore` and `awardTrophies` validate what they receive.

## Behaviour details

- **`newRun`** order follows the prototype: decide the raid (requirement 1.1), `generateMap(set)` (return its error on failure), `makeHero(heroSet ?? set, settings)`, `omen = omenFor(heroSet ?? set)`, build the state (`version = 2`, `rng = map.seed`, `pos` = start tile, `prev = null`, `combat = null`, `pendingBlessing = omen === "blessed"`, `relicOffer = null`, `relicTitle = null`, `newTrophies = []`, `opts = { calm, assist }`, `log = []`, `events = []`), mark the start visited and (v1.6) resolved, `reveal` (v1.6: the column window), then the three log lines (v1.6: the third is the shard line, always shown). No RNG draw happens in `newRun`.
- **`restDay`** (v1.6) marks the fog tile resolved, heals `n = min(maxHp − hp, ceil(maxHp × REST_HEAL))`, logs one of the two lines in requirement 4.3, and emits `rest { col, row, healed: n }`. It is called by combat-timing's `enterTile`.
- **`collectWisp`** (v1.6) heals `min(maxHp − hp, ceil(maxHp × WISP_HEAL))` before `gainXp`, so a level-up from the wisp's XP still heals to full afterwards (same order as `openChest`).
- **`gainXp`** applies the Human multiplier before adding, so the logged and displayed XP equals what was added. Only one level-up message is logged even if the gain crosses two thresholds, as in the prototype.
- **`openChest`** heals before `gainXp`, so a level-up from the chest's XP still heals to full afterwards. `offerRelic` runs last, so the relic shuffle draws after any combat draws already made.
- **`pickRelic`** recomputes stats with `applyStats` (combat-timing), then Cold Brew heals 10 and HP is clamped. Code Review calls `reveal` from `src/engine/explore.ts`.
- **`enterMap` and `offerBlessing`** split the prototype's `enterMap` timer: the engine clears `pendingBlessing` when the map opens, and `main.ts` sends `offerBlessing` after the presentation delay (1500 ms with the rise animation, 300 ms without). If the hero has walked into a fight by then, nothing is offered, exactly as in the prototype.
- **`endRun`** is called by combat-timing (v1.6: `winFight` on the boss, and `loseFight`; there is no Gate). It does not touch storage. `main.ts` handles `runEnded`: read trophies and class wins, call `awardTrophies` with today's date from `new Date().toISOString().slice(0, 10)` (the only clock read, in `main.ts`), write both records, then dispatch `trophiesAwarded`.
- **`awardTrophies`** adds the class to `wins` only when won, then computes facts with `classWins = count of known ClassId keys in wins`, then tests trophies in order.
- **`serialize`** returns `{ ...state, events: undefined }` without `events`; tiles keep their run-time flags (`resolved`, `visited`, `seen`). `restore` parses with `SavedRunSchema` (which embeds `ContributionSetSchema` from `src/data/schema.ts`), rejects `version !== 2`, turns a fight in `test` into `choose` with `test: null` and `events: []` on the fight, and adds `events: []`. A fight in `wait` is kept; `main.ts` sends `advance` after restoring it.
- **`SavedRunSchema` v1.6.** `version: z.literal(2)`; tile `kind` enum without `boss` and `gate`, `tier` 0–4, optional `bestDay: z.literal(true)`; map with `bossNode` and without `gateIdx` and `shardsNeeded`; `QteTest.kind` `attack | defend`; `FightNext` without `escape`; `Monster.bound`; `shards` an integer 0–3. After the schema, `restore` checks the position invariant that Zod cannot express: either `tileAt(map, pos)` is a day tile and `pos.col < cols`, or `pos` equals `map.bossNode` and (`status` is `combat` with a tier-5 monster, or `won`/`lost`). Any failure returns `null`. Because the schema is strict about the v1.6 shape, a v1 save that somehow lands under the new key is also rejected.
- **`runstore.ts` v1.6.** `RUN_KEY = "cq:v2:run"` in `src/data/constants.ts`. `clearRun` removes only that key. There is no migration from v1 saves: a v1.5 run cannot be mapped onto a route (its position may be behind a column it already passed, its boss tile no longer exists), so the player starts a new run. The other keys keep their `cq:v1:` names.
- **`summaryView` and `resultsView`** produce the strings in requirements 8 and 13 with `fmtDate` and `fmtShort` from `src/mapgen/dates.ts`. The social spec adds the raid branches to these two functions, to the run-start log, and to `continueLabel`.

## Balance simulator

`scripts/simulate.ts` (run by `npm run simulate`, with `tsx`):

1. Graphs: `loadDemo()` and six fixtures from `tests/fixtures/profiles.ts` (all-empty, single active day, very dense, best day on the first day, best day on the last day, last day with 0 contributions). The two column-count fixtures (last date on Saturday or Sunday) test layout, not balance, and are left out to match the PRD's "6 fixture graphs".
2. Cells: `[knight, 140], [wanderer, 100], [mage, 100], [mage, 60], [rogue, 60], [rogue, 35]`, race Human, Calm and Auto-timing off.
3. For each cell, graph, and bot seed 0–199: `newRun(graph, null, settings)`, `bot = makeSkillBot(σ, seed)`, then loop: a test in progress → `forceGrade(skillGrade(test, bot))`; fight in `wait` → `advance`; `choose` → `attack`; `relic` → `pickRelic(0)`; `blessingDue` seen → `offerBlessing`; exploring → `routeAction(state)`. Stop at `won`, `lost`, or 2000 actions.
4. Report a table per cell: wins per graph, overall rate, target, and PASS/FAIL. Exit 1 if any overall target fails. `--seeds n` and `--cell class:σ` flags shorten a run for the balance-tuner agent.
5. Regression: Wanderer on the demo graph with the four grade policies (requirement 14.4), plus the demo route's fights, shards, and steps (v1.6: steps are always 14 on the demo; the printed target is 6–10 fights including the boss).
6. **v1.6:** the report adds two columns per cell: average fights per run and average shards at the boss. They are informational, not pass/fail. The pass/fail targets per class stay as they are and are re-measured after implementation (requirement 14.5).

**v1.6 `routeAction`.** While `status === "relic"`: `pickRelic(0)`. Otherwise: `opts = legalMoves(s)`; if `opts` is a single option (the fallback or the boss node), move there. Else compute `rankOption` for each and return `{ type: "move", to }` for the lowest rank, the first option on ties. `rankOption` (lower is better): `heal = hp < maxHp × (target.col ≥ cols − SIM.bossWeeks ? SIM.healBeforeBoss : SIM.healBelow)`. Heal mode: chest 0, wisp 1, fog 2, monster `2 + tier`. Otherwise: monster `5 − tier` (Lich 1, Ghoul 2, Imp 3, Ghost 4), chest 5, wisp 6, fog 7. The bot asserts that every option it ranks is `seen` (the window always covers the next column), so it never uses hidden information. The v1.5 BFS, `nearest`, and `firstMove` helpers are deleted.

The v1.5 `routeAction` computed BFS distances over tiles `checkMove` allowed and walked to goals (chest, elites, boss, Gate). The prototype's bots were driven by hand through `window.__cq.setGrade`, so there was no route code to port; both rules are defined from the PRD text and recorded here.

## Testing

| Test file | Checks |
| --- | --- |
| `tests/engine/progression.test.ts` | XP table and `levelFor` at every threshold, cap at 10; PRD examples (10 → 47 XP level 1, 100 → 150 XP level 3, 1000 → 474 XP level 4); 15-day streak → aura 2, +2 ATK, +10 HP; Human ×1.1 rounding; level-up heal and single log line; wisp and chest logs, singular "contribution", chest heal before XP; chest then relic offer |
| `tests/engine/trait.test.ts` | Blank Slate, Weekend Warrior at exactly 40%, each weekday Slayer, ties to the earlier weekday, the three texts |
| `tests/engine/relics.test.ts` | `RELICS` ids, names, texts; offer draws `unowned − 1` values and none when all owned; status `relic` blocks moves; pick by 0–2, out-of-range ignored; Cold Brew heal and clamp; Code Review reveal; log line |
| `tests/engine/races.test.ts` | `RACE_INFO` texts and lines; `chooseRace` locked after a step; stats and heal; Orc +2 ATK |
| `tests/engine/omen.test.ts` | Blessed and cursed from the hero set's last day (raid uses the raider); log lines; `blessingDue` once; `offerBlessing` ignored outside `exploring`; blessing title |
| `tests/engine/run.test.ts` | `newRun` on the demo set: start tile visited, opening log lines, `rng === map.seed`, settings applied, unknown class or race defaulted; same-name raid is a normal run; map error returned for a broken set |
| `tests/engine/trophies.test.ts` | Each trophy's condition true and false; class wins added only on a win; `classWins` ignores unknown keys; held trophies keep their date; heading and start line texts |
| `tests/engine/save.test.ts` | Round trip; `events` dropped; version 2, missing fields, a prototype-shaped save, and non-JSON all return `null`; `test` phase resumes at `choose`; `wait` kept; continue label |
| `tests/engine/views.test.ts` | Summary and results strings for the demo run, a cursed run, an aura-0 profile, a quiet map, a won and a lost run |
| `tests/engine/progression.prop.test.ts` | P6, P11 |
| `tests/engine/relics.prop.test.ts` | P17; and the v1.4 property: for a fixed fight and RNG draw, adding any relic never lowers damage dealt and never raises damage taken |
| `tests/engine/save.prop.test.ts` | P8, P19 |
| `tests/engine/routebot.test.ts` | **v1.6 rewrite:** at 46% HP a Lich beats a chest; at 44% a chest beats a Lich, then wisp beats fog, then a Ghost beats an Imp; the 75% threshold applies only when the target column is `≥ cols − 2` (74% and 76% there, 74% one column earlier); tier order 4 > 3 > 2 > 1 > chest > wisp > fog when healthy; ties go to the lower row; a single option (fallback, boss node) is taken; every ranked option is `seen` |
| `tests/sim/regression.test.ts` | The four Wanderer grade policies on the demo graph give the PRD outcomes (win, win, win, lose); **v1.6:** prints fights, shards, and steps (14) instead of checking the 15–25 steps target; the expected outcomes are re-measured in task 13.8 |
| `tests/data/runstore.test.ts` | Keys **`cq:v2:run`** (v1.6), `cq:v1:trophies`, `cq:v1:classwins`; throwing storage; corrupt JSON returns `null`; **v1.6:** `clearRun` and `writeRun` leave a `cq:v1:run` value untouched, and `readRun` never reads it |
| `tests/engine/save.test.ts` (v1.6 additions) | A v1.5 save (the existing `tests/fixtures/prototype-save.json` and a port v1 save built in the test) is rejected; `version: 2` round trip; a save with a `gate` tile kind, a `flee` test, an `escape` next, `pos` on a void cell, or `pos` on the boss node while exploring returns `null` |
| `tests/engine/progression.test.ts` (v1.6 additions) | Wisp heal before XP and its log; `restDay` heal and both log lines, `rest` event, no XP, no RNG draw |
| `tests/engine/relics.test.ts` (v1.6 additions) | CI Cache and Code Review texts; picking Code Review marks one more column seen |
| `tests/engine/run.test.ts` (v1.6 additions) | Start tile resolved; columns 0–2 seen; the new third log line on every map; `version === 2` |
| `tests/engine/trophies.test.ts` (v1.6 additions) | Speedrun true at `defeated` 6 and false at 7; `steps` no longer used by it |
| `tests/engine/views.test.ts` (v1.6 additions) | The won title "The Phantom is banished. Your graph is exorcised." |

## Error handling (v1.6)

| Operation | Failure | Recoverable? | Caller receives | Logged |
| --- | --- | --- | --- | --- |
| `readRun` | Key missing, storage throws, or value is not JSON | Yes | `null` (no save) | No |
| `restore` | Schema mismatch, `version !== 2`, a v1.5 shape, or a bad `pos` | Yes | `null`; the start screen shows no Continue button | No |
| `writeRun` | Storage full or throwing | Yes | Nothing; the game keeps running without a save | No (the data layer is non-throwing by design) |
| `restDay`, `collectWisp` | Hero already at max HP | — | Heal 0, the "Nothing stirs." line or a wisp line without HP | No |
| `routeAction` | `legalMoves` empty (should only happen at the boss node, where the bot is in combat) | Yes | `{ type: "advance" }`, which `step` ignores outside a fight; `MAX_ACTIONS` ends the run | No |

Arbitraries for the property tests come from `tests/arbitraries.ts` (map-generation) plus an action-sequence arbitrary: random `move`, `attack`, `forceGrade`, `advance`, `pickRelic`, `chooseClass`, `chooseRace` actions applied with `step`, so the states are reachable ones. **v1.6:** `flee` is removed from the arbitrary; `move` draws its target as either one of `legalMoves(state)` (by index) or a random position (mostly illegal, to exercise refusals). P22 (map-generation) and P24 (combat-timing) reuse this arbitrary.

## Properties owned

| Property | Statement, as tested |
| --- | --- |
| P6 | For a fixed window, class, and race, as `streak` rises from 0 to 60, starting ATK and max HP never decrease, and they are equal for every streak ≥ 28 (tier 4) |
| P8 | For any generated ContributionSet and settings, `restore(serialize(newRun(...)))` deep-equals the new run |
| P11 | For any window, `makeTrait` returns exactly one trait; its rows are a subset of 0–6 with length 0 (Blank Slate only), 1, or 2 (`[0, 6]` only) |
| P17 | For any owned subset of relics and any RNG state, the offer has `min(3, unowned)` ids, no duplicates, and no owned id |
| P19 | For any state reached by an action sequence from `newRun` (any class, race, relics, kills, and pressure), `restore(serialize(s))` deep-equals `s` with `events: []`, after a fight in `test` is moved to `choose` |

P8 and P19 are kept unchanged in meaning in v1.6; the states they round-trip now have `version: 2`, include positions on the boss node during the boss fight, and come from the v1.6 action arbitrary. Progression owns no new property IDs in v1.6.

## Out of scope here

Drawing the summary, the relic cards, the HUD, the results, and the trophy grid (presentation); the race faces (presentation, FR-RACE-3); raid wording, challenge links, and the share card (social); combat-side relic, race, and curse effects (combat-timing); the 1-hour data cache and settings storage (data-import).
