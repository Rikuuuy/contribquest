import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/data/schema';
import { DIFFICULTY } from '../../src/engine/balance';
import { classCardLine, classDiff, pressure, timingPercent } from '../../src/engine/difficulty';
import { makeFightRun, makeTestRun } from '../fixtures/run';

const CLASSES: ClassId[] = ['knight', 'wanderer', 'mage', 'rogue'];

describe('FR-DIF-1: class difficulty', () => {
  it('stars and labels', () => {
    expect(CLASSES.map((c) => [classDiff(c).stars, classDiff(c).label])).toEqual([
      [1, 'Easy'],
      [2, 'Normal'],
      [3, 'Hard'],
      [4, 'Nightmare'],
    ]);
  });

  it('unknown class falls back to Wanderer', () => {
    expect(classDiff('bard' as ClassId)).toBe(DIFFICULTY.wanderer);
  });
});

describe('FR-DIF-3, P14: pressure', () => {
  const at = (cls: ClassId, defeated: number) => pressure(makeTestRun({ cls, defeated }));

  it('at 0, 5, and 50 kills per class', () => {
    const table = CLASSES.map((c) => [at(c, 0), at(c, 5), at(c, 50)]);
    const expected = [
      [1, 0.95, 0.92],
      [1, 0.9, 0.82],
      [1, 0.85, 0.72],
      [1, 0.8, 0.6],
    ];
    table.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i]![j]!, 10)));
  });

  it('× 0.9 while the boss is in phase 2, after the floor', () => {
    const s = makeFightRun(5, { defeated: 50 });
    expect(pressure(s)).toBeCloseTo(0.82, 10);
    s.combat!.m.phase2 = true;
    expect(pressure(s)).toBeCloseTo(0.82 * 0.9, 10);
  });
});

describe('FR-DIF-4: timing percentage', () => {
  it('round(pressure × pMul × 100) and maxed at the floor', () => {
    expect(timingPercent(makeTestRun({ cls: 'wanderer' }))).toEqual({ pct: 95, maxed: false });
    expect(timingPercent(makeTestRun({ cls: 'wanderer', defeated: 5 }))).toEqual({ pct: 86, maxed: false });
    expect(timingPercent(makeTestRun({ cls: 'wanderer', defeated: 9 }))).toEqual({ pct: 78, maxed: true });
    expect(timingPercent(makeTestRun({ cls: 'knight' }))).toEqual({ pct: 125, maxed: false });
    expect(timingPercent(makeTestRun({ cls: 'rogue', defeated: 50 }))).toEqual({ pct: 37, maxed: true });
  });

  it('phase 2 lowers the percentage below the floor and stays maxed', () => {
    const s = makeFightRun(5, { cls: 'mage' });
    s.combat!.m.phase2 = true;
    expect(timingPercent(s)).toEqual({ pct: 65, maxed: false });
    s.stats.defeated = 20;
    expect(timingPercent(s)).toEqual({ pct: 47, maxed: true });
  });
});

describe('FR-DIF-5: class card line', () => {
  it('for all four classes', () => {
    expect(CLASSES.map(classCardLine)).toEqual([
      'Timing windows 125%, shrinking 1% per kill to 115%. Treasure ×1.',
      'Timing windows 95%, shrinking 2% per kill to 78%. Treasure ×1.1.',
      'Timing windows 72%, shrinking 3% per kill to 52%. Treasure ×1.25.',
      'Timing windows 62%, shrinking 4% per kill to 37%. Treasure ×1.5.',
    ]);
  });
});
