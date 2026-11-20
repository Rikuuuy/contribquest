# Design: data-import

## Overview

`src/data` is the only module that touches the network or `localStorage`. It turns a username, a launch URL, or the demo button into a validated `ContributionSet`, or into a `DataError` with a readable message. Nothing past this boundary throws because of bad input.

```
launch URL / form ──► username.ts (clean, validate)
                         │
                         ▼
                    load.ts ── cache.ts (cq:v1:cache:<lower>, 1 h)
                         │         ▲
                         ▼         │ store validated days
                    fetch.ts ── HTTP GET, 8 s abort, status → DataError
                         │
                         ▼
                    schema.ts (Zod) ──► normalize.ts (sort, window, streak, yearTotal)
                         │
                         ▼
                 Result<ContributionSet, DataError> ──► mapgen
demo.ts ── demo-data.json ──► schema.ts ──► normalize.ts (same path, no fetch)
```

Dependency rule (`structure.md`): `src/data` imports nothing from `mapgen`, `engine`, `render`, or `audio`. `scripts/make-demo-data.ts` may import `src/mapgen/rng.ts` for the hash and RNG.

## Module files

| File | Contents |
| --- | --- |
| `src/data/constants.ts` | `WINDOW = 91`, `CACHE_TTL_MS = 3_600_000`, `FETCH_TIMEOUT_MS = 8000`, `API_BASE = "https://github-contributions-api.jogruber.de/v4/"`, `USERNAME_RE`, storage keys |
| `src/data/errors.ts` | `DataError` type, `ERROR_TEXT`, `dataError()` |
| `src/data/schema.ts` | Zod schemas and inferred types |
| `src/data/normalize.ts` | `parseApiResponse`, `computeStreak`, `buildSet`, `profileFacts` (pure) |
| `src/data/username.ts` | `cleanUsername`, `validateUsername` (pure) |
| `src/data/launch.ts` | `parseLaunch(search)` (pure) |
| `src/data/storage.ts` | `StorageLike`, `readJson`, `writeJson`, `removeKey` (never throw) |
| `src/data/settings.ts` | `Settings`, `DEFAULT_SETTINGS`, `loadSettings`, `saveSettings` |
| `src/data/cache.ts` | `readCache`, `writeCache` |
| `src/data/fetch.ts` | `fetchProfile` (HTTP only, no cache) |
| `src/data/load.ts` | `loadProfile`, `loadRun`, `loadingText` (cache + fetch + fallback, raid in parallel) |
| `src/data/demo.ts` | `loadDemo()` from `demo-data.json` |
| `src/data/demo-data.json` | Frozen API-shaped demo response (generated once, never edited by hand) |
| `scripts/make-demo-data.ts` | Port of the prototype's `makeDemoSet`, writes `demo-data.json` |

## Types

```ts
// schema.ts
export const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const ContributionDaySchema = z.object({
  date: DateString,
  count: z.number().int().nonnegative(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
}); // unknown keys are stripped (Zod default)
export type ContributionDay = z.infer<typeof ContributionDaySchema>;

// The API response. `total` is read leniently: only an integer `lastYear` is used.
export const ApiResponseSchema = z.object({
  total: z.unknown().optional(),
  contributions: z.unknown(),          // checked in two stages for the two prototype messages
});

export const SourceSchema = z.enum(["live", "cache", "demo"]);
export const ContributionSetSchema = z.object({
  username: z.string(),
  source: SourceSchema,
  fetchedAt: z.string(),               // ISO timestamp
  yearTotal: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  days: z.array(ContributionDaySchema).length(91),
});
export type ContributionSet = z.infer<typeof ContributionSetSchema>;

export const CacheEntrySchema = z.object({
  at: z.number(),
  days: z.array(ContributionDaySchema).min(91),
  total: z.number().int().optional(),
});
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

// errors.ts
export type DataErrorCode = "invalid" | "notfound" | "ratelimit" | "unavailable" | "bad";
export type DataError = { code: DataErrorCode; message: string; retry: true; demo: true };
export type Result<T, E = DataError> = { ok: true; value: T } | { ok: false; error: E };

// launch.ts
export type Launch =
  | { kind: "demo" }
  | { kind: "user"; username: string; friend: string | null }
  | { kind: "challenge"; friend: string }
  | { kind: "none" };

// settings.ts
export type Settings = { calm: boolean; assist: boolean; mute: boolean; heroClass: ClassId; heroRace: RaceId };
// ClassId = "wanderer" | "knight" | "rogue" | "mage"; RaceId = "human" | "elf" | "orc" | "skeleton" | "vampire".
// Both id lists are declared in src/data/schema.ts as Zod enums, so data stays left of engine.

// load.ts
export type LoadDeps = {
  fetch: typeof globalThis.fetch;
  storage: StorageLike | null;   // null when localStorage is unavailable
  now: () => number;             // Date.now in the browser, fixed in tests
  timeoutMs?: number;            // defaults to FETCH_TIMEOUT_MS
};
export type RunData = { set: ContributionSet; heroSet: ContributionSet | null };
export type ProfileFacts = {
  username: string; source: ContributionSet["source"]; avatarUrl: string | null;
  total91: number; yearTotal: number; streak: number; firstDate: string; lastDate: string;
};
```

