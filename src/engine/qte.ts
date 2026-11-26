// Timing tests: creation and pure grading (prototype startQte, qtePress, qteRelease, shieldImpact, finishQte).
// Every time is test time: ms since the test started.
import type { Tier } from '../mapgen';
import { PATTERN, QTE, RELIC_COMBAT, TEST_TIMING, WINDOW_RULES, type Difficulty } from './balance';
import type { Mods } from './mods';
import type { ComboGrade, Grade, GradeResult, InputEvent, Mode, Pattern, QteTest, Why } from './state';

export type TestContext = {
  tier: Tier;
  mode: Mode;
  pattern: Pattern;
  aura: number;
  mods: Mods;
  calm: boolean;
  diff: Difficulty;
  pressure: number;
  /** Bar sweep multiplier (Knight 1.15). */
  slow: number;
  /** Guard speed multiplier (boss phase 2: 0.85). */
  patSpeed: number;
};

/** The Perfect and Good half-windows and the speed factor `tm` (requirements 6.1, 6.2). */
export function windows(ctx: TestContext): { P: number; G: number; tm: number } {
  const calm = ctx.calm ? QTE.calm : 1;
  const D = ctx.diff;
  const pr = ctx.pressure;
  const tm = D.speed * (WINDOW_RULES.tmBase + WINDOW_RULES.tmPressure * pr);
  let P = (QTE.perfect + QTE.auraPerfect * ctx.aura + (ctx.mods.linter ? RELIC_COMBAT.linter : 0)) * calm;
  if (ctx.mods.elf) P += RELIC_COMBAT.elf * calm;
  P *= D.pMul * pr;
  let G = Math.max(QTE.good * calm * D.gMul * pr, P * WINDOW_RULES.gFromP);
  if (ctx.mode === 'sidestep') P *= WINDOW_RULES.sidestepP;
  if (ctx.mode === 'combo') G = Math.min(G, WINDOW_RULES.comboG * calm * D.gMul * pr);
  return { P, G, tm };
}

/** Builds a test, drawing from `rand` in the prototype's order (design.md "RNG call order"). */
export function createTest(kind: QteTest['kind'], ctx: TestContext, rand: () => number): QteTest {
  const calm = ctx.calm ? QTE.calm : 1;
  const t = ctx.tier;
  const { P, G, tm } = windows(ctx);
  const T = TEST_TIMING;
  const base = { kind, mode: ctx.mode, pattern: ctx.pattern, P, G };
  if (ctx.mode === 'bar') {
    const dur = (T.barBase - T.barPerTier * t) * calm * tm * ctx.slow;
    const zone = T.barZone + T.barZoneRand * rand();
    return { ...base, dur, target: zone * dur, zone };
  }
  if (ctx.mode === 'combo') {
    const dur = (T.comboBase - T.comboPerTier * t) * calm * tm;
    const z0 = T.comboZ0 + T.comboZ0Rand * rand();
    const g1 = T.comboGap + T.comboGapRand * rand();
    const g2 = T.comboGap + T.comboGapRand * rand();
    const marks: [number, number, number] = [z0 * dur, (z0 + g1) * dur, (z0 + g1 + g2) * dur];
    return { ...base, dur, target: marks[2], marks };
  }
  if (ctx.mode === 'charge') {
    const fill = (T.chargeBase - T.chargePerTier * t) * calm * tm;
    return { ...base, dur: T.chargeDur * calm, target: T.chargeTarget * fill, fill };
  }
  // ring, sidestep, shield
  const b = (ctx.pattern === 'quick' ? PATTERN.quickBase : T.guardBase - T.guardPerTier * t) * calm * tm * ctx.patSpeed;
  const test: QteTest = { ...base, dur: 0, target: b };
  if (ctx.pattern === 'flaky') {
    const pause = (PATTERN.flakyPause + PATTERN.flakyPauseRand * rand()) * calm * tm;
    test.pauseAt = b * (PATTERN.flakyAt + PATTERN.flakyAtRand * rand());
    test.pause = pause;
    test.target = b + pause;
  }
  if (ctx.pattern === 'conflict') {
    const dist = Math.max(G * PATTERN.conflictMinG, (PATTERN.conflictDist + PATTERN.conflictDistRand * rand()) * calm * tm);
    test.decoy = b + dist * (rand() < PATTERN.conflictSide ? -1 : 1);
  }
  test.dur = test.target + G;
  return test;
}

