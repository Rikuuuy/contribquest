// The flat combat stage (design "Modules": the flat renderer's reduced stage, requirement 24.4; prototype stageBg
// and drawStage). It draws into a 2D canvas in the stage slot, so a fight always shows both fighters even when
// WebGL is unavailable. The particle effects, rigs, hit-stop, and slow motion arrive with task 7.1.
import type { RunState } from '../engine';
import { MONSTER_SPRITE, monsterKey, spriteCache } from './sprites/build';
import { drawSprite, glow, shadow } from './sprites/draw';
import { heroFrame, heroFX, heroKey } from './sprites/hero';

/** Logical stage units (prototype SW, SH, GROUND, HX, MX); the canvas is `zoom` times larger (880 × 330, 8:3). */
export const STAGE = { w: 440, h: 165, ground: 131, hx: 115, mx: 320, zoom: 2 } as const;

const HERO_SCALE = 2;
const MON_SCALE: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = { 1: 3, 2: 3, 3: 3.5, 4: 4, 5: 4.5 };
/** How long the hit flash and recoil last, ms. */
const HURT_MS = 220;
/** How long the monster takes to fade after it falls, ms. */
const DIE_MS = 600;

/** Hit and death times (`performance.now()`) for the stage animation; null when not happening. */
export type StageMarks = { monHurt: number | null; heroHurt: number | null; monDie: number | null; crit: boolean };

export const newMarks = (): StageMarks => ({ monHurt: null, heroHurt: null, monDie: null, crit: false });

/** Seeded so each fight's stars stay put. */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

/** The background: gradient sky, stars, moon, the path, and the ground band (purple-red for the boss). */
export function stageBg(boss: boolean, seed = 1): HTMLCanvasElement {
  const { w: W, h: H, ground: G, zoom: Z } = STAGE;
  const c = document.createElement('canvas');
  c.width = W * Z;
  c.height = H * Z;
  const x = c.getContext('2d');
  if (!x) throw new Error('2D canvas context unavailable');
  x.scale(Z, Z);
  x.imageSmoothingEnabled = false;
  const sky = x.createLinearGradient(0, 0, 0, G);
  (boss ? ['#170926', '#3a1648', '#6a2446'] : ['#0c1130', '#24285a', '#4c3a6c']).forEach((col, i) => sky.addColorStop(i / 2, col));
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H);
  const r = lcg(seed * 31 + (boss ? 7 : 0));
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    x.fillRect(Math.round(r() * W), Math.round(r() * G * 0.55), 1, 1);
  }
  const mx = W * 0.35;
  const my = 46;
  const mr = boss ? 31 : 27;
  glow(x, mx, my, mr * 3.2, boss ? 'rgba(200,150,255,A)' : 'rgba(255,240,200,A)', 0.4);
  x.fillStyle = boss ? '#e6d2ff' : '#f6efd2';
  x.beginPath();
  x.arc(mx, my, mr, 0, Math.PI * 2);
  x.fill();
  const mist = x.createLinearGradient(0, G - 60, 0, G - 15);
  mist.addColorStop(0, 'rgba(160,150,210,0)');
  mist.addColorStop(1, 'rgba(160,150,210,.22)');
  x.fillStyle = mist;
  x.fillRect(0, G - 60, W, 45);
  // Ground band and the cobble path the fighters stand on.
  x.fillStyle = boss ? '#2a1424' : '#1d2230';
  x.fillRect(0, G - 15, W, H - G + 15);
  x.fillStyle = boss ? '#3d2034' : '#2c3244';
  x.fillRect(0, G - 4, W, 12);
  x.fillStyle = boss ? '#4e2a42' : '#3a4258';
  for (let px = 0; px < W; px += 12) x.fillRect(px + ((px / 12) % 2) * 3, G - 2, 8, 3);
  x.fillStyle = 'rgba(0,0,0,.35)';
  x.fillRect(0, G + 8, W, H - G - 8);
  return c;
}

/** Draws one stage frame: background, the hero on the left, the foe on the right, hit flashes and the death fade. */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  bg: HTMLCanvasElement,
  s: RunState,
  marks: Readonly<StageMarks>,
  now: number,
  reduced: boolean,
): void {
  const f = s.combat;
  const { w: W, h: H, ground: G, hx: HX, mx: MX, zoom: Z } = STAGE;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W * Z, H * Z);
  ctx.drawImage(bg, 0, 0, W * Z, H * Z);
  ctx.scale(Z, Z);
  ctx.imageSmoothingEnabled = false;
  if (f) {
    const tier = f.m.tier;
    if (f.m.phase2) {
      ctx.fillStyle = `rgba(255,30,70,${0.13 + (reduced ? 0 : 0.06 * Math.sin(now / 180))})`;
      ctx.fillRect(0, 0, W, H);
    }
    const breathe = reduced ? 1 : 1 + 0.04 * Math.sin(now / 280);
    const since = (t: number | null) => (t === null ? -1 : (now - t) / HURT_MS);

    // Foe
    const mKey = monsterKey(MONSTER_SPRITE[tier]);
    const ms = MON_SCALE[tier];
    const mh = (spriteCache.get(mKey)?.base.height ?? 14) * ms;
    const dieK = marks.monDie === null ? -1 : (now - marks.monDie) / DIE_MS;
    if (dieK < 1) {
      const alpha = dieK >= 0 ? 1 - dieK : 1;
      const hurt = since(marks.monHurt);
      let mx = MX;
      if (hurt >= 0 && hurt < 1 && !reduced) mx += (1 - hurt) * (marks.crit ? 13 : 7);
      const my = G - mh / 2;
      const defending = f.phase === 'test' && f.test?.kind === 'defend';
      shadow(ctx, MX, G + 1, 13 * ms * alpha);
      if (tier === 5) glow(ctx, mx, my, 48, f.m.phase2 ? 'rgba(255,60,100,A)' : 'rgba(157,123,255,A)', 0.35);
      if (defending) glow(ctx, mx, my, 38, 'rgba(255,60,60,A)', 0.3);
      const white = (hurt >= 0 && hurt < 0.35) || (dieK >= 0 && Math.floor(now / 50) % 2 === 0);
      drawSprite(ctx, mKey, mx, my, ms, alpha, { flip: true, white, sy: dieK >= 0 ? 1 - dieK * 0.7 : breathe });
    }

    // Hero
    const hKey = heroKey(s.hero.cls, s.hero.race, heroFrame(now, { seed: 700, reduced }));
    const hh = (spriteCache.get(hKey)?.base.height ?? 26) * HERO_SCALE;
    const hurt = since(marks.heroHurt);
    const down = s.hero.hp <= 0;
    let hx = HX;
    if (hurt >= 0 && hurt < 1 && !reduced) hx -= (1 - hurt) * 7;
    const hy = G - hh / 2;
    shadow(ctx, HX, G + 1, 24);
    drawSprite(ctx, hKey, hx, hy + (down ? 12 : 0), HERO_SCALE, 1, { white: hurt >= 0 && hurt < 0.3, rot: down ? -1.4 : 0 });
    if (!down) heroFX(ctx, s.hero, hx, hy, HERO_SCALE, now, false, 1, reduced);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
