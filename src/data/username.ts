import { USERNAME_RE } from './constants';
import { ERROR_TEXT, fail, type Result } from './errors';

/** Trims surrounding whitespace and drops one leading "@". */
export function cleanUsername(raw: string): string {
  return raw.trim().replace(/^@/, '');
}

/** Cleans and checks a username. Returns the cleaned name or an `invalid` error. */
export function validateUsername(raw: string, who: 'self' | 'friend' = 'self'): Result<string> {
  const name = cleanUsername(raw);
  if (!USERNAME_RE.test(name)) {
    return fail('invalid', who === 'friend' ? ERROR_TEXT.invalidFriend : ERROR_TEXT.invalid);
  }
  return { ok: true, value: name };
}
