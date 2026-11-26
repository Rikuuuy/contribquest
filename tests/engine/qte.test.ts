import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/data/schema';
import { CLASS_STATS, DIFFICULTY } from '../../src/engine/balance';
import { NO_MODS, type Mods } from '../../src/engine/mods';
import { GRADE_LABELS, createTest, grade, gradeText, testDeadline, windows, type TestContext } from '../../src/engine/qte';
import type { InputEvent, Mode, QteTest } from '../../src/engine/state';

function ctx(o: Partial<Omit<TestContext, 'mods'>> & { cls?: ClassId; mods?: Partial<Mods> } = {}): TestContext {
  const cls = o.cls ?? 'wanderer';
  const { cls: _c, mods, ...rest } = o;
  return {
    tier: 2,
    mode: CLASS_STATS[cls].strike,
    pattern: 'normal',
    aura: 0,
    calm: false,
    diff: DIFFICULTY[cls],
    pressure: 1,
    slow: CLASS_STATS[cls].slow,
    patSpeed: 1,
    ...rest,
    mods: { ...NO_MODS, ...mods },
  };
}

/** A draw source returning the given values in order; `calls` counts the draws. */
function seq(...values: number[]) {
  const f = Object.assign(
    () => {
      f.calls++;
      return values.length ? (values.shift() as number) : 0.5;
    },
    { calls: 0 },
  );
  return f;
}

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);
const down = (t: number, key = 'k'): InputEvent => ({ type: 'down', t, key });
const up = (t: number, key = 'k'): InputEvent => ({ type: 'up', t, key });

describe('FR-CLS-3: windows', () => {
  it('Wanderer at pressure 1, aura 0: P 66.5, G 153, tm 0.96', () => {
    const w = windows(ctx({ mode: 'ring' }));
    close(w.P, 66.5);
    close(w.G, 153);
    close(w.tm, 0.96);
  });

  it('aura, Linter, Elf, and calm widen P before class and pressure scaling', () => {
    close(windows(ctx({ mode: 'ring', aura: 2 })).P, 85.5);
    close(windows(ctx({ mode: 'ring', mods: { linter: true } })).P, 90.25);
    close(windows(ctx({ mode: 'ring', mods: { elf: true } })).P, 80.75);
    const calm = windows(ctx({ mode: 'ring', calm: true }));
    close(calm.P, 106.4);
    close(calm.G, 244.8);
    close(windows(ctx({ mode: 'ring', calm: true, mods: { elf: true } })).P, 129.2);
  });

  it('G is at least 1.4 × P', () => {
    const w = windows(ctx({ cls: 'knight', mode: 'ring', aura: 4, mods: { linter: true, elf: true } }));
    close(w.P, 187.5);
    close(w.G, 262.5);
  });

  it('pressure 0.6 scales P and G and speeds the test up', () => {
    const w = windows(ctx({ mode: 'ring', pressure: 0.6 }));
    close(w.P, 39.9);
    close(w.G, 91.8);
    close(w.tm, 0.96 * 0.92);
  });

  it('each class at pressure 1, with sidestep P × 1.2 and the combo G cap', () => {
    const w = (cls: ClassId, mode: Mode) => windows(ctx({ cls, mode }));
    close(w('knight', 'bar').P, 87.5);
    close(w('knight', 'bar').G, 204);
    close(w('mage', 'charge').P, 50.4);
    close(w('mage', 'ring').G, 105.4);
    close(w('rogue', 'combo').P, 43.4);
    close(w('rogue', 'combo').G, 81.6);
    close(w('rogue', 'sidestep').P, 52.08);
    close(w('rogue', 'sidestep').G, 115.6);
  });
});

