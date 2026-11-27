import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema } from '../../src/data/schema';
import { newRun, type RunSettings } from '../../src/engine/run';
import { restore, serialize } from '../../src/engine/save';
import { step } from '../../src/engine/step';
import type { RunState } from '../../src/engine/state';
import { actionsArb, contributionSetArb } from '../arbitraries';
import { demoSet } from '../fixtures/run';

const settingsArb: fc.Arbitrary<RunSettings> = fc.record({
  heroClass: fc.constantFrom(...ClassIdSchema.options),
  heroRace: fc.constantFrom(...RaceIdSchema.options),
  calm: fc.boolean(),
  assist: fc.boolean(),
});

/** What `writeRun` stores and `readRun` reads back. */
const throughJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

/** The state restore should give back: no events, and a fight in a timing test back at the choice. */
function expected(s: RunState): RunState {
  const e = structuredClone({ ...s, events: [] });
  if (e.combat && e.combat.phase === 'test') {
    e.combat.phase = 'choose';
    e.combat.test = null;
    e.combat.events = [];
  }
  return e;
}

describe('save properties', () => {
  it('P8: for any set and settings, restore(serialize(newRun(...))) deep-equals the new run', () => {
    fc.assert(
      fc.property(contributionSetArb, settingsArb, (set, settings) => {
        const r = newRun(set, null, settings);
        if (!r.ok) return;
        expect(restore(throughJson(serialize(r.value)))).toEqual(r.value);
      }),
      { numRuns: 80 },
    );
  });

  it('P19: for any state reached by actions from newRun, restore(serialize(s)) deep-equals s with events []', () => {
    const demo = demoSet();
    const setArb = fc.oneof({ arbitrary: fc.constant(demo), weight: 1 }, { arbitrary: contributionSetArb, weight: 1 });
    fc.assert(
      fc.property(setArb, settingsArb, actionsArb, (set, settings, actions) => {
        const r = newRun(set, null, settings);
        if (!r.ok) return;
        let s = r.value;
        for (const a of actions) {
          s = step(s, a);
          expect(restore(throughJson(serialize(s)))).toEqual(expected(s));
        }
      }),
      { numRuns: 60 },
    );
  }, 20000);
});
