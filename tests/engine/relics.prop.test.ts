import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ClassId, RaceId } from '../../src/data/schema';
import { heroClass } from '../../src/engine/classes';
import { resolveGuard, resolveStrike } from '../../src/engine/combat';
import { RELICS, offerRelic } from '../../src/engine/relics';
import { step } from '../../src/engine/step';
import type { ComboGrade, Grade, GradeResult, RelicId, RunState } from '../../src/engine/state';
import type { Tier } from '../../src/mapgen/types';
import { makeFightRun, makeTestRun } from '../fixtures/run';

const IDS: RelicId[] = RELICS.map((r) => r.id);
const CLASSES: ClassId[] = ['wanderer', 'knight', 'rogue', 'mage'];
const RACES: RaceId[] = ['human', 'elf', 'orc', 'skeleton', 'vampire'];
const gradeArb = fc.constantFrom<Grade>('perfect', 'good', 'miss');
const rngArb = fc.integer({ min: 0, max: 0xffffffff });
const base = makeTestRun();

describe('P17: a relic offer never holds an owned relic or a duplicate', () => {
  it('for any owned subset and RNG state: min(3, unowned) ids, distinct, none owned', () => {
    fc.assert(
      fc.property(fc.subarray(IDS), rngArb, (owned, rng) => {
        const s = structuredClone(base);
        s.hero.relics = [...owned];
        s.rng = rng;
        offerRelic(s);
        const unowned = IDS.length - owned.length;
        if (unowned === 0) {
          expect([s.relicOffer, s.status, s.rng]).toEqual([null, 'exploring', rng]);
          return;
        }
        const offer = s.relicOffer!;
        expect(s.status).toBe('relic');
        expect(offer).toHaveLength(Math.min(3, unowned));
        expect(new Set(offer).size).toBe(offer.length);
        for (const id of offer) {
          expect(IDS).toContain(id);
          expect(owned).not.toContain(id);
        }
      }),
    );
  });
});

const caseArb = fc
  .record({
    tier: fc.constantFrom<Tier>(1, 2, 3, 4, 5),
    cls: fc.constantFrom(...CLASSES),
    race: fc.constantFrom(...RACES),
    relics: fc.subarray(IDS),
    extra: fc.constantFrom(...IDS),
    level: fc.integer({ min: 1, max: 10 }),
    aura: fc.integer({ min: 0, max: 4 }),
    trait: fc.boolean(),
    rng: rngArb,
    grades: fc.tuple(gradeArb, gradeArb, gradeArb),
  })
  .filter((f) => !f.relics.includes(f.extra));
type Case = typeof caseArb extends fc.Arbitrary<infer T> ? T : never;

/** The same fight with and without one more relic, at the strike or guard test, with the RNG fixed. */
function pair(f: Case, at: 'strike' | 'guard'): [RunState, RunState] {
  return [f.relics, [...f.relics, f.extra]].map((relics) => {
    let s = makeFightRun(f.tier, { cls: f.cls, race: f.race, relics, level: f.level, aura: f.aura });
    const c = s.combat!;
    c.m.hp = c.m.maxHp = 10000;
    if (f.trait) s.hero.trait = { name: 'Row', text: '', rows: [c.row], hp: 0 };
    s = step(s, { type: 'attack' });
    if (at === 'guard') s = step(step(s, { type: 'forceGrade', grade: 'miss' }), { type: 'advance' });
    s.combat!.m.hp = 10000;
    s.hero.maxHp = 10000;
    s.hero.hp = 5000;
    s.rng = f.rng;
    return s;
  }) as [RunState, RunState];
}

const strikeResult = (s: RunState, f: Case): GradeResult =>
  heroClass(s.hero).strike === 'combo' ? { grade: [...f.grades] as ComboGrade } : { grade: f.grades[0] };

describe('v1.4: owning another relic never lowers damage dealt or raises damage taken', () => {
  it('strike: damage dealt with the extra relic ≥ without it', () => {
    fc.assert(
      fc.property(caseArb, (f) => {
        const dealt = pair(f, 'strike').map((s) => {
          resolveStrike(s, strikeResult(s, f));
          return 10000 - s.combat!.m.hp;
        });
        expect(dealt[1]).toBeGreaterThanOrEqual(dealt[0]!);
      }),
    );
  });

  it('guard: damage taken with the extra relic ≤ without it, counter damage ≥', () => {
    fc.assert(
      fc.property(caseArb, (f) => {
        const out = pair(f, 'guard').map((s) => {
          resolveGuard(s, { grade: f.grades[0] }, s.combat!.strikeIdx);
          return { taken: 5000 - s.hero.hp, dealt: 10000 - s.combat!.m.hp };
        });
        expect(out[1]!.taken).toBeLessThanOrEqual(out[0]!.taken);
        expect(out[1]!.dealt).toBeGreaterThanOrEqual(out[0]!.dealt);
      }),
    );
  });
});
