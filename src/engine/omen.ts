// The daily omen (prototype newRun, enterMap).
import type { ContributionSet } from '../data/schema';
import { offerRelic } from './relics';
import type { Omen, RunState } from './state';

/** Blessed when today's tile (the hero set's last day) has at least one contribution. */
export function omenFor(heroSet: ContributionSet): Omen {
  const today = heroSet.days[heroSet.days.length - 1];
  return today && today.count > 0 ? 'blessed' : 'cursed';
}

/** The omen line logged at run start (requirement 7.3). */
export function omenLog(omen: Omen, heroName: string): string {
  return omen === 'blessed'
    ? `Commit Blessing: ${heroName} contributed today, so a relic awaits.`
    : 'Uncommitted Curse: no contributions today, so monsters hit 15% harder. Commit to lift it.';
}

export const BLESSING_TITLE = 'Commit Blessing: you contributed today. Choose a relic.';

/** The map screen opened: a pending blessing becomes due once (main.ts sends `offerBlessing` after the delay). */
export function enterMap(s: RunState): void {
  if (!s.pendingBlessing || s.status !== 'exploring') return;
  s.pendingBlessing = false;
  s.events.push({ type: 'blessingDue' });
}

/** The delayed blessing offer; nothing happens if the hero is no longer exploring. */
export function offerBlessing(s: RunState): void {
  if (s.status !== 'exploring') return;
  offerRelic(s, BLESSING_TITLE);
}
