import { describe, expect, it } from 'vitest';
import { legalMoves, reveal } from '../../src/engine';
import { routeView, targetFor } from '../../src/render/map/route-view';
import { fightOn, findTile, makeTestRun } from '../fixtures/run';
import { makeSet, windowDays } from '../fixtures/sets';
import type { RunState } from '../../src/engine';

/** Puts the hero on (col, row) as the engine's move would, without entering the tile. */
function stand(s: RunState, col: number, row: number): RunState {
  s.prev = { ...s.pos };
  s.pos = { col, row };
  reveal(s);
  return s;
}

describe('routeView targets (requirements 23.1, 23.2)', () => {
  it('gives three targets in column 1 at the start, branches up/ahead/down with keys W/D/S', () => {
    const v = routeView(makeTestRun());
    expect(v.single).toBe(false);
    expect(v.targets.map((t) => [t.to.col, t.to.row, t.branch, t.key])).toEqual([
      [1, 1, 'up', 'W'],
      [1, 2, 'ahead', 'D'],
      [1, 3, 'down', 'S'],
    ]);
    expect(targetFor(v, 'up')).toEqual({ col: 1, row: 1 });
    expect(targetFor(v, 'ahead')).toEqual({ col: 1, row: 2 });
    expect(targetFor(v, 'down')).toEqual({ col: 1, row: 3 });
  });

  it('gives the single edge fallback (13, 1) from column 12 row 4, and every branch maps to it', () => {
    const v = routeView(stand(makeTestRun(), 12, 4));
    expect(v.single).toBe(true);
    expect(v.targets).toHaveLength(1);
    expect(v.targets[0]).toMatchObject({ to: { col: 13, row: 1 }, key: '→', boss: false });
    for (const b of ['up', 'ahead', 'down'] as const) expect(targetFor(v, b)).toEqual({ col: 13, row: 1 });
  });

  it('gives only the boss node from the last column', () => {
    const s = stand(makeTestRun(), 13, 0);
    const v = routeView(s);
    expect(v.single).toBe(true);
    expect(v.targets).toEqual([{ to: s.map.bossNode, branch: 'ahead', key: '→', boss: true, monster: true }]);
    expect(targetFor(v, 'down')).toEqual(s.map.bossNode);
  });

  it('leaves out missing branches on the top row', () => {
    const v = routeView(stand(makeTestRun(), 1, 0));
    expect(v.targets.map((t) => t.branch)).toEqual(['ahead', 'down']);
    expect(targetFor(v, 'up')).toBeNull();
  });

  it('marks unresolved monster tiles', () => {
    const s = makeTestRun();
    const v = routeView(s);
    for (const t of v.targets) {
      const tile = s.map.tiles.find((x) => x.col === t.to.col && x.row === t.to.row)!;
      expect(t.monster).toBe(tile.kind === 'monster' && !tile.resolved);
    }
  });

  it('has no targets during a fight, a relic offer, or after the run', () => {
    const fight = makeTestRun();
    fightOn(fight, findTile(fight, (t) => t.kind === 'monster'));
    expect(routeView(fight).targets).toEqual([]);

    const relic = makeTestRun();
    relic.status = 'relic';
    relic.relicOffer = ['review', 'review', 'review'];
    expect(routeView(relic).targets).toEqual([]);

    for (const status of ['won', 'lost'] as const) {
      const s = makeTestRun();
      s.status = status;
      const v = routeView(s);
      expect(v.targets).toEqual([]);
      expect(targetFor(v, 'ahead')).toBeNull();
    }
  });

  it('equals legalMoves on 200 random legal walks', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    for (let w = 0; w < 200; w++) {
      const s = makeTestRun();
      for (;;) {
        const opts = legalMoves(s);
        const v = routeView(s);
        expect(v.targets.map((t) => ({ ...t.to, boss: t.boss }))).toEqual(opts);
        for (const t of v.targets) expect(targetFor(v, t.branch)).toEqual(t.to);
        if (!opts.length) break;
        const o = opts[Math.floor(rnd() * opts.length)]!;
        stand(s, o.col, o.row);
      }
    }
  });
});

describe('routeView fog, boss node, best day, and labels (requirements 23.3–23.5)', () => {
  it('starts the fog at column 3, and at 4 with Code Review', () => {
    expect(routeView(makeTestRun()).fogFrom).toBe(3);
    expect(routeView(makeTestRun({ relics: ['review'] })).fogFrom).toBe(4);
  });

  it('reports cols for fogFrom once every column is seen', () => {
    const s = stand(makeTestRun(), 13, 0);
    expect(routeView(s).fogFrom).toBe(s.map.cols);
  });

  it('finds the best day on the demo map and null on an empty quarter', () => {
    expect(routeView(makeTestRun()).bestDay).toEqual({ col: 11, row: 2 });
    const empty = makeTestRun({ set: makeSet(windowDays(() => ({ count: 0 }))) });
    expect(empty.map.emptyQuarter).toBe(true);
    expect(routeView(empty).bestDay).toBeNull();
  });

  it('carries the boss node, shards, bound, and banished', () => {
    const s = makeTestRun();
    expect(routeView(s)).toMatchObject({ bossNode: s.map.bossNode, shards: 0, bound: false, banished: false });
    s.shards = 2;
    expect(routeView(s)).toMatchObject({ shards: 2, bound: false });
    s.shards = 3;
    expect(routeView(s)).toMatchObject({ shards: 3, bound: true });
    s.bossDown = true;
    expect(routeView(s).banished).toBe(true);
  });

  it('labels the week, and "Boss" on the boss node', () => {
    const s = makeTestRun();
    expect(routeView(s).week).toBe(`Week 1/${s.map.cols}`);
    expect(routeView(stand(s, 4, 2)).week).toBe(`Week 5/${s.map.cols}`);
    expect(routeView(stand(s, s.map.cols - 1, 0)).week).toBe(`Week ${s.map.cols}/${s.map.cols}`);
    expect(routeView(stand(s, s.map.bossNode.col, s.map.bossNode.row)).week).toBe('Boss');
  });
});
