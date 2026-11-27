// Pure key-name mapping for combat (prototype keydown/keyup handlers). `main.ts` passes `KeyboardEvent.key`.

const HIT_KEYS: ReadonlySet<string> = new Set([' ', 'enter', 'a', 'j', 'k']);

/** Space, Enter, A, J, K → "hit" (press, or Attack in `choose`). v1.6: F and Escape have no fight action. */
export function combatKey(key: string): 'hit' | null {
  return HIT_KEYS.has(key.toLowerCase()) ? 'hit' : null;
}
