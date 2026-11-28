// Entry point. Until the cutover, index.html redirects visitors to the prototype and this build runs at /next/.
// This file wires input and timers to the engine (v1.6: moves go through the route view, presentation 12.2).
import { musicModeFor, soundsFor, type ScreenId } from './audio/events';
import { createAudio } from './audio/sfx';
import { loadDemo } from './data/demo';
import { loadSettings, saveSettings } from './data/settings';
import { combatKey, newRun, nextDeadline, step, type Action, type InputEvent, type Mode, type RunState } from './engine';
import { createBackground } from './render/background';
import { $, show } from './render/dom';
import { whiteOut } from './render/fx';
import { pressError, recordHit, type HitLog } from './render/hit-meter';
import { hudView } from './render/hud';
import { isArrowKey, isMuteKey, relicKey, routeKey } from './render/input';
import { routeView, targetFor } from './render/map/route-view';
import { onReducedChange, REDUCED } from './render/motion';
import { Pacer, resolvedKind } from './render/pacing';
import type { Renderer } from './render/renderer';
import { createCombatScreen } from './render/screens/combat';
import { renderEndPanel, renderRelicPanel } from './render/screens/debug-panels';
import { createMapScreen } from './render/screens/map';

let state: RunState | null = null;
/** `performance.now()` when the current test (by `testId`) was first rendered. */
let testStart = 0;
let testId = 0;
const timers: { deadline: ReturnType<typeof setTimeout> | null; advance: ReturnType<typeof setTimeout> | null } = {
  deadline: null,
  advance: null,
};
const listeners = new Set<(s: RunState) => void>();
/** The mode of the test the last step's press went to (the charge sound); null when the step was no press. */
let lastPress: Mode | null = null;
const pacer = new Pacer();
/**
 * Timing feedback (requirement 17): the offset in ms subtracted from every press and release time (the summary's
 * slider sets it with task 5.2; 0 until then), the hit-error history, and the error of the input the last step
 * graded against a target (null when it graded none).
 */
const timing: { offset: number; hits: HitLog; lastError: number | null } = {
  offset: 0,
  hits: { log: [], hist: [] },
  lastError: null,
};

/** Starts driving a run (called by the screens once a run exists). */
export function setRun(s: RunState): void {
  state = s;
  testId = -1;
  lastPress = null;
  afterStep();
}

export function onState(fn: (s: RunState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dispatch(action: Action): void {
  if (!state) return;
  const before = state.combat;
  state = step(state, action);
  timing.lastError = null;
  lastPress = action.type === 'press' && before?.phase === 'test' && before.test ? before.test.mode : null;
  if ((action.type === 'press' || action.type === 'release') && before?.phase === 'test' && before.test) {
    const e: InputEvent = { type: action.type === 'press' ? 'down' : 'up', t: action.t, key: action.key };
    const off = pressError(before.test, before.events, e);
    if (off !== null) {
      timing.hits = recordHit(timing.hits, { off, P: before.test.P, G: before.test.G });
      timing.lastError = off;
    }
  }
  afterStep();
}

function afterStep(): void {
  if (!state) return;
  const c = state.combat;
  if (state.events.some((e) => e.type === 'fightStart')) pacer.reset();
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
 * In `wait`: sends `advance` after the pacing delay (requirement 12.1). A timer whose fight changed before it
 * fires sends nothing (requirement 12.3).
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
    const ms = pacer.delayFor({ fight: f, events: state.events, resolved: resolvedKind(state.events, f.next) });
    timers.advance = setTimeout(() => {
      timers.advance = null;
      if (state?.status === 'combat' && state.combat?.testId === id && state.combat.phase === 'wait') dispatch({ type: 'advance' });
    }, ms);
  }
}

const inTest = (): boolean => state?.status === 'combat' && state.combat?.phase === 'test';
/** Test time of an input, after the timing offset (requirement 17.5). */
const testTime = (timeStamp: number): number => timeStamp - testStart - timing.offset;

/** True while typing in a text field, where letter keys must reach the field. */
function typing(t: EventTarget | null): boolean {
  const el = t as { tagName?: unknown; isContentEditable?: unknown } | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true);
}

