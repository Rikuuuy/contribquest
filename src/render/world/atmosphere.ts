// Lighting, sky fog, fireflies, and the fog bank (v1.6, requirement 21; art-style.md "Lighting" and "Fog and
// atmosphere"). Every scene gets the same fixed rig: one hemisphere, the moon (the only shadow caster), the fill,
// the moon disc and halo, and a pool of four point lights that are moved and dimmed, never added or removed.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  type Scene,
} from 'three';
import { makeRng } from '../../mapgen';
import type { Aim, Vec3 } from './math';
import { slabHeight } from './math';
import { QUALITY, type Quality } from './quality';
import { glowTexture } from './textures';

/** Sky and distance-fog colour, and the fog densities per scene kind. */
export const SKY = '#140d26';
export const FOG_DENSITY = { map: 0.035, arena: 0.05 } as const;
export type SceneKind = keyof typeof FOG_DENSITY;

/** Size of the point-light pool (design FRAME_BUDGET.pointLights). */
export const POINT_LIGHTS = 4;

/** Offsets from the camera aim (sample). */
const MOON_FROM: Vec3 = [-8, 14, 6];
const FILL_FROM: Vec3 = [2, 4, 12];
const DISC_AT: Vec3 = [-22, 18, -40];

export type LightRole = 'off' | 'lantern' | 'boss' | 'chest' | 'wisp';

/** One pooled point light with its base intensity; `lantern` slots flicker. */
export type LightSlot = { light: PointLight; base: number; role: LightRole };

export type LightRig = {
  hemi: HemisphereLight;
  moon: DirectionalLight;
  fill: DirectionalLight;
  disc: Mesh<SphereGeometry, MeshBasicMaterial>;
  halo: Sprite;
  /** Additive glow at the hero's lantern (0.9 units), shown while a slot is a lantern. */
  lanternGlow: Sprite;
  slots: LightSlot[];
};

/** Sets the background and the `FogExp2` distance fog for a scene kind (requirement 21.3). */
export function applySky(scene: Scene, kind: SceneKind): void {
  scene.background = new Color(SKY);
  scene.fog = new FogExp2(SKY, FOG_DENSITY[kind]);
}

function additiveSprite(hex: string, size: number, opacity = 1, fog = true): Sprite {
  const s = new Sprite(
    new SpriteMaterial({ map: glowTexture(hex), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity, fog }),
  );
  s.scale.set(size, size, 1);
  return s;
}

/** Builds the fixed rig into `scene` and applies `quality` (moon shadows at `high` and `medium` only). */
export function makeLightRig(scene: Scene, quality: Quality): LightRig {
  const hemi = new HemisphereLight('#6a58b8', '#10081c', 0.9);
  const moon = new DirectionalLight('#b9c4ff', 1.6);
  Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  moon.shadow.bias = -0.0008;
  const fill = new DirectionalLight('#ffd9b0', 0.7);
  const disc = new Mesh(new SphereGeometry(2.2, 32, 16), new MeshBasicMaterial({ color: '#f3ecd0', fog: false }));
  const halo = additiveSprite('#f0e6c8', 16, 0.6, false);
  const lanternGlow = additiveSprite('#ffb45a', 0.9);
  lanternGlow.visible = false;
  const slots: LightSlot[] = [];
  for (let i = 0; i < POINT_LIGHTS; i++) {
    const light = new PointLight('#ffffff', 0, 3, 1.6);
    slots.push({ light, base: 0, role: 'off' });
    scene.add(light);
  }
  scene.add(hemi, moon, moon.target, fill, disc, halo, lanternGlow);
  const rig: LightRig = { hemi, moon, fill, disc, halo, lanternGlow, slots };
  setRigQuality(rig, quality);
  placeRig(rig, { x: 0, y: 0, z: 0 });
  return rig;
}

/** Moon shadow on/off and its map size for a quality level. */
export function setRigQuality(rig: LightRig, quality: Quality): void {
  const q = QUALITY[quality];
  rig.moon.castShadow = q.shadows;
  if (q.shadows) rig.moon.shadow.mapSize.set(q.shadowMap, q.shadowMap);
}

