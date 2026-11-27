import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClassId, ContributionSet } from '../../src/data/schema';
import { makeHero, newRun, type RunSettings } from '../../src/engine/run';
import { generateMap } from '../../src/mapgen/generate';
import { makeSet, windowDays } from '../fixtures/sets';
import { demoSet } from '../fixtures/run';

const SETTINGS: RunSettings = { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false };
const golden = JSON.parse(readFileSync(new URL('../fixtures/golden/demo-fight.json', import.meta.url), 'utf8')) as {
  runs: Record<ClassId, { seed: number; hero: Record<string, unknown> }>;
};

function run(set: ContributionSet, heroSet: ContributionSet | null = null, settings: RunSettings = SETTINGS) {
  const r = newRun(set, heroSet, settings);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('FR-PRO-1: newRun on the demo set', () => {
  it('the hero matches the prototype for every class (golden record)', () => {
    for (const cls of ['wanderer', 'knight', 'rogue', 'mage'] as const) {
      const s = run(demoSet(), null, { ...SETTINGS, heroClass: cls });
      expect(s.hero).toEqual(golden.runs[cls].hero);
      expect(s.rng).toBe(golden.runs[cls].seed);
    }
  });

  it('starts on the start tile, visited, resolved, and revealed, with the run RNG at the map seed', () => {
    const set = demoSet();
    const s = run(set);
    const map = generateMap(set);
    if (!map.ok) throw new Error('map');
    const s0 = s.map.tiles[0]!;
    expect(s0.kind).toBe('start');
    expect(s.pos).toEqual({ col: s0.col, row: s0.row });
    expect(s0.visited).toBe(true);
    expect(s0.resolved).toBe(true);
    expect(s0.seen).toBe(true);
    expect(s.map.tiles.filter((t) => t.resolved)).toHaveLength(1);
    expect(s.map.tiles.filter((t) => t.visited)).toHaveLength(1);
    expect(s.rng).toBe(map.value.seed);
    expect(s.rng).toBe(s.map.seed);
  });

  it('sets every run field to its starting value', () => {
    const s = run(demoSet(), null, { ...SETTINGS, calm: true, assist: true });
    expect(s).toMatchObject({
      version: 2,
      heroSet: null,
      prev: null,
      combat: null,
      stats: { steps: 0, defeated: 0, chests: 0, wisps: 0, crits: 0, dodges: 0, bossDmg: 0, bossHpLeft: null },
      status: 'exploring',
      bossDown: false,
      shards: 0,
      undying: false,
      killer: null,
      opts: { calm: true, assist: true },
      events: [],
      relicOffer: null,
      relicTitle: null,
      pendingBlessing: true,
      newTrophies: [],
    });
    expect(s.hero).toMatchObject({ treasure: 0, relics: [], omen: 'blessed' });
    expect(s.hero.hp).toBe(s.hero.maxHp);
  });

  it('logs the opening lines in order', () => {
    expect(run(demoSet()).log).toEqual([
      'You wake in a crypt on Tue 18 Aug 2026. Somewhere ahead waits the Phantom of your best day.',
      'Commit Blessing: demo-necromancer contributed today, so a relic awaits.',
      'Banish Ghouls or Liches for soul shards: each one weakens the Phantom (up to 3).',
    ]);
  });

  it('settings choose the class and race; unknown ids fall back to Wanderer and Human', () => {
    const s = run(demoSet(), null, { ...SETTINGS, heroClass: 'mage', heroRace: 'orc' });
    expect([s.hero.cls, s.hero.race]).toEqual(['mage', 'orc']);
    const bad = { ...SETTINGS, heroClass: 'paladin', heroRace: 'dwarf' } as unknown as RunSettings;
    const d = run(demoSet(), null, bad);
    expect([d.hero.cls, d.hero.race]).toEqual(['wanderer', 'human']);
  });
});

describe('FR-OMEN-1, FR-OMEN-3: omen at run start', () => {
  const cursedSet = () => makeSet(windowDays((i) => ({ count: i === 90 ? 0 : (i % 4) * 2 })));

  it('no contributions today: cursed, no pending blessing, the curse line', () => {
    const s = run(cursedSet());
    expect([s.hero.omen, s.pendingBlessing]).toEqual(['cursed', false]);
    expect(s.log[1]).toBe('Uncommitted Curse: no contributions today, so monsters hit 15% harder. Commit to lift it.');
  });

  it('the shard line is logged on every map, even one without elites (v1.6)', () => {
    for (const set of [
      makeSet(windowDays((i) => ({ count: i === 90 ? 1 : 0 }))),
      makeSet(windowDays((i) => ({ count: i === 30 ? 20 : i === 60 ? 8 : i === 90 ? 1 : 0 }))),
      cursedSet(),
    ]) {
      const s = run(set);
      expect(s.log).toHaveLength(3);
      expect(s.log[2]).toBe('Banish Ghouls or Liches for soul shards: each one weakens the Phantom (up to 3).');
    }
  });
});

describe('FR-MOV-6: the column window at run start (v1.6)', () => {
  it('marks columns 0–2 seen and nothing further', () => {
    const s = run(demoSet());
    expect(s.pos.col).toBe(0);
    for (const t of s.map.tiles) expect(t.seen).toBe(t.col <= 2);
  });
});

describe('FR-SOC-1: raids', () => {
  it('a hero set with the same name ignoring case is a normal run', () => {
    const set = demoSet();
    const s = run(set, { ...set, username: set.username.toUpperCase() });
    expect(s.heroSet).toBeNull();
    expect(s.hero.name).toBe(set.username);
  });

  it('a different name is a raid: the map from the map set, the hero and omen from the raider', () => {
    const set = demoSet();
    const raider = makeSet(windowDays((i) => ({ count: i === 90 ? 0 : 1 })), 'raider-one');
    const s = run(set, raider);
    expect(s.heroSet).toEqual(raider);
    expect(s.hero).toEqual(makeHero(raider, SETTINGS));
    expect(s.hero.omen).toBe('cursed');
    const map = generateMap(set);
    expect(map.ok && map.value.seed).toBe(s.map.seed);
    expect(s.log[0]).toBe("raider-one breaks into demo-necromancer's graph on Tue 18 Aug 2026. Their Phantom is waiting.");
  });
});

describe('FR-MAP-4: map errors', () => {
  it('returns the map error instead of a run', () => {
    const broken = { ...demoSet(), days: [] };
    const r = newRun(broken, null, SETTINGS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ code: 'map', retry: true, demo: true });
  });
});
