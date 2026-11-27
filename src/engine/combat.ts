// Fight flow and damage (prototype startCombat, attack, resolveAttack, enemyTurn, resolveDefend, flee, resolveFlee,
// winFight, lose, and finishQte's Rubber Duck). Every function mutates the reducer's draft.
import { tileAt, type DayTile } from '../mapgen';
import { ATK_MULT, DEF_MULT, PHASE2, PRESSURE_EPS, QTE, RELIC_COMBAT, VARIANCE } from './balance';
import { heroClass } from './classes';
import { classDiff, pressure, timingPercent } from './difficulty';
import { collectShard } from './explore';
import { clog, log, trimLog } from './log';
import { modsOf } from './mods';
import { fightTreasure, makeMonster, sourceLabel } from './monsters';
import { PHASE2_LINE, STRIKE_LINE, checkPhase2, patternDamageMult, strikePlan } from './patterns';
import { gainXp } from './progression';
import { createTest, gradeText, type TestContext } from './qte';
import { RACE_NAMES } from './races';
import { rand, randOf } from './rand';
import { endRun } from './run';
import type { ComboGrade, Fight, Grade, GradeResult, Pattern, QteTest, RunState } from './state';

const variance = (s: RunState) => VARIANCE.base + VARIANCE.spread * rand(s);

function fight(s: RunState): Fight {
  if (!s.combat) throw new Error('No fight in progress.');
  return s.combat;
}

function fightTile(s: RunState, c: Fight): DayTile {
  const t = tileAt(s.map, c.col, c.row);
  if (!t) throw new Error('The fight tile is missing.');
  return t;
}

// ---------- Start ----------

export function startFight(s: RunState, tile: DayTile): void {
  const h = s.hero;
  const m = makeMonster(tile, h, s.map);
  const boss = m.tier === 5;
  s.status = 'combat';
  s.combat = {
    col: tile.col,
    row: tile.row,
    m,
    phase: 'choose',
    test: null,
    events: [],
    testId: 0,
    plan: [],
    strikeIdx: 0,
    next: null,
    duckUsed: false,
    lines: [],
    last: null,
  };
  const c = s.combat;
  clog(c, boss ? `The air turns cold. ${m.name} rises from your best day!` : `A ${m.name} appears. ${sourceLabel(tile, s.map)}.`);
  clog(c, `${h.name} steps into the battle as a ${RACE_NAMES[h.race] ?? RACE_NAMES.human} ${heroClass(h).name}.`);
  clog(c, heroClass(h).hint);
  s.events.push({ type: 'fightStart', boss });
}

function testContext(s: RunState, kind: QteTest['kind'], pattern: Pattern, patSpeed: number): TestContext {
  const c = fight(s);
  const C = heroClass(s.hero);
  return {
    tier: c.m.tier,
    mode: kind === 'attack' ? C.strike : C.guard,
    pattern,
    aura: s.hero.aura,
    mods: modsOf(s.hero),
    calm: s.opts.calm,
    diff: classDiff(s.hero.cls),
    pressure: pressure(s),
    slow: C.slow,
    patSpeed,
  };
}

function beginTest(s: RunState, kind: QteTest['kind'], pattern: Pattern, patSpeed: number): void {
  const c = fight(s);
  const test = createTest(kind, testContext(s, kind, pattern, patSpeed), randOf(s));
  c.test = test;
  c.events = [];
  c.testId++;
  c.phase = 'test';
  c.next = null;
  s.events.push({ type: 'testStart', testId: c.testId, mode: test.mode, pattern: test.pattern });
}

/** Attack: the class's strike test. */
export function startStrike(s: RunState): void {
  beginTest(s, 'attack', 'normal', 1);
}

/** Guard test `i` of the monster's turn; the plan is drawn on `i = 0`. */
export function startGuard(s: RunState, i: number): void {
  const c = fight(s);
  const m = c.m;
  if (i === 0) c.plan = strikePlan(m, randOf(s));
  const pattern = c.plan[i] ?? 'normal';
  c.strikeIdx = i;
  clog(c, STRIKE_LINE[pattern](m));
  beginTest(s, 'defend', pattern, m.phase2 ? PHASE2.speed : 1);
}

/** Flee: one `normal` guard test. */
export function startFlee(s: RunState): void {
  const c = fight(s);
  clog(c, `You turn to run. ${c.m.name} strikes at your back!`);
  beginTest(s, 'flee', 'normal', 1);
}

