// 2D drawing helpers (prototype drawSprite, shadow, glow, rrect). Used by the flat renderer, the portrait,
// the HUD icons, and the share card.
import { spriteCache } from './build';
import { RIG_PAD, rigOffsets, type Rig } from './rig';

export type DrawOpts = {
  white?: boolean;
  red?: boolean;
  gold?: boolean;
  flip?: boolean;
  /** Squash and stretch, anchored at the feet. */
  sx?: number;
  sy?: number;
  rot?: number;
  /** Row offsets from `heroRig` or `monRig`; the shifted sprite is cached by its offsets. */
  rig?: Rig | null;
};

const RIG_CACHE = new Map<string, HTMLCanvasElement>();
const RIG_CACHE_MAX = 2500;

/**
 * `img` with each row shifted by the rig (prototype riggedSpr). The canvas holds the outlined sprite, so canvas
 * row y is grid row y − 1; it is padded by RIG_PAD on both sides. Returns `img` when no row moves.
 */
function rigged(key: string, img: HTMLCanvasElement, rig: Rig): HTMLCanvasElement {
  const H = img.height;
  const gridH = Math.max(1, H - 2);
  const offs = rigOffsets((y) => rig(Math.min(gridH - 1, Math.max(0, y - 1))), H);
  if (!offs) return img;
  const k = `${key}|${img.width}x${H}|${offs.join(',')}`;
  let c = RIG_CACHE.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width + RIG_PAD * 2;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) return img;
  for (let y = H - 1; y >= 0; y--) {
    const dy = offs[y * 2 + 1]!;
    if (y + dy < H) x.drawImage(img, 0, y, img.width, 1, RIG_PAD + offs[y * 2]!, y + dy, img.width, 1);
  }
  if (RIG_CACHE.size > RIG_CACHE_MAX) RIG_CACHE.clear();
  RIG_CACHE.set(k, c);
  return c;
}

/**
 * Draws the cached sprite `key` centred on (`cx`, `cy`) at `scale`, at integer translation with smoothing off.
 * Unknown keys draw nothing. `opt.rig` bends the rows (prototype rig); the padded canvas keeps the same centre.
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
  const flat = opt.white ? s.white : opt.red ? s.red : opt.gold ? s.gold : s.base;
  const variant = opt.white ? 'w' : opt.red ? 'r' : opt.gold ? 'g' : 'b';
  const img = opt.rig ? rigged(`${key}:${variant}`, flat, opt.rig) : flat;
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
