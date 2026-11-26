import { CACHE_KEY_PREFIX } from './constants';
import { CacheEntrySchema, type CacheEntry } from './schema';
import { readJson, writeJson, type StorageLike } from './storage';

export function cacheKey(username: string): string {
  return CACHE_KEY_PREFIX + username.toLowerCase();
}

/** The cached entry if it passes the schema; a corrupt entry counts as no entry. */
export function readCache(storage: StorageLike | null, username: string): CacheEntry | null {
  const parsed = CacheEntrySchema.safeParse(readJson(storage, cacheKey(username)));
  return parsed.success ? parsed.data : null;
}

export function writeCache(storage: StorageLike | null, username: string, e: CacheEntry): void {
  const entry: CacheEntry = e.total === undefined ? { at: e.at, days: e.days } : { at: e.at, days: e.days, total: e.total };
  writeJson(storage, cacheKey(username), entry);
}
