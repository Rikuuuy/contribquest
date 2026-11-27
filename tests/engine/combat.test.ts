import { describe, expect, it } from 'vitest';
import { applyDuck } from '../../src/engine/combat';
import { step } from '../../src/engine/step';
import type { ComboGrade, Grade, RunState } from '../../src/engine/state';
import { nextFloat } from '../../src/mapgen/rng';
import { tileAt } from '../../src/mapgen/layout';
import type { Tier } from '../../src/mapgen/types';
import { makeFightRun, type TestRunOptions } from '../fixtures/run';

/** The next `n` draws from the run RNG, without advancing it. */
function peek(s: RunState, n: number): number[] {
  const out: number[] = [];
  let st = s.rng;
  for (let i = 0; i < n; i++) {
    const [v, next] = nextFloat(st);
    out.push(v);
    st = next;
  }
  return out;
}
const vary = (v: number) => 0.9 + 0.2 * v;

const act = (s: RunState, ...actions: Parameters<typeof step>[1][]) => actions.reduce(step, s);
const attackWith = (s: RunState, grade: Grade | ComboGrade) => act(s, { type: 'attack' }, { type: 'forceGrade', grade });
/** Attack (graded `strike`), then advance to the first guard test. */
const toGuard = (s: RunState, strike: Grade = 'miss') => act(attackWith(s, strike), { type: 'advance' });

function fightRun(tier: Tier, o: TestRunOptions = {}): RunState {
  const s = makeFightRun(tier, o);
  s.combat!.m.hp = s.combat!.m.maxHp = 500; // keep the monster alive through the checks
  return s;
}

describe('FR-COM-5, FR-REL-2: strike damage', () => {
  it('bar: max(1, round(atk × mult × (0.9 + 0.2 × rand()))) per grade', () => {
    for (const [g, mult] of [['perfect', 1.6], ['good', 1], ['miss', 0.5]] as const) {
      let s = step(fightRun(2), { type: 'attack' });
      const [v] = peek(s, 1);
      s = step(s, { type: 'forceGrade', grade: g });
      const dmg = Math.max(1, Math.round(9 * mult * vary(v!)));
      expect(s.combat!.m.hp).toBe(500 - dmg);
      expect(s.events).toContainEqual({ type: 'heroHit', grades: [g], dmgs: [dmg], killed: false });
    }
  });

  it('charge multipliers and the spell line', () => {
    let s = step(fightRun(2, { cls: 'mage' }), { type: 'attack' });
    const [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'perfect' });
    const dmg = Math.round(11 * 1.9 * vary(v!));
    expect(s.combat!.m.hp).toBe(500 - dmg);
    expect(s.combat!.lines.at(-1)).toBe(`Critical! Your spell hits Bug Imp for ${dmg}.`);
  });

  it('combo: three hits in order, one draw each, summed', () => {
    let s = step(fightRun(2, { cls: 'rogue' }), { type: 'attack' });
    const v = peek(s, 3);
    s = step(s, { type: 'forceGrade', grade: ['perfect', 'good', 'miss'] });
    const dmgs = [0.55, 0.35, 0.08].map((m, i) => Math.max(1, Math.round(9 * m * vary(v[i]!))));
    expect(s.events).toContainEqual({ type: 'heroHit', grades: ['perfect', 'good', 'miss'], dmgs, killed: false });
    expect(s.combat!.m.hp).toBe(500 - dmgs.reduce((a, b) => a + b));
    expect(s.combat!.lines.at(-1)).toBe(`Your 3-hit combo hits Bug Imp for ${dmgs.reduce((a, b) => a + b)}.`);
    expect(s.stats.crits).toBe(1);
  });

  it('a single grade forced on a combo applies to all three hits', () => {
    const s = attackWith(fightRun(2, { cls: 'rogue' }), 'good');
    expect(s.events.find((e) => e.type === 'heroHit')).toMatchObject({ grades: ['good', 'good', 'good'] });
  });

  it('the trait row adds +2 to strikes only', () => {
    const base = fightRun(2);
    base.hero.trait = { name: 'Row', text: '', rows: [base.combat!.row], hp: 0 };
    let s = step(base, { type: 'attack' });
    const [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'good' });
    const dmg = Math.round(11 * vary(v!));
    expect(s.combat!.m.hp).toBe(500 - dmg);
    expect(s.combat!.lines.at(-1)).toBe(`You hit Bug Imp for ${dmg} (trait +2).`);
    s = act(s, { type: 'advance' }, { type: 'forceGrade', grade: 'perfect' });
    expect(s.events).toContainEqual({ type: 'counter', dmg: Math.round(9 * 0.5), killed: false });
  });

  it('Force Push × 1.25 on Perfect, Pair Programmer × 1.6 on Miss', () => {
    let s = step(fightRun(2, { relics: ['force', 'pair'] }), { type: 'attack' });
    let [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'perfect' });
    expect(s.events.find((e) => e.type === 'heroHit')).toMatchObject({ dmgs: [Math.round(9 * 1.6 * 1.25 * vary(v!))] });
    s = act(fightRun(2, { relics: ['force', 'pair'] }), { type: 'attack' });
    [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    expect(s.events.find((e) => e.type === 'heroHit')).toMatchObject({ dmgs: [Math.round(9 * 0.5 * 1.6 * vary(v!))] });
  });

  it('damage is at least 1', () => {
    const s = fightRun(2, { level: 1, hero: { atk: 1 } });
    const r = attackWith(s, 'miss');
    expect(r.events.find((e) => e.type === 'heroHit')).toMatchObject({ dmgs: [1] });
  });

  it('FR-RACE-2: Vampire heals 2 per Perfect hit, up to max HP', () => {
    const s = fightRun(2, { cls: 'rogue', race: 'vampire', hero: { hp: 10 } });
    const r = attackWith(s, ['perfect', 'perfect', 'good']);
    expect(r.hero.hp).toBe(14);
    expect(r.events).toContainEqual({ type: 'heal', amount: 4, source: 'vampire' });
    const full = attackWith(fightRun(2, { race: 'vampire' }), 'perfect');
    expect(full.events.some((e) => e.type === 'heal')).toBe(false);
    const nearly = attackWith(fightRun(2, { cls: 'rogue', race: 'vampire', hero: { hp: 37 } }), ['perfect', 'perfect', 'perfect']);
    expect(nearly.hero.hp).toBe(38);
  });
});

