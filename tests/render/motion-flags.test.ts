import { describe, expect, it } from 'vitest';
import { motionFlags } from '../../src/render/world/motion-flags';

const KEYS = [
  'cameraEase',
  'rise',
  'bob',
  'rigs',
  'frames',
  'flicker',
  'fireflyDrift',
  'fogDrift',
  'petals',
  'pulse',
  'hop',
  'flashes',
  'whiteOut',
  'shake',
  'hitStop',
  'slowMo',
  'textRise',
];

describe('requirement 26: world reduced-motion flags', () => {
  it('has exactly the design flags', () => {
    expect(Object.keys(motionFlags(false)).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(motionFlags(true)).sort()).toEqual([...KEYS].sort());
  });

  it('turns every motion on without reduced motion', () => {
    for (const k of KEYS) expect(motionFlags(false)[k as keyof ReturnType<typeof motionFlags>]).toBe(true);
  });

  it('turns every motion off with reduced motion', () => {
    for (const k of KEYS) expect(motionFlags(true)[k as keyof ReturnType<typeof motionFlags>]).toBe(false);
  });

  it('returns frozen shared objects', () => {
    expect(motionFlags(true)).toBe(motionFlags(true));
    expect(Object.isFrozen(motionFlags(false))).toBe(true);
  });
});
