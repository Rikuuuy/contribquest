import { describe, expect, it, vi } from 'vitest';
import { cacheKey, readCache, writeCache } from '../../src/data/cache';
import type { LoadDeps } from '../../src/data/fetch';
import { loadingText, loadProfile } from '../../src/data/load';
import { apiResponse, daysFromCounts } from '../fixtures/profiles';
import { memoryStorage, throwingStorage, type MemoryStorage } from '../fixtures/storage';

const NOW = Date.UTC(2026, 10, 16, 12);
const HOUR = 3_600_000;
const live = apiResponse(Array.from({ length: 366 }, (_, i) => (i % 5) + 1));
const cachedDays = daysFromCounts(Array.from({ length: 120 }, () => 2));

function setup(response: () => Promise<Response>, storage: MemoryStorage | typeof throwingStorage = memoryStorage()) {
  const fetch = vi.fn(response);
  const deps: LoadDeps = { fetch, storage, now: () => NOW };
  return { fetch, deps, storage };
}

const ok = async (): Promise<Response> => new Response(JSON.stringify(live), { status: 200 });
const status = (code: number) => async (): Promise<Response> => new Response('', { status: code });

function seed(storage: MemoryStorage, name: string, at: number, total?: number): void {
  storage.data.set(cacheKey(name), JSON.stringify(total === undefined ? { at, days: cachedDays } : { at, days: cachedDays, total }));
}

describe('cache', () => {
  it('FR-IMP-7: the key is the lowercase username', () => {
    expect(cacheKey('OctoCat')).toBe('cq:v1:cache:octocat');
  });

  it('FR-IMP-7: a fresh entry is returned as cache and sends no request', async () => {
    const storage = memoryStorage();
    seed(storage, 'octocat', NOW - HOUR + 1, 500);
    const { fetch, deps } = setup(ok, storage);
    const r = await loadProfile('OctoCat', deps);
    expect(fetch).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe('cache');
      expect(r.value.yearTotal).toBe(500);
      expect(r.value.days).toEqual(cachedDays.slice(-91));
      expect(r.value.fetchedAt).toBe(new Date(NOW).toISOString());
    }
  });

  it('FR-IMP-7: an entry exactly one hour old is stale', async () => {
    const storage = memoryStorage();
    seed(storage, 'octocat', NOW - HOUR);
    const { fetch, deps } = setup(ok, storage);
    const r = await loadProfile('octocat', deps);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.ok && r.value.source).toBe('live');
  });

  it('FR-IMP-7: a live success writes validated days only, not the raw payload', async () => {
    const storage = memoryStorage();
    const raw = { ...live, extra: 'secret', contributions: live.contributions.map((d) => ({ ...d, color: '#39d353' })) };
    const { deps } = setup(async () => new Response(JSON.stringify(raw), { status: 200 }), storage);
    const r = await loadProfile('OctoCat', deps);
    expect(r.ok && r.value.source).toBe('live');
    const stored = JSON.parse(storage.data.get('cq:v1:cache:octocat')!);
    expect(Object.keys(stored).sort()).toEqual(['at', 'days', 'total']);
    expect(stored).toEqual({ at: NOW, days: live.contributions, total: live.total.lastYear });
  });

  it('FR-IMP-7: total is absent from the entry when lastYear is not an integer', async () => {
    const storage = memoryStorage();
    const { deps } = setup(async () => new Response(JSON.stringify({ contributions: live.contributions }), { status: 200 }), storage);
    await loadProfile('x', deps);
    expect('total' in JSON.parse(storage.data.get('cq:v1:cache:x')!)).toBe(false);
  });

  it('FR-IMP-7: stale entry + 500 returns the entry as cache', async () => {
    const storage = memoryStorage();
    seed(storage, 'x', NOW - 5 * HOUR, 42);
    const { fetch, deps } = setup(status(500), storage);
    const r = await loadProfile('x', deps);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe('cache');
      expect(r.value.yearTotal).toBe(42);
    }
  });

  it('FR-IMP-7: stale entry + 429 or network error returns the entry as cache', async () => {
    for (const response of [status(429), async (): Promise<Response> => Promise.reject(new TypeError('offline'))]) {
      const storage = memoryStorage();
      seed(storage, 'x', NOW - 5 * HOUR);
      const r = await loadProfile('x', setup(response, storage).deps);
      expect(r.ok && r.value.source).toBe('cache');
    }
  });

  it('FR-IMP-7: stale entry + 404 returns the error', async () => {
    const storage = memoryStorage();
    seed(storage, 'x', NOW - 5 * HOUR);
    const r = await loadProfile('x', setup(status(404), storage).deps);
    expect(r).toEqual({
      ok: false,
      error: { code: 'notfound', message: 'No GitHub user called "x" was found.', retry: true, demo: true },
    });
  });

  it('FR-IMP-7: stale entry + bad payload returns the error', async () => {
    const storage = memoryStorage();
    seed(storage, 'x', NOW - 5 * HOUR);
    const { deps } = setup(async () => new Response(JSON.stringify({ contributions: [] }), { status: 200 }), storage);
    const r = await loadProfile('x', deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('bad');
  });

  it('FR-IMP-7: no cache + 500 returns the error without a transient flag', async () => {
    const r = await loadProfile('x', setup(status(500)).deps);
    expect(r).toEqual({
      ok: false,
      error: { code: 'unavailable', message: 'The contribution source is not answering right now.', retry: true, demo: true },
    });
  });

  it('P9, FR-IMP-7: a corrupt entry is ignored', async () => {
    for (const value of ['{oops', JSON.stringify({ at: NOW, days: 'x' }), JSON.stringify({ at: NOW, days: cachedDays.slice(0, 10) })]) {
      const storage = memoryStorage({ 'cq:v1:cache:x': value });
      expect(readCache(storage, 'x')).toBeNull();
      const { fetch, deps } = setup(ok, storage);
      const r = await loadProfile('x', deps);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(r.ok && r.value.source).toBe('live');
    }
  });

  it('FR-IMP-7: a throwing storage behaves as an empty cache', async () => {
    const { fetch, deps } = setup(ok, throwingStorage);
    const r = await loadProfile('x', deps);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.ok && r.value.source).toBe('live');
    expect(() => writeCache(throwingStorage, 'x', { at: 0, days: cachedDays })).not.toThrow();
  });

  it('FR-IMP-2: single-profile loading text', () => {
    expect(loadingText('octocat', null)).toBe("Summoning octocat's graph…");
  });
});
