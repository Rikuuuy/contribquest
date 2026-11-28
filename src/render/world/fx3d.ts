// 3D effects for the arena (v1.6, requirements 13.1–13.4, 22.3, 25.4; design "Modules"): one fixed-size particle
// pool drawn as a single `Points`, small pools of rings and slashes, camera shake, and the visual clock with
// hit-stop and slow motion. Every buffer is allocated once; `tickFx` writes in place and never allocates.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  Vector3,
  type Camera,
} from 'three';
import type { MotionFlags } from './motion-flags';
import { QUALITY, type Quality } from './quality';

/** Ring and slash pool sizes. */
const RINGS = 8;
const SLASHES = 4;
/** Where dead particles wait (out of view, colour 0 so additive blending draws nothing). */
const PARKED_Y = -100;
/** Shake decay per second (prototype `fx.shake *= exp(−9 dt)`) and the cut-off in world units. */
const SHAKE_DECAY = 9;
const SHAKE_MIN = 0.003;

type Ring = { mesh: Mesh<RingGeometry, MeshBasicMaterial>; life: number; max: number; r: number; vr: number; active: boolean };
type Slash = { mesh: Mesh<RingGeometry, MeshBasicMaterial>; life: number; max: number; r: number; rot: number; active: boolean };

export type Fx3d = {
  /** Add this to the scene; it holds the particle cloud, rings, and slashes. */
  root: Group;
  points: Points<BufferGeometry, PointsMaterial>;
  /** Pool size (fixed) and the number of slots usable at the current quality. */
  size: number;
  limit: number;
  live: number;
  pos: Float32Array;
  col: Float32Array;
  vel: Float32Array;
  rgb: Float32Array;
  life: Float32Array;
  max: Float32Array;
  grav: Float32Array;
  drag: Float32Array;
  alive: Uint8Array;
  /** Stack of free slot indices below `limit`; `top` is its height. */
  free: Int32Array;
  top: number;
  rings: Ring[];
  slashes: Slash[];
  /** Current shake amplitude in world units, and this frame's camera offset. */
  shakeAmp: number;
  shakeOff: Vector3;
  seed: number;
};

/** A cheap deterministic random in [0, 1) that keeps its state on the pool (no allocation). */
function rand(fx: Fx3d): number {
  fx.seed = (Math.imul(fx.seed, 1664525) + 1013904223) >>> 0;
  return fx.seed / 4294967296;
}

/** Builds a pool of `size` particles (arena 384, map 256) plus the ring and slash pools. */
export function makeFx3d(size: number, quality: Quality = 'high'): Fx3d {
  const pos = new Float32Array(size * 3);
  for (let i = 0; i < size; i++) pos[i * 3 + 1] = PARKED_Y;
  const col = new Float32Array(size * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const points = new Points(
    geo,
    new PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }),
  );
  points.frustumCulled = false;
  const root = new Group();
  root.add(points);
  const ringGeo = new RingGeometry(0.85, 1, 32);
  const rings: Ring[] = [];
  for (let i = 0; i < RINGS; i++) {
    const mesh = new Mesh(ringGeo, new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
    mesh.visible = false;
    root.add(mesh);
    rings.push({ mesh, life: 0, max: 1, r: 0, vr: 0, active: false });
  }
  const slashGeo = new RingGeometry(0.82, 1, 16, 1, Math.PI * 0.15, Math.PI * 0.7);
  const slashes: Slash[] = [];
  for (let i = 0; i < SLASHES; i++) {
    const mesh = new Mesh(slashGeo, new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }));
    mesh.visible = false;
    root.add(mesh);
    slashes.push({ mesh, life: 0, max: 1, r: 1, rot: 0, active: false });
  }
  const fx: Fx3d = {
    root,
    points,
    size,
    limit: size,
    live: 0,
    pos,
    col,
    vel: new Float32Array(size * 3),
    rgb: new Float32Array(size * 3),
    life: new Float32Array(size),
    max: new Float32Array(size),
    grav: new Float32Array(size),
    drag: new Float32Array(size),
    alive: new Uint8Array(size),
    free: new Int32Array(size),
    top: 0,
    rings,
    slashes,
    shakeAmp: 0,
    shakeOff: new Vector3(),
    seed: 0x9e3779b9,
  };
  setFxQuality(fx, quality);
  return fx;
}

/** Uses `size × QUALITY[q].particles` slots (half at `low`); live particles above the limit finish but are not drawn. */
export function setFxQuality(fx: Fx3d, quality: Quality): void {
  fx.limit = Math.max(1, Math.floor(fx.size * QUALITY[quality].particles));
  refill(fx);
  fx.points.geometry.setDrawRange(0, fx.limit);
}

/** Rebuilds the free stack from the dead slots below `limit`. */
function refill(fx: Fx3d): void {
  fx.top = 0;
  for (let i = fx.limit - 1; i >= 0; i--) if (!fx.alive[i]) fx.free[fx.top++] = i;
}

