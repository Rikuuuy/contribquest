// Class difficulty and rising pressure (prototype DIFFICULTY, classDiff, pressure).
import { ClassIdSchema, type ClassId } from '../data/schema';
import { DIFFICULTY, PHASE2, PRESSURE_EPS, type Difficulty } from './balance';
import type { RunState } from './state';

const PCT = 100;

export function classDiff(cls: ClassId): Difficulty {
  return ClassIdSchema.safeParse(cls).success ? DIFFICULTY[cls] : DIFFICULTY.wanderer;
}

type PressureState = Pick<RunState, 'hero' | 'stats' | 'combat'>;

/** `max(floor, 1 − ramp × defeated)`, × 0.9 while the current fight's boss is in phase 2 (FR-DIF-3). */
export function pressure(s: PressureState): number {
  const D = classDiff(s.hero.cls);
  let pr = Math.max(D.floor, 1 - D.ramp * s.stats.defeated);
  if (s.combat && s.combat.m.phase2) pr *= PHASE2.pressure;
  return pr;
}

/** HUD "Timing n%" and whether the floor is reached (FR-DIF-4). */
export function timingPercent(s: PressureState): { pct: number; maxed: boolean } {
  const D = classDiff(s.hero.cls);
  const pr = pressure(s);
  return { pct: Math.round(pr * D.pMul * PCT), maxed: pr <= D.floor + PRESSURE_EPS };
}

/** The class card's difficulty line (FR-DIF-5). */
export function classCardLine(cls: ClassId): string {
  const D = classDiff(cls);
  return `Timing windows ${Math.round(D.pMul * PCT)}%, shrinking ${Math.round(D.ramp * PCT)}% per kill to ${Math.round(D.floor * D.pMul * PCT)}%. Treasure ×${D.loot}.`;
}
