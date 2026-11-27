// Shortfall: a quiet window raises Lost Ghosts from fog until there are enough fights (count step), then
// v1.6 lifts every route to MIN_ROUTE_FIGHTS (route step). Both draw from one map RNG instance.
import { type Rng, shuffleInPlace } from './rng';
import { MIN_FIGHTS, MIN_ROUTE_FIGHTS } from './rules';
import { minFightRoute, routeMinFights } from './routes';
import type { DayTile, GameMap } from './types';

/** Turn a tile into a Lost Ghost (tier-1 `risen` monster, no decoration, no chest size). */
function raise(t: DayTile): void {
  t.kind = 'monster';
  t.tier = 1;
  t.risen = true;
  t.deco = false;
  delete t.size;
}

/** Count step. Mutates the freshly assigned tiles; draws from the map RNG only when it runs. */
export function applyShortfall(tiles: DayTile[], rng: Rng): { quiet: boolean } {
  const fights = (): number => tiles.filter((t) => t.kind === 'monster').length;
  if (fights() >= MIN_FIGHTS) return { quiet: false };
  const pool = tiles.filter((t) => t.kind === 'fog');
  shuffleInPlace(pool, () => rng.next());
  while (fights() < MIN_FIGHTS && pool.length) raise(pool.pop() as DayTile);
  return { quiet: true };
}

/** Upper bound on conversions; reaching it means validation rejects the map. */
const ROUTE_SHORTFALL_CAP = 91;

/**
 * v1.6 route step (game-rules.md "Minimum fights per route"): while the fight-minimal route has fewer than
 * MIN_ROUTE_FIGHTS monsters, raise one of its fog tiles (else wisps, else chests) in columns ≥ 1, chosen with
 * the map RNG. Does not change `quiet`. Returns the number of tiles converted.
 */
export function applyRouteShortfall(map: GameMap, rng: Rng): number {
  let n = 0;
  while (n < ROUTE_SHORTFALL_CAP && routeMinFights(map) < MIN_ROUTE_FIGHTS) {
    const route = minFightRoute(map).filter((t) => t.col >= 1);
    let candidates = route.filter((t) => t.kind === 'fog');
    if (!candidates.length) candidates = route.filter((t) => t.kind === 'wisp');
    if (!candidates.length) candidates = route.filter((t) => t.kind === 'chest');
    if (!candidates.length) break;
    raise(candidates[Math.floor(rng.next() * candidates.length)] as DayTile);
    n++;
  }
  return n;
}
