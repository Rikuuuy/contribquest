// HTTP only: one GET to the contribution API, no cache.
import { API_BASE, FETCH_TIMEOUT_MS } from './constants';
import { dataError, ERROR_TEXT, type DataError, type DataErrorCode, type Result } from './errors';
import { parseApiResponse, type ParsedResponse } from './normalize';
import type { StorageLike } from './storage';

export type LoadDeps = {
  fetch: typeof globalThis.fetch;
  storage: StorageLike | null;
  now: () => number;
  timeoutMs?: number;
};

/** A transient error (network, timeout, 429, 5xx, bad JSON) may fall back to a stale cache entry. */
export type FetchError = DataError & { transient: boolean };

function failure(code: DataErrorCode, message: string, transient: boolean): Result<ParsedResponse, FetchError> {
  return { ok: false, error: { ...dataError(code, message), transient } };
}

export function profileUrl(username: string): string {
  return `${API_BASE}${encodeURIComponent(username)}?y=last`;
}

export async function fetchProfile(username: string, deps: LoadDeps): Promise<Result<ParsedResponse, FetchError>> {
  const doFetch = deps.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await doFetch(profileUrl(username), { signal: controller.signal });
    } catch {
      return failure('unavailable', ERROR_TEXT.unavailable, true);
    }
    if (res.status === 404) return failure('notfound', ERROR_TEXT.notfound(username), false);
    if (res.status === 429) return failure('ratelimit', ERROR_TEXT.ratelimit, true);
    if (!res.ok) return failure('unavailable', ERROR_TEXT.unavailable, true);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return failure('unavailable', ERROR_TEXT.unavailable, true);
    }
    const parsed = parseApiResponse(json);
    if (!parsed.ok) return { ok: false, error: { ...parsed.error, transient: false } };
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
