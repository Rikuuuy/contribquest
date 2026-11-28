import { describe, expect, it } from 'vitest';
import type { InputEvent, Mode, Pattern, QteTest } from '../../src/engine';
import { GRADE_COLORS } from '../../src/render/palette';
import { GAUGE, chargeDownAt, comboHits, drawQte, gaugeHeadline, ringTime, shieldHeld } from '../../src/render/qte-gauge';
import { callsOf, recordingCtx, textsOf } from '../fixtures/canvas';

const GOLD = GRADE_COLORS.perfect;
const MODES: Mode[] = ['bar', 'combo', 'charge', 'ring', 'sidestep', 'shield'];
const PATTERNS: Pattern[] = ['normal', 'quick', 'flaky', 'conflict'];

function test(mode: Mode, pattern: Pattern = 'normal', o: Partial<QteTest> = {}): QteTest {
  const base = { kind: mode === 'bar' || mode === 'combo' || mode === 'charge' ? 'attack' : 'defend', mode, pattern, P: 40, G: 100 } as const;
  if (mode === 'bar') return { ...base, dur: 1000, target: 600, zone: 0.6, ...o };
  if (mode === 'combo') return { ...base, dur: 1200, target: 1000, marks: [400, 700, 1000], ...o };
  if (mode === 'charge') return { ...base, dur: 2000, target: 800, fill: 1000, ...o };
  return { ...base, dur: 900, target: 800, ...o };
}

const down = (t: number, key = ' '): InputEvent => ({ type: 'down', t, key });
const up = (t: number, key = ' '): InputEvent => ({ type: 'up', t, key });
const draw = (q: QteTest | null, t: number, events: InputEvent[] = [], assist = false) => {
  const ctx = recordingCtx();
  drawQte(ctx, q, t, { now: 1000, assist, reduced: false, events });
  return ctx;
};

describe('requirement 11.2: gaugeHeadline', () => {
  it('strike modes', () => {
    for (const p of PATTERNS) {
      expect(gaugeHeadline(test('bar', p), false)).toBe('STRIKE! SPACE IN THE GOLD');
      expect(gaugeHeadline(test('combo', p), false)).toBe('COMBO! HIT ALL 3 GOLD MARKS');
      expect(gaugeHeadline(test('charge', p), false)).toBe('HOLD SPACE TO CHARGE');
      expect(gaugeHeadline(test('charge', p), false, true)).toBe('RELEASE IN THE GOLD!');
    }
  });

  it('ring by pattern', () => {
    expect(gaugeHeadline(test('ring', 'normal'), false)).toBe('DODGE! SPACE ON THE GOLD');
    expect(gaugeHeadline(test('ring', 'quick'), false)).toBe('AGAIN! FAST!');
    expect(gaugeHeadline(test('ring', 'flaky'), false)).toBe("FLAKY! DON'T TRUST THE PAUSE");
    expect(gaugeHeadline(test('ring', 'conflict'), false)).toBe('CONFLICT! DODGE THE SOLID RING');
  });

  it('sidestep replaces DODGE! with SIDESTEP!', () => {
    expect(gaugeHeadline(test('sidestep', 'normal'), false)).toBe('SIDESTEP! SPACE ON THE GOLD');
    expect(gaugeHeadline(test('sidestep', 'quick'), false)).toBe('AGAIN! FAST!');
    expect(gaugeHeadline(test('sidestep', 'flaky'), false)).toBe("FLAKY! DON'T TRUST THE PAUSE");
    expect(gaugeHeadline(test('sidestep', 'conflict'), false)).toBe('CONFLICT! DODGE THE SOLID RING');
  });

  it('shield', () => {
    for (const p of ['normal', 'quick', 'flaky'] as const) expect(gaugeHeadline(test('shield', p), false)).toBe('HOLD TO BLOCK · TAP AT IMPACT');
    expect(gaugeHeadline(test('shield', 'conflict'), false)).toBe('SOLID RING! HOLD, TAP AT IMPACT');
  });

  it('Auto-timing replaces every headline', () => {
    for (const m of MODES) for (const p of PATTERNS) {
      expect(gaugeHeadline(test(m, p), true)).toBe('AUTO-TIMING');
      expect(gaugeHeadline(test(m, p), true, true)).toBe('AUTO-TIMING');
    }
  });
});

