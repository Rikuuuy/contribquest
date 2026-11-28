// The 3D map scene (v1.6, requirements 19, 21.4, 23, 25.3; art-style.md "Slabs and map props"). One slab per
// day on five instanced meshes (one per level), one instanced mesh for the gravestones, ground labels, the boss
// altar, the best-day flame, content billboards, visited frames, highlights, and the hero with its aura.
// `buildMapScene` allocates everything; `syncMap` runs after each step; `tickMap` runs per frame and allocates
// nothing.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  type Object3D,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ClassId, RaceId } from '../../data/schema';
import type { RunState } from '../../engine';
import { fnv1a, parseDate, type DayTile, type GameMap, type Pos } from '../../mapgen';
import { MONTHS } from '../../mapgen/dates';
import type { RouteTarget, RouteView } from '../map/route-view';
import { HERO_FRAMES, heroFrame, type FrameOpts, type HeroFrame } from '../sprites/hero';
import { applySky, assignLights, driftFireflies, driftFog, flicker, makeFireflies, makeFogBank, makeLightRig, placeRig, setFogStart, type Fireflies, type FogBank, type LightItem, type LightRig } from './atmosphere';
import { faceCamera, makeBillboard, setFacing, setFrame, type Billboard } from './billboard';
import { disposeTree } from './dispose';
import { makeFx3d, tickFx, type Fx3d } from './fx3d';
import {
  bossNodeWorld,
  cameraFor,
  easeOutBack,
  followAim,
  overviewAim,
  riseDelay,
  RISE_CONTENT_AT,
  RISE_MS,
  slabHeight,
  tileWorld,
  type Aim,
  type CameraPose,
  type SpriteRole,
  type Vec3,
} from './math';
import type { MotionFlags } from './motion-flags';
import { FRAME_BUDGET, type Quality } from './quality';
import { cachedTexture, glowTexture, spriteTexture, textTexture, type CanvasSource } from './textures';

/** Canvas sources for the scene builders; Node tests pass `{ width, height }` stubs. */
export type WorldDeps = {
  /** The outlined sprite canvas for a sprite key (`hero:{cls}:{race}:{frame}`, `mon:{name}`, `chest`, `coffin`, `bones`). */
  spriteCanvas(key: string): CanvasSource;
  /** A pixel-font text canvas (white text on transparent) for ground labels and key letters. */
  textCanvas(text: string): CanvasSource;
};

/** What `syncMap` reads of the route view. */
export type MapSyncView = Pick<RouteView, 'targets' | 'fogFrom' | 'shards' | 'bound' | 'banished' | 'bestDay'>;

/** Lit slab colours and emissive strengths by level 0–4 (sample). */
export const SLAB_COLORS = ['#1d1a2a', '#1e3a2c', '#226337', '#2c8f45', '#3fd35f'] as const;
const SLAB_EMISSIVE = [0, 0, 0, 0.12, 0.35] as const;
/** Fog columns keep 45% of the lit colour and no emissive glow (requirement 21.4). */
export const FOG_TINT = 0.45;
const SLAB_W = 0.9;
const ALTAR = { w: 1.6, h: 0.9 } as const;
const HOP_MS = 140;
const HOP_H = 0.35;
const SQUASH_MS = 80;
const CAMERA_MS = 400;
const OVERVIEW_MS = 600;
const FOG_EDGE_MS = 400;
const HIGHLIGHT = '#d9c6ff';
const VISITED = '#ffb13c';
const MOTES = 8;

type ContentKind = 'coffin' | 'monster' | 'chest' | 'wisp';

/** A tile's visible contents, created the first time its tile is seen and kept for the scene. */
export type Content = {
  idx: number;
  kind: ContentKind;
  /** The billboard (coffin, monster, chest; bones once a fight is won), or null for a wisp glow. */
  bb: Billboard | null;
  glow: Sprite | null;
  /** Slab-top anchor y at full height; the rise scales it. */
  top: number;
  resolved: boolean;
  /** In a column the hero has left without visiting it: unreachable, so its contents are hidden. */
  behind?: boolean;
};

export type Highlight = {
  root: Group;
  frame: Mesh<RingGeometry, MeshBasicMaterial>;
  chevron: Mesh<BufferGeometry, MeshBasicMaterial>;
  label: Sprite;
  to: Pos | null;
  hover: boolean;
};

type Hop = { from: Vector3; to: Vector3; start: number; active: boolean; landAt: number };
type Tween = { from: Vector3; to: Vector3; start: number; dur: number };

