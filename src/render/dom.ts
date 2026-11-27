// DOM helpers shared by the screens (prototype $, esc, show, sizeCanvas).

/** The first element matching `sel`; throws when the markup lacks it, which is a programming error. */
export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
}

const ESC: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for use inside HTML markup and attribute values. */
export function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

export type ScreenId = 'screen-start' | 'screen-loading' | 'screen-summary' | 'screen-map' | 'screen-end';

/**
 * Shows one screen and hides the others, scrolls to the top, and clears the low-HP overlay (requirement 1.5).
 * The music mode is set by the caller once audio exists (presentation group 9).
 */
export function show(id: ScreenId, root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.screen').forEach((s) => {
    s.hidden = s.id !== id;
  });
  root.querySelector('#danger')?.classList.remove('on');
  globalThis.scrollTo?.(0, 0);
}

/**
 * Sizes a 2D canvas to `w` × `h` CSS pixels at the device pixel ratio, with smoothing off,
 * and returns its context already scaled so callers draw in CSS pixels.
 */
export function sizeCanvas(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = globalThis.devicePixelRatio > 0 ? globalThis.devicePixelRatio : 1;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
