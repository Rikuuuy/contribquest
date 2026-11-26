// Readable errors returned by src/data. Nothing past this boundary throws on bad input.

export type DataErrorCode = 'invalid' | 'notfound' | 'ratelimit' | 'unavailable' | 'bad';

/** Every error offers both retry and demo mode. */
export type DataError = { code: DataErrorCode; message: string; retry: true; demo: true };

export type Result<T, E = DataError> = { ok: true; value: T } | { ok: false; error: E };

/** Message text, exactly as in the prototype. */
export const ERROR_TEXT = {
  invalid: 'That is not a valid GitHub username.',
  invalidFriend: "Your friend's username is not a valid GitHub username.",
  notfound: (username: string): string => `No GitHub user called "${username}" was found.`,
  ratelimit: 'Too many summonings at once. Wait a few seconds and try again.',
  unavailable: 'The contribution source is not answering right now.',
  badShape: 'The data source returned something unexpected.',
  badDay: 'The data source returned a day we could not read.',
  badShort: 'Not enough calendar data to raise a map.',
} as const;

export function dataError(code: DataErrorCode, message: string): DataError {
  return { code, message, retry: true, demo: true };
}

export function fail<T>(code: DataErrorCode, message: string): Result<T> {
  return { ok: false, error: dataError(code, message) };
}
