import { describe, expect, it } from 'vitest';
import { loadDemo } from '../../src/data/demo';
import {
  applyMove,
  checkMove,
  collectShard,
  isVisible,
  reveal,
  revealRadiusSq,
  shardStatus,
  type ExploreState,
} from '../../src/engine/explore';
import { generateMap } from '../../src/mapgen/generate';
import { tileAt } from '../../src/mapgen/layout';
import type { GameMap, Pos } from '../../src/mapgen/types';
import { makeSet, windowDays } from '../fixtures/sets';

function demoMap(): GameMap {
  const r = generateMap(loadDemo(() => Date.UTC(2026, 10, 19)));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

function stateAt(pos: Pos, opts: Partial<ExploreState> = {}, map = demoMap()): ExploreState {
  return { map, pos, prev: null, bossDown: false, shards: 0, stats: { steps: 0 }, hero: { relics: [] }, log: [], ...opts };
}

const seenCount = (s: ExploreState) => s.map.tiles.filter((t) => t.seen).length;

describe('fog reveal', () => {
  it('uses radius² 5, or 8 with Code Review', () => {
    expect(revealRadiusSq([])).toBe(5);
    expect(revealRadiusSq(['lucky', 'review'])).toBe(8);
  });

  it('reveals 21 tiles at radius² 5 and 25 at 8 from the middle of the map', () => {
    const a = stateAt({ col: 6, row: 3 });
    reveal(a);
    expect(seenCount(a)).toBe(21);
    const b = stateAt({ col: 6, row: 3 }, { hero: { relics: ['review'] } });
    reveal(b);
    expect(seenCount(b)).toBe(25);
  });

  it('reveals 11 tiles from the demo start (column 0, row 2), void cells excluded', () => {
    const s = stateAt({ col: 0, row: 2 });
    reveal(s);
    expect(seenCount(s)).toBe(11);
  });

  it('seen tiles stay seen after moving away', () => {
    const s = stateAt({ col: 6, row: 3 });
    reveal(s);
    s.pos = { col: 12, row: 3 };
    reveal(s);
    expect(tileAt(s.map, 6, 3)!.seen).toBe(true);
  });

  it('start, Gate, and boss are always visible; other unseen tiles are not', () => {
    const map = demoMap();
    expect(isVisible(map.tiles[0]!)).toBe(true);
    expect(isVisible(map.tiles[map.gateIdx]!)).toBe(true);
    expect(isVisible(map.tiles[map.bossIdx]!)).toBe(true);
    expect(isVisible(map.tiles[30]!)).toBe(false);
    map.tiles[30]!.seen = true;
    expect(isVisible(map.tiles[30]!)).toBe(true);
  });
});

describe('moves', () => {
  it('refuses void and outside cells silently', () => {
    const s = stateAt({ col: 0, row: 2 });
    expect(checkMove(s, 'up')).toEqual({ ok: false, reason: 'void' }); // (0,1) is void
    expect(checkMove(s, 'left')).toEqual({ ok: false, reason: 'void' });
  });

  it('refuses the sealed Gate until the boss is down', () => {
    const map = demoMap();
    const gate = map.tiles[90]!;
    const s = stateAt({ col: gate.col, row: gate.row - 1 }, {}, map);
    expect(checkMove(s, 'down')).toEqual({
      ok: false,
      reason: 'sealed',
      message: 'The Gate is sealed. Defeat the Phantom of your best day first.',
    });
    s.bossDown = true;
    expect(checkMove(s, 'down')).toEqual({ ok: true, tile: gate });
  });

  it('a Gate that is the boss is not sealed', () => {
    const days = windowDays((i) => ({ count: i === 90 ? 40 : i % 5 }));
    const r = generateMap(makeSet(days));
    if (!r.ok) throw new Error(r.error.message);
    const gate = r.value.tiles[90]!;
    const s = stateAt({ col: gate.col, row: gate.row - 1 }, { shards: 3 }, r.value);
    expect(checkMove(s, 'down').ok).toBe(true);
  });

  it('refuses the warded boss while shards < shardsNeeded', () => {
    const map = demoMap();
    const boss = map.tiles[map.bossIdx]!;
    const s = stateAt({ col: boss.col - 1, row: boss.row }, { shards: 1 }, map);
    expect(checkMove(s, 'right')).toEqual({
      ok: false,
      reason: 'warded',
      message: 'The Phantom is warded. Soul shards: 1/3. Banish more Ghouls or Liches.',
    });
    s.shards = 3;
    expect(checkMove(s, 'right')).toEqual({ ok: true, tile: boss });
  });

  it('a refused move leaves position, steps, and tiles unchanged', () => {
    const map = demoMap();
    const boss = map.tiles[map.bossIdx]!;
    const s = stateAt({ col: boss.col - 1, row: boss.row }, {}, map);
    const before = structuredClone(s);
    const c = checkMove(s, 'right');
    expect(c.ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('a successful move updates prev, pos, steps, visited, and reveals', () => {
    const s = stateAt({ col: 0, row: 2 });
    const c = checkMove(s, 'right');
    if (!c.ok) throw new Error('expected an open move');
    applyMove(s, c.tile);
    expect(s.prev).toEqual({ col: 0, row: 2 });
    expect(s.pos).toEqual({ col: 1, row: 2 });
    expect(s.stats.steps).toBe(1);
    expect(c.tile.visited).toBe(true);
    expect(c.tile.seen).toBe(true);
    expect(c.tile.resolved).toBe(false);
    expect(tileAt(s.map, 3, 2)!.seen).toBe(true);
  });
});

describe('soul shards', () => {
  it('counts tiers 3 and 4 and logs each shard, then the shattering', () => {
    const s = stateAt({ col: 0, row: 2 });
    expect(collectShard(s, 3)).toEqual({ got: true, shattered: false });
    expect(collectShard(s, 4)).toEqual({ got: true, shattered: false });
    expect(collectShard(s, 3)).toEqual({ got: true, shattered: true });
    expect(s.log).toEqual([
      'Soul shard 1/3 collected.',
      'Soul shard 2/3 collected.',
      "Soul shard 3/3. The Phantom's ward shatters!",
    ]);
    expect(shardStatus(s)).toEqual({ have: 3, need: 3 });
  });

  it('gives no shard past the need or from tiers 1, 2, and 5', () => {
    const s = stateAt({ col: 0, row: 2 });
    for (const tier of [1, 2, 5]) expect(collectShard(s, tier)).toEqual({ got: false, shattered: false });
    expect(s.shards).toBe(0);
    s.shards = 3;
    expect(collectShard(s, 4)).toEqual({ got: false, shattered: false });
    expect(s.shards).toBe(3);
    expect(s.log).toEqual([]);
  });

  it('shardsNeeded 0 leaves the boss unwarded from the start', () => {
    const days = windowDays((i) => ({ count: i === 50 ? 9 : i % 2 }));
    const r = generateMap(makeSet(days));
    if (!r.ok) throw new Error(r.error.message);
    const map = r.value;
    expect(map.shardsNeeded).toBe(0);
    const boss = map.tiles[map.bossIdx]!;
    const s = stateAt({ col: boss.col - 1, row: boss.row }, {}, map);
    expect(checkMove(s, 'right').ok).toBe(true);
    expect(collectShard(s, 3)).toEqual({ got: false, shattered: false });
    expect(shardStatus(s)).toEqual({ have: 0, need: 0 });
  });
});
