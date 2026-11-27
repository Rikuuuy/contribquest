import type { ContributionDay } from '../data/schema';

export type Pos = { col: number; row: number };
/** v1.6: the `boss` and `gate` kinds are removed; the boss lives on the boss node after the last column. */
export type TileKind = 'void' | 'fog' | 'wisp' | 'chest' | 'monster' | 'start';
/** 5 is only used by the boss Monster. */
export type Tier = 1 | 2 | 3 | 4 | 5;

export type DayTile = Pos & {
  /** 0–90, window index. */
  idx: number;
  day: ContributionDay;
  kind: Exclude<TileKind, 'void'>;
  /** 0 for non-fight tiles. */
  tier: 0 | 1 | 2 | 3 | 4;
  /** Chests only. */
  size?: 1 | 2;
  /** v1.6: the day the boss is named after (not on an empty quarter). */
  bestDay?: true;
  /** Lost Ghost raised by either shortfall step. */
  risen?: true;
  /** Gravestone on fog. */
  deco?: boolean;
  resolved: boolean;
  visited: boolean;
  seen: boolean;
};

export type GameMap = {
  cols: 13 | 14;
  rows: 7;
  w0: number;
  /** 91 tiles, index = window index. */
  tiles: DayTile[];
  seed: number;
  /** The best day (naming, source label, trait row). */
  bossIdx: number;
  /** v1.6: the final node after the last column, `{ col: cols, row: tiles[bossIdx].row }`. Not a day tile. */
  bossNode: Pos;
  emptyQuarter: boolean;
  quiet: boolean;
};

/** v1.6: a legal move target; `boss` is true only for the boss node. */
export type RouteOption = { col: number; row: number; boss: boolean };

export type MapError = { code: 'map'; message: string; retry: true; demo: true };
