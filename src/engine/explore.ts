// Map-only exploration rules: fog reveal, blocked moves, soul shards (prototype reveal, tryMove, winFight).
// These operate on the reducer's draft; step() clones its input first.
import { tileAt, type DayTile, type GameMap, type Pos } from '../mapgen';
import { REVEAL_R2, REVEAL_R2_REVIEW } from './balance';

export type ExploreState = {
  map: GameMap;
  pos: Pos;
  prev: Pos | null;
  bossDown: boolean;
  shards: number;
  stats: { steps: number };
  hero: { relics: readonly string[] };
  log: string[];
};

export type Dir = 'up' | 'down' | 'left' | 'right';

export type MoveCheck =
  | { ok: true; tile: DayTile }
  | { ok: false; reason: 'void' }
  | { ok: false; reason: 'sealed' | 'warded'; message: string };

const DELTA: Readonly<Record<Dir, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function revealRadiusSq(relics: readonly string[]): 5 | 8 {
  return relics.includes('review') ? REVEAL_R2_REVIEW : REVEAL_R2;
}

/** Marks every tile within the reveal radius of the hero as seen. Seen tiles stay seen. */
export function reveal(s: ExploreState): void {
  const r2 = revealRadiusSq(s.hero.relics);
  for (const t of s.map.tiles) {
    const dc = t.col - s.pos.col;
    const dr = t.row - s.pos.row;
    if (dc * dc + dr * dr <= r2) t.seen = true;
  }
}

/** Start, Gate, and boss always show; other tiles only once seen. */
export function isVisible(t: DayTile): boolean {
  return t.seen || t.kind === 'start' || t.kind === 'gate' || t.boss === true;
}

export function checkMove(s: ExploreState, dir: Dir): MoveCheck {
  const [dc, dr] = DELTA[dir];
  const t = tileAt(s.map, s.pos.col + dc, s.pos.row + dr);
  if (!t) return { ok: false, reason: 'void' };
  if (t.kind === 'gate' && !t.boss && !s.bossDown)
    return { ok: false, reason: 'sealed', message: 'The Gate is sealed. Defeat the Phantom of your best day first.' };
  if (t.boss && !t.resolved && s.shards < s.map.shardsNeeded)
    return {
      ok: false,
      reason: 'warded',
      message: `The Phantom is warded. Soul shards: ${s.shards}/${s.map.shardsNeeded}. Banish more Ghouls or Liches.`,
    };
  return { ok: true, tile: t };
}

/** Moves onto a checked tile. Entering the tile (encounters) is the reducer's job. */
export function applyMove(s: ExploreState, tile: DayTile): void {
  s.prev = { col: s.pos.col, row: s.pos.row };
  s.pos = { col: tile.col, row: tile.row };
  s.stats.steps++;
  tile.visited = true;
  reveal(s);
}

/** After a banish: tiers 3 and 4 add a shard while the ward holds. */
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
