// The timing-test gauge (presentation requirement 11.2; prototype drawQte). A 2D canvas drawn over or under
// the arena, independent of WebGL (requirement 22.6). Times are test time: ms since the test started.
import { QTE, type Grade, type InputEvent, type QteTest } from '../engine';
import { drawHitMeter, type HitLog } from './hit-meter';
import { GRADE_COLORS } from './palette';
import { glow, rrect } from './sprites/draw';

/** The gauge canvas in CSS px. */
export const GAUGE = { w: 320, h: 150 } as const;

export type GaugeOpts = {
  /** `performance.now()`, for shimmer and blink animations only. */
  now: number;
  assist: boolean;
  reduced: boolean;
  /** The test's input events so far (test time, after the offset), for charge, shield, and combo state. */
  events: readonly InputEvent[];
  /** The timing offset in ms (settings), subtracted from `t` for the colour cue and the approach strip. */
  offset?: number;
  /** The hit-error history, drawn as the meter while no test runs (requirement 17.4). */
  hits?: Readonly<HitLog>;
};

const GOLD = GRADE_COLORS.perfect;
const GREEN = GRADE_COLORS.good;
const RED = GRADE_COLORS.miss;
const GOOD_FILL = 'rgba(38,166,65,.85)';
const TRACK = '#1b2233';
/** Gold windows narrower than this (px, half-width) are widened so they stay visible. */
const MIN_GOLD_HALF = 2;
const FONT = '9px "Press Start 2P", monospace';

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

const RING_HEAD = {
  normal: 'DODGE! SPACE ON THE GOLD',
  quick: 'AGAIN! FAST!',
  flaky: "FLAKY! DON'T TRUST THE PAUSE",
  conflict: 'CONFLICT! DODGE THE SOLID RING',
} as const;

/** The gauge headline (requirement 11.2). `charging` is true once a charge test's key is held. */
export function gaugeHeadline(test: Pick<QteTest, 'mode' | 'pattern'>, assist: boolean, charging = false): string {
  if (assist) return 'AUTO-TIMING';
  switch (test.mode) {
    case 'bar':
      return 'STRIKE! SPACE IN THE GOLD';
    case 'combo':
      return 'COMBO! HIT ALL 3 GOLD MARKS';
    case 'charge':
      return charging ? 'RELEASE IN THE GOLD!' : 'HOLD SPACE TO CHARGE';
    case 'shield':
      return test.pattern === 'conflict' ? 'SOLID RING! HOLD, TAP AT IMPACT' : 'HOLD TO BLOCK · TAP AT IMPACT';
    case 'sidestep':
      return RING_HEAD[test.pattern].replace('DODGE!', 'SIDESTEP!');
    default:
      return RING_HEAD[test.pattern];
  }
}

/** Key presses the engine counts: downs at or after the grace time, in time order. */
const downs = (events: readonly InputEvent[]): InputEvent[] =>
  events.filter((e) => e.type === 'down' && e.t >= QTE.grace).sort((a, b) => a.t - b.t);

/** The test time a charge test's key went down, or null while not charging. */
export function chargeDownAt(events: readonly InputEvent[]): number | null {
  return downs(events)[0]?.t ?? null;
}

/** True while the shield key is held (the last counted press has not been released with the same key). */
export function shieldHeld(events: readonly InputEvent[]): boolean {
  let key: string | null = null;
  const ordered = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
  for (const { e } of ordered) {
    if (e.type === 'down' && e.t >= QTE.grace) key = e.key;
    else if (e.type === 'up' && key !== null && e.key === key) key = null;
  }
  return key !== null;
}

/** The combo marks graded so far, as the engine grades them (skipped marks count as misses). */
export function comboHits(test: QteTest, events: readonly InputEvent[]): Grade[] {
  const marks = test.marks ?? [test.target, test.target, test.target];
  const hits: Grade[] = [];
  for (const e of downs(events)) {
    let i = hits.length;
    while (i < 3 && e.t > marks[i]! + test.G) {
      hits.push('miss');
      i++;
    }
    if (i >= 3) break;
    const a = Math.abs(e.t - marks[i]!);
    hits.push(a <= test.P ? 'perfect' : a <= test.G ? 'good' : 'miss');
    if (hits.length >= 3) break;
  }
  return hits;
}

