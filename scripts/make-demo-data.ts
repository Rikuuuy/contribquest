// Generates src/data/demo-data.json, porting the prototype's makeDemoSet line for line.
// Run once: `npx tsx scripts/make-demo-data.ts`. tests/data/demo.test.ts guards the file against drift.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOW } from '../src/data/constants';
import type { ContributionDay } from '../src/data/schema';
import { fnv1a, makeRng } from '../src/mapgen/rng';

export const DEMO_USERNAME = 'demo-necromancer';
export const DEMO_END = '2026-11-16';
export const DEMO_YEAR_TOTAL = 1287;

type Level = ContributionDay['level'];
export type DemoResponse = { total: { lastYear: number }; contributions: ContributionDay[] };

function addDaysUtc(date: string, n: number): string {
  const dt = new Date(date + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function makeDemoResponse(): DemoResponse {
  const r = makeRng(fnv1a(DEMO_USERNAME));
  const ranges: readonly (readonly [number, number] | null)[] = [null, [1, 3], [4, 6], [7, 10], [11, 18]];
  const days: ContributionDay[] = [];
  for (let idx = 0; idx < WINDOW; idx++) {
    const date = addDaysUtc(DEMO_END, idx - (WINDOW - 1));
    let level: Level;
    if (idx >= 12 && idx <= 18) level = 0; // the empty "graveyard" week
    else if (idx === 75) level = 0; // the day before the streak
    else if (idx >= 76) level = (1 + Math.floor(r.next() * 4)) as Level; // 15-day streak to the end
    else {
      const x = r.next();
      level = x < 0.38 ? 0 : x < 0.63 ? 1 : x < 0.83 ? 2 : x < 0.94 ? 3 : 4;
    }
    let count = 0;
    const range = ranges[level];
    if (level > 0 && range) {
      const [a, b] = range;
      count = a + Math.floor(r.next() * (b - a + 1));
    }
    days.push({ date, count, level });
  }
  days[77] = { date: days[77]!.date, count: 31, level: 4 }; // the best day, two weeks before the end
  return { total: { lastYear: DEMO_YEAR_TOTAL }, contributions: days };
}

export function demoJson(): string {
  return JSON.stringify(makeDemoResponse(), null, 2) + '\n';
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = resolve(fileURLToPath(new URL('../src/data/demo-data.json', import.meta.url)));
  writeFileSync(out, demoJson());
  console.log(`Wrote ${out}`);
}
