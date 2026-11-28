// The world renderer entry (v1.6, Three.js; design "World renderer"). Loaded only through a dynamic `import()`,
// so `three` lands in its own lazily loaded chunk and the start screen never waits for it. One `WebGLRenderer` and
// one canvas live for the page session; `mount` moves the canvas between hosts. The map scene stays built while a
// fight is shown. The arena scene (`showFight`) arrives with run B (tasks 11.6, 11.7): until then a fight stops
// 3D frames and keeps the map scene for the return.
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import type { ClassId, RaceId } from '../../data/schema';
import type { GameEvent, RunState } from '../../engine';
import type { GameMap, Pos } from '../../mapgen';
import type { RouteView } from '../map/route-view';
import type { Renderer } from '../renderer';
import { bonesKey, itemKey, monsterKey, spriteCache } from '../sprites/build';
import type { MonsterName, SpriteName } from '../sprites/grids';
import { heroKey, type HeroFrame } from '../sprites/hero';
import { setFireflyQuality, setRigQuality } from './atmosphere';
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

/** The outlined sprite canvas for a world sprite key, built through the shared sprite cache. */
export function spriteCanvasFor(key: string): HTMLCanvasElement {
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
    stats.quality = q;
    resize();
  }

  function resize(): void {
    const w = current.clientWidth;
    const h = current.clientHeight;
    if (w < 1 || h < 1) return;
    gl.setSize(w, h, false);
    if (ms) setAspect(ms, w / h);
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    try {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!ms) return;
      if (shown === 'teaser' && flags.rise && now - teaserAt > TEASER_LOOP_MS) {
        teaserAt = now;
        startRise(ms, now, flags);
      }
      tickMap(ms, now, dt, flags);
      gl.render(ms.scene, ms.camera);
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
      fails = 0;
    } catch (e) {
      if (fails === 0) console.error(e);
      if (++fails >= MAX_FRAME_FAILS) fail('frame errors');
    }
  }

  function startLoop(): void {
    if (running || lost || failed || document.hidden || !ms) return;
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

  const onVisibility = () => (document.hidden ? stopLoop() : shown === 'map' || shown === 'teaser' ? startLoop() : undefined);
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
    if (shown === 'map' || shown === 'teaser') startLoop();
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

  applyQuality(quality);

  return {
    kind: 'world',
    mount(el: HTMLElement): void {
      observer?.unobserve(current);
      current = el;
      el.appendChild(canvas);
      observer?.observe(el);
      resize();
    },
    showTeaser(map: GameMap): void {
      const s = sceneFor(map, 0);
      shown = 'teaser';
      teaserAt = performance.now();
      startRise(s, teaserAt, flags);
      startLoop();
    },
    showMap(state: RunState, view: RouteView, opts: { rise: boolean }): void {
      const s = sceneFor(state.map, state.stats.steps);
      const now = performance.now();
      if (shown === 'teaser') s.rise = null;
      syncMap(s, state, view, now, flags);
      if (opts.rise) startRise(s, now, flags);
      shown = 'map';
      startLoop();
    },
    showFight(_state: RunState): void {
      // Run B builds the arena here (task 11.6). Until then the map scene stays built and frames stop.
      shown = 'fight';
      stopLoop();
    },
    onEvents(_state: RunState, events: readonly GameEvent[]): void {
      // The hop here; the other event effects arrive with tasks 7.2 and 11.7.
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
      if (ms) disposeMapScene(ms);
      ms = null;
      gl.dispose();
      canvas.remove();
    },
  };
}
