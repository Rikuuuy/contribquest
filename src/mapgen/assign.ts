// Tile kinds and tiers per day (game-rules.md "Tile assignment").
import type { ContributionDay } from '../data/schema';
import type { Cell } from './layout';
import { fnv1a } from './rng';
import { CHEST_MOD, DECO_MOD, EMPTY_QUARTER_IDX } from './rules';
import type { DayTile } from './types';

/** Highest count among indexes 1–90, latest on ties; index 45 and `emptyQuarter` when that count is 0. */
export function bestDayIndex(days: readonly ContributionDay[]): { idx: number; emptyQuarter: boolean } {
  let best = -1;
  days.forEach((d, i) => {
    if (i > 0 && (best < 0 || d.count >= (days[best] as ContributionDay).count)) best = i;
  });
  if (best < 0 || (days[best] as ContributionDay).count === 0) return { idx: EMPTY_QUARTER_IDX, emptyQuarter: true };
  return { idx: best, emptyQuarter: false };
}

/**
 * v1.6 rule table (game-rules.md "Tile assignment"): no `boss` or `gate` kind; the best day and index 90 follow
 * the level table like any other day. The best day is flagged `bestDay` unless the map is an empty quarter.
 */
export function assignTiles(
  days: readonly ContributionDay[],
  cells: Cell[],
  best: { idx: number; emptyQuarter: boolean },
): DayTile[] {
  return cells.map((c) => {
    const day = days[c.idx] as ContributionDay;
    const t: DayTile = {
      col: c.col,
      row: c.row,
      day,
      idx: c.idx,
      kind: 'fog',
      tier: 0,
      resolved: false,
      visited: false,
      seen: false,
    };
    const h = fnv1a(day.date);
    if (c.idx === 0) t.kind = 'start';
    else
      switch (day.level) {
        case 0:
          t.kind = 'fog';
          t.deco = h % DECO_MOD === 0;
          break;
        case 1:
          t.kind = 'wisp';
          break;
        case 2:
          if (h % CHEST_MOD === 0) {
            t.kind = 'chest';
            t.size = 1;
          } else {
            t.kind = 'monster';
            t.tier = 2;
          }
          break;
        case 3:
          if (h % CHEST_MOD === 0) {
            t.kind = 'chest';
            t.size = 2;
          } else {
            t.kind = 'monster';
            t.tier = 3;
          }
          break;
        case 4:
          t.kind = 'monster';
          t.tier = 4;
          break;
      }
    if (c.idx === best.idx && !best.emptyQuarter) t.bestDay = true;
    return t;
  });
}