/** Moves the moon, fill, disc, and halo with the camera aim (offsets from art-style.md). */
export function placeRig(rig: LightRig, aim: Aim): void {
  rig.moon.position.set(aim.x + MOON_FROM[0], aim.y + MOON_FROM[1], aim.z + MOON_FROM[2]);
  rig.moon.target.position.set(aim.x, aim.y, aim.z);
  rig.fill.position.set(aim.x + FILL_FROM[0], aim.y + FILL_FROM[1], aim.z + FILL_FROM[2]);
  rig.disc.position.set(aim.x + DISC_AT[0], aim.y + DISC_AT[1], aim.z + DISC_AT[2]);
  rig.halo.position.copy(rig.disc.position);
}

/** A seen, unresolved chest or wisp that may get one of the two item lights; `top` is its slab-top centre. */
export type LightItem = { kind: 'chest' | 'wisp'; top: Vec3; seen: boolean; resolved: boolean };
/** Map light targets: the hero's anchor (slab top), the altar top, and the item candidates. */
export type LightTargets = { hero: Vec3 | null; boss: Vec3 | null; items: readonly LightItem[] };

const LIGHT = {
  lantern: { color: '#ffb35c', intensity: 2.6, distance: 6, decay: 1.6, off: [0.35, 0.55, 0.1] },
  boss: { color: '#a070ff', intensity: 3, distance: 5, decay: 1.4, off: [0, 1.2, 0.4] },
  chest: { color: '#ffb35c', intensity: 1.2, distance: 3, decay: 1.6, off: [0, 0.5, 0] },
  wisp: { color: '#8dffb0', intensity: 1.0, distance: 3, decay: 1.6, off: [0, 0.5, 0] },
} as const;

function setSlot(s: LightSlot, role: Exclude<LightRole, 'off'>, at: Vec3): void {
  const d = LIGHT[role];
  s.role = role;
  s.base = d.intensity;
  s.light.color.set(d.color);
  s.light.intensity = d.intensity;
  s.light.distance = d.distance;
  s.light.decay = d.decay;
  s.light.position.set(at[0] + d.off[0], at[1] + d.off[1], at[2] + d.off[2]);
}

function clearSlot(s: LightSlot): void {
  s.role = 'off';
  s.base = 0;
  s.light.intensity = 0;
}

/**
 * Assigns the pool on the map (requirement 21.2): the hero's lantern, the boss node, and the two seen,
 * unresolved chests or wisps nearest the hero. Unused slots stay in the scene at intensity 0.
 */
export function assignLights(rig: LightRig, targets: LightTargets): void {
  const slots = rig.slots;
  let n = 0;
  if (targets.hero) setSlot(slots[n++]!, 'lantern', targets.hero);
  if (targets.boss) setSlot(slots[n++]!, 'boss', targets.boss);
  const from = targets.hero ?? targets.boss ?? [0, 0, 0];
  const near = targets.items
    .filter((i) => i.seen && !i.resolved)
    .map((i) => ({ i, d: Math.hypot(i.top[0] - from[0], i.top[2] - from[2]) }))
    .sort((a, b) => a.d - b.d);
  for (let k = 0; k < near.length && n < slots.length && k < 2; k++) {
    const it = near[k]!.i;
    setSlot(slots[n++]!, it.kind, it.top);
  }
  while (n < slots.length) clearSlot(slots[n++]!);
  const lantern = slots.find((s) => s.role === 'lantern');
  rig.lanternGlow.visible = !!lantern;
  if (lantern) rig.lanternGlow.position.copy(lantern.light.position);
}

/** Lantern flicker, `base × (0.85 + 0.1 sin 13t + 0.05 sin 31t)` with t in seconds; base intensity when off. */
export function flicker(rig: LightRig, t: number, on = true): void {
  const k = on ? 0.85 + 0.1 * Math.sin(13 * t) + 0.05 * Math.sin(31 * t) : 1;
  for (let i = 0; i < rig.slots.length; i++) {
    const s = rig.slots[i]!;
    if (s.role === 'lantern') s.light.intensity = s.base * k;
  }
}

