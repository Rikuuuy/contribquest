// Wanderer grade-policy regression on the demo graph (progression requirement 14.4). v1.6: prints fights,
// shards, and steps instead of the retired 15–25 steps target.
import { describe, expect, it } from 'vitest';
import { playRun, type Grader } from '../../src/engine/routebot';
import { newRun } from '../../src/engine/run';
import type { ComboGrade, Grade, RunState } from '../../src/engine/state';
import { makeRng } from '../../src/mapgen/rng';
import { demoSet } from '../fixtures/run';

function demoRun(): RunState {
  const r = newRun(demoSet(), null, { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const always =
  (g: Grade): Grader =>
  (t) =>
    t.mode === 'combo' ? ([g, g, g] as ComboGrade) : g;

/** 25% Perfect, 50% Good, 25% Miss from makeRng(1234), one draw per grade. */
function mixed(): Grader {
  const r = makeRng(1234);
  const one = (): Grade => {
    const x = r.next();
    return x < 0.25 ? 'perfect' : x < 0.75 ? 'good' : 'miss';
  };
  return (t) => (t.mode === 'combo' ? [one(), one(), one()] : one());
}

const POLICIES: [string, () => Grader, boolean][] = [
  ['All Perfect', () => always('perfect'), true],
  ['All Good', () => always('good'), true],
  ['Mixed 25/50/25', mixed, true],
  ['All Miss', () => always('miss'), false],
];

describe('FR-COM-5, FR-PRO-1: Wanderer grade policies on the demo graph', () => {
  it.each(POLICIES)('%s gives the PRD outcome', (name, grader, wins) => {
    const r = playRun(demoRun(), grader());
    // v1.6: steps always equal cols (14 on the demo), so only the fights target (6–10, the boss included) is shown.
    console.log(
      `${name}: ${r.won ? 'won' : 'lost'} with ${r.fights} fights, ${r.state.shards} shards, ${r.state.stats.steps} steps (target 8–13 fights, the boss included)`,
    );
    expect(r.state.status).toBe(wins ? 'won' : 'lost');
  });

  it('is deterministic: the same policy replays the same run', () => {
    const a = playRun(demoRun(), mixed());
    const b = playRun(demoRun(), mixed());
    expect(b.state).toEqual(a.state);
    expect(b.actions).toBe(a.actions);
  });
});
