// Engine module: run state, step(), combat, timing tests, balance.
export const MODULE = 'engine';

export * from './balance';
export type * from './state';
export { rand } from './rand';
export { CLASS_INFO, heroClass, applyStats, chooseClass, fightHint, type ClassInfo } from './classes';
export { classDiff, pressure, timingPercent, classCardLine } from './difficulty';
export { modsOf, type Mods } from './mods';
export { TIER_NAMES, makeMonster, sourceLabel, fightTreasure } from './monsters';
export { strikePlan, patternDamageMult, checkPhase2, STRIKE_LINE } from './patterns';
export { windows, createTest, grade, testDeadline, gradeText, GRADE_LABELS, type TestContext } from './qte';
export {
  startFight,
  startStrike,
  resolveStrike,
  startGuard,
  resolveGuard,
  startFlee,
  resolveFlee,
  winFight,
  loseFight,
  applyDuck,
} from './combat';
export { step, nextDeadline, resumeFight } from './step';
export { combatKey } from './input';
export { checkMove, applyMove, reveal, isVisible, collectShard, type Dir } from './explore';
