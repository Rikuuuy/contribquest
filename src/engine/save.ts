// Pure save and restore of a run (progression design.md "save.ts"). Storage lives in src/data/runstore.ts.
import { z } from 'zod';
import {
  ClassIdSchema,
  ContributionDaySchema,
  ContributionSetSchema,
  RaceIdSchema,
  TrophyIdSchema,
} from '../data/schema';
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

const DayTileSchema = z.object({
  col: int,
  row: int,
  idx: int.min(0).max(90),
  day: ContributionDaySchema,
  kind: z.enum(['fog', 'wisp', 'chest', 'monster', 'boss', 'start', 'gate']),
  tier: z.literal([0, 1, 2, 3, 4, 5]),
  size: z.literal([1, 2]).optional(),
  boss: z.literal(true).optional(),
  risen: z.literal(true).optional(),
  deco: z.boolean().optional(),
  resolved: z.boolean(),
  visited: z.boolean(),
  seen: z.boolean(),
});

const GameMapSchema = z.object({
  cols: z.literal([13, 14]),
  rows: z.literal(7),
  w0: int,
  tiles: z.array(DayTileSchema).length(91),
  seed: int,
  bossIdx: int.min(0).max(90),
  gateIdx: z.literal(90),
  emptyQuarter: z.boolean(),
  quiet: z.boolean(),
  shardsNeeded: z.literal([0, 1, 2, 3]),
});

const HeroSchema = z.object({
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

const MonsterSchema = z.object({
  name: z.string(),
  tier: TierSchema,
  hp: num,
  maxHp: num,
  dmg: num,
  xp: num,
  phase2: z.boolean(),
});

const QteTestSchema = z.object({
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
  z.object({ kind: z.literal('strike'), i: int }),
  z.object({ kind: z.literal('choose') }),
  z.object({ kind: z.literal('win') }),
  z.object({ kind: z.literal('lose') }),
]);

const FightSchema = z.object({
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
export const SavedRunSchema = z.object({
  version: z.literal(1),
  set: ContributionSetSchema,
  heroSet: ContributionSetSchema.nullable(),
  map: GameMapSchema,
  hero: HeroSchema,
  pos: PosSchema,
  prev: PosSchema.nullable(),
  rng: int,
  combat: FightSchema.nullable(),
  stats: z.object({
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
  shards: int,
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
 * The run in a save, or null for anything that fails the schema (a prototype save, a newer version, non-JSON).
 * A fight in a timing test resumes at the Attack choice (FR-COM-7); a fight in `wait` is kept.
 */
export function restore(json: unknown): RunState | null {
  const r = SavedRunSchema.safeParse(json);
  if (!r.success) return null;
  const s = { ...(r.data as SavedRun), events: [] } as RunState;
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
