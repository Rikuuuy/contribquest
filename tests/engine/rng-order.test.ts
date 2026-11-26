import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { step } from '../../src/engine/step';
import type { ClassId } from '../../src/data/schema';
import type { Grade, Hero, RunState } from '../../src/engine/state';
import { tileAt } from '../../src/mapgen/layout';
import { fightOn, makeTestRun } from '../fixtures/run';

// Recorded once from the prototype (see `recordedFrom` in the file): the demo run as a human Wanderer,
// teleported onto five fights in turn, every timing test graded from a fixed cycle.
type Snap = {
  n: number;
  kind: 'attack' | 'defend';
  mode: string;
  pattern: string;
  target: number;
  P: number;
  G: number;
  rngAtStart: number;
  heroHp: number;
  monHp: number;
  grade: Grade;
};
type Turn = { action: 'attack' | 'flee'; rng: number; heroHp: number; monHp: number | null; phase2: boolean | null; status: string };
type FightRec = {
  col: number;
  row: number;
  tier: number;
  plan: 'attack' | 'flee';
  turns: Turn[];
  after: {
    rng: number;
    status: string;
    pos: { col: number; row: number };
    hero: Pick<Hero, 'hp' | 'maxHp' | 'atk' | 'xp' | 'level' | 'treasure'>;
    stats: RunState['stats'];
    shards: number;
    bossDown: boolean;
    killer: string | null;
    /** Not compared: the prototype's log also holds the newRun lines, and it never logs FR-DIF-4. */
    log?: string[];
  };
};
type Recording = { seed: number; hero: Hero; snaps: Snap[]; fights: FightRec[] };
const file = JSON.parse(readFileSync(new URL('../fixtures/golden/demo-fight.json', import.meta.url), 'utf8')) as {
  cycle: Grade[];
  runs: Record<ClassId, Recording>;
};
const CLASSES: ClassId[] = ['wanderer', 'knight', 'rogue', 'mage'];

function goldenRun(golden: Recording): RunState {
  const s = makeTestRun();
  const g = golden.hero;
  s.hero = {
    name: g.name,
    cls: g.cls,
    race: g.race,
    xp: g.xp,
    level: g.level,
    startLevel: g.startLevel,
    aura: g.aura,
    trait: g.trait,
    total91: g.total91,
    hp: g.hp,
    maxHp: g.maxHp,
    atk: g.atk,
    treasure: g.treasure,
    relics: [],
    omen: g.omen,
  };
  return s;
}

const withoutLog = ({ log: _log, ...rest }: FightRec['after']) => rest;

/** Plays every recorded fight, checking each test start against the recording. */
function replay(golden: Recording, check: (what: string, actual: unknown, expected: unknown) => void): void {
  let s = goldenRun(golden);
  check('seed', s.rng, golden.seed);
  let n = 0;
  for (const f of golden.fights) {
    const tile = tileAt(s.map, f.col, f.row);
    if (!tile) throw new Error('missing tile');
    s = structuredClone(s);
    fightOn(s, tile);
    for (const turn of f.turns) {
      s = step(s, { type: turn.action });
      while (s.status === 'combat' && s.combat && s.combat.phase !== 'choose') {
        if (s.combat.phase === 'test') {
          const snap = golden.snaps[n] as Snap;
          const t = s.combat.test!;
          check(`test ${n}`, {
            kind: t.kind === 'flee' ? 'defend' : t.kind,
            mode: t.mode,
            pattern: t.pattern,
            target: t.target,
            P: t.P,
            G: t.G,
            rngAtStart: s.rng,
            heroHp: s.hero.hp,
            monHp: s.combat.m.hp,
          }, {
            kind: snap.kind,
            mode: snap.mode,
            pattern: snap.pattern,
            target: snap.target,
            P: snap.P,
            G: snap.G,
            rngAtStart: snap.rngAtStart,
            heroHp: snap.heroHp,
            monHp: snap.monHp,
          });
          s = step(s, { type: 'forceGrade', grade: file.cycle[n % file.cycle.length] as Grade });
          n++;
        } else s = step(s, { type: 'advance' });
      }
      check(`turn after test ${n}`, {
        rng: s.rng,
        heroHp: s.hero.hp,
        monHp: s.combat && s.status === 'combat' ? s.combat.m.hp : s.status === 'lost' ? s.combat!.m.hp : null,
        status: s.status,
      }, { rng: turn.rng, heroHp: turn.heroHp, monHp: turn.monHp, status: turn.status });
    }
    check(`after fight at ${f.col},${f.row}`, {
      rng: s.rng,
      status: s.status,
      pos: s.pos,
      hero: { hp: s.hero.hp, maxHp: s.hero.maxHp, atk: s.hero.atk, xp: s.hero.xp, level: s.hero.level, treasure: s.hero.treasure },
      stats: s.stats,
      shards: s.shards,
      bossDown: s.bossDown,
      killer: s.killer,
    }, withoutLog(f.after));
  }
  check('tests played', n, golden.snaps.length);
}

describe('FR-COM-5, FR-MAP-3: RNG call order matches the prototype', () => {
  it.each(CLASSES)('%s: replays the recorded demo fights with the same RNG state, windows, and HP after every step', (cls) => {
    const golden = file.runs[cls];
    expect(golden.hero.cls).toBe(cls);
    replay(golden, (what, actual, expected) => expect(actual, what).toEqual(expected));
  });

  it('the recordings cover all six modes, all four patterns, a flee, phase 2, a boss win, and a loss', () => {
    const all = CLASSES.map((c) => file.runs[c]);
    const snaps = all.flatMap((r) => r.snaps);
    const fights = all.flatMap((r) => r.fights);
    expect([...new Set(snaps.map((x) => x.mode))].sort()).toEqual(['bar', 'charge', 'combo', 'ring', 'shield', 'sidestep']);
    expect([...new Set(snaps.map((x) => x.pattern))].sort()).toEqual(['conflict', 'flaky', 'normal', 'quick']);
    expect(fights.some((f) => f.plan === 'flee')).toBe(true);
    expect(fights.some((f) => f.turns.some((t) => t.phase2))).toBe(true);
    expect(fights.some((f) => f.after.bossDown)).toBe(true);
    expect(fights.map((f) => f.after.status)).toContain('lost');
  });
});
