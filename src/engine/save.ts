// Pure save and restore of a run (progression design.md "save.ts"). Storage lives in src/data/runstore.ts.
// v1.6: save version 2. The objects below are strict, so a v1.5 shape (a `boss` tile flag, `gateIdx`,
// `shardsNeeded`) is rejected instead of being stripped.
import { z } from 'zod';
import {
  ClassIdSchema,
  ContributionDaySchema,
  ContributionSetSchema,
  RaceIdSchema,
  TrophyIdSchema,
} from '../data/schema';
import { tileAt } from '../mapgen';
import type { RunState } from './state';

export type SavedRun = Omit<RunState, 'events'>;

const int = z.number().int();
const num = z.number();

const GradeSchema = z.enum(['perfect', 'good', 'miss']);
const PatternSchema = z.enum(['normal', 'quick', 'flaky', 'conflict']);
const ModeSchema = z.enum(['bar', 'combo', 'charge', 'ring', 'sidestep', 'shield']);
const RelicIdSchema = z.enum(['duck', 'hotfix', 'force', 'linter', 'stack', 'coffee', 'blame', 'pair', 'review', 'cache']);
const TierSchema = z.literal([1, 2, 3, 4, 5]);
const PosSchema = z.object({ col: int, row: int });

const DayTileSchema = z.strictObject({
  col: int,
  row: int,
  idx: int.min(0).max(90),
  day: ContributionDaySchema,
  kind: z.enum(['fog', 'wisp', 'chest', 'monster', 'start']),
  tier: z.literal([0, 1, 2, 3, 4]),
  size: z.literal([1, 2]).optional(),
  bestDay: z.literal(true).optional(),
  risen: z.literal(true).optional(),
  deco: z.boolean().optional(),
  resolved: z.boolean(),
  visited: z.boolean(),
  seen: z.boolean(),
});

const GameMapSchema = z.strictObject({
  cols: z.literal([13, 14]),
  rows: z.literal(7),
  w0: int,
  tiles: z.array(DayTileSchema).length(91),
  seed: int,
  bossIdx: int.min(0).max(90),
  bossNode: PosSchema,
  emptyQuarter: z.boolean(),
  quiet: z.boolean(),
});

const HeroSchema = z.strictObject({
  name: z.string(),
  cls: ClassIdSchema,
  race: RaceIdSchema,
  xp: num,
  level: int,
  startLevel: int,
  aura: int,
  trait: z.object({ name: z.string(), text: z.string(), rows: z.array(int), hp: int }),
  total91: int,
  hp: num,
  maxHp: num,
  atk: num,
  treasure: num,
  relics: z.array(RelicIdSchema),
  omen: z.enum(['blessed', 'cursed']),
});

const MonsterSchema = z.strictObject({
  name: z.string(),
  tier: TierSchema,
  hp: num,
  maxHp: num,
  dmg: num,
  xp: num,
  phase2: z.boolean(),
  bound: z.boolean(),
});

const QteTestSchema = z.strictObject({
  kind: z.enum(['attack', 'defend']),
  mode: ModeSchema,
  pattern: PatternSchema,
  P: num,
  G: num,
  dur: num,
  target: num,
  zone: num.optional(),
  marks: z.tuple([num, num, num]).optional(),
  fill: num.optional(),
  pauseAt: num.optional(),
  pause: num.optional(),
  decoy: num.optional(),
});

const FightNextSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('strike'), i: int }),
  z.strictObject({ kind: z.literal('choose') }),
  z.strictObject({ kind: z.literal('win') }),
  z.strictObject({ kind: z.literal('lose') }),
]);

const FightSchema = z.strictObject({
  col: int,
  row: int,
  m: MonsterSchema,
  phase: z.enum(['choose', 'test', 'wait']),
  test: QteTestSchema.nullable(),
  events: z.array(z.object({ type: z.enum(['down', 'up']), t: num, key: z.string() })),
  testId: int,
  plan: z.array(PatternSchema),
  strikeIdx: int,
  next: FightNextSchema.nullable(),
  duckUsed: z.boolean(),
  lines: z.array(z.string()),
  last: z.object({ text: z.string(), cls: GradeSchema }).nullable(),
});

/** Every RunState field except `events` (FR-SAV-1). A save that fails this schema is "no save". */
export const SavedRunSchema = z.strictObject({
  version: z.literal(2),
  set: ContributionSetSchema,
  heroSet: ContributionSetSchema.nullable(),
  map: GameMapSchema,
  hero: HeroSchema,
  pos: PosSchema,
  prev: PosSchema.nullable(),
  rng: int,
  combat: FightSchema.nullable(),
  stats: z.strictObject({
    steps: int,
    defeated: int,
    chests: int,
    wisps: int,
    crits: int,
    dodges: int,
    bossDmg: num,
    bossHpLeft: num.nullable(),
  }),
  status: z.enum(['exploring', 'combat', 'relic', 'won', 'lost']),
  bossDown: z.boolean(),
  shards: int.min(0).max(3),
  undying: z.boolean(),
  killer: z.string().nullable(),
  opts: z.object({ calm: z.boolean(), assist: z.boolean() }),
  log: z.array(z.string()),
  relicOffer: z.array(RelicIdSchema).nullable(),
  relicTitle: z.string().nullable(),
  pendingBlessing: z.boolean(),
  newTrophies: z.array(TrophyIdSchema),
});

/** A JSON-safe copy of the run without the per-step `events` (requirement 10.2). */
export function serialize(s: RunState): SavedRun {
  const { events: _events, ...rest } = s;
  return structuredClone(rest);
}

/**
 * The position invariant Zod cannot express (requirement 10.3): a day tile before the boss node, or the
 * boss node itself during the boss fight or after the run ended.
 */
function posValid(s: SavedRun): boolean {
  const { pos, map } = s;
  if (pos.col < map.cols && tileAt(map, pos.col, pos.row)) return true;
  if (pos.col !== map.bossNode.col || pos.row !== map.bossNode.row) return false;
  return (s.status === 'combat' && s.combat?.m.tier === 5) || s.status === 'won' || s.status === 'lost';
}

/**
 * The run in a save, or null for anything that fails the schema (a prototype or v1.5 save, another version,
 * non-JSON) or has a bad `pos`. A fight in a timing test resumes at the Attack choice (FR-COM-7); a fight in
 * `wait` is kept.
 */
export function restore(json: unknown): RunState | null {
  const r = SavedRunSchema.safeParse(json);
  if (!r.success) return null;
  const saved = r.data as SavedRun;
  if (!posValid(saved)) return null;
  const s = { ...saved, events: [] } as RunState;
  if (s.combat && s.combat.phase === 'test') {
    s.combat.phase = 'choose';
    s.combat.test = null;
    s.combat.events = [];
  }
  return s;
}

/** The start screen's continue button (requirement 10.5). The social spec adds the raid wording. */
export function continueLabel(saved: SavedRun): string {
  return `Continue ${saved.set.username}'s run`;
}
