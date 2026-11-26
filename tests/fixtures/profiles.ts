// API-shaped fixture builders for the PRD fixture profiles. No network needed.
import type { ContributionDay } from '../../src/data/schema';

export type ApiFixture = { total: { lastYear: number }; contributions: ContributionDay[] };

/** Days in a `?y=last` response used by the fixtures (a full year plus today). */
export const YEAR_DAYS = 366;
export const FIXTURE_END = '2026-11-16'; // a Monday
export const SATURDAY_END = '2026-11-14';
export const SUNDAY_END = '2026-11-15';

export function addDaysUtc(date: string, n: number): string {
  const dt = new Date(date + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** The level the API reports for a count (the ranges the demo uses). */
export function levelFor(count: number): ContributionDay['level'] {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 10) return 3;
  return 4;
}

/** Consecutive days ending at `end`, oldest first, one per count. */
export function daysFromCounts(counts: readonly number[], end: string = FIXTURE_END): ContributionDay[] {
  return counts.map((count, i) => ({
    date: addDaysUtc(end, i - (counts.length - 1)),
    count,
    level: levelFor(count),
  }));
}

export function apiResponse(counts: readonly number[], end: string = FIXTURE_END): ApiFixture {
  const contributions = daysFromCounts(counts, end);
  return { total: { lastYear: contributions.reduce((s, d) => s + d.count, 0) }, contributions };
}

/** Deterministic varied counts, so fixtures do not depend on an RNG. */
function pattern(i: number): number {
  const x = (i * 37 + 11) % 23;
  return x < 9 ? 0 : x - 8;
}

const base = (): number[] => Array.from({ length: YEAR_DAYS }, (_, i) => pattern(i));
const windowStart = YEAR_DAYS - 91;

export const FIXTURES: Readonly<Record<string, () => ApiFixture>> = {
  allEmpty: () => apiResponse(Array.from({ length: YEAR_DAYS }, () => 0)),
  singleActiveDay: () => {
    const counts = Array.from({ length: YEAR_DAYS }, () => 0);
    counts[windowStart + 40] = 5;
    return apiResponse(counts);
  },
  veryDense: () => apiResponse(Array.from({ length: YEAR_DAYS }, (_, i) => 12 + (i % 7))),
  bestDayFirst: () => {
    const counts = base();
    counts[windowStart] = 40;
    return apiResponse(counts);
  },
  bestDayLast: () => {
    const counts = base();
    counts[YEAR_DAYS - 1] = 40;
    return apiResponse(counts);
  },
  lastDayZero: () => {
    const counts = base().map((c) => c + 1);
    counts[YEAR_DAYS - 1] = 0;
    return apiResponse(counts);
  },
  lastSaturday: () => apiResponse(base(), SATURDAY_END),
  lastSunday: () => apiResponse(base(), SUNDAY_END),
};
