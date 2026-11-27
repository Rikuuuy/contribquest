// Map tooltip text (prototype tileInfo; requirement 8.2, v1.6). Pure: plain strings, the screen escapes and
// lays them out.
import { TIER_NAMES } from '../../engine';
import { EMPTY_QUARTER_BOSS } from '../../engine/monsters';
import { fmtDate, type DayTile, type GameMap } from '../../mapgen';

/** `when` is "{fmtDate} · {count} contribution{s}"; `best` is the third line on the best-day tile, else null. */
export type TileInfo = { when: string; what: string; best: string | null };

const KIND_LABEL = { fog: 'A quiet day', wisp: 'A soul wisp', chest: 'A chest', start: 'The crypt where you woke' } as const;

export const BEST_DAY_LINE = 'The Phantom rose from this day.';

/** The tooltip lines for a day tile. Unseen tiles hide their contents, but the best-day line shows even in fog. */
export function tileInfo(t: DayTile): TileInfo {
  const n = t.day.count;
  const when = `${fmtDate(t.day.date)} · ${n} contribution${n === 1 ? '' : 's'}`;
  let what: string;
  if (!t.seen && t.kind !== 'start') what = 'Hidden in the fog';
  else if (t.kind === 'monster') {
    const name = TIER_NAMES[(t.tier || 1) as 1 | 2 | 3 | 4];
    what = t.resolved ? `${name}, banished` : name;
  } else {
    const tail = t.resolved && (t.kind === 'chest' || t.kind === 'wisp') ? ', taken' : t.resolved && t.kind === 'fog' ? ', rested' : '';
    what = KIND_LABEL[t.kind] + tail;
  }
  return { when, what, best: t.bestDay ? BEST_DAY_LINE : null };
}

/** The boss node's tooltip: "The Phantom of {fmtDate}" over "Waits after the last week" or "Banished". */
export function bossInfo(map: GameMap, banished: boolean): TileInfo {
  const best = map.tiles[map.bossIdx];
  const when = map.emptyQuarter || !best ? EMPTY_QUARTER_BOSS : `The Phantom of ${fmtDate(best.day.date)}`;
  return { when, what: banished ? 'Banished' : 'Waits after the last week', best: null };
}
