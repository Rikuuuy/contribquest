// Pure key-name mapping for combat (prototype keydown/keyup handlers). `main.ts` passes `KeyboardEvent.key`.

const HIT_KEYS: ReadonlySet<string> = new Set([' ', 'enter', 'a', 'j', 'k']);
const FLEE_KEYS: ReadonlySet<string> = new Set(['f', 'escape']);

/** Space, Enter, A, J, K → "hit" (press, or Attack in `choose`); F, Escape → "flee". */
export function combatKey(key: string): 'hit' | 'flee' | null {
  const k = key.toLowerCase();
  if (HIT_KEYS.has(k)) return 'hit';
  if (FLEE_KEYS.has(k)) return 'flee';
  return null;
}
