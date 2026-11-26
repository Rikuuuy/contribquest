import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/data/schema';
import { CLASS_INFO, applyStats, chooseClass, fightHint, heroClass } from '../../src/engine/classes';
import { step } from '../../src/engine/step';
import { makeHero, makeTestRun } from '../fixtures/run';

const CLASSES: ClassId[] = ['wanderer', 'knight', 'rogue', 'mage'];

describe('FR-CLS-2: class lookup', () => {
  it('uses the prototype modes and modifiers', () => {
    expect(CLASSES.map((c) => [CLASS_INFO[c].name, CLASS_INFO[c].strike, CLASS_INFO[c].guard, CLASS_INFO[c].hp, CLASS_INFO[c].atk, CLASS_INFO[c].slow])).toEqual([
      ['Wanderer', 'bar', 'ring', 1, 0, 1],
      ['Knight', 'bar', 'shield', 1.25, -1, 1.15],
      ['Rogue', 'combo', 'sidestep', 0.9, 0, 1],
      ['Mage', 'charge', 'ring', 0.9, 2, 1],
    ]);
  });

  it('FR-CLS-1: an unknown class falls back to Wanderer', () => {
    expect(heroClass({ cls: 'paladin' as ClassId }).name).toBe('Wanderer');
    expect(heroClass({ cls: 'mage' }).name).toBe('Mage');
  });
});

describe('FR-CLS-2: applyStats', () => {
  const stats = (o: Parameters<typeof makeHero>[0]) => {
    const h = makeHero(o);
    return [h.maxHp, h.atk];
  };

  it('level 3, aura 0, per class', () => {
    expect(CLASSES.map((cls) => stats({ cls, level: 3 }))).toEqual([
      [42, 9],
      [53, 8],
      [38, 9],
      [38, 11],
    ]);
  });

  it('level and aura: the demo hero (level 3, aura 2) is 52 HP, 11 ATK', () => {
    expect(stats({ level: 3, aura: 2 })).toEqual([52, 11]);
    expect(stats({ level: 1, aura: 4 })).toEqual([50, 9]);
  });

  it('Cold Brew adds 10 max HP before class scaling', () => {
    expect(CLASSES.map((cls) => stats({ cls, level: 3, relics: ['coffee'] }))).toEqual([
      [52, 9],
      [65, 8],
      [47, 9],
      [47, 11],
    ]);
  });

  it('Stack Overflow +3 ATK, Orc +2 ATK, both stack', () => {
    expect(stats({ relics: ['stack'] })).toEqual([42, 12]);
    expect(stats({ race: 'orc' })).toEqual([42, 11]);
    expect(stats({ race: 'orc', relics: ['stack'], cls: 'mage' })).toEqual([38, 16]);
  });

  it('the trait HP counts before class scaling', () => {
    expect(stats({ cls: 'knight', trait: { name: 'Blank Slate', text: '', rows: [], hp: 5 } })).toEqual([59, 8]);
  });

  it('clamps HP to max HP and never heals', () => {
    const h = makeHero({ cls: 'knight' });
    expect(h.hp).toBe(53);
    h.cls = 'rogue';
    applyStats(h);
    expect([h.maxHp, h.hp]).toEqual([38, 38]);
    h.hp = 10;
    h.cls = 'knight';
    applyStats(h);
    expect([h.maxHp, h.hp]).toEqual([53, 10]);
  });
});

describe('FR-CLS-1: choosing a class', () => {
  it('before the first step: sets it, recomputes stats, heals to full', () => {
    const s = makeTestRun({ hero: { hp: 5 } });
    expect(chooseClass(s, 'knight')).toBe(true);
    expect([s.hero.cls, s.hero.maxHp, s.hero.atk, s.hero.hp]).toEqual(['knight', 53, 8, 53]);
  });

  it('refused after a step, through step() as well', () => {
    const s = makeTestRun();
    s.stats.steps = 1;
    expect(chooseClass(s, 'mage')).toBe(false);
    expect(s.hero.cls).toBe('wanderer');
    const next = step(s, { type: 'chooseClass', cls: 'mage' });
    expect(next.hero.cls).toBe('wanderer');
    expect(step(makeTestRun(), { type: 'chooseClass', cls: 'mage' }).hero.cls).toBe('mage');
  });
});

describe('FR-CLS-9: hints', () => {
  it('uses the prototype CLASS_HINT text', () => {
    expect(CLASSES.map((c) => CLASS_INFO[c].hint)).toEqual([
      'Attack, then press Space as the marker crosses the gold.',
      'Attack on the gold. When it strikes, hold Space to block, or tap right at impact to parry.',
      'Attack, then press Space on each of the three gold marks.',
      'Attack, then hold Space and release when the charge reaches the gold.',
    ]);
  });

  it('builds the pre-fight hint line (requirement 3.5)', () => {
    expect(fightHint(3, 7, 'rogue')).toBe('Level 3 day. It hits for about 7. Attack, then press Space on each of the three gold marks.');
  });
});
