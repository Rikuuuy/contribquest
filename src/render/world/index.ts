// The world renderer entry (v1.6, Three.js; design "World renderer"). Loaded only through a dynamic `import()`,
// so `three` lands in its own lazily loaded chunk and the start screen never waits for it. One `WebGLRenderer` and
// one canvas live for the page session; `mount` moves the canvas between hosts. The map scene stays built while a
// fight is shown; `showFight` builds the arena per fight and `onEvents` plays its effects on the arena, the fx pool,
// and the overlay canvas.
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import type { ClassId, RaceId } from '../../data/schema';
import type { GameEvent, RunState } from '../../engine';
import type { GameMap, Pos } from '../../mapgen';
import type { RouteView } from '../map/route-view';
import { clearOverlay, createOverlay, drawOverlay, floatText, sizeOverlay, type Projector } from '../overlay';
import { PACING } from '../pacing';
import type { Renderer } from '../renderer';
import { bonesKey, itemKey, monsterKey, spriteCache } from '../sprites/build';
import type { MonsterName, SpriteName } from '../sprites/grids';
import { heroKey, type HeroFrame } from '../sprites/hero';
import {
  arenaAnchor,
  arenaDeath,
  arenaHeroDown,
  arenaHit,
  arenaPhase2,
  arenaSpecFor,
  arenaStrike,
  buildArena,
  disposeArena,
  RIG_LEAN,
  setArenaAspect,
  tickArena,
  type ArenaScene,
  type RigPose,
} from './arena-scene';
import { setFireflyQuality, setRigQuality } from './atmosphere';
import { burst, clearFx, hitStop, ring, setFxQuality, shake, slash, slowMo, visualDt } from './fx3d';
import { buildMapScene, disposeMapScene, heroHop, pickTile, setAspect, setHover, startRise, syncMap, tickMap, type MapScene, type WorldDeps } from './map-scene';
import { motionFlags, type MotionFlags } from './motion-flags';
import { FrameStats, initialQuality, nextQuality, pixelRatio, QUALITY, WARMUP_FRAMES, type Quality } from './quality';

export type WorldRendererDeps = Partial<WorldDeps> & {
  /** Coarse pointer (phones): antialiasing off and quality `medium` (requirement 25.1). */
  coarse?: boolean;
  reduced?: boolean;
  /** Called once when the renderer cannot continue (context lost for 3 s, repeated frame errors). */
  onFail?: (reason: string) => void;
};

/** Visual numbers for the perf checks, written into the same object once per second. Never game state. */
export type CqStats = {
  medianMs: number;
  calls: number;
  triangles: number;
  pixelRatio: number;
  quality: Quality;
  geometries: number;
  textures: number;
  scene: 'none' | 'map' | 'teaser' | 'fight';
};

declare global {
  interface Window {
    __cqStats?: Readonly<CqStats>;
  }
}

const CONTEXT_GRACE_MS = 3000;
const TEASER_LOOP_MS = 5200;
const MAX_FRAME_FAILS = 3;

/** A copy of `src` with each row shifted by `lean × (H − 1 − r) / (H − 1)` px (feet planted), padded on both sides. */
function rigCanvas(src: HTMLCanvasElement, lean: number): HTMLCanvasElement {
  const pad = Math.ceil(Math.abs(lean));
  const c = document.createElement('canvas');
  c.width = src.width + pad * 2;
  c.height = src.height;
  const x = c.getContext('2d');
  if (!x) throw new Error('2D canvas context unavailable');
  const H = Math.max(2, src.height);
  for (let r = 0; r < src.height; r++) x.drawImage(src, 0, r, src.width, 1, pad + Math.round((lean * (H - 1 - r)) / (H - 1)), r, src.width, 1);
  return c;
}

/**
 * The outlined sprite canvas for a world sprite key, built through the shared sprite cache. Suffixes pick a
 * version: `:white`, `:red`, `:gold` (flash silhouettes) and `:rig:{pose}` (a rig pose, built once).
 */
