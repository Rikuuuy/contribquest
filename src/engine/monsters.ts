// Monster stats, names, and source labels (prototype makeMonster, sourceLabel, TIER_NAMES, winFight treasure).
import type { ClassId } from '../data/schema';
import { fmtDate } from '../mapgen/dates';
import type { DayTile, GameMap, Tier } from '../mapgen';
import { MONSTER, QTE } from './balance';
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

export function makeMonster(tile: DayTile, hero: Pick<Hero, 'startLevel' | 'omen' | 'cls'>, map: GameMap): Monster {
  const tier = (tile.tier || 1) as Tier;
  const f = 1 + MONSTER.levelScale * (hero.startLevel - 1);
  const boss = tier === BOSS_TIER;
  const hp = Math.round((MONSTER.hpBase + MONSTER.hpPerTier * tier) * f * (boss ? MONSTER.bossHp : 1));
  const dmg = Math.round(
    (MONSTER.dmgBase + tier) * f * QTE.dmgScale * (hero.omen === 'cursed' ? MONSTER.curse : 1) * classDiff(hero.cls).dmg,
  );
  const name = boss
    ? map.emptyQuarter
      ? EMPTY_QUARTER_BOSS
      : `The Phantom of ${fmtDate(tile.day.date)}`
    : TIER_NAMES[tier as 1 | 2 | 3 | 4];
  return { name, tier, hp, maxHp: hp, dmg, xp: boss ? MONSTER.bossXp : MONSTER.xpPerTier * tier, phase2: false };
}

export function sourceLabel(tile: DayTile, map: GameMap): string {
  if (tile.tier === BOSS_TIER && map.emptyQuarter) return 'Born from 91 days of silence';
  if (tile.risen) return `Risen from an empty day: ${fmtDate(tile.day.date)}`;
  const n = tile.day.count;
  return `Risen from ${fmtDate(tile.day.date)}: ${n} contribution${n === 1 ? '' : 's'}`;
}

/** Treasure for winning a fight: `round((t === 5 ? 30 : 3t) × loot)` (FR-DIF-2). */
export function fightTreasure(tier: Tier, cls: ClassId): number {
  return Math.round((tier === BOSS_TIER ? MONSTER.bossLoot : MONSTER.lootPerTier * tier) * classDiff(cls).loot);
}
