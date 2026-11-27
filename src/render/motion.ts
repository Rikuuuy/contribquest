// Reduced motion (prototype REDUCED). v1.6: kept current on the media query's `change` event and announced
// to listeners such as the renderer (`renderer.setReduced`).

const QUERY = '(prefers-reduced-motion: reduce)';
const mq: MediaQueryList | null = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(QUERY) : null;

/** True while the player asks for reduced motion. Off where `matchMedia` is missing (Node tests). */
export let REDUCED = mq?.matches ?? false;

const listeners = new Set<(reduced: boolean) => void>();

mq?.addEventListener('change', (e) => {
  REDUCED = e.matches;
  for (const fn of listeners) fn(REDUCED);
});

/** Calls `fn` on every change of the reduced-motion preference; returns the unsubscribe function. */
export function onReducedChange(fn: (reduced: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
