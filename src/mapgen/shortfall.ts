// Shortfall: a quiet window raises Lost Ghosts from fog until there are enough fights.
import { makeRng, shuffleInPlace } from './rng';
import { MAP_RNG_SALT, MIN_FIGHTS } from './rules';
import type { DayTile } from './types';

/** Mutates the freshly assigned tiles. Uses the map RNG, never the run RNG. */
export function applyShortfall(tiles: DayTile[], seed: number): { quiet: boolean } {
  const fights = (): number => tiles.filter((t) => t.kind === 'monster').length;
  if (fights() >= MIN_FIGHTS) return { quiet: false };
  const rng = makeRng(seed ^ MAP_RNG_SALT);
  const pool = tiles.filter((t) => t.kind === 'fog');
  shuffleInPlace(pool, () => rng.next());
  while (fights() < MIN_FIGHTS && pool.length) {
    const t = pool.pop() as DayTile;
    t.kind = 'monster';
    t.tier = 1;
    t.risen = true;
    t.deco = false;
  }
  return { quiet: true };
}
