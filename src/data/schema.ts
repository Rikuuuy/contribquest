// Zod schemas at the trust boundary. Shared types come from here via z.infer.
import { z } from 'zod';
import { WINDOW } from './constants';

export const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** One calendar day. Unknown keys are stripped (Zod default). */
export const ContributionDaySchema = z.object({
  date: DateString,
  count: z.number().int().nonnegative(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export type ContributionDay = z.infer<typeof ContributionDaySchema>;

/**
 * The API response. `total` is read leniently (only an integer `lastYear` is used) and
 * `contributions` is checked in two stages in normalize.ts, for the two prototype messages.
 */
export const ApiResponseSchema = z.object({
  total: z.unknown().optional(),
  contributions: z.unknown(),
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

export const SourceSchema = z.enum(['live', 'cache', 'demo']);
export type Source = z.infer<typeof SourceSchema>;

export const ContributionSetSchema = z.object({
  username: z.string(),
  source: SourceSchema,
  fetchedAt: z.string(),
  yearTotal: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  days: z.array(ContributionDaySchema).length(WINDOW),
});
export type ContributionSet = z.infer<typeof ContributionSetSchema>;

/** What the 1-hour cache stores: validated days only, never the raw payload. */
export const CacheEntrySchema = z.object({
  at: z.number(),
  days: z.array(ContributionDaySchema).min(WINDOW),
  total: z.number().int().optional(),
});
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

export const ClassIdSchema = z.enum(['wanderer', 'knight', 'rogue', 'mage']);
export type ClassId = z.infer<typeof ClassIdSchema>;

export const RaceIdSchema = z.enum(['human', 'elf', 'orc', 'skeleton', 'vampire']);
export type RaceId = z.infer<typeof RaceIdSchema>;

export const TrophyIdSchema = z.enum([
  'first',
  'self',
  'raider',
  'blessed',
  'cursed',
  'flawless',
  'close',
  'dodges',
  'crits',
  'relics',
  'speed',
  'nochest',
  'nightmare',
  'fullstack',
]);

/** `cq:v1:trophies`: trophy id → the `YYYY-MM-DD` it was earned. Unknown keys are stripped. */
export const TrophyHaveSchema = z.object(
  Object.fromEntries(TrophyIdSchema.options.map((id) => [id, DateString.optional()])) as Record<
    z.infer<typeof TrophyIdSchema>,
    z.ZodOptional<typeof DateString>
  >,
);
export type TrophyHave = z.infer<typeof TrophyHaveSchema>;

/** `cq:v1:classwins`: class id → true once a run was won with it. Unknown keys are stripped. */
export const ClassWinsSchema = z.object(
  Object.fromEntries(ClassIdSchema.options.map((id) => [id, z.literal(true).optional()])) as Record<
    ClassId,
    z.ZodOptional<z.ZodLiteral<true>>
  >,
);
export type ClassWins = z.infer<typeof ClassWinsSchema>;
