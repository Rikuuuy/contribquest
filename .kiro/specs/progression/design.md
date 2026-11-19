# Design: progression

## Overview

Progression is the part of the engine that starts, grows, ends, saves, and restores a run. Like the rest of `src/engine`, it is pure: every function takes the reducer's draft (or plain values) and returns data. The two places that touch storage are thin wrappers in `src/data` (`runstore.ts`), called only from `main.ts`. The balance simulator in `scripts/simulate.ts` drives the same `step` function the browser uses.

```
settings (data) ─┐
map set ─────────┼─► newRun ──► RunState ──► step(state, action) ─┬─► collectWisp / openChest ─► gainXp ─► offerRelic
hero set ────────┘     │                                           ├─► pickRelic, chooseRace, enterMap, offerBlessing
                       │                                           └─► endRun (from combat) ─► runEnded event
                       ▼
               serialize(state) ──► data/runstore.writeRun ──► cq:v1:run
               restore(unknown) ◄── data/runstore.readRun  ◄── cq:v1:run

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
| { type: "wisp"; col: number; row: number; xp: number }
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
  relics: number; steps: number; chests: number; classWins: number; nightmare: boolean };
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
export function collectWisp(s: RunState, tile: DayTile): void;
export function openChest(s: RunState, tile: DayTile): void;            // heal, gold, log, XP, then offerRelic

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
export function routeAction(s: RunState): Action;                      // next move (or pickRelic / offerBlessing)

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

- **`newRun`** order follows the prototype: decide the raid (requirement 1.1), `generateMap(set)` (return its error on failure), `makeHero(heroSet ?? set, settings)`, `omen = omenFor(heroSet ?? set)`, build the state (`rng = map.seed`, `pos` = start tile, `prev = null`, `combat = null`, `pendingBlessing = omen === "blessed"`, `relicOffer = null`, `relicTitle = null`, `newTrophies = []`, `opts = { calm, assist }`, `log = []`, `events = []`), mark the start visited, `reveal`, then the three log lines. No RNG draw happens in `newRun`.
- **`gainXp`** applies the Human multiplier before adding, so the logged and displayed XP equals what was added. Only one level-up message is logged even if the gain crosses two thresholds, as in the prototype.
- **`openChest`** heals before `gainXp`, so a level-up from the chest's XP still heals to full afterwards. `offerRelic` runs last, so the relic shuffle draws after any combat draws already made.
- **`pickRelic`** recomputes stats with `applyStats` (combat-timing), then Cold Brew heals 10 and HP is clamped. Code Review calls `reveal` from `src/engine/explore.ts`.
- **`enterMap` and `offerBlessing`** split the prototype's `enterMap` timer: the engine clears `pendingBlessing` when the map opens, and `main.ts` sends `offerBlessing` after the presentation delay (1500 ms with the rise animation, 300 ms without). If the hero has walked into a fight by then, nothing is offered, exactly as in the prototype.
- **`endRun`** is called by combat-timing (`winFight` on a boss on the Gate, the Gate itself, `loseFight`). It does not touch storage. `main.ts` handles `runEnded`: read trophies and class wins, call `awardTrophies` with today's date from `new Date().toISOString().slice(0, 10)` (the only clock read, in `main.ts`), write both records, then dispatch `trophiesAwarded`.
- **`awardTrophies`** adds the class to `wins` only when won, then computes facts with `classWins = count of known ClassId keys in wins`, then tests trophies in order.
- **`serialize`** returns `{ ...state, events: undefined }` without `events`; tiles keep their run-time flags (`resolved`, `visited`, `seen`). `restore` parses with `SavedRunSchema` (which embeds `ContributionSetSchema` from `src/data/schema.ts`), rejects `version !== 1`, turns a fight in `test` into `choose` with `test: null` and `events: []` on the fight, and adds `events: []`. A fight in `wait` is kept; `main.ts` sends `advance` after restoring it.
- **`summaryView` and `resultsView`** produce the strings in requirements 8 and 13 with `fmtDate` and `fmtShort` from `src/mapgen/dates.ts`. The social spec adds the raid branches to these two functions, to the run-start log, and to `continueLabel`.

## Balance simulator

`scripts/simulate.ts` (run by `npm run simulate`, with `tsx`):

1. Graphs: `loadDemo()` and six fixtures from `tests/fixtures/profiles.ts` (all-empty, single active day, very dense, best day on the first day, best day on the last day, last day with 0 contributions). The two column-count fixtures (last date on Saturday or Sunday) test layout, not balance, and are left out to match the PRD's "6 fixture graphs".
2. Cells: `[knight, 140], [wanderer, 100], [mage, 100], [mage, 60], [rogue, 60], [rogue, 35]`, race Human, Calm and Auto-timing off.
3. For each cell, graph, and bot seed 0–199: `newRun(graph, null, settings)`, `bot = makeSkillBot(σ, seed)`, then loop: a test in progress → `forceGrade(skillGrade(test, bot))`; fight in `wait` → `advance`; `choose` → `attack`; `relic` → `pickRelic(0)`; `blessingDue` seen → `offerBlessing`; exploring → `routeAction(state)`. Stop at `won`, `lost`, or 2000 actions.
4. Report a table per cell: wins per graph, overall rate, target, and PASS/FAIL. Exit 1 if any overall target fails. `--seeds n` and `--cell class:σ` flags shorten a run for the balance-tuner agent.
5. Regression: Wanderer on the demo graph with the four grade policies (requirement 14.4), plus the demo route's steps and fights.

`routeAction` computes BFS distances from the hero over tiles that `checkMove` would allow, picks the goal by requirement 14.2, and returns the first `move` on the path. The prototype's bots were driven by hand through `window.__cq.setGrade`, so there is no route code to port; this rule is defined from the PRD text and recorded here.

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
| `tests/engine/routebot.test.ts` | Heal rule at 44% and 46% HP, 74% and 76% before the boss; elites before the boss; Gate after the boss; tie order |
| `tests/sim/regression.test.ts` | The four Wanderer grade policies on the demo graph give the PRD outcomes (win, win, win, lose) |
| `tests/data/runstore.test.ts` | Keys `cq:v1:run`, `cq:v1:trophies`, `cq:v1:classwins`; throwing storage; corrupt JSON returns `null` |

Arbitraries for the property tests come from `tests/arbitraries.ts` (map-generation) plus an action-sequence arbitrary: random `move`, `attack`, `flee`, `forceGrade`, `advance`, `pickRelic`, `chooseClass`, `chooseRace` actions applied with `step`, so the states are reachable ones.

## Properties owned

| Property | Statement, as tested |
| --- | --- |
| P6 | For a fixed window, class, and race, as `streak` rises from 0 to 60, starting ATK and max HP never decrease, and they are equal for every streak ≥ 28 (tier 4) |
| P8 | For any generated ContributionSet and settings, `restore(serialize(newRun(...)))` deep-equals the new run |
| P11 | For any window, `makeTrait` returns exactly one trait; its rows are a subset of 0–6 with length 0 (Blank Slate only), 1, or 2 (`[0, 6]` only) |
| P17 | For any owned subset of relics and any RNG state, the offer has `min(3, unowned)` ids, no duplicates, and no owned id |
| P19 | For any state reached by an action sequence from `newRun` (any class, race, relics, kills, and pressure), `restore(serialize(s))` deep-equals `s` with `events: []`, after a fight in `test` is moved to `choose` |

## Out of scope here

Drawing the summary, the relic cards, the HUD, the results, and the trophy grid (presentation); the race faces (presentation, FR-RACE-3); raid wording, challenge links, and the share card (social); combat-side relic, race, and curse effects (combat-timing); the 1-hour data cache and settings storage (data-import).
