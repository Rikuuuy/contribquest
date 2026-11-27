// The balance simulator's route rule (progression requirement 14.2) and its headless run driver (requirement 14.1).
// The prototype's bots were driven by hand, so the rule follows the PRD v1.2 text recorded in progression design.md.
import { neighbours, tileAt, type DayTile, type Pos } from '../mapgen';
import { checkMove, type Dir } from './explore';
import { step } from './step';
import type { Action, ComboGrade, Grade, QteTest, RunState } from './state';

/** HP fraction below which the bot heals at a chest; higher once the ward is broken and the boss is next. */
const HEAL_BELOW = 0.45;
const HEAL_BELOW_BOSS_NEXT = 0.75;

/** Simulated runs stop here and count as lost. */
export const MAX_ACTIONS = 2000;

function dirTo(from: Pos, to: Pos): Dir {
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  if (dc === 1) return 'right';
  if (dc === -1) return 'left';
  return dr === 1 ? 'down' : 'up';
}

/** BFS from the hero over tiles `checkMove` allows, in mapgen `neighbours` order. Returns each reached tile's parent. */
function bfs(s: RunState): Map<DayTile, DayTile | null> {
  const start = tileAt(s.map, s.pos.col, s.pos.row);
  const parent = new Map<DayTile, DayTile | null>();
  if (!start) return parent;
  parent.set(start, null);
  const queue: DayTile[] = [start];
  while (queue.length) {
    const t = queue.shift() as DayTile;
    for (const nb of neighbours(s.map, t)) {
      if (parent.has(nb)) continue;
      if (!checkMove({ ...s, pos: { col: t.col, row: t.row } }, dirTo(t, nb)).ok) continue;
      parent.set(nb, t);
      queue.push(nb);
    }
  }
  return parent;
}

/** The first goal tile in BFS order (fewest steps, ties by `neighbours` order), excluding the hero's own tile. */
function nearest(parent: Map<DayTile, DayTile | null>, goal: (t: DayTile) => boolean): DayTile | null {
  for (const [t, p] of parent) if (p !== null && goal(t)) return t;
  return null;
}

/** The first move on the BFS path to `goal`. */
function firstMove(s: RunState, parent: Map<DayTile, DayTile | null>, goal: DayTile): Action {
  let t = goal;
  let p = parent.get(t) ?? null;
  while (p && parent.get(p) !== null) {
    t = p;
    p = parent.get(t) ?? null;
  }
  return { type: 'move', dir: dirTo(s.pos, t) };
}

/**
 * The simulator's next action while exploring: heal at the nearest chest when HP is below 45% of max
 * (75% once the ward is broken and the boss is next); else, while shards are missing, the nearest
 * unresolved Ghoul or Lich; else the boss; after the boss, the Gate. During a relic offer, the first relic.
 */
export function routeAction(s: RunState): Action {
  if (s.status === 'relic') return { type: 'pickRelic', i: 0 };
  const parent = bfs(s);
  const wardBroken = s.shards >= s.map.shardsNeeded;
  const healBelow = wardBroken && !s.bossDown ? HEAL_BELOW_BOSS_NEXT : HEAL_BELOW;
  const goals: ((t: DayTile) => boolean)[] = [];
  if (s.hero.hp < healBelow * s.hero.maxHp) goals.push((t) => t.kind === 'chest' && !t.resolved);
  if (!s.bossDown) {
    if (!wardBroken) goals.push((t) => t.kind === 'monster' && !t.resolved && (t.tier === 3 || t.tier === 4));
    goals.push((t) => t.boss === true && !t.resolved);
  } else {
    goals.push((t) => t.kind === 'gate');
  }
  for (const g of goals) {
    const goal = nearest(parent, g);
    if (goal) return firstMove(s, parent, goal);
  }
  // No goal reachable: step to the first open neighbour so the run still ends within MAX_ACTIONS.
  const first = nearest(parent, () => true);
  return first ? firstMove(s, parent, first) : { type: 'move', dir: 'right' };
}

export type Grader = (test: QteTest) => Grade | ComboGrade;
export type PlayResult = { state: RunState; actions: number; fights: number; won: boolean };

/**
 * Plays a run headlessly through `step` only: every timing test is answered with `forceGrade(grader(test))`,
 * `advance` is sent at once, the fight is always Attack (never flee), the first relic is picked, the
 * Commit Blessing is claimed, and walking follows `routeAction`. Stops at won, lost, or MAX_ACTIONS (lost).
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
