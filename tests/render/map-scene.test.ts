import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { legalMoves, reveal, step, type RunState } from '../../src/engine';
import type { RouteTarget } from '../../src/render/map/route-view';
import { countLights } from '../../src/render/world/atmosphere';
import {
  buildMapScene,
  disposeMapScene,
  heroHop,
  pickTile,
  setAspect,
  startRise,
  syncMap,
  tickMap,
  type MapScene,
  type MapSyncView,
  type WorldDeps,
} from '../../src/render/world/map-scene';
import { slabHeight } from '../../src/render/world/math';
import { motionFlags } from '../../src/render/world/motion-flags';
import type { CanvasSource } from '../../src/render/world/textures';
import { makeTestRun } from '../fixtures/run';

const stub = (width: number, height: number) => ({ width, height }) as unknown as CanvasSource;
const deps: WorldDeps = {
  spriteCanvas: (key) => (key.startsWith('hero:') ? stub(26, 26) : key === 'mon:phantom' ? stub(18, 26) : key.startsWith('mon:') ? stub(18, 18) : stub(14, 14)),
  textCanvas: (text) => stub(8 * text.length, 8),
};
const FULL = motionFlags(false);

/** The route view `syncMap` reads, built straight from the engine (task 12.1 adds `routeView`). */
function viewOf(s: RunState): MapSyncView {
  const opts = s.status === 'exploring' ? legalMoves(s) : [];
  const targets: RouteTarget[] = opts.map((o) => {
    const d = o.row - s.pos.row;
    return { to: { col: o.col, row: o.row }, branch: d < 0 ? 'up' : d > 0 ? 'down' : 'ahead', key: d < 0 ? 'W' : d > 0 ? 'S' : 'D', boss: o.boss, monster: false };
  });
  const unseen = s.map.tiles.filter((t) => !t.seen).map((t) => t.col);
  const best = s.map.tiles.find((t) => t.bestDay);
  return {
    targets,
    fogFrom: unseen.length ? Math.min(...unseen) : s.map.cols,
    shards: s.shards,
    bound: s.shards >= 3,
    banished: s.bossDown,
    bestDay: best ? { col: best.col, row: best.row } : null,
  };
}

function scene(s: RunState): MapScene {
  const ms = buildMapScene(s.map, deps, 'high');
  syncMap(ms, s, viewOf(s), 0, FULL);
  return ms;
}

/** Columns whose every slab has the lit (untinted) instance colour. */
function untintedCols(ms: MapScene): number[] {
  const c = new Color();
  const tinted = new Set<number>();
  for (const t of ms.map.tiles) {
    const slot = ms.slotOf[t.idx]!;
    ms.slabs[slot.level]!.getColorAt(slot.id, c);
    if (c.r < 0.99) tinted.add(t.col);
  }
  return Array.from({ length: ms.map.cols }, (_, i) => i).filter((i) => !tinted.has(i));
}

const shownTargets = (ms: MapScene) =>
  ms.highlights
    .filter((h) => h.root.visible)
    .map((h) => `${h.to!.col},${h.to!.row}`)
    .sort();
const targetKeys = (s: RunState) =>
  legalMoves(s)
    .map((o) => `${o.col},${o.row}`)
    .sort();

describe('requirement 19.1, 25.3: slabs', () => {
  it('uses five instanced meshes whose instance counts add up to 91', () => {
    const ms = scene(makeTestRun());
    expect(ms.slabs).toHaveLength(5);
    expect(ms.slabs.reduce((n, m) => n + m.count, 0)).toBe(91);
    ms.slabs.forEach((m, lv) => {
      for (const idx of ms.byInstance[lv]!) expect(ms.map.tiles[idx]!.day.level).toBe(lv);
    });
  });

  it('gives each slab the height of its level', () => {
    const ms = scene(makeTestRun());
    const m = new Matrix4();
    const p = new Vector3();
    const q = new Quaternion();
    const sc = new Vector3();
    ms.slabs.forEach((mesh, lv) => {
      for (let id = 0; id < mesh.count; id++) {
        mesh.getMatrixAt(id, m);
        m.decompose(p, q, sc);
        expect(sc.y).toBeCloseTo(slabHeight(lv), 6);
        const t = ms.map.tiles[ms.byInstance[lv]![id]!]!;
        expect([p.x, p.z]).toEqual([t.col, t.row]);
      }
    });
  });
});

