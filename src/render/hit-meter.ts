// Timing accuracy feedback (presentation requirement 17, FR-FX-9; prototype recordHit, offText, avgOffset,
// drawHitMeter). Every graded press records its signed error: negative is early, positive is late.
import { QTE, type InputEvent, type QteTest, type Why } from '../engine';
import { GRADE_COLORS } from './palette';
import { rrect } from './sprites/draw';

export const HIT_METER = {
  /** Ticks on the meter. */
  ticks: 12,
  /** Errors kept for the average (saved in settings). */
  hist: 20,
  /** Errors needed before the average shows and "Use my average" works. */
  minAvg: 5,
  /** Full half-width of the meter in ms. */
  range: 220,
  /** |error| below this reads "ON TIME". */
  onTime: 8,
  offsetMax: 150,
  offsetStep: 5,
} as const;

export type HitRecord = { off: number; P: number; G: number };
export type HitLog = { log: HitRecord[]; hist: number[] };

/** Appends one error: the meter keeps the last 12 records, the history the last 20 rounded errors. */
export function recordHit(h: Readonly<HitLog>, rec: HitRecord): HitLog {
  return {
    log: [...h.log, rec].slice(-HIT_METER.ticks),
    hist: [...h.hist, Math.round(rec.off)].slice(-HIT_METER.hist),
  };
}

/** "ON TIME", "N MS EARLY", or "N MS LATE". */
export function offText(off: number): string {
  return Math.abs(off) < HIT_METER.onTime ? 'ON TIME' : `${Math.abs(Math.round(off))} MS ${off < 0 ? 'EARLY' : 'LATE'}`;
}

/** The mean of the history, 0 when empty. */
export function avgOffset(hist: readonly number[]): number {
  return hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
}

/**
 * "Use my average" (requirement 17.5): the current offset plus the average, rounded to 5 ms and clamped to ±150.
 * Null with fewer than 5 errors. The caller clears the history after applying it.
 */
export function calibratedOffset(offset: number, hist: readonly number[]): number | null {
  if (hist.length < HIT_METER.minAvg) return null;
  const v = Math.round((offset + avgOffset(hist)) / HIT_METER.offsetStep) * HIT_METER.offsetStep;
  return Math.min(HIT_METER.offsetMax, Math.max(-HIT_METER.offsetMax, v)) + 0;
}

/** The grade line with the last error appended (none after a "why" such as TOO EARLY, as in the prototype). */
export function gradeLine(text: string, off: number | null, why?: Why): string {
  return off === null || why ? text : `${text} · ${offText(off)}`;
}

const sorted = (events: readonly InputEvent[]): InputEvent[] =>
  events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map((x) => x.e);

/**
 * The signed error recorded by input event `e` given the test's earlier events (all in offset-corrected test time),
 * or null when `e` is not graded against a target: presses in the grace time, early shield holds, extra charge
 * presses, charge overloads, and releases outside charge.
 */
export function pressError(test: QteTest, prior: readonly InputEvent[], e: InputEvent): number | null {
  const counted = (x: InputEvent) => x.type === 'down' && x.t >= QTE.grace;
  const before = sorted(prior);
  if (test.mode === 'charge') {
    const hold = before.find(counted);
    if (!hold || e.type !== 'up' || e.key !== hold.key || e.t < hold.t) return null;
    if (before.some((x) => x.type === 'up' && x.key === hold.key && x.t >= hold.t)) return null;
    const held = e.t - hold.t;
    return held < (test.fill ?? test.target) ? held - test.target : null;
  }
  if (!counted(e)) return null;
  if (test.mode === 'combo') {
    const marks = test.marks ?? [test.target, test.target, test.target];
    let i = 0;
    for (const x of [...before.filter(counted), e]) {
      while (i < 3 && x.t > marks[i]! + test.G) i++;
      if (i >= 3) return null;
      if (x === e) return e.t - marks[i]!;
      i++;
    }
    return null;
  }
  const off = e.t - test.target;
  if (test.mode === 'shield') return off > 0 ? (off <= test.P ? off : null) : -off <= test.G ? off : null;
  return off;
}

/**
 * The hit-error meter, centred at (w / 2, y): centre = target, ±220 ms full width, the last test's P and G as
 * bands, the last 12 errors as ticks with the newest highlighted, and the average once there are 5 errors.
 */
export function drawHitMeter(ctx: CanvasRenderingContext2D, h: Readonly<HitLog>, w: number, y: number): void {
  const last = h.log[h.log.length - 1];
  if (!last) return;
  const half = 130;
  const mid = w / 2;
  const X = (ms: number) => mid + Math.min(1, Math.max(-1, ms / HIT_METER.range)) * half;
  ctx.fillStyle = '#1b2233';
  rrect(ctx, mid - half - 4, y - 7, half * 2 + 8, 14, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(38,166,65,.75)';
  ctx.fillRect(X(-last.G), y - 7, X(last.G) - X(-last.G), 14);
  ctx.fillStyle = GRADE_COLORS.perfect;
  ctx.fillRect(X(-last.P), y - 7, X(last.P) - X(-last.P), 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mid - 1, y - 9, 2, 18);
  h.log.forEach((r, i) => {
    const latest = i === h.log.length - 1;
    const age = (h.log.length - 1 - i) / h.log.length;
    ctx.fillStyle = latest ? '#ff5a7a' : `rgba(255,140,170,${0.65 - age * 0.55})`;
    ctx.fillRect(X(r.off) - (latest ? 2 : 1), y - (latest ? 11 : 6), latest ? 4 : 2, latest ? 22 : 12);
  });
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b98ab';
  ctx.fillText('EARLY', mid - half - 2, y + 18);
  ctx.textAlign = 'right';
  ctx.fillText('LATE', mid + half + 2, y + 18);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9ab0';
  ctx.fillText(offText(last.off), X(last.off), y - 19);
  if (h.hist.length >= HIT_METER.minAvg) {
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#8b98ab';
    ctx.fillText(`Average over ${h.hist.length} presses: ${offText(avgOffset(h.hist)).toLowerCase()}`, mid, y + 34);
  }
}
