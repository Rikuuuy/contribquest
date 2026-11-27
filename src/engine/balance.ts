// Every rule constant, listed with its value in .kiro/steering/game-rules.md.

import type { ClassId } from '../data/schema';

// Map rules live in src/mapgen/rules.ts (mapgen must not import the engine) and are re-exported here.
export {
  ROWS,
  MIN_FIGHTS,
  MAP_RNG_SALT,
  CHEST_MOD,
  DECO_MOD,
  EMPTY_QUARTER_IDX,
  ROUTE_REACH,
  MIN_ROUTE_FIGHTS,
} from '../mapgen/rules';

/** Fog reveal radius squared (`dc² + dr²`), and with the Code Review relic. */
export const REVEAL_R2 = 5;
export const REVEAL_R2_REVIEW = 8;

// ---------- Timing tests (prototype QTE) ----------

/** Windows are ± ms around the target moment. */
export const QTE = {
  perfect: 70,
  good: 170,
  auraPerfect: 10,
  calm: 1.6,
  grace: 120,
  counter: 0.5,
  dmgScale: 1.25,
} as const;

/** Window and speed shaping (startQte). */
export const WINDOW_RULES = {
  /** `tm = speed × (tmBase + tmPressure × pressure)`. */
  tmBase: 0.8,
  tmPressure: 0.2,
  /** `G = max(…, gFromP × P)`. */
  gFromP: 1.4,
  /** Sidestep P multiplier, applied after G. */
  sidestepP: 1.2,
  /** Combo G cap: `comboG × calm × gMul × pressure`. */
  comboG: 120,
} as const;

/** Durations and draws per mode (startQte). */
export const TEST_TIMING = {
  barBase: 1200,
  barPerTier: 40,
  barZone: 0.5,
  barZoneRand: 0.3,
  comboBase: 1500,
  comboPerTier: 40,
  comboZ0: 0.22,
  comboZ0Rand: 0.06,
  comboGap: 0.22,
  comboGapRand: 0.05,
  chargeBase: 1000,
  chargePerTier: 30,
  chargeTarget: 0.82,
  chargeDur: 2600,
  /** Overload deadline after the charge press: `fill + chargeOverload`. */
  chargeOverload: 20,
  guardBase: 1150,
  guardPerTier: 80,
  /** Miss "too late" at `dur + deadline`. */
  deadline: 30,
  /** Shield miss at `target + P + shieldGrace`. */
  shieldGrace: 10,
  /** Auto-timing resolves a charge test at this test time. */
  assistCharge: 300,
} as const;

/** Monster strike patterns (strikePlan, startQte). */
export const PATTERN = {
  quickBase: 640,
  flakyPause: 320,
  flakyPauseRand: 220,
  flakyAt: 0.4,
  flakyAtRand: 0.25,
  conflictDist: 300,
  conflictDistRand: 120,
  /** The decoy is at least `conflictMinG × G` from the target. */
  conflictMinG: 1.6,
  /** Decoy before the target when the side draw is below this. */
  conflictSide: 0.5,
  /** Tier 3 flaky / tier 4 conflict when `rand() < planChance`. */
  planChance: 0.65,
  /** Bug Imp guard damage multiplier. */
  impMult: 0.6,
} as const;

/** Boss phase 2 (checkPhase, enemyTurn, pressure, resolveDefend). */
export const PHASE2 = {
  /** Triggers when `hp ≤ maxHp × hpFrac`. */
  hpFrac: 0.5,
  speed: 0.85,
  pressure: 0.9,
  damage: 0.75,
} as const;

/** Damage variance: `varianceBase + varianceSpread × rand()`. */
export const VARIANCE = { base: 0.9, spread: 0.2 } as const;

export type StrikeModeId = 'bar' | 'combo' | 'charge';
export type GuardModeId = 'ring' | 'sidestep' | 'shield';
type GradeTable = { readonly perfect: number; readonly good: number; readonly miss: number };

/** Strike damage multipliers per grade (combo: each of 3 hits). */
export const ATK_MULT: Readonly<Record<StrikeModeId, GradeTable>> = {
  bar: { perfect: 1.6, good: 1, miss: 0.5 },
  charge: { perfect: 1.9, good: 1.1, miss: 0.4 },
  combo: { perfect: 0.55, good: 0.35, miss: 0.08 },
};

/** Guard damage-taken multipliers per grade. */
export const DEF_MULT: Readonly<Record<GuardModeId, GradeTable>> = {
  ring: { perfect: 0, good: 0.4, miss: 1 },
  shield: { perfect: 0, good: 0.3, miss: 1 },
  sidestep: { perfect: 0, good: 0.8, miss: 1 },
};

// ---------- Hero ----------

/** Stat formula numbers (applyStats). */
export const HERO_STATS = {
  hpBase: 30,
  hpPerLevel: 6,
  hpPerAura: 5,
  atkBase: 5,
  atkPerLevel: 2,
} as const;

export type ClassStats = {
  readonly strike: StrikeModeId;
  readonly guard: GuardModeId;
  readonly hp: number;
  readonly atk: number;
  /** Bar sweep duration multiplier. */
  readonly slow: number;
};

