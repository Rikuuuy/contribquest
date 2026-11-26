// Pure normalisation: validated days → the 91-day ContributionSet.
import { WINDOW } from './constants';
import { ERROR_TEXT, fail, type Result } from './errors';
import {
  ApiResponseSchema,
  ContributionDaySchema,
  type ContributionDay,
  type ContributionSet,
} from './schema';

export type ParsedResponse = { days: ContributionDay[]; total?: number };

export type ProfileFacts = {
  username: string;
  source: ContributionSet['source'];
  avatarUrl: string | null;
  total91: number;
  yearTotal: number;
  streak: number;
  firstDate: string;
  lastDate: string;
};

/** Validates an API-shaped payload: array check, each day, sort ascending, at least 91 days. */
export function parseApiResponse(json: unknown): Result<ParsedResponse> {
  const root = ApiResponseSchema.safeParse(json);
  if (!root.success || !Array.isArray(root.data.contributions)) {
    return fail('bad', ERROR_TEXT.badShape);
  }
  const days: ContributionDay[] = [];
  for (const raw of root.data.contributions as unknown[]) {
    const day = ContributionDaySchema.safeParse(raw);
    if (!day.success) return fail('bad', ERROR_TEXT.badDay);
    days.push(day.data);
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (days.length < WINDOW) return fail('bad', ERROR_TEXT.badShort);

  const total = root.data.total;
  const lastYear =
    typeof total === 'object' && total !== null ? (total as { lastYear?: unknown }).lastYear : undefined;
  return Number.isInteger(lastYear) ? { ok: true, value: { days, total: lastYear as number } } : { ok: true, value: { days } };
}

/** Consecutive days with count > 0 back from the last day; a last day of 0 is skipped (today may not be over). */
export function computeStreak(all: readonly ContributionDay[]): number {
  let i = all.length - 1;
  if (i >= 0 && all[i]!.count === 0) i--;
  let streak = 0;
  while (i >= 0 && all[i]!.count > 0) {
    streak++;
    i--;
  }
  return streak;
}

/** Builds the set from the full validated list; `fetchedAt` comes from the caller's clock. */
export function buildSet(
  username: string,
  source: ContributionSet['source'],
  all: readonly ContributionDay[],
  total: number | undefined,
  fetchedAt: string,
): ContributionSet {
  return {
    username,
    source,
    fetchedAt,
    yearTotal: Number.isInteger(total) ? (total as number) : all.reduce((sum, d) => sum + d.count, 0),
    streak: computeStreak(all),
    days: all.slice(-WINDOW),
  };
}

/** Facts for the hero summary. The avatar is hidden for demo data, as in the prototype. */
export function profileFacts(set: ContributionSet): ProfileFacts {
  const days = set.days;
  return {
    username: set.username,
    source: set.source,
    avatarUrl: set.source === 'demo' ? null : `https://github.com/${encodeURIComponent(set.username)}.png?size=24`,
    total91: days.reduce((sum, d) => sum + d.count, 0),
    yearTotal: set.yearTotal,
    streak: set.streak,
    firstDate: days[0]?.date ?? '',
    lastDate: days[days.length - 1]?.date ?? '',
  };
}