describe('FR-COM-5: guard damage', () => {
  it('Good and Miss: max(1, round(dmg × patternMult × guardMult × variance)); Bug Imp × 0.6', () => {
    for (const [g, mult] of [['good', 0.4], ['miss', 1]] as const) {
      let s = toGuard(fightRun(2));
      const [v] = peek(s, 1);
      const before = s.hero.hp;
      s = step(s, { type: 'forceGrade', grade: g });
      const md = Math.max(1, Math.round(7 * 0.6 * mult * vary(v!)));
      expect(before - s.hero.hp).toBe(md);
      expect(s.events).toContainEqual({ type: 'monsterHit', grade: g, dmg: md, lethal: false });
    }
  });

  it('shield and sidestep multipliers and lines', () => {
    let s = toGuard(fightRun(4, { cls: 'knight' }));
    let [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'good' });
    const md = Math.round(7 * 0.3 * vary(v!));
    expect(s.combat!.lines.at(-1)).toBe(`You block. Merge Conflict Lich still deals ${Math.max(1, md)}.`);
    s = toGuard(fightRun(4, { cls: 'rogue' }));
    [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'good' });
    expect(s.combat!.lines.at(-1)).toBe(`It grazes you for ${Math.round(23 * 0.8 * vary(v!))}.`);
    s = toGuard(fightRun(4));
    [v] = peek(s, 1);
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    expect(s.combat!.lines.at(-1)).toBe(`Merge Conflict Lich hits you for ${Math.round(12 * vary(v!))}.`);
  });

  it('Perfect: no damage, no draw, a dodge, and a 50% counter (100% for sidestep or Git Blame)', () => {
    let s = toGuard(fightRun(2));
    const rng = s.rng;
    s = step(s, { type: 'forceGrade', grade: 'perfect' });
    expect(s.rng).toBe(rng);
    expect(s.stats.dodges).toBe(1);
    expect(s.events).toContainEqual({ type: 'counter', dmg: 5, killed: false });
    expect(s.combat!.lines.at(-1)).toBe('Perfect dodge! You counter for 5.');
    const blame = step(toGuard(fightRun(2, { relics: ['blame'] })), { type: 'forceGrade', grade: 'perfect' });
    expect(blame.events).toContainEqual({ type: 'counter', dmg: 9, killed: false });
    const rogue = step(toGuard(fightRun(2, { cls: 'rogue' })), { type: 'forceGrade', grade: 'perfect' });
    expect(rogue.combat!.lines.at(-1)).toBe('Perfect sidestep! You counter for 9.');
    const knight = step(toGuard(fightRun(2, { cls: 'knight' })), { type: 'forceGrade', grade: 'perfect' });
    expect(knight.combat!.lines.at(-1)).toBe('Perfect parry! You counter for 4.');
  });

  it('FR-REL-1: Hotfix heals ceil(maxHp × 0.06) on a perfect dodge, up to max', () => {
    const s = step(toGuard(fightRun(2, { relics: ['hotfix'], hero: { hp: 20 } })), { type: 'forceGrade', grade: 'perfect' });
    expect(s.hero.hp).toBe(23);
    expect(s.events).toContainEqual({ type: 'heal', amount: 3, source: 'hotfix' });
    const near = step(toGuard(fightRun(2, { relics: ['hotfix'], hero: { hp: 41 } })), { type: 'forceGrade', grade: 'perfect' });
    expect(near.hero.hp).toBe(42);
  });

  it('boss damage is counted in bossDmg', () => {
    let s = toGuard(fightRun(5));
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    expect(s.stats.bossDmg).toBe(42 - s.hero.hp);
    expect(s.stats.bossDmg).toBeGreaterThan(0);
  });

  it('FR-RACE-2: Skeleton survives one lethal hit per run at 1 HP', () => {
    let s = toGuard(fightRun(4, { race: 'skeleton', hero: { hp: 1 } }));
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    expect([s.hero.hp, s.undying]).toEqual([1, true]);
    expect(s.combat!.lines).toContain('Your bones rattle back together. UNDYING!');
    expect(s.events.map((e) => e.type)).toContain('undying');
    expect(s.combat!.next).toEqual({ kind: 'choose' });
    s = act(s, { type: 'advance' }, { type: 'attack' }, { type: 'forceGrade', grade: 'miss' }, { type: 'advance' }, { type: 'forceGrade', grade: 'miss' });
    expect(s.hero.hp).toBe(0);
    expect(s.combat!.next).toEqual({ kind: 'lose' });
  });

  it('a monster turn runs every strike of its plan, then returns to choose', () => {
    let s = toGuard(fightRun(2));
    expect(s.combat!.plan).toEqual(['normal', 'quick']);
    expect(s.combat!.lines.at(-1)).toBe('Bug Imp lunges at you!');
    s = step(s, { type: 'forceGrade', grade: 'good' });
    expect(s.combat!.next).toEqual({ kind: 'strike', i: 1 });
    s = step(s, { type: 'advance' });
    expect(s.combat!.test!.pattern).toBe('quick');
    expect(s.combat!.lines.at(-1)).toBe('Bug Imp strikes again, fast!');
    s = step(s, { type: 'forceGrade', grade: 'good' });
    expect(s.combat!.next).toEqual({ kind: 'choose' });
    s = step(s, { type: 'advance' });
    expect(s.combat!.phase).toBe('choose');
  });
});

