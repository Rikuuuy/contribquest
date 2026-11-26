import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema } from '../../src/data/schema';
import { makeHero } from '../../src/engine/run';
import { makeTrait } from '../../src/engine/trait';
import { contributionSetArb } from '../arbitraries';

const classArb = fc.constantFrom(...ClassIdSchema.options);
const raceArb = fc.constantFrom(...RaceIdSchema.options);

describe('progression properties', () => {
  it('P6: as the streak rises 0 → 60, starting ATK and max HP never decrease, and are equal for every streak ≥ 28', () => {
    fc.assert(
      fc.property(contributionSetArb, classArb, raceArb, (set, heroClass, heroRace) => {
        const settings = { heroClass, heroRace, calm: false, assist: false };
        let prev = { atk: -Infinity, maxHp: -Infinity };
        let tier4: { atk: number; maxHp: number } | null = null;
        for (let streak = 0; streak <= 60; streak++) {
          const h = makeHero({ ...set, streak }, settings);
          expect(h.atk).toBeGreaterThanOrEqual(prev.atk);
          expect(h.maxHp).toBeGreaterThanOrEqual(prev.maxHp);
          expect(h.hp).toBe(h.maxHp);
          prev = { atk: h.atk, maxHp: h.maxHp };
          if (streak >= 28) {
            tier4 ??= prev;
            expect(prev).toEqual(tier4);
          }
        }
      }),
      { numRuns: 60 },
    );
  });

  it('P11: exactly one trait; rows ⊆ 0–6 with length 0 (Blank Slate only), 1, or 2 ([0, 6] only)', () => {
    fc.assert(
      fc.property(contributionSetArb, (set) => {
        const total = set.days.reduce((a, d) => a + d.count, 0);
        const t = makeTrait(set.days, total);
        expect(Object.keys(t).sort()).toEqual(['hp', 'name', 'rows', 'text']);
        expect(t.rows.every((r) => Number.isInteger(r) && r >= 0 && r <= 6)).toBe(true);
        if (t.rows.length === 0) expect([t.name, t.hp, total]).toEqual(['Blank Slate', 5, 0]);
        else if (t.rows.length === 2) expect([t.name, t.rows, t.hp]).toEqual(['Weekend Warrior', [0, 6], 0]);
        else {
          expect(t.rows).toHaveLength(1);
          expect(t.name).toMatch(/^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day Slayer$/);
          expect(t.hp).toBe(0);
        }
      }),
    );
  });
});
