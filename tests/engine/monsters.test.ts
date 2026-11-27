import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/data/schema';
import { TIER_NAMES, bossShardLine, fightTreasure, makeBoss, makeMonster, sourceLabel } from '../../src/engine/monsters';
import type { Hero, Monster } from '../../src/engine/state';
import type { DayTile, Tier } from '../../src/mapgen/types';
import { makeHero, mapOf, demoSet } from '../fixtures/run';
import { makeSet, windowDays } from '../fixtures/sets';

const demo = mapOf(demoSet());
type FightTier = 1 | 2 | 3 | 4;
const tileOf = (tier: FightTier): DayTile => demo.tiles.find((t) => t.kind === 'monster' && t.tier === tier)!;
const fakeTile = (tier: FightTier, extra: Partial<DayTile> = {}): DayTile => ({ ...tileOf(tier === 1 ? 2 : tier), tier, ...extra });
/** Tiers 1–4 from a monster tile, 5 = the boss with 0 shards (v1.6). */
const monster = (tier: Tier, hero: Hero): Monster => (tier === 5 ? makeBoss(demo, hero, 0) : makeMonster(tileOf(tier), hero, demo));

describe('FR-COM-2: monster stats', () => {
  it('PRD worked example at start level 3: Imp 24 HP, Lich 41 HP, boss 69 HP', () => {
    const hero = makeHero({ level: 3 });
    expect(makeMonster(tileOf(2), hero, demo).hp).toBe(24);
    expect(makeMonster(tileOf(4), hero, demo).hp).toBe(41);
    expect(makeBoss(demo, hero, 0).hp).toBe(69);
    expect(makeMonster(fakeTile(1), hero, demo).hp).toBe(15);
    expect(makeMonster(tileOf(3), hero, demo).hp).toBe(32);
  });

  it('start level 1 has no scaling; level 10 scales by 2.08', () => {
    expect(makeMonster(tileOf(4), makeHero({ level: 1 }), demo).hp).toBe(33);
    expect(makeBoss(demo, makeHero({ level: 10 }), 0).hp).toBe(Math.round(40 * 2.08 * 1.4));
  });

  it('FR-DIF-2: damage by class difficulty at start level 3', () => {
    const dmg = (cls: ClassId, tier: Tier) => monster(tier, makeHero({ level: 3, cls })).dmg;
    const classes: ClassId[] = ['knight', 'wanderer', 'mage', 'rogue'];
    expect(classes.map((c) => [dmg(c, 2), dmg(c, 4), dmg(c, 5)])).toEqual([
      [4, 7, 8],
      [7, 12, 14],
      [11, 19, 22],
      [14, 23, 28],
    ]);
  });

  it('FR-OMEN-2: the Uncommitted Curse multiplies damage by 1.15', () => {
    const blessed = makeBoss(demo, makeHero({ level: 3, omen: 'blessed' }), 0).dmg;
    const cursed = makeBoss(demo, makeHero({ level: 3, omen: 'cursed' }), 0).dmg;
    expect([blessed, cursed]).toEqual([14, 16]);
  });

  it('XP is 15 × tier, the boss 100; starts out of phase 2 at full HP', () => {
    const hero = makeHero();
    expect(([1, 2, 3, 4] as FightTier[]).map((t) => makeMonster(fakeTile(t), hero, demo).xp)).toEqual([15, 30, 45, 60]);
    expect(([1, 2, 3, 4] as FightTier[]).map((t) => makeMonster(fakeTile(t), hero, demo).bound)).toEqual([false, false, false, false]);
    const boss = makeBoss(demo, hero, 0);
    expect([boss.tier, boss.xp, boss.phase2, boss.bound, boss.hp === boss.maxHp]).toEqual([5, 100, false, false, true]);
  });
});

