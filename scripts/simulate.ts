// Headless balance simulator (progression requirement 14, design "Balance simulator").
// Plays skill-bot runs through the engine's `step` on the demo graph and six fixture graphs and prints
// win rates per class and skill next to the targets in game-rules.md. Exits 1 if any overall target is missed.
// v1.6: each cell also reports the average fights per run and the average shards held at the boss
// (informational, not pass/fail).
//
// Usage: npm run simulate [-- --seeds n] [-- --cell class:σ]
import { loadDemo } from '../src/data/demo';
import { buildSet, parseApiResponse } from '../src/data/normalize';
import type { ClassId, ContributionSet } from '../src/data/schema';
import { makeSkillBot, newRun, playRun, skillGrade, type Grader, type RunSettings, type RunState } from '../src/engine';
import type { ComboGrade, Grade } from '../src/engine/state';
import { makeRng } from '../src/mapgen';
import { FIXTURES } from '../tests/fixtures/profiles';

type Target = { min?: number; max?: number };
type Cell = { cls: ClassId; sigma: number; target: Target };

const CELLS: readonly Cell[] = [
  { cls: 'knight', sigma: 140, target: { min: 90 } },
  { cls: 'wanderer', sigma: 100, target: { min: 80 } },
  { cls: 'mage', sigma: 100, target: { min: 15, max: 50 } },
  { cls: 'mage', sigma: 60, target: { min: 60 } },
  { cls: 'rogue', sigma: 60, target: { max: 40 } },
  { cls: 'rogue', sigma: 35, target: { min: 80 } },
];

/** The six balance fixtures (the two column-count fixtures test layout, not balance). */
const FIXTURE_GRAPHS = ['allEmpty', 'singleActiveDay', 'veryDense', 'bestDayFirst', 'bestDayLast', 'lastDayZero'] as const;
const FETCHED_AT = '2026-11-16T12:00:00.000Z';

function graphs(): { name: string; set: ContributionSet }[] {
  const out = [{ name: 'demo', set: loadDemo(() => Date.UTC(2026, 10, 19)) }];
  for (const name of FIXTURE_GRAPHS) {
    const parsed = parseApiResponse((FIXTURES[name] as () => unknown)());
    if (!parsed.ok) throw new Error(`fixture ${name}: ${parsed.error.message}`);
    out.push({ name, set: buildSet(name, 'live', parsed.value.days, parsed.value.total, FETCHED_AT) });
  }
  return out;
}

const settings = (cls: ClassId): RunSettings => ({ heroClass: cls, heroRace: 'human', calm: false, assist: false });

function start(set: ContributionSet, cls: ClassId): RunState {
  const r = newRun(set, null, settings(cls));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** The run got to the boss node (the boss fight started), so `shards` is the count the boss was fought with. */
const reachedBoss = (s: RunState): boolean => s.pos.col === s.map.bossNode.col && s.pos.row === s.map.bossNode.row;

const targetText = (t: Target): string =>
  t.min !== undefined && t.max !== undefined ? `${t.min}–${t.max}%` : t.min !== undefined ? `≥ ${t.min}%` : `≤ ${t.max}%`;
const meets = (t: Target, pct: number): boolean => (t.min === undefined || pct >= t.min) && (t.max === undefined || pct <= t.max);

function parseArgs(argv: readonly string[]): { seeds: number; cells: readonly Cell[] } {
  let seeds = 200;
  let cells: readonly Cell[] = CELLS;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--seeds' && v !== undefined) {
      seeds = Number(v);
      if (!Number.isInteger(seeds) || seeds < 1) throw new Error(`--seeds needs a positive integer, got ${v}`);
      i++;
    } else if (a === '--cell' && v !== undefined) {
      const [cls, sigma] = v.split(':');
      cells = CELLS.filter((c) => c.cls === cls && c.sigma === Number(sigma));
      if (!cells.length) throw new Error(`--cell ${v} is not a target cell`);
      i++;
    } else {
      throw new Error(`unknown argument ${a}`);
    }
  }
  return { seeds, cells };
}

const always =
  (g: Grade): Grader =>
  (t) =>
    t.mode === 'combo' ? ([g, g, g] as ComboGrade) : g;

/** Mixed: 25% Perfect, 50% Good, 25% Miss from makeRng(1234), one draw per grade. */
function mixed(): Grader {
  const r = makeRng(1234);
  const one = (): Grade => {
    const x = r.next();
    return x < 0.25 ? 'perfect' : x < 0.75 ? 'good' : 'miss';
  };
  return (t) => (t.mode === 'combo' ? [one(), one(), one()] : one());
}

const GRADE_POLICIES: readonly { name: string; grader: () => Grader; wins: boolean }[] = [
  { name: 'All Perfect', grader: () => always('perfect'), wins: true },
  { name: 'All Good', grader: () => always('good'), wins: true },
  { name: 'Mixed 25/50/25', grader: mixed, wins: true },
  { name: 'All Miss', grader: () => always('miss'), wins: false },
];

function main(): number {
  const { seeds, cells } = parseArgs(process.argv.slice(2));
  const gs = graphs();
  let failed = false;

  console.log(`Balance simulator: ${seeds} seeds per cell and graph, race Human, Calm and Auto-timing off.\n`);
  console.log(`| Class | σ (ms) | ${gs.map((g) => g.name).join(' | ')} | Overall | Target | Result | Avg fights | Avg shards at boss |`);
  console.log(`| --- | --- | ${gs.map(() => '---').join(' | ')} | --- | --- | --- | --- | --- |`);
  for (const cell of cells) {
    let total = 0;
    let fights = 0;
    let shards = 0;
    let atBoss = 0;
    const per = gs.map(({ set }) => {
      let wins = 0;
      for (let seed = 0; seed < seeds; seed++) {
        const bot = makeSkillBot(cell.sigma, seed);
        const r = playRun(start(set, cell.cls), (t) => skillGrade(t, bot));
        if (r.won) wins++;
        fights += r.fights;
        if (reachedBoss(r.state)) {
          atBoss++;
          shards += r.state.shards;
        }
      }
      total += wins;
      return wins;
    });
    const runs = seeds * gs.length;
    const pct = (100 * total) / runs;
    const ok = meets(cell.target, pct);
    if (!ok) failed = true;
    const avgShards = atBoss ? (shards / atBoss).toFixed(2) : '–';
    console.log(
      `| ${cell.cls} | ${cell.sigma} | ${per.map((w) => `${w}/${seeds}`).join(' | ')} | ${pct.toFixed(1)}% | ${targetText(cell.target)} | ${ok ? 'PASS' : 'FAIL'} | ${(fights / runs).toFixed(2)} | ${avgShards} |`,
    );
  }

  const demo = gs[0] as { set: ContributionSet };
  console.log('\nWanderer grade policies on the demo graph (route target: 8–13 fights, the boss included; steps always equal cols):\n');
  console.log('| Policy | Expected | Outcome | Fights | Shards | Steps | Result |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const p of GRADE_POLICIES) {
    const r = playRun(start(demo.set, 'wanderer'), p.grader());
    const ok = r.won === p.wins;
    if (!ok) failed = true;
    console.log(
      `| ${p.name} | ${p.wins ? 'win' : 'lose'} | ${r.won ? 'win' : 'lose'} | ${r.fights} | ${r.state.shards} | ${r.state.stats.steps} | ${ok ? 'PASS' : 'FAIL'} |`,
    );
  }

  console.log(failed ? '\nFAIL: at least one target was missed.' : '\nPASS: every target met.');
  return failed ? 1 : 0;
}

process.exitCode = main();