describe('requirement 11.2: drawQte', () => {
  it('draws the headline for every mode and pattern', () => {
    for (const m of MODES) for (const p of PATTERNS) expect(textsOf(draw(test(m, p), 300))).toContain(gaugeHeadline(test(m, p), false));
    expect(textsOf(draw(test('charge'), 500, [down(200)]))).toContain('RELEASE IN THE GOLD!');
    expect(textsOf(draw(test('bar'), 300, [], true))).toContain('AUTO-TIMING');
  });

  it('bar: a visible gold window centred on the target, and a cursor that moves', () => {
    const q = test('bar');
    const gold = callsOf(draw(q, 0), 'fillRect', GOLD);
    expect(gold.length).toBeGreaterThan(0);
    const [x, , w] = gold[0]!.args as number[];
    expect(w).toBeGreaterThanOrEqual(4);
    expect(x! + w! / 2).toBeCloseTo(20 + 280 * 0.6);
    const cursorX = (t: number) => (callsOf(draw(q, t), 'fillRect', '#fff')[0]!.args[0] as number) + 2;
    expect(cursorX(0)).toBeCloseTo(20);
    expect(cursorX(500)).toBeCloseTo(20 + 140);
    expect(cursorX(5000)).toBeCloseTo(300);
  });

  it('bar: a very narrow Perfect window is still at least 4 px wide', () => {
    const gold = callsOf(draw(test('bar', 'normal', { P: 1 }), 0), 'fillRect', GOLD);
    expect(gold[0]!.args[2]).toBeGreaterThanOrEqual(4);
  });

  it('combo: three gold marks, greyed and graded once hit', () => {
    const q = test('combo');
    expect(callsOf(draw(q, 0), 'fillRect', GOLD)).toHaveLength(3);
    const ctx = draw(q, 500, [down(410)]);
    expect(callsOf(ctx, 'fillRect', GOLD)).toHaveLength(2 + 1); // two open marks plus the Perfect result square
    expect(callsOf(ctx, 'fillRect', 'rgba(120,120,120,.6)')).toHaveLength(1);
  });

  it('charge: gold window, red overload end, and a fill that grows while held', () => {
    const q = test('charge');
    const idle = draw(q, 400);
    expect(callsOf(idle, 'fillRect', 'rgba(255,210,87,.9)')).toHaveLength(1);
    expect(callsOf(idle, 'fillRect', 'rgba(255,60,60,.55)')).toHaveLength(1);
    const fillW = (t: number, ev: InputEvent[]) => {
      const ctx = draw(q, t, ev);
      const i = ctx.calls.findIndex((c) => c.name === 'save');
      return ctx.calls.slice(i).find((c) => c.name === 'fillRect')!.args[2] as number;
    };
    expect(fillW(400, [])).toBe(0);
    expect(fillW(700, [down(200)])).toBeCloseTo(260 * 0.5);
    expect(fillW(5000, [down(200)])).toBeCloseTo(260);
  });

  it('ring, sidestep, shield: a gold target ring and a shrinking ring', () => {
    for (const m of ['ring', 'sidestep', 'shield'] as const) {
      const q = test(m);
      const radii = (t: number) => callsOf(draw(q, t), 'arc').map((c) => c.args[2] as number);
      const goldRing = callsOf(draw(q, 0), 'stroke').filter((c) => c.strokeStyle === GOLD);
      expect(goldRing.length).toBeGreaterThan(0);
      expect(goldRing[0]!.lineWidth).toBeGreaterThanOrEqual(3);
      expect(radii(0).at(-1)).toBeCloseTo(50);
      expect(radii(400).at(-1)).toBeCloseTo(14 + 36 * 0.5);
      expect(radii(800).at(-1)).toBeCloseTo(14);
    }
  });

  it('conflict draws a dashed decoy ring before the decoy time', () => {
    const q = test('ring', 'conflict', { decoy: 600 });
    expect(callsOf(draw(q, 300), 'setLineDash')).toHaveLength(1);
    expect(callsOf(draw(q, 800), 'setLineDash')).toHaveLength(0);
  });

  it('shield raises its icon while held', () => {
    const q = test('shield');
    const iconFill = (ev: InputEvent[]) => callsOf(draw(q, 600, ev), 'quadraticCurveTo')[0]!.fillStyle;
    expect(iconFill([])).toBe('rgba(143,163,191,.35)');
    expect(iconFill([down(300)])).toBe('#9fd8ff');
    expect(iconFill([down(300), up(400)])).toBe('rgba(143,163,191,.35)');
  });

  it('with no test draws nothing but clears', () => {
    const ctx = draw(null, 0);
    expect(ctx.calls.map((c) => c.name)).toEqual(['clearRect']);
    expect(callsOf(ctx, 'clearRect')[0]!.args).toEqual([0, 0, GAUGE.w, GAUGE.h]);
  });
});

describe('gauge state from input events', () => {
  it('chargeDownAt ignores presses before the grace time', () => {
    expect(chargeDownAt([])).toBeNull();
    expect(chargeDownAt([down(50)])).toBeNull();
    expect(chargeDownAt([down(300), down(200)])).toBe(200);
  });

  it('shieldHeld follows the hold key', () => {
    expect(shieldHeld([down(200, 'a'), up(300, 'b')])).toBe(true);
    expect(shieldHeld([down(200, 'a'), up(300, 'a')])).toBe(false);
    expect(shieldHeld([down(50)])).toBe(false);
  });

  it('comboHits grades like the engine, skipped marks are misses', () => {
    const q = test('combo');
    expect(comboHits(q, [])).toEqual([]);
    expect(comboHits(q, [down(410), down(760)])).toEqual(['perfect', 'good']);
    expect(comboHits(q, [down(790)])).toEqual(['miss', 'good']);
    expect(comboHits(q, [down(850)])).toEqual(['miss', 'miss', 'miss']);
    expect(comboHits(q, [down(400), down(700), down(1000), down(1100)])).toEqual(['perfect', 'perfect', 'perfect']);
  });

  it('ringTime freezes a flaky ring during its pause', () => {
    const q = test('ring', 'flaky', { target: 1000, pauseAt: 300, pause: 200, dur: 1100 });
    expect(ringTime(q, 200)).toEqual({ eff: 200, paused: false, base: 800 });
    expect(ringTime(q, 400)).toEqual({ eff: 300, paused: true, base: 800 });
    expect(ringTime(q, 600)).toEqual({ eff: 400, paused: false, base: 800 });
    expect(ringTime(test('ring'), 400)).toEqual({ eff: 400, paused: false, base: 800 });
  });
});
