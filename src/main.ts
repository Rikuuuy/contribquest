// Entry point. Until the Phase 1 build replaces the root page, index.html redirects visitors to the prototype.
// This file wires input and timers to the engine. Until the presentation spec's screens exist, a page with an
// `#app` element gets a plain-text DOM view of the run (presentation task 1.3).
import { loadDemo } from './data/demo';
import { loadSettings } from './data/settings';
import { combatKey, isVisible, legalMoves, newRun, nextDeadline, step, type Action, type RunState } from './engine';
import { tileAt } from './mapgen';

let state: RunState | null = null;
/** `performance.now()` when the current test (by `testId`) was first rendered. */
let testStart = 0;
let testId = 0;
const timers: { deadline: ReturnType<typeof setTimeout> | null; advance: ReturnType<typeof setTimeout> | null } = {
  deadline: null,
  advance: null,
};
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
  schedule();
  for (const fn of listeners) fn(state);
}

function clearTimers(): void {
  if (timers.deadline !== null) clearTimeout(timers.deadline);
  if (timers.advance !== null) clearTimeout(timers.advance);
  timers.deadline = timers.advance = null;
}

/**
 * During a test: sends `timeout` when the engine's next deadline passes, in test time (requirement 11.5).
 * In `wait`: sends `advance` at once; the pacing delays come with presentation group 6. A timer whose
 * fight changed before it fires sends nothing (requirement 12.3).
 */
function schedule(): void {
  clearTimers();
  const f = state?.combat;
  if (!state || state.status !== 'combat' || !f) return;
  const id = f.testId;
  if (f.phase === 'test') {
    const d = nextDeadline(state);
    if (!d) return;
    timers.deadline = setTimeout(
      () => {
        timers.deadline = null;
        if (state?.combat?.testId === id && state.combat.phase === 'test') dispatch(d.action);
      },
      Math.max(0, testStart + d.t - performance.now()),
    );
  } else if (f.phase === 'wait') {
    timers.advance = setTimeout(() => {
      timers.advance = null;
      if (state?.status === 'combat' && state.combat?.testId === id && state.combat.phase === 'wait') dispatch({ type: 'advance' });
    }, 0);
  }
}

const inTest = (): boolean => state?.status === 'combat' && state.combat?.phase === 'test';
const testTime = (timeStamp: number): number => timeStamp - testStart;

/** Phase 1 debug input until presentation task 12.2: up, right, and down pick the upper, middle, or lower legal move. */
type Pick = 'up' | 'right' | 'down';
const MOVE_KEYS: Readonly<Record<string, Pick>> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowright: 'right',
  d: 'right',
};

/** The v1.6 `move` action for a pick, or null when there is no legal move. A single option takes any pick. */
function moveFor(s: RunState, pick: Pick): Action | null {
  const opts = legalMoves(s);
  if (!opts.length) return null;
  const o = pick === 'up' ? opts[0] : pick === 'down' ? opts[opts.length - 1] : opts[Math.floor((opts.length - 1) / 2)];
  return o ? { type: 'move', to: { col: o.col, row: o.row } } : null;
}

/**
 * Combat keys go through `combatKey` while a fight is shown and movement keys are ignored (FR-COM-6);
 * otherwise Arrow keys and WASD move while exploring (FR-MOV-1).
 */
