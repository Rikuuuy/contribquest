# Requirements: data-import

## Introduction

This spec covers everything between a username (or the demo button) and a validated `ContributionSet`: username validation, launch URL parameters, the fetch to the community contribution API with its timeout and error mapping, the Zod schema at the trust boundary, normalising to the 91-day window, the streak and year total, the 1-hour cache, the frozen demo dataset, the raid's second fetch, and the safe `localStorage` wrapper with the settings record.

Rules and numbers come from `prototype/index.html` (`USERNAME_RE`, `validateDays`, `computeStreak`, `buildSet`, `fetchLive`, `makeDemoSet`, `startUser`, the boot block) and `.kiro/steering/game-rules.md` ("Input data", "Demo dataset"). Rendering of the loading, error, and summary screens belongs to the presentation spec; this spec provides the data and the message text those screens show.

PRD IDs covered: FR-IMP-1 to FR-IMP-7, FR-DEM-1 to FR-DEM-3. Shared with the social spec (this spec owns the fetch side only): FR-SOC-1, FR-SOC-6. Shared with combat-timing (this spec owns storage only): FR-COM-7, FR-CLS-1.

## Glossary

- **API**: `https://github-contributions-api.jogruber.de/v4/<username>?y=last`, the community contribution API.
- **API response**: `{ total: { lastYear }, contributions: [{ date, count, level }] }`.
- **ContributionSet**: `{ username, source, fetchedAt, yearTotal, streak, days }` with `days` the 91-day window, oldest first.
- **Transient failure**: a network error, the 8 s timeout, malformed JSON, HTTP 429, or HTTP 5xx / any other non-OK status except 404.

## Requirements

### Requirement 1: Username input

**User story:** As a developer, I want my username checked before anything is sent, so that a typo gives me a clear message instead of a slow failure.

#### Acceptance criteria

1.1 WHEN the player submits a username THE SYSTEM SHALL trim surrounding whitespace and remove one leading `@` before validating it. [FR-IMP-1]

1.2 WHEN the cleaned username does not match `/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i` (1–39 characters, letters, digits, single inner hyphens) THE SYSTEM SHALL return the `invalid` error "That is not a valid GitHub username." and SHALL NOT send any request. [FR-IMP-1, FR-IMP-3]

1.3 WHEN a friend username is given and it fails the same rule THE SYSTEM SHALL return the `invalid` error "Your friend's username is not a valid GitHub username." and SHALL NOT send any request. [FR-IMP-1, FR-SOC-1]

1.4 WHEN a request is built THE SYSTEM SHALL insert the username with `encodeURIComponent`. [FR-IMP-1]

### Requirement 2: Loading state text

**User story:** As a player, I want to see whose graph is loading, so that I know the app is working.

#### Acceptance criteria

2.1 WHEN a single profile starts loading THE SYSTEM SHALL provide the loading text "Summoning {name}'s graph…". [FR-IMP-2]

2.2 WHEN a raid starts loading THE SYSTEM SHALL provide the loading text "Summoning {name} to raid {friend}'s graph…". [FR-IMP-2, FR-SOC-2]

2.3 WHILE a load is in progress THE SYSTEM SHALL expose a `loading` status, so the presentation layer never shows a blank screen. [FR-IMP-2]

### Requirement 3: Fetch, timeout, and error mapping

**User story:** As a player, I want every failure to tell me what went wrong and offer the demo, so that I can always play.

#### Acceptance criteria

3.1 WHEN a live profile is requested THE SYSTEM SHALL send one `GET` to `https://github-contributions-api.jogruber.de/v4/{encoded username}?y=last` with no `Authorization` header, cookie, or token. [FR-IMP-5]

3.2 WHEN the response has not arrived within 8000 ms THE SYSTEM SHALL abort the request and treat it as a transient failure. [FR-IMP-3]

