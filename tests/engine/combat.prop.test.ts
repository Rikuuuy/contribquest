import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ClassId, RaceId } from '../../src/data/schema';
import { DIFFICULTY, MONSTER, PHASE2 } from '../../src/engine/balance';
import { pressure } from '../../src/engine/difficulty';
import { makeBoss, makeMonster } from '../../src/engine/monsters';
import { checkPhase2 } from '../../src/engine/patterns';
import { step } from '../../src/engine/step';
import type { Grade, RelicId, RunState } from '../../src/engine/state';
import type { Tier } from '../../src/mapgen/types';
import { contributionSetArb } from '../arbitraries';
import { bossFightOn, demoSet, fightOn, findTile, makeFightRun, makeHero, makeTestRun, mapOf } from '../fixtures/run';

const CLASSES: ClassId[] = ['wanderer', 'knight', 'rogue', 'mage'];
const RACES: RaceId[] = ['human', 'elf', 'orc', 'skeleton', 'vampire'];
const RELICS: RelicId[] = ['duck', 'hotfix', 'force', 'linter', 'stack', 'coffee', 'blame', 'pair', 'review', 'cache'];
const GRADES: Grade[] = ['perfect', 'good', 'miss'];
const demo = mapOf(demoSet());

describe('P7: monsters never get weaker as the tier rises', () => {
  it('HP and damage are non-decreasing from tier 1 to 5 for any start level, class, and omen', () => {
    const tiles = ([1, 2, 3, 4] as const).map((tier) => {
      const t = demo.tiles.find((x) => x.kind === 'monster' && x.tier === Math.max(2, tier))!;
      return { ...t, tier };
    });
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), fc.constantFrom(...CLASSES), fc.constantFrom('blessed', 'cursed' as const), (level, cls, omen) => {
        const hero = makeHero({ level, cls, omen });
        // Tier 5 is the boss with 0 shards (v1.6).
        const ms = [...tiles.map((t) => makeMonster(t, hero, demo)), makeBoss(demo, hero, 0)];
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

describe('P23 (v1.6): soul shards weaken the boss', () => {
  it('for any hero and map: max HP never rises with shards and stays ≥ 1, same damage and XP, bound exactly at 3, v1.5 stats at 0', () => {
    fc.assert(
      fc.property(
        contributionSetArb,
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom(...CLASSES),
        fc.constantFrom('blessed', 'cursed' as const),
        (set, level, cls, omen) => {
          const map = mapOf(set);
          const hero = makeHero({ level, cls, omen });
          const bosses = [0, 1, 2, 3].map((n) => makeBoss(map, hero, n));
          for (let i = 0; i < bosses.length; i++) {
            const b = bosses[i]!;
            expect(b.hp).toBe(b.maxHp);
            expect(b.maxHp).toBeGreaterThanOrEqual(1);
            if (i > 0) expect(b.maxHp).toBeLessThanOrEqual(bosses[i - 1]!.maxHp);
            expect([b.tier, b.dmg, b.xp, b.name]).toEqual([5, bosses[0]!.dmg, bosses[0]!.xp, bosses[0]!.name]);
            expect(b.bound).toBe(i === 3);
          }
          const f = 1 + MONSTER.levelScale * (level - 1);
          expect(bosses[0]!.maxHp).toBe(Math.round((MONSTER.hpBase + MONSTER.hpPerTier * 5) * f * MONSTER.bossHp));
        },
      ),
      { numRuns: 60 },
    );
  });

  it('a bound boss never sets phase2, whatever HP it is left on', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -5, max: 200 }), { minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 10 }), (hps, level) => {
        const b = makeBoss(demo, makeHero({ level }), 3);
        for (const hp of hps) {
          b.hp = Math.min(hp, b.maxHp);
          expect(checkPhase2(b)).toBe(false);
          expect(b.phase2).toBe(false);
        }
      }),
    );
  });

  it('a bound boss fought through step never enters phase 2', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLASSES), fc.array(fc.constantFrom(...GRADES), { minLength: 1, maxLength: 60 }), (cls, grades) => {
        let s = bossFightOn(makeTestRun({ cls, level: 8 }), 3);
        for (const g of grades) {
          if (s.status !== 'combat') break;
          const c = s.combat!;
          if (c.phase === 'choose') s = step(s, { type: 'attack' });
          else if (c.phase === 'wait') s = step(s, { type: 'advance' });
          else s = step(s, { type: 'forceGrade', grade: g });
          expect(s.events.some((e) => e.type === 'phase2')).toBe(false);
          if (s.combat) expect(s.combat.m.phase2).toBe(false);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('over any sequence of elite kills, shards stay in 0–3', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CLASSES), fc.array(fc.constantFrom(1, 2, 3, 4), { minLength: 1, maxLength: 8 }), (cls, tiers) => {
        let s = makeTestRun({ cls });
        for (const tier of tiers) {
          const t = s.map.tiles.find((x) => !x.resolved && x.kind === 'monster' && (x.tier === tier || (tier === 1 && x.tier === 2)));
          if (!t) continue;
          s = fightOn(structuredClone(s), t);
          s.combat!.m.hp = 1;
          s = step(step(step(s, { type: 'attack' }), { type: 'forceGrade', grade: 'good' }), { type: 'advance' });
          expect(s.shards).toBeGreaterThanOrEqual(0);
          expect(s.shards).toBeLessThanOrEqual(3);
        }
      }),
      { numRuns: 60 },
    );
  });
});
