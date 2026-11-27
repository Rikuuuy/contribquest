// Skill bot for the balance simulator, ported from the prototype's gauss and simulateGrade.
// Each press lands at a normal offset from the target with sigma = skill in ms, so wider windows grade better.
import { makeRng, type Rng } from '../mapgen/rng';
import type { ComboGrade, Grade, QteTest } from './state';

export type SkillBot = { sigma: number; rng: Rng };

/** A bot with skill `sigma` (ms) and its own RNG, seeded as the prototype's `skill:σ:seed` policy. */
export function makeSkillBot(sigma: number, seed: number): SkillBot {
  return { sigma, rng: makeRng(sigma * 7919 + seed * 104729) };
}

/** Box-Muller standard normal draw (prototype gauss). */
function gauss(r: Rng): number {
  let u = 0;
  while (!u) u = r.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r.next());
}

/** Grades `test` the way a player with skill `bot.sigma` would (prototype simulateGrade). */
export function skillGrade(test: QteTest, bot: SkillBot): Grade | ComboGrade {
  const one = (limit?: number): Grade => {
    const off = gauss(bot.rng) * bot.sigma;
    if (limit !== undefined && off > limit) return 'miss';
    const a = Math.abs(off);
    return a <= test.P ? 'perfect' : a <= test.G ? 'good' : 'miss';
  };
  if (test.mode === 'combo') return [one(), one(), one()];
  if (test.mode === 'charge') return one((test.fill ?? test.target) - test.target);
  if (test.pattern === 'conflict' && bot.rng.next() < bot.sigma / 600) return 'miss'; // fell for the decoy
  if (test.pattern === 'flaky' && bot.rng.next() < bot.sigma / 700) return 'miss'; // pressed at the old pace
  if (test.mode === 'shield') {
    const g = one();
    return g === 'miss' && bot.rng.next() < 0.7 ? 'good' : g; // holding early saves most misses
  }
  return one();
}
