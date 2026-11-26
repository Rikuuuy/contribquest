import { describe, expect, it } from 'vitest';
import { auraTier, collectWisp, gainXp, levelFor, openChest, startingXp, xpForLevel } from '../../src/engine/progression';
import { makeHero as buildHero } from '../../src/engine/run';
import type { Dir } from '../../src/engine/explore';
import { step } from '../../src/engine/step';
import type { RunState } from '../../src/engine/state';
import { neighbours } from '../../src/mapgen/layout';
import type { DayTile } from '../../src/mapgen/types';
import { makeSet, windowDays } from '../fixtures/sets';
import { findTile, makeTestRun } from '../fixtures/run';

const SETTINGS = { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false } as const;

describe('FR-PRO-2: XP table and levels', () => {
  it('xpForLevel(n) = 25 × n × (n − 1)', () => {
    expect(Array.from({ length: 10 }, (_, i) => xpForLevel(i + 1))).toEqual([0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250]);
  });

  it('levelFor at every threshold and one below it', () => {
    for (let n = 2; n <= 10; n++) {
      expect(levelFor(xpForLevel(n))).toBe(n);
      expect(levelFor(xpForLevel(n) - 1)).toBe(n - 1);
    }
    expect(levelFor(0)).toBe(1);
  });

  it('caps at level 10', () => {
    expect(levelFor(2250)).toBe(10);
    expect(levelFor(1e9)).toBe(10);
  });

  it('PRD examples: 10 → 47 XP level 1, 100 → 150 XP level 3, 1000 → 474 XP level 4', () => {
    expect([startingXp(10), levelFor(startingXp(10))]).toEqual([47, 1]);
    expect([startingXp(100), levelFor(startingXp(100))]).toEqual([150, 3]);
    expect([startingXp(1000), levelFor(startingXp(1000))]).toEqual([474, 4]);
    expect(startingXp(0)).toBe(0);
  });
});

describe('PRD Story 4: Streak Aura', () => {
  it('aura = min(floor(streak / 7), 4)', () => {
    expect([0, 6, 7, 13, 14, 15, 27, 28, 60, 365].map(auraTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 4, 4, 4]);
  });

  it('a 15-day streak gives aura 2: +2 ATK and +10 HP over no streak', () => {
    const days = windowDays((i) => ({ count: i % 3 }));
    const none = buildHero({ ...makeSet(days), streak: 0 }, SETTINGS);
    const aura = buildHero({ ...makeSet(days), streak: 15 }, SETTINGS);
    expect(aura.aura).toBe(2);
    expect(aura.atk - none.atk).toBe(2);
    expect(aura.maxHp - none.maxHp).toBe(10);
  });
});

describe('FR-PRO-1, FR-RACE-2: gainXp', () => {
  it('Human × 1.1, rounded, and the xp event carries the amount added', () => {
    const s = makeTestRun({ race: 'human', level: 1 });
    gainXp(s, 5);
    expect(s.hero.xp).toBe(6);
    gainXp(s, 15);
    expect(s.hero.xp).toBe(6 + 17);
    expect(s.events).toEqual([
      { type: 'xp', amount: 6 },
      { type: 'xp', amount: 17 },
    ]);
  });

  it('other races gain the plain amount', () => {
    const s = makeTestRun({ race: 'elf', level: 1 });
    gainXp(s, 5);
    expect(s.hero.xp).toBe(5);
    expect(s.events).toEqual([{ type: 'xp', amount: 5 }]);
  });

  it('a level-up recomputes stats, heals to full, logs once, and emits levelUp', () => {
    const s = makeTestRun({ race: 'human', level: 3, hero: { xp: 290, hp: 5 } });
    const maxBefore = s.hero.maxHp;
    gainXp(s, 10);
    expect([s.hero.xp, s.hero.level]).toEqual([301, 4]);
    expect(s.hero.maxHp).toBe(maxBefore + 6);
    expect(s.hero.hp).toBe(s.hero.maxHp);
    expect(s.log).toEqual(['Level up! You are now level 4. HP fully restored.']);
    expect(s.events).toEqual([
      { type: 'xp', amount: 11 },
      { type: 'levelUp', level: 4 },
    ]);
  });

  it('two thresholds in one gain: one log line and one levelUp event at the new level', () => {
    const s = makeTestRun({ race: 'orc', level: 1 });
    gainXp(s, 200);
    expect(s.hero.level).toBe(3);
    expect(s.log).toEqual(['Level up! You are now level 3. HP fully restored.']);
    expect(s.events).toEqual([
      { type: 'xp', amount: 200 },
      { type: 'levelUp', level: 3 },
    ]);
  });

  it('no level change below the next threshold', () => {
    const s = makeTestRun({ race: 'elf', level: 3, hero: { xp: 150, hp: 5 } });
    gainXp(s, 100);
    expect([s.hero.level, s.hero.hp, s.log]).toEqual([3, 5, []]);
  });
});

const tileOf = (s: RunState, kind: DayTile['kind'], size?: 1 | 2) =>
  findTile(s, (t) => t.kind === kind && (size === undefined || t.size === size));

