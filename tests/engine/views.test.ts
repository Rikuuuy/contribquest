import { describe, expect, it } from 'vitest';
import type { ContributionSet } from '../../src/data/schema';
import { newRun, type RunSettings } from '../../src/engine/run';
import type { RunState } from '../../src/engine/state';
import { resultsView, summaryView } from '../../src/engine/views';
import { demoSet } from '../fixtures/run';

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
      title: 'The Gate opens. Your graph is exorcised.',
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
