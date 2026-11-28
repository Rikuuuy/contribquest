// The 2D particle system and floating text (prototype makeFx, fxBurst, fxText, fxRing, fxSlash, fxShake, fxUpdate,
// fxDraw, fxShakeOffset; requirement 13). Used on the flat combat stage and the background canvas; the world
// renderer has its own 3D pool (`world/fx3d.ts`) and draws text on the overlay canvas. The DOM flashes (gold and
// red fight flash, white-out) live here too, so both renderers share them.

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
  glow: boolean;
  shape: 'sq' | 'coin' | 'soul';
  /** Homing target (wisp sparks). */
  to: { x: number; y: number } | null;
  /** Ambient (petals): fades in and out instead of fading away. */
  amb: boolean;
};
export type FloatText = { x: number; y: number; text: string; color: string; size: number; life: number; max: number; vy: number };
export type FxRing = { x: number; y: number; r: number; vr: number; life: number; max: number; color: string; w: number };
export type FxSlash = { x: number; y: number; r: number; life: number; max: number; color: string; w: number; rot: number };

export type Fx = { p: Particle[]; txt: FloatText[]; rings: FxRing[]; slashes: FxSlash[]; shake: number; textScale: number };

export type BurstOpts = {
  angle?: number;
  spread?: number;
  speed?: number;
  jitter?: number;
  up?: number;
  life?: number;
  size?: number;
  color?: string | readonly string[];
  grav?: number;
  drag?: number;
  glow?: boolean;
  shape?: Particle['shape'];
  to?: { x: number; y: number } | null;
  amb?: boolean;
};

/** Particle cap per fx, so a long fight or a burst storm never grows without bound. */
export const FX_MAX_PARTICLES = 600;

export const makeFx = (): Fx => ({ p: [], txt: [], rings: [], slashes: [], shake: 0, textScale: 1 });

/** Spawns `n` particles at (x, y) (prototype fxBurst); particles beyond the cap are dropped. */
export function fxBurst(fx: Fx, x: number, y: number, n: number, o: BurstOpts = {}): void {
  for (let i = 0; i < n && fx.p.length < FX_MAX_PARTICLES; i++) {
    const a = (o.angle ?? Math.random() * Math.PI * 2) + (o.spread ? (Math.random() - 0.5) * o.spread : 0);
    const sp = (o.speed ?? 120) * (0.4 + Math.random() * 0.8);
    const j = o.jitter ?? 0;
    const color = typeof o.color === 'string' ? o.color : o.color?.length ? o.color[i % o.color.length]! : '#fff';
    fx.p.push({
      x: x + (j ? (Math.random() - 0.5) * j : 0),
      y: y + (j ? (Math.random() - 0.5) * j : 0),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - (o.up ?? 0),
      life: 0,
      max: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6),
      size: (o.size ?? 3) * (0.6 + Math.random() * 0.8),
      color,
      grav: o.grav ?? 300,
      drag: o.drag ?? 2,
      glow: !!o.glow,
      shape: o.shape ?? 'sq',
      to: o.to ?? null,
      amb: !!o.amb,
    });
  }
}

export function fxText(fx: Fx, x: number, y: number, text: string, o: { color?: string; size?: number; life?: number; vy?: number } = {}): void {
  fx.txt.push({ x, y, text, color: o.color ?? '#fff', size: o.size ?? 10, life: 0, max: o.life ?? 0.9, vy: o.vy ?? -42 });
}

export function fxRing(fx: Fx, x: number, y: number, o: { r?: number; vr?: number; life?: number; color?: string; w?: number } = {}): void {
  fx.rings.push({ x, y, r: o.r ?? 4, vr: o.vr ?? 160, life: 0, max: o.life ?? 0.4, color: o.color ?? '#fff', w: o.w ?? 3 });
}

export function fxSlash(fx: Fx, x: number, y: number, o: { r?: number; life?: number; color?: string; w?: number; rot?: number } = {}): void {
  fx.slashes.push({ x, y, r: o.r ?? 40, life: 0, max: o.life ?? 0.22, color: o.color ?? '#fff', w: o.w ?? 6, rot: o.rot ?? 0 });
}

