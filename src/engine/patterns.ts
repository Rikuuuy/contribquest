// Monster strike plans and boss phase 2 (prototype strikePlan, STRIKE_LINE, checkPhase, resolveDefend's dmgMult).
import { PATTERN, PHASE2 } from './balance';
import type { Monster, Pattern } from './state';

/** The guard tests of one monster turn. Tiers 3 and 4 draw once; the others draw nothing. */
export function strikePlan(m: Pick<Monster, 'tier' | 'phase2'>, rand: () => number): Pattern[] {
  switch (m.tier) {
    case 2:
      return ['normal', 'quick'];
    case 3:
      return [rand() < PATTERN.planChance ? 'flaky' : 'normal'];
    case 4:
      return [rand() < PATTERN.planChance ? 'conflict' : 'normal'];
    case 5:
      return m.phase2 ? ['conflict', 'flaky', 'quick'] : ['normal', 'flaky'];
    default:
      return ['normal'];
  }
}

/** Guard damage multiplier: Bug Imp × 0.6, boss in phase 2 × 0.75, otherwise 1. */
export function patternDamageMult(m: Pick<Monster, 'tier' | 'phase2'>): number {
  if (m.tier === 2) return PATTERN.impMult;
  if (m.tier === 5 && m.phase2) return PHASE2.damage;
  return 1;
}

/** Enters phase 2 the first time a living boss is at or below half HP. True when it just triggered. */
export function checkPhase2(m: Monster): boolean {
  if (m.tier !== 5 || m.phase2 || m.hp <= 0 || m.hp > m.maxHp * PHASE2.hpFrac) return false;
  m.phase2 = true;
  return true;
}

export const PHASE2_LINE = 'The Phantom remembers every day you skipped. PHASE 2!';

export const STRIKE_LINE: Readonly<Record<Pattern, (m: Pick<Monster, 'name'>) => string>> = {
  normal: (m) => `${m.name} lunges at you!`,
  quick: (m) => `${m.name} strikes again, fast!`,
  flaky: (m) => `${m.name} flickers. Is it attacking or not?`,
  conflict: (m) => `${m.name} splits into two timelines! Dodge the solid one.`,
};
