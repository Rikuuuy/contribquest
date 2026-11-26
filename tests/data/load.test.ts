import { describe, expect, it, vi } from 'vitest';
import type { LoadDeps } from '../../src/data/fetch';
import { loadingText, loadRun } from '../../src/data/load';
import { apiResponse } from '../fixtures/profiles';
import { memoryStorage } from '../fixtures/storage';

type FetchArgs = Parameters<typeof globalThis.fetch>;
const NOW = Date.UTC(2026, 10, 16, 12);

const mine = apiResponse(Array.from({ length: 366 }, () => 1));
const theirs = apiResponse(Array.from({ length: 366 }, () => 9));
const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

/** Routes by username in the URL. */
function router(routes: Record<string, () => Response>) {
  return vi.fn(async (...[url]: FetchArgs) => {
    const name = decodeURIComponent(String(url).split('/v4/')[1]!.split('?')[0]!);
    const route = routes[name.toLowerCase()];
    return route ? route() : new Response('', { status: 404 });
  });
}

function deps(fetch: LoadDeps['fetch']): LoadDeps {
  return { fetch, storage: memoryStorage(), now: () => NOW };
}

describe('loadRun', () => {
  it('FR-SOC-6: both requests start before either resolves', async () => {
    const resolvers: (() => void)[] = [];
    const fetch = vi.fn(
      (...[url]: FetchArgs) =>
        new Promise<Response>((resolve) => {
          resolvers.push(() => resolve(ok(String(url).includes('/me?') ? mine : theirs)));
        }),
    );
    const pending = loadRun('me', 'pal', deps(fetch));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(2);
    resolvers.forEach((r) => r());
    const r = await pending;
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.set.username).toBe('pal');
      expect(r.value.set.days).toEqual(theirs.contributions.slice(-91));
      expect(r.value.heroSet?.username).toBe('me');
      expect(r.value.heroSet?.days).toEqual(mine.contributions.slice(-91));
    }
  });

  it('FR-SOC-1: the same name ignoring case is a normal run', async () => {
    const fetch = router({ me: () => ok(mine) });
    const r = await loadRun('Me', 'mE', deps(fetch));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r.ok && r.value.heroSet).toBeNull();
    expect(r.ok && r.value.set.username).toBe('Me');
  });

  it('FR-IMP-1: no friend, an empty friend, or a whitespace friend is a normal run', async () => {
    for (const friend of [null, '', '   ']) {
      const fetch = router({ me: () => ok(mine) });
      const r = await loadRun(' @me ', friend, deps(fetch));
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(r.ok && r.value.heroSet).toBeNull();
      expect(r.ok && r.value.set.username).toBe('me');
    }
  });

  it('FR-SOC-6: a failure on the player side is returned with demo offered', async () => {
    const fetch = router({ pal: () => ok(theirs) });
    const r = await loadRun('me', 'pal', deps(fetch));
    expect(r).toEqual({
      ok: false,
      error: { code: 'notfound', message: 'No GitHub user called "me" was found.', retry: true, demo: true },
    });
  });

  it('FR-SOC-6: a failure on the friend side is returned with demo offered', async () => {
    const fetch = router({ me: () => ok(mine), pal: () => new Response('', { status: 503 }) });
    const r = await loadRun('me', 'pal', deps(fetch));
    expect(r).toEqual({
      ok: false,
      error: { code: 'unavailable', message: 'The contribution source is not answering right now.', retry: true, demo: true },
    });
  });

  it('FR-IMP-1: an invalid player name sends no request', async () => {
    const fetch = router({});
    const r = await loadRun('bad--name', 'pal', deps(fetch));
    expect(fetch).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'invalid', message: 'That is not a valid GitHub username.' });
  });

  it('FR-SOC-1: an invalid friend name sends no request', async () => {
    const fetch = router({ me: () => ok(mine) });
    const r = await loadRun('me', '-pal', deps(fetch));
    expect(fetch).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'invalid', message: "Your friend's username is not a valid GitHub username." });
  });

  it('FR-IMP-2: loading texts for a single profile and a raid', () => {
    expect(loadingText('me', null)).toBe("Summoning me's graph…");
    expect(loadingText('me', 'pal')).toBe("Summoning me to raid pal's graph…");
  });
});
