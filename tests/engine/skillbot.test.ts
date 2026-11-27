import { describe, expect, it } from 'vitest';
import { makeSkillBot, skillGrade } from '../../src/engine/skillbot';
import type { QteTest } from '../../src/engine/state';

const test = (o: Partial<QteTest> = {}): QteTest => ({
  kind: 'attack',
  mode: 'bar',
  pattern: 'normal',
  P: 45,
  G: 110,
  dur: 1200,
  target: 600,
  ...o,
});

describe('FR-DIF-1: skill bot seeding', () => {
  it('seeds its RNG with σ × 7919 + seed × 104729', () => {
    expect(makeSkillBot(100, 3).rng.state).toBe(100 * 7919 + 3 * 104729);
    expect(makeSkillBot(35, 0).rng.state).toBe(35 * 7919);
  });

  it('gives the same grades for the same σ and seed, and different ones for another seed', () => {
    const draw = (seed: number) => {
      const bot = makeSkillBot(100, seed);
      return Array.from({ length: 50 }, () => skillGrade(test(), bot));
    };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });
});