/** The ring's effective time: a flaky ring stops at `pauseAt` for `pause` ms. */
export function ringTime(test: QteTest, t: number): { eff: number; paused: boolean; base: number } {
  const flaky = test.pattern === 'flaky' && test.pauseAt !== undefined && test.pause !== undefined;
  if (!flaky) return { eff: t, paused: false, base: test.target };
  const pauseAt = test.pauseAt!;
  const pause = test.pause!;
  const paused = t >= pauseAt && t < pauseAt + pause;
  return { eff: t < pauseAt ? t : paused ? pauseAt : t - pause, paused, base: test.target - pause };
}

/**
 * The colour cue (requirement 17.1): `perfect` while the offset-corrected time is inside the Perfect window,
 * `good` inside the Good window, else null.
 */
export function ringCue(test: QteTest, t: number, offset = 0): 'perfect' | 'good' | null {
  const d = Math.abs(t - offset - test.target);
  return d <= test.P ? 'perfect' : d <= test.G ? 'good' : null;
}

/** The approach strip's track (requirement 17.2): from the test start to impact plus G, in CSS px. */
export const STRIP = { x0: 30, w: GAUGE.w - 60, y: 134, h: 10 } as const;

/** The strip x of test time `ms` for a ring whose impact (without a flaky pause) is `base`. */
export function stripX(test: QteTest, base: number, ms: number): number {
  return STRIP.x0 + STRIP.w * clamp(ms / (base + test.G), 0, 1);
}

function drawStrip(ctx: CanvasRenderingContext2D, q: QteTest, eff: number, base: number, blink: boolean, offset: number): void {
  const { y, h } = STRIP;
  const X = (ms: number) => stripX(q, base, ms);
  ctx.fillStyle = TRACK;
  rrect(ctx, STRIP.x0, y - h / 2, STRIP.w, h, 4);
  ctx.fill();
  band(ctx, X(base), (X(base + q.G) - X(base - q.G)) / 2, y - h / 2, h, GOOD_FILL, false);
  band(ctx, X(base), (X(base + q.P) - X(base - q.P)) / 2, y - h / 2, h, GOLD, true);
  if (q.decoy !== undefined && q.pattern !== 'flaky') {
    ctx.fillStyle = 'rgba(200,170,255,.9)';
    for (let yy = -h / 2; yy < h / 2; yy += 3) ctx.fillRect(X(q.decoy) - 1, y + yy, 2, 2);
  }
  ctx.fillStyle = blink ? '#9fe3b0' : '#ffffff';
  ctx.fillRect(X(eff - offset) - 2, y - h / 2 - 5, 4, h + 10);
}

