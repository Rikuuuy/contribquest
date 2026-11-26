import { describe, expect, it } from 'vitest';
import type { ContributionDay } from '../../src/data/schema';
import { makeTrait } from '../../src/engine/trait';
import { windowDays } from '../fixtures/sets';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sum = (days: ContributionDay[]) => days.reduce((a, d) => a + d.count, 0);
const wd = (d: ContributionDay) => new Date(d.date + 'T00:00:00Z').getUTCDay();

/** 91 empty days, except the first day of each weekday, which gets `perWeekday[weekday]`. */
function once(perWeekday: number[]): ContributionDay[] {
  const seen = new Set<number>();
  const base = windowDays(() => ({ count: 0 }));
  return base.map((d) => {
    const w = wd(d);
    if (seen.has(w)) return d;
    seen.add(w);
    return { ...d, count: perWeekday[w] ?? 0 };
  });
}

describe('Weekday trait (makeTrait)', () => {
  it('Blank Slate when total91 is 0', () => {
    expect(makeTrait(windowDays(() => ({ count: 0 })), 0)).toEqual({
      name: 'Blank Slate',
      text: '+5 max HP. Every quest starts somewhere.',
      rows: [],
      hp: 5,
    });
  });

  it('Weekend Warrior at exactly 40% on Saturday and Sunday', () => {
    const days = once([2, 1, 1, 2, 1, 1, 2]); // 4 of 10
    expect(makeTrait(days, sum(days))).toEqual({
      name: 'Weekend Warrior',
      text: '+2 ATK when fighting in the Saturday and Sunday rows.',
      rows: [0, 6],
      hp: 0,
    });
  });

  it('just under 40% is a weekday Slayer', () => {
    const days = once([2, 1, 1, 4, 1, 1, 2]); // 4 of 12
    expect(makeTrait(days, sum(days)).name).toBe('Wednesday Slayer');
  });

  it('each weekday can be the Slayer, with the row and text', () => {
    for (let w = 0; w < 7; w++) {
      const weekend = w === 0 || w === 6;
      const per = [1, 1, 1, 1, 1, 1, 1];
      per[w] = weekend ? 3 : 20;
      if (weekend) per[w === 0 ? 6 : 0] = 0; // weekend share 3 of 8, under 40%
      const days = once(per);
      const name = WEEKDAYS[w] as string;
      expect(makeTrait(days, sum(days))).toEqual({
        name: `${name} Slayer`,
        text: `${name} is your busiest day: +2 ATK when fighting in the ${name} row.`,
        rows: [w],
        hp: 0,
      });
    }
  });

  it('ties go to the earlier weekday, Sunday first', () => {
    const tie = once([0, 3, 0, 3, 0, 0, 0]);
    expect(makeTrait(tie, sum(tie)).rows).toEqual([1]);
    const sunday = once([1, 1, 1, 1, 1, 1, 0]); // weekend 1 of 6: under 40%
    expect(makeTrait(sunday, sum(sunday)).name).toBe('Sunday Slayer');
  });
});
