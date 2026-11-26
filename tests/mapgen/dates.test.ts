import { describe, expect, it } from 'vitest';
import { addDays, fmtDate, fmtShort, parseDate, weekday } from '../../src/mapgen/dates';

describe('UTC date helpers', () => {
  it('parses at UTC midnight', () => {
    expect(parseDate('2026-11-03').toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('gives the weekday of known dates (0 = Sunday)', () => {
    expect(weekday('2026-11-15')).toBe(0);
    expect(weekday('2026-11-16')).toBe(1);
    expect(weekday('2026-11-03')).toBe(2);
    expect(weekday('2026-11-14')).toBe(6);
    expect(weekday('2000-01-01')).toBe(6);
  });

  it('formats long and short dates', () => {
    expect(fmtDate('2026-11-03')).toBe('Tue 3 Nov 2026');
    expect(fmtShort('2026-11-03')).toBe('3 Nov');
  });

  it('rolls over months and years in addDays', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-16', -90)).toBe('2026-08-18');
  });
});
