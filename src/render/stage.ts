// The flat combat stage (design "Modules": the flat renderer's reduced stage, requirement 24.4; prototype stageBg,
// stageReset, stageAt, stageHeroStrike, stageMonStrike, stageMonDeath, drawStage). It draws into a 2D canvas in the
// stage slot, so a fight always shows both fighters and its effects (requirements 13.1–13.4) even when WebGL is
// unavailable. Sounds and the DOM flashes are played by their own modules from the same events.
import type { Grade, Mode, QteTest, RunState } from '../engine';
import { fxBurst, fxDraw, fxRing, fxShake, fxShakeOffset, fxSlash, fxText, fxUpdate, makeFx, type Fx } from './fx';
import { PACING } from './pacing';
import { MONSTER_SPRITE, monsterKey, spriteCache } from './sprites/build';
import { drawSprite, glow, shadow } from './sprites/draw';
import { heroFrame, heroFX, heroKey } from './sprites/hero';
import { heroRig, monRig } from './sprites/rig';

/** Logical stage units (prototype SW, SH, GROUND, HX, MX); the canvas is `zoom` times larger (880 × 330, 8:3). */
export const STAGE = { w: 440, h: 165, ground: 131, hx: 115, mx: 320, zoom: 2 } as const;

const HERO_SCALE = 2;
const MON_SCALE: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = { 1: 3, 2: 3, 3: 3.5, 4: 4, 5: 4.5 };
/** Hit-stop on a Perfect hit and slow motion on a Perfect dodge (requirements 13.1, 13.2). */
const HIT_STOP_MS = 90;
const SLOW_MS = 340;
const SLOW_K = 0.3;
/** Delay from the hero's strike to its impact, and from the monster's strike to its impact (ms). */
const HERO_IMPACT_MS = 100;
const MON_IMPACT_MS = PACING.hpBarDelay;
/** Death burst after the killing hit; the counter swing after a Perfect dodge (prototype 150, 330). */
const DEATH_MS = 150;
const COUNTER_MS = 330;

type Queued = { at: number; fn: (now: number) => void };

/** Per-fight stage state (prototype `stage`). Times are `performance.now()` values; −Infinity means never. */
export type Stage = {
  fx: Fx;
  q: Queued[];
  hero: { atk: number; dodge: number; hurt: number; block: number; dead: number | null };
  mon: { atk: number; hurt: number; die: number | null; crit: boolean };
  slowUntil: number;
  freezeUntil: number;
  last: number;
  intro: number;
  tier: 1 | 2 | 3 | 4 | 5;
  /** When the phase-2 tint starts; null before phase 2. */
  phase2: number | null;
};

/** A fresh stage for a fight (prototype stageReset); joined in phase 2, the tint shows at once. */
export function stageReset(tier: 1 | 2 | 3 | 4 | 5, phase2: boolean, now: number): Stage {
  const fx = makeFx();
  fx.textScale = 0.75;
  return {
    fx,
    q: [],
    hero: { atk: -Infinity, dodge: -Infinity, hurt: -Infinity, block: -Infinity, dead: null },
    mon: { atk: -Infinity, hurt: -Infinity, die: null, crit: false },
    slowUntil: 0,
    freezeUntil: 0,
    last: now,
    intro: now,
    tier,
    phase2: phase2 ? now : null,
  };
}

/** Runs `fn` on the stage clock `ms` after `now`. */
export function stageAt(st: Stage, now: number, ms: number, fn: (now: number) => void): void {
  st.q.push({ at: now + ms, fn });
  st.q.sort((a, b) => a.at - b.at);
}

const monHalf = (tier: Stage['tier']) => ((spriteCache.get(monsterKey(MONSTER_SPRITE[tier]))?.base.height ?? 18) / 2) * MON_SCALE[tier];
const monY = (tier: Stage['tier']) => STAGE.ground - monHalf(tier);
const heroY = () => STAGE.ground - 13 * HERO_SCALE;
const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;
const clamp01 = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k);
/** Lunge curve: out in 110 ms, back in 220 ms. */
const lunge = (dt: number, out = 110, back = 220) => (dt < 0 || dt > out + back ? 0 : dt < out ? easeOutCubic(dt / out) : 1 - (dt - out) / back);