/** Shakes by `m` px (the largest pending shake wins); a no-op with reduced motion. */
export function fxShake(fx: Fx, m: number, reduced: boolean): void {
  if (!reduced) fx.shake = Math.max(fx.shake, m);
}

/** Advances everything by `dt` seconds; `rise` false keeps text in place (reduced motion). */
export function fxUpdate(fx: Fx, dt: number, rise = true): void {
  for (const p of fx.p) {
    p.life += dt;
    if (p.to) {
      const dx = p.to.x - p.x;
      const dy = p.to.y - p.y;
      p.vx = p.vx * 0.86 + dx * dt * 30;
      p.vy = p.vy * 0.86 + dy * dt * 30;
      if (dx * dx + dy * dy < 30 && p.life > 0.15) p.life = p.max;
    } else {
      p.vy += p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  fx.p = fx.p.filter((p) => p.life < p.max);
  for (const t of fx.txt) {
    t.life += dt;
    if (rise) t.y += t.vy * dt;
    t.vy *= Math.exp(-2.5 * dt);
  }
  fx.txt = fx.txt.filter((t) => t.life < t.max);
  for (const r of fx.rings) {
    r.life += dt;
    r.r += r.vr * dt;
  }
  fx.rings = fx.rings.filter((r) => r.life < r.max);
  for (const s of fx.slashes) s.life += dt;
  fx.slashes = fx.slashes.filter((s) => s.life < s.max);
  fx.shake *= Math.exp(-9 * dt);
  if (fx.shake < 0.3) fx.shake = 0;
}

/** This frame's random shake offset in px. */
export function fxShakeOffset(fx: Fx): [number, number] {
  return fx.shake ? [(Math.random() - 0.5) * 2 * fx.shake, (Math.random() - 0.5) * 2 * fx.shake] : [0, 0];
}

/** True while anything is still alive (the background loop stops when this is false). */
export const fxBusy = (fx: Fx): boolean => fx.p.length + fx.txt.length + fx.rings.length + fx.slashes.length > 0 || fx.shake > 0;

export function fxDraw(fx: Fx, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  for (const r of fx.rings) {
    const k = r.life / r.max;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.w * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  for (const s of fx.slashes) {
    const k = s.life / s.max;
    ctx.globalAlpha = 1 - k * k;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.w * (1 - k * 0.6);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, s.rot - 1.3 + k * 0.5, s.rot - 1.3 + 0.5 + 2.1 * Math.min(1, k * 2.2));
    ctx.stroke();
  }
  for (const p of fx.p) {
    const k = p.life / p.max;
    ctx.globalAlpha = p.amb ? Math.sin(Math.PI * k) * 0.8 : 1 - k * k;
    ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    const s = p.size * (p.shape === 'soul' ? 1 + k : 1 - k * 0.4);
    if (p.glow) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 2.2);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - s * 2.2, p.y - s * 2.2, s * 4.4, s * 4.4);
    }
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    if (p.shape === 'coin') {
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s / 2, s / 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of fx.txt) {
    const k = t.life / t.max;
    const pop = t.life < 0.12 ? 1 + (1 - t.life / 0.12) * 0.9 : 1;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.font = `${Math.round(t.size * pop * fx.textScale)}px "Press Start 2P", monospace`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.9)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

/** Restarts a one-shot CSS animation class on `el` (forces a reflow between remove and add). */
function replay(el: Element | null, cls: string, drop: readonly string[] = [cls]): void {
  if (!el) return;
  el.classList.remove(...drop);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/** The gold or red flash over the fight panel (prototype flashFight); off with reduced motion. */
export function flashFight(kind: 'gold' | 'red', reduced: boolean, root: ParentNode = document): void {
  if (!reduced) replay(root.querySelector('.fight'), `flash-${kind}`, ['flash-gold', 'flash-red']);
}

/** The full-screen white-out (prototype whiteout); off with reduced motion. */
export function whiteOut(reduced: boolean, root: ParentNode = document): void {
  if (!reduced) replay(root.querySelector('#whiteout'), 'go');
}
