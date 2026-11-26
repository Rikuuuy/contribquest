// Hero classes (prototype CLASSES, CLASS_HINT, applyStats, chooseClass).
import { ClassIdSchema, type ClassId } from '../data/schema';
import { CLASS_STATS, HERO_STATS, RELIC_COMBAT, type ClassStats } from './balance';
import type { Hero, RunState } from './state';

export type ClassInfo = ClassStats & { id: ClassId; name: string; text: string; hint: string };

export const CLASS_INFO: Readonly<Record<ClassId, ClassInfo>> = {
  wanderer: {
    id: 'wanderer',
    name: 'Wanderer',
    ...CLASS_STATS.wanderer,
    text: 'Balanced. Strike when the marker crosses the gold; dodge as the ring meets the gold circle.',
    hint: 'Attack, then press Space as the marker crosses the gold.',
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    ...CLASS_STATS.knight,
    text: 'Hold Space to raise your shield before a hit lands to block most of it. Press right at impact for a perfect parry. +25% HP, -1 ATK.',
    hint: 'Attack on the gold. When it strikes, hold Space to block, or tap right at impact to parry.',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    ...CLASS_STATS.rogue,
    text: 'Strike three times in one sweep: press on every gold mark. Sidestep has a wider perfect window and a perfect one counters at full ATK, but a near miss only grazes you. -10% HP.',
    hint: 'Attack, then press Space on each of the three gold marks.',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    ...CLASS_STATS.mage,
    text: 'Hold Space to charge a spell and release in the gold. Hold too long and it overloads. Critical spells hit x1.9. -10% HP, +2 ATK.',
    hint: 'Attack, then hold Space and release when the charge reaches the gold.',
  },
};

/** The hero's class, or Wanderer when the id is unknown. */
export function heroClass(h: Pick<Hero, 'cls'>): ClassInfo {
  return ClassIdSchema.safeParse(h.cls).success ? CLASS_INFO[h.cls] : CLASS_INFO.wanderer;
}

/** Recomputes max HP and ATK, then clamps HP to max HP (FR-CLS-2). */
export function applyStats(h: Hero): void {
  const C = heroClass(h);
  const coffee = h.relics.includes('coffee') ? RELIC_COMBAT.coffeeHp : 0;
  h.maxHp = Math.round(
    (HERO_STATS.hpBase + HERO_STATS.hpPerLevel * (h.level - 1) + HERO_STATS.hpPerAura * h.aura + h.trait.hp + coffee) * C.hp,
  );
  h.atk =
    HERO_STATS.atkBase +
    HERO_STATS.atkPerLevel * (h.level - 1) +
    h.aura +
    (h.relics.includes('stack') ? RELIC_COMBAT.stackAtk : 0) +
    C.atk +
    (h.race === 'orc' ? RELIC_COMBAT.orcAtk : 0);
  h.hp = Math.min(h.hp, h.maxHp);
}

/** Sets the class before the first step, recomputes stats, and heals to full. Returns false when refused. */
export function chooseClass(s: Pick<RunState, 'hero' | 'stats'>, cls: ClassId): boolean {
  if (s.stats.steps > 0 || !ClassIdSchema.safeParse(cls).success) return false;
  s.hero.cls = cls;
  applyStats(s.hero);
  s.hero.hp = s.hero.maxHp;
  return true;
}

/** The fight hint shown before any combat line (requirement 3.5). */
export function fightHint(dayLevel: number, dmg: number, cls: ClassId): string {
  return `Level ${dayLevel} day. It hits for about ${dmg}. ${heroClass({ cls }).hint}`;
}
