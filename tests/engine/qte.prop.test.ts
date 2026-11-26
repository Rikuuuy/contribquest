import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/data/schema';
import { CLASS_STATS, DIFFICULTY, PATTERN, QTE, TEST_TIMING } from '../../src/engine/balance';
import { NO_MODS } from '../../src/engine/mods';
import { createTest, grade, windows, type TestContext } from '../../src/engine/qte';
import type { Grade, InputEvent, Mode, Pattern } from '../../src/engine/state';
import type { Tier } from '../../src/mapgen/types';

const CLASSES: ClassId[] = ['knight', 'wanderer', 'mage', 'rogue'];
const MODES: Mode[] = ['bar', 'combo', 'charge', 'ring', 'sidestep', 'shield'];
const GUARDS: Mode[] = ['ring', 'sidestep', 'shield'];
const PATTERNS: Pattern[] = ['normal', 'quick', 'flaky', 'conflict'];

/** Shared conditions: pressure covers the full range down to Rogue's floor in phase 2 (0.6 × 0.9). */
const condArb = fc.record({
  tier: fc.constantFrom<Tier>(1, 2, 3, 4, 5),
  aura: fc.integer({ min: 0, max: 4 }),
  linter: fc.boolean(),
  elf: fc.boolean(),
  calm: fc.boolean(),
  pressure: fc.double({ min: 0.54, max: 1, noNaN: true }),
  patSpeed: fc.constantFrom(1, 0.85),
});
type Cond = typeof condArb extends fc.Arbitrary<infer T> ? T : never;

function ctxOf(c: Cond, cls: ClassId, mode: Mode, pattern: Pattern = 'normal'): TestContext {
  return {
    tier: c.tier,
    mode,
    pattern,
    aura: c.aura,
    mods: { ...NO_MODS, linter: c.linter, elf: c.elf },
    calm: c.calm,
    diff: DIFFICULTY[cls],
    pressure: c.pressure,
    slow: CLASS_STATS[cls].slow,
    patSpeed: c.patSpeed,
  };
}

/** A seeded draw source for createTest. */
const drawsArb = fc.array(fc.double({ min: 0, max: 0.999999, noNaN: true }), { minLength: 3, maxLength: 3 });
const source = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

const testArb = fc.record({
  cond: condArb,
  cls: fc.constantFrom(...CLASSES),
  mode: fc.constantFrom(...MODES),
  pattern: fc.constantFrom(...PATTERNS),
  draws: drawsArb,
});

const expected = (off: number, P: number, G: number): Grade => (Math.abs(off) <= P ? 'perfect' : Math.abs(off) <= G ? 'good' : 'miss');
const down = (t: number): InputEvent => ({ type: 'down', t, key: 'k' });
const up = (t: number): InputEvent => ({ type: 'up', t, key: 'k' });
const FAR = 1e9;

describe('P12: grading follows the windows, and the windows only widen with aura and calm', () => {
  it('single press (bar, ring, sidestep): inside P → Perfect, inside G → Good, outside → Miss', () => {
    fc.assert(
      fc.property(testArb, fc.double({ min: -2, max: 2, noNaN: true }), ({ cond, cls, mode, pattern, draws }, k) => {
        fc.pre(mode === 'bar' || mode === 'ring' || mode === 'sidestep');
        const test = createTest(mode === 'bar' ? 'attack' : 'defend', ctxOf(cond, cls, mode, pattern), source(draws));
        const off = k * test.G;
        const t = test.target + off;
        fc.pre(t >= QTE.grace && t <= test.dur + TEST_TIMING.deadline);
        const r = grade(test, [down(t)], FAR, false);
        expect(r?.grade).toBe(expected(off, test.P, test.G));
      }),
    );
  });

  it('charge: the release grades on hold length against the same windows', () => {
    fc.assert(
      fc.property(condArb, fc.constantFrom(...CLASSES), fc.double({ min: -2, max: 2, noNaN: true }), (cond, cls, k) => {
        const test = createTest('attack', ctxOf(cond, cls, 'charge'), source([0.5]));
        const held = test.target + k * test.G;
        fc.pre(held > 0);
        const r = grade(test, [down(200), up(200 + held)], FAR, false);
        expect(r?.grade).toBe(held >= test.fill! ? 'miss' : expected(held - test.target, test.P, test.G));
      }),
    );
  });

  it('P and G never shrink as aura rises 0→4 or when Calm mode is on', () => {
    fc.assert(
      fc.property(condArb, fc.constantFrom(...CLASSES), fc.constantFrom(...MODES), (cond, cls, mode) => {
        for (let a = 0; a < 4; a++) {
          const lo = windows(ctxOf({ ...cond, aura: a }, cls, mode));
          const hi = windows(ctxOf({ ...cond, aura: a + 1 }, cls, mode));
          expect(hi.P).toBeGreaterThanOrEqual(lo.P);
          expect(hi.G).toBeGreaterThanOrEqual(lo.G);
        }
        const off = windows(ctxOf({ ...cond, calm: false }, cls, mode));
        const on = windows(ctxOf({ ...cond, calm: true }, cls, mode));
        expect(on.P).toBeGreaterThanOrEqual(off.P);
        expect(on.G).toBeGreaterThanOrEqual(off.G);
      }),
    );
  });
});

