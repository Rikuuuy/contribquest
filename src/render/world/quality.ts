// Quality levels and the frame-time step-down for the world renderer (v1.6, pure; requirement 25). No `three`
// import, so it is unit tested in Node.

export type Quality = 'high' | 'medium' | 'low';

export const QUALITY = {
  high: { ratioCap: 2, shadows: true, shadowMap: 2048, fireflies: 1, particles: 1 },
  medium: { ratioCap: 1.5, shadows: true, shadowMap: 1024, fireflies: 1, particles: 1 },
  low: { ratioCap: 1, shadows: false, shadowMap: 0, fireflies: 0.5, particles: 0.5 },
} as const;

export const FRAME_BUDGET = {
  window: 120,
  slowMs: 22,
  minGapMs: 5000,
  mapCalls: 120,
  arenaCalls: 80,
  pointLights: 4,
  poolMap: 256,
  poolArena: 384,
  threeGzipKb: 180,
  phoneMedianMs: 33,
} as const;

/** Frames ignored after a scene is shown (shader compile and texture upload spikes). */
export const WARMUP_FRAMES = 60;

/** `high` on a fine pointer, `medium` on a coarse one (requirement 25.1). */
export function initialQuality(coarse: boolean): Quality {
  return coarse ? 'medium' : 'high';
}

/** `min(devicePixelRatio, ratioCap)`; a ratio ≤ 0 or NaN counts as 1. */
export function pixelRatio(dpr: number, quality: Quality): number {
  const d = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  return Math.min(d, QUALITY[quality].ratioCap);
}

/** A fixed ring buffer of the last 120 frame times in ms. Once full, `median` sorts a preallocated copy (no allocation). */
export class FrameStats {
  readonly times = new Float32Array(FRAME_BUDGET.window);
  private readonly scratch = new Float32Array(FRAME_BUDGET.window);
  private next = 0;
  count = 0;

  push(ms: number): void {
    this.times[this.next] = ms;
    this.next = (this.next + 1) % this.times.length;
    if (this.count < this.times.length) this.count++;
  }

  /** Median of the stored samples (0 when empty). */
  median(): number {
    const n = this.count;
    if (n === 0) return 0;
    let s = this.scratch;
    if (n === this.times.length) {
      s.set(this.times);
      s.sort();
    } else s = this.times.slice(0, n).sort(); // only before the window fills (stats readout, not the frame check)
    return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
  }

  reset(): void {
    this.next = 0;
    this.count = 0;
  }
}

const DOWN: Readonly<Record<Quality, Quality>> = { high: 'medium', medium: 'low', low: 'low' };

/**
 * One step down when the window is full, its median is over 22 ms, and at least 5 s passed since the last change;
 * otherwise `current`. Never steps up (requirement 25.2).
 */
export function nextQuality(stats: FrameStats, current: Quality, now: number, lastChange: number): Quality {
  if (stats.count < FRAME_BUDGET.window) return current;
  if (now - lastChange < FRAME_BUDGET.minGapMs) return current;
  return stats.median() > FRAME_BUDGET.slowMs ? DOWN[current] : current;
}
