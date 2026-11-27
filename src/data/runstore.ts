// Run save, trophies, and class wins in localStorage (progression design.md). Never throws.
// `src/data` may not import the engine, so the save is read as unknown JSON and the engine validates it.
import { CLASSWINS_KEY, RUN_KEY, TROPHIES_KEY } from './constants';
import type { ClassWins, TrophyHave } from './schema';
import { readJson, removeKey, writeJson, type StorageLike } from './storage';

/** The parsed `cq:v1:run` JSON, or null when missing or not JSON. `restore` validates it. */
export function readRun(storage: StorageLike | null): unknown | null {
  return readJson(storage, RUN_KEY);
}

/** Writes a serialized run (the engine's `SavedRun`). */
export function writeRun(storage: StorageLike | null, saved: { version: 1 }): void {
  writeJson(storage, RUN_KEY, saved);
}

export function clearRun(storage: StorageLike | null): void {
  removeKey(storage, RUN_KEY);
}

/** The parsed `cq:v1:trophies` JSON, or null. `awardTrophies` validates it with `TrophyHaveSchema`. */
export function readTrophies(storage: StorageLike | null): unknown {
  return readJson(storage, TROPHIES_KEY);
}

export function writeTrophies(storage: StorageLike | null, have: TrophyHave): void {
  writeJson(storage, TROPHIES_KEY, have);
}

/** The parsed `cq:v1:classwins` JSON, or null. Validated with `ClassWinsSchema`. */
export function readClassWins(storage: StorageLike | null): unknown {
  return readJson(storage, CLASSWINS_KEY);
}

export function writeClassWins(storage: StorageLike | null, wins: ClassWins): void {
  writeJson(storage, CLASSWINS_KEY, wins);
}
