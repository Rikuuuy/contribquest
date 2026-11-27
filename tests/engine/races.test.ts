import { describe, expect, it } from 'vitest';
import { gainXp } from '../../src/engine/progression';
import { RACE_INFO, RACE_NAMES, chooseRace } from '../../src/engine/races';
import { step } from '../../src/engine/step';
import type { RaceId } from '../../src/data/schema';
import { makeTestRun } from '../fixtures/run';

const IDS: RaceId[] = ['human', 'elf', 'orc', 'skeleton', 'vampire'];

describe('FR-RACE-1, FR-RACE-2, FR-RACE-4: RACE_INFO', () => {
  it('has the five races in the prototype order with their names and texts', () => {
    expect(Object.keys(RACE_INFO)).toEqual(IDS);
    expect(IDS.map((id) => [RACE_INFO[id].name, RACE_INFO[id].text])).toEqual([
      ['Human', 'Adaptable: +10% XP from everything.'],
      ['Elf', 'Keen Eyes: the Perfect timing window is 15 ms wider.'],
      ['Orc', 'Brute: +2 ATK.'],
      ['Skeleton', 'Undying: once per run, a lethal hit leaves you at 1 HP.'],
      ['Vampire', 'Bloodthirst: every critical hit heals 2 HP.'],
    ]);
    expect(IDS.map((id) => RACE_NAMES[id])).toEqual(['Human', 'Elf', 'Orc', 'Skeleton', 'Vampire']);
  });

  it('has each race’s two speech lines', () => {
    expect(IDS.map((id) => RACE_INFO[id].lines)).toEqual([
      ['Coffee first, then commits.', 'Just one more feature.'],
      ['I can see your off-by-one from here.', 'Tabs. Always tabs.'],
      ['SMASH THE BUGS!', 'Me no read docs.'],
      ['I came back for the bugs.', 'Legacy code? I AM legacy.'],
      ['I only code after midnight.', 'Your commits look... delicious.'],
    ]);
  });

  it('has the prototype face colours and flags', () => {
    const face = (id: RaceId) => {
      const { name: _n, text: _t, lines: _l, ...rest } = RACE_INFO[id];
      return rest;
    };
    expect(face('human')).toEqual({ skin: ['#f2c79b', '#d6a274'], eye: '#1a1a24', mouth: '#9a5a48' });
    expect(face('elf')).toEqual({ skin: ['#f7e0c4', '#dcbc98'], eye: '#2fa86b', mouth: '#a8685a', ears: true });
    expect(face('orc')).toEqual({
      skin: ['#7fae5a', '#5c8a3e'],
      eye: '#ffcf3a',
      mouth: '#3d5a28',
      tusks: true,
      glow: 'rgba(255,207,58,A)',
    });
    expect(face('skeleton')).toEqual({
      skin: ['#ebe6d6', '#b9b3a0'],
      eye: '#ff6a2a',
      mouth: '#2a2420',
      teeth: true,
      glow: 'rgba(255,106,42,A)',
    });
    expect(face('vampire')).toEqual({
      skin: ['#e6e1f0', '#c2b9d6'],
      eye: '#e0263c',
      mouth: '#5a1020',
      fangs: true,
      glow: 'rgba(224,38,60,A)',
    });
  });
});

describe('FR-RACE-1: chooseRace', () => {
  it('sets the race, recomputes stats, heals to full, and emits raceChosen', () => {
    const s0 = makeTestRun({ race: 'human', hero: { hp: 3 } });
    const atk = s0.hero.atk;
    const s = step(s0, { type: 'chooseRace', race: 'orc' });
    expect([s.hero.race, s.hero.atk, s.hero.hp]).toEqual(['orc', atk + 2, s.hero.maxHp]);
    expect(s.events).toEqual([{ type: 'raceChosen', race: 'orc' }]);
  });

  it('Orc +2 ATK is removed again when another race is chosen', () => {
    const s0 = makeTestRun({ race: 'orc' });
    const s = step(s0, { type: 'chooseRace', race: 'elf' });
    expect(s.hero.atk).toBe(s0.hero.atk - 2);
  });

  it('is refused after the first step', () => {
    const s0 = makeTestRun({ race: 'human', hero: { hp: 3 } });
    s0.stats.steps = 1;
    const s = step(s0, { type: 'chooseRace', race: 'vampire' });
    expect({ ...s, events: [] }).toEqual(s0);
    expect(s.events).toEqual([]);
    expect(chooseRace(structuredClone(s0), 'vampire')).toBe(false);
  });

  it('refuses an unknown race id', () => {
    const s0 = makeTestRun();
    expect(chooseRace(s0, 'goblin' as RaceId)).toBe(false);
    expect(s0.hero.race).toBe('human');
  });
});

describe('FR-RACE-2: Human +10% XP', () => {
  it('Human gains round(amount × 1.1); other races gain the amount', () => {
    const human = makeTestRun({ race: 'human', level: 1 });
    const elf = makeTestRun({ race: 'elf', level: 1 });
    gainXp(human, 15);
    gainXp(elf, 15);
    expect([human.hero.xp, elf.hero.xp]).toEqual([17, 15]);
  });
});
