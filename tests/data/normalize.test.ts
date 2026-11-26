import { describe, expect, it } from 'vitest';
import { buildSet, computeStreak, parseApiResponse, profileFacts } from '../../src/data/normalize';
import type { ContributionDay } from '../../src/data/schema';
import { apiResponse, daysFromCounts } from '../fixtures/profiles';

const AT = '2026-11-16T12:00:00.000Z';
const ones = (n: number): number[] => Array.from({ length: n }, () => 1);

function parsed(json: unknown): { days: ContributionDay[]; total?: number } {
  const r = parseApiResponse(json);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('parseApiResponse', () => {
  it('FR-MAP-1: sorts unsorted input by date', () => {
    const res = apiResponse(Array.from({ length: 100 }, (_, i) => i % 5));
    const shuffled = { ...res, contributions: [...res.contributions].reverse() };
    expect(parsed(shuffled).days).toEqual(res.contributions);
  });

  it('FR-MAP-1: keeps the last 91 of more than 91 days', () => {
    const res = apiResponse(Array.from({ length: 200 }, (_, i) => i % 9));
    const { days, total } = parsed(res);
    const set = buildSet('x', 'live', days, total, AT);
    expect(set.days).toHaveLength(91);
    expect(set.days).toEqual(res.contributions.slice(-91));
  });

  it('FR-IMP-3: exactly 90 days is not enough', () => {
    expect(parseApiResponse(apiResponse(ones(90)))).toEqual({
      ok: false,
      error: { code: 'bad', message: 'Not enough calendar data to raise a map.', retry: true, demo: true },
    });
    expect(parseApiResponse(apiResponse(ones(91))).ok).toBe(true);
  });

  it('FR-IMP-3: contributions that are not an array', () => {
    for (const json of [{}, { contributions: {} }, { contributions: 'x' }, null, 42, 'text']) {
      const r = parseApiResponse(json);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toBe('The data source returned something unexpected.');
    }
  });

  it('FR-IMP-3: a day that does not pass the schema', () => {
    const res = apiResponse(ones(120));
    (res.contributions[5] as unknown as { level: number }).level = 5;
    const r = parseApiResponse(res);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('The data source returned a day we could not read.');
  });

  it('P9: drops unknown day fields', () => {
    const res = apiResponse(ones(91));
    const extra = { ...res, contributions: res.contributions.map((d) => ({ ...d, color: '#fff' })) };
    expect(parsed(extra).days[0]).toEqual(res.contributions[0]);
  });

  it('FR-IMP-4: total.lastYear is used only when it is an integer', () => {
    const res = apiResponse(ones(100));
    expect(parsed({ ...res, total: { lastYear: 7 } }).total).toBe(7);
    expect(parsed({ contributions: res.contributions }).total).toBeUndefined();
    expect(parsed({ ...res, total: { lastYear: '7' } }).total).toBeUndefined();
    expect(parsed({ ...res, total: { lastYear: 7.5 } }).total).toBeUndefined();
    expect(parsed({ ...res, total: 'lots' }).total).toBeUndefined();
  });
});

describe('buildSet', () => {
  it('FR-IMP-4: yearTotal falls back to the sum of all validated counts', () => {
    const days = daysFromCounts(Array.from({ length: 120 }, (_, i) => i % 3));
    const sum = days.reduce((s, d) => s + d.count, 0);
    expect(buildSet('x', 'live', days, undefined, AT).yearTotal).toBe(sum);
    expect(buildSet('x', 'live', days, 999, AT).yearTotal).toBe(999);
  });

  it('FR-IMP-4: fetchedAt comes from the caller', () => {
    const set = buildSet('x', 'live', daysFromCounts(ones(91)), undefined, AT);
    expect(set.fetchedAt).toBe(AT);
    expect(set.source).toBe('live');
    expect(set.username).toBe('x');
  });
});

describe('computeStreak', () => {
  it('FR-IMP-4: counts back from the last day', () => {
    expect(computeStreak(daysFromCounts([0, 1, 2, 3]))).toBe(3);
    expect(computeStreak(daysFromCounts([1, 0, 2]))).toBe(1);
  });

  it('FR-IMP-4: a last day of 0 is skipped once', () => {
    expect(computeStreak(daysFromCounts([0, 2, 2, 0]))).toBe(2);
    expect(computeStreak(daysFromCounts([2, 2, 0, 0]))).toBe(0);
  });

  it('FR-IMP-4: an all-zero year has no streak', () => {
    expect(computeStreak(daysFromCounts(Array.from({ length: 366 }, () => 0)))).toBe(0);
    expect(computeStreak([])).toBe(0);
  });

  it('FR-IMP-4: a full year of activity counts every day', () => {
    expect(computeStreak(daysFromCounts(ones(366)))).toBe(366);
  });

  it('FR-IMP-4: the streak runs across the window edge', () => {
    const counts = [...Array.from({ length: 50 }, () => 0), ...ones(150)];
    const days = daysFromCounts(counts);
    const set = buildSet('x', 'live', days, undefined, AT);
    expect(set.streak).toBe(150);
    expect(set.days).toHaveLength(91);
  });
});

describe('profileFacts', () => {
  const days = daysFromCounts(Array.from({ length: 120 }, (_, i) => i % 4));

  it('FR-IMP-4: summary numbers come from the window', () => {
    const set = buildSet('Octo-Cat', 'live', days, 1000, AT);
    const facts = profileFacts(set);
    expect(facts).toEqual({
      username: 'Octo-Cat',
      source: 'live',
      avatarUrl: 'https://github.com/Octo-Cat.png?size=24',
      total91: set.days.reduce((s, d) => s + d.count, 0),
      yearTotal: 1000,
      streak: set.streak,
      firstDate: set.days[0]!.date,
      lastDate: set.days[90]!.date,
    });
  });

  it('FR-IMP-4: the avatar URL is null for demo data and set for cache data', () => {
    expect(profileFacts(buildSet('demo-necromancer', 'demo', days, 1, AT)).avatarUrl).toBeNull();
    expect(profileFacts(buildSet('x', 'cache', days, 1, AT)).avatarUrl).toBe('https://github.com/x.png?size=24');
  });
});