describe('FR-CLS-4 to FR-CLS-8: test creation', () => {
  it('bar: dur, zone, and target; Knight sweep × 1.15; 1 draw', () => {
    const r = seq(0.5);
    const t = createTest('attack', ctx({ tier: 2 }), r);
    close(t.dur, 1075.2);
    close(t.zone!, 0.65);
    close(t.target, 0.65 * 1075.2);
    expect(r.calls).toBe(1);
    close(createTest('attack', ctx({ cls: 'knight', tier: 2 }), seq(0)).dur, 1120 * 1.12 * 1.15);
    close(createTest('attack', ctx({ tier: 2, calm: true }), seq(0)).dur, 1075.2 * 1.6);
  });

  it('combo: three marks from z0, g1, g2 in that order; 3 draws', () => {
    const r = seq(0, 0.5, 1);
    const t = createTest('attack', ctx({ cls: 'rogue', tier: 3 }), r);
    const dur = 1380 * 0.82;
    close(t.dur, dur);
    t.marks!.forEach((m, i) => close(m, [0.22, 0.465, 0.735][i]! * dur));
    close(t.target, t.marks![2]);
    expect(r.calls).toBe(3);
  });

  it('charge: fill, target hold 0.82 × fill, dur 2600 × calm; no draw', () => {
    const r = seq();
    const t = createTest('attack', ctx({ cls: 'mage', tier: 4 }), r);
    close(t.fill!, 792);
    close(t.target, 649.44);
    expect(t.dur).toBe(2600);
    expect(createTest('attack', ctx({ cls: 'mage', tier: 4, calm: true }), r).dur).toBe(4160);
    expect(r.calls).toBe(0);
  });

  it('ring normal and quick, with the phase-2 speed; no draw', () => {
    const r = seq();
    const n = createTest('defend', ctx({ mode: 'ring', tier: 1 }), r);
    close(n.target, 1027.2);
    close(n.dur, 1027.2 + 153);
    close(createTest('defend', ctx({ mode: 'ring', tier: 5, pattern: 'quick' }), r).target, 614.4);
    close(createTest('defend', ctx({ mode: 'ring', tier: 5, patSpeed: 0.85 }), r).target, 750 * 0.96 * 0.85);
    expect(r.calls).toBe(0);
  });

  it('flaky: pause then pauseAt, target = base + pause; 2 draws', () => {
    const r = seq(0.5, 0.2);
    const t = createTest('defend', ctx({ mode: 'ring', tier: 3, pattern: 'flaky' }), r);
    close(t.pause!, 412.8);
    close(t.pauseAt!, 873.6 * 0.45);
    close(t.target, 873.6 + 412.8);
    close(t.dur, t.target + 153);
    expect(r.calls).toBe(2);
  });

  it('conflict: distance then side; the solid ring stays at base; 2 draws', () => {
    const r = seq(0.5, 0.7);
    const t = createTest('defend', ctx({ mode: 'ring', tier: 4, pattern: 'conflict' }), r);
    close(t.target, 796.8);
    close(t.decoy!, 796.8 + 345.6);
    expect(r.calls).toBe(2);
    const k = createTest('defend', ctx({ cls: 'knight', mode: 'shield', tier: 4, pattern: 'conflict', aura: 4, mods: { linter: true, elf: true } }), seq(0, 0.2));
    close(k.decoy!, k.target - 1.6 * 262.5);
  });

  it('shield and sidestep are timed like the ring', () => {
    const s = createTest('defend', ctx({ cls: 'knight', mode: 'shield', tier: 2 }), seq());
    close(s.target, 990 * 1.12);
    const d = createTest('defend', ctx({ cls: 'rogue', mode: 'sidestep', tier: 2 }), seq());
    close(d.target, 990 * 0.82);
    close(d.dur, d.target + 115.6);
  });
});

const T = (o: Partial<QteTest>): QteTest => ({ kind: 'attack', mode: 'bar', pattern: 'normal', P: 50, G: 100, dur: 1000, target: 600, ...o });

describe('FR-COM-5: single-press grading (bar, ring, sidestep)', () => {
  const bar = T({});
  const g = (events: InputEvent[], now = 5000) => grade(bar, events, now, false);

  it('P, G, and the early/late reasons', () => {
    expect(g([down(600)])).toEqual({ grade: 'perfect' });
    expect(g([down(650)])).toEqual({ grade: 'perfect' });
    expect(g([down(651)])).toEqual({ grade: 'good' });
    expect(g([down(500)])).toEqual({ grade: 'good' });
    expect(g([down(499)])).toEqual({ grade: 'miss', why: 'too early' });
    expect(g([down(701)])).toEqual({ grade: 'miss', why: 'too late' });
  });

  it('presses before 120 ms are ignored; the first counted press decides', () => {
    expect(g([down(119), down(600)])).toEqual({ grade: 'perfect' });
    expect(g([down(120)])).toEqual({ grade: 'miss', why: 'too early' });
    expect(g([down(600), down(300)])).toEqual({ grade: 'miss', why: 'too early' });
  });

  it('miss "too late" at dur + 30; null before', () => {
    expect(g([], 1029)).toBeNull();
    expect(g([], 1030)).toEqual({ grade: 'miss', why: 'too late' });
    expect(testDeadline(bar, [], false)).toBe(1030);
    expect(g([down(1200)])).toEqual({ grade: 'miss', why: 'too late' });
  });

  it('a press at the deadline is graded before it', () => {
    const wide = T({ G: 500 });
    expect(grade(wide, [down(1030)], 1030, false)).toEqual({ grade: 'good' });
  });

  it('ring and sidestep grade the same way; releases do nothing', () => {
    for (const mode of ['ring', 'sidestep'] as const) {
      const t = T({ kind: 'defend', mode });
      expect(grade(t, [up(300), down(610)], 610, false)).toEqual({ grade: 'perfect' });
    }
  });

  it('events later than now are not counted yet', () => {
    expect(g([down(600)], 599)).toBeNull();
  });
});