`ERROR_TEXT` holds the prototype strings exactly:

| Code | Message |
| --- | --- |
| `invalid` | "That is not a valid GitHub username." (friend: "Your friend's username is not a valid GitHub username.") |
| `notfound` | `No GitHub user called "{username}" was found.` |
| `ratelimit` | "Too many summonings at once. Wait a few seconds and try again." |
| `unavailable` | "The contribution source is not answering right now." |
| `bad` | "The data source returned something unexpected." / "The data source returned a day we could not read." / "Not enough calendar data to raise a map." |

Map validation errors (`map`) are defined by the map-generation spec with the same `{ code, message, retry, demo }` shape.

## Function signatures

```ts
// username.ts
export function cleanUsername(raw: string): string;                      // trim, drop one leading "@"
export function validateUsername(raw: string, who?: "self" | "friend"): Result<string>;

// launch.ts
export function parseLaunch(search: string): Launch;                     // URLSearchParams; demo > u > vs > none

// normalize.ts
export function parseApiResponse(json: unknown): Result<{ days: ContributionDay[]; total?: number }>;
export function computeStreak(all: readonly ContributionDay[]): number;
export function buildSet(username: string, source: ContributionSet["source"], all: readonly ContributionDay[],
                         total: number | undefined, fetchedAt: string): ContributionSet;
export function profileFacts(set: ContributionSet): ProfileFacts;

// storage.ts
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readJson(storage: StorageLike | null, key: string): unknown | null;
export function writeJson(storage: StorageLike | null, key: string, value: unknown): void;
export function removeKey(storage: StorageLike | null, key: string): void;

// settings.ts
export function loadSettings(storage: StorageLike | null): Settings;
export function saveSettings(storage: StorageLike | null, s: Settings): void;

// cache.ts
export function cacheKey(username: string): string;                     // "cq:v1:cache:" + lowercase
export function readCache(storage: StorageLike | null, username: string): CacheEntry | null;
export function writeCache(storage: StorageLike | null, username: string, e: CacheEntry): void;

// fetch.ts
export function fetchProfile(username: string, deps: LoadDeps):
  Promise<Result<{ days: ContributionDay[]; total?: number }, DataError & { transient: boolean }>>;

// load.ts
export function loadingText(name: string, friend: string | null): string;
export function loadProfile(username: string, deps: LoadDeps): Promise<Result<ContributionSet>>;
export function loadRun(rawName: string, rawFriend: string | null, deps: LoadDeps): Promise<Result<RunData>>;

// demo.ts
export function loadDemo(now: () => number): ContributionSet;            // throws only if the frozen file is broken (a build bug)
```

## Behaviour details