export type MapScene = {
  scene: Scene;
  camera: PerspectiveCamera;
  map: GameMap;
  /** One instanced mesh per day level 0–4 (index = level). */
  slabs: InstancedMesh<BoxGeometry, MeshStandardMaterial>[];
  /** Per level: instance id → tile index. */
  byInstance: number[][];
  /** Per tile index: its level and instance id. */
  slotOf: { level: number; id: number }[];
  /** Last `seen` written to the instance colours, per tile index. */
  seen: boolean[];
  graves: InstancedMesh<BufferGeometry, MeshStandardMaterial> | null;
  /** Per tile index: its gravestone instance id, or −1. */
  graveOf: number[];
  labels: Mesh<PlaneGeometry, MeshBasicMaterial>[];
  altar: Group;
  altarBox: Mesh<BoxGeometry, MeshStandardMaterial>;
  phantom: Billboard;
  pips: Mesh<SphereGeometry, MeshStandardMaterial>[];
  ring: Mesh<TorusGeometry, MeshStandardMaterial>;
  bestFlame: Sprite;
  /** Per tile index. */
  contents: (Content | undefined)[];
  visited: Mesh<RingGeometry, MeshBasicMaterial>[];
  highlights: Highlight[];
  keyTex: Record<string, Texture>;
  hero: Billboard;
  heroKeys: Record<HeroFrame, string>;
  heroWho: string;
  aura: Points<BufferGeometry, PointsMaterial>;
  auraGlow: Sprite;
  auraTier: number;
  billboards: Billboard[];
  rig: LightRig;
  fireflies: Fireflies;
  fog: FogBank;
  fogTween: { from: number; to: number; start: number };
  deps: WorldDeps;
  aspect: number;
  rise: { start: number; end: number } | null;
  hop: Hop;
  cam: Tween;
  aim: Aim;
  heroPos: Pos;
  picks: Object3D[];
  raycaster: Raycaster;
  ndc: Vector2;
  frameOpts: FrameOpts;
  /** False until the first `syncMap`, which cuts the camera and the fog edge instead of easing them. */
  synced: boolean;
  /** Map effects (requirement 13.5): the particle, ring, and slash pool, and the shake applied last frame. */
  fx: Fx3d;
  shakeApplied: Vector3;
};

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3();
const _white = new Color(1, 1, 1);
const _grey = new Color(FOG_TINT, FOG_TINT, FOG_TINT);
const _hl = new Color(HIGHLIGHT);
const _hw = new Color('#ffffff');

/** Registers (once) and returns the sprite texture key. */
function useSprite(deps: WorldDeps, key: string): string {
  if (!cachedTexture(key)) spriteTexture(key, deps.spriteCanvas(key));
  return key;
}

function billboardFor(ms: Pick<MapScene, 'deps' | 'billboards'>, key: string, role: SpriteRole): Billboard {
  const b = makeBillboard(useSprite(ms.deps, key), role);
  ms.billboards.push(b);
  return b;
}

/** Slab material: lit level colour, roughness 0.9, flat shading; the emissive fades out on fog-tinted instances. */
function slabMaterial(level: number): MeshStandardMaterial {
  const c = SLAB_COLORS[level] ?? SLAB_COLORS[0];
  const e = SLAB_EMISSIVE[level] ?? 0;
  const mat = new MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, emissive: e > 0 ? c : '#000000', emissiveIntensity: e });
  if (e > 0)
    mat.onBeforeCompile = (sh) => {
      // Instance colour is a brightness factor: 1 when seen, FOG_TINT in a fog column (no glow there).
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= clamp((vColor.r - ${FOG_TINT.toFixed(2)}) / ${(1 - FOG_TINT).toFixed(2)}, 0.0, 1.0);\n#endif`,
      );
    };
  return mat;
}

/** The sample tombstone (slab, half-cylinder top, dark cross) merged into one geometry with vertex colours. */
export function graveGeometry(): BufferGeometry {
  const paint = (g: BufferGeometry, hex: string) => {
    const c = new Color(hex);
    const n = g.getAttribute('position').count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(a, 3));
    return g;
  };
  const slab = new BoxGeometry(0.34, 0.42, 0.1).translate(0, 0.21, 0);
  const top = new CylinderGeometry(0.17, 0.17, 0.1, 10, 1, false, 0, Math.PI);
  top.rotateZ(Math.PI / 2);
  top.rotateX(Math.PI / 2);
  top.translate(0, 0.42, 0);
  const cross = new BoxGeometry(0.04, 0.16, 0.02).translate(0, 0.3, 0.06);
  const merged = mergeGeometries([paint(slab, '#5a5670'), paint(top, '#5a5670'), paint(cross, '#2a2838')]);
  for (const g of [slab, top, cross]) g.dispose();
  if (!merged) throw new Error('gravestone geometry merge failed');
  return merged;
}

/** A square frame of half side `half` and line width `w`, lying flat. */
function squareFrame(half: number, w: number): RingGeometry {
  const g = new RingGeometry((half - w) * Math.SQRT2, half * Math.SQRT2, 4, 1, Math.PI / 4);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A flat chevron pointing along +x, centred on the origin. */
function chevronGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  // Two triangles forming a ">" shape, 0.22 long and 0.26 wide, in the xz plane.
  const v = [0.11, 0, 0, -0.11, 0, -0.13, -0.03, 0, 0, 0.11, 0, 0, -0.03, 0, 0, -0.11, 0, 0.13];
  g.setAttribute('position', new Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** A pixel-font plane lying flat on the ground, `h` world units tall. */
function groundLabel(text: string, deps: WorldDeps, h: number): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const tex = textTexture(text, deps.textCanvas);
  const img = tex.image as { width: number; height: number };
  const w = (h * img.width) / Math.max(1, img.height);
  const g = new PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2);
  const m = new Mesh(g, new MeshBasicMaterial({ map: tex, color: '#8b98ab', transparent: true, opacity: 0.7, depthWrite: false }));
  m.userData['w'] = w;
  return m;
}