describe('FR-CLS-5: combo grading', () => {
  const c = T({ mode: 'combo', marks: [300, 600, 900], target: 900, P: 40, G: 80, dur: 1100 });
  const g = (events: InputEvent[], now = 5000) => grade(c, events, now, false);

  it('three presses, each against the next mark', () => {
    expect(g([down(300), down(610), down(960)])).toEqual({ grade: ['perfect', 'perfect', 'good'] });
    expect(g([down(300), down(610)], 900)).toBeNull();
  });

  it('marks passed by more than G are Miss before the press is graded', () => {
    expect(g([down(650), down(900)])).toEqual({ grade: ['miss', 'good', 'perfect'] });
    expect(g([down(700)])).toEqual({ grade: ['miss', 'miss', 'miss'] });
    expect(g([down(1000)])).toEqual({ grade: ['miss', 'miss', 'miss'] });
  });

  it('at dur + 30 the remaining marks are Miss; "too late" only if all three are', () => {
    expect(g([down(300)], 1129)).toBeNull();
    expect(g([down(300)], 1130)).toEqual({ grade: ['perfect', 'miss', 'miss'] });
    expect(g([], 1130)).toEqual({ grade: ['miss', 'miss', 'miss'], why: 'too late' });
    expect(testDeadline(c, [down(300)], false)).toBe(1130);
  });
});

describe('FR-CLS-6: charge grading', () => {
  const ch = T({ mode: 'charge', fill: 800, target: 656, P: 50, G: 100, dur: 2600 });
  const g = (events: InputEvent[], now = 9000) => grade(ch, events, now, false);

  it('graded on the hold length at release', () => {
    expect(g([down(200), up(856)])).toEqual({ grade: 'perfect' });
    expect(g([down(200), up(956)])).toEqual({ grade: 'good' });
    expect(g([down(200), up(700)])).toEqual({ grade: 'miss', why: 'too weak' });
    expect(g([down(200), up(990)])).toEqual({ grade: 'miss', why: 'overload' });
    expect(g([down(200), up(1000)])).toEqual({ grade: 'miss', why: 'overload' });
  });

  it('too slow at dur without a press', () => {
    expect(g([], 2599)).toBeNull();
    expect(g([], 2600)).toEqual({ grade: 'miss', why: 'too slow' });
    expect(testDeadline(ch, [], false)).toBe(2600);
  });

  it('overload at press + fill + 20 while still held', () => {
    expect(g([down(200)], 1019)).toBeNull();
    expect(g([down(200)], 1020)).toEqual({ grade: 'miss', why: 'overload' });
    expect(testDeadline(ch, [down(200)], false)).toBe(1020);
  });

  it('FR-CLS-9: a release from another key is ignored; a second press does not restart the hold', () => {
    expect(g([down(200, 'k'), up(856, 'pointer')])).toEqual({ grade: 'miss', why: 'overload' });
    expect(g([down(200), down(400), up(856)])).toEqual({ grade: 'perfect' });
    expect(g([down(100), down(300), up(956)])).toEqual({ grade: 'perfect' });
  });
});