3.3 WHEN the API answers HTTP 404 THE SYSTEM SHALL return the `notfound` error `No GitHub user called "{username}" was found.` [FR-IMP-3]

3.4 WHEN the API answers HTTP 429 THE SYSTEM SHALL return the `ratelimit` error "Too many summonings at once. Wait a few seconds and try again." [FR-IMP-3]

3.5 WHEN the API answers any other non-OK status, the network fails, the request times out, or the body is not JSON THE SYSTEM SHALL return the `unavailable` error "The contribution source is not answering right now." [FR-IMP-3]

3.6 WHEN any error is returned THE SYSTEM SHALL mark it as offering both retry and demo mode, and SHALL NOT throw past the `src/data` boundary. [FR-IMP-3, FR-DEM-2]

### Requirement 4: Schema validation and normalisation

**User story:** As the engine, I want only well-formed calendar data, so that map generation never sees a malformed day.

#### Acceptance criteria

4.1 WHEN an API response, a cache entry, or the demo file is read THE SYSTEM SHALL validate it with the same Zod day schema: `date` matches `YYYY-MM-DD`, `count` is a non-negative integer, `level` is one of 0–4. Unknown fields are dropped. [FR-DEM-3, P9]

4.2 WHEN `contributions` is not an array THE SYSTEM SHALL return the `bad` error "The data source returned something unexpected." [FR-IMP-3, P9]

4.3 WHEN any day fails the day schema THE SYSTEM SHALL return the `bad` error "The data source returned a day we could not read." [FR-IMP-3, P9]

4.4 WHEN the validated days are fewer than 91 THE SYSTEM SHALL return the `bad` error "Not enough calendar data to raise a map." [FR-IMP-3, FR-MAP-1]

4.5 WHEN days are valid THE SYSTEM SHALL sort them by date ascending and keep the last 91 as `days`. [FR-MAP-1]

4.6 WHEN `total.lastYear` is an integer THE SYSTEM SHALL use it as `yearTotal`; otherwise THE SYSTEM SHALL use the sum of all validated counts. [FR-IMP-4]

4.7 WHEN computing the streak THE SYSTEM SHALL use all validated days (not only the window), start at the last day, step back one day first if the last day's count is 0, and count back while `count > 0`. [FR-IMP-4]

4.8 WHEN a ContributionSet is built THE SYSTEM SHALL set `fetchedAt` from an injected clock, never from inside a pure function. [FR-IMP-4]

### Requirement 5: Hero-summary facts

**User story:** As a developer, I want the summary to show the numbers from my own graph, so that I can see my data become my hero.

#### Acceptance criteria

