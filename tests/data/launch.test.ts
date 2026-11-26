import { describe, expect, it } from 'vitest';
import { parseLaunch } from '../../src/data/launch';

describe('parseLaunch', () => {
  it('FR-IMP-6: ?demo with or without a value starts demo mode', () => {
    expect(parseLaunch('?demo')).toEqual({ kind: 'demo' });
    expect(parseLaunch('?demo=1')).toEqual({ kind: 'demo' });
  });

  it('FR-IMP-6: demo wins over u and vs', () => {
    expect(parseLaunch('?demo&u=x')).toEqual({ kind: 'demo' });
    expect(parseLaunch('?u=x&vs=y&demo')).toEqual({ kind: 'demo' });
  });

  it('FR-IMP-6: ?u loads that profile', () => {
    expect(parseLaunch('?u=x')).toEqual({ kind: 'user', username: 'x', friend: null });
  });

  it('FR-SOC-1: ?u with ?vs carries the friend', () => {
    expect(parseLaunch('?u=x&vs=y')).toEqual({ kind: 'user', username: 'x', friend: 'y' });
    expect(parseLaunch('?u=x&vs=')).toEqual({ kind: 'user', username: 'x', friend: null });
  });

  it('FR-SOC-3: only ?vs is a challenge launch', () => {
    expect(parseLaunch('?vs=y')).toEqual({ kind: 'challenge', friend: 'y' });
    expect(parseLaunch('?u=&vs=y')).toEqual({ kind: 'challenge', friend: 'y' });
  });

  it('FR-IMP-6: nothing relevant is a none launch', () => {
    expect(parseLaunch('')).toEqual({ kind: 'none' });
    expect(parseLaunch('?')).toEqual({ kind: 'none' });
    expect(parseLaunch('?u=&vs=')).toEqual({ kind: 'none' });
    expect(parseLaunch('?other=1')).toEqual({ kind: 'none' });
  });
});