/** Dust and a shake as the foe lands, 300 ms into the fight (requirement 13.3). */
export function stageIntro(st: Stage, now: number, boss: boolean, reduced: boolean): void {
  stageAt(st, now, PACING.fightDust, () => {
    fxBurst(st.fx, STAGE.mx, STAGE.ground, 16, { color: 'rgba(200,200,220,.6)', speed: 130, angle: -Math.PI / 2, spread: 3, grav: 260, life: 0.5, size: 4 });
    fxShake(st.fx, boss ? 12 : 5, reduced);
  });
}

/** One hero hit, 100 ms after the swing starts (requirement 13.1; prototype stageHeroStrike). */
export function stageHeroStrike(st: Stage, now: number, grade: Grade | 'counter', dmg: number, killed: boolean, mode: Mode | null, reduced: boolean): void {
  st.hero.atk = now;
  stageAt(st, now, HERO_IMPACT_MS, (t) => {
    const fx = st.fx;
    const x = STAGE.mx - 8;
    const y = monY(st.tier);
    const ty = y - monHalf(st.tier) * 0.75;
    st.mon.hurt = t;
    st.mon.crit = grade === 'perfect';
    if (mode === 'charge') {
      const col = grade === 'perfect' ? ['#ff7a3c', '#ffd257', '#ffffff'] : ['#ff9a5c', '#ffcf9a'];
      fxBurst(fx, x, y, grade === 'miss' ? 6 : 18, { color: col, speed: 160, grav: -40, life: 0.6, size: 4, glow: true });
      fxRing(fx, x, y, { color: '#ff9a3c', vr: grade === 'perfect' ? 260 : 160, w: 4 });
    }
    if (grade === 'perfect') {
      if (!reduced) st.freezeUntil = t + HIT_STOP_MS;
      fxSlash(fx, x, y, { r: 48, color: '#ffe27a', w: 10, rot: 0.2 });
      fxSlash(fx, x, y, { r: 34, color: '#ffffff', w: 4, rot: 0.9, life: 0.3 });
      fxBurst(fx, x, y, 30, { color: ['#ffd257', '#fff3b0', '#ff9a3c'], speed: 280, grav: 380, life: 0.65, size: 4, glow: true });
      fxRing(fx, x, y, { color: '#ffd257', vr: 320, w: 5 });
      fxText(fx, x, ty, `CRIT ${dmg}`, { color: '#ffd257', size: 16 });
      fxShake(fx, 9, reduced);
    } else if (grade === 'counter') {
      fxSlash(fx, x, y, { r: 40, color: '#ffe27a', w: 6, rot: -0.4 });
      fxBurst(fx, x, y, 14, { color: ['#ffd257', '#fff'], speed: 200, life: 0.45, size: 3, glow: true });
      fxText(fx, x, ty, `COUNTER ${dmg}`, { color: '#ffd257', size: 11 });
      fxShake(fx, 5, reduced);
    } else if (grade === 'good') {
      fxSlash(fx, x, y, { r: 42, color: '#ffffff', w: 6, rot: 0.3 });
      fxBurst(fx, x, y, 12, { color: ['#ffffff', '#cfe3ff'], speed: 190, life: 0.45, size: 3 });
      fxText(fx, x, ty, String(dmg), { color: '#ffffff', size: 12 });
      fxShake(fx, 4, reduced);
    } else {
      fxBurst(fx, x, y + 12, 8, { color: 'rgba(200,200,210,.7)', speed: 70, grav: -30, life: 0.5, size: 4 });
      fxText(fx, x, ty, String(dmg), { color: '#9aa3b2', size: 9 });
    }
    if (killed) stageAt(st, t, DEATH_MS, (d) => stageMonDeath(st, d, reduced));
  });
}