function panel(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(6,8,16,.66)';
  rrect(ctx, 1, 1, GAUGE.w - 2, GAUGE.h - 2, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A horizontal window band centred on `cx` with half-width `half`; gold bands get a minimum width and an edge. */
function band(ctx: CanvasRenderingContext2D, cx: number, half: number, y: number, h: number, fill: string, gold: boolean): void {
  const hw = gold ? Math.max(MIN_GOLD_HALF, half) : half;
  ctx.fillStyle = fill;
  ctx.fillRect(cx - hw, y, hw * 2, h);
  if (gold) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(cx - hw, y, 1, h);
    ctx.fillRect(cx + hw - 1, y, 1, h);
  }
}

function cursor(ctx: CanvasRenderingContext2D, px: number, y: number, hgt: number): void {
  ctx.fillStyle = '#fff';
  ctx.fillRect(px - 2, y - hgt / 2 - 7, 4, hgt + 14);
  ctx.beginPath();
  ctx.moveTo(px - 6, y - hgt / 2 - 9);
  ctx.lineTo(px + 6, y - hgt / 2 - 9);
  ctx.lineTo(px, y - hgt / 2 - 2);
  ctx.fill();
}

function drawBar(ctx: CanvasRenderingContext2D, q: QteTest, t: number, o: GaugeOpts): void {
  const x0 = 20, w = GAUGE.w - 40, y = 60, hgt = 18;
  const cx = x0 + w * (q.target / q.dur), gw = w * (q.G / q.dur), pw = w * (q.P / q.dur);
  ctx.fillStyle = GOLD;
  ctx.fillText(gaugeHeadline(q, o.assist), GAUGE.w / 2, 24);
  ctx.fillStyle = TRACK;
  rrect(ctx, x0, y - hgt / 2, w, hgt, 5);
  ctx.fill();
  band(ctx, cx, gw, y - hgt / 2, hgt, GOOD_FILL, false);
  band(ctx, cx, pw, y - hgt / 2, hgt, GOLD, true);
  if (!o.reduced) {
    const sh = ((o.now / 6) % (pw * 2 + 20)) - 10;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(clamp(cx - pw + sh, cx - pw, cx + pw - 3), y - hgt / 2, 3, hgt);
  }
  const px = x0 + w * clamp(t / q.dur, 0, 1);
  if (px > x0) {
    const trail = ctx.createLinearGradient(px - 40, 0, px, 0);
    trail.addColorStop(0, 'rgba(255,255,255,0)');
    trail.addColorStop(1, 'rgba(255,255,255,.35)');
    ctx.fillStyle = trail;
    ctx.fillRect(Math.max(x0, px - 40), y - hgt / 2, Math.min(40, px - x0), hgt);
  }
  cursor(ctx, px, y, hgt);
}

function drawCombo(ctx: CanvasRenderingContext2D, q: QteTest, t: number, o: GaugeOpts): void {
  const x0 = 20, w = GAUGE.w - 40, y = 60, hgt = 18;
  const marks = q.marks ?? [q.target, q.target, q.target];
  const hits = comboHits(q, o.events);
  ctx.fillStyle = '#9fe3b0';
  ctx.fillText(gaugeHeadline(q, o.assist), GAUGE.w / 2, 24);
  ctx.fillStyle = TRACK;
  rrect(ctx, x0, y - hgt / 2, w, hgt, 5);
  ctx.fill();
  marks.forEach((z, i) => {
    const cx = x0 + w * (z / q.dur), gw = w * (q.G / q.dur), pw = w * (q.P / q.dur), g = hits[i];
    band(ctx, cx, gw, y - hgt / 2, hgt, g ? 'rgba(80,90,110,.6)' : GOOD_FILL, false);
    band(ctx, cx, pw, y - hgt / 2, hgt, g ? 'rgba(120,120,120,.6)' : GOLD, !g);
    if (g) {
      ctx.fillStyle = GRADE_COLORS[g];
      ctx.fillRect(cx - 5, y + hgt / 2 + 5, 10, 10);
    }
  });
  cursor(ctx, x0 + w * clamp(t / q.dur, 0, 1), y, hgt);
}

function drawCharge(ctx: CanvasRenderingContext2D, q: QteTest, t: number, o: GaugeOpts): void {
  const x0 = 30, w = GAUGE.w - 60, y = 62, hgt = 22;
  const fill = q.fill ?? q.target;
  const downAt = chargeDownAt(o.events);
  const held = downAt === null ? 0 : t - downAt;
  const k = clamp(held / fill, 0, 1);
  ctx.fillStyle = '#ffb38a';
  ctx.fillText(gaugeHeadline(q, o.assist, downAt !== null), GAUGE.w / 2, 24);
  ctx.fillStyle = TRACK;
  rrect(ctx, x0, y - hgt / 2, w, hgt, 6);
  ctx.fill();
  const at = (ms: number) => x0 + w * clamp(ms / fill, 0, 1);
  const cx = at(q.target);
  band(ctx, cx, (at(q.target + q.G) - at(q.target - q.G)) / 2, y - hgt / 2, hgt, 'rgba(38,166,65,.6)', false);
  band(ctx, cx, (at(q.target + q.P) - at(q.target - q.P)) / 2, y - hgt / 2, hgt, 'rgba(255,210,87,.9)', true);
  // The red overload end.
  ctx.fillStyle = 'rgba(255,60,60,.55)';
  ctx.fillRect(x0 + w * 0.97, y - hgt / 2, w * 0.03, hgt);
  const fg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  fg.addColorStop(0, '#7a2a1e');
  fg.addColorStop(0.7, '#ff7a3c');
  fg.addColorStop(1, '#ffffff');
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = fg;
  ctx.fillRect(x0, y - hgt / 2 + 4, w * k, hgt - 8);
  ctx.restore();
  if (downAt !== null && !o.reduced) glow(ctx, x0 + w * k, y, 22 + 14 * k, 'rgba(255,140,60,A)', 0.5);
  if (downAt === null) {
    ctx.globalAlpha = o.reduced ? 1 : 0.5 + 0.5 * Math.sin(o.now / 120);
    ctx.fillStyle = '#ffb38a';
    ctx.fillText('▼', GAUGE.w / 2, 44);
    ctx.globalAlpha = 1;
  }
}

function drawShieldIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, up: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = up ? '#9fd8ff' : 'rgba(143,163,191,.35)';
  ctx.strokeStyle = up ? '#ffffff' : 'rgba(255,255,255,.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -9);
  ctx.lineTo(8, -9);
  ctx.lineTo(8, 1);
  ctx.quadraticCurveTo(8, 8, 0, 11);
  ctx.quadraticCurveTo(-8, 8, -8, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (up) glow(ctx, cx, cy, 34, 'rgba(159,216,255,A)', 0.35);
}

/** Ring, sidestep, and shield: a ring shrinking onto the gold target ring at impact. */
function drawRing(ctx: CanvasRenderingContext2D, q: QteTest, t: number, o: GaugeOpts): void {
  const cx = GAUGE.w / 2, cy = 64, r0 = 14, R = 50;
  const { eff, paused, base } = ringTime(q, t);
  const k = eff / base;
  const pr = (R - r0) * (q.P / base), gr = (R - r0) * (q.G / base);
  const blink = paused && Math.floor(o.now / 70) % 2 === 1;
  ctx.fillStyle = q.pattern === 'conflict' ? '#d9c6ff' : q.pattern === 'flaky' ? '#9fe3b0' : '#ff9a9a';
  ctx.fillText(gaugeHeadline(q, o.assist), GAUGE.w / 2, 9);
  if (q.decoy !== undefined && t < q.decoy + 90) {
    const kd = t / q.decoy, rd = Math.max(2, r0 + (R - r0) * (1 - kd));
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = o.reduced ? 0 : o.now / 30;
    ctx.strokeStyle = kd > 1 ? 'rgba(180,140,255,.3)' : 'rgba(200,170,255,.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rd, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // The cue glow, the Good band around the target ring, then the gold target ring as thick as the Perfect window.
  const offset = o.offset ?? 0;
  const cue = ringCue(q, t, offset);
  if (cue) glow(ctx, cx, cy, r0 * 3.4, cue === 'perfect' ? 'rgba(255,210,87,A)' : 'rgba(57,211,83,A)', cue === 'perfect' ? 0.6 : 0.35);
  ctx.fillStyle = 'rgba(38,166,65,.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, r0 + gr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(3, pr * 2);
  ctx.beginPath();
  ctx.arc(cx, cy, r0, 0, Math.PI * 2);
  ctx.stroke();
  const jit = paused && !o.reduced ? (Math.random() - 0.5) * 3 : 0;
  const r = Math.max(2, r0 + (R - r0) * (1 - k) + jit);
  ctx.strokeStyle =
    cue === 'perfect' ? GOLD : cue === 'good' ? GREEN : k > 1 ? 'rgba(255,107,107,.5)' : blink ? '#9fe3b0' : RED;
  ctx.lineWidth = cue === 'perfect' ? 5 : q.pattern === 'quick' ? 4 : 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  drawStrip(ctx, q, eff, base, blink, offset);
  if (q.mode === 'shield') drawShieldIcon(ctx, cx, cy, shieldHeld(o.events));
}

/**
 * Draws the gauge for `test` at test time `t` (ms since the test started, before the offset) on a `GAUGE`-sized
 * context. With no test it draws the hit-error meter when there is one, else nothing.
 */
export function drawQte(ctx: CanvasRenderingContext2D, test: QteTest | null, t: number, opts: GaugeOpts): void {
  ctx.clearRect(0, 0, GAUGE.w, GAUGE.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!test) {
    if (!opts.hits?.log.length) return;
    panel(ctx);
    drawHitMeter(ctx, opts.hits, GAUGE.w, 70);
    return;
  }
  panel(ctx);
  ctx.font = FONT;
  if (test.mode === 'combo') drawCombo(ctx, test, t, opts);
  else if (test.mode === 'charge') drawCharge(ctx, test, t, opts);
  else if (test.mode === 'bar') drawBar(ctx, test, t, opts);
  else drawRing(ctx, test, t, opts);
}
