// What the map shows of the routes (v1.6, design "Routes on screen"). The types come first because both renderers
// and the branch pad read them; `routeView` and `targetFor` arrive with presentation task 12.1.
import type { Pos } from '../../mapgen';
import type { Branch } from '../input';

export type { Branch };

export type RouteTarget = { to: Pos; branch: Branch; key: 'W' | 'D' | 'S' | '→'; boss: boolean; monster: boolean };

export type RouteView = {
  /** [] unless status is exploring and no fight or relic offer is open. */
  targets: RouteTarget[];
  /** Exactly one target: every branch key maps to it, label "→" (or "Boss"). */
  single: boolean;
  /** First column with an unseen tile; `cols` when none. */
  fogFrom: number;
  bossNode: Pos;
  shards: number;
  bound: boolean;
  banished: boolean;
  /** Null on an empty quarter. */
  bestDay: Pos | null;
  week: string;
};
