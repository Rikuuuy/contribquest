// The run RNG: every draw advances `state.rng` (prototype `rand`).
import { nextFloat } from '../mapgen/rng';

export function rand(draft: { rng: number }): number {
  const [value, state] = nextFloat(draft.rng);
  draft.rng = state;
  return value;
}

/** A `() => number` bound to the draft, for functions that take a draw source. */
export function randOf(draft: { rng: number }): () => number {
  return () => rand(draft);
}