// ---------- Grading ----------

/** A mode's state machine. `deadline()` is the next test time at which `fire()` must run. */
type Machine = {
  deadline(): number;
  fire(): GradeResult | null;
  press(t: number, key: string): GradeResult | null;
  release(t: number, key: string): GradeResult | null;
};

const single = (off: number, P: number, G: number): Grade => {
  const a = Math.abs(off);
  return a <= P ? 'perfect' : a <= G ? 'good' : 'miss';
};

function onePress(test: QteTest): Machine {
  return {
    deadline: () => test.dur + TEST_TIMING.deadline,
    fire: () => ({ grade: 'miss', why: 'too late' }),
    press(t) {
      const g = single(t - test.target, test.P, test.G);
      if (g !== 'miss') return { grade: g };
      return { grade: 'miss', why: t < test.target ? 'too early' : 'too late' };
    },
    release: () => null,
  };
}

function combo(test: QteTest): Machine {
  const marks = test.marks ?? [test.target, test.target, test.target];
  const hits: Grade[] = [];
  const done = (): ComboGrade => [hits[0] ?? 'miss', hits[1] ?? 'miss', hits[2] ?? 'miss'];
  return {
    deadline: () => test.dur + TEST_TIMING.deadline,
    fire() {
      const g = done();
      return g.every((x) => x === 'miss') ? { grade: g, why: 'too late' } : { grade: g };
    },
    press(t) {
      let i = hits.length;
      while (i < 3 && t > (marks[i] as number) + test.G) {
        hits.push('miss');
        i++;
      }
      if (i < 3) hits.push(single(t - (marks[i] as number), test.P, test.G));
      return hits.length >= 3 ? { grade: done() } : null;
    },
    release: () => null,
  };
}

function charge(test: QteTest): Machine {
  const fill = test.fill ?? test.target;
  let downAt: number | null = null;
  let holdKey: string | null = null;
  return {
    deadline: () => (downAt === null ? test.dur : downAt + fill + TEST_TIMING.chargeOverload),
    fire: () => ({ grade: 'miss', why: downAt === null ? 'too slow' : 'overload' }),
    press(t, key) {
      if (downAt !== null) return null;
      downAt = t;
      holdKey = key;
      return null;
    },
    release(t, key) {
      if (downAt === null || (holdKey !== null && key !== holdKey)) return null;
      const held = t - downAt;
      if (held >= fill) return { grade: 'miss', why: 'overload' };
      const g = single(held - test.target, test.P, test.G);
      if (g !== 'miss') return { grade: g };
      return { grade: 'miss', why: held < test.target ? 'too weak' : 'overload' };
    },
  };
}

function shield(test: QteTest): Machine {
  let holding = false;
  let downAt: number | null = null;
  let holdKey: string | null = null;
  let impactPassed = false;
  return {
    deadline: () => (impactPassed ? test.target + test.P + TEST_TIMING.shieldGrace : test.target),
    fire() {
      if (!impactPassed) {
        impactPassed = true;
        if (holding && downAt !== null) return { grade: test.target - downAt <= test.P ? 'perfect' : 'good' };
        return null;
      }
      return { grade: 'miss', why: downAt === null ? 'no shield' : 'shield down' };
    },
    press(t, key) {
      holding = true;
      holdKey = key;
      if (t > test.target) return t - test.target <= test.P ? { grade: 'perfect' } : null;
      downAt = t;
      return null;
    },
    release(_t, key) {
      if (holdKey !== null && key !== holdKey) return null;
      holding = false;
      return null;
    },
  };
}

