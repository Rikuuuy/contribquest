// Pure world maths for the Three.js renderer (v1.6). No `three` import, so it is unit tested in Node.
// One world unit is one tile pitch: column → x, row → z (row 0 farthest from the camera), y is up
// (art-style.md "3D billboard world").
import type { GameMap, Pos } from '../../mapgen';

export type Vec3 = readonly [x: number, y: number, z: number];

/** Slab height for a day level 0–4: `0.18 + 0.12 × level` (requirement 19.1). */
export function slabHeight(level: number): number {
  return 0.18 + 0.12 * level;
}

/** World `[x, z]` of a tile centre: spacing 1, row 0 farthest from the camera. */
export function tileWorld(col: number, row: number): [x: number, z: number] {
  return [col, row];
}

/** World `[x, z]` of the boss node, one unit right of the last column at `bossNode.row` (requirement 23.3). */
export function bossNodeWorld(map: Pick<GameMap, 'cols' | 'bossNode'>): [x: number, z: number] {
  return tileWorld(map.cols, map.bossNode.row);
}

/** Billboard roles: map sizes, then arena sizes (`arena*`). Monster roles carry the tier. */
export type SpriteRole =
  | 'hero'
  | 'mon1'
  | 'mon2'
  | 'mon3'
  | 'mon4'
  | 'item'
  | 'boss'
  | 'arenaHero'
  | 'arenaMon1'
  | 'arenaMon2'
  | 'arenaMon3'
  | 'arenaMon4'
  | 'arenaBoss';

/**
 * World size of one sprite pixel per role (art-style.md "Scale rules"). Map: hero 1/17, monsters 1/18 (tiers 1–2)
 * and 1/17 (tiers 3–4), items 1/20, the Phantom on the boss node 1/15. Arena: stage scale / 32 (hero 2,
 * monsters 3 / 3 / 3.5 / 4, boss 4.5).
 */
export const PX: Readonly<Record<SpriteRole, number>> = {
  hero: 1 / 17,
  mon1: 1 / 18,
  mon2: 1 / 18,
  mon3: 1 / 17,
  mon4: 1 / 17,
  item: 1 / 20,
  boss: 1 / 15,
  arenaHero: 2 / 32,
  arenaMon1: 3 / 32,
  arenaMon2: 3 / 32,
  arenaMon3: 3.5 / 32,
  arenaMon4: 4 / 32,
  arenaBoss: 4.5 / 32,
};

/** Plane size of a `w × h` sprite grid with its 1 px outline baked in: `(w + 2) × px` by `(h + 2) × px`. */
export function spriteWorldSize(w: number, h: number, role: SpriteRole): { w: number; h: number; px: number } {
  const px = PX[role];
  return { w: (w + 2) * px, h: (h + 2) * px, px };
}

/** Camera target. `span` (overview only) is the half extent `[x, z]` of what must stay in view, margin included. */
export type Aim = { x: number; y: number; z: number; span?: readonly [number, number] };

/** The middle row of the 7-row map, where both map cameras aim. */
const MID_ROW = 3;

/** Follow aim: 1.5 columns right of the hero's column, at the map's middle row (requirement 19.3). */
export function followAim(pos: Pos, _map?: Pick<GameMap, 'rows'>): Aim {
  const [x, z] = tileWorld(pos.col + 1.5, MID_ROW);
  return { x, y: 0, z };
}

/** Altar half width (1.6 × 1.6 box) and its height, for the overview fit. */
const ALTAR_HALF = 0.8;
const ALTAR_H = 0.9;

/**
 * Overview aim: the centre of the map including the boss node, with the half extent that must stay in view
 * (every slab and the altar plus a 1 unit margin).
 */
export function overviewAim(map: Pick<GameMap, 'cols' | 'rows' | 'bossNode'>): Aim {
  const x0 = -0.45 - 1;
  const x1 = bossNodeWorld(map)[0] + ALTAR_HALF + 1;
  const z0 = -0.45 - 1;
  const z1 = map.rows - 1 + 0.45 + 1;
  return { x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2, span: [(x1 - x0) / 2, (z1 - z0) / 2] };
}

export type CameraView = 'follow' | 'overview' | 'battle';
export type CameraPose = { pos: Vec3; look: Vec3; fov: number; near: number; far: number };

/** Map camera offset from its aim (sample framing: about 38° down, 10° yaw from the left). */
export const MAP_OFFSET: Vec3 = [-1.6, 7.2, 9.0];
/** Battle camera position and look point (sample); the arena is built around the origin. */
export const BATTLE_POS: Vec3 = [-0.6, 2.3, 7.4];
export const BATTLE_LOOK: Vec3 = [0.1, 1.45, 0];
/** Portrait map cameras pull back by this factor and widen the FOV to 55°. */
export const PORTRAIT_PULL = 1.25;
const NEAR = 0.1;
const FAR = 200;

/**
 * Camera pose for a view (art-style.md "Camera angles"). `follow`: aim + offset, FOV 40° (portrait: 55° and
 * 1.25 × offset). `overview`: the smallest `k ≥ 1` with every corner of `aim.span` (from ground to altar top)
 * inside the view. `battle`: the sample pose around `aim`; the stage is always 8:3.
 */
export function cameraFor(view: CameraView, aim: Aim, aspect: number): CameraPose {
  if (view === 'battle') {
    return {
      pos: [aim.x + BATTLE_POS[0], aim.y + BATTLE_POS[1], aim.z + BATTLE_POS[2]],
      look: [aim.x + BATTLE_LOOK[0], aim.y + BATTLE_LOOK[1], aim.z + BATTLE_LOOK[2]],
      fov: 40,
      near: NEAR,
      far: FAR,
    };
  }
  const portrait = aspect < 1;
  const fov = portrait ? 55 : 40;
  const at = (k: number): CameraPose => ({
    pos: [aim.x + k * MAP_OFFSET[0], aim.y + k * MAP_OFFSET[1], aim.z + k * MAP_OFFSET[2]],
    look: [aim.x, aim.y, aim.z],
    fov,
    near: NEAR,
    far: FAR,
  });
  if (view === 'follow') return at(portrait ? PORTRAIT_PULL : 1);
  const [sx, sz] = aim.span ?? [0, 0];
  const corners: Vec3[] = [];
  for (const dx of [-sx, sx]) for (const dz of [-sz, sz]) for (const y of [0, ALTAR_H]) corners.push([aim.x + dx, y, aim.z + dz]);
  let k = 1;
  while (k < 8 && !corners.every((p) => inView(at(k), aspect, p))) k += 0.01;
  return at(k);
}

/** True when world point `p` projects inside the camera's view frustum (between near and far). */
export function inView(cam: CameraPose, aspect: number, p: Vec3): boolean {
  const f = norm(sub(cam.look, cam.pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, cam.pos);
  const zc = dot(d, f);
  if (zc < cam.near || zc > cam.far) return false;
  const t = Math.tan(((cam.fov / 2) * Math.PI) / 180);
  return Math.abs(dot(d, u)) <= zc * t && Math.abs(dot(d, r)) <= zc * t * aspect;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** The prototype's `easeOutBack` (overshoots slightly past 1 before settling). */
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Rise duration per slab (ms) and the share of its progress after which its contents show (requirement 19.4). */
export const RISE_MS = 420;
export const RISE_CONTENT_AT = 0.65;

/** Rise start delay of a slab in ms: `col × 70 + row × 12`. */
export function riseDelay(col: number, row: number): number {
  return col * 70 + row * 12;
}
