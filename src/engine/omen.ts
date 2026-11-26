// The daily omen (prototype newRun, enterMap). `enterMap` and `offerBlessing` come with progression group 6.
import type { ContributionSet } from '../data/schema';
import type { Omen } from './state';

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