function machine(test: QteTest): Machine {
  switch (test.mode) {
    case 'combo':
      return combo(test);
    case 'charge':
      return charge(test);
    case 'shield':
      return shield(test);
    default:
      return onePress(test);
  }
}

const byTime = (events: readonly InputEvent[]): InputEvent[] =>
  events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.t - b.e.t || a.i - b.i)
    .map((x) => x.e);

/** Feeds one event; presses before the grace time are ignored. */
function feed(m: Machine, e: InputEvent): GradeResult | null {
  if (e.type === 'down') return e.t < QTE.grace ? null : m.press(e.t, e.key);
  return m.release(e.t, e.key);
}

const assistAt = (test: QteTest): number => (test.mode === 'charge' ? TEST_TIMING.assistCharge : test.target);
const assistResult = (test: QteTest): GradeResult => ({
  grade: test.mode === 'combo' ? ['good', 'good', 'good'] : 'good',
});

/**
 * Replays the events in time order, firing deadlines at their test time before any later event
 * (an event at the same time as a deadline goes first). Returns the first decision at or before `now`.
 */
export function grade(test: QteTest, events: readonly InputEvent[], now: number, assist: boolean): GradeResult | null {
  if (assist) return now >= assistAt(test) ? assistResult(test) : null;
  const m = machine(test);
  for (const e of byTime(events)) {
    if (e.t > now) break;
    while (m.deadline() < e.t) {
      const r = m.fire();
      if (r) return r;
    }
    const r = feed(m, e);
    if (r) return r;
  }
  while (m.deadline() <= now) {
    const r = m.fire();
    if (r) return r;
  }
  return null;
}

/** The next test time at which the test decides if no further input arrives. */
export function testDeadline(test: QteTest, events: readonly InputEvent[], assist: boolean): number {
  if (assist) return assistAt(test);
  const m = machine(test);
  for (const e of byTime(events)) {
    while (m.deadline() < e.t) {
      const at = m.deadline();
      if (m.fire()) return at;
    }
    if (feed(m, e)) return e.t;
  }
  for (;;) {
    const at = m.deadline();
    if (m.fire()) return at;
  }
}

// ---------- Display text ----------

export const GRADE_LABELS: Readonly<Record<Exclude<Mode, 'combo'>, Readonly<Record<Grade, string>>>> = {
  bar: { perfect: 'CRITICAL!', good: 'GOOD HIT', miss: 'GLANCING BLOW' },
  charge: { perfect: 'CRITICAL SPELL!', good: 'SPELL HIT', miss: 'FIZZLE' },
  ring: { perfect: 'PERFECT DODGE!', good: 'BLOCKED', miss: 'HIT!' },
  sidestep: { perfect: 'PERFECT SIDESTEP!', good: 'GRAZED', miss: 'HIT!' },
  shield: { perfect: 'PERFECT PARRY!', good: 'BLOCKED', miss: 'HIT!' },
};

const COMBO_GOOD_HITS = 2;

/** The grade banner: `{WHY · }{label}`; combo "PERFECT COMBO!" or "{n}/3 HITS · P G M". */
export function gradeText(mode: Mode, r: GradeResult): { text: string; cls: Grade } {
  const why = (w: Why | undefined) => (w ? w.toUpperCase() + ' · ' : '');
  if (Array.isArray(r.grade)) {
    const g = r.grade;
    const n = g.filter((x) => x !== 'miss').length;
    const all = g.every((x) => x === 'perfect');
    const text = all ? 'PERFECT COMBO!' : `${n}/3 HITS · ` + g.map((x) => x[0]!.toUpperCase()).join(' ');
    return { text: why(r.why) + text, cls: all ? 'perfect' : n >= COMBO_GOOD_HITS ? 'good' : 'miss' };
  }
  const labels = GRADE_LABELS[mode === 'combo' ? 'bar' : mode];
  return { text: why(r.why) + labels[r.grade], cls: r.grade };
}
