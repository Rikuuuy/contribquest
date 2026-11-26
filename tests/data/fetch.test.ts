import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProfile, type LoadDeps } from '../../src/data/fetch';
import { apiResponse } from '../fixtures/profiles';

type FetchArgs = Parameters<typeof globalThis.fetch>;

function deps(impl: (...args: FetchArgs) => Promise<Response>): LoadDeps & { fetch: ReturnType<typeof vi.fn> } {
  return { fetch: vi.fn(impl), storage: null, now: () => 0 };
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
const year = apiResponse(Array.from({ length: 366 }, (_, i) => i % 4));

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchProfile', () => {
  it('FR-IMP-5: 200 returns the validated days and total', async () => {
    const d = deps(async () => json(year));
    const r = await fetchProfile('octocat', d);
    expect(r).toEqual({ ok: true, value: { days: year.contributions, total: year.total.lastYear } });
  });

  it('FR-IMP-1, FR-IMP-5: one GET to the encoded URL with only a signal, no auth', async () => {
    const d = deps(async () => json(year));
    await fetchProfile('a b/c', d);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = d.fetch.mock.calls[0] as FetchArgs;
    expect(url).toBe('https://github-contributions-api.jogruber.de/v4/a%20b%2Fc?y=last');
    expect(Object.keys(init ?? {})).toEqual(['signal']);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.headers).toBeUndefined();
    expect(init?.credentials).toBeUndefined();
  });

  it('FR-IMP-3: 404 is notfound and not transient', async () => {
    const r = await fetchProfile('ghost', deps(async () => new Response('', { status: 404 })));
    expect(r).toEqual({
      ok: false,
      error: { code: 'notfound', message: 'No GitHub user called "ghost" was found.', retry: true, demo: true, transient: false },
    });
  });

  it('FR-IMP-3: 429 is ratelimit and transient', async () => {
    const r = await fetchProfile('x', deps(async () => new Response('', { status: 429 })));
    expect(r).toEqual({
      ok: false,
      error: {
        code: 'ratelimit',
        message: 'Too many summonings at once. Wait a few seconds and try again.',
        retry: true,
        demo: true,
        transient: true,
      },
    });
  });

  it('FR-IMP-3: 500 and other non-OK statuses are unavailable and transient', async () => {
    for (const status of [500, 502, 503, 403, 418]) {
      const r = await fetchProfile('x', deps(async () => new Response('', { status })));
      expect(r).toEqual({
        ok: false,
        error: { code: 'unavailable', message: 'The contribution source is not answering right now.', retry: true, demo: true, transient: true },
      });
    }
  });

  it('FR-IMP-3: a network error is unavailable and transient', async () => {
    const r = await fetchProfile('x', deps(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'unavailable', transient: true });
  });

  it('FR-IMP-3: malformed JSON is unavailable and transient', async () => {
    const r = await fetchProfile('x', deps(async () => new Response('{not json', { status: 200 })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'unavailable', transient: true });
  });

  it('FR-IMP-3: a schema failure is bad and not transient', async () => {
    const r = await fetchProfile('x', deps(async () => json({ contributions: 'nope' })));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatchObject({ code: 'bad', message: 'The data source returned something unexpected.', transient: false });
    }
  });

  it('FR-IMP-3: aborts after 8000 ms and reports unavailable', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const d = deps(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = fetchProfile('slow', d);
    await vi.advanceTimersByTimeAsync(7999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    const r = await pending;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'unavailable', transient: true });
  });

  it('FR-IMP-3: clears the timer after a response', async () => {
    vi.useFakeTimers();
    await fetchProfile('x', deps(async () => json(year)));
    expect(vi.getTimerCount()).toBe(0);
  });
});