describe('requirement 23.3: boss node', () => {
  it('puts the altar one unit right of the last column at the boss node row', () => {
    const s = makeTestRun();
    const ms = scene(s);
    expect(ms.altar.position.x).toBe(s.map.cols);
    expect(ms.altar.position.z).toBe(s.map.bossNode.row);
    expect(ms.phantom.root.position.x).toBe(s.map.cols);
  });

  it('lights one shard pip per shard and shows the bound ring at 3', () => {
    const s = makeTestRun();
    const ms = scene(s);
    s.shards = 2;
    syncMap(ms, s, viewOf(s), 10, FULL);
    expect(ms.pips.map((p) => p.material.emissiveIntensity > 0)).toEqual([true, true, false]);
    expect(ms.ring.visible).toBe(false);
    s.shards = 3;
    syncMap(ms, s, viewOf(s), 20, FULL);
    expect(ms.ring.visible).toBe(true);
  });
});

describe('requirements 21.4, 23.5: fog columns', () => {
  it('draws no billboard on unseen tiles at the start', () => {
    const s = makeTestRun();
    const ms = scene(s);
    for (const t of s.map.tiles) if (!t.seen) expect(ms.contents[t.idx]).toBeUndefined();
    expect(ms.contents.some((c) => c)).toBe(true);
  });

  it('untints one more column after Code Review', () => {
    const s = makeTestRun();
    const ms = scene(s);
    expect(untintedCols(ms)).toEqual([0, 1, 2]);
    s.hero.relics.push('review');
    reveal(s);
    syncMap(ms, s, viewOf(s), 10, FULL);
    expect(untintedCols(ms)).toEqual([0, 1, 2, 3]);
    expect(ms.fog.edge).toBeCloseTo(2.5, 6);
    tickMap(ms, 10 + 400, 0.016, FULL);
    expect(ms.fog.edge).toBeCloseTo(3.5, 6);
  });
});

describe('requirement 23.1: highlights', () => {
  it('shows exactly the legal targets, before and after a move', () => {
    let s = makeTestRun();
    const ms = scene(s);
    expect(shownTargets(ms)).toEqual(targetKeys(s));
    expect(shownTargets(ms)).toHaveLength(3);
    const to = legalMoves(s)[1]!;
    s = step(s, { type: 'move', to: { col: to.col, row: to.row } });
    syncMap(ms, s, viewOf(s), 100, FULL);
    if (s.status === 'exploring') expect(shownTargets(ms)).toEqual(targetKeys(s));
    else expect(shownTargets(ms)).toEqual([]);
  });
});

describe('requirement 21.1: light pool', () => {
  it('keeps exactly four point lights in every state', () => {
    let s = makeTestRun();
    const ms = scene(s);
    expect(countLights(ms.scene).point).toBe(4);
    for (let i = 0; i < 4 && s.status === 'exploring'; i++) {
      const to = legalMoves(s)[0]!;
      const before = { ...s.pos };
      s = step(s, { type: 'move', to: { col: to.col, row: to.row } });
      syncMap(ms, s, viewOf(s), 100 * (i + 1), FULL);
      heroHop(ms, before, s.pos, 100 * (i + 1), FULL);
      tickMap(ms, 100 * (i + 1) + 70, 0.016, FULL);
      expect(countLights(ms.scene).point).toBe(4);
    }
  });
});

describe('requirement 8.1: picking', () => {
  it('returns the tile under a slab centre, null off the map', () => {
    const s = makeTestRun();
    const ms = scene(s);
    setAspect(ms, 16 / 9);
    tickMap(ms, 1000, 0.016, FULL);
    const probe = (x: number, y: number, z: number) => {
      const v = new Vector3(x, y, z).project(ms.camera);
      return pickTile(ms, v.x, v.y);
    };
    for (const pos of [s.pos, legalMoves(s)[0]!]) {
      const t = s.map.tiles.find((x) => x.col === pos.col && x.row === pos.row)!;
      expect(probe(t.col, slabHeight(t.day.level), t.row)).toEqual({ col: t.col, row: t.row });
    }
    expect(pickTile(ms, Number.NaN, 0)).toBeNull();
    expect(pickTile(ms, 0, 0.99)).toBeNull();
  });
});

describe('requirement 19.4, 26.1: rise', () => {
  it('grows slabs from near zero and ends at full height', () => {
    const s = makeTestRun();
    const ms = scene(s);
    startRise(ms, 0, FULL);
    tickMap(ms, 1, 0.016, FULL);
    const m = new Matrix4();
    const sc = new Vector3();
    ms.slabs[0]!.getMatrixAt(0, m);
    m.decompose(new Vector3(), new Quaternion(), sc);
    expect(sc.y).toBeLessThan(0.01);
    tickMap(ms, 5000, 0.016, FULL);
    expect(ms.rise).toBeNull();
    ms.slabs[0]!.getMatrixAt(0, m);
    m.decompose(new Vector3(), new Quaternion(), sc);
    expect(sc.y).toBeCloseTo(slabHeight(0), 6);
  });

  it('is skipped with reduced motion', () => {
    const ms = scene(makeTestRun());
    startRise(ms, 0, motionFlags(true));
    expect(ms.rise).toBeNull();
    disposeMapScene(ms);
  });
});