export type BurstOpts = {
  n: number;
  color: string;
  /** Initial speed in units per second (randomised 0.4–1.2 ×). */
  speed?: number;
  /** Extra upward speed. */
  up?: number;
  /** Lifetime in seconds (randomised 0.6–1.2 ×). */
  life?: number;
  /** Gravity in units per second², pulling down. */
  grav?: number;
  drag?: number;
  /** Spawn jitter in units. */
  jitter?: number;
};

const _c = new Color();

/**
 * Spawns up to `o.n` particles at (x, y, z). The pool never grows: when it is full the rest are dropped.
 * Returns how many were spawned.
 */
export function burst(fx: Fx3d, x: number, y: number, z: number, o: BurstOpts): number {
  _c.set(o.color);
  const speed = o.speed ?? 3;
  const jit = o.jitter ?? 0;
  let made = 0;
  for (let k = 0; k < o.n; k++) {
    if (fx.top === 0) break;
    const i = fx.free[--fx.top]!;
    const a = rand(fx) * Math.PI * 2;
    const b = (rand(fx) - 0.5) * 0.8;
    const sp = speed * (0.4 + rand(fx) * 0.8);
    const j = i * 3;
    fx.pos[j] = x + (rand(fx) - 0.5) * jit;
    fx.pos[j + 1] = y + (rand(fx) - 0.5) * jit;
    fx.pos[j + 2] = z + (rand(fx) - 0.5) * jit;
    fx.vel[j] = Math.cos(a) * sp;
    fx.vel[j + 1] = Math.sin(a) * sp + (o.up ?? 0);
    fx.vel[j + 2] = b * sp;
    fx.rgb[j] = _c.r;
    fx.rgb[j + 1] = _c.g;
    fx.rgb[j + 2] = _c.b;
    fx.life[i] = 0;
    fx.max[i] = (o.life ?? 0.6) * (0.6 + rand(fx) * 0.6);
    fx.grav[i] = o.grav ?? 8;
    fx.drag[i] = o.drag ?? 2;
    fx.alive[i] = 1;
    fx.live++;
    made++;
  }
  return made;
}

/** An expanding ring facing the camera (radius `r` growing at `vr` units per second). Dropped when all rings are busy. */
export function ring(fx: Fx3d, x: number, y: number, z: number, o: { color: string; r?: number; vr?: number; life?: number }): boolean {
  for (let i = 0; i < fx.rings.length; i++) {
    const g = fx.rings[i]!;
    if (g.active) continue;
    g.active = true;
    g.life = 0;
    g.max = o.life ?? 0.4;
    g.r = o.r ?? 0.12;
    g.vr = o.vr ?? 5;
    g.mesh.material.color.set(o.color);
    g.mesh.position.set(x, y, z);
    g.mesh.visible = true;
    return true;
  }
  return false;
}

/** A short arc slash facing the camera, rotated by `rot` radians. Dropped when all slashes are busy. */
export function slash(fx: Fx3d, x: number, y: number, z: number, o: { color: string; r?: number; rot?: number; life?: number }): boolean {
  for (let i = 0; i < fx.slashes.length; i++) {
    const s = fx.slashes[i]!;
    if (s.active) continue;
    s.active = true;
    s.life = 0;
    s.max = o.life ?? 0.22;
    s.r = o.r ?? 1.1;
    s.rot = o.rot ?? -0.6;
    s.mesh.material.color.set(o.color);
    s.mesh.position.set(x, y, z);
    s.mesh.visible = true;
    return true;
  }
  return false;
}

/** Camera shake for a prototype shake of `n` px: `n / 100` world units, decaying. A no-op with reduced motion. */
export function shake(fx: Fx3d, n: number, flags: Readonly<MotionFlags>): void {
  if (!flags.shake) return;
  fx.shakeAmp = Math.max(fx.shakeAmp, n / 100);
}

/** Drops every particle, ring, slash, and the shake. */
export function clearFx(fx: Fx3d): void {
  for (let i = 0; i < fx.size; i++) {
    fx.alive[i] = 0;
    fx.col[i * 3] = fx.col[i * 3 + 1] = fx.col[i * 3 + 2] = 0;
    fx.pos[i * 3 + 1] = PARKED_Y;
  }
  fx.live = 0;
  for (const g of [...fx.rings, ...fx.slashes]) {
    g.active = false;
    g.mesh.visible = false;
  }
  fx.shakeAmp = 0;
  fx.shakeOff.set(0, 0, 0);
  refill(fx);
  fx.points.geometry.getAttribute('position').needsUpdate = true;
  fx.points.geometry.getAttribute('color').needsUpdate = true;
}

/**
 * Advances particles, rings, slashes, and the shake by `dt` seconds (already scaled by the visual clock). Rings
 * and slashes copy the camera's orientation. Allocates nothing.
 */