- **`fetchProfile`** creates an `AbortController`, aborts after `timeoutMs`, and always clears the timer. Status 404 → `notfound` (not transient). 429 → `ratelimit` (transient). Other non-OK → `unavailable` (transient). A thrown fetch (network, abort) or a failing `res.json()` → `unavailable` (transient). `parseApiResponse` failures → `bad` (not transient). The request is `fetch(url, { signal })` with no other options.
- **`loadProfile`** follows the prototype's `fetchLive`: read the cache; if fresh (`now − at < CACHE_TTL_MS`) return it as `cache`. Otherwise fetch. On success, write `{ at: now(), days, total }` and return `live`. On a transient failure with any cache entry, return the entry as `cache`. Otherwise return the error.
- **`parseApiResponse`** first checks `Array.isArray(contributions)`, then parses each day (first failure → "a day we could not read"), sorts by date, then checks `length ≥ 91`. `total` is `total.lastYear` when it is an integer.
- **`buildSet`** takes the full validated list: `streak = computeStreak(all)`, `yearTotal = total ?? sum(all)`, `days = all.slice(-91)`.
- **`loadRun`** validates both names first (no request on an invalid name). If the friend is present and differs ignoring case, it runs `Promise.all([loadProfile(name), loadProfile(friend)])`; the first failing result is returned. The friend's set becomes `set` and the player's becomes `heroSet`.
- **`loadDemo`** imports `demo-data.json` (`{ total: { lastYear: 1287 }, contributions: [91 days] }`), runs `parseApiResponse` and `buildSet("demo-necromancer", "demo", …)`. No `fetch` reference exists in `demo.ts`.
- **`scripts/make-demo-data.ts`** ports `makeDemoSet` line for line, using `fnv1a` and `makeRng` from `src/mapgen/rng.ts` and UTC date arithmetic, and writes the API-shaped JSON. It runs once; afterwards a test guards the file against drift.
- **Storage** wrappers wrap every `getItem`, `setItem`, `JSON.parse`, and `JSON.stringify` in `try`/`catch`. `main.ts` passes `window.localStorage` inside its own `try`, or `null` if access throws.

## Testing

| Test file | Checks |
| --- | --- |
| `tests/data/username.test.ts` | Valid and invalid names (empty, 40 chars, leading/trailing/double hyphen, `@` prefix, whitespace), friend message. FR-IMP-1 |
| `tests/data/launch.test.ts` | `?demo`, `?demo=1`, `?u=x`, `?u=x&vs=y`, `?vs=y`, empty, `?demo&u=x`. FR-IMP-6 |
| `tests/data/normalize.test.ts` | Sorting, window slicing, `yearTotal` fallback, streak cases (last day 0, all zero, full year), the three `bad` messages. FR-IMP-3, FR-IMP-4 |
| `tests/data/schema.prop.test.ts` | **P9:** fixtures and demo data pass; fast-check payloads with a mutated field (wrong date format, negative or fractional count, level 5, missing field, non-array) are rejected as `bad` and never throw |
| `tests/data/fetch.test.ts` | Mocked `fetch`: 200, 404, 429, 500, network error, timeout (fake timers, 8000 ms abort), malformed JSON, no `Authorization` header, encoded URL. FR-IMP-3, FR-IMP-5 |
| `tests/data/cache.test.ts` | Fresh hit (no fetch), stale + 500 → cache, stale + 404 → error, corrupt entry ignored, throwing storage, key lowercase. FR-IMP-7 |
| `tests/data/load.test.ts` | Raid in parallel (both mocks called before either resolves), same-name raid is a normal run, failure on either side, loading text. FR-SOC-1, FR-SOC-6, FR-IMP-2 |
| `tests/data/demo.test.ts` | No `fetch` call, 91 days, dates 2026-08-18 to 2026-11-16, streak 15, yearTotal 1287, index 77 is 31/level 4, and the JSON equals a fresh run of the generator. FR-DEM-1, FR-DEM-3 |
| `tests/data/settings.test.ts` | Defaults, merge, unknown class or race replaced, throwing storage. FR-COM-7, FR-CLS-1 |

Fixtures in `tests/fixtures/api/`: API-shaped responses for the PRD fixture profiles (all-empty, single active day, very dense, best day first, best day last, last day 0, last date on Saturday, last date on Sunday), built by `tests/fixtures/profiles.ts` so they need no network. If a recorded live response is added later, it goes in the same folder and joins P9.

No test touches the network; `fetch` is always injected.

## Properties owned

| Property | Statement |
| --- | --- |
| P9 | Live-shaped fixtures and demo data both pass the schema; random malformed payloads are rejected, never thrown past the boundary |

## Out of scope here

The loading, error, and summary screens (presentation), the challenge-link prompt and raid titles (social), the run save and trophy keys (progression), and the map date-range label (map-generation provides the dates, presentation draws them).