describe('FR-REL-3: Rubber Duck', () => {
  it('the first Miss of each fight becomes Good with reason "rubber duck"', () => {
    let s = step(fightRun(2, { relics: ['duck'] }), { type: 'attack' });
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    expect(s.events).toContainEqual({ type: 'graded', result: { grade: 'good', why: 'rubber duck' }, text: 'RUBBER DUCK · GOOD HIT' });
    s = act(s, { type: 'advance' }, { type: 'forceGrade', grade: 'miss' });
    expect(s.events.find((e) => e.type === 'graded')).toMatchObject({ result: { grade: 'miss' } });
  });

  it('in a combo, only the first missed hit changes', () => {
    const s = attackWith(fightRun(2, { cls: 'rogue', relics: ['duck'] }), ['perfect', 'miss', 'miss']);
    expect(s.events.find((e) => e.type === 'graded')).toMatchObject({ result: { grade: ['perfect', 'good', 'miss'], why: 'rubber duck' } });
  });

  it('does nothing without the relic, or without a Miss', () => {
    const s = fightRun(2);
    expect(applyDuck(s, { grade: 'miss' })).toEqual({ grade: 'miss' });
    const d = fightRun(2, { relics: ['duck'] });
    expect(applyDuck(d, { grade: 'good' })).toEqual({ grade: 'good' });
    expect(d.combat!.duckUsed).toBe(false);
  });
});

