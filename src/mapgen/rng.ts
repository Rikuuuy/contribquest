// Hash and seeded RNG, ported from prototype/index.html (fnv1a, makeRng = mulberry32).

/** 32-bit FNV-1a over UTF-16 code units. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One mulberry32 step: the draw in [0, 1) and the next state. */
export function nextFloat(state: number): [value: number, state: number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export type Rng = { state: number; next(): number };

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    get state() {
      return s;
    },
    set state(v: number) {
      s = v >>> 0;
    },
    next() {
      const [value, state] = nextFloat(s);
      s = state;
      return value;
    },
  };
}

/** Fisher-Yates, the same loop as the prototype's shortfall shuffle. */
export function shuffleInPlace<T>(arr: T[], next: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
}
