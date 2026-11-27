// fast-check arbitraries shared by property tests.
import fc from 'fast-check';
import { ClassIdSchema, RaceIdSchema, type ContributionDay, type ContributionSet } from '../src/data/schema';
import type { Action, Grade } from '../src/engine/state';
import { addDaysUtc } from './fixtures/profiles';

const LEVELS = [0, 1, 2, 3, 4] as const;

/** Valid GitHub usernames: 1–39 letters and digits with single inner hyphens, mixed case. */
export const usernameArb: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9]{1,8}$/), { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join('-'))
  .filter((s) => s.length <= 39);

/** Any `YYYY-MM-DD` from 2000 to 2099. */
export const lastDateArb: fc.Arbitrary<string> = fc
  .integer({ min: Date.UTC(2000, 0, 1) / 864e5, max: Date.UTC(2099, 11, 31) / 864e5 })
  .map((d) => new Date(d * 864e5).toISOString().slice(0, 10));

const dayArb = (count: fc.Arbitrary<number>, level: fc.Arbitrary<ContributionDay['level']>) =>
  fc.record({ count, level });

function setArb(day: fc.Arbitrary<{ count: number; level: ContributionDay['level'] }>): fc.Arbitrary<ContributionSet> {
  return fc
    .record({ username: usernameArb, last: lastDateArb, days: fc.array(day, { minLength: 91, maxLength: 91 }) })
    .map(({ username, last, days }) => ({
      username,
      source: 'live' as const,
      fetchedAt: '2026-11-16T12:00:00.000Z',
      yearTotal: days.reduce((s, d) => s + d.count, 0),
      streak: 0,
      days: days.map((d, i) => ({ date: addDaysUtc(last, i - 90), count: d.count, level: d.level })),
    }));
}

/** Independent counts and levels, biased towards empty days. */
export const generalSetArb = setArb(
  dayArb(fc.oneof({ arbitrary: fc.constant(0), weight: 2 }, { arbitrary: fc.nat(40), weight: 3 }), fc.constantFrom(...LEVELS)),
);

/** Every day empty. */
export const allZeroSetArb = setArb(dayArb(fc.constant(0), fc.constant(0)));

/** Very busy windows, mostly level 3 and 4. */
export const denseSetArb = setArb(dayArb(fc.integer({ min: 8, max: 60 }), fc.constantFrom(2, 3, 4, 4, 4)));

/** Mostly empty windows, so the shortfall runs. */
export const sparseSetArb = setArb(
  dayArb(
    fc.oneof({ arbitrary: fc.constant(0), weight: 9 }, { arbitrary: fc.nat(10), weight: 1 }),
    fc.oneof({ arbitrary: fc.constant(0 as const), weight: 9 }, { arbitrary: fc.constantFrom(...LEVELS), weight: 1 }),
  ),
);

export const contributionSetArb: fc.Arbitrary<ContributionSet> = fc.oneof(
  { arbitrary: generalSetArb, weight: 4 },
  { arbitrary: allZeroSetArb, weight: 1 },
  { arbitrary: denseSetArb, weight: 1 },
  { arbitrary: sparseSetArb, weight: 2 },
);

const gradeArb = fc.constantFrom<Grade>('perfect', 'good', 'miss');

/**
 * One gameplay action. Applied with `step` from `newRun`, a list of these only reaches reachable states
 * (progression design.md "Testing"). Moves and grades are weighted up so runs get into and through fights.
 */
export const actionArb: fc.Arbitrary<Action> = fc.oneof(
  { arbitrary: fc.constantFrom('up', 'down', 'left', 'right').map((dir): Action => ({ type: 'move', dir })), weight: 8 },
  { arbitrary: fc.constant<Action>({ type: 'attack' }), weight: 3 },
  { arbitrary: fc.constant<Action>({ type: 'flee' }), weight: 1 },
  {
    arbitrary: fc
      .oneof(gradeArb, fc.tuple(gradeArb, gradeArb, gradeArb))
      .map((grade): Action => ({ type: 'forceGrade', grade })),
    weight: 4,
  },
  { arbitrary: fc.constant<Action>({ type: 'advance' }), weight: 4 },
  { arbitrary: fc.nat(3).map((i): Action => ({ type: 'pickRelic', i })), weight: 3 },
  { arbitrary: fc.constantFrom(...ClassIdSchema.options).map((cls): Action => ({ type: 'chooseClass', cls })), weight: 1 },
  { arbitrary: fc.constantFrom(...RaceIdSchema.options).map((race): Action => ({ type: 'chooseRace', race })), weight: 1 },
  { arbitrary: fc.constant<Action>({ type: 'enterMap' }), weight: 1 },
  { arbitrary: fc.constant<Action>({ type: 'offerBlessing' }), weight: 1 },
  { arbitrary: fc.nat(400).map((t): Action => ({ type: 'press', t, key: 'k' })), weight: 1 },
);

export const actionsArb: fc.Arbitrary<Action[]> = fc.array(actionArb, { minLength: 20, maxLength: 200 });
