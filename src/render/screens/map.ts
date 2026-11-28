// The map screen (prototype map handlers; requirements 8.1–8.3, 23.1, v1.6). It owns the renderer host element,
// the HUD, log, and danger overlay, pointer taps through `renderer.pick`, the hover tooltip, and the branch pad.
// The frame loop belongs to the active `Renderer`; this module never dispatches anything the route view does
// not offer, and the engine still validates every move.
import type { Action, GameEvent, RunState } from '../../engine';
import { tileAt, type Pos } from '../../mapgen';
import { $, esc } from '../dom';
import { hudView, renderDanger, renderHud, renderLog, resetHud } from '../hud';
import type { Branch } from '../input';
import { routeView, targetFor, type RouteView } from '../map/route-view';
import { bossInfo, tileInfo, type TileInfo } from '../map/tooltip';
import { REDUCED } from '../motion';
import type { Renderer } from '../renderer';

export type MapScreenDeps = {
  dispatch: (a: Action) => void;
  /** Called after a tap on the hero's own tile, for the line, sound, and sparks of later tasks. */
  onHeroTap?: (state: RunState) => void;
};

export type MapScreen = {
  /** Attaches the renderer (it may arrive after the first state); null detaches it. */
  setRenderer(r: Renderer | null): void;
  /** Draws a state and plays its events; `fresh` marks the first state of a new run (rise, no HUD bump). */
  update(state: RunState, fresh?: boolean): void;
  /** The current route view, for the keyboard. */
  view(): RouteView | null;
  /** The move for a branch key or pad button, or null when that branch has no legal move. */
  moveFor(branch: Branch): Action | null;
};

const samePos = (a: Pos | null | undefined, b: Pos | null | undefined): boolean =>
  !!a && !!b && a.col === b.col && a.row === b.row;

/** The tooltip lines for a map position: a day tile or the boss node; null elsewhere. */
export function infoAt(state: RunState, pos: Pos): TileInfo | null {
  if (samePos(pos, state.map.bossNode)) return bossInfo(state.map, state.bossDown);
  const t = tileAt(state.map, pos.col, pos.row);
  return t ? tileInfo(t) : null;
}

/** The tooltip markup (escaped). */
export function tipHtml(info: TileInfo): string {
  return `<b>${esc(info.when)}</b><br>${esc(info.what)}${info.best ? `<br>${esc(info.best)}` : ''}`;
}

/** Rebuilds the branch pad from the route view: one button per branch, disabled when missing; one middle button when single. */
export function renderPad(pad: HTMLElement, view: RouteView): void {
  pad.classList.toggle('single', view.single);
  pad.querySelectorAll<HTMLButtonElement>('button[data-branch]').forEach((b) => {
    const branch = b.dataset['branch'] as Branch;
    const to = targetFor(view, branch);
    b.disabled = !to || (view.single && branch !== 'ahead');
    if (branch === 'ahead') {
      const boss = view.single && view.targets[0]?.boss;
      b.textContent = boss ? '→ Boss' : '→ Ahead';
      b.setAttribute('aria-label', boss ? 'Step to the boss' : 'Step ahead');
    }
  });
}