/** Month labels: column 0 and every column whose first day is a new month's day 1–7 (requirement 4.2). */
function monthLabels(map: GameMap): { col: number; text: string }[] {
  const out: { col: number; text: string }[] = [];
  let last = -1;
  for (let c = 0; c < map.cols; c++) {
    const t = map.tiles.find((x) => x.col === c);
    if (!t) continue;
    const d = parseDate(t.day.date);
    const m = d.getUTCMonth();
    if ((m !== last && d.getUTCDate() <= 7) || c === 0) {
      out.push({ col: c, text: MONTHS[m] ?? '' });
      last = m;
    }
  }
  return out;
}

function heroKeysFor(cls: ClassId, race: RaceId): Record<HeroFrame, string> {
  const o = {} as Record<HeroFrame, string>;
  for (const f of HERO_FRAMES) o[f] = `hero:${cls}:${race}:${f}`;
  return o;
}

/** Builds the map scene for `map` (requirements 19.1–19.2, 21, 23.3–23.4). The hero is placed by `syncMap`. */
export function buildMapScene(map: GameMap, deps: WorldDeps, quality: Quality, aspect = 16 / 9): MapScene {
  const scene = new Scene();
  applySky(scene, 'map');
  const ground = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: '#120e1c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Slabs: one instanced mesh per level over a shared unit-height box whose bottom is at y = 0.
  const box = new BoxGeometry(SLAB_W, 1, SLAB_W).translate(0, 0.5, 0);
  const byInstance: number[][] = [[], [], [], [], []];
  const slotOf: { level: number; id: number }[] = [];
  for (const t of map.tiles) {
    const lv = t.day.level;
    slotOf[t.idx] = { level: lv, id: byInstance[lv]!.length };
    byInstance[lv]!.push(t.idx);
  }
  const slabs = byInstance.map((list, lv) => {
    const mesh = new InstancedMesh(box, slabMaterial(lv), list.length);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData['level'] = lv;
    list.forEach((idx, id) => {
      const t = map.tiles[idx]!;
      const [x, z] = tileWorld(t.col, t.row);
      mesh.setMatrixAt(id, _m.makeScale(1, slabHeight(lv), 1).setPosition(x, 0, z));
      mesh.setColorAt(id, t.seen || t.kind === 'start' ? _white : _grey);
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  });

  // Gravestones on `deco` fog tiles: one instanced mesh, each hidden (scale 0) until its tile is seen.
  const graveOf: number[] = map.tiles.map(() => -1);
  const decos = map.tiles.filter((t) => t.kind === 'fog' && t.deco);
  let graves: MapScene['graves'] = null;
  if (decos.length) {
    graves = new InstancedMesh(graveGeometry(), new MeshStandardMaterial({ roughness: 0.95, flatShading: true, vertexColors: true }), decos.length);
    graves.castShadow = graves.receiveShadow = true;
    decos.forEach((t, id) => {
      graveOf[t.idx] = id;
      graves!.setMatrixAt(id, _m.makeScale(0, 0, 0));
    });
    scene.add(graves);
  }

  // Ground labels: weekdays left of column 0, months beyond row 0 (requirement 19.2).
  const labels: Mesh<PlaneGeometry, MeshBasicMaterial>[] = [];
  for (const [row, text] of [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']] as const) {
    const l = groundLabel(text, deps, 0.28);
    l.position.set(-0.6 - (l.userData['w'] as number) / 2, 0.01, row);
    labels.push(l);
  }
  for (const { col, text } of monthLabels(map)) {
    const l = groundLabel(text, deps, 0.28);
    l.position.set(col - 0.45 + (l.userData['w'] as number) / 2, 0.01, -0.85);
    labels.push(l);
  }
  scene.add(...labels);

  const billboards: Billboard[] = [];
  const holder = { deps, billboards };

  // The boss node: altar, rim, Phantom, shard pips, bound ring (requirement 23.3).
  const [bx, bz] = bossNodeWorld(map);
  const altar = new Group();
  altar.position.set(bx, 0, bz);
  const altarBox = new Mesh(new BoxGeometry(ALTAR.w, ALTAR.h, ALTAR.w).translate(0, ALTAR.h / 2, 0), new MeshStandardMaterial({ color: '#2a2640', roughness: 0.95, flatShading: true }));
  altarBox.castShadow = altarBox.receiveShadow = true;
  const rim = new Mesh(new BoxGeometry(ALTAR.w + 0.04, 0.05, ALTAR.w + 0.04), new MeshStandardMaterial({ color: '#7b4bc9', emissive: '#7b4bc9', emissiveIntensity: 0.6 }));
  rim.position.y = ALTAR.h - 0.04;
  const pips: MapScene['pips'] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
    const p = new Mesh(new SphereGeometry(0.08, 10, 8), new MeshStandardMaterial({ color: '#3a3550', emissive: '#ffd257', emissiveIntensity: 0 }));
    p.position.set(Math.cos(a) * 0.95, ALTAR.h + 1.0, Math.sin(a) * 0.95);
    pips.push(p);
  }
  const ring = new Mesh(new TorusGeometry(1.0, 0.03, 6, 48), new MeshStandardMaterial({ color: '#ffd257', emissive: '#ffd257', emissiveIntensity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = ALTAR.h + 0.05;
  ring.visible = false;
  const phantom = billboardFor(holder, 'mon:phantom', 'boss');
  setFacing(phantom, -1);
  phantom.root.position.set(bx, ALTAR.h + 0.12, bz);
  altar.add(altarBox, rim, ring, ...pips);
  scene.add(altar, phantom.root);

  const bestFlame = new Sprite(new SpriteMaterial({ map: glowTexture('#b48cff'), transparent: true, depthWrite: false, blending: AdditiveBlending }));
  bestFlame.scale.set(0.4, 0.4, 1);
  bestFlame.visible = false;
  scene.add(bestFlame);

  // Visited frames: one per column at most, plus the start.
  const visitedMat = new MeshBasicMaterial({ color: VISITED, transparent: true, opacity: 0.6, depthWrite: false, side: DoubleSide });
  const visitedGeo = squareFrame(0.41, 0.025);
  const visited = Array.from({ length: map.cols + 1 }, () => {
    const m = new Mesh(visitedGeo, visitedMat);
    m.visible = false;
    scene.add(m);
    return m;
  });

  // Highlights: up to three legal targets (requirement 23.1).
  const keyTex: Record<string, Texture> = {};
  for (const k of ['W', 'D', 'S', '→', 'Boss']) keyTex[k] = textTexture(k, deps.textCanvas);
  const frameGeo = squareFrame(0.43, 0.05);
  const chevGeo = chevronGeometry();
  const highlights: Highlight[] = Array.from({ length: 3 }, () => {
    const root = new Group();
    const frame = new Mesh(frameGeo, new MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, depthWrite: false, side: DoubleSide }));
    const chevron = new Mesh(chevGeo, new MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, depthWrite: false, side: DoubleSide }));
    const label = new Sprite(new SpriteMaterial({ map: keyTex['W'] ?? null, color: HIGHLIGHT, transparent: true, depthWrite: false }));
    root.add(frame, chevron, label);
    root.visible = false;
    scene.add(root);
    return { root, frame, chevron, label, to: null, hover: false };
  });

  // The hero and its aura (requirement 19.5).
  const heroKeys = heroKeysFor('wanderer', 'human');
  for (const f of HERO_FRAMES) useSprite(deps, heroKeys[f]);
  const hero = billboardFor(holder, heroKeys.idle, 'hero');
  hero.root.visible = false;
  const auraGeo = new BufferGeometry();
  auraGeo.setAttribute('position', new BufferAttribute(new Float32Array(MOTES * 3), 3));
  auraGeo.setDrawRange(0, 0);
  const aura = new Points(auraGeo, new PointsMaterial({ color: '#d2b4ff', size: 0.06, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending }));
  const auraGlow = new Sprite(new SpriteMaterial({ map: glowTexture('#b48cff'), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
  auraGlow.visible = false;
  scene.add(hero.root, aura, auraGlow);

  const rig = makeLightRig(scene, quality);
  const fireflies = makeFireflies(60, map.cols + 2, 0.5, quality, map.seed);
  fireflies.points.position.set((map.cols - 1) / 2, 0, (map.rows - 1) / 2);
  const fog = makeFogBank(map);
  scene.add(fireflies.points, fog.root);

  const camera = new PerspectiveCamera(40, aspect, 0.1, 200);
  const ms: MapScene = {
    scene,
    camera,
    map,
    slabs,
    byInstance,
    slotOf,
    seen: map.tiles.map((t) => t.seen || t.kind === 'start'),
    graves,
    graveOf,
    labels,
    altar,
    altarBox,
    phantom,
    pips,
    ring,
    bestFlame,
    contents: [],
    visited,
    highlights,
    keyTex,
    hero,
    heroKeys,
    heroWho: '',
    aura,
    auraGlow,
    auraTier: 0,
    billboards,
    rig,
    fireflies,
    fog,
    fogTween: { from: map.cols, to: map.cols, start: -Infinity },
    deps,
    aspect,
    rise: null,
    hop: { from: new Vector3(), to: new Vector3(), start: -Infinity, active: false, landAt: -Infinity },
    cam: { from: new Vector3(), to: new Vector3(), start: -Infinity, dur: 0 },
    aim: { x: 0, y: 0, z: 0 },
    heroPos: { col: -1, row: -1 },
    picks: [...slabs, altarBox],
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    frameOpts: { moving: false, seed: 0, reduced: false },
    synced: false,
    fx: makeFx3d(FRAME_BUDGET.poolMap, quality),
    shakeApplied: new Vector3(),
  };
  scene.add(ms.fx.root);
  for (const t of map.tiles) if (ms.seen[t.idx]) showTile(ms, t);
  setAspect(ms, aspect);
  return ms;
}

/** Anchor (slab top + 0.01) of a tile or the boss node at full height. */
export function anchorOf(ms: MapScene, p: Pos, out: Vector3): Vector3 {
  if (p.col >= ms.map.cols) {
    const [x, z] = bossNodeWorld(ms.map);
    return out.set(x, ALTAR.h + 0.01, z);
  }
  const t = ms.map.tiles.find((x) => x.col === p.col && x.row === p.row);
  const [x, z] = tileWorld(p.col, p.row);
  return out.set(x, slabHeight(t?.day.level ?? 0) + 0.01, z);
}

/** Creates the tile's contents and gravestone the first time it is seen. Fogged contents are never drawn. */
function showTile(ms: MapScene, t: DayTile): void {
  const gi = ms.graveOf[t.idx] ?? -1;
  if (ms.graves && gi >= 0) {
    const [x, z] = tileWorld(t.col, t.row);
    const tilt = ((fnv1a(t.day.date) % 1000) / 1000 - 0.5) * 0.15;
    _q.setFromEuler(_e.set(0, -0.35, tilt));
    ms.graves.setMatrixAt(gi, _m.compose(_v.set(x + 0.12, slabHeight(t.day.level), z - 0.05), _q, _s.set(1, 1, 1)));
    ms.graves.instanceMatrix.needsUpdate = true;
    ms.graves.computeBoundingSphere();
  }
  if (ms.contents[t.idx]) return;
  const kind: ContentKind | null = t.kind === 'start' ? 'coffin' : t.kind === 'monster' ? 'monster' : t.kind === 'chest' ? 'chest' : t.kind === 'wisp' ? 'wisp' : null;
  if (!kind) return;
  const top = slabHeight(t.day.level) + 0.01;
  const [x, z] = tileWorld(t.col, t.row);
  const c: Content = { idx: t.idx, kind, bb: null, glow: null, top, resolved: false };
  if (kind === 'wisp') {
    c.glow = new Sprite(new SpriteMaterial({ map: glowTexture('#8cffc8'), transparent: true, depthWrite: false, blending: AdditiveBlending }));
    c.glow.scale.set(0.5, 0.5, 1);
    c.glow.position.set(x, top + 0.35, z);
    ms.scene.add(c.glow);
  } else {
    const key = kind === 'monster' ? `mon:${['ghost', 'imp', 'ghoul', 'lich'][t.tier - 1] ?? 'ghost'}` : kind;
    const role: SpriteRole = kind === 'monster' ? (`mon${Math.min(4, Math.max(1, t.tier))}` as SpriteRole) : 'item';
    c.bb = billboardFor(ms, key, role);
    if (kind === 'monster') setFacing(c.bb, -1);
    c.bb.root.position.set(x, top, z);
    ms.scene.add(c.bb.root);
  }
  ms.contents[t.idx] = c;
}

/** Applies a tile's resolved state: bones for a won fight, a faded chest, no wisp (requirement 19.6). */
function resolveContent(ms: MapScene, c: Content): void {
  c.resolved = true;
  if (c.kind === 'monster' && c.bb) setFrame(c.bb, useSprite(ms.deps, 'bones'));
  else if (c.kind === 'chest' && c.bb) {
    const m = c.bb.mesh.material;
    m.transparent = true;
    m.opacity = 0.4;
    m.alphaTest = 0.1;
    m.needsUpdate = true;
  } else if (c.kind === 'wisp' && c.glow) c.glow.visible = false;
}

/** Sets the viewport aspect: the portrait FOV and the camera's fixed orientation (translation only in play). */
export function setAspect(ms: MapScene, aspect: number): void {
  ms.aspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9;
  const pose = ms.rise ? cameraFor('overview', overviewAim(ms.map), ms.aspect) : cameraFor('follow', ms.aim, ms.aspect);
  ms.camera.aspect = ms.aspect;
  ms.camera.fov = pose.fov;
  ms.camera.updateProjectionMatrix();
  ms.camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  ms.camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
  ms.cam.to.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  ms.cam.start = -Infinity;
  ms.camera.updateMatrixWorld();
}

function cameraTo(ms: MapScene, pose: CameraPose, now: number, dur: number): void {
  ms.cam.from.copy(ms.camera.position);
  ms.cam.to.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  ms.cam.start = now;
  ms.cam.dur = dur;
  if (dur <= 0) ms.camera.position.copy(ms.cam.to);
}

function setAim(ms: MapScene, aim: Aim): void {
  ms.aim.x = aim.x;
  ms.aim.y = aim.y;
  ms.aim.z = aim.z;
}

/**
 * Starts the rise (requirement 19.4): slabs grow from 0 with `easeOutBack`, the overview camera frames the whole
 * map, then eases to the follow camera over 600 ms. Skipped with reduced motion.
 */
export function startRise(ms: MapScene, now: number, flags: Readonly<MotionFlags>): void {
  if (!flags.rise) return;
  const last = riseDelay(ms.map.cols - 1, ms.map.rows - 1) + RISE_MS;
  ms.rise = { start: now, end: now + last };
  cameraTo(ms, cameraFor('overview', overviewAim(ms.map), ms.aspect), now, 0);
}

/** Starts the hero's hop between two positions (requirement 19.5); instant with reduced motion. */
export function heroHop(ms: MapScene, from: Pos, to: Pos, now: number, flags: Readonly<MotionFlags>): void {
  anchorOf(ms, to, ms.hop.to);
  if (!flags.hop) {
    ms.hop.active = false;
    ms.hero.root.position.copy(ms.hop.to);
    return;
  }
  anchorOf(ms, from, ms.hop.from);
  ms.hop.start = now;
  ms.hop.active = true;
  ms.hop.landAt = now + HOP_MS;
}

function placeHighlight(ms: MapScene, h: Highlight, tg: RouteTarget, hero: Pos, single: boolean): void {
  const at = anchorOf(ms, tg.to, _v);
  const from = anchorOf(ms, hero, _s);
  h.to = { col: tg.to.col, row: tg.to.row };
  h.root.visible = true;
  h.frame.position.set(at.x, at.y + 0.005, at.z);
  h.frame.scale.setScalar(tg.boss ? ALTAR.w / SLAB_W : 1);
  const dx = at.x - from.x;
  const dz = at.z - from.z;
  h.chevron.position.set(from.x + dx * 0.55, Math.max(at.y, from.y) + 0.02, from.z + dz * 0.55);
  h.chevron.rotation.set(0, Math.atan2(-dz, dx), 0);
  const key = tg.boss ? 'Boss' : single ? '→' : tg.key;
  const tex = ms.keyTex[key] ?? null;
  h.label.material.map = tex;
  const img = tex?.image as { width: number; height: number } | undefined;
  const lh = 0.24;
  h.label.scale.set(img ? (lh * img.width) / Math.max(1, img.height) : lh, lh, 1);
  h.label.position.set(at.x - 0.3, at.y + 0.2, at.z + 0.3);
}

/**
 * Brings the scene up to date after a step: seen tints, contents, gravestones, visited frames, highlights,
 * the boss node, the best-day flame, the fog bank, the light pool, the camera aim, and the hero.
 */
export function syncMap(ms: MapScene, state: RunState, view: MapSyncView, now: number, flags: Readonly<MotionFlags>): void {
  const map = state.map;
  ms.map = map;
  const tinted = new Set<number>();
  for (const t of map.tiles) {
    const seen = t.seen || t.kind === 'start';
    if (seen !== ms.seen[t.idx]) {
      const slot = ms.slotOf[t.idx]!;
      ms.slabs[slot.level]!.setColorAt(slot.id, seen ? _white : _grey);
      tinted.add(slot.level);
      ms.seen[t.idx] = seen;
    }
    if (seen) showTile(ms, t);
    const c = ms.contents[t.idx];
    if (c && t.resolved && !c.resolved && c.kind !== 'coffin') resolveContent(ms, c);
    if (c && c.kind !== 'coffin') {
      const behind = t.col < state.pos.col && !t.visited;
      c.behind = behind;
      if (c.bb) c.bb.root.visible = !behind;
      if (c.glow) c.glow.visible = !behind && !c.resolved;
    }
  }
  for (const lv of tinted) {
    const ic = ms.slabs[lv]!.instanceColor;
    if (ic) ic.needsUpdate = true;
  }

  // Visited frames.
  let v = 0;
  for (const t of map.tiles) {
    if (!t.visited || v >= ms.visited.length) continue;
    const f = ms.visited[v++]!;
    const [x, z] = tileWorld(t.col, t.row);
    f.position.set(x, slabHeight(t.day.level) + 0.004, z);
    f.visible = true;
  }
  while (v < ms.visited.length) ms.visited[v++]!.visible = false;

  // Highlights: exactly the route targets.
  const single = view.targets.length === 1;
  ms.highlights.forEach((h, i) => {
    const tg = view.targets[i];
    if (tg) placeHighlight(ms, h, tg, state.pos, single);
    else {
      h.root.visible = false;
      h.to = null;
    }
  });

  // Boss node.
  ms.pips.forEach((p, i) => {
    const lit = i < view.shards;
    p.material.color.set(lit ? '#ffd257' : '#3a3550');
    p.material.emissiveIntensity = lit ? 0.8 : 0;
  });
  ms.ring.visible = view.bound && !view.banished;
  if (view.banished && ms.phantom.key !== 'bones') {
    setFrame(ms.phantom, useSprite(ms.deps, 'bones'));
    ms.phantom.mesh.scale.set(1, 1, 1);
  }

  // Best-day flame, shown even in fog.
  if (view.bestDay) {
    const at = anchorOf(ms, view.bestDay, _v);
    ms.bestFlame.position.set(at.x, at.y + 0.5, at.z);
    ms.bestFlame.visible = true;
  } else ms.bestFlame.visible = false;

  // Fog bank edge follows the window over 400 ms (cut on the first sync and with reduced motion).
  if (view.fogFrom !== ms.fogTween.to) {
    ms.fogTween.from = ms.fog.edge + 0.5;
    ms.fogTween.to = view.fogFrom;
    ms.fogTween.start = now;
    if (!ms.synced || !flags.cameraEase) {
      setFogStart(ms.fog, view.fogFrom);
      ms.fogTween.start = -Infinity;
    }
  }

  // Hero sprite set, aura tier.
  const who = `${state.hero.cls}:${state.hero.race}`;
  if (who !== ms.heroWho) {
    ms.heroWho = who;
    ms.heroKeys = heroKeysFor(state.hero.cls, state.hero.race);
    for (const f of HERO_FRAMES) useSprite(ms.deps, ms.heroKeys[f]);
    setFrame(ms.hero, ms.heroKeys.idle);
  }
  ms.auraTier = Math.max(0, Math.min(4, state.hero.aura));
  ms.aura.geometry.setDrawRange(0, ms.auraTier * 2);
  ms.auraGlow.visible = ms.auraTier > 0;
  ms.auraGlow.scale.setScalar(1.1 + 0.16 * ms.auraTier);
  ms.hero.root.visible = true;
  if (!ms.hop.active) anchorOf(ms, state.pos, ms.hero.root.position);

  // Lights: the lantern, the boss node, and the two nearest seen, unresolved chests or wisps.
  const items: LightItem[] = [];
  for (const t of map.tiles)
    if ((t.kind === 'chest' || t.kind === 'wisp') && !(t.col < state.pos.col && !t.visited)) {
      const [x, z] = tileWorld(t.col, t.row);
      items.push({ kind: t.kind, top: [x, slabHeight(t.day.level), z], seen: t.seen, resolved: t.resolved });
    }
  const hp = anchorOf(ms, state.pos, _v);
  const [bx, bz] = bossNodeWorld(map);
  assignLights(ms.rig, { hero: [hp.x, hp.y, hp.z] as Vec3, boss: view.banished ? null : ([bx, ALTAR.h, bz] as Vec3), items });

  // Camera: follow aim, eased 400 ms after a move (cut with reduced motion); the rise keeps the overview.
  const moved = state.pos.col !== ms.heroPos.col || state.pos.row !== ms.heroPos.row;
  ms.heroPos = { col: state.pos.col, row: state.pos.row };
  setAim(ms, followAim(state.pos));
  if (!ms.rise && moved) cameraTo(ms, cameraFor('follow', ms.aim, ms.aspect), now, flags.cameraEase && ms.synced ? CAMERA_MS : 0);
  ms.synced = true;
}

/** Brightens the highlight on `pos` (pointer hover or pad focus) and dims the others; null clears. */
export function setHover(ms: MapScene, pos: Pos | null): void {
  for (const h of ms.highlights) h.hover = !!pos && !!h.to && h.to.col === pos.col && h.to.row === pos.row;
}

/** Ease-out cubic. */
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const clamp01 = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k);

/** Advances every map animation to `now` (ms); `dt` in seconds. Allocates nothing. */
export function tickMap(ms: MapScene, now: number, dt: number, flags: Readonly<MotionFlags>): void {
  const t = now / 1000;
  const map = ms.map;

  // Rise.
  if (ms.rise) {
    const r = ms.rise;
    for (let lv = 0; lv < 5; lv++) {
      const mesh = ms.slabs[lv]!;
      const list = ms.byInstance[lv]!;
      for (let id = 0; id < list.length; id++) {
        const tile = map.tiles[list[id]!]!;
        const p = clamp01((now - r.start - riseDelay(tile.col, tile.row)) / RISE_MS);
        const e = Math.max(1e-3, easeOutBack(p));
        mesh.setMatrixAt(id, _m.makeScale(1, slabHeight(lv) * e, 1).setPosition(tile.col, 0, tile.row));
        const c = ms.contents[tile.idx];
        const show = p >= RISE_CONTENT_AT;
        if (c?.bb) c.bb.root.visible = show && !c.behind;
        if (c?.glow) c.glow.visible = show && !c.resolved && !c.behind;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (ms.graves) ms.graves.visible = now >= r.end - RISE_MS;
    if (now >= r.end) {
      ms.rise = null;
      if (ms.graves) ms.graves.visible = true;
      for (let lv = 0; lv < 5; lv++) ms.slabs[lv]!.computeBoundingSphere();
      const pose = cameraFor('follow', ms.aim, ms.aspect);
      ms.cam.from.copy(ms.camera.position);
      ms.cam.to.set(pose.pos[0], pose.pos[1], pose.pos[2]);
      ms.cam.start = now;
      ms.cam.dur = flags.cameraEase ? OVERVIEW_MS : 0;
    }
  }

  // Hero hop and landing squash.
  const hero = ms.hero;
  let moving = false;
  if (ms.hop.active) {
    const k = clamp01((now - ms.hop.start) / HOP_MS);
    hero.root.position.lerpVectors(ms.hop.from, ms.hop.to, k);
    hero.root.position.y += Math.sin(Math.PI * k) * HOP_H;
    moving = k < 1;
    if (k >= 1) ms.hop.active = false;
  }
  const squash = flags.hop && now >= ms.hop.landAt && now < ms.hop.landAt + SQUASH_MS;
  const dir = hero.mesh.scale.x < 0 ? -1 : 1;
  hero.mesh.scale.set((squash ? 1.08 : 1) * dir, squash ? 0.85 : 1, 1);
  ms.frameOpts.moving = moving;
  ms.frameOpts.reduced = !flags.frames;
  setFrame(hero, useSprite(ms.deps, ms.heroKeys[heroFrame(now, ms.frameOpts)]));

  // Aura glow and motes around the hero.
  const hp = hero.root.position;
  if (ms.auraTier > 0) {
    ms.auraGlow.position.set(hp.x, hp.y + 0.55, hp.z);
    ms.auraGlow.material.opacity = 0.25 + 0.12 * ms.auraTier + (flags.bob ? 0.08 * Math.sin(now / 250) : 0);
    const attr = ms.aura.geometry.getAttribute('position') as BufferAttribute;
    const a = attr.array as Float32Array;
    const n = ms.auraTier * 2;
    const spin = flags.bob ? now / 600 : 0;
    for (let i = 0; i < n; i++) {
      const an = spin + (i * Math.PI * 2) / n;
      a[i * 3] = hp.x + Math.cos(an) * 0.48;
      a[i * 3 + 1] = hp.y + 0.55 + Math.sin(an) * 0.12;
      a[i * 3 + 2] = hp.z + Math.sin(an) * 0.48;
    }
    attr.needsUpdate = true;
  }

  // Monster bob, Phantom hover, wisp bob.
  for (let i = 0; i < ms.contents.length; i++) {
    const c = ms.contents[i];
    if (!c) continue;
    if (c.kind === 'monster' && c.bb && !c.resolved) c.bb.root.position.y = c.top + (flags.bob ? Math.abs(Math.sin(2 * t + i)) * 0.02 : 0);
    else if (c.kind === 'wisp' && c.glow) c.glow.position.y = c.top + 0.35 + (flags.bob ? Math.sin(now / 380 + i) * 0.05 : 0);
  }
  if (ms.phantom.key !== 'bones') ms.phantom.root.position.y = ALTAR.h + 0.12 + (flags.bob ? Math.sin(t * 1.4) * 0.08 : 0);

  // Highlight pulse 0.55–1.0 at 1.2 Hz (static with reduced motion); hover brightens.
  const pulse = flags.pulse ? 0.775 + 0.225 * Math.sin(t * Math.PI * 2 * 1.2) : 1;
  for (let i = 0; i < ms.highlights.length; i++) {
    const h = ms.highlights[i]!;
    if (!h.root.visible) continue;
    const o = h.hover ? 1 : pulse;
    h.frame.material.opacity = o;
    h.chevron.material.opacity = o;
    h.chevron.material.color.copy(h.hover ? _hw : _hl);
    h.label.material.opacity = o;
  }

  // Best-day flame flicker.
  if (ms.bestFlame.visible) ms.bestFlame.material.opacity = flags.flicker ? 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3) : 0.9;

  // Fog bank edge.
  const ft = ms.fogTween;
  if (ft.start > -Infinity && flags.cameraEase) {
    const k = easeOut(clamp01((now - ft.start) / FOG_EDGE_MS));
    setFogStart(ms.fog, ft.from + (ft.to - ft.from) * k);
  }
  driftFog(ms.fog, dt, flags.fogDrift);

  // Camera, then the effects and their shake on top (last frame's shake removed first).
  const cam = ms.cam;
  ms.camera.position.sub(ms.shakeApplied);
  if (cam.start > -Infinity) {
    const k = cam.dur > 0 ? easeOut(clamp01((now - cam.start) / cam.dur)) : 1;
    ms.camera.position.lerpVectors(cam.from, cam.to, k);
  }
  tickFx(ms.fx, dt, ms.camera);
  ms.camera.position.add(ms.fx.shakeOff);
  ms.shakeApplied.copy(ms.fx.shakeOff);
  placeRig(ms.rig, ms.aim);

  // Lantern follows the hero; flicker; fireflies.
  const lantern = ms.rig.slots[0];
  if (lantern && lantern.role === 'lantern') {
    lantern.light.position.set(hp.x + 0.35, hp.y + 0.55, hp.z + 0.1);
    ms.rig.lanternGlow.position.copy(lantern.light.position);
  }
  flicker(ms.rig, t, flags.flicker);
  driftFireflies(ms.fireflies, t, flags.fireflyDrift);

  faceCamera(ms.billboards, ms.camera);
}

/** The tile (or the boss node) under normalised device coordinates, by raycast against slabs and the altar. */
export function pickTile(ms: MapScene, ndcX: number, ndcY: number): Pos | null {
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;
  ms.ndc.set(ndcX, ndcY);
  ms.camera.updateMatrixWorld();
  ms.raycaster.setFromCamera(ms.ndc, ms.camera);
  const hit = ms.raycaster.intersectObjects(ms.picks, false)[0];
  if (!hit) return null;
  if (hit.object === ms.altarBox) return { col: ms.map.bossNode.col, row: ms.map.bossNode.row };
  const lv = hit.object.userData['level'] as number | undefined;
  if (lv === undefined || hit.instanceId === undefined) return null;
  const idx = ms.byInstance[lv]?.[hit.instanceId];
  const t = idx === undefined ? undefined : ms.map.tiles[idx];
  return t ? { col: t.col, row: t.row } : null;
}

/** Releases the scene's geometries, materials, and textures (sprite textures stay cached). */
export function disposeMapScene(ms: MapScene): void {
  disposeTree(ms.scene);
  for (const k of Object.keys(ms.keyTex)) ms.keyTex[k]?.dispose();
  for (const t of ms.fog.maps) t.dispose();
  ms.billboards.length = 0;
}