/** A combo or single strike: one hit every 170 ms (prototype resolveAttack). */
export function stageHeroHits(st: Stage, now: number, grades: readonly Grade[], dmgs: readonly number[], killed: boolean, mode: Mode | null, reduced: boolean): void {
  grades.forEach((g, i) =>
    stageAt(st, now, i * PACING.comboGap, (t) => stageHeroStrike(st, t, g, dmgs[i] ?? 0, killed && i === grades.length - 1, mode, reduced)),
  );
}

/** The counter swing after a Perfect dodge, 330 ms later. */
export function stageCounter(st: Stage, now: number, dmg: number, killed: boolean, reduced: boolean): void {
  stageAt(st, now, COUNTER_MS, (t) => stageHeroStrike(st, t, 'counter', dmg, killed, null, reduced));
}

/** The monster's strike, landing 110 ms later (requirement 13.2; prototype stageMonStrike). */
export function stageMonStrike(st: Stage, now: number, grade: Grade, dmg: number, lethal: boolean, reduced: boolean): void {
  st.mon.atk = now;
  if (grade === 'perfect') st.hero.dodge = now + 40;
  stageAt(st, now, MON_IMPACT_MS, (t) => {
    const fx = st.fx;
    const x = STAGE.hx + 10;
    const y = heroY();
    const ty = y - 13 * HERO_SCALE - 6;
    if (grade === 'perfect') {
      if (!reduced) st.slowUntil = t + SLOW_MS;
      fxRing(fx, x, y, { color: '#ffd257', vr: 230, w: 4, life: 0.55 });
      fxRing(fx, x, y, { color: '#ffffff', vr: 120, w: 2, life: 0.4 });
      fxBurst(fx, x, y, 16, { color: ['#ffd257', '#fff'], speed: 160, grav: 0, drag: 3, life: 0.6, size: 3, glow: true });
      fxText(fx, x, ty, 'PERFECT!', { color: '#ffd257', size: 13 });
    } else if (grade === 'good') {
      st.hero.block = t;
      fxBurst(fx, x + 30, y, 14, { color: ['#9fd8ff', '#ffffff'], speed: 210, angle: 0, spread: 1.8, life: 0.4, size: 3, glow: true });
      fxText(fx, x, ty, `-${dmg}`, { color: '#9fd8ff', size: 11 });
      fxShake(fx, 3, reduced);
    } else {
      st.hero.hurt = t;
      fxBurst(fx, x, y, 20, { color: ['#ff5050', '#ff9a9a', '#ffffff'], speed: 230, angle: Math.PI, spread: 2.2, life: 0.5, size: 4 });
      fxText(fx, x, ty, `-${dmg}`, { color: '#ff6b6b', size: 15 });
      fxShake(fx, 10, reduced);
    }
    if (lethal) st.hero.dead = t + 100;
  });
}

/** The foe's death: soul burst, ring, shake (prototype stageMonDeath). */
export function stageMonDeath(st: Stage, now: number, reduced: boolean): void {
  const boss = st.tier === 5;
  const x = STAGE.mx;
  const y = monY(st.tier);
  st.mon.die = now;
  fxBurst(st.fx, x, y, boss ? 70 : 32, {
    color: boss ? ['#b48cff', '#e7d8ff', '#ffffff'] : ['#e8e6f0', '#b48cff', '#8dffa0'],
    speed: 150,
    grav: -170,
    drag: 1.5,
    life: 1.1,
    size: 4,
    glow: true,
    shape: 'soul',
    jitter: 34,
  });
  fxRing(st.fx, x, y, { color: '#e7d8ff', vr: 280, w: 5, life: 0.6 });
  fxShake(st.fx, boss ? 16 : 6, reduced);
}

/** Phase 2, 250 ms after the event: shake, red ring and burst, the banner, and the red tint (requirement 13.4). */
export function stagePhase2(st: Stage, now: number, reduced: boolean): void {
  st.phase2 = now + PACING.phase2Fx;
  stageAt(st, now, PACING.phase2Fx, () => {
    const y = monY(5);
    fxShake(st.fx, 14, reduced);
    fxRing(st.fx, STAGE.mx, y, { color: '#ff5a7a', vr: 320, w: 6, life: 0.7 });
    fxBurst(st.fx, STAGE.mx, y, 40, { color: ['#ff5a7a', '#ffb3c4', '#b48cff'], speed: 260, grav: 0, drag: 2, life: 0.9, size: 4, glow: true });
    fxText(st.fx, STAGE.w / 2, 44, 'PHASE 2', { color: '#ff7a9a', size: 20, life: 1.6, vy: 0 });
  });
}

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

