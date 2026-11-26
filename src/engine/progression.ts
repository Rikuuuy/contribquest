// XP and levels (prototype xpForLevel, levelFor, gainXp).
// Combat needs gainXp after a kill; the progression spec extends this file with the rest of its rules.
import { HUMAN_XP, LEVEL_CAP, XP_PER_LEVEL } from './balance';
import { applyStats } from './classes';
import { log } from './log';
import type { RunState } from './state';

export function xpForLevel(n: number): number {
  return XP_PER_LEVEL * n * (n - 1);
}

export function levelFor(xp: number): number {
  let L = 1;
  while (L < LEVEL_CAP && xp >= xpForLevel(L + 1)) L++;
  return L;
}

/** Adds XP (Human × 1.1, rounded); a level-up recomputes stats and heals to full, with one log line. */
export function gainXp(s: Pick<RunState, 'hero' | 'log'>, amount: number): void {
  const h = s.hero;
  const x = h.race === 'human' ? Math.round(amount * HUMAN_XP) : amount;
  h.xp += x;
  const L = levelFor(h.xp);
  if (L > h.level) {
    h.level = L;
    applyStats(h);
    h.hp = h.maxHp;
    log(s, `Level up! You are now level ${L}. HP fully restored.`);
  }
}
