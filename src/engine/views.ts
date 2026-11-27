// Plain data for the summary and results screens (prototype showSummary, showEnd). No DOM.
// Normal runs only: the social spec adds the raid branches.
import type { ContributionDay, ContributionSet } from '../data/schema';
import { fmtDate, fmtShort } from '../mapgen';
import { MAX_LEVEL } from './balance';
import { heroClass } from './classes';
import { startingXp, xpForLevel } from './progression';
import { RACE_NAMES } from './races';
import { relicById } from './relics';
import type { ResultsView, RunState, SummaryView } from './state';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The latest day with the highest count (the boss's day). */
function bestDay(days: readonly ContributionDay[]): ContributionDay {
  return days.reduce((b, x) => (x.count >= b.count ? x : b), days[0] as ContributionDay);
}

/** Today's tile: the last day of the hero set. */
function todayOf(s: RunState): ContributionDay {
  const hs: ContributionSet = s.heroSet ?? s.set;
  return hs.days[hs.days.length - 1] as ContributionDay;
}

const SOURCE_LABEL = { demo: 'demo data', cache: 'cached data', live: 'live data' } as const;

export function summaryView(s: RunState): SummaryView {
  const set = s.set;
  const hs = s.heroSet ?? set;
  const h = s.hero;
  const d = set.days;
  const best = bestDay(d);
  const today = todayOf(s);
  const blessed = h.omen === 'blessed';
  return {
    title: `The graph of ${set.username}`,
    range: `${fmtDate((d[0] as ContributionDay).date)} to ${fmtDate((d[d.length - 1] as ContributionDay).date)} · ${SOURCE_LABEL[set.source]}`,
    identity: `${RACE_NAMES[h.race].toUpperCase()} ${heroClass(h).name.toUpperCase()}`,
    aura: h.aura ? `STREAK AURA · TIER ${h.aura}` : 'NO AURA YET',
    avatarUrl: hs.source === 'demo' ? null : `https://github.com/${encodeURIComponent(hs.username)}.png?size=24`,
    stats: [
      { k: 'Contributions, last 91 days', v: String(h.total91), sub: `gives ${startingXp(h.total91)} starting XP` },
      { k: 'Starting level', v: String(h.level), sub: `of ${MAX_LEVEL}` },
      {
        k: 'Current streak',
        v: plural(hs.streak, 'day'),
        sub: h.aura ? `aura: +${h.aura} ATK, +${5 * h.aura} HP` : 'reach 7 days for an aura',
      },
      { k: 'Hero', v: `${h.maxHp} HP`, sub: `${h.atk} ATK` },
      { k: 'Your best day (the boss)', v: String(best.count), sub: fmtDate(best.date) },
      { k: 'Year total', v: String(set.yearTotal), sub: 'contributions' },
    ],
    trait: { name: h.trait.name, text: h.trait.text },
    omen: {
      kind: h.omen,
      k: `Today's tile (${fmtDate(today.date)})`,
      v: blessed ? 'Commit Blessing' : 'Uncommitted Curse',
      text: blessed
        ? `${plural(today.count, 'contribution')} today. You start the run with a free relic.`
        : 'No contributions yet today, so monsters hit 15% harder. Commit something, then come back for the blessing.',
    },
    quiet: s.map.quiet ? 'A quiet graph. Few spirits stir here, so some lost ghosts have risen from your empty days.' : null,
    xpTable: Array.from({ length: MAX_LEVEL }, (_, i) => ({ level: i + 1, xp: xpForLevel(i + 1), current: i + 1 === h.level })),
  };
}

export function resultsView(s: RunState): ResultsView {
  const set = s.set;
  const h = s.hero;
  const d = set.days;
  const won = s.status === 'won';
  const best = bestDay(d);
  const today = todayOf(s);
  const st = s.stats;
  return {
    won,
    title: won ? 'The Phantom is banished. Your graph is exorcised.' : 'You became part of the graph.',
    sub: won ? `${set.username} survived 91 haunted days.` : `Slain by ${s.killer}. The same map is waiting for a rematch.`,
    game: [
      ['Class', heroClass(h).name],
      ['Final level', String(h.level)],
      ['XP', String(h.xp)],
      ['Monsters banished', String(st.defeated)],
      ['Critical hits', String(st.crits)],
      ['Perfect dodges', String(st.dodges)],
      ['Chests opened', String(st.chests)],
      ['Relics', h.relics.map((id) => relicById(id).name).join(', ') || 'None'],
      ['Treasure', String(h.treasure)],
      ['Steps', String(st.steps)],
    ],
    ghTitle: 'ON GITHUB',
    gh: [
      ['Contributions (91 days)', String(h.total91)],
      ['Active days', `${d.filter((x) => x.count > 0).length} of 91`],
      ['Current streak', `${set.streak} days`],
      ['Best day', `${best.count} on ${fmtShort(best.date)}`],
      ['Year total', String(set.yearTotal)],
    ],
    today:
      today.count > 0
        ? `Today's tile is already glowing (${plural(today.count, 'contribution')}). Tomorrow your graph grows by one more day.`
        : "Today's tile is still dark. Commit something and come back tomorrow: your map will be different.",
  };
}