5.1 WHEN a ContributionSet is ready THE SYSTEM SHALL provide `username`, `avatarUrl` (`https://github.com/{encoded username}.png?size=24` for live and cache sources, `null` for demo, as in the prototype's `showSummary`), `source`, `total91` (sum of window counts), `yearTotal`, `streak`, and the window's first and last dates. Hero level, HP, ATK, and aura come from the progression spec. [FR-IMP-4, FR-MAP-1]

### Requirement 6: Launch parameters

**User story:** As a player opening a shared link, I want the link to start the right game.

#### Acceptance criteria

6.1 WHEN the URL has a `demo` parameter (with or without a value) THE SYSTEM SHALL start demo mode and ignore `u` and `vs`. [FR-IMP-6]

6.2 WHEN the URL has a non-empty `u` and no `demo` THE SYSTEM SHALL start loading that profile, with `vs` as the friend if present. [FR-IMP-6, FR-SOC-1]

6.3 WHEN the URL has only a non-empty `vs` THE SYSTEM SHALL return a `challenge` launch carrying the friend name, for the social spec to pre-fill. [FR-IMP-6, FR-SOC-3]

6.4 WHEN the URL has none of these THE SYSTEM SHALL return a `none` launch. [FR-IMP-6]

### Requirement 7: One-hour cache

**User story:** As a player who reloads, I want my graph to load instantly and to survive a short API outage.

#### Acceptance criteria

7.1 WHEN a live fetch succeeds THE SYSTEM SHALL store `{ at, days, total }` under `cq:v1:cache:{lowercase username}`, where `days` are the validated days and `total` is the integer `lastYear` or absent. The raw API payload is never stored. [FR-IMP-7]

7.2 WHEN a cache entry exists, passes the schema, and `now − at < 3600000` THE SYSTEM SHALL return it with `source: "cache"` and SHALL NOT send a request. [FR-IMP-7]

7.3 WHEN the cache entry is stale and the live fetch ends in a transient failure THE SYSTEM SHALL return the stale entry with `source: "cache"` instead of the error. [FR-IMP-7]

7.4 WHEN the live fetch returns `notfound` or `bad` THE SYSTEM SHALL return that error even if a stale entry exists. [FR-IMP-7, FR-IMP-3]

7.5 WHEN a cache entry fails the schema or `localStorage` throws THE SYSTEM SHALL treat the cache as empty and continue. [FR-IMP-7, P9]

### Requirement 8: Demo mode

**User story:** As a judge or demo viewer, I want to play without an account or a network.

#### Acceptance criteria

8.1 WHEN demo mode starts THE SYSTEM SHALL load the frozen `src/data/demo-data.json` and SHALL NOT call `fetch`. [FR-DEM-1]

8.2 WHEN the demo file is loaded THE SYSTEM SHALL parse it with the same API-response schema and normalisation as live data, giving username `demo-necromancer`, `source: "demo"`, `yearTotal` 1287, 91 days from 2026-08-18 to 2026-11-16, and a streak of 15. [FR-DEM-3, P9]

8.3 WHEN `scripts/make-demo-data.ts` runs THE SYSTEM SHALL produce exactly the prototype's `makeDemoSet` days (algorithm in `game-rules.md`, "Demo dataset"), including the empty week at indexes 12–18, level 0 at index 75, the 15-day streak from index 76, and index 77 overwritten with count 31, level 4. [FR-DEM-1, FR-DEM-2]

8.4 WHEN any load fails THE SYSTEM SHALL keep demo mode available as the fallback, so tests, the video backup take, and judges can always play. [FR-DEM-2]

### Requirement 9: Raid fetch

**User story:** As a player raiding a friend's graph, I want both profiles loaded with the same care as one.

#### Acceptance criteria

9.1 WHEN a friend is given and differs from the player's name ignoring case THE SYSTEM SHALL load both profiles in parallel through the same cache and fetch path, returning the friend's set as `set` (map owner) and the player's set as `heroSet`. [FR-SOC-1, FR-SOC-6]

9.2 WHEN the friend name equals the player's name ignoring case THE SYSTEM SHALL load one profile and return `heroSet: null` (a normal run). [FR-SOC-1]

9.3 WHEN either profile fails THE SYSTEM SHALL return that profile's error, with demo mode offered. [FR-SOC-6, FR-IMP-3]

### Requirement 10: Storage and settings

**User story:** As a player, I want my options remembered, and I never want a full or blocked storage to break the game.

#### Acceptance criteria

10.1 WHEN any `localStorage` read or write throws, or a stored value is not valid JSON THE SYSTEM SHALL return the default (`null` for reads) and SHALL NOT throw. [FR-IMP-7, FR-COM-7]

10.2 WHEN settings are read from `cq:v1:settings` THE SYSTEM SHALL merge them over the defaults `{ calm: false, assist: false, mute: false, heroClass: "wanderer", heroRace: "human" }`, and SHALL replace an unknown `heroClass` or `heroRace` with its default. [FR-COM-7, FR-CLS-1]

10.3 WHEN a setting changes THE SYSTEM SHALL write the whole settings record to `cq:v1:settings`. [FR-COM-7, FR-CLS-1]
