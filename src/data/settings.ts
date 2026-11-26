import { SETTINGS_KEY } from './constants';
import { ClassIdSchema, RaceIdSchema, type ClassId, type RaceId } from './schema';
import { readJson, writeJson, type StorageLike } from './storage';

export type Settings = { calm: boolean; assist: boolean; mute: boolean; heroClass: ClassId; heroRace: RaceId };

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  calm: false,
  assist: false,
  mute: false,
  heroClass: 'wanderer',
  heroRace: 'human',
});

/** Stored settings merged over the defaults; unknown or mistyped values fall back to their default. */
export function loadSettings(storage: StorageLike | null): Settings {
  const stored = readJson(storage, SETTINGS_KEY);
  const s: Record<string, unknown> = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const bool = (key: 'calm' | 'assist' | 'mute'): boolean =>
    typeof s[key] === 'boolean' ? (s[key] as boolean) : DEFAULT_SETTINGS[key];
  const heroClass = ClassIdSchema.safeParse(s['heroClass']);
  const heroRace = RaceIdSchema.safeParse(s['heroRace']);
  return {
    calm: bool('calm'),
    assist: bool('assist'),
    mute: bool('mute'),
    heroClass: heroClass.success ? heroClass.data : DEFAULT_SETTINGS.heroClass,
    heroRace: heroRace.success ? heroRace.data : DEFAULT_SETTINGS.heroRace,
  };
}

/** Writes the whole settings record. */
export function saveSettings(storage: StorageLike | null, s: Settings): void {
  writeJson(storage, SETTINGS_KEY, s);
}