/** Fireflies: one additive `Points` cloud with its rest positions kept for the drift. */
export type Fireflies = { points: Points<BufferGeometry, PointsMaterial>; rest: Float32Array; count: number };

/**
 * `n` fireflies centred on the origin, `spread` wide in x (0.6 × in z), between `y0` and `y0 + 2.5` (sample).
 * The draw range is `n`, halved at quality `low` (requirement 21.3). Positions come from a seeded RNG.
 */
export function makeFireflies(n: number, spread: number, y0: number, quality: Quality = 'high', seed = 1): Fireflies {
  const rng = makeRng(seed);
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (rng.next() - 0.5) * spread;
    p[i * 3 + 1] = y0 + rng.next() * 2.5;
    p[i * 3 + 2] = (rng.next() - 0.5) * spread * 0.6;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(p.slice(), 3));
  const points = new Points(
    geo,
    new PointsMaterial({
      map: glowTexture('#8cffb4'),
      color: '#8dffb0',
      size: 0.22,
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  const ff: Fireflies = { points, rest: p, count: n };
  setFireflyQuality(ff, quality);
  return ff;
}

/** Shows `count × QUALITY[quality].fireflies` of the cloud. */
export function setFireflyQuality(ff: Fireflies, quality: Quality): void {
  ff.points.geometry.setDrawRange(0, Math.floor(ff.count * QUALITY[quality].fireflies));
}

/** Moves each firefly along a slow sine path around its rest position, in place; frozen when `on` is false. */
export function driftFireflies(ff: Fireflies, t: number, on = true): void {
  if (!on) return;
  const attr = ff.points.geometry.getAttribute('position') as BufferAttribute;
  const a = attr.array as Float32Array;
  const r = ff.rest;
  for (let i = 0; i < ff.count; i++) {
    const k = i * 3;
    const ph = i * 1.7;
    a[k] = r[k]! + 0.3 * Math.sin(0.4 * t + ph);
    a[k + 1] = r[k + 1]! + 0.2 * Math.sin(0.7 * t + ph * 1.3);
    a[k + 2] = r[k + 2]! + 0.3 * Math.cos(0.5 * t + ph);
  }
  attr.needsUpdate = true;
}

/** Fog-bank layers: opacity and height above the level-4 slab top. */
const FOG_LAYERS = [
  [0.42, 0.22],
  [0.3, 0.42],
  [0.2, 0.66],
] as const;
/** Per-layer texture repeat and drift speed factor, so the layers slide past each other instead of moving as one sheet. */
const FOG_LAYER_MOTION = [
  [2, 1, 1],
  [3, 1.5, -0.7],
  [1.4, 0.8, 1.6],
] as const;
/** The bank fades in over this many units from its near edge, and out over 1 unit at its other edges. */
const FOG_FADE_NEAR = 1.8;
const FOG_FADE_EDGE = 1;
/** Plane subdivisions along x and z, for the vertex-alpha fade. */
const FOG_SEG_X = 32;
const FOG_SEG_Z = 8;
/** Texture drift along +x in world units per second. */
const FOG_DRIFT = 0.05;
const NOISE = 64;

/**
 * The fog bank over the fog columns. `root.position.x` is the near edge; the layers extend right to the last
 * column's far side (`cols − 0.5`) and never reach the boss node.
 */
export type FogBank = { root: Group; layers: Mesh<PlaneGeometry, MeshBasicMaterial>[]; noise: DataTexture; maps: DataTexture[]; cols: number; depth: number; edge: number };

/** A soft, tileable value-noise alpha texture from a seed (`#7a70a8`); squared so it forms wisps with clear gaps. */
function fogNoise(seed: number): DataTexture {
  const rng = makeRng(seed);
  const G = 8;
  const grid = Array.from({ length: G * G }, () => rng.next());
  const at = (x: number, y: number) => grid[((y % G) * G + (x % G)) | 0]!;
  const data = new Uint8Array(NOISE * NOISE * 4);
  for (let y = 0; y < NOISE; y++)
    for (let x = 0; x < NOISE; x++) {
      const fx = (x / NOISE) * G;
      const fy = (y / NOISE) * G;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const sx = fx - x0;
      const sy = fy - y0;
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const bot = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      const v = top * (1 - sy) + bot * sy;
      const i = (y * NOISE + x) * 4;
      data[i] = 0x7a;
      data[i + 1] = 0x70;
      data[i + 2] = 0xa8;
      data[i + 3] = Math.round(255 * v * v);
    }
  const t = new DataTexture(data, NOISE, NOISE);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.repeat.set(2, 1);
  t.needsUpdate = true;
  return t;
}

/** Builds the fog bank for a map (requirement 21.4); call `setFogStart` with `RouteView.fogFrom`. */
export function makeFogBank(map: { cols: number; rows: number; seed: number }): FogBank {
  const noise = fogNoise(map.seed);
  const root = new Group();
  const depth = map.rows + 2;
  const maps: DataTexture[] = [];
  const layers = FOG_LAYERS.map(([opacity, above], li) => {
    // A unit-wide plane whose left edge is at x = 0, lying flat; its x scale is the covered width. Vertex alpha
    // (set in `setFogStart`) fades every edge, so the bank reads as mist rather than a sheet.
    const g = new PlaneGeometry(1, depth, FOG_SEG_X, FOG_SEG_Z);
    g.rotateX(-Math.PI / 2);
    g.translate(0.5, 0, 0);
    g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position!.count * 4).fill(1), 4));
    const [rx, ry] = FOG_LAYER_MOTION[li]!;
    const tex = li === 0 ? noise : (noise.clone() as DataTexture);
    tex.repeat.set(rx, ry);
    tex.offset.set(li * 0.37, li * 0.21);
    tex.needsUpdate = true;
    maps.push(tex);
    const m = new Mesh(g, new MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, vertexColors: true }));
    m.position.set(0, slabHeight(4) + above, (map.rows - 1) / 2);
    m.renderOrder = 1;
    root.add(m);
    return m;
  });
  const bank: FogBank = { root, layers, noise, maps, cols: map.cols, depth, edge: 0 };
  setFogStart(bank, map.cols);
  return bank;
}