describe('FR-PRO-1: wisps', () => {
  it('resolves, counts, logs, emits wisp, and gains 5 XP', () => {
    const s = makeTestRun({ race: 'elf', level: 1 });
    const t = tileOf(s, 'wisp');
    t.day = { ...t.day, count: 3 };
    collectWisp(s, t);
    expect([t.resolved, s.stats.wisps, s.hero.xp]).toEqual([true, 1, 5]);
    expect(s.log).toEqual([`A soul wisp from ${short(t.day.date)} (3 contributions): +5 XP.`]);
    expect(s.events).toEqual([
      { type: 'wisp', col: t.col, row: t.row, xp: 5 },
      { type: 'xp', amount: 5 },
    ]);
  });

  it('says "contribution" for a count of 1', () => {
    const s = makeTestRun();
    const t = tileOf(s, 'wisp');
    t.day = { ...t.day, count: 1 };
    collectWisp(s, t);
    expect(s.log[0]).toBe(`A soul wisp from ${short(t.day.date)} (1 contribution): +5 XP.`);
  });
});

describe('FR-PRO-1: chests', () => {
  it('size 1: +6 treasure, heals ceil(maxHp × 0.3), logs the HP, +10 XP', () => {
    const s = makeTestRun({ race: 'elf', level: 2, hero: { hp: 10 } });
    const t = tileOf(s, 'chest', 1);
    const heal = Math.ceil(s.hero.maxHp * 0.3);
    openChest(s, t);
    expect([t.resolved, s.stats.chests, s.hero.treasure, s.hero.hp, s.hero.xp]).toEqual([true, 1, 6, 10 + heal, 60]);
    expect(s.log).toEqual([`A chest from ${short(t.day.date)}: +6 treasure, +${heal} HP, +10 XP.`]);
    expect(s.events).toEqual([
      { type: 'chest', col: t.col, row: t.row, gold: 6, healed: heal },
      { type: 'xp', amount: 10 },
    ]);
  });

  it('size 2: +12 treasure; at full HP the log has no HP part and healed is 0', () => {
    const s = makeTestRun({ race: 'elf' });
    const t = tileOf(s, 'chest', 2);
    openChest(s, t);
    expect(s.hero.treasure).toBe(12);
    expect(s.log).toEqual([`A chest from ${short(t.day.date)}: +12 treasure, +10 XP.`]);
    expect(s.events[0]).toEqual({ type: 'chest', col: t.col, row: t.row, gold: 12, healed: 0 });
  });

  it('the heal is clamped to max HP', () => {
    const s = makeTestRun({ race: 'elf' });
    s.hero.hp = s.hero.maxHp - 2;
    openChest(s, tileOf(s, 'chest'));
    expect(s.hero.hp).toBe(s.hero.maxHp);
    expect(s.events[0]).toMatchObject({ healed: 2 });
  });

  it('heals before XP: a level-up from the chest still ends at full HP, logged after the chest line', () => {
    const s = makeTestRun({ race: 'elf', level: 3, hero: { xp: 295, hp: 3 } });
    const t = tileOf(s, 'chest');
    openChest(s, t);
    expect(s.hero.level).toBe(4);
    expect(s.hero.hp).toBe(s.hero.maxHp);
    expect(s.log[1]).toBe('Level up! You are now level 4. HP fully restored.');
    expect(s.events.map((e) => e.type)).toEqual(['chest', 'xp', 'levelUp']);
  });
});

describe('step: moving onto wisps and chests', () => {
  const DIRS: [Dir, number, number][] = [
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ];

  /** Places the hero next to `t` on a plain tile and returns the move onto it. */
  function nextTo(s: RunState, t: DayTile): Dir {
    const from = neighbours(s.map, t).find((n) => n.kind === 'fog' || n.kind === 'wisp' || n.kind === 'start');
    if (!from) throw new Error('No plain neighbour.');
    s.pos = { col: from.col, row: from.row };
    const d = DIRS.find(([, dc, dr]) => from.col + dc === t.col && from.row + dr === t.row);
    return (d as [Dir, number, number])[0];
  }

  it('a wisp is collected once', () => {
    const s0 = makeTestRun({ race: 'elf', level: 1 });
    const t = tileOf(s0, 'wisp');
    const dir = nextTo(s0, t);
    const s = step(s0, { type: 'move', dir });
    expect([s.stats.wisps, s.hero.xp, s.status]).toEqual([1, 5, 'exploring']);
    expect(s.events.map((e) => e.type)).toEqual(['wisp', 'xp']);
    const back = step(step(s, { type: 'move', dir: opposite(dir) }), { type: 'move', dir });
    expect([back.stats.wisps, back.hero.xp]).toEqual([1, 5]);
  });

  it('a chest is opened once', () => {
    const s0 = makeTestRun({ race: 'elf', level: 1 });
    const t = tileOf(s0, 'chest');
    const s = step(s0, { type: 'move', dir: nextTo(s0, t) });
    expect([s.stats.chests, s.hero.xp]).toEqual([1, 10]);
    expect(s.events.map((e) => e.type)).toEqual(['chest', 'xp']);
  });
});

const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const opposite = (d: Dir) => OPP[d];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (date: string) => {
  const d = new Date(date + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