export function spriteCanvasFor(key: string): HTMLCanvasElement {
  const rig = /^(.*):rig:(windup|lunge|hurt)$/.exec(key);
  if (rig) {
    const base = rig[1]!;
    const lean = RIG_LEAN[base.startsWith('hero:') ? 'hero' : 'mon'][rig[2] as RigPose];
    return rigCanvas(spriteCanvasFor(base), lean);
  }
  const flash = /^(.*):(white|red|gold)$/.exec(key);
  if (flash) {
    spriteCanvasFor(flash[1]!);
    const s = spriteCache.get(flash[1]!);
    if (!s) throw new Error(`unknown sprite key: ${key}`);
    return s[flash[2] as 'white' | 'red' | 'gold'];
  }
  if (key.startsWith('hero:')) {
    const [, cls, race, frame] = key.split(':');
    heroKey(cls as ClassId, race as RaceId, frame as HeroFrame);
  } else if (key.startsWith('mon:')) monsterKey(key.slice(4) as MonsterName);
  else if (key === 'bones') bonesKey();
  else itemKey(key as SpriteName);
  const s = spriteCache.get(key);
  if (!s) throw new Error(`unknown sprite key: ${key}`);
  return s.base;
}

/** White pixel-font text on a transparent canvas, for ground labels and key letters. */
export function textCanvasFor(text: string): HTMLCanvasElement {
  const px = 32;
  const font = `${px}px "Press Start 2P", monospace`;
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  if (!x) throw new Error('2D canvas context unavailable');
  x.font = font;
  c.width = Math.max(1, Math.ceil(x.measureText(text).width) + 4);
  c.height = px + 8;
  x.font = font;
  x.textBaseline = 'middle';
  x.fillStyle = '#ffffff';
  x.fillText(text, 2, c.height / 2);
  return c;
}

const mapKey = (m: GameMap) => `${m.seed}:${m.tiles[0]?.day.date ?? ''}:${m.cols}`;

/**
 * Creates the world renderer (requirements 19.7, 24.2, 25.1–25.6). Throws when the `WebGLRenderer` cannot be
 * created; the caller falls back to the flat renderer (task 13.1).
 */
