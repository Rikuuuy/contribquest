import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ClassId, RaceId } from '../../src/data/schema';
import { DIFFICULTY, PHASE2 } from '../../src/engine/balance';
import { pressure } from '../../src/engine/difficulty';
import { makeMonster } from '../../src/engine/monsters';
import { step } from '../../src/engine/step';
import type { Grade, RelicId, RunState } from '../../src/engine/state';
import type { Tier } from '../../src/mapgen/types';
import { demoSet, fightOn, findTile, makeFightRun, makeHero, makeTestRun, mapOf } from '../fixtures/run';

const CLASSES: ClassId[] = ['wanderer', 'knight', 'rogue', 'mage'];
const RACES: RaceId[] = ['human', 'elf', 'orc', 'skeleton', 'vampire'];
const RELICS: RelicId[] = ['duck', 'hotfix', 'force', 'linter', 'stack', 'coffee', 'blame', 'pair', 'review', 'cache'];
const GRADES: Grade[] = ['perfect', 'good', 'miss'];
const demo = mapOf(demoSet());

describe('P7: monsters never get weaker as the tier rises', () => {
  it('HP and damage are non-decreasing from tier 1 to 5 for any start level, class, and omen', () => {
    const tiles = ([1, 2, 3, 4, 5] as Tier[]).map((tier) => {
      const t = demo.tiles.find((x) => (tier === 5 ? x.boss : x.kind === 'monster' && x.tier === Math.max(2, tier)))!;
      return { ...t, tier };
    });
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), fc.constantFrom(...CLASSES), fc.constantFrom('blessed', 'cursed' as const), (level, cls, omen) => {
        const hero = makeHero({ level, cls, omen });
        const ms = tiles.map((t) => makeMonster(t, hero, demo));
        for (let i = 0; i + 1 < ms.length; i++) {
          expect(ms[i + 1]!.hp).toBeGreaterThanOrEqual(ms[i]!.hp);
          expect(ms[i + 1]!.dmg).toBeGreaterThanOrEqual(ms[i]!.dmg);
        }
      }),
    );
  });
});

const fightArb = fc.record({
  tier: fc.constantFrom<Tier>(1, 2, 3, 4, 5),
  cls: fc.constantFrom(...CLASSES),
  race: fc.constantFrom(...RACES),
  relics: fc.subarray(RELICS.filter((r) => r !== 'duck')),
  level: fc.integer({ min: 1, max: 10 }),
  aura: fc.integer({ min: 0, max: 4 }),
  phase2: fc.boolean(),
  rng: fc.integer({ min: 0, max: 0xffffffff }),
  trait: fc.boolean(),
});
type FightCase = typeof fightArb extends fc.Arbitrary<infer T> ? T : never;

/** A fight in the strike test (or the first guard test), with the RNG state fixed before the grade. */
function setup(f: FightCase, guard: boolean): RunState {
  let s = makeFightRun(f.tier, { cls: f.cls, race: f.race, relics: f.relics, level: f.level, aura: f.aura });
  const c = s.combat!;
  c.m.hp = c.m.maxHp = 10000;
  c.m.phase2 = f.tier === 5 && f.phase2;
  if (f.trait) s.hero.trait = { name: 'Row', text: '', rows: [c.row], hp: 0 };
  s = step(s, { type: 'attack' });
  if (guard) s = step(step(s, { type: 'forceGrade', grade: 'miss' }), { type: 'advance' });
  s.rng = f.rng;
  return s;
}

describe('P13: a better grade is never worse for the hero', () => {
  it('damage dealt: Miss ≤ Good ≤ Perfect for every strike mode and relic set', () => {
    fc.assert(
      fc.property(fightArb, (f) => {
        const base = setup(f, false);
        const dealt = GRADES.map((g) => 10000 - step(base, { type: 'forceGrade', grade: g }).combat!.m.hp);
        expect(dealt[2]).toBeLessThanOrEqual(dealt[1]!);
        expect(dealt[1]).toBeLessThanOrEqual(dealt[0]!);
      }),
    );
  });

  it('damage taken: Perfect (0) ≤ Good ≤ Miss for every guard mode, pattern, and relic set', () => {
    fc.assert(
      fc.property(fightArb, (f) => {
        const base = setup(f, true);
        base.hero.hp = base.hero.maxHp = 10000;
        const taken = GRADES.map((g) => 10000 - step(base, { type: 'forceGrade', grade: g }).hero.hp);
        expect(taken[0]).toBe(0);
        expect(taken[0]).toBeLessThanOrEqual(taken[1]!);
        expect(taken[1]).toBeLessThanOrEqual(taken[2]!);
      }),
    );
  });

  it('fleeing: Perfect (0) ≤ Good ≤ Miss', () => {
    fc.assert(
      fc.property(fightArb, (f) => {
        let s = makeFightRun(f.tier, { cls: f.cls, race: f.race, relics: f.relics, level: f.level });
        s.hero.hp = s.hero.maxHp = 10000;
        s = step(s, { type: 'flee' });
        s.rng = f.rng;
        const taken = GRADES.map((g) => 10000 - step(s, { type: 'forceGrade', grade: g }).hero.hp);
        expect(taken[0]).toBe(0);
        expect(taken[1]).toBeLessThanOrEqual(taken[2]!);
      }),
    );
  });
});

describe('P14: pressure only falls with kills, down to the floor (× 0.9 in phase 2)', () => {
  it('for any class and kill count', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLASSES), fc.integer({ min: 0, max: 60 }), fc.boolean(), (cls, kills, phase2) => {
        const s = makeFightRun(5, { cls });
        s.combat!.m.phase2 = phase2;
        const D = DIFFICULTY[cls];
        const floor = phase2 ? D.floor * PHASE2.pressure : D.floor;
        let prev = Infinity;
        for (let k = 0; k <= kills; k++) {
          s.stats.defeated = k;
          const p = pressure(s);
          expect(p).toBeLessThanOrEqual(prev);
          expect(p).toBeGreaterThanOrEqual(floor - 1e-12);
          expect(p).toBeLessThanOrEqual(phase2 ? PHASE2.pressure : 1);
          prev = p;
        }
      }),
    );
  });

  it('kills played through step never raise pressure', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLASSES), fc.integer({ min: 1, max: 6 }), (cls, kills) => {
        let s = makeTestRun({ cls });
        let prev = pressure(s);
        for (let k = 0; k < kills; k++) {
          s = fightOn(structuredClone(s), findTile(s, (t) => t.kind === 'monster' && t.tier === 2));
          s.combat!.m.hp = 1;
          s = step(step(step(s, { type: 'attack' }), { type: 'forceGrade', grade: 'good' }), { type: 'advance' });
          expect(s.stats.defeated).toBe(k + 1);
          const p = pressure(s);
          expect(p).toBeLessThanOrEqual(prev);
          expect(p).toBeGreaterThanOrEqual(DIFFICULTY[cls].floor);
          prev = p;
        }
      }),
      { numRuns: 40 },
    );
  });
});
