import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ATK_MULT,
  CLASS_STATS,
  COMBAT_LOG_LINES,
  DEF_MULT,
  DIFFICULTY,
  HERO_STATS,
  HUMAN_XP,
  LEVEL_CAP,
  MAP_LOG_LINES,
  MONSTER,
  PATTERN,
  PHASE2,
  PRESSURE_EPS,
  QTE,
  RELIC_COMBAT,
  TEST_TIMING,
  VARIANCE,
  WINDOW_RULES,
  XP_PER_LEVEL,
} from '../../src/engine/balance';

// game-rules.md is the human-readable copy of balance.ts: a drift in either fails here.
const rules = readFileSync(new URL('../../.kiro/steering/game-rules.md', import.meta.url), 'utf8');
const lines = rules.split('\n');

/** The rows of the markdown table whose header row starts with `header`. */
function table(header: string): string[][] {
  const start = lines.findIndex((l) => l.startsWith(header));
  if (start < 0) throw new Error(`No table starting with ${header}`);
  const rows: string[][] = [];
  for (let i = start + 2; i < lines.length && (lines[i] as string).startsWith('|'); i++) {
    rows.push(
      (lines[i] as string)
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  }
  return rows;
}

const num = (cell: string): number => Number(cell.replace('−', '-').replace(/[^0-9.\-]/g, ''));
const classId = (name: string) => name.replace(/\(.*\)/, '').trim().toLowerCase() as keyof typeof DIFFICULTY;
const has = (text: string) => expect(rules, text).toContain(text);

describe('FR-DIF-1: balance.ts matches game-rules.md', () => {
  it('class difficulty table', () => {
    const rows = table('| Class | Stars |');
    expect(rows).toHaveLength(4);
    for (const [name, stars, label, pMul, gMul, speed, ramp, floor, loot, dmg] of rows) {
      const D = DIFFICULTY[classId(name as string)];
      expect({ ...D }).toEqual({
        stars: num(stars as string),
        label,
        pMul: num(pMul as string),
        gMul: num(gMul as string),
        speed: num(speed as string),
        ramp: num(ramp as string),
        floor: num(floor as string),
        loot: num(loot as string),
        dmg: num(dmg as string),
      });
    }
  });

  it('class table: tests, HP and ATK modifiers, Knight slow', () => {
    const rows = table('| Class | Strike test |');
    expect(rows).toHaveLength(4);
    for (const [name, strike, guard, hp, atk, other] of rows) {
      const C = CLASS_STATS[classId(name as string)];
      expect([C.strike, C.guard, C.hp, C.atk]).toEqual([strike, guard, num(hp as string), num(atk as string)]);
      const slow = /slow: ([\d.]+)/.exec(other as string);
      expect(C.slow).toBe(slow ? Number(slow[1]) : 1);
    }
  });

  it('damage multiplier tables', () => {
    for (const [mode, p, g, m] of table('| Strike mode |')) {
      const key = (mode as string).split(' ')[0] as keyof typeof ATK_MULT;
      expect(ATK_MULT[key]).toEqual({ perfect: num(p as string), good: num(g as string), miss: num(m as string) });
    }
    for (const [mode, p, g, m] of table('| Guard mode |')) {
      expect(DEF_MULT[mode as keyof typeof DEF_MULT]).toEqual({ perfect: num(p as string), good: num(g as string), miss: num(m as string) });
    }
    expect(Object.keys(ATK_MULT).sort()).toEqual(['bar', 'charge', 'combo']);
    expect(Object.keys(DEF_MULT).sort()).toEqual(['ring', 'shield', 'sidestep']);
  });

  it('QTE constants table', () => {
    const rows = Object.fromEntries(table('| Constant | Value |').map(([k, v]) => [(k as string).replace(/`/g, ''), num(v as string)]));
    expect(rows).toEqual({
      'QTE.perfect': QTE.perfect,
      'QTE.good': QTE.good,
      'QTE.auraPerfect': QTE.auraPerfect,
      'QTE.calm': QTE.calm,
      'QTE.grace': QTE.grace,
      'QTE.counter': QTE.counter,
      'QTE.dmgScale': QTE.dmgScale,
    });
  });

  it('windows and speed formulas', () => {
    has(`tm = speed × (${WINDOW_RULES.tmBase} + ${WINDOW_RULES.tmPressure} × pressure)`);
    has(`P  = (${QTE.perfect} + ${QTE.auraPerfect} × aura + (Linter ? ${RELIC_COMBAT.linter} : 0)) × calm + (Elf ? ${RELIC_COMBAT.elf} × calm : 0)`);
    has(`G  = max(${QTE.good} × calm × gMul × pressure, ${WINDOW_RULES.gFromP} × P)`);
    has(`sidestep:  P = P × ${WINDOW_RULES.sidestepP}`);
    has(`combo:     G = min(G, ${WINDOW_RULES.comboG} × calm × gMul × pressure)`);
  });

  it('mode timing formulas and deadlines', () => {
    const T = TEST_TIMING;
    has(`dur = (${T.barBase} − ${T.barPerTier}t) × calm × tm × slow`);
    has(`zone = ${T.barZone} + ${T.barZoneRand} × rand()`);
    has(`Miss "too late" at \`dur + ${T.deadline}\``);
    has(`dur = (${T.comboBase} − ${T.comboPerTier}t) × calm × tm`);
    has(`z0 = ${T.comboZ0} + ${T.comboZ0Rand} × rand()`);
    has(`g1, g2 = ${T.comboGap} + ${T.comboGapRand} × rand()`);
    has(`fill = (${T.chargeBase} − ${T.chargePerTier}t) × calm × tm`);
    has(`target hold \`${T.chargeTarget} × fill\`; \`dur = ${T.chargeDur} × calm\``);
    has(`Overload Miss at \`fill + ${T.chargeOverload}\` after the press`);
    has(`base = (quick ? ${PATTERN.quickBase} : ${T.guardBase} − ${T.guardPerTier}t) × calm × tm × patSpeed`);
    has(`Miss at \`target + P + ${T.shieldGrace}\``);
    has(`charge: after ${T.assistCharge} ms`);
  });

  it('pattern formulas', () => {
    has(`a pause of \`(${PATTERN.flakyPause} + ${PATTERN.flakyPauseRand} × rand()) × calm × tm\` at \`base × (${PATTERN.flakyAt} + ${PATTERN.flakyAtRand} × rand())\``);
    has(`max(${PATTERN.conflictMinG} × G, (${PATTERN.conflictDist} + ${PATTERN.conflictDistRand} × rand()) × calm × tm)\` (minus if \`rand() < ${PATTERN.conflictSide}\`)`);
    has(`\`flaky\` if \`rand() < ${PATTERN.planChance}\``);
    has(`\`conflict\` if \`rand() < ${PATTERN.planChance}\``);
    has(`Bug Imp × ${PATTERN.impMult}, boss in phase 2 × ${PHASE2.damage}`);
  });

  it('boss phase 2 numbers', () => {
    has('`hp ≤ maxHp / 2`');
    expect(PHASE2.hpFrac).toBe(0.5);
    has(`guard-test speed × ${PHASE2.speed}`);
    has(`pressure × ${PHASE2.pressure}`);
    has(`strike damage × ${PHASE2.damage}`);
    has(`then × **${PHASE2.pressure}** while the boss is in phase 2`);
  });

  it('pressure', () => {
    has('`pressure = max(floor, 1 − ramp × defeated)`');
    has(`\`pressure ≤ floor + ${PRESSURE_EPS}\``);
  });

  it('monster formulas', () => {
    const M = MONSTER;
    has(`\`f = 1 + ${M.levelScale} × (startLevel − 1)\``);
    has(`\`hp = round((${M.hpBase} + ${M.hpPerTier} × t) × f × (t === 5 ? ${M.bossHp} : 1))\``);
    has(`\`dmg = round((${M.dmgBase} + t) × f × ${QTE.dmgScale} × (cursed ? ${M.curse} : 1) × classDmg)\``);
    has(`XP \`${M.xpPerTier} × t\`, boss ${M.bossXp}`);
    has(`\`round((t === 5 ? ${M.bossLoot} : ${M.lootPerTier} × t) × loot)\``);
  });

  it('hero stat formulas', () => {
    const H = HERO_STATS;
    has(
      `\`maxHp = round((${H.hpBase} + ${H.hpPerLevel} × (level − 1) + ${H.hpPerAura} × aura + traitHp + (Cold Brew ? ${RELIC_COMBAT.coffeeHp} : 0)) × classHp)\``,
    );
    has(
      `\`atk = ${H.atkBase} + ${H.atkPerLevel} × (level − 1) + aura + (Stack Overflow ? ${RELIC_COMBAT.stackAtk} : 0) + classAtk + (Orc ? ${RELIC_COMBAT.orcAtk} : 0)\``,
    );
    has(`\`${XP_PER_LEVEL} × n × (n − 1)\``);
    has(`Cap at **level ${LEVEL_CAP}**`);
    has(`every XP gain × ${HUMAN_XP}, rounded`);
  });

  it('combat formulas, relics, and races', () => {
    has(`\`max(1, round((atk + traitBonus) × mult × (${VARIANCE.base} + ${VARIANCE.spread} × rand())))\``);
    has(`× ${RELIC_COMBAT.force} on Perfect with Force Push, × ${RELIC_COMBAT.pair} on Miss with Pair Programmer`);
    has(`\`c = ${QTE.counter}\` otherwise`);
    has(`Each perfect dodge heals \`ceil(maxHp × ${RELIC_COMBAT.hotfix})\``);
    has(`Perfect window +${RELIC_COMBAT.linter} ms (before calm)`);
    has(`Perfect window +${RELIC_COMBAT.elf} ms × calm`);
    has(`+${RELIC_COMBAT.orcAtk} ATK`);
    has(`Each Perfect strike hit heals ${RELIC_COMBAT.vampire} HP`);
    has(`The +${RELIC_COMBAT.trait} applies to strike damage`);
    has(`+${RELIC_COMBAT.stackAtk} ATK`);
    has(`+${RELIC_COMBAT.coffeeHp} max HP (before class scaling)`);
  });

  it('log lengths', () => {
    has(`the map log keeps the last ${MAP_LOG_LINES} lines, the combat log the last ${COMBAT_LOG_LINES}`);
  });
});