/** Puts the bank's near edge at `col − 0.5` (the first fog column); hidden when no column is fogged. */
export function setFogStart(bank: FogBank, col: number): void {
  bank.edge = col - 0.5;
  bank.root.position.x = bank.edge;
  const width = bank.cols - 0.5 - bank.edge;
  bank.root.visible = width > 0;
  const w = Math.max(width, 1e-3);
  const smooth = (e: number, x: number) => {
    const k = Math.min(1, Math.max(0, x / e));
    return k * k * (3 - 2 * k);
  };
  for (const m of bank.layers) {
    m.scale.x = w;
    const pos = m.geometry.attributes.position!;
    const col = m.geometry.attributes.color as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) * w;
      const dz = bank.depth / 2 - Math.abs(pos.getZ(i));
      col.setW(i, smooth(FOG_FADE_NEAR, dx) * smooth(FOG_FADE_EDGE, w - dx) * smooth(FOG_FADE_EDGE, dz));
    }
    col.needsUpdate = true;
  }
}

/** Drifts the bank's texture along +x by `dt` seconds; frozen when `on` is false. */
export function driftFog(bank: FogBank, dt: number, on = true): void {
  if (!on) return;
  bank.maps.forEach((t, i) => {
    t.offset.x -= (FOG_DRIFT * FOG_LAYER_MOTION[i]![2] * dt * t.repeat.x) / bank.cols;
  });
}

/** Counts the lights under `root` by type (tests and the frame-budget check). */
export function countLights(root: Object3D): { hemi: number; directional: number; point: number } {
  const n = { hemi: 0, directional: 0, point: 0 };
  root.traverse((o) => {
    if (o instanceof HemisphereLight) n.hemi++;
    else if (o instanceof DirectionalLight) n.directional++;
    else if (o instanceof PointLight) n.point++;
  });
  return n;
}