/** Class stat numbers (prototype CLASSES). */
export const CLASS_STATS: Readonly<Record<ClassId, ClassStats>> = {
  wanderer: { strike: 'bar', guard: 'ring', hp: 1, atk: 0, slow: 1 },
  knight: { strike: 'bar', guard: 'shield', hp: 1.25, atk: -1, slow: 1.15 },
  rogue: { strike: 'combo', guard: 'sidestep', hp: 0.9, atk: 0, slow: 1 },
  mage: { strike: 'charge', guard: 'ring', hp: 0.9, atk: 2, slow: 1 },
};

export type Difficulty = {
  readonly stars: 1 | 2 | 3 | 4;
  readonly label: 'Easy' | 'Normal' | 'Hard' | 'Nightmare';
  readonly pMul: number;
  readonly gMul: number;
  readonly speed: number;
  readonly ramp: number;
  readonly floor: number;
  readonly loot: number;
  readonly dmg: number;
};

/** Class difficulty (prototype DIFFICULTY). */
export const DIFFICULTY: Readonly<Record<ClassId, Difficulty>> = {
  knight: { stars: 1, label: 'Easy', pMul: 1.25, gMul: 1.2, speed: 1.12, ramp: 0.01, floor: 0.92, loot: 1, dmg: 0.85 },
  wanderer: { stars: 2, label: 'Normal', pMul: 0.95, gMul: 0.9, speed: 0.96, ramp: 0.02, floor: 0.82, loot: 1.1, dmg: 1.5 },
  mage: { stars: 3, label: 'Hard', pMul: 0.72, gMul: 0.62, speed: 0.9, ramp: 0.03, floor: 0.72, loot: 1.25, dmg: 2.4 },
  rogue: { stars: 4, label: 'Nightmare', pMul: 0.62, gMul: 0.68, speed: 0.82, ramp: 0.04, floor: 0.6, loot: 1.5, dmg: 3.0 },
};

/** Tolerance in the pressure comparisons (winFight, HUD "maxed"). */
export const PRESSURE_EPS = 0.001;

/** Relic and race combat numbers. */
export const RELIC_COMBAT = {
  /** Linter: Perfect window +ms (before calm). */
  linter: 25,
  /** Elf: Perfect window +ms × calm. */
  elf: 15,
  /** Force Push: Perfect strike multiplier. */
  force: 1.25,
  /** Pair Programmer: Miss strike multiplier. */
  pair: 1.6,
  /** Hotfix: heal `ceil(maxHp × hotfix)` on a perfect dodge. */
  hotfix: 0.06,
  /** Vampire: HP per Perfect strike hit. */
  vampire: 2,
  /** Weekday trait: strike ATK bonus on a trait row. */
  trait: 2,
  /** Cold Brew: max HP before class scaling. */
  coffeeHp: 10,
  /** Stack Overflow: ATK. */
  stackAtk: 3,
  /** Orc: ATK. */
  orcAtk: 2,
} as const;

// ---------- Monsters ----------

/** makeMonster and fight treasure. */
export const MONSTER = {
  /** `f = 1 + levelScale × (startLevel − 1)`. */
  levelScale: 0.12,
  hpBase: 5,
  hpPerTier: 7,
  bossHp: 1.4,
  /** `dmg = round((dmgBase + t) × f × QTE.dmgScale × curse × classDmg)`. */
  dmgBase: 1,
  curse: 1.15,
  xpPerTier: 15,
  bossXp: 100,
  lootPerTier: 3,
  bossLoot: 30,
} as const;

// ---------- Progression (prototype xpForLevel, makeHero, makeTrait, enterTile, offerRelic) ----------

/** XP for level n: `XP_BASE × n × (n − 1)`. */
export const XP_BASE = 25;
export const MAX_LEVEL = 10;
/** Starting XP: `round(START_XP_MUL × √total91)`. */
export const START_XP_MUL = 15;
/** Aura: `min(floor(streak / AURA_DAYS), AURA_MAX)`. */
export const AURA_DAYS = 7;
export const AURA_MAX = 4;
export const WISP_XP = 5;
export const CHEST_XP = 10;
export const BOSS_XP = MONSTER.bossXp;
/** Chest treasure by chest size. */
export const CHEST_GOLD: Readonly<Record<1 | 2, number>> = { 1: 6, 2: 12 };
/** Chest heal: `ceil(maxHp × CHEST_HEAL)`. */
export const CHEST_HEAL = 0.3;
/** Human: every XP gain × HUMAN_XP, rounded. */
export const HUMAN_XP = 1.1;
/** Weekday trait strike bonus. */
export const TRAIT_ATK = RELIC_COMBAT.trait;
/** Blank Slate trait: max HP before class scaling. */
export const BLANK_SLATE_HP = 5;
/** Weekend Warrior: `(Sunday + Saturday) / total91 ≥ WEEKEND_SHARE`. */
export const WEEKEND_SHARE = 0.4;
/** Relics offered per chest or blessing. */
export const RELIC_OFFER = 3;
/** Cold Brew: HP healed on pick. */
export const COLD_BREW_HEAL = 10;

/** Balance simulator settings. */
export const SIM = { seeds: 200, maxActions: 2000, healBelow: 0.45, healBeforeBoss: 0.75, mixedSeed: 1234 } as const;

// ---------- Logs ----------

/** Map log lines kept (prototype `log`). */
export const MAP_LOG_LINES = 4;
/** Combat log lines kept (prototype `clog`). */
export const COMBAT_LOG_LINES = 7;
