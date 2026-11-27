// The engine reducer: step(state, action) → new state, and nextDeadline(state).
import { chooseClass } from './classes';
import { loseFight, resolveTest, startBossFight, startFight, startGuard, startStrike, winFight } from './combat';
import { applyMove, checkMove } from './explore';
import { enterMap, offerBlessing } from './omen';
import { collectWisp, openChest, restDay } from './progression';
import { chooseRace } from './races';
import { newRun } from './run';
import { pickRelic } from './relics';
import { grade, testDeadline } from './qte';
import type { DayTile, Pos, RouteOption } from '../mapgen';
import type { Action, RunState } from './state';

/** Applies one action to a deep copy of `state`; the input is never mutated (FR-COM-5). */
export function step(state: RunState, action: Action): RunState {
  const s = structuredClone(state);
  s.events = [];
  // While a relic offer is open, only the pick (and the settings toggles) are accepted (requirement 6.3).
  if (s.status === 'relic' && action.type !== 'pickRelic' && action.type !== 'setOptions') return s;
  switch (action.type) {
    case 'move':
      move(s, action.to);
      break;
    case 'chooseClass':
      chooseClass(s, action.cls);
      break;
    case 'setOptions':
      s.opts = { calm: action.opts.calm, assist: action.opts.assist };
      break;
    case 'attack':
      if (s.status === 'combat' && s.combat?.phase === 'choose') startStrike(s);
      break;
    case 'press':
    case 'release':
    case 'timeout':
      input(s, action);
      break;
    case 'forceGrade':
      if (s.status === 'combat' && s.combat?.phase === 'test') resolveTest(s, { grade: action.grade });
      break;
    case 'advance':
      advance(s);
      break;
    case 'pickRelic':
      pickRelic(s, action.i);
      break;
    case 'chooseRace':
      chooseRace(s, action.race);
      break;
    case 'enterMap':
      enterMap(s);
      break;
    case 'offerBlessing':
      offerBlessing(s);
      break;
    case 'retry':
      return retry(s);
  }
  return s;
}

/**
 * v1.6: forward-only moves. Accepted only while exploring and only onto a legal target; a refused move changes
 * nothing and emits nothing (requirements 22.1, 22.4). Every tile entered resolves (22.2, 22.3).
 */
function move(s: RunState, to: Pos): void {
  if (s.status !== 'exploring') return;
  const check = checkMove(s, to);
  if (!check.ok) return;
  const from = { col: s.pos.col, row: s.pos.row };
  applyMove(s, check);
  s.events.push({ type: 'moved', from, to: { col: s.pos.col, row: s.pos.row } });
  enterTile(s, check.target, check.tile);
}

function enterTile(s: RunState, target: RouteOption, tile: DayTile | null): void {
  if (target.boss) {
    startBossFight(s);
    return;
  }
  // Columns are never revisited, so a legal target is unresolved; the check guards hand-built test states.
  if (!tile || tile.resolved) return;
  switch (tile.kind) {
    case 'monster':
      startFight(s, tile);
      break;
    case 'chest':
      openChest(s, tile);
      break;
    case 'wisp':
      collectWisp(s, tile);
      break;
    case 'fog':
      restDay(s, tile);
      break;
    case 'start':
      break;
  }
}

/** A finished run restarts on the same set and hero set from memory, with the hero's class and race and the current options (requirement 17.5). */
function retry(s: RunState): RunState {
  if (s.status !== 'won' && s.status !== 'lost') return s;
  const r = newRun(s.set, s.heroSet, { heroClass: s.hero.cls, heroRace: s.hero.race, ...s.opts });
  return r.ok ? r.value : s;
}

function input(s: RunState, action: Extract<Action, { type: 'press' | 'release' | 'timeout' }>): void {
  const c = s.combat;
  if (s.status !== 'combat' || !c || c.phase !== 'test' || !c.test) return;
  if (action.type !== 'timeout') c.events.push({ type: action.type === 'press' ? 'down' : 'up', t: action.t, key: action.key });
  const r = grade(c.test, c.events, action.t, s.opts.assist);
  if (r) resolveTest(s, r);
}

function advance(s: RunState): void {
  const c = s.combat;
  if (s.status !== 'combat' || !c || c.phase !== 'wait' || !c.next) return;
  const next = c.next;
  c.next = null;
  switch (next.kind) {
    case 'strike':
      startGuard(s, next.i);
      break;
    case 'choose':
      c.phase = 'choose';
      break;
    case 'win':
      winFight(s);
      break;
    case 'lose':
      loseFight(s);
      break;
  }
}

/** While a test is in progress: the test time at which to send `timeout`. Otherwise null. */
export function nextDeadline(state: RunState): { t: number; action: Action } | null {
  const c = state.combat;
  if (state.status !== 'combat' || !c || c.phase !== 'test' || !c.test) return null;
  const t = testDeadline(c.test, c.events, state.opts.assist);
  return { t, action: { type: 'timeout', t } };
}

/** A restored run never resumes a timing test: the fight goes back to the Attack choice (FR-COM-7). */
export function resumeFight(state: RunState): RunState {
  if (!state.combat) return state;
  const s = structuredClone(state);
  const c = s.combat as NonNullable<RunState['combat']>;
  c.phase = 'choose';
  c.test = null;
  c.events = [];
  c.next = null;
  return s;
}
