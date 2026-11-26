import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/data/schema';
import { TIER_NAMES, fightTreasure, makeMonster, sourceLabel } from '../../src/engine/monsters';
import type { DayTile, Tier } from '../../src/mapgen/types';
import { makeHero, mapOf, demoSet } from '../fixtures/run';
import { makeSet, windowDays } from '../fixtures/sets';

const demo = mapOf(demoSet());
const tileOf = (tier: Tier): DayTile => demo.tiles.find((t) => (tier === 5 ? t.boss : t.kind === 'monster' && t.tier === tier))!;
const fakeTile = (tier: Tier, extra: Partial<DayTile> = {}): DayTile => ({ ...tileOf(tier === 1 ? 2 : tier), tier, ...extra });

describe('FR-COM-2: monster stats', () => {
  it('PRD worked example at start level 3: Imp 24 HP, Lich 41 HP, boss 69 HP', () => {
    const hero = makeHero({ level: 3 });
    expect(makeMonster(tileOf(2), hero, demo).hp).toBe(24);
    expect(makeMonster(tileOf(4), hero, demo).hp).toBe(41);
    expect(makeMonster(tileOf(5), hero, demo).hp).toBe(69);
    expect(makeMonster(fakeTile(1), hero, demo).hp).toBe(15);
    expect(makeMonster(tileOf(3), hero, demo).hp).toBe(32);
  });

  it('start level 1 has no scaling; level 10 scales by 2.08', () => {
    expect(makeMonster(tileOf(4), makeHero({ level: 1 }), demo).hp).toBe(33);
    expect(makeMonster(tileOf(5), makeHero({ level: 10 }), demo).hp).toBe(Math.round(40 * 2.08 * 1.4));
  });

  it('FR-DIF-2: damage by class difficulty at start level 3', () => {
    const dmg = (cls: ClassId, tier: Tier) => makeMonster(tileOf(tier), makeHero({ level: 3, cls }), demo).dmg;
    const classes: ClassId[] = ['knight', 'wanderer', 'mage', 'rogue'];
    expect(classes.map((c) => [dmg(c, 2), dmg(c, 4), dmg(c, 5)])).toEqual([
      [4, 7, 8],
      [7, 12, 14],
      [11, 19, 22],
      [14, 23, 28],
    ]);
  });

  it('FR-OMEN-2: the Uncommitted Curse multiplies damage by 1.15', () => {
    const blessed = makeMonster(tileOf(5), makeHero({ level: 3, omen: 'blessed' }), demo).dmg;
    const cursed = makeMonster(tileOf(5), makeHero({ level: 3, omen: 'cursed' }), demo).dmg;
    expect([blessed, cursed]).toEqual([14, 16]);
  });

  it('XP is 15 × tier, the boss 100; starts out of phase 2 at full HP', () => {
    const hero = makeHero();
    expect(([1, 2, 3, 4] as Tier[]).map((t) => makeMonster(fakeTile(t), hero, demo).xp)).toEqual([15, 30, 45, 60]);
    const boss = makeMonster(tileOf(5), hero, demo);
    expect([boss.xp, boss.phase2, boss.hp === boss.maxHp]).toEqual([100, false, true]);
  });
});

describe('FR-COM-3: names and source labels', () => {
  it('tier names and the dated boss', () => {
    expect(TIER_NAMES).toEqual({ 1: 'Lost Ghost', 2: 'Bug Imp', 3: 'Flaky Test Ghoul', 4: 'Merge Conflict Lich' });
    const hero = makeHero();
    expect(makeMonster(tileOf(4), hero, demo).name).toBe('Merge Conflict Lich');
    expect(makeMonster(tileOf(5), hero, demo).name).toBe('The Phantom of Tue 3 Nov 2026');
  });

  it('the empty quarter: boss name, its label, and risen ghosts', () => {
    const map = mapOf(makeSet(windowDays(() => ({ count: 0 }))));
    expect(map.emptyQuarter).toBe(true);
    const boss = map.tiles[map.bossIdx]!;
    expect(makeMonster(boss, makeHero(), map).name).toBe('The Phantom of the Empty Quarter');
    expect(sourceLabel(boss, map)).toBe('Born from 91 days of silence');
    const ghost = map.tiles.find((t) => t.risen)!;
    expect(makeMonster(ghost, makeHero(), map).name).toBe('Lost Ghost');
    expect(sourceLabel(ghost, map)).toMatch(/^Risen from an empty day: \w{3} \d{1,2} \w{3} \d{4}$/);
  });

  it('day labels, with singular "contribution" for a count of 1', () => {
    expect(sourceLabel(tileOf(5), demo)).toBe('Risen from Tue 3 Nov 2026: 31 contributions');
    const t = tileOf(2);
    expect(sourceLabel({ ...t, day: { ...t.day, count: 1 } }, demo)).toMatch(/: 1 contribution$/);
    expect(sourceLabel({ ...t, day: { ...t.day, count: 0 } }, demo)).toMatch(/: 0 contributions$/);
  });
});

describe('FR-DIF-2: fight treasure', () => {
  it('round((t === 5 ? 30 : 3t) × loot) per class', () => {
    const classes: ClassId[] = ['knight', 'wanderer', 'mage', 'rogue'];
    expect(classes.map((c) => ([1, 2, 3, 4, 5] as Tier[]).map((t) => fightTreasure(t, c)))).toEqual([
      [3, 6, 9, 12, 30],
      [3, 7, 10, 13, 33],
      [4, 8, 11, 15, 38],
      [5, 9, 14, 18, 45],
    ]);
  });
});
