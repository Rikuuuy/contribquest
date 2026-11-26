// Entry point. Until the Phase 1 build replaces the root page, index.html redirects visitors to the prototype.
// This file wires input and timers to the engine; rendering and screens come with the presentation spec.
import { combatKey, nextDeadline, step, type Action, type RunState } from './engine';

let state: RunState | null = null;
/** `performance.now()` when the current test (by `testId`) was first rendered. */
let testStart = 0;
let testId = 0;
let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(s: RunState) => void>();

/** Starts driving a run (called by the screens once a run exists). */
export function setRun(s: RunState): void {
  state = s;
  testId = -1;
  afterStep();
}

export function onState(fn: (s: RunState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dispatch(action: Action): void {
  if (!state) return;
  state = step(state, action);
  afterStep();
}

function afterStep(): void {
  if (!state) return;
  const c = state.combat;
  if (c && c.phase === 'test' && c.testId !== testId) {
    testId = c.testId;
    testStart = performance.now();
  }
  scheduleDeadline();
  for (const fn of listeners) fn(state);
}

/** Sends `timeout` when the next deadline from the engine passes, in test time. */
function scheduleDeadline(): void {
  if (deadlineTimer !== null) clearTimeout(deadlineTimer);
  deadlineTimer = null;
  if (!state) return;
  const d = nextDeadline(state);
  if (!d) return;
  const forId = testId;
  deadlineTimer = setTimeout(
    () => {
      deadlineTimer = null;
      if (state?.combat?.testId === forId) dispatch(d.action);
    },
    Math.max(0, testStart + d.t - performance.now()),
  );
}

const inTest = (): boolean => state?.status === 'combat' && state.combat?.phase === 'test';
const testTime = (timeStamp: number): number => timeStamp - testStart;

/** Combat keys: a press or release during a test, Attack or Flee in `choose` (FR-COM-6). */
function onKeyDown(e: KeyboardEvent): void {
  if (!state || state.status !== 'combat') return;
  const k = combatKey(e.key);
  if (!k) return;
  e.preventDefault();
  if (e.repeat) return;
  if (inTest()) {
    if (k === 'hit') dispatch({ type: 'press', t: testTime(e.timeStamp), key: e.key.toLowerCase() });
  } else if (state.combat?.phase === 'choose') dispatch({ type: k === 'flee' ? 'flee' : 'attack' });
}

function onKeyUp(e: KeyboardEvent): void {
  if (!inTest() || combatKey(e.key) !== 'hit') return;
  dispatch({ type: 'release', t: testTime(e.timeStamp), key: e.key.toLowerCase() });
}

/** Pointer input on the "Now!" button or the test area. */
export function bindPointer(el: HTMLElement): void {
  el.addEventListener('pointerdown', (e) => {
    if (!inTest()) return;
    e.preventDefault();
    dispatch({ type: 'press', t: testTime(e.timeStamp), key: 'pointer' });
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const)
    el.addEventListener(ev, (e) => {
      if (inTest()) dispatch({ type: 'release', t: testTime(e.timeStamp), key: 'pointer' });
    });
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
