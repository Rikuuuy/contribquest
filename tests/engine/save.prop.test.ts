import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema } from '../../src/data/schema';
import { legalMoves } from '../../src/engine/explore';
import { newRun, type RunSettings } from '../../src/engine/run';
import { restore, serialize } from '../../src/engine/save';
import { step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { actionArb, contributionSetArb } from '../arbitraries';
import { demoSet } from '../fixtures/run';

const settingsArb: fc.Arbitrary<RunSettings> = fc.record({
  heroClass: fc.constantFrom(...ClassIdSchema.options),
  heroRace: fc.constantFrom(...RaceIdSchema.options),
  calm: fc.boolean(),
  assist: fc.boolean(),
});

/**
 * v1.6 action arbitrary: `legal` picks one of `legalMoves` when it is applied, so runs walk the whole route
 * (boss node included); the rest are `actionArb`, whose random move targets are mostly refused.
 */
type Cmd = { kind: 'legal'; i: number } | { kind: 'action'; action: Action };
const cmdsArb: fc.Arbitrary<Cmd[]> = fc.array(
  fc.oneof(
    { arbitrary: fc.nat(5).map((i): Cmd => ({ kind: 'legal', i })), weight: 3 },
    { arbitrary: actionArb.map((action): Cmd => ({ kind: 'action', action })), weight: 10 },
  ),
  { minLength: 20, maxLength: 200 },
);

function toAction(s: RunState, c: Cmd): Action {
  if (c.kind === 'action') return c.action;
  const o = legalMoves(s)[c.i % Math.max(1, legalMoves(s).length)] ?? { col: s.pos.col + 1, row: s.pos.row };
  return { type: 'move', to: { col: o.col, row: o.row } };
}

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
      fc.property(setArb, settingsArb, cmdsArb, (set, settings, cmds) => {
        const r = newRun(set, null, settings);
        if (!r.ok) return;
        let s = r.value;
        for (const c of cmds) {
          s = step(s, toAction(s, c));
          expect(restore(throughJson(serialize(s)))).toEqual(expected(s));
        }
      }),
      { numRuns: 60 },
    );
  }, 20000);
});
