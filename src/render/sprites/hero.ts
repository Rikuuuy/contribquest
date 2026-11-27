// 24 × 24 heroes (prototype heroKey, heroSpriteAt, heroFX): class outfit, race face, frame edits, auto-shade.
import type { ClassId, RaceId } from '../../data/schema';
import { RACE_INFO } from '../../engine';
import { REDUCED } from '../motion';
import { BONE } from '../palette';
import { buildSprite, cachedSprite, shadeGrid, type ColorGrid } from './build';
import { glow } from './draw';
import { OUTFITS, type Point } from './grids';

export type HeroFrame = 'idle' | 'sway' | 'step' | 'blink' | 'lookL' | 'lookR';
export const HERO_FRAMES: readonly HeroFrame[] = ['idle', 'sway', 'step', 'blink', 'lookL', 'lookR'];

/** The character grid of a hero after the race overlay and the frame edits, before colouring. */
function heroChars(cls: ClassId, race: RaceId, frame: HeroFrame): string[][] {
  const O = OUTFITS[cls];
  const R = RACE_INFO[race];
  const F = O.face;
  const g = O.rows.map((r) => r.split(''));
  const set = (x: number, y: number, ch: string): void => {
    const row = g[y];
    if (row && x >= 0 && x < row.length) row[x] = ch;
  };
  const put = (pts: readonly Point[], ch: string): void => pts.forEach(([x, y]) => set(x, y, ch));
  if (R.ears) put(F.ear, 's');
  if (!O.masked) {
    if (R.tusks) put(F.tusks, 'u');
    if (R.teeth) {
      put(F.nose, 'k');
      F.mouth.forEach(([x, y], i) => set(x, y, i % 2 ? 'm' : 'u'));
    }
    if (R.fangs) put(F.mouth, 'u');
  }
  if (frame === 'blink') put(F.eyes, 'S');
  if (frame === 'lookL' || frame === 'lookR') {
    const d = frame === 'lookL' ? -1 : 1;
    put(F.eyes, 's');
    F.eyes.forEach(([x, y]) => set(x + d, y, 'e'));
  }
  if (frame === 'sway' || frame === 'step') {
    // The cape flutters: every odd row from 13 to 19 grows one cape pixel at the back.
    for (let y = 12; y < 21; y++) {
      const row = g[y];
      const l = row ? row.indexOf('C') : -1;
      if (row && l > 0 && y % 2) row[l - 1] = 'C';
    }
  }
  if (frame === 'step') {
    // Mid-stride: the back foot slides back, the front foot reaches forward.
    for (const y of [22, 23]) {
      const row = g[y];
      if (!row) continue;
      const runs: [number, number][] = [];
      let a = -1;
      for (let x = 0; x <= row.length; x++) {
        const on = x < row.length && row[x] !== '.';
        if (on && a < 0) a = x;
        if (!on && a >= 0) {
          runs.push([a, x - 1]);
          a = -1;
        }
      }
      const back = runs[0];
      const front = runs[runs.length - 1];
      if (runs.length < 2 || !back || !front) continue;
      const [b0, b1] = back;
      const [f0, f1] = front;
      if (b0 > 0) {
        row[b0 - 1] = row[b0] ?? '.';
        row[b1] = '.';
      }
      if (f1 < row.length - 1) {
        row[f1 + 1] = row[f1] ?? '.';
        row[f0] = '.';
      }
    }
  }
  return g;
}

/** The shaded 24 × 24 colour grid (`#rrggbb` or null) of a hero in one frame (requirements 6.1–6.2). Pure. */
export function heroPixels(cls: ClassId, race: RaceId, frame: HeroFrame = 'idle'): ColorGrid {
  const O = OUTFITS[cls];
  const R = RACE_INFO[race];
  const pal = { ...O.pal, s: R.skin[0], S: R.skin[1], e: R.eye, m: R.mouth, u: BONE };
  return shadeGrid(heroChars(cls, race, frame), pal);
}

