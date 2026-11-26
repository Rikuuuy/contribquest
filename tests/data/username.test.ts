import { describe, expect, it } from 'vitest';
import { cleanUsername, validateUsername } from '../../src/data/username';

const INVALID = 'That is not a valid GitHub username.';
const INVALID_FRIEND = "Your friend's username is not a valid GitHub username.";

describe('username', () => {
  it('FR-IMP-1: accepts letters, digits, and single inner hyphens', () => {
    for (const name of ['octocat', 'a', 'A1', 'my-name', 'a-b-c', '0day']) {
      expect(validateUsername(name)).toEqual({ ok: true, value: name });
    }
  });

  it('FR-IMP-1: rejects an empty name', () => {
    const r = validateUsername('');
    expect(r).toEqual({ ok: false, error: { code: 'invalid', message: INVALID, retry: true, demo: true } });
    expect(validateUsername('   ').ok).toBe(false);
  });

  it('FR-IMP-1: accepts 39 characters and rejects 40', () => {
    expect(validateUsername('a'.repeat(39)).ok).toBe(true);
    expect(validateUsername('a'.repeat(40)).ok).toBe(false);
  });

  it('FR-IMP-1: rejects leading, trailing, and double hyphens', () => {
    for (const name of ['-abc', 'abc-', 'ab--c', '-']) expect(validateUsername(name).ok).toBe(false);
  });

  it('FR-IMP-1: rejects other characters', () => {
    for (const name of ['a_b', 'a.b', 'a b', 'a/b', 'ü']) expect(validateUsername(name).ok).toBe(false);
  });

  it('FR-IMP-1: drops one leading @ and surrounding whitespace', () => {
    expect(cleanUsername('  @octocat \n')).toBe('octocat');
    expect(validateUsername('@octocat')).toEqual({ ok: true, value: 'octocat' });
    expect(validateUsername('\toctocat  ')).toEqual({ ok: true, value: 'octocat' });
    expect(validateUsername('@@octocat').ok).toBe(false);
  });

  it('FR-SOC-1: a bad friend name gets the friend message', () => {
    const r = validateUsername('bad--name', 'friend');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe(INVALID_FRIEND);
    expect(validateUsername('pal', 'friend')).toEqual({ ok: true, value: 'pal' });
  });
});