function onKeyDown(e: KeyboardEvent): void {
  if (!state) return;
  if (state.status === 'combat') {
    const k = combatKey(e.key);
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    if (inTest()) {
      if (k === 'hit') dispatch({ type: 'press', t: testTime(e.timeStamp), key: e.key.toLowerCase() });
    } else if (state.combat?.phase === 'choose') dispatch({ type: 'attack' });
    return;
  }
  const pick = MOVE_KEYS[e.key.toLowerCase()];
  const a = pick && state.status === 'exploring' ? moveFor(state, pick) : null;
  if (a) {
    e.preventDefault();
    dispatch(a);
  }
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

/** D-pad buttons (`button[data-dir]`) send the same `move` actions as the keys (FR-MOV-2). */
export function bindDpad(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('button[data-dir]').forEach((b) =>
    b.addEventListener('click', () => {
      const pick = b.dataset['dir'] as Pick | undefined;
      const a = pick && state?.status === 'exploring' ? moveFor(state, pick) : null;
      if (a) dispatch(a);
    }),
  );
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// ---------- Plain DOM view (Phase 1 only; replaced by the presentation spec's screens) ----------

/** One character per cell: @ hero, ? unseen, . empty or resolved, w wisp, c chest, 1–4 monster tier, S start, B the boss node. */
function tileChar(s: RunState, col: number, row: number): string {
  if (s.pos.col === col && s.pos.row === row) return '@';
  if (col === s.map.bossNode.col) return row === s.map.bossNode.row && !s.bossDown ? 'B' : ' ';
  const t = tileAt(s.map, col, row);
  if (!t) return ' ';
  if (!isVisible(t)) return '?';
  if (t.kind === 'start') return 'S';
  if (t.resolved || t.kind === 'fog') return '.';
  if (t.kind === 'wisp') return 'w';
  if (t.kind === 'chest') return 'c';
  return String(t.tier);
}

function plainText(s: RunState): string {
  const h = s.hero;
  const rows: string[] = [];
  for (let r = 0; r < s.map.rows; r++) {
    let line = '';
    for (let c = 0; c <= s.map.cols; c++) line += tileChar(s, c, r) + ' ';
    rows.push(line);
  }
  const out = [
    `${h.name} · level ${h.level} · XP ${h.xp} · HP ${h.hp}/${h.maxHp} · ATK ${h.atk} · treasure ${h.treasure} · shards ${s.shards}/3 · ${s.status}`,
    '',
    ...rows,
    '',
    ...s.log,
  ];
  const f = s.combat;
  if (f) {
    out.push('', `${f.m.name}: HP ${f.m.hp}/${f.m.maxHp}`, ...f.lines);
    if (f.phase === 'choose') out.push('Attack (A).');
    if (f.phase === 'test' && f.test) out.push(`${f.test.kind} test: ${f.test.mode} (${f.test.pattern}). Press Space on the beat.`);
  }
  if (s.status === 'won') out.push('', 'The Phantom is banished. Your graph is exorcised.');
  if (s.status === 'lost') out.push('', 'You became part of the graph.');
  return out.join('\n');
}

function mountPlain(app: HTMLElement): void {
  const settings = loadSettings(globalThis.localStorage ?? null);
  const r = newRun(loadDemo(() => Date.now()), null, settings);
  if (!r.ok) {
    app.textContent = r.error.message;
    return;
  }
  app.innerHTML = `<pre id="cq-view" aria-live="polite"></pre>
<div class="dpad" aria-label="Route buttons">
  <button data-dir="up" aria-label="Upper path">↗</button><button data-dir="right" aria-label="Middle path">→</button><button data-dir="down" aria-label="Lower path">↘</button>
</div>
<p><button id="cq-attack" type="button">Attack (A)</button> <button id="cq-now" type="button">Now! (Space)</button></p>`;
  const view = app.querySelector('#cq-view') as HTMLElement;
  bindDpad(app);
  bindPointer(app.querySelector('#cq-now') as HTMLElement);
  (app.querySelector('#cq-attack') as HTMLElement).addEventListener('click', () => dispatch({ type: 'attack' }));
  onState((s) => {
    view.textContent = plainText(s);
  });
  setRun(r.value);
}

/** Loads the world renderer chunk (and `three`) on demand; the start screen never waits for it (requirement 25.7). */
export function loadWorld(): Promise<typeof import('./render/world/index')> {
  return import('./render/world/index');
}

const app = document.getElementById('app');
if (app) mountPlain(app);

// The /next/ page has a map host: start fetching the world chunk in the background (the renderer wiring follows).
if (document.getElementById('map-host'))
  loadWorld().catch((e: unknown) => console.warn('3D view unavailable:', e instanceof Error ? e.message : e));
