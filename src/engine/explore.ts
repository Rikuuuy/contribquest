// v1.6 route exploration rules: the column view window, forward-only legal moves, soul shards
// (map-generation design.md "Engine side"). These operate on the reducer's draft; step() clones its input first.
import { nextOptions, tileAt, type DayTile, type GameMap, type Pos, type RouteOption } from '../mapgen';
import { VIEW_AHEAD, VIEW_AHEAD_REVIEW } from './balance';

export type ExploreState = {
  map: GameMap;
  pos: Pos;
  prev: Pos | null;
  shards: number;
  stats: { steps: number };
  hero: { relics: readonly string[] };
  log: string[];
};

/** `tile` is null for the boss node. */
export type MoveCheck = { ok: true; target: RouteOption; tile: DayTile | null } | { ok: false };

/** Columns seen ahead of the hero: 3 with Code Review, else 2. */
export function viewAhead(relics: readonly string[]): 2 | 3 {
  return relics.includes('review') ? VIEW_AHEAD_REVIEW : VIEW_AHEAD;
}

/** Marks every tile with `col ≤ pos.col + viewAhead` as seen. Seen tiles stay seen. */
export function reveal(s: ExploreState): void {
  const last = s.pos.col + viewAhead(s.hero.relics);
  for (const t of s.map.tiles) if (t.col <= last) t.seen = true;
}

/** A tile shows its contents only once seen. The boss node is not a tile and always shows. */
export function isVisible(t: DayTile): boolean {
  return t.seen;
}

/** The legal move targets from the hero's position; `[]` at the boss node. */
export function legalMoves(s: ExploreState): RouteOption[] {
  return nextOptions(s.map, s.pos);
}

/** Ok only when `to` is one of the legal moves (matched by column and row). */
export function checkMove(s: ExploreState, to: Pos): MoveCheck {
  const target = legalMoves(s).find((o) => o.col === to.col && o.row === to.row);
  if (!target) return { ok: false };
  return { ok: true, target, tile: target.boss ? null : tileAt(s.map, target.col, target.row) };
}

/** Moves onto a checked target. Entering the tile (encounters, the boss fight) is the reducer's job. */
export function applyMove(s: ExploreState, m: Extract<MoveCheck, { ok: true }>): void {
  s.prev = { col: s.pos.col, row: s.pos.row };
  s.pos = { col: m.target.col, row: m.target.row };
  s.stats.steps++;
  if (m.tile) m.tile.visited = true;
  reveal(s);
}

/** After a banish: tiers 3 and 4 add a shard while the ward holds. (v1.5; rewritten for SHARD_MAX in map-generation 10.3) */
export function collectShard(s: ExploreState, tier: number): { got: boolean; shattered: boolean } {
  const need = s.map.shardsNeeded;
  if (tier < 3 || tier >= 5 || s.shards >= need) return { got: false, shattered: false };
  s.shards++;
  const shattered = s.shards === need;
  s.log.push(
    shattered ? `Soul shard ${s.shards}/${need}. The Phantom's ward shatters!` : `Soul shard ${s.shards}/${need} collected.`,
  );
  return { got: true, shattered };
}

export function shardStatus(s: Pick<ExploreState, 'map' | 'shards'>): { have: number; need: number } {
  return { have: s.shards, need: s.map.shardsNeeded };
}
