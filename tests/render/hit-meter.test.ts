import { describe, expect, it } from 'vitest';
import type { InputEvent, Mode, Pattern, QteTest } from '../../src/engine';
import {
  HIT_METER,
  avgOffset,
  calibratedOffset,
  drawHitMeter,
  gradeLine,
  offText,
  pressError,
  recordHit,
  type HitLog,
} from '../../src/render/hit-meter';
import { GRADE_COLORS } from '../../src/render/palette';
import { STRIP, drawQte, ringCue, stripX } from '../../src/render/qte-gauge';
import { callsOf, recordingCtx, textsOf } from '../fixtures/canvas';

const GOLD = GRADE_COLORS.perfect;
const GREEN = GRADE_COLORS.good;

function test(mode: Mode, pattern: Pattern = 'normal', o: Partial<QteTest> = {}): QteTest {
  const base = { kind: mode === 'bar' || mode === 'combo' || mode === 'charge' ? 'attack' : 'defend', mode, pattern, P: 40, G: 100 } as const;
  if (mode === 'bar') return { ...base, dur: 1000, target: 600, zone: 0.6, ...o };
  if (mode === 'combo') return { ...base, dur: 1200, target: 1000, marks: [400, 700, 1000], ...o };
  if (mode === 'charge') return { ...base, dur: 2000, target: 800, fill: 1000, ...o };
  return { ...base, dur: 900, target: 800, ...o };
}
const down = (t: number, key = ' '): InputEvent => ({ type: 'down', t, key });
const up = (t: number, key = ' '): InputEvent => ({ type: 'up', t, key });
const EMPTY: HitLog = { log: [], hist: [] };

describe('requirement 17.3: recorded errors and the grade line', () => {
  it('offText', () => {
    expect(offText(0)).toBe('ON TIME');
    expect(offText(7.9)).toBe('ON TIME');
    expect(offText(-7.9)).toBe('ON TIME');
    expect(offText(8)).toBe('8 MS LATE');
    expect(offText(-23.4)).toBe('23 MS EARLY');
    expect(offText(120.6)).toBe('121 MS LATE');
  });

  it('gradeLine appends the error unless there is a why or no error', () => {
    expect(gradeLine('CRITICAL!', -12)).toBe('CRITICAL! · 12 MS EARLY');
    expect(gradeLine('PERFECT DODGE!', 3)).toBe('PERFECT DODGE! · ON TIME');
    expect(gradeLine('HIT!', null)).toBe('HIT!');
    expect(gradeLine('TOO EARLY · GLANCING BLOW', -300, 'too early')).toBe('TOO EARLY · GLANCING BLOW');
  });

  it('bar, ring, sidestep: press time minus target; grace presses record nothing', () => {
    for (const m of ['bar', 'ring', 'sidestep'] as const) {
      const q = test(m);
      expect(pressError(q, [], down(q.target - 30))).toBe(-30);
      expect(pressError(q, [], down(q.target + 55))).toBe(55);
      expect(pressError(q, [], down(50))).toBeNull();
      expect(pressError(q, [], up(q.target))).toBeNull();
    }
  });

  it('combo: each press against its mark, skipped marks passed over', () => {
    const q = test('combo');
    expect(pressError(q, [], down(410))).toBe(10);
    expect(pressError(q, [down(410)], down(690))).toBe(-10);
    expect(pressError(q, [], down(790))).toBe(90); // mark 0 expired, graded against mark 1
    expect(pressError(q, [down(410), down(700), down(1000)], down(1050))).toBeNull();
  });

  it('charge: held time minus target on release; overloads and extra presses record nothing', () => {
    const q = test('charge');
    expect(pressError(q, [], down(200))).toBeNull();
    expect(pressError(q, [down(200)], up(950))).toBe(-50);
    expect(pressError(q, [down(200)], up(1030))).toBe(30);
    expect(pressError(q, [down(200)], up(1200))).toBeNull(); // held 1000 = fill: overload
    expect(pressError(q, [down(200)], up(950, 'x'))).toBeNull(); // another key
    expect(pressError(q, [down(200), up(500)], up(900))).toBeNull(); // already released
  });

  it('shield: parries near impact record, early holds do not', () => {
    const q = test('shield');
    expect(pressError(q, [], down(300))).toBeNull(); // early hold, 500 ms before impact
    expect(pressError(q, [], down(720))).toBe(-80); // within G before impact
    expect(pressError(q, [], down(830))).toBe(30); // within P after impact
    expect(pressError(q, [], down(860))).toBeNull(); // too late to parry
  });
});

