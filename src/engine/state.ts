// Run state, actions, and events for the engine reducer (combat-timing design.md "Types").
import type { ClassId, ContributionSet, RaceId } from '../data/schema';
import type { GameMap, Pos, Tier } from '../mapgen';

export type Grade = 'perfect' | 'good' | 'miss';
export type ComboGrade = [Grade, Grade, Grade];
export type StrikeMode = 'bar' | 'combo' | 'charge';
export type GuardMode = 'ring' | 'sidestep' | 'shield';
export type Mode = StrikeMode | GuardMode;
export type Pattern = 'normal' | 'quick' | 'flaky' | 'conflict';
export type Why =
  | 'too early'
  | 'too late'
  | 'too slow'
  | 'too weak'
  | 'overload'
  | 'no shield'
  | 'shield down'
  | 'rubber duck';
export type RelicId = 'duck' | 'hotfix' | 'force' | 'linter' | 'stack' | 'coffee' | 'blame' | 'pair' | 'review' | 'cache';

export type Omen = 'blessed' | 'cursed';
export type TrophyId =
  | 'first'
  | 'self'
  | 'raider'
  | 'blessed'
  | 'cursed'
  | 'flawless'
  | 'close'
  | 'dodges'
  | 'crits'
  | 'relics'
  | 'speed'
  | 'nochest'
  | 'nightmare'
  | 'fullstack';

/** Built by progression (makeTrait). */
export type Trait = { name: string; text: string; rows: number[]; hp: number };

export type Hero = {
  name: string;
  cls: ClassId;
  race: RaceId;
  xp: number;
  level: number;
  startLevel: number;
  aura: number;
  trait: Trait;
  total91: number;
  hp: number;
  maxHp: number;
  atk: number;
  treasure: number;
  relics: RelicId[];
  omen: Omen;
};

export type Monster = {
  name: string;
  tier: Tier;
  hp: number;
  maxHp: number;
  dmg: number;
  xp: number;
  phase2: boolean;
  /** v1.6: true only for a boss fought with SHARD_NO_PHASE2 shards; it never enters phase 2. */
  bound: boolean;
};

export type QteTest = {
  kind: 'attack' | 'defend';
  mode: Mode;
  pattern: Pattern;
  P: number;
  G: number;
  dur: number;
  target: number;
  /** Bar: fraction of dur. */
  zone?: number;
  /** Combo: test times of the three marks. */
  marks?: [number, number, number];
  /** Charge: hold time at which the spell overloads. */
  fill?: number;
  /** Flaky: when the ring stops, and for how long. */
  pauseAt?: number;
  pause?: number;
  /** Conflict: test time of the dashed decoy ring. */
  decoy?: number;
};

export type InputEvent = { type: 'down' | 'up'; t: number; key: string };
export type GradeResult = { grade: Grade | ComboGrade; why?: Why };

export type FightNext =
  | { kind: 'strike'; i: number }
  | { kind: 'choose' }
  | { kind: 'win' }
  | { kind: 'lose' };

export type Fight = {
  col: number;
  row: number;
  m: Monster;
  phase: 'choose' | 'test' | 'wait';
  test: QteTest | null;
  events: InputEvent[];
  testId: number;
  plan: Pattern[];
  /** Index in `plan` of the guard test in progress. */
  strikeIdx: number;
  next: FightNext | null;
  duckUsed: boolean;
  /** Combat log, the last 7 lines. */
  lines: string[];
  /** Grade banner for the view. */
  last: { text: string; cls: Grade } | null;
};

export type RunOptions = { calm: boolean; assist: boolean };

export type RunStats = {
  steps: number;
  defeated: number;
  chests: number;
  wisps: number;
  crits: number;
  dodges: number;
  bossDmg: number;
  bossHpLeft: number | null;
};

export type RunState = {
  version: 1;
  set: ContributionSet;
  heroSet: ContributionSet | null;
  map: GameMap;
  hero: Hero;
  pos: Pos;
  prev: Pos | null;
  rng: number;
  combat: Fight | null;
  stats: RunStats;
  status: 'exploring' | 'combat' | 'relic' | 'won' | 'lost';
  bossDown: boolean;
  shards: number;
  undying: boolean;
  killer: string | null;
  opts: RunOptions;
  /** Map log, the last 4 lines. */
  log: string[];
  /** Emitted by the last step only, for render and audio. */
  events: GameEvent[];
  /** The relics on offer while `status === 'relic'`. */
  relicOffer: RelicId[] | null;
  relicTitle: string | null;
  /** The Commit Blessing is still owed (blessed runs, until the map opens). */
  pendingBlessing: boolean;
  /** Trophies earned by this run, for the results screen. */
  newTrophies: TrophyId[];
};

export type Action =
  /** v1.6: a target from `legalMoves` (map-generation); anything else is ignored. */
  | { type: 'move'; to: Pos }
  | { type: 'chooseClass'; cls: ClassId }
  | { type: 'setOptions'; opts: RunOptions }
  | { type: 'attack' }
  | { type: 'press'; t: number; key: string }
  | { type: 'release'; t: number; key: string }
  | { type: 'timeout'; t: number }
  | { type: 'advance' }
  | { type: 'forceGrade'; grade: Grade | ComboGrade }
  | { type: 'retry' }
  | { type: 'pickRelic'; i: number }
  | { type: 'chooseRace'; race: RaceId }
  | { type: 'enterMap' }
  | { type: 'offerBlessing' }
  | { type: 'trophiesAwarded'; ids: TrophyId[] };

export type GameEvent =
  | { type: 'moved'; from: Pos; to: Pos }
  | { type: 'fightStart'; boss: boolean }
  | { type: 'testStart'; testId: number; mode: Mode; pattern: Pattern }
  | { type: 'graded'; result: GradeResult; text: string }
  | { type: 'heroHit'; grades: Grade[]; dmgs: number[]; killed: boolean }
  | { type: 'monsterHit'; grade: Grade; dmg: number; lethal: boolean }
  | { type: 'counter'; dmg: number; killed: boolean }
  | { type: 'heal'; amount: number; source: 'vampire' | 'hotfix' | 'cache' }
  | { type: 'undying' }
  | { type: 'phase2' }
  | { type: 'timing'; pct: number; maxed: boolean }
  | { type: 'shard'; have: number; max: 3; bound: boolean }
  | { type: 'monsterDown'; boss: boolean }
  | { type: 'won' }
  | { type: 'lost' }
  | { type: 'xp'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'wisp'; col: number; row: number; xp: number; healed: number }
  | { type: 'rest'; col: number; row: number; healed: number }
  | { type: 'chest'; col: number; row: number; gold: number; healed: number }
  | { type: 'relicOffer'; ids: RelicId[]; title: string }
  | { type: 'relicPicked'; id: RelicId }
  | { type: 'raceChosen'; race: RaceId }
  | { type: 'blessingDue' }
  | { type: 'runEnded'; won: boolean };

/** Plain data for the hero-summary screen (progression requirement 13). */
export type SummaryView = {
  title: string;
  range: string;
  identity: string;
  aura: string;
  avatarUrl: string | null;
  stats: { k: string; v: string; sub: string }[];
  trait: { name: string; text: string };
  omen: { kind: Omen; k: string; v: string; text: string };
  quiet: string | null;
  xpTable: { level: number; xp: number; current: boolean }[];
};

/** Plain data for the results screen (progression requirement 8). */
export type ResultsView = {
  won: boolean;
  title: string;
  sub: string;
  game: [string, string][];
  ghTitle: string;
  gh: [string, string][];
  today: string;
};
