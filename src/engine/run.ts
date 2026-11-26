// Starting a run (prototype makeHero, newRun). `endRun` comes with progression group 8.
import type { Result } from '../data/errors';
import { ClassIdSchema, RaceIdSchema, type ContributionSet } from '../data/schema';
import type { Settings } from '../data/settings';
import { fmtDate, generateMap, type DayTile, type MapError } from '../mapgen';
import { applyStats } from './classes';
import { reveal } from './explore';
import { log } from './log';
import { omenFor, omenLog } from './omen';
import { auraTier, levelFor, startingXp } from './progression';
import type { Hero, RunState } from './state';
import { makeTrait } from './trait';

export type RunSettings = Pick<Settings, 'heroClass' | 'heroRace' | 'calm' | 'assist'>;

export function makeHero(heroSet: ContributionSet, settings: RunSettings): Hero {
  const total91 = heroSet.days.reduce((a, d) => a + d.count, 0);
  const xp = startingXp(total91);
  const level = levelFor(xp);
  const cls = ClassIdSchema.safeParse(settings.heroClass);
  const race = RaceIdSchema.safeParse(settings.heroRace);
  const h: Hero = {
    name: heroSet.username,
    cls: cls.success ? cls.data : 'wanderer',
    race: race.success ? race.data : 'human',
    xp,
    level,
    startLevel: level,
    aura: auraTier(heroSet.streak),
    trait: makeTrait(heroSet.days, total91),
    total91,
    hp: 0,
    maxHp: 0,
    atk: 0,
    treasure: 0,
    relics: [],
    omen: omenFor(heroSet),
  };
  applyStats(h);
  h.hp = h.maxHp;
  return h;
}

/** A new run on `set`; `heroSet` is a raid only when its username differs ignoring case. No RNG draw happens here. */
export function newRun(
  set: ContributionSet,
  heroSet: ContributionSet | null,
  settings: RunSettings,
): Result<RunState, MapError> {
  const raid = heroSet && heroSet.username.toLowerCase() !== set.username.toLowerCase() ? heroSet : null;
  const hs = raid ?? set;
  const gen = generateMap(set);
  if (!gen.ok) return gen;
  const map = gen.value;
  const hero = makeHero(hs, settings);
  const s0 = map.tiles[0] as DayTile;
  const s: RunState = {
    version: 1,
    set,
    heroSet: raid,
    map,
    hero,
    pos: { col: s0.col, row: s0.row },
    prev: null,
    rng: map.seed,
    combat: null,
    stats: { steps: 0, defeated: 0, chests: 0, wisps: 0, crits: 0, dodges: 0, bossDmg: 0, bossHpLeft: null },
    status: 'exploring',
    bossDown: false,
    shards: 0,
    undying: false,
    killer: null,
    opts: { calm: settings.calm, assist: settings.assist },
    log: [],
    events: [],
    relicOffer: null,
    relicTitle: null,
    pendingBlessing: hero.omen === 'blessed',
    newTrophies: [],
  };
  s0.visited = true;
  reveal(s);
  log(
    s,
    raid
      ? `${hs.username} breaks into ${set.username}'s graph on ${fmtDate(s0.day.date)}. Their Phantom is waiting.`
      : `You wake in a crypt on ${fmtDate(s0.day.date)}. Somewhere ahead waits the Phantom of your best day.`,
  );
  log(s, omenLog(hero.omen, hs.username));
  const n = map.shardsNeeded;
  if (n > 0)
    log(s, `Its ward is fed by your other big days. Banish ${n} elite${n > 1 ? 's' : ''} (Ghouls or Liches) to collect soul shards and break it.`);
  return { ok: true, value: s };
}
