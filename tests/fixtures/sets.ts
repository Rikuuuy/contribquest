// ContributionSet builders for map tests.
import type { ContributionDay, ContributionSet } from '../../src/data/schema';
import { addDaysUtc, FIXTURE_END, levelFor } from './profiles';

export function makeSet(days: ContributionDay[], username = 'octo-cat'): ContributionSet {
  return {
    username,
    source: 'live',
    fetchedAt: '2026-11-16T12:00:00.000Z',
    yearTotal: days.reduce((s, d) => s + d.count, 0),
    streak: 0,
    days,
  };
}

/** 91 days ending at `end`; `day(i)` gives count and optionally level (default: the API level for the count). */
export function windowDays(
  day: (i: number) => { count: number; level?: ContributionDay['level'] },
  end: string = FIXTURE_END,
): ContributionDay[] {
  return Array.from({ length: 91 }, (_, i) => {
    const { count, level } = day(i);
    return { date: addDaysUtc(end, i - 90), count, level: level ?? levelFor(count) };
  });
}
