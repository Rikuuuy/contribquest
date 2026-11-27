// Pure key and pointer mapping for the map screen (prototype keydown handler and tileFromEvent).
// v1.6: movement picks one of up to three branches into the next column; there is no direction key mapping and no left.
import type { Pos } from '../mapgen';
import type { Layout } from './layout';

/** The three forward branches: row − 1, the same row, row + 1 of the next column. */
export type Branch = 'up' | 'ahead' | 'down';

const ROUTE_KEYS: Readonly<Record<string, Branch>> = {
  arrowup: 'up',
  w: 'up',
  arrowright: 'ahead',
  d: 'ahead',
  arrowdown: 'down',
  s: 'down',
};

const ARROWS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** ArrowUp/W → up, ArrowRight/D → ahead, ArrowDown/S → down, in any case; everything else (ArrowLeft/A too) → null. */
export function routeKey(key: string): Branch | null {
  return ROUTE_KEYS[key.toLowerCase()] ?? null;
}

/** True for the four arrow keys, whose browser default (scrolling) the map screen prevents (requirement 2.1). */
export function isArrowKey(key: string): boolean {
  return ARROWS.has(key);
}

/** Keys 1, 2, 3 → relic card 0, 1, 2 while a relic offer is open (requirement 2.3). */
export function relicKey(key: string): 0 | 1 | 2 | null {
  return key === '1' ? 0 : key === '2' ? 1 : key === '3' ? 2 : null;
}

type KeyLike = { key: string; target: EventTarget | null };

/** M toggles mute, except while typing in a text field (requirement 14.5). */
export function isMuteKey(e: KeyLike): boolean {
  if (e.key.toLowerCase() !== 'm') return false;
  const t = e.target as { tagName?: unknown; isContentEditable?: unknown } | null;
  const tag = typeof t?.tagName === 'string' ? t.tagName.toUpperCase() : '';
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && t?.isContentEditable !== true;
}

type RectLike = { left: number; top: number; width: number };

/**
 * The grid cell under client point (`x`, `y`) on a flat map canvas laid out with `L` and shown in `rect`
 * (its bounding client rect). The canvas may be scaled by CSS (`max-width: 100%`), so the point is scaled back
 * to layout pixels first (requirement 16.2). Returns null outside the day grid; the caller checks for void cells.
 */
export function tileFromPoint(L: Layout, rect: RectLike, x: number, y: number): Pos | null {
  if (!(rect.width > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const k = L.w / rect.width;
  const px = (x - rect.left) * k;
  const py = (y - rect.top) * k;
  const step = L.tile + L.gap;
  const col = Math.floor((px - L.ox) / step);
  const row = Math.floor((py - L.oy) / step);
  if (col < 0 || col >= L.cols || row < 0 || row >= L.rows) return null;
  return { col, row };
}
