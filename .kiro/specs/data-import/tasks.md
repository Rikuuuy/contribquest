# Tasks: data-import

Build order: tasks 1–6 need only the scaffold. Task 7 needs `src/mapgen/rng.ts` (map-generation task 1.1). Each task ends with its verify command passing and a commit naming the requirement IDs.

- [ ] 1. Constants, errors, and schema
  - [ ] 1.1 Create `src/data/constants.ts` (`WINDOW`, `CACHE_TTL_MS`, `FETCH_TIMEOUT_MS`, `API_BASE`, `USERNAME_RE`, storage keys) and `src/data/errors.ts` (`DataError`, `Result`, `ERROR_TEXT` with the prototype strings)
    - _Requirements: 1.2, 3.3, 3.4, 3.5, 3.6 (FR-IMP-1, FR-IMP-3)_
    - _Verify: `npm run typecheck`_
  - [ ] 1.2 Create `src/data/schema.ts` with `ContributionDaySchema`, `ApiResponseSchema`, `ContributionSetSchema`, `CacheEntrySchema`, and the `ClassId` / `RaceId` enums; export inferred types
    - _Requirements: 4.1 (FR-DEM-3)_
    - _Verify: `npm run typecheck`_

- [ ] 2. Username and launch parameters
  - [ ] 2.1 Implement `cleanUsername` and `validateUsername` in `src/data/username.ts`
    - _Requirements: 1.1, 1.2, 1.3 (FR-IMP-1, FR-SOC-1)_
  - [ ] 2.2 Write `tests/data/username.test.ts` (valid, empty, 39 and 40 chars, leading/trailing/double hyphen, `@` prefix, whitespace, friend message)
    - _Requirements: 1.1, 1.2, 1.3_
    - _Verify: `npx vitest --run tests/data/username.test.ts`_
  - [ ] 2.3 Implement `parseLaunch` in `src/data/launch.ts` and write `tests/data/launch.test.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4 (FR-IMP-6, FR-SOC-3)_
    - _Verify: `npx vitest --run tests/data/launch.test.ts`_

- [ ] 3. Normalisation
  - [ ] 3.1 Implement `parseApiResponse`, `computeStreak`, `buildSet`, `profileFacts` in `src/data/normalize.ts`
    - _Requirements: 4.2–4.8, 5.1 (FR-IMP-3, FR-IMP-4, FR-MAP-1)_
  - [ ] 3.2 Write `tests/data/normalize.test.ts`: unsorted input, more than 91 days, exactly 90 days, `total.lastYear` missing or a string, streak with last day 0, all-zero year, streak across the window edge, avatar URL null for demo
    - _Requirements: 4.2–4.8, 5.1_
    - _Verify: `npx vitest --run tests/data/normalize.test.ts`_
  - [ ] 3.3 Add `tests/fixtures/profiles.ts` (API-shaped fixture builders for the PRD fixture profiles) and `tests/data/schema.prop.test.ts` for P9: fixtures pass; fast-check mutations are rejected with `ok: false` and never throw
    - _Requirements: 4.1–4.4 (FR-DEM-3, P9)_
    - _Verify: `npx vitest --run tests/data/schema.prop.test.ts`_

- [ ] 4. Storage, settings, and cache
  - [ ] 4.1 Implement `src/data/storage.ts` (`readJson`, `writeJson`, `removeKey`, all non-throwing) and `src/data/settings.ts` (`DEFAULT_SETTINGS`, `loadSettings`, `saveSettings`)
    - _Requirements: 10.1, 10.2, 10.3 (FR-COM-7, FR-CLS-1)_
  - [ ] 4.2 Write `tests/data/settings.test.ts` with a throwing storage stub and an in-memory stub
    - _Requirements: 10.1, 10.2, 10.3_
    - _Verify: `npx vitest --run tests/data/settings.test.ts`_
  - [ ] 4.3 Implement `cacheKey`, `readCache` (schema-checked), `writeCache` in `src/data/cache.ts`
    - _Requirements: 7.1, 7.5 (FR-IMP-7)_
    - _Verify: `npm run typecheck`_

- [ ] 5. Fetch and load
  - [ ] 5.1 Implement `fetchProfile` in `src/data/fetch.ts` (encoded URL, no auth, 8 s abort, status mapping, transient flag)
    - _Requirements: 1.4, 3.1–3.6 (FR-IMP-1, FR-IMP-3, FR-IMP-5)_
  - [ ] 5.2 Write `tests/data/fetch.test.ts` with mocked `fetch`: 200, 404, 429, 500, network error, timeout with fake timers, malformed JSON, header and URL checks
    - _Requirements: 1.4, 3.1–3.6_
    - _Verify: `npx vitest --run tests/data/fetch.test.ts`_
  - [ ] 5.3 Implement `loadProfile` and `loadingText` in `src/data/load.ts` (fresh cache, live + write, stale fallback on transient errors only)
    - _Requirements: 2.1, 2.3, 7.1–7.4 (FR-IMP-2, FR-IMP-7)_
  - [ ] 5.4 Write `tests/data/cache.test.ts`: fresh hit sends no request, stale + 500 returns `cache`, stale + 404 returns the error, corrupt entry ignored, key is lowercase, raw payload not stored
    - _Requirements: 7.1–7.5_
    - _Verify: `npx vitest --run tests/data/cache.test.ts`_

- [ ] 6. Raid load
  - [ ] 6.1 Implement `loadRun` in `src/data/load.ts` (validate both names, parallel load, same-name normal run, first error wins)
    - _Requirements: 2.2, 9.1, 9.2, 9.3 (FR-IMP-2, FR-SOC-1, FR-SOC-6)_
  - [ ] 6.2 Write `tests/data/load.test.ts`: both requests start before either resolves, case-insensitive same name, failure on each side, invalid friend sends no request, loading texts
    - _Requirements: 2.1, 2.2, 9.1–9.3_
    - _Verify: `npx vitest --run tests/data/load.test.ts`_

- [ ] 7. Demo dataset (needs `src/mapgen/rng.ts`)
  - [ ] 7.1 Write `scripts/make-demo-data.ts`, porting `makeDemoSet` exactly, and run it once to create `src/data/demo-data.json` in API shape (`total.lastYear` 1287)
    - _Requirements: 8.3 (FR-DEM-1, FR-DEM-2)_
    - _Verify: `npx tsx scripts/make-demo-data.ts && git diff --stat src/data/demo-data.json`_
  - [ ] 7.2 Implement `loadDemo` in `src/data/demo.ts` through `parseApiResponse` and `buildSet`
    - _Requirements: 8.1, 8.2, 8.4 (FR-DEM-1, FR-DEM-2, FR-DEM-3)_
  - [ ] 7.3 Write `tests/data/demo.test.ts`: `fetch` spy never called, 91 days from 2026-08-18 to 2026-11-16, streak 15, yearTotal 1287, index 77 is count 31 level 4, indexes 12–18 and 75 are level 0, and the file equals a fresh generator run; add the demo file to the P9 test
    - _Requirements: 8.1–8.3 (FR-DEM-1, FR-DEM-3, P9)_
    - _Verify: `npx vitest --run tests/data/demo.test.ts tests/data/schema.prop.test.ts`_

- [ ] 8. Module check
  - [ ] 8.1 Run the whole data suite and the type check; confirm `src/data` imports nothing from `src/mapgen`, `src/engine`, `src/render`, or `src/audio`
    - _Requirements: all (FR-IMP-1 to FR-IMP-7, FR-DEM-1 to FR-DEM-3)_
    - _Verify: `npm run typecheck && npx vitest --run tests/data && ! grep -rE "from ['\"]\.\./(mapgen|engine|render|audio)" src/data`_