describe('requirement 17.4: the history and the hit-error meter', () => {
  it('recordHit keeps the last 12 records and the last 20 rounded errors', () => {
    let h = EMPTY;
    for (let i = 0; i < 25; i++) h = recordHit(h, { off: i + 0.4, P: 40, G: 100 });
    expect(h.log).toHaveLength(HIT_METER.ticks);
    expect(h.log[0]!.off).toBeCloseTo(13.4);
    expect(h.hist).toHaveLength(HIT_METER.hist);
    expect(h.hist[0]).toBe(5);
    expect(h.hist.at(-1)).toBe(24);
    expect(EMPTY.log).toHaveLength(0);
  });

  it('draws nothing before the first error', () => {
    const ctx = recordingCtx();
    drawHitMeter(ctx, EMPTY, 320, 70);
    expect(ctx.calls).toHaveLength(0);
  });

  it('draws the P and G bands of the last test, a tick per error with the newest highlighted', () => {
    let h = EMPTY;
    h = recordHit(h, { off: -50, P: 30, G: 90 });
    h = recordHit(h, { off: 22, P: 44, G: 110 });
    const ctx = recordingCtx();
    drawHitMeter(ctx, h, 320, 70);
    const X = (ms: number) => 160 + (ms / 220) * 130;
    const gold = callsOf(ctx, 'fillRect', GOLD)[0]!.args as number[];
    expect(gold[0]).toBeCloseTo(X(-44));
    expect(gold[2]).toBeCloseTo(X(44) - X(-44));
    const newest = callsOf(ctx, 'fillRect', '#ff5a7a');
    expect(newest).toHaveLength(1);
    expect(newest[0]!.args[0]).toBeCloseTo(X(22) - 2);
    expect(ctx.calls.filter((c) => c.name === 'fillRect' && String(c.fillStyle).startsWith('rgba(255,140,170'))).toHaveLength(1);
    expect(textsOf(ctx)).toContain('22 MS LATE');
    expect(textsOf(ctx).some((t) => t.startsWith('Average'))).toBe(false);
  });

  it('clamps ticks to ±220 ms and shows the average from 5 errors', () => {
    let h = EMPTY;
    for (const off of [10, 20, 30, 40, 500]) h = recordHit(h, { off, P: 40, G: 100 });
    const ctx = recordingCtx();
    drawHitMeter(ctx, h, 320, 70);
    expect(callsOf(ctx, 'fillRect', '#ff5a7a')[0]!.args[0]).toBeCloseTo(160 + 130 - 2);
    expect(textsOf(ctx)).toContain('Average over 5 presses: 120 ms late');
  });

  it('drawQte shows the meter while no test runs', () => {
    const ctx = recordingCtx();
    drawQte(ctx, null, 0, { now: 0, assist: false, reduced: false, events: [], hits: recordHit(EMPTY, { off: -5, P: 40, G: 100 }) });
    expect(textsOf(ctx)).toContain('ON TIME');
    const none = recordingCtx();
    drawQte(none, null, 0, { now: 0, assist: false, reduced: false, events: [], hits: EMPTY });
    expect(none.calls.map((c) => c.name)).toEqual(['clearRect']);
  });
});

describe('requirement 17.5: Use my average', () => {
  it('needs 5 errors, rounds to 5 ms, clamps to ±150', () => {
    expect(avgOffset([])).toBe(0);
    expect(avgOffset([10, 20])).toBe(15);
    expect(calibratedOffset(0, [10, 20, 30, 40])).toBeNull();
    expect(calibratedOffset(0, [10, 20, 30, 40, 51])).toBe(30);
    expect(calibratedOffset(10, [-12, -12, -12, -12, -12])).toBe(0);
    expect(Object.is(calibratedOffset(0, [-1, -1, -1, -1, -1]), 0)).toBe(true);
    expect(calibratedOffset(140, [40, 40, 40, 40, 40])).toBe(150);
    expect(calibratedOffset(-140, [-40, -40, -40, -40, -40])).toBe(-150);
  });
});

