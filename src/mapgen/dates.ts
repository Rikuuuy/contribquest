// UTC date helpers, ported from prototype/index.html. Dates are `YYYY-MM-DD`; the device clock is never read.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function parseDate(d: string): Date {
  return new Date(d + 'T00:00:00Z');
}

/** 0 = Sunday. */
export function weekday(d: string): number {
  return parseDate(d).getUTCDay();
}

export function addDays(d: string, n: number): string {
  const dt = parseDate(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** "Tue 3 Nov 2026". */
export function fmtDate(d: string): string {
  const dt = parseDate(d);
  const wd = WEEKDAYS[dt.getUTCDay()] as string;
  return `${wd.slice(0, 3)} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/** "3 Nov". */
export function fmtShort(d: string): string {
  const dt = parseDate(d);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}