/** Mounts the map screen on the page's `#screen-map` markup. */
export function createMapScreen(deps: MapScreenDeps, root: ParentNode = document): MapScreen {
  const host = $('#map-host', root);
  const board = $('.board', root);
  const tip = $('#map-tip', root);
  const hud = $('#hud', root);
  const log = $('#log', root);
  const pad = $('#branch-pad', root);
  const danger = root.querySelector<HTMLElement>('#danger');
  /** The battle screen's 8:3 stage slot: the renderer's canvas moves there during a fight (requirement 18.2). */
  const stageSlot = root.querySelector<HTMLElement>('#stage-slot');

  let renderer: Renderer | null = null;
  let state: RunState | null = null;
  let view: RouteView | null = null;
  let shownMap = false;
  let pendingRise = false;
  let mounted: HTMLElement | null = null;

  /** Moves the renderer's canvas into `el` unless it is already there. */
  function mountIn(el: HTMLElement): void {
    if (!renderer || mounted === el) return;
    renderer.mount(el);
    mounted = el;
  }

  const hideTip = () => {
    tip.hidden = true;
  };

  function showTip(info: TileInfo, clientX: number, clientY: number): void {
    tip.innerHTML = tipHtml(info);
    tip.hidden = false;
    const b = board.getBoundingClientRect();
    const half = tip.offsetWidth / 2 + 4;
    const x = Math.min(Math.max(clientX - b.left, half), Math.max(half, b.width - half));
    const y = clientY - b.top;
    tip.style.left = `${x}px`;
    tip.style.top = `${y < tip.offsetHeight + 14 ? y + tip.offsetHeight + 34 : y}px`;
  }

  const exploring = () => !!state && state.status === 'exploring' && !state.combat && !state.relicOffer;
  const targetAt = (pos: Pos | null) => (pos && view ? view.targets.find((t) => samePos(t.to, pos)) ?? null : null);

  function draw(fresh: boolean): void {
    if (!state || !view) return;
    if (state.status === 'combat') {
      hideTip();
      renderer?.hover(null);
      if (stageSlot) mountIn(stageSlot);
      renderer?.showFight(state);
      shownMap = false;
      return;
    }
    if (!renderer) return;
    mountIn(host);
    renderer.showMap(state, view, { rise: fresh || pendingRise });
    pendingRise = false;
    shownMap = true;
  }

  host.addEventListener('pointerdown', (e) => {
    if (!state || !renderer || !exploring()) return;
    const pos = renderer.pick(e.clientX, e.clientY);
    if (!pos) return;
    const tg = targetAt(pos);
    if (tg) {
      e.preventDefault();
      hideTip();
      deps.dispatch({ type: 'move', to: { ...tg.to } });
    } else if (samePos(pos, state.pos)) {
      // Hero tap (requirement 8.1): a hop in place; the line, sound, and sparks come with tasks 7.x and 9.x.
      renderer.onEvents(state, [{ type: 'moved', from: { ...state.pos }, to: { ...state.pos } }]);
      deps.onHeroTap?.(state);
    } else {
      const info = infoAt(state, pos);
      if (info) showTip(info, e.clientX, e.clientY);
    }
  });

  host.addEventListener('pointermove', (e) => {
    if (!state || !renderer || state.status === 'combat') return hideTip();
    const pos = renderer.pick(e.clientX, e.clientY);
    renderer.hover(targetAt(pos)?.to ?? null);
    const info = pos ? infoAt(state, pos) : null;
    if (info) showTip(info, e.clientX, e.clientY);
    else hideTip();
  });

  host.addEventListener('pointerleave', () => {
    hideTip();
    renderer?.hover(null);
  });

  pad.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('button[data-branch]') as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    const a = screen.moveFor(b.dataset['branch'] as Branch);
    if (a) deps.dispatch(a);
  });
  const padHover = (e: Event) => {
    const b = (e.target as Element | null)?.closest?.('button[data-branch]') as HTMLButtonElement | null;
    renderer?.hover(b && view ? targetFor(view, b.dataset['branch'] as Branch) : null);
  };
  pad.addEventListener('focusin', padHover);
  pad.addEventListener('pointerover', padHover);
  pad.addEventListener('focusout', () => renderer?.hover(null));
  pad.addEventListener('pointerleave', () => renderer?.hover(null));

  const screen: MapScreen = {
    setRenderer(r: Renderer | null): void {
      renderer = r;
      shownMap = false;
      mounted = null;
      if (!r) return;
      r.mount(host);
      mounted = host;
      pendingRise = true;
      draw(false);
    },
    update(s: RunState, fresh = false): void {
      state = s;
      view = routeView(s);
      if (fresh) resetHud();
      const hv = hudView(s);
      renderHud(hud, hv, REDUCED);
      renderLog(log, s.log);
      if (danger) renderDanger(danger, hv.lowHp, REDUCED);
      renderPad(pad, view);
      const events: readonly GameEvent[] = s.events;
      // The hop starts from `moved` once the scene is synced to the new position; fight events go to the arena.
      const wasShown = shownMap;
      draw(fresh);
      if (renderer && (wasShown || s.status === 'combat') && !fresh && events.length) renderer.onEvents(s, events);
    },
    view: () => view,
    moveFor(branch: Branch): Action | null {
      if (!view || !exploring()) return null;
      const to = targetFor(view, branch);
      return to ? { type: 'move', to: { ...to } } : null;
    },
  };
  return screen;
}
