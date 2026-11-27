// The engine reducer: step(state, action) → new state, and nextDeadline(state).
import { chooseClass } from './classes';
import {
  finishEscape,
  loseFight,
  resolveTest,
  startFight,
  startFlee,
  startGuard,
  startStrike,
  winFight,
} from './combat';
import { applyMove, checkMove } from './explore';
import { log } from './log';
import { enterMap, offerBlessing } from './omen';
import { collectWisp, openChest } from './progression';
import { chooseRace } from './races';
import { endRun } from './run';
import { pickRelic } from './relics';
import { grade, testDeadline } from './qte';
import type { Action, RunState } from './state';

/** Applies one action to a deep copy of `state`; the input is never mutated (FR-COM-5). */
export function step(state: RunState, action: Action): RunState {
  const s = structuredClone(state);
  s.events = [];
  // While a relic offer is open, only the pick (and the settings toggles) are accepted (requirement 6.3).
  if (s.status === 'relic' && action.type !== 'pickRelic' && action.type !== 'setOptions') return s;
  switch (action.type) {
    case 'move':
      move(s, action.dir);
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
    case 'flee':
      if (s.status === 'combat' && s.combat?.phase === 'choose') startFlee(s);
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
      // Needs newRun from the progression spec (Phase 2, task 9.3).
      break;
  }
  return s;
}

function move(s: RunState, dir: Parameters<typeof checkMove>[1]): void {
  if (s.status !== 'exploring') return;
  const check = checkMove(s, dir);
  if (!check.ok) {
    if (check.reason !== 'void') {
      const [dc, dr] = DELTA[dir];
      log(s, check.message);
      s.events.push({ type: 'blocked', col: s.pos.col + dc, row: s.pos.row + dr });
    }
    return;
  }
  const t = check.tile;
  applyMove(s, t);
  if (t.resolved) return;
  switch (t.kind) {
    case 'monster':
    case 'boss':
      startFight(s, t);
      break;
    case 'gate':
      if (t.boss) startFight(s, t);
      else endRun(s, 'won');
      break;
    case 'wisp':
      collectWisp(s, t);
      break;
    case 'chest':
      openChest(s, t);
      break;
    default:
      break;
  }
}

const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

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
    case 'escape':
      finishEscape(s, next.dmg);
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

/** A restored run never resumes a timing test: the fight goes back to the Attack/Flee choice (FR-COM-7). */
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