export function createWorldRenderer(host: HTMLElement, deps: WorldRendererDeps = {}): Renderer {
  const coarse = deps.coarse ?? false;
  const world: WorldDeps = { spriteCanvas: deps.spriteCanvas ?? spriteCanvasFor, textCanvas: deps.textCanvas ?? textCanvasFor };
  const canvas = document.createElement('canvas');
  canvas.className = 'world';
  const gl = new WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.15;
  gl.shadowMap.type = PCFShadowMap;

  let quality: Quality = initialQuality(coarse);
  let flags: Readonly<MotionFlags> = motionFlags(deps.reduced ?? false);
  let ms: MapScene | null = null;
  let msKey = '';
  let arena: ArenaScene | null = null;
  let arenaKey = '';
  /** Fight generation: delayed effects from an earlier fight are dropped. */
  let gen = 0;
  const overlay = createOverlay();
  const _p = new Vector3();
  const _a = new Vector3();
  const project: Projector = (x, y, z, out) => {
    if (!arena) return false;
    _p.set(x, y, z).project(arena.camera);
    if (_p.z > 1) return false;
    out.x = ((_p.x + 1) / 2) * overlay.w;
    out.y = ((1 - _p.y) / 2) * overlay.h;
    return true;
  };
  let lastSteps = 0;
  let shown: CqStats['scene'] = 'none';
  let teaserAt = 0;
  let raf = 0;
  let running = false;
  let lost = false;
  let failed = false;
  let lostTimer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;
  let fails = 0;
  let warm = 0;
  let lastChange = -Infinity;
  let statsAt = 0;
  let current: HTMLElement = host;
  const frames = new FrameStats();
  const stats: CqStats = { medianMs: 0, calls: 0, triangles: 0, pixelRatio: 1, quality, geometries: 0, textures: 0, scene: 'none' };
  window.__cqStats = stats;

  const fail = (reason: string) => {
    if (failed) return;
    failed = true;
    stopLoop();
    // The 2D stage under the canvas shows again (requirement 24).
    canvas.remove();
    overlay.canvas.remove();
    console.warn(`3D view unavailable (${reason}), using the simple view.`);
    deps.onFail?.(reason);
  };

  function applyQuality(q: Quality): void {
    quality = q;
    const Q = QUALITY[q];
    gl.setPixelRatio(pixelRatio(globalThis.devicePixelRatio, q));
    gl.shadowMap.enabled = Q.shadows;
    if (ms) {
      const shadow = ms.rig.moon.shadow;
      shadow.map?.dispose();
      shadow.map = null;
      setRigQuality(ms.rig, q);
      setFireflyQuality(ms.fireflies, q);
    }
    if (arena) {
      const shadow = arena.rig.moon.shadow;
      shadow.map?.dispose();
      shadow.map = null;
      setRigQuality(arena.rig, q);
      setFireflyQuality(arena.fireflies, q);
      setFxQuality(arena.fx, q);
    }
    stats.quality = q;
    resize();
  }

  function resize(): void {
    const w = current.clientWidth;
    const h = current.clientHeight;
    if (w < 1 || h < 1) return;
    gl.setSize(w, h, false);
    sizeOverlay(overlay, w, h, gl.getPixelRatio());
    if (ms && shown !== 'fight') setAspect(ms, w / h);
    if (arena) setArenaAspect(arena, w / h);
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    try {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (shown === 'fight' && arena) {
        tickArena(arena, now, visualDt(arena.clock, now, dt), flags);
        gl.render(arena.scene, arena.camera);
        drawOverlay(overlay, now, project, flags.textRise);
      } else {
        if (!ms) return;
        drawOverlay(overlay, now, project, flags.textRise);
        renderMap(now, dt);
      }
      afterFrame(now, dt);
      fails = 0;
    } catch (e) {
      if (fails === 0) console.error(e);
      if (++fails >= MAX_FRAME_FAILS) fail('frame errors');
    }
  }

  function renderMap(now: number, dt: number): void {
    if (!ms) return;
    if (shown === 'teaser' && flags.rise && now - teaserAt > TEASER_LOOP_MS) {
      teaserAt = now;
      startRise(ms, now, flags);
    }
    tickMap(ms, now, dt, flags);
    gl.render(ms.scene, ms.camera);
  }

  /** Frame-time stats, the quality step-down, and the once-a-second `__cqStats` update. */
  function afterFrame(now: number, dt: number): void {
    if (++warm > WARMUP_FRAMES) frames.push(dt * 1000);
    const q = nextQuality(frames, quality, now, lastChange);
    if (q !== quality) {
      lastChange = now;
      frames.reset();
      warm = 0;
      applyQuality(q);
    }
    if (now - statsAt >= 1000) {
      statsAt = now;
      stats.medianMs = frames.median();
      stats.calls = gl.info.render.calls;
      stats.triangles = gl.info.render.triangles;
      stats.pixelRatio = gl.getPixelRatio();
      stats.geometries = gl.info.memory.geometries;
      stats.textures = gl.info.memory.textures;
      stats.scene = shown;
    }
  }

  function startLoop(): void {
    if (running || lost || failed || document.hidden || (!ms && !arena)) return;
    running = true;
    last = performance.now();
    warm = 0;
    raf = requestAnimationFrame(frame);
  }

  function stopLoop(): void {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  const onVisibility = () => (document.hidden ? stopLoop() : shown !== 'none' ? startLoop() : undefined);
  document.addEventListener('visibilitychange', onVisibility);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    stopLoop();
    console.warn('WebGL context lost.');
    lostTimer = setTimeout(() => fail('context lost'), CONTEXT_GRACE_MS);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (lostTimer !== null) clearTimeout(lostTimer);
    lostTimer = null;
    lost = false;
    // three re-uploads geometries, textures, and programs on the next render after a restore.
    if (shown !== 'none') startLoop();
  });

  /** The map scene for `map`, rebuilt for a new map or a new run on the same map. */
  function sceneFor(map: GameMap, steps: number): MapScene {
    const key = mapKey(map);
    if (!ms || key !== msKey || steps < lastSteps) {
      if (ms) disposeMapScene(ms);
      ms = buildMapScene(map, world, quality, current.clientWidth / Math.max(1, current.clientHeight));
      msKey = key;
    }
    lastSteps = steps;
    return ms;
  }

  /** Disposes the arena after a fight; delayed effects of that fight are dropped. */
  function dropArena(): void {
    if (!arena) return;
    disposeArena(arena);
    arena = null;
    arenaKey = '';
    gen++;
    clearOverlay(overlay);
  }

  /** Runs `fn` after `ms` unless the fight changed meanwhile. */
  function later(ms: number, fn: (a: ArenaScene, now: number) => void): void {
    const g = gen;
    setTimeout(() => {
      if (g === gen && arena) fn(arena, performance.now());
    }, ms);
  }

  /** Text at a fighter's anchor (requirements 13.1, 13.2, 22.5). */
  function text(a: ArenaScene, who: 'hero' | 'foe', s: string, now: number, color: string, size = 10): void {
    arenaAnchor(a, who, _a);
    floatText(overlay, s, _a.x, _a.y + 0.5, _a.z, now, { color, size });
  }

  /** The hero's hit on the foe, 100 ms after the attack starts (requirement 13.1). */
  function heroImpact(a: ArenaScene, now: number, grade: 'perfect' | 'good' | 'miss', dmg: number, label: string): void {
    const at = arenaAnchor(a, 'foe', _a);
    if (grade === 'perfect') {
      slash(a.fx, at.x, at.y, at.z, { color: '#ffd257', r: 1.3 });
      burst(a.fx, at.x, at.y, at.z, { n: 26, color: '#ffd257', speed: 4, up: 1 });
      ring(a.fx, at.x, at.y, at.z, { color: '#ffe9a0' });
      shake(a.fx, 9, flags);
      hitStop(a.clock, now, 90, flags);
      arenaHit(a, 'foe', now, 'gold', flags);
      text(a, 'foe', `${label}CRIT ${dmg}`, now, '#ffd257', 14);
    } else if (grade === 'good') {
      slash(a.fx, at.x, at.y, at.z, { color: '#ffffff' });
      burst(a.fx, at.x, at.y, at.z, { n: 12, color: '#ffffff', speed: 3 });
      arenaHit(a, 'foe', now, 'white', flags);
      text(a, 'foe', `${label}${dmg}`, now, '#ffffff', 11);
    } else {
      burst(a.fx, at.x, at.y, at.z, { n: 8, color: '#8b98ab', speed: 1.5, grav: 1 });
      if (dmg > 0) arenaHit(a, 'foe', now, 'white', flags);
      text(a, 'foe', dmg > 0 ? `${label}${dmg}` : 'GLANCE', now, '#9aa4b8', 9);
    }
  }

  /** The foe's death burst, 150 ms after the killing hit. */
  function death(a: ArenaScene, now: number): void {
    const at = arenaAnchor(a, 'foe', _a);
    burst(a.fx, at.x, at.y, at.z, { n: a.spec.boss ? 60 : 36, color: a.spec.boss ? '#b48cff' : '#d9c6ff', speed: 4.5, up: 1.5, life: 0.9 });
    ring(a.fx, at.x, at.y, at.z, { color: '#ffffff', vr: 7, life: 0.5 });
    shake(a.fx, a.spec.boss ? 14 : 6, flags);
    arenaDeath(a, now);
  }

  /** Arena effects for a step's events (requirements 13.1–13.4, 22.3, 22.4). */
  function fightEffects(events: readonly GameEvent[]): void {
    if (!arena) return;
    const a = arena;
    const now = performance.now();
    for (const e of events) {
      if (e.type === 'fightStart') {
        later(PACING.fightDust, (x) => {
          burst(x.fx, x.foe.home.x, 0.25, x.foe.home.z, { n: 24, color: '#6b6878', speed: 2.5, up: 1, grav: 3, jitter: 1 });
          shake(x.fx, e.boss ? 12 : 5, flags);
        });
      } else if (e.type === 'heroHit') {
        e.grades.forEach((g, i) => {
          const start = i * PACING.comboGap;
          later(start, (x, t) => arenaStrike(x, 'hero', t));
          later(start + 100, (x, t) => heroImpact(x, t, g, e.dmgs[i] ?? 0, ''));
        });
        if (e.killed) later((e.grades.length - 1) * PACING.comboGap + 250, death);
        if (!e.grades.length) arenaStrike(a, 'hero', now);
      } else if (e.type === 'counter') {
        arenaStrike(a, 'hero', now);
        later(100, (x, t) => heroImpact(x, t, 'good', e.dmg, 'COUNTER '));
        if (e.killed) later(250, death);
      } else if (e.type === 'monsterHit') {
        arenaStrike(a, 'foe', now);
        later(PACING.hpBarDelay, (x, t) => {
          const at = arenaAnchor(x, 'hero', _a);
          if (e.grade === 'perfect') {
            ring(x.fx, at.x, at.y, at.z, { color: '#ffd257' });
            ring(x.fx, at.x, at.y, at.z, { color: '#ffffff', r: 0.05, vr: 3.5, life: 0.5 });
            slowMo(x.clock, t, 340, 0.3, flags);
            arenaHit(x, 'hero', t, 'gold', flags);
            text(x, 'hero', 'PERFECT!', t, '#ffd257', 12);
          } else if (e.grade === 'good') {
            burst(x.fx, at.x, at.y, at.z, { n: 14, color: '#7cc8ff', speed: 3 });
            shake(x.fx, 3, flags);
            arenaHit(x, 'hero', t, 'white', flags);
            text(x, 'hero', `-${e.dmg}`, t, '#9fd8ff', 11);
          } else {
            burst(x.fx, at.x, at.y, at.z, { n: 22, color: '#ff4a5a', speed: 3.5 });
            shake(x.fx, 10, flags);
            arenaHit(x, 'hero', t, 'red', flags);
            text(x, 'hero', `-${e.dmg}`, t, '#ff5a6a', 12);
          }
          if (e.lethal) arenaHeroDown(x);
        });
      } else if (e.type === 'phase2') {
        arenaPhase2(a, now, flags);
        later(PACING.phase2Fx, (x) => {
          const at = arenaAnchor(x, 'foe', _a);
          shake(x.fx, 14, flags);
          ring(x.fx, at.x, at.y, at.z, { color: '#ff3a3a', vr: 6, life: 0.6 });
          burst(x.fx, at.x, at.y, at.z, { n: 40, color: '#ff3a3a', speed: 4 });
          text(x, 'foe', 'PHASE 2', performance.now(), '#ff5a6a', 16);
        });
      }
    }
  }

  applyQuality(quality);

  return {
    kind: 'world',
    mount(el: HTMLElement): void {
      observer?.unobserve(current);
      current = el;
      el.appendChild(canvas);
      el.appendChild(overlay.canvas);
      observer?.observe(el);
      resize();
    },
    showTeaser(map: GameMap): void {
      dropArena();
      const s = sceneFor(map, 0);
      shown = 'teaser';
      teaserAt = performance.now();
      startRise(s, teaserAt, flags);
      startLoop();
    },
    showMap(state: RunState, view: RouteView, opts: { rise: boolean }): void {
      dropArena();
      const s = sceneFor(state.map, state.stats.steps);
      const now = performance.now();
      if (shown === 'teaser') s.rise = null;
      syncMap(s, state, view, now, flags);
      if (opts.rise) startRise(s, now, flags);
      const fromFight = shown === 'fight';
      shown = 'map';
      if (fromFight) resize();
      startLoop();
    },
    showFight(state: RunState): void {
      // The map scene stays built (stopped) for the return; the arena is built once per fight.
      const spec = arenaSpecFor(state);
      const f = state.combat;
      if (!spec || !f) return;
      const key = `${f.col},${f.row},${f.m.name}`;
      if (!arena || key !== arenaKey || state.events.some((e) => e.type === 'fightStart')) {
        dropArena();
        arena = buildArena(spec, world, quality, current.clientWidth / Math.max(1, current.clientHeight) || 8 / 3);
        arenaKey = key;
        // Joined mid-fight (renderer swap or reload): show the phase-2 tint at once.
        if (f.m.phase2) arenaPhase2(arena, performance.now(), motionFlags(true));
        clearFx(arena.fx);
        warm = 0;
        frames.reset();
      }
      shown = 'fight';
      resize();
      startLoop();
    },
    onEvents(_state: RunState, events: readonly GameEvent[]): void {
      if (shown === 'fight') return fightEffects(events);
      if (!ms) return;
      const now = performance.now();
      for (const e of events) if (e.type === 'moved') heroHop(ms, e.from, e.to, now, flags);
    },
    pick(clientX: number, clientY: number): Pos | null {
      if (!ms || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const x = ((clientX - r.left) / r.width) * 2 - 1;
      const y = -((clientY - r.top) / r.height) * 2 + 1;
      if (x < -1 || x > 1 || y < -1 || y > 1) return null;
      return pickTile(ms, x, y);
    },
    hover(pos: Pos | null): void {
      if (ms) setHover(ms, pos);
    },
    setReduced(on: boolean): void {
      flags = motionFlags(on);
    },
    stop(): void {
      shown = 'none';
      stopLoop();
    },
    dispose(): void {
      stopLoop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      if (lostTimer !== null) clearTimeout(lostTimer);
      dropArena();
      if (ms) disposeMapScene(ms);
      ms = null;
      gl.dispose();
      canvas.remove();
      overlay.canvas.remove();
    },
  };
}
