import { describe, expect, it } from 'vitest';
import { routeAction } from '../../src/engine/routebot';
import type { RunState } from '../../src/engine/state';
import { tileAt, type DayTile, type Tier } from '../../src/mapgen';
import { makeTestRun } from '../fixtures/run';

// Demo map: start at (0,2), boss at (11,2), Gate at (13,1), 3 shards needed.
// `blank` clears every other tile to resolved fog so each test places only the tiles it needs.
function blank(): RunState {
  const s = makeTestRun();
  for (const t of s.map.tiles) {
    if (t.kind === 'start' || t.kind === 'gate' || t.boss) continue;
    Object.assign(t, { kind: 'fog', tier: 0, resolved: true });
  }
  return s;
}

function put(s: RunState, col: number, row: number, kind: DayTile['kind'], tier: 0 | Tier = 0): void {
  const t = tileAt(s.map, col, row);
  if (!t) throw new Error(`no tile at ${col},${row}`);
  Object.assign(t, { kind, tier, resolved: false });
}

function atHp(s: RunState, pct: number): RunState {
  s.hero.hp = Math.round((s.hero.maxHp * pct) / 100);
  return s;
}

const move = (dir: string) => ({ type: 'move', dir });

describe('FR-PRO-1: route rule, heal at a chest', () => {
  it('heals at 44% HP and walks on at 46% while the ward holds', () => {
    for (const [pct, dir] of [
      [44, 'down'],
      [46, 'right'],
    ] as const) {
      const s = atHp(blank(), pct);
      put(s, 0, 3, 'chest');
      put(s, 1, 2, 'monster', 3);
      expect(s.hero.hp / s.hero.maxHp < 0.45).toBe(pct === 44);
      expect(routeAction(s)).toEqual(move(dir));
    }
  });

  it('heals below 75% once the ward is broken and the boss is next', () => {
    for (const [pct, dir] of [
      [74, 'down'],
      [76, 'right'],
    ] as const) {
      const s = atHp(blank(), pct);
      s.shards = s.map.shardsNeeded;
      put(s, 0, 3, 'chest');
      expect(s.hero.hp / s.hero.maxHp < 0.75).toBe(pct === 74);
      expect(routeAction(s)).toEqual(move(dir));
    }
  });

  it('keeps the 45% threshold while shards are missing, even at 74%', () => {
    const s = atHp(blank(), 74);
    put(s, 0, 3, 'chest');
    put(s, 1, 2, 'monster', 4);
    expect(routeAction(s)).toEqual(move('right'));
  });

  it('skips the heal when no unresolved chest is reachable', () => {
    const s = atHp(blank(), 10);
    put(s, 0, 4, 'monster', 3);
    expect(routeAction(s)).toEqual(move('down'));
  });
});

describe('FR-PRO-3: route rule, shards before the boss', () => {
  it('goes for the nearest Ghoul or Lich, not a nearer lower tier', () => {
    const s = blank();
    put(s, 1, 2, 'monster', 2);
    put(s, 0, 4, 'monster', 4);
    expect(routeAction(s)).toEqual(move('down'));
  });

  it('ignores Ghouls and Liches once the ward is broken and heads for the boss', () => {
    const s = blank();
    s.shards = s.map.shardsNeeded;
    put(s, 0, 3, 'monster', 3);
    expect(routeAction(s)).toEqual(move('right'));
  });

  it('heads for the Gate after the boss, and never into the sealed Gate before', () => {
    const s = blank();
    s.shards = s.map.shardsNeeded;
    s.pos = { col: 12, row: 1 };
    // Boss at (11,2) is two steps away by left or down; the sealed Gate on the right is not walkable.
    expect(routeAction(s)).toEqual(move('left'));
    s.bossDown = true;
    (s.map.tiles[s.map.bossIdx] as DayTile).resolved = true;
    expect(routeAction(s)).toEqual(move('right'));
  });
});

describe('FR-PRO-1: route rule, ties and relics', () => {
  it('breaks distance ties by the mapgen neighbours order (right, left, down, up)', () => {
    const cases: [string[], string][] = [
      [['right', 'down'], 'right'],
      [['left', 'down'], 'left'],
      [['down', 'up'], 'down'],
    ];
    const at: Record<string, [number, number]> = { right: [6, 3], left: [4, 3], down: [5, 4], up: [5, 2] };
    for (const [dirs, want] of cases) {
      const s = atHp(blank(), 20);
      s.pos = { col: 5, row: 3 };
      for (const d of dirs) put(s, ...(at[d] as [number, number]), 'chest');
      expect(routeAction(s)).toEqual(move(want));
    }
  });

  it('picks the first relic while an offer is open', () => {
    const s = blank();
    s.status = 'relic';
    s.relicOffer = ['duck', 'force', 'cache'];
    expect(routeAction(s)).toEqual({ type: 'pickRelic', i: 0 });
  });
});