/** Cache key `hero:{cls}:{race}:{frame}`; builds the outlined sprite and its silhouettes the first time. */
export function heroKey(cls: ClassId, race: RaceId, frame: HeroFrame = 'idle'): string {
  const key = `hero:${cls}:${race}:${frame}`;
  cachedSprite(key, () => buildSprite(heroPixels(cls, race, frame)));
  return key;
}

export type FrameOpts = { moving?: boolean; look?: -1 | 0 | 1; seed?: number; reduced?: boolean };

/**
 * The frame at time `now` (ms, requirement 6.3): `step` while moving; otherwise `blink` for 130 ms every 3400 ms;
 * otherwise `lookL`/`lookR` when looking; otherwise `sway` and `idle` alternating every 520 ms.
 * With reduced motion it is always `idle`.
 */
export function heroFrame(now: number, o: FrameOpts = {}): HeroFrame {
  if (o.reduced ?? REDUCED) return 'idle';
  const t = now + (o.seed ?? 0);
  if (o.moving) return 'step';
  if (((t % 3400) + 3400) % 3400 < 130) return 'blink';
  if (o.look) return o.look < 0 ? 'lookL' : 'lookR';
  return Math.floor(t / 520) % 2 ? 'sway' : 'idle';
}

/**
 * Additive glows on top of a hero drawn centred at (`cx`, `cy`) at scale `sc` (requirement 6.4): race eye glow,
 * Wanderer lantern, Mage orb, Knight blade glint every 2.6 s, Rogue dagger tips every 3 s (glints off with reduced motion).
 */
export function heroFX(
  ctx: CanvasRenderingContext2D,
  h: { cls: ClassId; race: RaceId },
  cx: number,
  cy: number,
  sc: number,
  now: number,
  flip = false,
  alpha = 1,
  reduced: boolean = REDUCED,
): void {
  if (alpha <= 0) return;
  const O = OUTFITS[h.cls];
  const R = RACE_INFO[h.race];
  const f = O.fx;
  // Sprite pixel (px, py) to canvas coordinates; the outlined sprite is 26 px wide, centred.
  const P = (px: number, py: number): [number, number] => [
    flip ? cx + 13 * sc - (px + 1.5) * sc : cx - 13 * sc + (px + 1.5) * sc,
    cy - 13 * sc + (py + 1.5) * sc,
  ];
  const t = reduced ? 0 : now;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = 'lighter';
  if (R.glow)
    for (const [ex, ey] of O.face.eyes) {
      const [x, y] = P(ex, ey);
      glow(ctx, x, y, sc * 2.2, R.glow, 0.55 + 0.25 * Math.sin(t / 300));
    }
  if (f.lantern) {
    const [x, y] = P(f.lantern[0], f.lantern[1]);
    glow(ctx, x, y, sc * 5, 'rgba(255,190,100,A)', 0.55 + 0.12 * Math.sin(t / 90) + 0.08 * Math.sin(t / 37));
  }
  if (f.orb) {
    const [x, y] = P(f.orb[0], f.orb[1]);
    glow(ctx, x, y, sc * 4.5, 'rgba(120,220,255,A)', 0.6 + 0.2 * Math.sin(t / 260));
  }
  if (f.blade && !reduced) {
    const k = (now % 2600) / 500;
    if (k < 1) {
      const [x, y] = P(f.blade[0], f.blade[1] + (f.blade[2] - f.blade[1]) * k);
      glow(ctx, x, y, sc * 2.6, 'rgba(255,255,255,A)', 0.9);
    }
  }
  if (f.tips && !reduced) {
    const k = (now % 3000) / 300;
    if (k < 1)
      for (const tp of f.tips) {
        const [x, y] = P(tp[0], tp[1]);
        glow(ctx, x, y, sc * 2.2, 'rgba(230,240,255,A)', 0.9 * (1 - k));
      }
  }
  ctx.restore();
}
