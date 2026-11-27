// Monster stats, names, and source labels (prototype makeMonster, sourceLabel, TIER_NAMES, winFight treasure).
// v1.6: the boss is built by makeBoss on the boss node, weakened by soul shards.
import type { ClassId } from '../data/schema';
import { fmtDate } from '../mapgen/dates';
import type { DayTile, GameMap, Tier } from '../mapgen';
import { MONSTER, QTE, SHARD_BOSS_HP_CUT, SHARD_MAX, SHARD_NO_PHASE2 } from './balance';
import { classDiff } from './difficulty';
import type { Hero, Monster } from './state';

const BOSS_TIER = 5;

export const TIER_NAMES: Readonly<Record<1 | 2 | 3 | 4, string>> = {
  1: 'Lost Ghost',
  2: 'Bug Imp',
  3: 'Flaky Test Ghoul',
  4: 'Merge Conflict Lich',
};

export const EMPTY_QUARTER_BOSS = 'The Phantom of the Empty Quarter';

type MonsterHero = Pick<Hero, 'startLevel' | 'omen' | 'cls'>;

/** `f = 1 + 0.12 × (startLevel − 1)`. */
const levelFactor = (hero: MonsterHero) => 1 + MONSTER.levelScale * (hero.startLevel - 1);

/** `dmg = round((1 + t) × f × 1.25 × curse × classDmg)` (requirement 2.1). */
function monsterDmg(tier: Tier, hero: MonsterHero): number {
  return Math.round(
    (MONSTER.dmgBase + tier) * levelFactor(hero) * QTE.dmgScale * (hero.omen === 'cursed' ? MONSTER.curse : 1) * classDiff(hero.cls).dmg,
  );
}

/** A tier 1–4 monster from its day tile (`map` is kept for the call sites; the boss is `makeBoss`). */
export function makeMonster(tile: DayTile, hero: MonsterHero, _map: GameMap): Monster {
  const tier = (tile.tier || 1) as Tier;
  const hp = Math.round((MONSTER.hpBase + MONSTER.hpPerTier * tier) * levelFactor(hero));
  const name = TIER_NAMES[tier as 1 | 2 | 3 | 4];
  return { name, tier, hp, maxHp: hp, dmg: monsterDmg(tier, hero), xp: MONSTER.xpPerTier * tier, phase2: false, bound: false };
}

/**
 * v1.6: the boss, named after the best day (`tiles[bossIdx]`). Each shard cuts max HP by SHARD_BOSS_HP_CUT;
 * at SHARD_NO_PHASE2 shards it is `bound` and never enters phase 2. At 0 shards this is the v1.5 boss.
 */
export function makeBoss(map: GameMap, hero: MonsterHero, shards: number): Monster {
  const tile = map.tiles[map.bossIdx];
  if (!tile) throw new Error('boss tile missing');
  const cut = 1 - SHARD_BOSS_HP_CUT * Math.min(shards, SHARD_MAX);
  const hp = Math.round((MONSTER.hpBase + MONSTER.hpPerTier * BOSS_TIER) * levelFactor(hero) * MONSTER.bossHp * cut);
  const name = map.emptyQuarter ? EMPTY_QUARTER_BOSS : `The Phantom of ${fmtDate(tile.day.date)}`;
  return {
    name,
    tier: BOSS_TIER,
    hp,
    maxHp: hp,
    dmg: monsterDmg(BOSS_TIER, hero),
    xp: MONSTER.bossXp,
    phase2: false,
    bound: shards >= SHARD_NO_PHASE2,
  };
}

/** v1.6: the boss-fight log line for the shards held (requirement 2.6), or null without shards. */
export function bossShardLine(shards: number): string | null {
  const n = Math.min(shards, SHARD_MAX);
  if (n <= 0) return null;
  const pct = Math.round(SHARD_BOSS_HP_CUT * n * 100);
  if (n >= SHARD_NO_PHASE2) return `${n} soul shards bind the Phantom: ${pct}% less HP and no Phase 2.`;
  return `${n} soul shard${n === 1 ? '' : 's'} weaken the Phantom: ${pct}% less HP.`;
}

/** `boss` labels the boss's best-day tile. v1.6: the "empty day" label needs a risen ghost on a day with no contributions. */
export function sourceLabel(tile: DayTile, map: GameMap, boss = false): string {
  if (boss && map.emptyQuarter) return 'Born from 91 days of silence';
  if (tile.risen && tile.day.count === 0) return `Risen from an empty day: ${fmtDate(tile.day.date)}`;
  const n = tile.day.count;
  return `Risen from ${fmtDate(tile.day.date)}: ${n} contribution${n === 1 ? '' : 's'}`;
}

/** Treasure for winning a fight: `round((t === 5 ? 30 : 3t) × loot)` (FR-DIF-2). */
export function fightTreasure(tier: Tier, cls: ClassId): number {
  return Math.round((tier === BOSS_TIER ? MONSTER.bossLoot : MONSTER.lootPerTier * tier) * classDiff(cls).loot);
}
