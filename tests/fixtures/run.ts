// RunState builder for engine tests that need a hand-built hero (newRun builds the real one).
import { loadDemo } from '../../src/data/demo';
import type { ClassId, ContributionSet, RaceId } from '../../src/data/schema';
import { applyStats } from '../../src/engine/classes';
import { startBossFight, startFight } from '../../src/engine/combat';
import { reveal } from '../../src/engine/explore';
import type { Hero, RelicId, RunOptions, RunState, Trait } from '../../src/engine/state';
import { generateMap } from '../../src/mapgen/generate';
import type { DayTile, GameMap, Tier } from '../../src/mapgen/types';

export const NO_TRAIT: Trait = { name: 'Test Trait', text: '', rows: [], hp: 0 };

export type TestRunOptions = {
  set?: ContributionSet;
  cls?: ClassId;
  race?: RaceId;
  relics?: RelicId[];
  level?: number;
  startLevel?: number;
  aura?: number;
  trait?: Trait;
  omen?: Hero['omen'];
  opts?: Partial<RunOptions>;
  defeated?: number;
  /** Overrides applied to the hero after stats are computed (e.g. `hp`). */
  hero?: Partial<Hero>;
};

export function demoSet(): ContributionSet {
  return loadDemo(() => Date.UTC(2026, 10, 19));
}

export function mapOf(set: ContributionSet): GameMap {
  const r = generateMap(set);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

export function makeHero(o: TestRunOptions = {}): Hero {
  const level = o.level ?? 3;
  const h: Hero = {
    name: 'tester',
    cls: o.cls ?? 'wanderer',
    race: o.race ?? 'human',
    xp: 25 * level * (level - 1),
    level,
    startLevel: o.startLevel ?? level,
    aura: o.aura ?? 0,
    trait: o.trait ?? NO_TRAIT,
    total91: 0,
    hp: 0,
    maxHp: 0,
    atk: 0,
    treasure: 0,
    relics: o.relics ? [...o.relics] : [],
    omen: o.omen ?? 'blessed',
  };
  applyStats(h);
  h.hp = h.maxHp;
  return Object.assign(h, o.hero ?? {});
}

/** A run at the map's start tile, exploring, with a hand-built hero. */
export function makeTestRun(o: TestRunOptions = {}): RunState {
  const set = o.set ?? demoSet();
  const map = mapOf(set);
  const s0 = map.tiles[0] as DayTile;
  const s: RunState = {
    version: 1,
    set,
    heroSet: null,
    map,
    hero: makeHero(o),
    pos: { col: s0.col, row: s0.row },
    prev: null,
    rng: map.seed,
    combat: null,
    stats: { steps: 0, defeated: o.defeated ?? 0, chests: 0, wisps: 0, crits: 0, dodges: 0, bossDmg: 0, bossHpLeft: null },
    status: 'exploring',
    bossDown: false,
    shards: 0,
    undying: false,
    killer: null,
    opts: { calm: false, assist: false, ...o.opts },
    log: [],
    events: [],
    relicOffer: null,
    relicTitle: null,
    pendingBlessing: false,
    newTrophies: [],
  };
  s0.visited = true;
  s0.resolved = true;
  reveal(s);
  return s;
}

/** The first unresolved tile matching the predicate. */
export function findTile(s: RunState, pred: (t: DayTile) => boolean): DayTile {
  const t = s.map.tiles.find((x) => !x.resolved && pred(x));
  if (!t) throw new Error('No matching tile.');
  return t;
}

/** Puts the hero next to nothing in particular and starts a fight on the tile (like the prototype's teleport). */
export function fightOn(s: RunState, tile: DayTile): RunState {
  s.prev = { ...s.pos };
  s.pos = { col: tile.col, row: tile.row };
  tile.visited = true;
  reveal(s);
  startFight(s, tile);
  s.events = [];
  return s;
}

/** Puts the hero on the boss node (as if from the last column) and starts the boss fight with the shards held. */
export function bossFightOn(s: RunState, shards = s.shards): RunState {
  const last = s.map.tiles.find((t) => t.col === s.map.cols - 1 && t.row === s.map.bossNode.row) ?? s.map.tiles[90]!;
  s.prev = { col: last.col, row: last.row };
  s.pos = { ...s.map.bossNode };
  s.shards = shards;
  reveal(s);
  startBossFight(s);
  s.events = [];
  return s;
}

/** A run already in a fight with a monster of the given tier (5 = the boss on the boss node, 0 shards). */
export function makeFightRun(tier: Tier, o: TestRunOptions = {}): RunState {
  const s = makeTestRun(o);
  if (tier === 5) return bossFightOn(s);
  const match = (t: DayTile) => t.kind === 'monster' && t.tier === tier;
  if (tier === 1 && !s.map.tiles.some(match)) {
    // The demo map has no Lost Ghost: raise one from a fog tile, as the shortfall would.
    const fog = findTile(s, (t) => t.kind === 'fog');
    Object.assign(fog, { kind: 'monster', tier: 1, risen: true });
  }
  return fightOn(s, findTile(s, match));
}
