// Race display names (prototype RACES[].name). The progression spec adds the rest of RACE_INFO here.
import type { RaceId } from '../data/schema';

export const RACE_NAMES: Readonly<Record<RaceId, string>> = {
  human: 'Human',
  elf: 'Elf',
  orc: 'Orc',
  skeleton: 'Skeleton',
  vampire: 'Vampire',
};
