import { describe, expect, it } from 'vitest';
import { loadDemo } from '../../src/data/demo';
import {
  applyMove,
  checkMove,
  collectShard,
  isVisible,
  legalMoves,
  reveal,
  shardStatus,
  viewAhead,
  type ExploreState,
} from '../../src/engine/explore';
import { generateMap } from '../../src/mapgen/generate';
import { tileAt } from '../../src/mapgen/layout';
import { nextOptions } from '../../src/mapgen/routes';
import type { GameMap, Pos } from '../../src/mapgen/types';

// Demo map: 14 columns, start at (0, 2), last column rows 0–1, boss node (14, 2).
function demoMap(): GameMap {
  const r = generateMap(loadDemo(() => Date.UTC(2026, 10, 19)));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function stateAt(pos: Pos, opts: Partial<ExploreState> = {}, map = demoMap()): ExploreState {
  return { map, pos, prev: null, shards: 0, stats: { steps: 0 }, hero: { relics: [] }, log: [], ...opts };
}

const seenCols = (s: ExploreState) => [...new Set(s.map.tiles.filter((t) => t.seen).map((t) => t.col))].sort((a, b) => a - b);
const seenCount = (s: ExploreState) => s.map.tiles.filter((t) => t.seen).length;

function move(s: ExploreState, to: Pos): void {
  const c = checkMove(s, to);
  if (!c.ok) throw new Error(`expected a legal move to (${to.col}, ${to.row})`);
  applyMove(s, c);
}

describe('view window', () => {
  it('is 2 columns ahead, or 3 with Code Review', () => {
    expect(viewAhead([])).toBe(2);
    expect(viewAhead(['lucky', 'review'])).toBe(3);
  });

  it('at the start sees exactly columns 0–2 (19 tiles: 5 + 7 + 7)', () => {
    const s = stateAt({ col: 0, row: 2 });
    reveal(s);
    expect(seenCols(s)).toEqual([0, 1, 2]);
    expect(seenCount(s)).toBe(19);
    for (const t of s.map.tiles) expect(t.seen).toBe(t.col <= 2);
  });

  it('after a move sees one column further, and seen tiles stay seen', () => {
    const s = stateAt({ col: 0, row: 2 });
    reveal(s);
    move(s, { col: 1, row: 2 });
    expect(seenCols(s)).toEqual([0, 1, 2, 3]);
    expect(seenCount(s)).toBe(26);
    expect(tileAt(s.map, 0, 2)!.seen).toBe(true);
  });

  it('with Code Review sees columns 0–3 from the start', () => {
    const s = stateAt({ col: 0, row: 2 }, { hero: { relics: ['review'] } });
    reveal(s);
    expect(seenCols(s)).toEqual([0, 1, 2, 3]);
  });

  it('a tile shows its contents only once seen', () => {
    const map = demoMap();
    const t = map.tiles[30]!;
    expect(isVisible(t)).toBe(false);
    t.seen = true;
    expect(isVisible(t)).toBe(true);
  });
});

describe('legal moves', () => {
  it('match nextOptions: three forward rows from the start', () => {
    const s = stateAt({ col: 0, row: 2 });
    expect(legalMoves(s)).toEqual(nextOptions(s.map, s.pos));
    expect(legalMoves(s)).toEqual([
      { col: 1, row: 1, boss: false },
      { col: 1, row: 2, boss: false },
      { col: 1, row: 3, boss: false },
    ]);
  });

  it('refuse behind, the same column, staying, two ahead, and an unlisted row', () => {
    const s = stateAt({ col: 3, row: 3 });
    for (const to of [
      { col: 2, row: 3 },
      { col: 3, row: 4 },
      { col: 3, row: 3 },
      { col: 5, row: 3 },
      { col: 4, row: 5 },
      { col: 4, row: 0 },
    ])
      expect(checkMove(s, to)).toEqual({ ok: false });
    expect(checkMove(s, { col: 4, row: 4 }).ok).toBe(true);
  });

  it('refuse a void cell; the edge fallback is the only move into the last column', () => {
    const s = stateAt({ col: 12, row: 4 });
    expect(tileAt(s.map, 13, 4)).toBeNull();
    expect(checkMove(s, { col: 13, row: 4 })).toEqual({ ok: false });
    expect(legalMoves(s)).toEqual([{ col: 13, row: 1, boss: false }]);
    expect(checkMove(s, { col: 13, row: 1 }).ok).toBe(true);
  });

  it('a refused move leaves position, steps, tiles, and the log unchanged', () => {
    const s = stateAt({ col: 3, row: 3 });
    reveal(s);
    const before = structuredClone(s);
    expect(checkMove(s, { col: 2, row: 3 }).ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('a legal move updates prev, pos, steps, visited, and the window, without resolving', () => {
    const s = stateAt({ col: 0, row: 2 });
    const c = checkMove(s, { col: 1, row: 3 });
    if (!c.ok) throw new Error('expected a legal move');
    expect(c.target).toEqual({ col: 1, row: 3, boss: false });
    expect(c.tile).toBe(tileAt(s.map, 1, 3));
    applyMove(s, c);
    expect(s.prev).toEqual({ col: 0, row: 2 });
    expect(s.pos).toEqual({ col: 1, row: 3 });
    expect(s.stats.steps).toBe(1);
    expect(c.tile!.visited).toBe(true);
    expect(c.tile!.seen).toBe(true);
    expect(c.tile!.resolved).toBe(false);
    expect(tileAt(s.map, 3, 0)!.seen).toBe(true);
    expect(tileAt(s.map, 4, 0)!.seen).toBe(false);
  });

  it('the last column moves only to the boss node; there every tile is seen and nothing moves', () => {
    const s = stateAt({ col: 13, row: 1 });
    expect(legalMoves(s)).toEqual([{ col: 14, row: 2, boss: true }]);
    expect(checkMove(s, { col: 14, row: 1 })).toEqual({ ok: false });
    const c = checkMove(s, { col: 14, row: 2 });
    expect(c).toEqual({ ok: true, target: { col: 14, row: 2, boss: true }, tile: null });
    if (!c.ok) throw new Error('expected the boss node');
    applyMove(s, c);
    expect(s.pos).toEqual(s.map.bossNode);
    expect(s.prev).toEqual({ col: 13, row: 1 });
    expect(s.stats.steps).toBe(1);
    expect(s.map.tiles.every((t) => t.seen)).toBe(true);
    expect(legalMoves(s)).toEqual([]);
    expect(checkMove(s, { col: 15, row: 2 })).toEqual({ ok: false });
    expect(checkMove(s, { col: 14, row: 2 })).toEqual({ ok: false });
  });
});

describe('soul shards', () => {
  it('count tiers 3 and 4, log each shard, and bind the Phantom at 3', () => {
    const s = stateAt({ col: 0, row: 2 });
    expect(collectShard(s, 3)).toEqual({ got: true, bound: false });
    expect(collectShard(s, 4)).toEqual({ got: true, bound: false });
    expect(collectShard(s, 3)).toEqual({ got: true, bound: true });
    expect(s.log).toEqual([
      'Soul shard 1/3. The Phantom weakens.',
      'Soul shard 2/3. The Phantom weakens.',
      'Soul shard 3/3. The Phantom is bound: no Phase 2.',
    ]);
    expect(shardStatus(s)).toEqual({ have: 3, max: 3 });
  });

  it('give nothing past 3 and nothing from tiers 1, 2, and 5', () => {
    const s = stateAt({ col: 0, row: 2 });
    for (const tier of [0, 1, 2, 5]) expect(collectShard(s, tier)).toEqual({ got: false, bound: false });
    expect(s.shards).toBe(0);
    expect(shardStatus(s)).toEqual({ have: 0, max: 3 });
    s.shards = 3;
    expect(collectShard(s, 4)).toEqual({ got: false, bound: false });
    expect(s.shards).toBe(3);
    expect(s.log).toEqual([]);
  });
});
