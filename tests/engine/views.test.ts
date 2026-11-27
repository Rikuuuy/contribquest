import { describe, expect, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { newRun, type RunSettings } from '../../src/engine/run';
import type { RunState } from '../../src/engine/state';
import { resultsView, summaryView } from '../../src/engine/views';
import { demoSet } from '../fixtures/run';
import { makeSet, windowDays } from '../fixtures/sets';

const SETTINGS: RunSettings = { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false };

function run(set: ContributionSet, settings: RunSettings = SETTINGS): RunState {
  const r = newRun(set, null, settings);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('FR-IMP-4: summaryView on the demo run', () => {
  it('gives the prototype showSummary strings', () => {
    const v = summaryView(run(demoSet()));
    expect(v).toEqual({
      title: 'The graph of demo-necromancer',
      range: 'Tue 18 Aug 2026 to Mon 16 Nov 2026 · demo data',
      identity: 'HUMAN WANDERER',
      aura: 'STREAK AURA · TIER 2',
      avatarUrl: null,
      stats: [
        { k: 'Contributions, last 91 days', v: '366', sub: 'gives 287 starting XP' },
        { k: 'Starting level', v: '3', sub: 'of 10' },
        { k: 'Current streak', v: '15 days', sub: 'aura: +2 ATK, +10 HP' },
        { k: 'Hero', v: '52 HP', sub: '11 ATK' },
        { k: 'Your best day (the boss)', v: '31', sub: 'Tue 3 Nov 2026' },
        { k: 'Year total', v: '1287', sub: 'contributions' },
      ],
      trait: { name: 'Tuesday Slayer', text: 'Tuesday is your busiest day: +2 ATK when fighting in the Tuesday row.' },
      omen: {
        kind: 'blessed',
        k: "Today's tile (Mon 16 Nov 2026)",
        v: 'Commit Blessing',
        text: '10 contributions today. You start the run with a free relic.',
      },
      quiet: null,
      xpTable: [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250].map((xp, i) => ({ level: i + 1, xp, current: i === 2 })),
    });
  });

  it('the identity follows the chosen race and class', () => {
    expect(summaryView(run(demoSet(), { ...SETTINGS, heroClass: 'rogue', heroRace: 'skeleton' })).identity).toBe('SKELETON ROGUE');
  });
});

describe('FR-PRO-4: resultsView on the demo run', () => {
  it('a won run', () => {
    const s = run(demoSet());
    s.status = 'won';
    expect(resultsView(s)).toEqual({
      won: true,
      title: 'The Phantom is banished. Your graph is exorcised.',
      sub: 'demo-necromancer survived 91 haunted days.',
      game: [
        ['Class', 'Wanderer'],
        ['Final level', '3'],
        ['XP', '287'],
        ['Monsters banished', '0'],
        ['Critical hits', '0'],
        ['Perfect dodges', '0'],
        ['Chests opened', '0'],
        ['Relics', 'None'],
        ['Treasure', '0'],
        ['Steps', '0'],
      ],
      ghTitle: 'ON GITHUB',
      gh: [
        ['Contributions (91 days)', '366'],
        ['Active days', '58 of 91'],
        ['Current streak', '15 days'],
        ['Best day', '31 on 3 Nov'],
        ['Year total', '1287'],
      ],
      today: "Today's tile is already glowing (10 contributions). Tomorrow your graph grows by one more day.",
    });
  });

  it('a lost run names the killer', () => {
    const s = run(demoSet());
    s.status = 'lost';
    s.killer = 'Merge Conflict Lich';
    const v = resultsView(s);
    expect([v.won, v.title, v.sub]).toEqual([
      false,
      'You became part of the graph.',
      'Slain by Merge Conflict Lich. The same map is waiting for a rematch.',
    ]);
  });
});

/** One active day (index 40, 5 contributions), nothing today, no streak: cursed, aura 0, and a quiet map. */
const quietSet = (): ContributionSet => makeSet(windowDays((i) => ({ count: i === 40 ? 5 : 0 })));

describe('FR-OMEN-3: a cursed, aura-0, quiet run', () => {
  it('summary: curse box, no aura, quiet line, level 1 marked', () => {
    const s = run(quietSet());
    const v = summaryView(s);
    expect(s.map.quiet).toBe(true);
    expect(v.range).toBe('Tue 18 Aug 2026 to Mon 16 Nov 2026 · live data');
    expect(v.aura).toBe('NO AURA YET');
    expect(v.avatarUrl).toBe('https://github.com/octo-cat.png?size=24');
    expect(v.stats).toEqual([
      { k: 'Contributions, last 91 days', v: '5', sub: 'gives 34 starting XP' },
      { k: 'Starting level', v: '1', sub: 'of 10' },
      { k: 'Current streak', v: '0 days', sub: 'reach 7 days for an aura' },
      { k: 'Hero', v: `${s.hero.maxHp} HP`, sub: `${s.hero.atk} ATK` },
      { k: 'Your best day (the boss)', v: '5', sub: 'Sun 27 Sep 2026' },
      { k: 'Year total', v: '5', sub: 'contributions' },
    ]);
    expect(v.omen).toEqual({
      kind: 'cursed',
      k: "Today's tile (Mon 16 Nov 2026)",
      v: 'Uncommitted Curse',
      text: 'No contributions yet today, so monsters hit 15% harder. Commit something, then come back for the blessing.',
    });
    expect(v.quiet).toBe('A quiet graph. Few spirits stir here, so some lost ghosts have risen from your empty days.');
    expect(v.xpTable.filter((r) => r.current)).toEqual([{ level: 1, xp: 0, current: true }]);
  });

  it('results: the dark today line and one active day', () => {
    const s = run(quietSet());
    s.status = 'lost';
    s.killer = 'Lost Ghost';
    const v = resultsView(s);
    expect(v.today).toBe("Today's tile is still dark. Commit something and come back tomorrow: your map will be different.");
    expect(v.gh).toEqual([
      ['Contributions (91 days)', '5'],
      ['Active days', '1 of 91'],
      ['Current streak', '0 days'],
      ['Best day', '5 on 27 Sep'],
      ['Year total', '5'],
    ]);
    expect(v.sub).toBe('Slain by Lost Ghost. The same map is waiting for a rematch.');
  });
});

describe('FR-PRO-4: singular wording, ties, sources, and run progress', () => {
  it('one contribution today and a one-day streak', () => {
    const set = { ...makeSet(windowDays((i) => ({ count: i === 90 || i === 10 ? 1 : 0 }))), streak: 1 };
    const s = run(set);
    expect(summaryView(s).omen.text).toBe('1 contribution today. You start the run with a free relic.');
    expect(summaryView(s).stats[2]?.v).toBe('1 day');
    expect(resultsView(s).today).toBe("Today's tile is already glowing (1 contribution). Tomorrow your graph grows by one more day.");
    // The prototype's results row never uses the singular.
    expect(resultsView(s).gh[2]).toEqual(['Current streak', '1 days']);
  });

  it('the best day is the latest day with the highest count', () => {
    const s = run(makeSet(windowDays((i) => ({ count: i === 20 || i === 60 ? 9 : i % 3 }))));
    expect(summaryView(s).stats[4]).toEqual({ k: 'Your best day (the boss)', v: '9', sub: 'Sat 17 Oct 2026' });
    expect(resultsView(s).gh[3]).toEqual(['Best day', '9 on 17 Oct']);
  });

  it('cached data is labelled', () => {
    const s = run({ ...demoSet(), source: 'cache', username: 'Octo-Cat' });
    expect(summaryView(s).range).toBe('Tue 18 Aug 2026 to Mon 16 Nov 2026 · cached data');
    expect(summaryView(s).avatarUrl).toBe('https://github.com/Octo-Cat.png?size=24');
  });

  it('results list relics by name and the run counters', () => {
    const s = run(demoSet(), { ...SETTINGS, heroClass: 'mage' });
    s.status = 'won';
    Object.assign(s.hero, { relics: ['duck', 'coffee', 'review'], level: 5, xp: 612, treasure: 87 });
    Object.assign(s.stats, { defeated: 8, crits: 4, dodges: 11, chests: 2, steps: 23 });
    expect(resultsView(s).game).toEqual([
      ['Class', 'Mage'],
      ['Final level', '5'],
      ['XP', '612'],
      ['Monsters banished', '8'],
      ['Critical hits', '4'],
      ['Perfect dodges', '11'],
      ['Chests opened', '2'],
      ['Relics', 'Rubber Duck, Cold Brew, Code Review'],
      ['Treasure', '87'],
      ['Steps', '23'],
    ]);
    expect(summaryView(s).xpTable.find((r) => r.current)?.level).toBe(5);
  });
});
