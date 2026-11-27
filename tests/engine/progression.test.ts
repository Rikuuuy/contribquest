import { describe, expect, it } from 'vitest';
import { auraTier, collectWisp, gainXp, levelFor, openChest, restDay, startingXp, xpForLevel } from '../../src/engine/progression';
import { makeHero as buildHero } from '../../src/engine/run';
import { step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { nextOptions } from '../../src/mapgen/routes';
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
      { type: 'wisp', col: t.col, row: t.row, xp: 5, healed: 0 },
      { type: 'xp', amount: 5 },
    ]);
  });

  it('v1.6: heals ceil(maxHp × 0.1) before the XP, clamped to max HP, and logs the HP', () => {
    const s = makeTestRun({ race: 'elf', level: 1, hero: { hp: 10 } });
    const t = tileOf(s, 'wisp');
    t.day = { ...t.day, count: 3 };
    const heal = Math.ceil(s.hero.maxHp * 0.1);
    collectWisp(s, t);
    expect(s.hero.hp).toBe(10 + heal);
    expect(s.log).toEqual([`A soul wisp from ${short(t.day.date)} (3 contributions): +5 XP, +${heal} HP.`]);
    expect(s.events[0]).toEqual({ type: 'wisp', col: t.col, row: t.row, xp: 5, healed: heal });
    const c = makeTestRun({ race: 'elf' });
    c.hero.hp = c.hero.maxHp - 1;
    collectWisp(c, tileOf(c, 'wisp'));
    expect(c.hero.hp).toBe(c.hero.maxHp);
    expect(c.events[0]).toMatchObject({ healed: 1 });
  });

  it('v1.6: a level-up from the wisp XP still ends at full HP', () => {
    const s = makeTestRun({ race: 'elf', level: 3, hero: { xp: 298, hp: 3 } });
    collectWisp(s, tileOf(s, 'wisp'));
    expect([s.hero.level, s.hero.hp]).toEqual([4, s.hero.maxHp]);
    expect(s.events.map((e) => e.type)).toEqual(['wisp', 'xp', 'levelUp']);
  });

  it('says "contribution" for a count of 1', () => {
    const s = makeTestRun();
    const t = tileOf(s, 'wisp');
    t.day = { ...t.day, count: 1 };
    collectWisp(s, t);
    expect(s.log[0]).toBe(`A soul wisp from ${short(t.day.date)} (1 contribution): +5 XP.`);
  });
});

describe('v1.6 FR-PRO-1, FR-MOV-3: quiet days (restDay)', () => {
  it('resolves the fog tile, heals ceil(maxHp × 0.05), logs it, emits rest, no XP and no RNG draw', () => {
    const s = makeTestRun({ race: 'elf', level: 2, hero: { hp: 10 } });
    const t = tileOf(s, 'fog');
    const heal = Math.ceil(s.hero.maxHp * 0.05);
    const { rng, hero } = s;
    const xp = hero.xp;
    restDay(s, t);
    expect([t.resolved, s.hero.hp, s.hero.xp, s.rng]).toEqual([true, 10 + heal, xp, rng]);
    expect(s.log).toEqual([`A quiet day (${short(t.day.date)}). You catch your breath: +${heal} HP.`]);
    expect(s.events).toEqual([{ type: 'rest', col: t.col, row: t.row, healed: heal }]);
  });

  it('at full HP: "Nothing stirs." and healed 0; near max the heal is clamped', () => {
    const s = makeTestRun({ race: 'elf' });
    const t = tileOf(s, 'fog');
    restDay(s, t);
    expect(s.log).toEqual([`A quiet day (${short(t.day.date)}). Nothing stirs.`]);
    expect(s.events).toEqual([{ type: 'rest', col: t.col, row: t.row, healed: 0 }]);
    const c = makeTestRun({ race: 'elf' });
    c.hero.hp = c.hero.maxHp - 1;
    restDay(c, tileOf(c, 'fog'));
    expect(c.hero.hp).toBe(c.hero.maxHp);
    expect(c.events[0]).toMatchObject({ healed: 1 });
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
      { type: 'relicOffer', ids: s.relicOffer, title: 'The chest holds a relic. Choose one.' },
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
    expect(s.events.map((e) => e.type)).toEqual(['chest', 'xp', 'levelUp', 'relicOffer']);
  });
});

describe('step: moving onto wisps and chests', () => {
  const fromOf = (s: RunState, t: DayTile) =>
    s.map.tiles.find((p) => p.col === t.col - 1 && nextOptions(s.map, p).some((o) => o.col === t.col && o.row === t.row));
  /** An unresolved tile of `kind` that some tile in the previous column can move onto. */
  const target = (s: RunState, kind: DayTile['kind']) => findTile(s, (x) => x.kind === kind && !!fromOf(s, x));

  /** Places the hero on a tile in the previous column from which `t` is a legal move. */
  function moveOnto(s: RunState, t: DayTile): Action {
    const from = fromOf(s, t);
    if (!from) throw new Error('No tile before the target.');
    s.pos = { col: from.col, row: from.row };
    return { type: 'move', to: { col: t.col, row: t.row } };
  }

  it('a wisp is collected once', () => {
    const s0 = makeTestRun({ race: 'elf', level: 1 });
    const t = target(s0, 'wisp');
    const s = step(s0, moveOnto(s0, t));
    expect([s.stats.wisps, s.hero.xp, s.status]).toEqual([1, 5, 'exploring']);
    expect(s.events.map((e) => e.type)).toEqual(['moved', 'wisp', 'xp']);
    const again = structuredClone(s);
    const back = step(again, moveOnto(again, t));
    expect([back.stats.wisps, back.hero.xp]).toEqual([1, 5]);
  });

  it('a chest is opened once', () => {
    const s0 = makeTestRun({ race: 'elf', level: 1 });
    const t = target(s0, 'chest');
    const s = step(s0, moveOnto(s0, t));
    expect([s.stats.chests, s.hero.xp, s.status]).toEqual([1, 10, 'relic']);
    expect(s.events.map((e) => e.type)).toEqual(['moved', 'chest', 'xp', 'relicOffer']);
  });
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (date: string) => {
  const d = new Date(date + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
