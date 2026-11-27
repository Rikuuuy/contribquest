// 2D drawing helpers (prototype drawSprite, shadow, glow, rrect). Used by the flat renderer, the portrait,
// the HUD icons, and the share card.
import { spriteCache } from './build';

export type DrawOpts = {
  white?: boolean;
  red?: boolean;
  gold?: boolean;
  flip?: boolean;
  /** Squash and stretch, anchored at the feet. */
  sx?: number;
  sy?: number;
  rot?: number;
};

/**
 * Draws the cached sprite `key` centred on (`cx`, `cy`) at `scale`, at integer translation with smoothing off.
 * Unknown keys draw nothing. Rig offsets come with the stage work (presentation group 7 / 11.6).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  cy: number,
  scale: number,
  alpha = 1,
  opt: DrawOpts = {},
): void {
  const s = spriteCache.get(key);
  if (!s) return;
  const img = opt.white ? s.white : opt.red ? s.red : opt.gold ? s.gold : s.base;
  const bw = img.width * scale;
  const bh = img.height * scale;
  const w = bw * (opt.sx ?? 1);
  const h = bh * (opt.sy ?? 1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (opt.rot) ctx.rotate(opt.rot);
  if (opt.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2 + (bh - h) / 2, w, h);
  ctx.restore();
}

/** A soft ellipse shadow `w` wide under (`cx`, `cy`). */
export function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, a = 0.35): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, w / 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A radial glow of radius `r`; `color` is an `rgba(…,A)` template whose `A` is replaced by the alpha. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', String(a)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Traces a rounded rectangle path (fill or stroke it after). */
export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