// ---------- Resolve ----------

/** Rubber Duck: the first Miss of a fight becomes Good (in a combo, the first missed hit only). */
export function applyDuck(s: RunState, r: GradeResult): GradeResult {
  const c = s.combat;
  if (!c || c.duckUsed || !s.hero.relics.includes('duck')) return r;
  if (Array.isArray(r.grade)) {
    const i = r.grade.indexOf('miss');
    if (i < 0) return r;
    const g = r.grade.slice() as ComboGrade;
    g[i] = 'good';
    c.duckUsed = true;
    return { grade: g, why: 'rubber duck' };
  }
  if (r.grade !== 'miss') return r;
  c.duckUsed = true;
  return { grade: 'good', why: 'rubber duck' };
}

/** Resolves the test in progress with a grade (from `grade` or `forceGrade`). */
export function resolveTest(s: RunState, raw: GradeResult): void {
  const c = fight(s);
  const test = c.test;
  if (!test) return;
  let r = raw;
  if (test.mode === 'combo' && !Array.isArray(r.grade)) r = { ...r, grade: [r.grade, r.grade, r.grade] };
  r = applyDuck(s, r);
  const banner = gradeText(test.mode, r);
  c.last = banner;
  c.test = null;
  c.events = [];
  s.events.push({ type: 'graded', result: r, text: banner.text });
  if (test.kind === 'attack') resolveStrike(s, r);
  else if (test.kind === 'defend') resolveGuard(s, r, c.strikeIdx);
  else resolveFlee(s, r);
}

function enterPhase2(s: RunState): void {
  const c = fight(s);
  if (!checkPhase2(c.m)) return;
  clog(c, PHASE2_LINE);
  s.events.push({ type: 'phase2' });
}

export function resolveStrike(s: RunState, r: GradeResult): void {
  const c = fight(s);
  const h = s.hero;
  const m = c.m;
  const t = fightTile(s, c);
  const mods = modsOf(h);
  const bonus = h.trait.rows.includes(t.row) ? RELIC_COMBAT.trait : 0;
  const mode = heroClass(h).strike;
  const grades: Grade[] = Array.isArray(r.grade) ? r.grade : [r.grade];
  const dmgs = grades.map((g) => {
    let mult = ATK_MULT[mode][g];
    if (g === 'perfect' && mods.force) mult *= RELIC_COMBAT.force;
    if (g === 'miss' && mods.pair) mult *= RELIC_COMBAT.pair;
    return Math.max(1, Math.round((h.atk + bonus) * mult * variance(s)));
  });
  const dmg = dmgs.reduce((a, b) => a + b, 0);
  m.hp = Math.max(0, m.hp - dmg);
  if (m.hp > 0) enterPhase2(s);
  const crits = grades.filter((g) => g === 'perfect').length;
  s.stats.crits += crits;
  if (crits && mods.vampire && h.hp < h.maxHp) {
    const heal = Math.min(h.maxHp - h.hp, RELIC_COMBAT.vampire * crits);
    h.hp += heal;
    s.events.push({ type: 'heal', amount: heal, source: 'vampire' });
  }
  const verb = mode === 'charge' ? 'Your spell hits' : grades.length > 1 ? `Your ${grades.length}-hit combo hits` : 'You hit';
  clog(c, `${crits && grades.length === 1 ? 'Critical! ' : ''}${verb} ${m.name} for ${dmg}${bonus ? ' (trait +2)' : ''}.`);
  s.events.push({ type: 'heroHit', grades, dmgs, killed: m.hp === 0 });
  c.phase = 'wait';
  c.next = m.hp === 0 ? { kind: 'win' } : { kind: 'strike', i: 0 };
}

