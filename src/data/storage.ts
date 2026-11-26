// Safe localStorage access. Every call swallows storage and JSON failures.

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Parsed JSON at `key`, or null when missing, unreadable, or not JSON. */
export function readJson(storage: StorageLike | null, key: string): unknown | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeJson(storage: StorageLike | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or blocked storage never breaks the game.
  }
}

export function removeKey(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignored, as above.
  }
}
