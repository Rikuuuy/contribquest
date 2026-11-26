// Data-import constants, ported from prototype/index.html.

/** Days in the map window (13 weeks). */
export const WINDOW = 91;

/** A cache entry younger than this is used without a request. */
export const CACHE_TTL_MS = 3_600_000;

/** A request that has not answered after this long is aborted. */
export const FETCH_TIMEOUT_MS = 8000;

/** Community contribution API. The encoded username and `?y=last` follow. */
export const API_BASE = 'https://github-contributions-api.jogruber.de/v4/';

/** 1–39 characters: letters, digits, and single inner hyphens. */
export const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** localStorage keys. Read and written only in src/data. */
export const SETTINGS_KEY = 'cq:v1:settings';
export const CACHE_KEY_PREFIX = 'cq:v1:cache:';
export const RUN_KEY = 'cq:v1:run';
export const TROPHIES_KEY = 'cq:v1:trophies';
export const CLASSWINS_KEY = 'cq:v1:classwins';
