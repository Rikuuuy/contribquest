import { describe, expect, it } from 'vitest';
import { fnv1a, makeRng, nextFloat, shuffleInPlace } from '../../src/mapgen/rng';

// Expected values were computed by evaluating the prototype's makeRng and fnv1a in Node.
describe('fnv1a', () => {
  it('matches the prototype hashes', () => {
    expect(fnv1a('')).toBe(2166136261);
    expect(fnv1a('a')).toBe(3826002220);
    expect(fnv1a('2026-11-03')).toBe(1931355298);
  });

  it('gives the demo map seed', () => {
    expect(fnv1a('demo-necromancer|2026-11-16')).toBe(722674249);
  });
});

describe('makeRng (mulberry32)', () => {
  it('matches the prototype for the first 5 draws of seed 1', () => {
    const r = makeRng(1);
    expect([r.next(), r.next(), r.next(), r.next(), r.next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849,
    ]);
  });

  it('exposes a uint32 state that can be read and restored', () => {
    const r = makeRng(-1);
    expect(r.state).toBe(0xffffffff);
    r.next();
    const saved = r.state;
    const a = [r.next(), r.next()];
    r.state = saved;
    expect([r.next(), r.next()]).toEqual(a);
  });

  it('nextFloat is the same step in state-in, state-out form', () => {
    const r = makeRng(1);
    const [v, s] = nextFloat(1);
    expect(v).toBe(r.next());
    expect(s).toBe(r.state);
  });
});

describe('shuffleInPlace', () => {
  it('matches the prototype Fisher-Yates loop', () => {
    const r = makeRng(42);
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    shuffleInPlace(arr, () => r.next());
    expect(arr).toEqual([0, 7, 3, 5, 2, 1, 8, 9, 4, 6]);
    expect(r.state).toBe(3599190471);
  });

  it('draws len − 1 times', () => {
    let calls = 0;
    shuffleInPlace([1, 2, 3, 4], () => {
      calls++;
      return 0;
    });
    expect(calls).toBe(3);
  });
});