/**
 * Combat keys go through `combatKey` while a fight is shown and movement keys are ignored (FR-COM-6). While a
 * relic offer is open, 1, 2, 3 pick a relic. Otherwise Arrow keys and W, D, S pick a branch through `routeKey`
 * and `targetFor`; a branch with no legal move sends nothing (FR-MOV-1, FR-MOV-8).
 */
function onKeyDown(e: KeyboardEvent): void {
  if (!state || typing(e.target)) return;
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
  if (state.status === 'relic') {
    const i = relicKey(e.key);
    if (i !== null) {
      e.preventDefault();
      dispatch({ type: 'pickRelic', i });
    }
    return;
  }
  if (state.status !== 'exploring') return;
  if (isArrowKey(e.key)) e.preventDefault();
  const branch = routeKey(e.key);
  const to = branch ? targetFor(routeView(state), branch) : null;
  if (to) {
    e.preventDefault();
    dispatch({ type: 'move', to });
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

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

/** Loads the world renderer chunk (and `three`) on demand; the start screen never waits for it (requirement 25.7). */
export function loadWorld(): Promise<typeof import('./render/world/index')> {
  return import('./render/world/index');
}

// ---------- The /next/ page (presentation spec, v1.6) ----------

const BLESSING_DELAY_MS = 600;

/**
 * Wires the /next/ page: the demo starts from "Play the demo" or `?demo`, the map screen and the combat panel
 * draw every state, and the plain relic and end panels stand in until their screens exist. The world renderer loads in the
 * background; the map is playable with the HUD and the pad before it arrives.
 */
function mountNext(): void {
  const settings = loadSettings(globalThis.localStorage ?? null);
  const screen = createMapScreen({ dispatch });
  const combat = createCombatScreen({
    dispatch,
    testStart: () => testStart,
    offset: () => timing.offset,
    hits: () => timing.hits,
  });
  let renderer: Renderer | null = null;
  let fresh = false;
  let blessing: ReturnType<typeof setTimeout> | null = null;
  const teaser = document.getElementById('teaser');
  const bgCanvas = document.getElementById('bg');
  const background = bgCanvas instanceof HTMLCanvasElement ? createBackground(bgCanvas) : null;
  const storage = globalThis.localStorage ?? null;
  const audio = createAudio(() => settings.mute);
  const soundBtn = document.getElementById('btn-sound');
  let screenId: ScreenId = 'start';

  /** Shows a screen and sets its music (requirement 14.2). */
  function showScreen(id: ScreenId): void {
    screenId = id;
    show(`screen-${id}`);
    audio.setMode(musicModeFor(id, state));
    if (id !== 'map') audio.setLowHp(false);
  }

  function refreshSoundBtn(): void {
    if (!soundBtn) return;
    soundBtn.textContent = `Sound: ${settings.mute ? 'off' : 'on'} (M)`;
    soundBtn.setAttribute('aria-pressed', String(!settings.mute));
  }

  /** Toggles mute, ramps the master gain, and saves the setting (requirement 14.5). */
  function toggleMute(): void {
    audio.init();
    settings.mute = !settings.mute;
    audio.setMute(settings.mute);
    saveSettings(storage, settings);
    refreshSoundBtn();
  }

  // Audio starts on the first key or pointer input (requirement 14.4); later inputs resume a suspended context.
  for (const ev of ['pointerdown', 'keydown'] as const) addEventListener(ev, () => audio.init(), { capture: true });
  soundBtn?.addEventListener('click', toggleMute);
  document.addEventListener('keydown', (e) => {
    if (!e.repeat && isMuteKey(e)) toggleMute();
  });
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('button');
    if (b && b.id !== 'btn-qte' && b.id !== 'btn-sound') audio.play('ui');
  });
  refreshSoundBtn();
  audio.setMode('menu');
  const demoMap = newRun(loadDemo(() => Date.now()), null, settings);

  loadWorld()
    .then((w) => {
      const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
      try {
        renderer = w.createWorldRenderer(teaser ?? $('#map-host'), {
          coarse,
          reduced: REDUCED,
          onFail: () => {
            renderer = null;
            screen.setRenderer(null);
          },
        });
      } catch (e) {
        console.warn('3D view unavailable:', e instanceof Error ? e.message : e);
        return;
      }
      onReducedChange((on) => renderer?.setReduced(on));
      if (state && !$('#screen-map').hidden) screen.setRenderer(renderer);
      else if (teaser && demoMap.ok) {
        renderer.mount(teaser);
        renderer.showTeaser(demoMap.value.map);
      }
    })
    .catch((e: unknown) => console.warn('3D view unavailable:', e instanceof Error ? e.message : e));

  function start(): void {
    const r = newRun(loadDemo(() => Date.now()), null, settings);
    if (!r.ok) {
      const err = $('#start-error');
      err.textContent = r.error.message;
      err.hidden = false;
      return;
    }
    showScreen('map');
    fresh = true;
    if (renderer) screen.setRenderer(renderer);
    if (!REDUCED) audio.play('rise');
    setRun(r.value);
    dispatch({ type: 'enterMap' });
    $('#map-host').focus({ preventScroll: true });
  }

  onState((s) => {
    // Sounds for the step's events, on their effect timing; the music follows the screen and fight.
    for (const c of soundsFor(s.events, { test: s.combat?.test ?? null, press: lastPress }))
      if (c.at > 0) setTimeout(() => audio.play(c.name, c.gain), c.at);
      else audio.play(c.name, c.gain);
    if (screenId === 'map') audio.setMode(musicModeFor('map', s));
    audio.setLowHp(s.status === 'exploring' && hudView(s).lowHp);
    if (s.status === 'won' || s.status === 'lost') {
      // End effects once, on the step that ends the run: white-out and confetti, or falling ash.
      const end = s.events.find((e) => e.type === 'runEnded');
      if (end) {
        if (end.won) whiteOut(REDUCED);
        background?.celebrate(end.won, REDUCED);
      }
      combat.update(s);
      renderEndPanel(document, s);
      showScreen('end');
      renderer?.stop();
      return;
    }
    screen.update(s, fresh);
    fresh = false;
    combat.update(s, timing.lastError);
    renderRelicPanel(document, s, (i) => dispatch({ type: 'pickRelic', i }));
    if (s.events.some((e) => e.type === 'blessingDue')) {
      if (blessing !== null) clearTimeout(blessing);
      blessing = setTimeout(() => {
        blessing = null;
        dispatch({ type: 'offerBlessing' });
      }, BLESSING_DELAY_MS);
    }
  });

  $('#btn-demo').addEventListener('click', start);
  $('#form').addEventListener('submit', (e) => {
    // Live graphs need the start and summary screens (presentation tasks 5.x); the demo is playable now.
    e.preventDefault();
    const err = $('#start-error');
    err.textContent = 'Live graphs arrive with the next build. Play the demo for now.';
    err.hidden = false;
  });
  bindPointer($('#btn-qte'));
  $('#btn-again').addEventListener('click', () => {
    showScreen('map');
    fresh = true;
    if (renderer) screen.setRenderer(renderer);
    if (!REDUCED) audio.play('rise');
    dispatch({ type: 'retry' });
    dispatch({ type: 'enterMap' });
  });
  $('#btn-new').addEventListener('click', () => {
    showScreen('start');
    if (renderer && teaser && demoMap.ok) {
      renderer.mount(teaser);
      renderer.showTeaser(demoMap.value.map);
    }
  });
  if (new URLSearchParams(location.search).has('demo')) start();
}

if (document.getElementById('map-host')) mountNext();