describe('requirement 17.1: the colour cue', () => {
  it('ringCue uses the offset-corrected time', () => {
    const q = test('ring');
    expect(ringCue(q, 800)).toBe('perfect');
    expect(ringCue(q, 840)).toBe('perfect');
    expect(ringCue(q, 841)).toBe('good');
    expect(ringCue(q, 700)).toBe('good');
    expect(ringCue(q, 699)).toBeNull();
    expect(ringCue(q, 850, 50)).toBe('perfect');
    expect(ringCue(q, 800, 50)).toBe('good');
  });

  it('the moving ring is gold and thicker in Perfect, green in Good, red outside', () => {
    for (const m of ['ring', 'sidestep', 'shield'] as const) {
      const ringStroke = (t: number, offset = 0) => {
        const ctx = recordingCtx();
        drawQte(ctx, test(m), t, { now: 0, assist: false, reduced: true, events: [], offset });
        const lastArc = ctx.calls.map((c) => c.name).lastIndexOf('arc');
        return ctx.calls.slice(lastArc).find((c) => c.name === 'stroke')!;
      };
      expect(ringStroke(810)).toMatchObject({ strokeStyle: GOLD, lineWidth: 5 });
      expect(ringStroke(720)).toMatchObject({ strokeStyle: GREEN, lineWidth: 3 });
      expect(ringStroke(400)).toMatchObject({ strokeStyle: GRADE_COLORS.miss, lineWidth: 3 });
      expect(ringStroke(810, 100).strokeStyle).toBe(GREEN);
    }
  });
});

describe('requirement 17.2: the approach strip', () => {
  const strip = (q: QteTest, t: number, offset = 0, now = 0) => {
    const ctx = recordingCtx();
    drawQte(ctx, q, t, { now, assist: false, reduced: true, events: [], offset });
    return ctx.calls.filter((c) => c.name === 'fillRect' && (c.args[1] as number) <= STRIP.y + STRIP.h && (c.args[1] as number) + (c.args[3] as number) >= STRIP.y - STRIP.h);
  };
  const marker = (q: QteTest, t: number, offset = 0, now = 0) => {
    const m = strip(q, t, offset, now).filter((c) => c.args[2] === 4).at(-1)!;
    return (m.args[0] as number) + 2;
  };

  it('spans the test start to impact plus G with gold and green zones at impact', () => {
    const q = test('ring');
    const calls = strip(q, 0);
    const gold = calls.find((c) => c.fillStyle === GOLD)!.args as number[];
    expect(gold[0]! + gold[2]! / 2).toBeCloseTo(stripX(q, 800, 800));
    expect(gold[2]).toBeCloseTo((STRIP.w * 80) / 900);
    expect(calls.some((c) => c.fillStyle === 'rgba(38,166,65,.85)')).toBe(true);
    expect(stripX(q, 800, 0)).toBe(STRIP.x0);
    expect(stripX(q, 800, 900)).toBe(STRIP.x0 + STRIP.w);
  });

  it('the marker follows the offset-corrected time', () => {
    const q = test('ring');
    expect(marker(q, 450)).toBeCloseTo(stripX(q, 800, 450));
    expect(marker(q, 450, 50)).toBeCloseTo(stripX(q, 800, 400));
  });

  it('the flaky pause freezes the marker', () => {
    const q = test('ring', 'flaky', { target: 1000, pauseAt: 300, pause: 200, dur: 1100 });
    expect(marker(q, 300)).toBeCloseTo(stripX(q, 800, 300));
    expect(marker(q, 450)).toBeCloseTo(stripX(q, 800, 300));
    expect(marker(q, 600)).toBeCloseTo(stripX(q, 800, 400));
    expect(strip(q, 450, 0, 70).filter((c) => c.args[2] === 4).at(-1)!.fillStyle).toBe('#9fe3b0');
  });

  it('the conflict decoy is a dashed tick', () => {
    const q = test('ring', 'conflict', { decoy: 600 });
    const ticks = strip(q, 0).filter((c) => c.fillStyle === 'rgba(200,170,255,.9)');
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    for (const c of ticks) expect(c.args[0]).toBeCloseTo(stripX(q, 800, 600) - 1);
  });

  it('strike modes have no strip', () => {
    for (const m of ['bar', 'combo', 'charge'] as const) expect(strip(test(m), 0).filter((c) => c.args[1] === STRIP.y - STRIP.h / 2 - 5)).toHaveLength(0);
  });
});
