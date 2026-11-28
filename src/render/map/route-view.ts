// What the map shows of the routes (v1.6, design "Routes on screen"). Pure: the route rules come only from the
// engine (`legalMoves` for targets, each tile's `seen` for fog), so a highlight can never disagree with a move the
// engine accepts. Both renderers and the branch pad read the result.
import { legalMoves, SHARD_NO_PHASE2, type RunState } from '../../engine';
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

const BRANCH_KEY = { up: 'W', ahead: 'D', down: 'S' } as const;

function branchOf(drow: number): Branch {
  return drow < 0 ? 'up' : drow > 0 ? 'down' : 'ahead';
}

/** The route view of a run (requirements 23.1–23.5). */
export function routeView(s: RunState): RouteView {
  const { map } = s;
  const open = s.status === 'exploring' && !s.combat && !s.relicOffer;
  const opts = open ? legalMoves(s) : [];
  const single = opts.length === 1;
  const targets: RouteTarget[] = opts.map((o) => {
    const branch = single ? 'ahead' : branchOf(o.row - s.pos.row);
    const tile = o.boss ? null : map.tiles.find((t) => t.col === o.col && t.row === o.row);
    return {
      to: { col: o.col, row: o.row },
      branch,
      key: single ? '→' : BRANCH_KEY[branch],
      boss: o.boss,
      monster: o.boss || (tile?.kind === 'monster' && !tile.resolved),
    };
  });
  let fogFrom: number = map.cols;
  for (const t of map.tiles) if (!t.seen && t.col < fogFrom) fogFrom = t.col;
  const best = map.emptyQuarter ? undefined : map.tiles.find((t) => t.bestDay);
  return {
    targets,
    single,
    fogFrom,
    bossNode: { ...map.bossNode },
    shards: s.shards,
    bound: s.shards >= SHARD_NO_PHASE2,
    banished: s.bossDown,
    bestDay: best ? { col: best.col, row: best.row } : null,
    week: s.pos.col >= map.cols ? 'Boss' : `Week ${s.pos.col + 1}/${map.cols}`,
  };
}

/** The tile a branch key or pad button moves to, or null when that branch has no legal move. */
export function targetFor(view: RouteView, branch: Branch): Pos | null {
  if (view.single) return view.targets[0]?.to ?? null;
  return view.targets.find((t) => t.branch === branch)?.to ?? null;
}