export function tickFx(fx: Fx3d, dt: number, camera: Camera): void {
  if (fx.live > 0) {
    for (let i = 0; i < fx.size; i++) {
      if (!fx.alive[i]) continue;
      const j = i * 3;
      const life = (fx.life[i] = fx.life[i]! + dt);
      const max = fx.max[i]!;
      if (life >= max) {
        fx.alive[i] = 0;
        fx.live--;
        fx.col[j] = fx.col[j + 1] = fx.col[j + 2] = 0;
        fx.pos[j + 1] = PARKED_Y;
        if (i < fx.limit) fx.free[fx.top++] = i;
        continue;
      }
      const d = Math.exp(-fx.drag[i]! * dt);
      fx.vel[j + 1] = fx.vel[j + 1]! - fx.grav[i]! * dt;
      fx.vel[j] = fx.vel[j]! * d;
      fx.vel[j + 1] = fx.vel[j + 1]! * d;
      fx.vel[j + 2] = fx.vel[j + 2]! * d;
      fx.pos[j] = fx.pos[j]! + fx.vel[j]! * dt;
      fx.pos[j + 1] = fx.pos[j + 1]! + fx.vel[j + 1]! * dt;
      fx.pos[j + 2] = fx.pos[j + 2]! + fx.vel[j + 2]! * dt;
      const k = 1 - life / max;
      fx.col[j] = fx.rgb[j]! * k;
      fx.col[j + 1] = fx.rgb[j + 1]! * k;
      fx.col[j + 2] = fx.rgb[j + 2]! * k;
    }
    fx.points.geometry.getAttribute('position').needsUpdate = true;
    fx.points.geometry.getAttribute('color').needsUpdate = true;
  }
  for (let i = 0; i < fx.rings.length; i++) {
    const g = fx.rings[i]!;
    if (!g.active) continue;
    g.life += dt;
    g.r += g.vr * dt;
    if (g.life >= g.max) {
      g.active = false;
      g.mesh.visible = false;
      continue;
    }
    g.mesh.scale.setScalar(g.r);
    g.mesh.material.opacity = 1 - g.life / g.max;
    g.mesh.quaternion.copy(camera.quaternion);
  }
  for (let i = 0; i < fx.slashes.length; i++) {
    const s = fx.slashes[i]!;
    if (!s.active) continue;
    s.life += dt;
    if (s.life >= s.max) {
      s.active = false;
      s.mesh.visible = false;
      continue;
    }
    const k = s.life / s.max;
    s.mesh.quaternion.copy(camera.quaternion);
    s.mesh.rotateZ(s.rot);
    s.mesh.scale.setScalar(s.r * (0.8 + 0.3 * k));
    s.mesh.material.opacity = 1 - k;
  }
  if (fx.shakeAmp > 0) {
    fx.shakeAmp *= Math.exp(-SHAKE_DECAY * dt);
    if (fx.shakeAmp < SHAKE_MIN) fx.shakeAmp = 0;
    fx.shakeOff.set((rand(fx) - 0.5) * 2 * fx.shakeAmp, (rand(fx) - 0.5) * 2 * fx.shakeAmp, 0);
  } else fx.shakeOff.set(0, 0, 0);
}

/** Visual clock state: hit-stop freezes effects, slow motion scales them (requirements 13.1, 13.2). */
export type VisualClock = { stopUntil: number; slowUntil: number; slowK: number };

export const newClock = (): VisualClock => ({ stopUntil: -Infinity, slowUntil: -Infinity, slowK: 1 });

/** Freezes the visual clock for `ms` from `now` (a Perfect hit uses 90 ms). A no-op with reduced motion. */
export function hitStop(c: VisualClock, now: number, ms: number, flags: Readonly<MotionFlags>): void {
  if (!flags.hitStop) return;
  c.stopUntil = Math.max(c.stopUntil, now + ms);
}

/** Runs the visual clock at `k` (a Perfect dodge uses 0.3) for `ms` from `now`. A no-op with reduced motion. */
export function slowMo(c: VisualClock, now: number, ms: number, k: number, flags: Readonly<MotionFlags>): void {
  if (!flags.slowMo) return;
  c.slowUntil = Math.max(c.slowUntil, now + ms);
  c.slowK = k;
}

/** The clock's rate at `now`: 0 during hit-stop, the slow-motion factor during slow motion, else 1. */
export function clockScale(c: Readonly<VisualClock>, now: number): number {
  if (now < c.stopUntil) return 0;
  if (now < c.slowUntil) return c.slowK;
  return 1;
}

/** A frame's visual `dt` in seconds: capped at 50 ms, then scaled by the clock. */
export function visualDt(c: Readonly<VisualClock>, now: number, dtSec: number): number {
  return Math.min(0.05, Math.max(0, dtSec)) * clockScale(c, now);
}