/** Falling petals while the fight is shown (ambient; off with reduced motion). */
function petals(st: Stage, reduced: boolean): void {
  if (reduced || Math.random() >= 0.18) return;
  let n = 0;
  for (const p of st.fx.p) if (p.amb) n++;
  if (n >= 22) return;
  const petal = st.tier === 5 ? ['#e07aa0', '#b54a76', '#ffd0e0'] : ['#b994dc', '#8a62b6', '#e2ccf4'];
  fxBurst(st.fx, Math.random() * (STAGE.w + 60) - 30, -4, 1, {
    color: petal[Math.floor(Math.random() * 3)]!,
    speed: 14,
    angle: Math.PI * 0.6,
    grav: 6,
    drag: 0.05,
    life: 7,
    size: 1.6,
    amb: true,
  });
}

/**
 * Draws one stage frame (prototype drawStage): runs due queued effects, advances the particles on the visual clock
 * (frozen during hit-stop, ×0.3 in slow motion), then the background, phase-2 tint, foe, hero, effects, the boss
 * banner, and the vignette. `test` and `testT` drive the wind-up and brace poses.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  bg: HTMLCanvasElement,
  s: RunState,
  st: Stage,
  now: number,
  reduced: boolean,
  test: QteTest | null = null,
  testT = 0,
): void {
  const { w: W, h: H, ground: G, hx: HX, mx: MX, zoom: Z } = STAGE;
  const dt = Math.min(0.05, Math.max(0, (now - st.last) / 1000));
  st.last = now;
  while (st.q.length && st.q[0]!.at <= now) st.q.shift()!.fn(now);
  if (now >= st.freezeUntil) fxUpdate(st.fx, dt * (now < st.slowUntil ? SLOW_K : 1), !reduced);
  petals(st, reduced);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W * Z, H * Z);
  ctx.scale(Z, Z);
  ctx.imageSmoothingEnabled = false;
  const [sx, sy] = fxShakeOffset(st.fx);
  ctx.translate(sx, sy);
  ctx.drawImage(bg, -8, -8, W + 16, H + 16);
  const p2 = st.phase2 !== null && now >= st.phase2;
  if (p2) {
    ctx.fillStyle = `rgba(255,30,70,${0.13 + (reduced ? 0 : 0.06 * Math.sin(now / 180))})`;
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }
  const qk = test ? clamp01(testT / Math.max(1, test.target)) : 0;
  const tier = st.tier;
  const ms = MON_SCALE[tier];
  const breathe = reduced ? 1 : 1 + 0.04 * Math.sin(now / 280);
  const defending = test?.kind === 'defend';

  // Foe
  const mKey = monsterKey(MONSTER_SPRITE[tier]);
  const introK = reduced ? 1 : clamp01((now - st.intro) / 320);
  let mx = MX - lunge(now - st.mon.atk) * 150;
  const my = monY(tier) - (1 - easeOutCubic(introK)) * 200;
  if (defending) mx += 14 * qk;
  const hurtK = (now - st.mon.hurt) / 220;
  if (hurtK >= 0 && hurtK < 1) mx += (1 - hurtK) * (st.mon.crit ? 26 : 14);
  const dieK = st.mon.die === null ? -1 : (now - st.mon.die) / 600;
  if (dieK < 1) {
    const alpha = dieK >= 0 ? 1 - dieK : 1;
    const sy2 = dieK >= 0 ? 1 - dieK * 0.7 : breathe;
    shadow(ctx, MX, G + 2, 13 * ms * alpha);
    if (tier === 5) glow(ctx, mx, my, 96, p2 ? 'rgba(255,60,100,A)' : 'rgba(157,123,255,A)', 0.35 + (reduced ? 0 : 0.1 * Math.sin(now / 300)));
    if (defending) glow(ctx, mx, my, 76, 'rgba(255,60,60,A)', 0.5 * qk);
    const white = (hurtK >= 0 && hurtK < 0.35) || (dieK >= 0 && Math.floor(now / 50) % 2 === 0);
    const red = !white && defending && qk > 0.8 && !reduced && Math.floor(now / 60) % 2 === 0;
    const mrig =
      dieK >= 0 ? null : monRig(tier, now, { windup: defending ? qk : 0, lunge: lunge(now - st.mon.atk), hurt: hurtK >= 0 && hurtK < 1 ? 1 - hurtK : 0 }, reduced);
    drawSprite(ctx, mKey, mx, my, ms, alpha, { flip: true, sy: sy2, white, red, rig: mrig });
  }

  // Hero
  const h = s.hero;
  let hx = HX + lunge(now - st.hero.atk) * 140;
  let hy = heroY();
  if (test?.kind === 'attack') hx -= 16 * qk;
  const dK = (now - st.hero.dodge) / 420;
  if (dK >= 0 && dK < 1) {
    const trail = heroRig(now, { dodge: 1, cls: h.cls }, reduced);
    const tKey = heroKey(h.cls, h.race);
    for (let i = 3; i >= 1; i--) {
      const s2 = Math.sin(Math.PI * Math.max(0, dK - i * 0.08));
      drawSprite(ctx, tKey, HX - s2 * 62, hy - s2 * 34, HERO_SCALE, 0.16 * i, { gold: true, rig: trail });
    }
    const k = Math.sin(Math.PI * dK);
    hx -= k * 62;
    hy -= k * 34;
  }
  const hK = (now - st.hero.hurt) / 260;
  if (hK >= 0 && hK < 1) hx -= (1 - hK) * 18;
  const deadK = st.hero.dead === null || h.hp > 0 ? 0 : clamp01((now - st.hero.dead) / 400);
  shadow(ctx, HX, G + 2, 44);
  if (h.aura) glow(ctx, hx, hy, 62, 'rgba(180,140,255,A)', 0.15 + 0.06 * h.aura);
  if (!reduced && !test && deadK === 0) hy += Math.sin(now / 320) * 1.5;
  const hrig =
    deadK > 0
      ? null
      : heroRig(
          now,
          {
            seed: 700,
            cls: h.cls,
            windup: test?.kind === 'attack' ? qk : 0,
            brace: defending ? qk : 0,
            lunge: lunge(now - st.hero.atk),
            hurt: hK >= 0 && hK < 1 ? 1 - hK : 0,
            dodge: dK >= 0 && dK < 1 ? Math.sin(Math.PI * dK) : 0,
          },
          reduced,
        );
  const hKey = heroKey(h.cls, h.race, heroFrame(now, { seed: 700, reduced }));
  drawSprite(ctx, hKey, hx, hy + deadK * 30, HERO_SCALE, 1, { white: hK >= 0 && hK < 0.3, rot: -1.4 * deadK, rig: hrig });
  if (deadK === 0) heroFX(ctx, h, hx, hy, HERO_SCALE, now, false, 1, reduced);
  const bK = (now - st.hero.block) / 260;
  if (bK >= 0 && bK < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - bK;
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(hx + 8, hy, 52, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }
  fxDraw(st.fx, ctx);

  // Boss banner for the first 1.7 s.
  if (tier === 5) {
    const bk = (now - st.intro) / 1700;
    if (bk >= 0 && bk < 1) {
      const slide = reduced ? 0 : bk < 0.2 ? 1 - easeOutCubic(bk / 0.2) : bk > 0.8 ? -(bk - 0.8) / 0.2 : 0;
      ctx.save();
      ctx.globalAlpha = bk > 0.8 ? 1 - (bk - 0.8) / 0.2 : 1;
      ctx.fillStyle = 'rgba(20,8,40,.8)';
      ctx.fillRect(-10, H / 2 - 24, W + 20, 48);
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#b48cff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#e7d8ff';
      ctx.fillText('BOSS', W / 2 + slide * W, H / 2);
      ctx.restore();
    }
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v;
  ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.restore();
}
