import { describe, expect, it } from 'vitest';
import { classDiff, xpForLevel } from '../../src/engine';
import { bossLine, hudView } from '../../src/render/hud';
import { makeTestRun } from '../fixtures/run';

describe('requirement 3.1: hudView', () => {
  it('shows the hero, class, level, HP, XP, ATK, and treasure of the demo run', () => {
    const s = makeTestRun({ cls: 'knight', level: 3 });
    const v = hudView(s);
    expect(v.name).toBe('tester');
    expect(v.cls).toBe('KNIGHT');
    expect(v.stars).toBe(classDiff('knight').stars);
    expect(v.level).toBe(3);
    expect([v.hp, v.maxHp]).toEqual([s.hero.maxHp, s.hero.maxHp]);
    expect(v.next).toBe(xpForLevel(4));
    expect(v.xpPct).toBeCloseTo(((s.hero.xp - xpForLevel(3)) / (xpForLevel(4) - xpForLevel(3))) * 100, 6);
    expect(v.atk).toBe(s.hero.atk);
    expect(v.treasure).toBe(0);
    expect(v.relics).toEqual([]);
  });

  it('has no next XP at level 10', () => {
    const v = hudView(makeTestRun({ level: 10 }));
    expect(v.next).toBeNull();
    expect(v.xpPct).toBe(100);
  });

  it('lists relics with their name and text', () => {
    const v = hudView(makeTestRun({ relics: ['review'] }));
    expect(v.relics).toHaveLength(1);
    expect(v.relics[0]).toMatchObject({ id: 'review', name: expect.any(String), text: expect.any(String) });
  });

  it('reports shards as { have, max: 3 }', () => {
    const s = makeTestRun();
    s.shards = 2;
    expect(hudView(s).shards).toEqual({ have: 2, max: 3 });
  });

  it('labels the week, and "Boss" on the boss node', () => {
    const s = makeTestRun();
    expect(hudView(s).week).toBe('Week 1/14');
    s.pos = { col: 6, row: 3 };
    expect(hudView(s).week).toBe('Week 7/14');
    s.pos = { ...s.map.bossNode };
    expect(hudView(s).week).toBe('Boss');
  });

  it('writes the four boss lines', () => {
    const s = makeTestRun();
    expect(bossLine(s)).toBe('The Phantom of 3 Nov waits after the last week');
    s.shards = 1;
    expect(hudView(s).boss).toBe('The Phantom of 3 Nov: 10% weaker');
    s.shards = 2;
    expect(hudView(s).boss).toBe('The Phantom of 3 Nov: 20% weaker');
    s.shards = 3;
    expect(hudView(s).boss).toBe('The Phantom of 3 Nov is bound: no Phase 2');
    s.bossDown = true;
    expect(hudView(s).boss).toBe('Phantom banished');
    expect(hudView(s).banished).toBe(true);
    for (const n of [0, 1, 2, 3]) {
      s.shards = n;
      s.bossDown = false;
      expect(hudView(s).boss).not.toMatch(/gate|warded|exposed/i);
    }
  });

  it('marks the timing as maxed at the class floor', () => {
    expect(hudView(makeTestRun()).timing.maxed).toBe(false);
    const v = hudView(makeTestRun({ defeated: 200 }));
    expect(v.timing.maxed).toBe(true);
    expect(v.timing.pct).toBe(Math.round(classDiff('wanderer').floor * classDiff('wanderer').pMul * 100));
  });
});

describe('requirement 3.3: low HP', () => {
  const at = (hp: number, status: 'exploring' | 'combat' | 'relic' | 'lost' = 'exploring') => {
    const s = makeTestRun({ hero: { maxHp: 100, hp } });
    s.status = status;
    return hudView(s).lowHp;
  };

  it('is on at 29% and off at 30%', () => {
    expect(at(29)).toBe(true);
    expect(at(30)).toBe(false);
  });

  it('is on in combat, off at 0 HP and outside exploring and combat', () => {
    expect(at(10, 'combat')).toBe(true);
    expect(at(0)).toBe(false);
    expect(at(10, 'relic')).toBe(false);
    expect(at(10, 'lost')).toBe(false);
  });
});
