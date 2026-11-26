import type { ContributionDay } from '../data/schema';

export type Pos = { col: number; row: number };
export type TileKind = 'void' | 'fog' | 'wisp' | 'chest' | 'monster' | 'boss' | 'start' | 'gate';
export type Tier = 1 | 2 | 3 | 4 | 5;

export type DayTile = Pos & {
  /** 0–90, window index. */
  idx: number;
  day: ContributionDay;
  kind: Exclude<TileKind, 'void'>;
  /** 0 for non-fight tiles. */
  tier: 0 | Tier;
  /** Chests only. */
  size?: 1 | 2;
  /** The boss tile, including a boss on the Gate. */
  boss?: true;
  /** Lost Ghost raised by the shortfall. */
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
  bossIdx: number;
  gateIdx: 90;
  emptyQuarter: boolean;
  quiet: boolean;
  shardsNeeded: 0 | 1 | 2 | 3;
};

export type MapError = { code: 'map'; message: string; retry: true; demo: true };
