// Races (prototype RACES, chooseRace).
import { RaceIdSchema, type RaceId } from '../data/schema';
import { applyStats } from './classes';
import type { RunState } from './state';

/** Name, passive text, speech lines, and the face colours and flags used by presentation. */
export type RaceInfo = {
  name: string;
  text: string;
  lines: [string, string];
  skin: [string, string];
  eye: string;
  mouth: string;
  ears?: true;
  tusks?: true;
  teeth?: true;
  fangs?: true;
  /** rgba() with `A` standing for the alpha, as in the prototype. */
  glow?: string;
};

export const RACE_INFO: Readonly<Record<RaceId, RaceInfo>> = {
  human: {
    name: 'Human',
    skin: ['#f2c79b', '#d6a274'],
    eye: '#1a1a24',
    mouth: '#9a5a48',
    text: 'Adaptable: +10% XP from everything.',
    lines: ['Coffee first, then commits.', 'Just one more feature.'],
  },
  elf: {
    name: 'Elf',
    skin: ['#f7e0c4', '#dcbc98'],
    eye: '#2fa86b',
    mouth: '#a8685a',
    ears: true,
    text: 'Keen Eyes: the Perfect timing window is 15 ms wider.',
    lines: ['I can see your off-by-one from here.', 'Tabs. Always tabs.'],
  },
  orc: {
    name: 'Orc',
    skin: ['#7fae5a', '#5c8a3e'],
    eye: '#ffcf3a',
    mouth: '#3d5a28',
    tusks: true,
    glow: 'rgba(255,207,58,A)',
    text: 'Brute: +2 ATK.',
    lines: ['SMASH THE BUGS!', 'Me no read docs.'],
  },
  skeleton: {
    name: 'Skeleton',
    skin: ['#ebe6d6', '#b9b3a0'],
    eye: '#ff6a2a',
    mouth: '#2a2420',
    teeth: true,
    glow: 'rgba(255,106,42,A)',
    text: 'Undying: once per run, a lethal hit leaves you at 1 HP.',
    lines: ['I came back for the bugs.', 'Legacy code? I AM legacy.'],
  },
  vampire: {
    name: 'Vampire',
    skin: ['#e6e1f0', '#c2b9d6'],
    eye: '#e0263c',
    mouth: '#5a1020',
    fangs: true,
    glow: 'rgba(224,38,60,A)',
    text: 'Bloodthirst: every critical hit heals 2 HP.',
    lines: ['I only code after midnight.', 'Your commits look... delicious.'],
  },
};

/** Race display names (kept for existing callers). */
export const RACE_NAMES: Readonly<Record<RaceId, string>> = {
  human: RACE_INFO.human.name,
  elf: RACE_INFO.elf.name,
  orc: RACE_INFO.orc.name,
  skeleton: RACE_INFO.skeleton.name,
  vampire: RACE_INFO.vampire.name,
};

/** Sets the race before the first step, recomputes stats, and heals to full. Returns false when refused. */
export function chooseRace(s: Pick<RunState, 'hero' | 'stats' | 'events'>, race: RaceId): boolean {
  if (s.stats.steps > 0 || !RaceIdSchema.safeParse(race).success) return false;
  s.hero.race = race;
  applyStats(s.hero);
  s.hero.hp = s.hero.maxHp;
  s.events.push({ type: 'raceChosen', race });
  return true;
}
