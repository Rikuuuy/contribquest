// The balance simulator's route rule (progression requirement 14.2) and its headless run driver (requirement 14.1).
// The prototype's bots were driven by hand, so the rule follows the PRD v1.6 text recorded in progression design.md.
import { tileAt, type RouteOption } from '../mapgen';
import { SIM } from './balance';
import { legalMoves } from './explore';
import { step } from './step';
import type { Action, ComboGrade, Grade, QteTest, RunState } from './state';

/** Simulated runs stop here and count as lost. */
export const MAX_ACTIONS = SIM.maxActions;

/**
 * v1.6 route rank of a legal move, lower is preferred. Heal mode (HP below `SIM.healBelow` of max, or below
 * `SIM.healBeforeBoss` when the target is one of the last `SIM.bossWeeks` columns): chest 0, wisp 1, fog 2,
 * monster 2 + tier. Otherwise: monster 5 − tier (Lich 1 … Ghost 4), chest 5, wisp 6, fog 7. The boss node ranks 0.
 * Throws on a tile outside the visibility window, so the bot never uses hidden information.
 */
export function rankOption(s: RunState, o: RouteOption): number {
  if (o.boss) return 0;
  const t = tileAt(s.map, o.col, o.row);
  if (!t) throw new Error(`routebot: no tile at ${o.col},${o.row}`);
  if (!t.seen) throw new Error(`routebot: tile ${o.col},${o.row} is not seen`);
  const nearBoss = o.col >= s.map.cols - SIM.bossWeeks;
  const heal = s.hero.hp < s.hero.maxHp * (nearBoss ? SIM.healBeforeBoss : SIM.healBelow);
  switch (t.kind) {
    case 'chest':
      return heal ? 0 : 5;
    case 'wisp':
      return heal ? 1 : 6;
    case 'monster':
      return heal ? 2 + t.tier : 5 - t.tier;
    default:
      return heal ? 2 : 7;
  }
}

/**
 * The simulator's next action: during a relic offer, the first relic; otherwise the legal move with the lowest
 * `rankOption`, the first (lowest row) on ties. A single option (the edge fallback, the boss node) is taken as is.
 * With no legal move (only at the boss node, where the bot is in combat) it sends `advance`, which `step` ignores.
 */
export function routeAction(s: RunState): Action {
  if (s.status === 'relic') return { type: 'pickRelic', i: 0 };
  const opts = legalMoves(s);
  if (!opts.length) return { type: 'advance' };
  let best = opts[0] as RouteOption;
  if (opts.length > 1) {
    let bestRank = Infinity;
    for (const o of opts) {
      const r = rankOption(s, o);
      if (r < bestRank) [best, bestRank] = [o, r];
    }
  }
  return { type: 'move', to: { col: best.col, row: best.row } };
}

export type Grader = (test: QteTest) => Grade | ComboGrade;
export type PlayResult = { state: RunState; actions: number; fights: number; won: boolean };

/**
 * Plays a run headlessly through `step` only: every timing test is answered with `forceGrade(grader(test))`,
 * `advance` is sent at once, every fight is Attack (there is no Flee), the first relic is picked, the
 * Commit Blessing is claimed, and moves follow `routeAction`. Stops at won, lost, or MAX_ACTIONS (lost).
 */
export function playRun(start: RunState, grader: Grader, maxActions: number = MAX_ACTIONS): PlayResult {
  let s = step(start, { type: 'enterMap' });
  let actions = 1;
  let fights = 0;
  let blessing = s.events.some((e) => e.type === 'blessingDue');
  while (s.status !== 'won' && s.status !== 'lost' && actions < maxActions) {
    const c = s.combat;
    let a: Action;
    if (blessing) {
      a = { type: 'offerBlessing' };
      blessing = false;
    } else if (s.status === 'combat' && c?.phase === 'test' && c.test) a = { type: 'forceGrade', grade: grader(c.test) };
    else if (s.status === 'combat' && c?.phase === 'wait') a = { type: 'advance' };
    else if (s.status === 'combat') a = { type: 'attack' };
    else a = routeAction(s);
    s = step(s, a);
    actions++;
    for (const e of s.events) {
      if (e.type === 'fightStart') fights++;
      if (e.type === 'blessingDue') blessing = true;
    }
  }
  return { state: s, actions, fights, won: s.status === 'won' };
}
