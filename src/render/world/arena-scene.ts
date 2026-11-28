// The 3D battle arena (v1.6, requirements 18.2, 22.1–22.4, 22.7; art-style.md "3D billboard world"). The seeded
// graveyard from the billboard sample: a cobbled path, grass in the source day's level colour, an iron fence,
// tombstones, gate pillars, dead trees with purple blossoms, the hero on the left and the foe on the right lit
// purple and ember. Built per fight and disposed after it. `tickArena` runs per frame and allocates nothing.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
  type FogExp2,
} from 'three';
import type { ClassId, RaceId } from '../../data/schema';
import type { RunState } from '../../engine';
import { fnv1a, makeRng, tileAt } from '../../mapgen';
import { MONSTER_SPRITE } from '../sprites/build';
import { HERO_FRAMES, heroFrame, type FrameOpts, type HeroFrame } from '../sprites/hero';
import { applySky, assignArenaLights, driftFireflies, flicker, makeFireflies, makeLightRig, type Fireflies, type LightRig, type LightSlot } from './atmosphere';
import { faceCamera, makeBillboard, setFacing, setFrame, type Billboard } from './billboard';
import { disposeTree, type Disposed } from './dispose';
import { makeFx3d, newClock, tickFx, type Fx3d, type VisualClock } from './fx3d';
import { graveGeometry, SLAB_COLORS, type WorldDeps } from './map-scene';
import { cameraFor, type SpriteRole } from './math';
import type { MotionFlags } from './motion-flags';
import { FRAME_BUDGET, type Quality } from './quality';
import { cachedTexture, glowTexture, spriteTexture } from './textures';

/** What the arena is built from: the source day (date and level), the boss flag, the hero, and the foe's tier. */
export type ArenaSpec = { date: string; level: number; boss: boolean; cls: ClassId; race: RaceId; tier: 1 | 2 | 3 | 4 | 5 };

/** Hero and foe stand-in x positions, the floor height, and the boss hover (art-style.md "Scale rules"). */
export const HERO_AT = [-2.6, 0.15, 0.3] as const;
export const FOE_AT = [2.4, 0.15, -0.2] as const;
export const BOSS_HOVER = 0.12;
const BOSS_BOB = 0.08;
/** Strike lunge distance and timeline in ms: wind-up, out, back (requirement 22.3). */
export const LUNGE = 0.6;
const WINDUP_MS = 40;
const OUT_MS = 100;
const BACK_MS = 300;
const WINDUP_BACK = 0.12;
/** Hit recoil (units, ms) and flash length (ms). */
const RECOIL = 0.15;
const HURT_MS = 220;
const FLASH_MS = 120;
const DIE_MS = 600;
/** Phase-2 tint (requirement 22.4). */
const PHASE2_DELAY = 250;
const PHASE2_MS = 400;
const PHASE2_LIGHT = '#ff3a3a';
const PHASE2_SKY = '#2a0d1a';
const BOSS_SKY = '#0d0718';
const SKY = '#140d26';
/** Petals (arena only): count, colour, fall speed (units per second), and the volume they fall through. */
const PETALS = 40;
const PETAL_FALL = 0.3;
const PETAL_TOP = 4.2;
const PETAL_W = 16;
/** Path, cobbles, fence. The 8:3 stage is wider than the sample's 16:9 view, so the path and cobbles run 20 units. */
const PATH_W = 20;
const JITTER = 0.3;

/** Rig poses as texture swaps: each is a cached row-shifted copy of the idle sprite (prototype `heroRig`, `monRig`). */
export type RigPose = 'windup' | 'lunge' | 'hurt';
export const RIG_POSES: readonly RigPose[] = ['windup', 'lunge', 'hurt'];
/** The lean (sprite pixels at the top row) of each pose, from the prototype rigs. */
export const RIG_LEAN: Readonly<Record<'hero' | 'mon', Readonly<Record<RigPose, number>>>> = {
  hero: { windup: -3, lunge: 4, hurt: -3.5 },
  mon: { windup: -2.5, lunge: 3.5, hurt: -3 },
};
export type Flash = 'white' | 'red' | 'gold';

