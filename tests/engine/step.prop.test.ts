import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema, type ContributionSet } from '../../src/data/schema';
import { legalMoves } from '../../src/engine/explore';
import { newRun, type RunSettings } from '../../src/engine/run';
import { step } from '../../src/engine/step';
import type { Action, Grade, RunState } from '../../src/engine/state';
import { contributionSetArb } from '../arbitraries';
import { demoSet } from '../fixtures/run';

const settingsArb: fc.Arbitrary<RunSettings> = fc.record({
  heroClass: fc.constantFrom(...ClassIdSchema.options),
  heroRace: fc.constantFrom(...RaceIdSchema.options),
  calm: fc.boolean(),
  assist: fc.boolean(),
});

const gradeArb = fc.constantFrom<Grade>('perfect', 'good', 'miss');

/** A command: `legal` picks one of the legal moves at the time it is applied; the rest are plain actions. */
type Cmd = { kind: 'legal'; i: number } | { kind: 'action'; action: Action };

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
  { arbitrary: fc.nat(5).map((i): Cmd => ({ kind: 'legal', i })), weight: 6 },
  {
    // Random targets: mostly illegal (behind, sideways, two ahead, off the map), sometimes legal by chance.
    arbitrary: fc
      .record({ col: fc.integer({ min: -1, max: 15 }), row: fc.integer({ min: -1, max: 7 }) })
      .map((to): Cmd => ({ kind: 'action', action: { type: 'move', to } })),
    weight: 4,
  },
  { arbitrary: fc.constant<Cmd>({ kind: 'action', action: { type: 'attack' } }), weight: 4 },
  { arbitrary: gradeArb.map((grade): Cmd => ({ kind: 'action', action: { type: 'forceGrade', grade } })), weight: 6 },
  { arbitrary: fc.constant<Cmd>({ kind: 'action', action: { type: 'advance' } }), weight: 6 },
  { arbitrary: fc.nat(3).map((i): Cmd => ({ kind: 'action', action: { type: 'pickRelic', i } })), weight: 2 },
);

function toAction(s: RunState, c: Cmd): Action {
  if (c.kind === 'action') return c.action;
  const opts = legalMoves(s);
  // With no legal move (a fight, or the boss node), aim one column ahead on the same row.
  const o = opts[c.i % Math.max(1, opts.length)] ?? { col: s.pos.col + 1, row: s.pos.row };
  return { type: 'move', to: { col: o.col, row: o.row } };
}

function start(set: ContributionSet, settings: RunSettings): RunState {
  const r = newRun(set, null, settings);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('P24 (v1.6): forward-only moves, nothing skipped', () => {
  it('for any action sequence from newRun with legal and illegal move targets', () => {
    // Coverage of the generated runs, checked after the property.
    const seen = { maxCol: 0, blockedInFight: 0, blockedInRelic: 0, refused: 0 };
    fc.assert(
      fc.property(
        fc.oneof({ arbitrary: fc.constant(demoSet()), weight: 1 }, { arbitrary: contributionSetArb, weight: 2 }),
        settingsArb,
        fc.array(cmdArb, { minLength: 20, maxLength: 300 }),
        (set, settings, cmds) => {
          let s = start(set, settings);
          expect([s.pos.col, s.stats.steps]).toEqual([0, 0]);
          for (const cmd of cmds) {
            const p = s;
            const a = toAction(p, cmd);
            s = step(p, a);
            expect(s.pos.col).toBeGreaterThanOrEqual(p.pos.col);
            const moved = s.pos.col !== p.pos.col || s.pos.row !== p.pos.row;
            if (moved) {
              expect(a.type).toBe('move');
              expect(s.pos.col).toBe(p.pos.col + 1);
              expect(s.stats.steps).toBe(p.stats.steps + 1);
            } else expect(s.stats.steps).toBe(p.stats.steps);
            expect(s.stats.steps).toBe(s.pos.col);
            if (a.type === 'move' && (p.status === 'combat' || p.status === 'relic' || !moved)) {
              expect(s).toEqual({ ...p, events: [] });
              if (p.status === 'combat') seen.blockedInFight++;
              else if (p.status === 'relic') seen.blockedInRelic++;
              else seen.refused++;
            }
            seen.maxCol = Math.max(seen.maxCol, s.pos.col);
            if (s.status === 'exploring') {
              for (const t of s.map.tiles) if (t.visited) expect(t.resolved, `${t.col},${t.row}`).toBe(true);
            }
            if (s.status === 'won' || s.status === 'lost') break;
          }
        },
      ),
      { numRuns: 80 },
    );
    expect(seen.maxCol).toBeGreaterThanOrEqual(3);
    expect(Math.min(seen.blockedInFight, seen.blockedInRelic, seen.refused)).toBeGreaterThan(0);
  });
});