describe('FR-COM-3: names and source labels', () => {
  it('tier names and the dated boss', () => {
    expect(TIER_NAMES).toEqual({ 1: 'Lost Ghost', 2: 'Bug Imp', 3: 'Flaky Test Ghoul', 4: 'Merge Conflict Lich' });
    const hero = makeHero();
    expect(makeMonster(tileOf(4), hero, demo).name).toBe('Merge Conflict Lich');
    expect(makeBoss(demo, hero, 0).name).toBe('The Phantom of Tue 3 Nov 2026');
  });

  it('the empty quarter: boss name, its label, and risen ghosts', () => {
    const map = mapOf(makeSet(windowDays(() => ({ count: 0 }))));
    expect(map.emptyQuarter).toBe(true);
    const boss = map.tiles[map.bossIdx]!;
    expect(makeBoss(map, makeHero(), 0).name).toBe('The Phantom of the Empty Quarter');
    expect(sourceLabel(boss, map, true)).toBe('Born from 91 days of silence');
    const ghost = map.tiles.find((t) => t.risen)!;
    expect(makeMonster(ghost, makeHero(), map).name).toBe('Lost Ghost');
    expect(sourceLabel(ghost, map)).toMatch(/^Risen from an empty day: \w{3} \d{1,2} \w{3} \d{4}$/);
  });

  it('day labels, with singular "contribution" for a count of 1', () => {
    expect(sourceLabel(demo.tiles[demo.bossIdx]!, demo, true)).toBe('Risen from Tue 3 Nov 2026: 31 contributions');
    const t = tileOf(2);
    expect(sourceLabel({ ...t, day: { ...t.day, count: 1 } }, demo)).toMatch(/: 1 contribution$/);
    expect(sourceLabel({ ...t, day: { ...t.day, count: 0 } }, demo)).toMatch(/: 0 contributions$/);
  });
});

describe('v1.6 FR-COM-3: the risen label rule', () => {
  it('"empty day" only for a risen ghost on a day with no contributions', () => {
    const t = tileOf(2);
    const empty = { ...t, tier: 1 as const, risen: true as const, day: { ...t.day, count: 0 } };
    expect(sourceLabel(empty, demo)).toMatch(/^Risen from an empty day: /);
    // A Lost Ghost raised by the route shortfall from a wisp or chest day keeps the normal label.
    expect(sourceLabel({ ...empty, day: { ...t.day, count: 4 } }, demo)).toMatch(/^Risen from \w{3} \d{1,2} \w{3} \d{4}: 4 contributions$/);
  });
});

describe('v1.6 FR-COM-2, FR-MOV-7: makeBoss and soul shards', () => {
  it('start level 3 (f = 1.24): 69, 62, 56, 49 HP for 0–3 shards; bound only at 3', () => {
    const hero = makeHero({ level: 3 });
    const bosses = [0, 1, 2, 3].map((n) => makeBoss(demo, hero, n));
    expect(bosses.map((b) => b.hp)).toEqual([69, 62, 56, 49]);
    expect(bosses.map((b) => b.maxHp)).toEqual([69, 62, 56, 49]);
    expect(bosses.map((b) => b.bound)).toEqual([false, false, false, true]);
    expect(new Set(bosses.map((b) => `${b.name}|${b.dmg}|${b.xp}|${b.tier}`)).size).toBe(1);
  });

  it('shards above SHARD_MAX cut no further', () => {
    const hero = makeHero({ level: 3 });
    expect(makeBoss(demo, hero, 4)).toEqual(makeBoss(demo, hero, 3));
  });

  it('a missing boss tile is an error', () => {
    expect(() => makeBoss({ ...demo, tiles: [], bossIdx: 0 }, makeHero(), 0)).toThrow('boss tile missing');
  });

  it('bossShardLine texts', () => {
    expect([0, 1, 2, 3].map(bossShardLine)).toEqual([
      null,
      '1 soul shard weaken the Phantom: 10% less HP.',
      '2 soul shards weaken the Phantom: 20% less HP.',
      '3 soul shards bind the Phantom: 30% less HP and no Phase 2.',
    ]);
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