describe('FR-COM-1, FR-DIF-4, FR-PRO-3: end of a fight', () => {
  const killer = (tier: Tier, o: TestRunOptions = {}) => {
    const s = makeFightRun(tier, o);
    s.combat!.m.hp = 1;
    return act(s, { type: 'attack' }, { type: 'forceGrade', grade: 'good' });
  };

  it('a kill: tile resolved, defeated + 1, treasure, XP, banish line, pressure line, shard', () => {
    let s = killer(4);
    expect(s.combat!.next).toEqual({ kind: 'win' });
    const { col, row } = s.combat!;
    s = step(s, { type: 'advance' });
    expect(tileAt(s.map, col, row)!.resolved).toBe(true);
    expect([s.status, s.combat, s.stats.defeated, s.hero.treasure]).toEqual(['exploring', null, 1, 13]);
    expect(s.hero.xp).toBe(150 + 66); // Human: 60 × 1.1
    expect(s.log).toEqual([
      'Merge Conflict Lich is banished: +60 XP, +13 treasure.',
      'The graph grows restless: timing windows 93%.',
      'Soul shard 1/3 collected.',
    ]);
    expect(s.events).toEqual([
      { type: 'xp', amount: 66 },
      { type: 'timing', pct: 93, maxed: false },
      { type: 'monsterDown', boss: false },
      { type: 'shard', have: 1, need: 3, shattered: false },
    ]);
  });

  it('no pressure line once the floor is reached; no shard for tiers 1 and 2', () => {
    const s = step(killer(2, { defeated: 20 }), { type: 'advance' });
    expect(s.log).toEqual(['Bug Imp is banished: +30 XP, +7 treasure.']);
    expect(s.shards).toBe(0);
  });

  it('the map log keeps the last 4 lines', () => {
    const base = killer(4);
    base.log = ['a', 'b', 'c'];
    const s = step(base, { type: 'advance' });
    expect(s.log).toEqual(['c', 'Merge Conflict Lich is banished: +60 XP, +13 treasure.', 'The graph grows restless: timing windows 93%.', 'Soul shard 1/3 collected.']);
  });

  it('the boss: no pressure line, bossDown, bossHpLeft, the Gate opens', () => {
    const s = step(killer(5), { type: 'advance' });
    expect([s.bossDown, s.stats.bossHpLeft, s.stats.defeated, s.status]).toEqual([true, 42, 1, 'exploring']);
    expect(s.log).toEqual(['The Phantom of Tue 3 Nov 2026 is banished: +100 XP, +33 treasure.', 'The Phantom falls. The Gate is unsealed!']);
    expect(s.events.map((e) => e.type)).toEqual(['xp', 'monsterDown', 'gateOpen']);
  });

  it('a boss on the Gate ends the run as won', () => {
    const base = killer(5);
    const t = tileAt(base.map, base.combat!.col, base.combat!.row)!;
    t.kind = 'gate';
    const s = step(base, { type: 'advance' });
    expect(s.status).toBe('won');
    expect(s.events.slice(-2)).toEqual([{ type: 'won' }, { type: 'runEnded', won: true }]);
  });

  it('FR-COM-4: HP 0 loses the run and records the killer', () => {
    let s = toGuard(fightRun(4, { hero: { hp: 1 } }));
    s = step(s, { type: 'forceGrade', grade: 'miss' });
    expect(s.events.find((e) => e.type === 'monsterHit')).toMatchObject({ lethal: true });
    s = step(s, { type: 'advance' });
    expect([s.status, s.killer]).toEqual(['lost', 'Merge Conflict Lich']);
    expect(s.events).toEqual([{ type: 'lost' }, { type: 'runEnded', won: false }]);
  });

  it('a counter can kill', () => {
    const s = toGuard(makeFightRun(2));
    s.combat!.m.hp = 2;
    const r = step(s, { type: 'forceGrade', grade: 'perfect' });
    expect(r.events).toContainEqual({ type: 'counter', dmg: 5, killed: true });
    expect(r.combat!.next).toEqual({ kind: 'win' });
  });
});

describe('FR-COM-1, FR-COM-3: fight start', () => {
  it('logs the arrival, the hero line, and the class hint', () => {
    const s = makeFightRun(4);
    expect(s.status).toBe('combat');
    expect(s.combat!.lines).toEqual([
      expect.stringMatching(/^A Merge Conflict Lich appears\. Risen from \w{3} \d+ \w{3} \d{4}: \d+ contributions?\.$/),
      'tester steps into the battle as a Human Wanderer.',
      'Attack, then press Space as the marker crosses the gold.',
    ]);
    expect(makeFightRun(5).combat!.lines[0]).toBe('The air turns cold. The Phantom of Tue 3 Nov 2026 rises from your best day!');
  });
});