/** Key of a rig pose of sprite `base` (`{base}:rig:{pose}`). */
export const rigKey = (base: string, pose: RigPose) => `${base}:rig:${pose}`;
/** Key of a flash silhouette of sprite `base` (`{base}:white|red|gold`). */
export const flashKey = (base: string, f: Flash) => `${base}:${f}`;

/** One fighter: its billboard, home position, and the animation marks (`performance.now()` ms; −∞ when idle). */
export type Actor = {
  bb: Billboard;
  home: Vector3;
  /** +1 toward the right (the hero), −1 toward the left (the foe). */
  dir: 1 | -1;
  kind: 'hero' | 'mon';
  /** Base sprite key (the hero's idle frame or the monster). */
  base: string;
  lungeAt: number;
  hurtAt: number;
  flash: Flash | null;
  flashAt: number;
  deadAt: number;
  down: boolean;
  /** Bob phase. */
  k: number;
};

export type ArenaScene = {
  scene: Scene;
  camera: PerspectiveCamera;
  /** The battle camera's resting position; shake offsets it. */
  camBase: Vector3;
  spec: ArenaSpec;
  hero: Actor;
  foe: Actor;
  heroKeys: Record<HeroFrame, string>;
  billboards: Billboard[];
  rig: LightRig;
  foeLight: LightSlot;
  fireflies: Fireflies;
  petals: Points<BufferGeometry, PointsMaterial>;
  petalRest: Float32Array;
  fx: Fx3d;
  clock: VisualClock;
  /** Props by name, for tests and the frame budget. */
  props: {
    path: Mesh;
    cobbles: InstancedMesh;
    grass: Mesh<PlaneGeometry, MeshStandardMaterial>;
    bars: InstancedMesh;
    rail: Mesh;
    graves: InstancedMesh;
    pillars: InstancedMesh;
    trunks: InstancedMesh;
    blossoms: InstancedMesh;
    farGlow: Sprite;
  };
  /** Phase-2 tint: start (ms) or −∞ when not started; sky and light colours it eases from and to. */
  tint: { start: number; from: Color; light: Color; sky: Color; toLight: Color; toSky: Color; k: number };
  frameOpts: FrameOpts;
  deps: WorldDeps;
};

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3();
const _c = new Color();

/** The arena spec for the open fight: the fight's day tile (the best day for the boss), or null outside a fight. */
export function arenaSpecFor(state: RunState): ArenaSpec | null {
  const f = state.combat;
  if (!f) return null;
  const tier = Math.min(5, Math.max(1, f.m.tier)) as ArenaSpec['tier'];
  const boss = tier === 5;
  const tile = boss ? state.map.tiles[state.map.bossIdx] : tileAt(state.map, f.col, f.row);
  return {
    date: tile?.day.date ?? state.map.tiles[0]?.day.date ?? '',
    level: Math.min(4, Math.max(0, tile?.day.level ?? 0)),
    boss,
    cls: state.hero.cls,
    race: state.hero.race,
    tier,
  };
}

/** Registers (once) and returns a sprite texture key. */
function useSprite(deps: WorldDeps, key: string): string {
  if (!cachedTexture(key)) spriteTexture(key, deps.spriteCanvas(key));
  return key;
}

/** Registers the base sprite, its flash silhouettes, and its rig poses up front, so swaps never upload mid-fight. */
function registerActor(deps: WorldDeps, base: string): void {
  useSprite(deps, base);
  for (const f of ['white', 'red', 'gold'] as const) useSprite(deps, flashKey(base, f));
  for (const p of RIG_POSES) useSprite(deps, rigKey(base, p));
}

function actor(deps: WorldDeps, list: Billboard[], base: string, role: SpriteRole, at: readonly number[], dir: 1 | -1, kind: Actor['kind'], k: number): Actor {
  registerActor(deps, base);
  const bb = makeBillboard(base, role);
  setFacing(bb, dir);
  bb.root.position.set(at[0]!, at[1]!, at[2]!);
  list.push(bb);
  return { bb, home: new Vector3(at[0], at[1], at[2]), dir, kind, base, lungeAt: -Infinity, hurtAt: -Infinity, flash: null, flashAt: -Infinity, deadAt: -Infinity, down: false, k };
}

