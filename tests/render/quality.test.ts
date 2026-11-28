import { describe, expect, it } from 'vitest';
import { FRAME_BUDGET, FrameStats, initialQuality, nextQuality, pixelRatio, QUALITY, type Quality } from '../../src/render/world/quality';

/** A full window of `n` samples at `ms` each. */
function filled(ms: number, n: number = FRAME_BUDGET.window): FrameStats {
  const s = new FrameStats();
  for (let i = 0; i < n; i++) s.push(ms);
  return s;
}

describe('requirement 25.1: start', () => {
  it('starts at high on a fine pointer and medium on a coarse one', () => {
    expect(initialQuality(false)).toBe('high');
    expect(initialQuality(true)).toBe('medium');
  });

  it('caps the pixel ratio per level and treats bad ratios as 1', () => {
    expect(pixelRatio(3, 'high')).toBe(2);
    expect(pixelRatio(3, 'medium')).toBe(1.5);
    expect(pixelRatio(3, 'low')).toBe(1);
    expect(pixelRatio(1, 'high')).toBe(1);
    expect(pixelRatio(0, 'high')).toBe(1);
    expect(pixelRatio(Number.NaN, 'high')).toBe(1);
  });

  it('matches the quality table in requirement 25.2', () => {
    expect(QUALITY.medium).toMatchObject({ ratioCap: 1.5, shadowMap: 1024, shadows: true });
    expect(QUALITY.low).toMatchObject({ ratioCap: 1, shadows: false, fireflies: 0.5, particles: 0.5 });
  });
});

describe('FrameStats', () => {
  it('keeps the last 120 samples in a fixed buffer', () => {
    const s = new FrameStats();
    const buf = s.times;
    for (let i = 0; i < 300; i++) s.push(i < 180 ? 100 : 10);
    expect(s.count).toBe(120);
    expect(s.times).toBe(buf);
    expect(s.median()).toBe(10);
  });

  it('takes the median of an even and a partial window', () => {
    const s = new FrameStats();
    expect(s.median()).toBe(0);
    for (const v of [5, 1, 9]) s.push(v);
    expect(s.median()).toBe(5);
    s.push(7);
    expect(s.median()).toBe(6);
  });
});

describe('requirement 25.2: step-down', () => {
  it('does not change before 120 samples', () => {
    expect(nextQuality(filled(40, 119), 'high', 10_000, -Infinity)).toBe('high');
  });

  it('does not change within 5 s of the last change', () => {
    expect(nextQuality(filled(40), 'high', 10_000, 5_001)).toBe('high');
    expect(nextQuality(filled(40), 'high', 10_000, 5_000)).toBe('medium');
  });

  it('steps down one level when the median is 23 ms, not at 22 ms', () => {
    expect(nextQuality(filled(23), 'high', 10_000, -Infinity)).toBe('medium');
    expect(nextQuality(filled(23), 'medium', 10_000, -Infinity)).toBe('low');
    expect(nextQuality(filled(22), 'high', 10_000, -Infinity)).toBe('high');
  });

  it('never goes below low', () => {
    expect(nextQuality(filled(80), 'low', 10_000, -Infinity)).toBe('low');
  });

  it('never steps up', () => {
    const levels: Quality[] = ['high', 'medium', 'low'];
    for (const q of levels) expect(nextQuality(filled(1), q, 10_000, -Infinity)).toBe(q);
  });
});
