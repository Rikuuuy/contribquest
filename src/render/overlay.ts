// The 2D overlay canvas over the 3D canvas (v1.6, requirement 22.5; design "Modules"): floating text and the speech
// bubble, drawn in the pixel font with a dark stroke at the projected position of a world anchor. It imports no
// `three`; the world renderer passes a projector that reuses its own vectors. `pointer-events: none` comes from the
// `canvas.overlay` CSS rule.

/** Projects a world point to CSS pixels inside the overlay; false when it is behind the camera. */
export type Projector = (x: number, y: number, z: number, out: { x: number; y: number }) => boolean;

export type TextOpts = { color?: string; size?: number; life?: number };

type TextSlot = { text: string; font: string; color: string; size: number; x: number; y: number; z: number; born: number; max: number; active: boolean };
type Bubble = { text: string; x: number; y: number; z: number; born: number; max: number; active: boolean };

export type Overlay = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  /** CSS size and device pixel ratio. */
  w: number;
  h: number;
  dpr: number;
  texts: TextSlot[];
  bubble: Bubble;
  /** True while the canvas holds pixels that must be cleared. */
  dirty: boolean;
  p: { x: number; y: number };
};

/** Fixed number of floating texts; a new one replaces the oldest when all are busy. */
const MAX_TEXTS = 24;
/** The prototype stage is 440 logical px wide; text sizes scale from it. */
const LOGICAL_W = 440;
/** Prototype text rise: `vy = −42` px/s decaying at `exp(−2.5 t)`. */
const RISE_V = 42;
const RISE_DECAY = 2.5;
const FONT = '"Press Start 2P", monospace';
const STROKE = '#05060a';

/** Pixels a floating text has risen after `age` seconds (logical stage px); 0 when it fades in place. */
export function riseOffset(age: number, rise: boolean): number {
  return rise ? (RISE_V / RISE_DECAY) * (1 - Math.exp(-RISE_DECAY * Math.max(0, age))) : 0;
}

/** Text alpha: full for the first half of its life, then fading to 0. */
export function textAlpha(age: number, max: number): number {
  const k = age / Math.max(1e-3, max);
  return k < 0.5 ? 1 : Math.max(0, 1 - (k - 0.5) * 2);
}

/** Clamps a centre coordinate so a span of half-size `half` stays inside `[0, size]`. */
export function clampInside(v: number, half: number, size: number): number {
  return Math.min(Math.max(v, half), Math.max(half, size - half));
}

export function createOverlay(doc: Document = document): Overlay {
  const canvas = doc.createElement('canvas');
  canvas.className = 'overlay';
  canvas.setAttribute('aria-hidden', 'true');
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    w: 1,
    h: 1,
    dpr: 1,
    texts: Array.from({ length: MAX_TEXTS }, () => ({ text: '', font: '', color: '#fff', size: 10, x: 0, y: 0, z: 0, born: 0, max: 1, active: false })),
    bubble: { text: '', x: 0, y: 0, z: 0, born: 0, max: 1, active: false },
    dirty: true,
    p: { x: 0, y: 0 },
  };
}

/** Sizes the backing store to `w × h` CSS px at `dpr`. */
export function sizeOverlay(o: Overlay, w: number, h: number, dpr: number): void {
  if (w < 1 || h < 1) return;
  o.w = w;
  o.h = h;
  o.dpr = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  o.canvas.width = Math.round(w * o.dpr);
  o.canvas.height = Math.round(h * o.dpr);
  for (const t of o.texts) t.font = '';
  o.dirty = true;
}

/** Shows `text` floating up from world point (x, y, z). Sizes are the prototype's (10 by default, stage px). */
export function floatText(o: Overlay, text: string, x: number, y: number, z: number, now: number, opts: TextOpts = {}): void {
  let slot = o.texts.find((t) => !t.active);
  if (!slot) slot = o.texts.reduce((a, b) => (a.born <= b.born ? a : b));
  slot.text = text;
  slot.color = opts.color ?? '#ffffff';
  slot.size = opts.size ?? 10;
  slot.font = '';
  slot.x = x;
  slot.y = y;
  slot.z = z;
  slot.born = now;
  slot.max = (opts.life ?? 0.9) * 1000;
  slot.active = true;
}

/** Shows a speech bubble above world point (x, y, z) for `ms` (2.4 s by default). */
export function speechBubble(o: Overlay, text: string, x: number, y: number, z: number, now: number, ms = 2400): void {
  Object.assign(o.bubble, { text, x, y, z, born: now, max: ms, active: true });
}

/** Drops every text and the bubble. */
export function clearOverlay(o: Overlay): void {
  for (const t of o.texts) t.active = false;
  o.bubble.active = false;
}

/**
 * Draws the live texts and the bubble at their projected anchors, clamped inside the canvas. `rise` false makes
 * text fade in place (reduced motion). Clears the canvas only when it holds something. Allocates nothing per
 * frame once each text's font string is set.
 */
export function drawOverlay(o: Overlay, now: number, project: Projector, rise: boolean): void {
  const x = o.ctx;
  if (!x) return;
  let any = false;
  for (const t of o.texts) if (t.active && now - t.born >= t.max) t.active = false;
  if (o.bubble.active && now - o.bubble.born >= o.bubble.max) o.bubble.active = false;
  for (const t of o.texts) any = any || t.active;
  any = any || o.bubble.active;
  if (!any && !o.dirty) return;
  x.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  x.clearRect(0, 0, o.w, o.h);
  o.dirty = any;
  if (!any) return;
  const k = o.w / LOGICAL_W;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  for (const t of o.texts) {
    if (!t.active || !project(t.x, t.y, t.z, o.p)) continue;
    const age = (now - t.born) / 1000;
    const px = Math.max(6, Math.round(t.size * k));
    if (!t.font) t.font = `${px}px ${FONT}`;
    x.font = t.font;
    const half = x.measureText(t.text).width / 2 + 4;
    const cx = clampInside(o.p.x, half, o.w);
    const cy = clampInside(o.p.y - riseOffset(age, rise) * k, px, o.h);
    x.globalAlpha = textAlpha(age, t.max / 1000);
    x.lineWidth = Math.max(2, px / 4);
    x.strokeStyle = STROKE;
    x.strokeText(t.text, cx, cy);
    x.fillStyle = t.color;
    x.fillText(t.text, cx, cy);
  }
  const b = o.bubble;
  if (b.active && project(b.x, b.y, b.z, o.p)) {
    const px = Math.max(6, Math.round(7 * k));
    x.font = `${px}px ${FONT}`;
    const tw = x.measureText(b.text).width;
    const bw = tw + px * 2;
    const bh = px * 2.6;
    const cx = clampInside(o.p.x, bw / 2 + 2, o.w);
    const cy = clampInside(o.p.y - bh, bh / 2 + 2, o.h);
    x.globalAlpha = textAlpha((now - b.born) / 1000, b.max / 1000);
    x.fillStyle = 'rgba(12,16,28,.93)';
    x.strokeStyle = '#d9c6ff';
    x.lineWidth = 2;
    x.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    x.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    x.fillStyle = '#e6edf3';
    x.fillText(b.text, cx, cy);
  }
  x.globalAlpha = 1;
}