/** Seeded placement: `base ± JITTER` from the arena's RNG. */
type Rng = { next(): number };
const jit = (rng: Rng) => (rng.next() * 2 - 1) * JITTER;

/** Builds the arena for a fight (requirements 22.1, 22.2). The same source date always gives the same props. */
export function buildArena(spec: ArenaSpec, deps: WorldDeps, quality: Quality, aspect = 8 / 3): ArenaScene {
  const scene = new Scene();
  applySky(scene, 'arena');
  const skyHex = spec.boss ? BOSS_SKY : SKY;
  (scene.background as Color).set(skyHex);
  (scene.fog as FogExp2).color.set(skyHex);
  const rng = makeRng(fnv1a(`arena:${spec.date}`));

  // Ground under everything, the grass behind the path, the path and its cobbles.
  const ground = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: '#120e1c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  const grass = new Mesh(new PlaneGeometry(40, 10), new MeshStandardMaterial({ color: SLAB_COLORS[spec.level] ?? SLAB_COLORS[0], roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0.01, -5);
  grass.receiveShadow = true;
  const path = new Mesh(new BoxGeometry(PATH_W, 0.12, 3.2), new MeshStandardMaterial({ color: '#4b4860', roughness: 1, flatShading: true }));
  path.position.y = 0.06;
  path.receiveShadow = true;
  const cobbleSpots: [number, number][] = [];
  for (let i = -PATH_W / 2; i <= PATH_W / 2; i += 0.5) for (const z of [-1.2, 0, 1.2]) cobbleSpots.push([i + (z ? 0.25 : 0), z]);
  const cobbles = new InstancedMesh(new BoxGeometry(0.46, 0.04, 1.1), new MeshStandardMaterial({ roughness: 1 }), cobbleSpots.length);
  const ca = new Color('#5d5a74');
  const cb = new Color('#55526a');
  cobbleSpots.forEach(([x, z], i) => {
    cobbles.setMatrixAt(i, _m.makeTranslation(x, 0.13, z));
    cobbles.setColorAt(i, (Math.round(x * 2) + Math.round(z)) % 2 ? ca : cb);
  });
  cobbles.receiveShadow = true;

  // Iron fence with its rail.
  const iron = new MeshStandardMaterial({ color: '#1c1a26', metalness: 0.6, roughness: 0.5 });
  const barXs: number[] = [];
  for (let x = -10; x <= 10.001; x += 0.35) barXs.push(x);
  const bars = new InstancedMesh(new BoxGeometry(0.05, 1.3, 0.05), iron, barXs.length);
  barXs.forEach((x, i) => bars.setMatrixAt(i, _m.makeTranslation(x, 0.65, -3.2)));
  bars.castShadow = true;
  const rail = new Mesh(new BoxGeometry(20, 0.06, 0.06), iron);
  rail.position.set(0, 1.1, -3.2);

  // Five tombstones at 1.4×, jittered and tilted from the seed.
  const stone = new MeshStandardMaterial({ roughness: 0.95, flatShading: true, vertexColors: true });
  const GRAVES: [number, number][] = [[-4.5, -2.4], [-2.6, -2.6], [2.8, -2.5], [5.2, -2.3], [-6, -1.9]];
  const graves = new InstancedMesh(graveGeometry(), stone, GRAVES.length);
  GRAVES.forEach(([x, z], i) => {
    _q.setFromEuler(_e.set(0, (rng.next() - 0.5) * 0.5, (rng.next() - 0.5) * 0.15));
    graves.setMatrixAt(i, _m.compose(_v.set(x + jit(rng), 0, z + jit(rng) * 0.5), _q, _s.set(1.4, 1.4, 1.4)));
  });
  graves.castShadow = graves.receiveShadow = true;

  // Gate pillars.
  const pillars = new InstancedMesh(new BoxGeometry(0.5, 3, 0.5), new MeshStandardMaterial({ color: '#5a5670', roughness: 0.95, flatShading: true }), 2);
  [-1.4, 1.4].forEach((x, i) => pillars.setMatrixAt(i, _m.makeTranslation(x + jit(rng) * 0.5, 1.5, -4.2 + jit(rng) * 0.5)));
  pillars.castShadow = true;

  // Dead trees with nine low-poly blossoms each.
  const TREES: [number, number, number][] = [[-6.5, -3.8, 1.2], [6.8, -3.6, 1]];
  const trunks = new InstancedMesh(new CylinderGeometry(0.12, 0.22, 3, 6).translate(0, 1.5, 0), new MeshStandardMaterial({ color: '#2a1c22', roughness: 1, flatShading: true }), TREES.length);
  const blossoms = new InstancedMesh(
    new IcosahedronGeometry(0.45, 0),
    new MeshStandardMaterial({ color: '#7a3d7a', roughness: 0.8, flatShading: true, emissive: '#3a1040', emissiveIntensity: 0.4 }),
    TREES.length * 9,
  );
  TREES.forEach(([tx, tz, s], ti) => {
    const x = tx + jit(rng);
    const z = tz + jit(rng) * 0.5;
    trunks.setMatrixAt(ti, _m.compose(_v.set(x, 0, z), _q.identity(), _s.set(s, s, s)));
    for (let k = 0; k < 9; k++) {
      const a = k * 2.3 + jit(rng);
      _q.setFromEuler(_e.set(rng.next() * 3, rng.next() * 3, 0));
      const bs = s * (0.85 + rng.next() * 0.3);
      blossoms.setMatrixAt(
        ti * 9 + k,
        _m.compose(_v.set(x + Math.cos(a) * 1.1 * s, 2.9 * s + Math.sin(k * 1.7) * 0.5 + jit(rng) * 0.5, z + Math.sin(a) * 0.6), _q, _s.set(bs, bs, bs)),
      );
    }
  });
  trunks.castShadow = blossoms.castShadow = true;
  for (const im of [cobbles, bars, graves, pillars, trunks, blossoms]) im.computeBoundingSphere();
  scene.add(ground, grass, path, cobbles, bars, rail, graves, pillars, trunks, blossoms);

  // The fighters.
  const billboards: Billboard[] = [];
  const heroKeys = {} as Record<HeroFrame, string>;
  for (const f of HERO_FRAMES) heroKeys[f] = useSprite(deps, `hero:${spec.cls}:${spec.race}:${f}`);
  const hero = actor(deps, billboards, heroKeys.idle, 'arenaHero', HERO_AT, 1, 'hero', 1);
  const foeRole = spec.boss ? 'arenaBoss' : (`arenaMon${Math.min(4, spec.tier)}` as SpriteRole);
  const foeAt = spec.boss ? [FOE_AT[0], FOE_AT[1] + BOSS_HOVER, FOE_AT[2]] : FOE_AT;
  const foe = actor(deps, billboards, `mon:${MONSTER_SPRITE[spec.tier]}`, foeRole, foeAt, -1, 'mon', 2);
  scene.add(hero.bb.root, foe.bb.root);

  // Lights: the shared rig, the arena's four pooled point lights, and the far lantern's glow.
  const rig = makeLightRig(scene, quality);
  const foeLight = assignArenaLights(rig, spec.boss);
  if (spec.boss) {
    rig.halo.material.opacity = 0.8;
    rig.halo.scale.set(20, 20, 1);
  }
  const farGlow = new Sprite(new SpriteMaterial({ map: glowTexture('#ffb45a'), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  farGlow.scale.set(0.9, 0.9, 1);
  farGlow.position.copy(rig.slots[1]!.light.position);
  scene.add(farGlow);

  // Fireflies and petals.
  const fireflies = makeFireflies(50, 16, 0.6, quality, fnv1a(spec.date) || 1);
  const petalRest = new Float32Array(PETALS * 3);
  for (let i = 0; i < PETALS; i++) {
    petalRest[i * 3] = (rng.next() - 0.5) * PETAL_W;
    petalRest[i * 3 + 1] = rng.next() * PETAL_TOP;
    petalRest[i * 3 + 2] = -3.5 + rng.next() * 5;
  }
  const pg = new BufferGeometry();
  pg.setAttribute('position', new BufferAttribute(petalRest.slice(), 3));
  const petals = new Points(pg, new PointsMaterial({ color: '#c77dce', size: 0.08, transparent: true, opacity: 0.9, depthWrite: false }));
  petals.frustumCulled = false;
  const fx = makeFx3d(FRAME_BUDGET.poolArena, quality);
  scene.add(fireflies.points, petals, fx.root);

  const camera = new PerspectiveCamera(40, aspect, 0.1, 200);
  const pose = cameraFor('battle', { x: 0, y: 0, z: 0 }, aspect);
  camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
  camera.updateMatrixWorld();

  const from = new Color(skyHex);
  return {
    scene,
    camera,
    camBase: camera.position.clone(),
    spec,
    hero,
    foe,
    heroKeys,
    billboards,
    rig,
    foeLight,
    fireflies,
    petals,
    petalRest,
    fx,
    clock: newClock(),
    props: { path, cobbles, grass, bars, rail, graves, pillars, trunks, blossoms, farGlow },
    tint: { start: -Infinity, from, light: foeLight.light.color.clone(), sky: from.clone(), toLight: new Color(PHASE2_LIGHT), toSky: new Color(PHASE2_SKY), k: 0 },
    frameOpts: { moving: false, seed: 700, reduced: false },
    deps,
  };
}

/** Sets the camera aspect; the battle pose and FOV never change (the stage is always 8:3, requirement 22.7). */
export function setArenaAspect(a: ArenaScene, aspect: number): void {
  a.camera.aspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 8 / 3;
  a.camera.updateProjectionMatrix();
}

/** Starts a strike by `who`: wind-up, a 0.6-unit lunge toward the target, and back (requirement 22.3). */
export function arenaStrike(a: ArenaScene, who: 'hero' | 'foe', now: number): void {
  (who === 'hero' ? a.hero : a.foe).lungeAt = now;
}

/** A hit on `who`: recoil, the hurt pose, and a flash silhouette (flashes off with reduced motion). */
export function arenaHit(a: ArenaScene, who: 'hero' | 'foe', now: number, flash: Flash, flags: Readonly<MotionFlags>): void {
  const t = who === 'hero' ? a.hero : a.foe;
  t.hurtAt = now;
  if (flags.flashes) {
    t.flash = flash;
    t.flashAt = now;
  }
}

/** The foe falls: it flickers white, sinks, and fades over 600 ms. */
export function arenaDeath(a: ArenaScene, now: number): void {
  a.foe.deadAt = now;
}

/** The hero is down (a lethal strike): the sprite tips over. */
export function arenaHeroDown(a: ArenaScene): void {
  a.hero.down = true;
}

/**
 * Phase 2 (requirement 22.4): after 250 ms the foe's purple light eases to `#ff3a3a` and the sky and fog to
 * `#2a0d1a` over 400 ms, kept until the fight ends. With reduced motion the tint is applied at once.
 */
export function arenaPhase2(a: ArenaScene, now: number, flags: Readonly<MotionFlags>): void {
  if (a.tint.start > -Infinity) return;
  a.tint.start = flags.flashes ? now + PHASE2_DELAY : -1e12;
  if (!flags.flashes) applyTint(a, 1);
}

function applyTint(a: ArenaScene, k: number): void {
  a.tint.k = k;
  a.foeLight.light.color.lerpColors(a.tint.light, a.tint.toLight, k);
  _c.lerpColors(a.tint.sky, a.tint.toSky, k);
  (a.scene.background as Color).copy(_c);
  (a.scene.fog as FogExp2).color.copy(_c);
}

/** World anchor of a fighter's body centre (for effects and floating text), written into `out`. */
export function arenaAnchor(a: ArenaScene, who: 'hero' | 'foe', out: Vector3): Vector3 {
  const t = who === 'hero' ? a.hero : a.foe;
  const h = (t.bb.mesh.geometry.parameters as { height: number }).height;
  return out.set(t.bb.root.position.x, t.bb.root.position.y + h * 0.55, t.bb.root.position.z + 0.05);
}

const clamp01 = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k);

/** One fighter's offset along x, pose, and texture at `now`. */
function tickActor(a: ArenaScene, t: Actor, now: number, flags: Readonly<MotionFlags>): void {
  let dx = 0;
  let pose: RigPose | null = null;
  const sl = now - t.lungeAt;
  if (sl >= 0 && sl < BACK_MS) {
    if (sl < WINDUP_MS) {
      dx = -WINDUP_BACK * (sl / WINDUP_MS);
      pose = 'windup';
    } else if (sl < OUT_MS) {
      const k = (sl - WINDUP_MS) / (OUT_MS - WINDUP_MS);
      dx = -WINDUP_BACK + (LUNGE + WINDUP_BACK) * k;
      pose = 'lunge';
    } else dx = LUNGE * (1 - (sl - OUT_MS) / (BACK_MS - OUT_MS));
  }
  const sh = now - t.hurtAt;
  if (sh >= 0 && sh < HURT_MS) {
    dx -= RECOIL * (1 - sh / HURT_MS);
    pose = 'hurt';
  }
  const p = t.bb.root.position;
  const time = now / 1000;
  const boss = t.kind === 'mon' && a.spec.boss;
  const bob = !flags.bob ? 0 : boss ? Math.sin(time * 1.4) * BOSS_BOB : Math.abs(Math.sin(2 * time + t.k)) * 0.02;
  p.set(t.home.x + dx * t.dir, t.home.y + bob, t.home.z);

  // Texture: flash, then rig pose, then (hero) the animated frame.
  let key: string;
  if (t.flash && now - t.flashAt < FLASH_MS) key = flashKey(t.base, t.flash);
  else if (pose && flags.rigs) key = rigKey(t.base, pose);
  else if (t.kind === 'hero') {
    a.frameOpts.reduced = !flags.frames;
    key = a.heroKeys[heroFrame(now, a.frameOpts)];
  } else key = t.base;
  if (t.kind === 'hero' && t.down) key = t.base;

  // Death: flicker white, sink, and fade.
  const m = t.bb.mesh;
  if (t.deadAt > -Infinity) {
    const k = clamp01((now - t.deadAt) / DIE_MS);
    if (flags.flashes && Math.floor((now - t.deadAt) / 50) % 2 === 0 && k < 1) key = flashKey(t.base, 'white');
    if (!m.material.transparent) {
      m.material.transparent = true;
      m.material.alphaTest = 0.05;
      m.material.needsUpdate = true;
    }
    m.material.opacity = 1 - k;
    m.scale.y = 1 - k * 0.7;
    t.bb.root.visible = k < 1;
  }
  setFrame(t.bb, key);
  m.rotation.z = t.down ? 1.4 * -t.dir : 0;
}

/** Advances the arena to `now` (ms); `dt` is the visual clock's seconds. Allocates nothing. */
export function tickArena(a: ArenaScene, now: number, dt: number, flags: Readonly<MotionFlags>): void {
  const t = now / 1000;
  tickActor(a, a.hero, now, flags);
  tickActor(a, a.foe, now, flags);

  // Phase-2 tint.
  if (a.tint.start > -Infinity && a.tint.k < 1) applyTint(a, clamp01((now - a.tint.start) / PHASE2_MS));

  // Petals fall and sway (hidden with reduced motion).
  a.petals.visible = flags.petals;
  if (flags.petals) {
    const attr = a.petals.geometry.getAttribute('position') as BufferAttribute;
    const p = attr.array as Float32Array;
    const r = a.petalRest;
    for (let i = 0; i < PETALS; i++) {
      const k = i * 3;
      const y = (((r[k + 1]! - t * PETAL_FALL) % PETAL_TOP) + PETAL_TOP) % PETAL_TOP;
      p[k] = r[k]! + 0.35 * Math.sin(t * 0.9 + i * 1.3);
      p[k + 1] = y;
      p[k + 2] = r[k + 2]! + 0.15 * Math.cos(t * 0.7 + i);
    }
    attr.needsUpdate = true;
  }

  flicker(a.rig, t, flags.flicker);
  a.rig.lanternGlow.position.copy(a.rig.slots[0]!.light.position);
  driftFireflies(a.fireflies, t, flags.fireflyDrift);
  tickFx(a.fx, dt, a.camera);
  a.camera.position.copy(a.camBase).add(a.fx.shakeOff);
  faceCamera(a.billboards, a.camera);
}

/** Releases the arena's geometries, materials, and textures (cached sprite textures stay). */
export function disposeArena(a: ArenaScene): Disposed {
  a.billboards.length = 0;
  return disposeTree(a.scene);
}
