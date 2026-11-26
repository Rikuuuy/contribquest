// Cache + fetch + fallback, and the raid's parallel load.
import { CACHE_TTL_MS } from './constants';
import { readCache, writeCache } from './cache';
import type { Result } from './errors';
import { fetchProfile, type LoadDeps } from './fetch';
import { buildSet } from './normalize';
import type { ContributionSet } from './schema';
import { cleanUsername, validateUsername } from './username';

export type { LoadDeps } from './fetch';

/** `set` owns the map; `heroSet` is the raiding player's own graph, or null for a normal run. */
export type RunData = { set: ContributionSet; heroSet: ContributionSet | null };

export function loadingText(name: string, friend: string | null): string {
  return friend ? `Summoning ${name} to raid ${friend}'s graph…` : `Summoning ${name}'s graph…`;
}

/** Loads one validated username: fresh cache, else live (and cache it), else stale cache on transient errors. */
export async function loadProfile(username: string, deps: LoadDeps): Promise<Result<ContributionSet>> {
  const stamp = (): string => new Date(deps.now()).toISOString();
  const cached = readCache(deps.storage, username);
  if (cached && deps.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, value: buildSet(username, 'cache', cached.days, cached.total, stamp()) };
  }
  const res = await fetchProfile(username, deps);
  if (res.ok) {
    const { days, total } = res.value;
    writeCache(deps.storage, username, total === undefined ? { at: deps.now(), days } : { at: deps.now(), days, total });
    return { ok: true, value: buildSet(username, 'live', days, total, stamp()) };
  }
  if (cached && res.error.transient) {
    return { ok: true, value: buildSet(username, 'cache', cached.days, cached.total, stamp()) };
  }
  const { transient: _transient, ...error } = res.error;
  return { ok: false, error };
}

/** Validates both names, then loads one profile or, for a raid, both in parallel. */
export async function loadRun(rawName: string, rawFriend: string | null, deps: LoadDeps): Promise<Result<RunData>> {
  const name = validateUsername(rawName, 'self');
  if (!name.ok) return name;
  const friendRaw = rawFriend === null ? '' : cleanUsername(rawFriend);
  let friend: string | null = null;
  if (friendRaw) {
    const checked = validateUsername(friendRaw, 'friend');
    if (!checked.ok) return checked;
    friend = checked.value;
  }

  if (friend !== null && friend.toLowerCase() !== name.value.toLowerCase()) {
    const [mine, theirs] = await Promise.all([loadProfile(name.value, deps), loadProfile(friend, deps)]);
    if (!mine.ok) return mine;
    if (!theirs.ok) return theirs;
    return { ok: true, value: { set: theirs.value, heroSet: mine.value } };
  }
  const mine = await loadProfile(name.value, deps);
  if (!mine.ok) return mine;
  return { ok: true, value: { set: mine.value, heroSet: null } };
}