describe('FR-CLS-8: shield grading', () => {
  const sh = T({ kind: 'defend', mode: 'shield', target: 800, P: 50, G: 100, dur: 900 });
  const g = (events: InputEvent[], now = 5000) => grade(sh, events, now, false);

  it('held at impact: Perfect if raised within P before impact, otherwise Good', () => {
    expect(g([down(760)])).toEqual({ grade: 'perfect' });
    expect(g([down(750)])).toEqual({ grade: 'perfect' });
    expect(g([down(500)])).toEqual({ grade: 'good' });
    expect(g([down(800)])).toEqual({ grade: 'perfect' });
    expect(g([down(500)], 799)).toBeNull();
  });

  it('a press after impact within P parries', () => {
    expect(g([down(840)])).toEqual({ grade: 'perfect' });
    expect(g([down(840)], 840)).toEqual({ grade: 'perfect' });
  });

  it('miss at target + P + 10: "no shield" or "shield down"', () => {
    expect(g([], 859)).toBeNull();
    expect(g([], 860)).toEqual({ grade: 'miss', why: 'no shield' });
    expect(g([down(500), up(700)])).toEqual({ grade: 'miss', why: 'shield down' });
    expect(g([down(851)])).toEqual({ grade: 'miss', why: 'no shield' });
  });

  it('FR-CLS-9: a release from another key does not drop the shield', () => {
    expect(g([down(500, 'k'), up(700, 'pointer')])).toEqual({ grade: 'good' });
  });

  it('deadlines: impact while held, otherwise the miss time', () => {
    expect(testDeadline(sh, [], false)).toBe(860);
    expect(testDeadline(sh, [down(500)], false)).toBe(800);
    expect(testDeadline(sh, [down(500), up(600)], false)).toBe(860);
  });
});

describe('FR-COM-7: Auto-timing', () => {
  it('Good at the target (charge at 300 ms), events ignored', () => {
    const bar = T({});
    expect(grade(bar, [down(600)], 599, true)).toBeNull();
    expect(grade(bar, [down(600)], 600, true)).toEqual({ grade: 'good' });
    expect(testDeadline(bar, [], true)).toBe(600);
    const ch = T({ mode: 'charge', fill: 800, target: 656 });
    expect(grade(ch, [], 300, true)).toEqual({ grade: 'good' });
    expect(testDeadline(ch, [], true)).toBe(300);
    const c = T({ mode: 'combo', marks: [300, 600, 900], target: 900 });
    expect(grade(c, [], 900, true)).toEqual({ grade: ['good', 'good', 'good'] });
  });
});

describe('FR-COM-5, FR-CLS-9: grade text', () => {
  it('every label', () => {
    expect(GRADE_LABELS).toEqual({
      bar: { perfect: 'CRITICAL!', good: 'GOOD HIT', miss: 'GLANCING BLOW' },
      charge: { perfect: 'CRITICAL SPELL!', good: 'SPELL HIT', miss: 'FIZZLE' },
      ring: { perfect: 'PERFECT DODGE!', good: 'BLOCKED', miss: 'HIT!' },
      sidestep: { perfect: 'PERFECT SIDESTEP!', good: 'GRAZED', miss: 'HIT!' },
      shield: { perfect: 'PERFECT PARRY!', good: 'BLOCKED', miss: 'HIT!' },
    });
    for (const mode of Object.keys(GRADE_LABELS) as (keyof typeof GRADE_LABELS)[])
      for (const g of ['perfect', 'good', 'miss'] as const)
        expect(gradeText(mode, { grade: g })).toEqual({ text: GRADE_LABELS[mode][g], cls: g });
  });

  it('the reason in upper case before the label', () => {
    expect(gradeText('bar', { grade: 'miss', why: 'too early' }).text).toBe('TOO EARLY · GLANCING BLOW');
    expect(gradeText('shield', { grade: 'miss', why: 'shield down' }).text).toBe('SHIELD DOWN · HIT!');
    expect(gradeText('ring', { grade: 'good', why: 'rubber duck' })).toEqual({ text: 'RUBBER DUCK · BLOCKED', cls: 'good' });
  });

  it('combo text and class', () => {
    expect(gradeText('combo', { grade: ['perfect', 'perfect', 'perfect'] })).toEqual({ text: 'PERFECT COMBO!', cls: 'perfect' });
    expect(gradeText('combo', { grade: ['perfect', 'good', 'miss'] })).toEqual({ text: '2/3 HITS · P G M', cls: 'good' });
    expect(gradeText('combo', { grade: ['miss', 'miss', 'good'] })).toEqual({ text: '1/3 HITS · M M G', cls: 'miss' });
    expect(gradeText('combo', { grade: ['miss', 'miss', 'miss'], why: 'too late' }).text).toBe('TOO LATE · 0/3 HITS · M M M');
  });
});
