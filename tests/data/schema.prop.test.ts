import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import demoData from '../../src/data/demo-data.json';
import { buildSet, parseApiResponse } from '../../src/data/normalize';
import { CacheEntrySchema, ContributionSetSchema } from '../../src/data/schema';
import { FIXTURES, daysFromCounts } from '../fixtures/profiles';

const AT = '2026-11-16T12:00:00.000Z';

/** A valid API payload with 91 to 380 consecutive days. */
const validPayload = fc
  .array(fc.integer({ min: 0, max: 60 }), { minLength: 91, maxLength: 380 })
  .map((counts) => ({ total: { lastYear: counts.reduce((a, b) => a + b, 0) }, contributions: daysFromCounts(counts) }));

/** Ways to break one day so it no longer passes the day schema. */
const badDay = fc.oneof(
  fc.constantFrom('2026/11/16', '16-11-2026', '2026-1-16', '', 'today').map((date) => ({ date })),
  fc.integer({ min: 1, max: 1000 }).map((n) => ({ date: 20261116 + n })),
  fc.integer({ min: -1000, max: -1 }).map((count) => ({ count })),
  fc.double({ min: 0.01, max: 100, noNaN: true }).filter((x) => !Number.isInteger(x)).map((count) => ({ count })),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, '3', null).map((count) => ({ count })),
  fc.oneof(fc.integer({ min: 5, max: 100 }), fc.integer({ min: -100, max: -1 }), fc.constant(1.5), fc.constant('2')).map(
    (level) => ({ level }),
  ),
  fc.constantFrom('date', 'count', 'level').map((drop) => ({ drop })),
  fc.constantFrom(null, 7, 'day', [] as unknown[]).map((replace) => ({ replace })),
);

type Mutation = Record<string, unknown>;

function mutate(day: Record<string, unknown>, m: Mutation): unknown {
  if ('replace' in m) return m['replace'];
  if ('drop' in m) {
    const copy = { ...day };
    delete copy[m['drop'] as string];
    return copy;
  }
  return { ...day, ...m };
}

describe('P9: schema at the trust boundary', () => {
  it('P9: every PRD fixture profile passes the schema and builds a valid set', () => {
    for (const [name, make] of Object.entries(FIXTURES)) {
      const r = parseApiResponse(make());
      expect(r.ok, name).toBe(true);
      if (r.ok) {
        const set = buildSet(name, 'live', r.value.days, r.value.total, AT);
        expect(ContributionSetSchema.safeParse(set).success, name).toBe(true);
        expect(CacheEntrySchema.safeParse({ at: 0, ...r.value }).success, name).toBe(true);
      }
    }
  });

  it('P9: the frozen demo data passes the same schema', () => {
    const r = parseApiResponse(demoData);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.days).toHaveLength(91);
      expect(r.value.total).toBe(1287);
      expect(ContributionSetSchema.safeParse(buildSet('demo-necromancer', 'demo', r.value.days, r.value.total, AT)).success).toBe(true);
    }
  });

  it('P9: generated valid payloads pass', () => {
    fc.assert(
      fc.property(validPayload, (payload) => {
        const r = parseApiResponse(payload);
        return r.ok && r.value.days.length === payload.contributions.length;
      }),
    );
  });

  it('P9: one mutated day is rejected as bad and never throws', () => {
    fc.assert(
      fc.property(validPayload, fc.nat(), badDay, (payload, at, m) => {
        const contributions: unknown[] = [...payload.contributions];
        const i = at % contributions.length;
        contributions[i] = mutate(payload.contributions[i]!, m);
        const r = parseApiResponse({ ...payload, contributions });
        return !r.ok && r.error.code === 'bad' && r.error.message === 'The data source returned a day we could not read.';
      }),
    );
  });

  it('P9: a non-array contributions field is rejected as bad', () => {
    fc.assert(
      fc.property(
        fc.anything().filter((x) => !Array.isArray(x)),
        (contributions) => {
          const r = parseApiResponse({ total: { lastYear: 1 }, contributions });
          return !r.ok && r.error.code === 'bad' && r.error.message === 'The data source returned something unexpected.';
        },
      ),
    );
  });

  it('P9: too few days is rejected as bad', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 30 }), { maxLength: 90 }), (counts) => {
        const r = parseApiResponse({ contributions: daysFromCounts(counts) });
        return !r.ok && r.error.code === 'bad';
      }),
    );
  });

  it('P9: arbitrary input never throws past the boundary', () => {
    fc.assert(
      fc.property(fc.anything(), (json) => {
        const r = parseApiResponse(json);
        return r.ok || r.error.code === 'bad';
      }),
    );
  });
});
