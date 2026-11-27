import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema } from '../../src/data/schema';
import { legalMoves, viewAhead } from '../../src/engine/explore';
import { newRun, type RunSettings } from '../../src/engine/run';
import { step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { tileAt } from '../../src/mapgen';
import { actionArb, contributionSetArb } from '../arbitraries';
import { demoSet } from '../fixtures/run';

const settingsArb: fc.Arbitrary<RunSettings> = fc.record({
  heroClass: fc.constantFrom(...ClassIdSchema.options),
  heroRace: fc.constantFrom(...RaceIdSchema.options),
  calm: fc.boolean(),
  assist: fc.boolean(),
});

/** `legal` picks one of `legalMoves` when applied; `actionArb` adds random actions (its move targets are mostly refused). */
/** `fight` sends the action the current fight phase expects (attack, a Perfect grade, or advance). */
type Cmd = { kind: 'legal'; i: number } | { kind: 'fight' } | { kind: 'action'; action: Action };
const cmdsArb: fc.Arbitrary<Cmd[]> = fc.array(
  fc.oneof(
    { arbitrary: fc.nat(5).map((i): Cmd => ({ kind: 'legal', i })), weight: 6 },
    // `fight` is weighted up so runs get through fights and reach the boss node.
    { arbitrary: fc.constant<Cmd>({ kind: 'fight' }), weight: 16 },
    { arbitrary: fc.nat(2).map((i): Cmd => ({ kind: 'action', action: { type: 'pickRelic', i } })), weight: 3 },
    { arbitrary: actionArb.map((action): Cmd => ({ kind: 'action', action })), weight: 4 },
  ),
  { minLength: 20, maxLength: 400, size: 'max' },
);

function toAction(s: RunState, c: Cmd): Action {
  if (c.kind === 'action') return c.action;
  if (c.kind === 'fight') {
    const f = s.combat;
    if (f?.phase === 'test') return { type: 'forceGrade', grade: f.test?.mode === 'combo' ? ['perfect', 'perfect', 'perfect'] : 'perfect' };
    return f?.phase === 'choose' ? { type: 'attack' } : { type: 'advance' };
  }
  const opts = legalMoves(s);
  const o = opts[c.i % Math.max(1, opts.length)] ?? { col: s.pos.col + 1, row: s.pos.row };
  return { type: 'move', to: { col: o.col, row: o.row } };
}

/** P22: the window invariant, and every legal target is seen or is the boss node. */
function checkP22(s: RunState): void {
  const last = s.pos.col + viewAhead(s.hero.relics);
  for (const t of s.map.tiles) expect(t.seen, `${t.col},${t.row}`).toBe(t.col <= last);
  for (const o of legalMoves(s)) {
    if (o.boss) expect(o).toEqual({ ...s.map.bossNode, boss: true });
    else expect(tileAt(s.map, o.col, o.row)?.seen).toBe(true);
  }
}

describe('P22 (v1.6): the visibility window', () => {
  it('for any action sequence from newRun, tile.seen ⇔ tile.col ≤ pos.col + viewAhead, and legal targets are seen', () => {
    const reached = { boss: 0, review: 0 };
    fc.assert(
      fc.property(
        fc.oneof({ arbitrary: fc.constant(demoSet()), weight: 1 }, { arbitrary: contributionSetArb, weight: 2 }),
        settingsArb,
        cmdsArb,
        (set, settings, cmds) => {
          const r = newRun(set, null, settings);
          if (!r.ok) return;
          let s = r.value;
          checkP22(s);
          for (const c of cmds) {
            s = step(s, toAction(s, c));
            checkP22(s);
            if (s.pos.col === s.map.cols) {
              reached.boss++;
              expect(s.map.tiles.every((t) => t.seen)).toBe(true);
            }
            if (s.hero.relics.includes('review')) reached.review++;
            if (s.status === 'won' || s.status === 'lost') break;
          }
        },
      ),
      { numRuns: 40 },
    );
    expect(reached.boss).toBeGreaterThan(0);
    expect(reached.review).toBeGreaterThan(0);
  }, 30000);
});
