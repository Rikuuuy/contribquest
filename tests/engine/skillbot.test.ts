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

const N = 10_000;
/** Windows so wide that a single press never misses on its own. */
const WIDE = { P: 1e9, G: 1e9 };

function rate(t: QteTest, sigma: number, hit: (g: ReturnType<typeof skillGrade>) => boolean): number {
  const bot = makeSkillBot(sigma, 1);
  let n = 0;
  for (let i = 0; i < N; i++) if (hit(skillGrade(t, bot))) n++;
  return n / N;
}

describe('FR-DIF-1: skill bot grading', () => {
  it('grades a combo as three presses', () => {
    const bot = makeSkillBot(100, 2);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const g = skillGrade(test({ mode: 'combo', marks: [400, 800, 1200] }), bot);
      expect(Array.isArray(g) && g.length).toBe(3);
      for (const x of g as string[]) seen.add(x);
    }
    expect(seen).toEqual(new Set(['perfect', 'good', 'miss']));
  });

  it('grades by |offset|: σ far inside P is all Perfect, σ far outside G is mostly Miss', () => {
    expect(rate(test({ P: 1000, G: 2000 }), 10, (g) => g === 'perfect')).toBe(1);
    expect(rate(test({ P: 1, G: 2 }), 1000, (g) => g === 'miss')).toBeGreaterThan(0.99);
  });

  it('misses a charge when the offset overloads past fill − target', () => {
    const charge = (fill: number) => test({ mode: 'charge', ...WIDE, target: 500, fill });
    // fill − target = 0: every late offset (half of them) overloads.
    expect(rate(charge(500), 100, (g) => g === 'miss')).toBeCloseTo(0.5, 1);
    // fill − target = σ: about 15.9% of offsets exceed one σ.
    expect(Math.abs(rate(charge(600), 100, (g) => g === 'miss') - 0.1587)).toBeLessThan(0.02);
    // Far limit: never overloads.
    expect(rate(charge(1e9), 100, (g) => g === 'miss')).toBe(0);
  });

  it.each([60, 100, 140])('falls for a conflict decoy at σ/600 (σ = %i)', (sigma) => {
    const r = rate(test({ mode: 'ring', kind: 'defend', pattern: 'conflict', ...WIDE }), sigma, (g) => g === 'miss');
    expect(Math.abs(r - sigma / 600)).toBeLessThanOrEqual(0.02);
  });

  it.each([60, 100, 140])('presses at the old pace on a flaky ring at σ/700 (σ = %i)', (sigma) => {
    const r = rate(test({ mode: 'ring', kind: 'defend', pattern: 'flaky', ...WIDE }), sigma, (g) => g === 'miss');
    expect(Math.abs(r - sigma / 700)).toBeLessThanOrEqual(0.02);
  });

  it('applies no decoy or pace miss to normal and quick patterns', () => {
    for (const pattern of ['normal', 'quick'] as const)
      expect(rate(test({ mode: 'ring', kind: 'defend', pattern, ...WIDE }), 140, (g) => g === 'miss')).toBe(0);
  });

  it('rescues about 70% of shield misses as Good', () => {
    // P = G = 0: every press misses, so only the rescue turns one into Good.
    const r = rate(test({ mode: 'shield', kind: 'defend', P: 0, G: 0 }), 100, (g) => g === 'good');
    expect(Math.abs(r - 0.7)).toBeLessThanOrEqual(0.02);
    expect(rate(test({ mode: 'ring', kind: 'defend', P: 0, G: 0 }), 100, (g) => g === 'good')).toBe(0);
  });
});