export function resolveGuard(s: RunState, r: GradeResult, i: number): void {
  const c = fight(s);
  const h = s.hero;
  const m = c.m;
  const mods = modsOf(h);
  const guard = heroClass(h).guard;
  const g: Grade = Array.isArray(r.grade) ? (r.grade[0] as Grade) : r.grade;
  c.phase = 'wait';
  if (g === 'perfect') {
    s.stats.dodges++;
    const counter = Math.max(1, Math.round(h.atk * (mods.blame || guard === 'sidestep' ? 1 : QTE.counter)));
    m.hp = Math.max(0, m.hp - counter);
    const what = guard === 'shield' ? 'Perfect parry!' : guard === 'sidestep' ? 'Perfect sidestep!' : 'Perfect dodge!';
    clog(c, `${what} You counter for ${counter}.`);
    if (m.hp > 0) enterPhase2(s);
    if (mods.hotfix && h.hp < h.maxHp) {
      const heal = Math.min(h.maxHp - h.hp, Math.ceil(h.maxHp * RELIC_COMBAT.hotfix));
      h.hp += heal;
      s.events.push({ type: 'heal', amount: heal, source: 'hotfix' });
    }
    s.events.push({ type: 'counter', dmg: counter, killed: m.hp === 0 });
    if (m.hp === 0) {
      c.next = { kind: 'win' };
      return;
    }
  } else {
    const md = Math.max(1, Math.round(m.dmg * patternDamageMult(m) * DEF_MULT[guard][g] * variance(s)));
    h.hp = Math.max(0, h.hp - md);
    if (m.tier === 5) s.stats.bossDmg += md;
    if (h.hp === 0 && mods.skeleton && !s.undying) {
      s.undying = true;
      h.hp = 1;
      clog(c, 'Your bones rattle back together. UNDYING!');
      s.events.push({ type: 'undying' });
    }
    clog(
      c,
      g === 'good'
        ? guard === 'sidestep'
          ? `It grazes you for ${md}.`
          : `You block. ${m.name} still deals ${md}.`
        : `${m.name} hits you for ${md}.`,
    );
    s.events.push({ type: 'monsterHit', grade: g, dmg: md, lethal: h.hp === 0 });
    if (h.hp === 0) {
      c.next = { kind: 'lose' };
      return;
    }
  }
  c.next = i + 1 < c.plan.length ? { kind: 'strike', i: i + 1 } : { kind: 'choose' };
}

export function resolveFlee(s: RunState, r: GradeResult): void {
  const c = fight(s);
  const h = s.hero;
  const m = c.m;
  const g: Grade = Array.isArray(r.grade) ? (r.grade[0] as Grade) : r.grade;
  const safe = g === 'perfect' || (g === 'good' && modsOf(h).cache);
  const md = safe ? 0 : Math.max(1, Math.round(m.dmg * DEF_MULT[heroClass(h).guard][g] * variance(s)));
  h.hp = Math.max(1, h.hp - md);
  if (g === 'perfect') s.stats.dodges++;
  s.events.push({ type: 'monsterHit', grade: g, dmg: md, lethal: false });
  c.phase = 'wait';
  c.next = { kind: 'escape', dmg: md };
}

/** After a flee: back to the previous tile, the monster stays. */
export function finishEscape(s: RunState, dmg: number): void {
  s.pos = s.prev ?? s.pos;
  s.combat = null;
  s.status = 'exploring';
  log(s, dmg ? `You escaped but took ${dmg} damage. It still haunts that day.` : 'A perfect escape. It still haunts that day.');
  s.events.push({ type: 'escaped', dmg });
}

export function winFight(s: RunState): void {
  const c = fight(s);
  const h = s.hero;
  const m = c.m;
  const t = fightTile(s, c);
  // FR-DIF-4: "before" is read before `defeated` is incremented (the prototype read it after).
  const before = pressure(s);
  t.resolved = true;
  s.stats.defeated++;
  const gold = fightTreasure(m.tier, h.cls);
  h.treasure += gold;
  s.combat = null;
  s.status = 'exploring';
  log(s, `${m.name} is banished: +${m.xp} XP, +${gold} treasure.`);
  gainXp(s, m.xp);
  const after = pressure(s);
  if (!t.boss && after < before - PRESSURE_EPS) {
    const { pct, maxed } = timingPercent(s);
    log(s, `The graph grows restless: timing windows ${pct}%.`);
    s.events.push({ type: 'timing', pct, maxed });
  }
  s.events.push({ type: 'monsterDown', boss: !!t.boss });
  const shard = collectShard(s, m.tier);
  trimLog(s);
  if (shard.got) s.events.push({ type: 'shard', have: s.shards, need: s.map.shardsNeeded, shattered: shard.shattered });
  if (t.boss) {
    s.bossDown = true;
    s.stats.bossHpLeft = h.hp;
    log(s, 'The Phantom falls. The Gate is unsealed!');
    s.events.push({ type: 'gateOpen' });
    if (t.kind === 'gate') endRun(s, 'won');
  }
}

export function loseFight(s: RunState): void {
  endRun(s, 'lost', fight(s).m.name);
}
