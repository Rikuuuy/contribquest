// The drawing back end behind one interface (v1.6, design "Types"). The world renderer (`./world/index.ts`,
// Three.js) implements it now; the flat fallback and `createRenderer` with the swap arrive with task 13.1.
import type { GameEvent, RunState } from '../engine';
import type { GameMap, Pos } from '../mapgen';
import type { RouteView } from './map/route-view';

export type RendererKind = 'world' | 'flat';

export interface Renderer {
  kind: RendererKind;
  /** Moves the canvas (and overlay) into `host` and resizes to it. */
  mount(host: HTMLElement): void;
  showTeaser(map: GameMap): void;
  showMap(state: RunState, view: RouteView, opts: { rise: boolean }): void;
  showFight(state: RunState): void;
  /** Effects and animations for the last step's events; never dispatches. */
  onEvents(state: RunState, events: readonly GameEvent[]): void;
  /** The tile or boss node under the pointer, or null. */
  pick(clientX: number, clientY: number): Pos | null;
  /** Brightens the highlight on `pos` (pointer hover or pad focus); null clears (requirement 23.1). */
  hover(pos: Pos | null): void;
  setReduced(on: boolean): void;
  /** No frames until the next `show*`. */
  stop(): void;
  dispose(): void;
}
