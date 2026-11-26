// The weekday trait (prototype makeTrait).
import type { ContributionDay } from '../data/schema';
import { WEEKDAYS, weekday } from '../mapgen/dates';
import { BLANK_SLATE_HP, TRAIT_ATK, WEEKEND_SHARE } from './balance';
import type { Trait } from './state';

export function makeTrait(days: readonly ContributionDay[], total91: number): Trait {
  if (total91 === 0) return { name: 'Blank Slate', text: '+5 max HP. Every quest starts somewhere.', rows: [], hp: BLANK_SLATE_HP };
  const per = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) {
    const w = weekday(d.date);
    per[w] = (per[w] as number) + d.count;
  }
  if (((per[0] as number) + (per[6] as number)) / total91 >= WEEKEND_SHARE)
    return {
      name: 'Weekend Warrior',
      text: `+${TRAIT_ATK} ATK when fighting in the Saturday and Sunday rows.`,
      rows: [0, 6],
      hp: 0,
    };
  let w = 0;
  for (let i = 1; i < 7; i++) if ((per[i] as number) > (per[w] as number)) w = i;
  const day = WEEKDAYS[w] as string;
  return {
    name: `${day} Slayer`,
    text: `${day} is your busiest day: +${TRAIT_ATK} ATK when fighting in the ${day} row.`,
    rows: [w],
    hp: 0,
  };
}