describe('P15: harder classes have narrower windows (base P and each class strike test)', () => {
  it('Knight ≥ Wanderer ≥ Mage ≥ Rogue at equal pressure, aura, mods, and calm', () => {
    fc.assert(
      fc.property(condArb, (cond) => {
        const base = CLASSES.map((cls) => windows(ctxOf(cond, cls, 'ring')).P);
        const strike = CLASSES.map((cls) => windows(ctxOf(cond, cls, CLASS_STATS[cls].strike)));
        for (let i = 0; i + 1 < CLASSES.length; i++) {
          expect(base[i]).toBeGreaterThanOrEqual(base[i + 1] as number);
          expect(strike[i]!.P).toBeGreaterThanOrEqual(strike[i + 1]!.P);
          expect(strike[i]!.G).toBeGreaterThanOrEqual(strike[i + 1]!.G);
        }
      }),
    );
  });
});

describe('P16: on target is Perfect, outside G is Miss, for every mode and pattern', () => {
  it('a press, hold release, or shield hold exactly on target grades Perfect', () => {
    fc.assert(
      fc.property(testArb, ({ cond, cls, mode, pattern, draws }) => {
        const test = createTest(mode === 'bar' || mode === 'combo' || mode === 'charge' ? 'attack' : 'defend', ctxOf(cond, cls, mode, pattern), source(draws));
        if (mode === 'combo') {
          expect(grade(test, test.marks!.map(down), FAR, false)).toEqual({ grade: ['perfect', 'perfect', 'perfect'] });
        } else if (mode === 'charge') {
          expect(grade(test, [down(200), up(200 + test.target)], FAR, false)).toEqual({ grade: 'perfect' });
        } else {
          expect(grade(test, [down(test.target)], FAR, false)).toEqual({ grade: 'perfect' });
          if (mode === 'shield') expect(grade(test, [down(test.target - test.P / 2)], FAR, false)).toEqual({ grade: 'perfect' });
        }
      }),
    );
  });

  it('a press, hold release, or late parry outside G (and P) grades Miss', () => {
    fc.assert(
      fc.property(testArb, fc.double({ min: 1, max: 200, noNaN: true }), ({ cond, cls, mode, pattern, draws }, extra) => {
        const test = createTest(mode === 'bar' || mode === 'combo' || mode === 'charge' ? 'attack' : 'defend', ctxOf(cond, cls, mode, pattern), source(draws));
        const miss = (events: InputEvent[]) => {
          const r = grade(test, events, FAR, false);
          return Array.isArray(r?.grade) ? r.grade.every((g) => g === 'miss') : r?.grade === 'miss';
        };
        // The combo caps G after P is set, so with a wide P (Rogue, aura 4, Linter, Elf) P can exceed G there;
        // a press is only a Miss outside both windows. Every other mode has G ≥ 1.4 × P before the sidestep's × 1.2.
        const d = Math.max(test.P, test.G) + extra;
        if (mode !== 'combo') expect(test.G).toBeGreaterThan(test.P);
        if (mode === 'combo') {
          if (test.marks![0] - d >= QTE.grace) expect(miss(test.marks!.map((m) => down(m - d)))).toBe(true);
        } else if (mode === 'charge') {
          expect(miss([down(200), up(200 + test.target + d)])).toBe(true);
          expect(miss([down(200), up(200 + test.target - d)])).toBe(true);
        } else {
          expect(miss([down(test.target + d)])).toBe(true);
          if (mode !== 'shield' && test.target - d >= QTE.grace) expect(miss([down(test.target - d)])).toBe(true);
        }
      }),
    );
  });
});

describe('Guard patterns (v1.4)', () => {
  const guardArb = fc.record({ cond: condArb, cls: fc.constantFrom(...CLASSES), mode: fc.constantFrom(...GUARDS), draws: drawsArb });

  it('flaky: the target is the base plus the pause, and the pause starts before the base', () => {
    fc.assert(
      fc.property(guardArb, ({ cond, cls, mode, draws }) => {
        const ctx = ctxOf(cond, cls, mode, 'flaky');
        const test = createTest('defend', ctx, source(draws));
        const { tm } = windows(ctx);
        const base = (TEST_TIMING.guardBase - TEST_TIMING.guardPerTier * cond.tier) * (cond.calm ? QTE.calm : 1) * tm * cond.patSpeed;
        expect(test.target).toBeCloseTo(base + test.pause!, 6);
        expect(test.pauseAt!).toBeLessThan(base);
        expect(test.pause!).toBeGreaterThanOrEqual(PATTERN.flakyPause * tm - 1e-9);
      }),
    );
  });

  it('conflict: the decoy never lies within G of the target', () => {
    fc.assert(
      fc.property(guardArb, ({ cond, cls, mode, draws }) => {
        const test = createTest('defend', ctxOf(cond, cls, mode, 'conflict'), source(draws));
        expect(Math.abs(test.decoy! - test.target)).toBeGreaterThan(test.G);
        // Grading only counts the solid ring: a press on the decoy is a Miss (or, for the shield, never a Perfect).
        const r = grade(test, [down(test.decoy!)], FAR, false);
        if (mode === 'shield') expect(r?.grade).not.toBe('perfect');
        else if (test.decoy! >= QTE.grace) expect(r?.grade).toBe('miss');
      }),
    );
  });
});
