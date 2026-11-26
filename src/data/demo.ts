// Demo mode: the frozen demo graph, through the same schema and normalisation as live data.
import demoData from './demo-data.json';
import { buildSet, parseApiResponse } from './normalize';
import type { ContributionSet } from './schema';

export const DEMO_USERNAME = 'demo-necromancer';

/** Throws only if the frozen file is broken, which is a build bug. */
export function loadDemo(now: () => number): ContributionSet {
  const parsed = parseApiResponse(demoData as unknown);
  if (!parsed.ok) throw new Error(`demo-data.json is invalid: ${parsed.error.message}`);
  return buildSet(DEMO_USERNAME, 'demo', parsed.value.days, parsed.value.total, new Date(now()).toISOString());
}
