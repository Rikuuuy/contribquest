// XP, levels, aura, wisps, and chests (prototype xpForLevel, levelFor, makeHero, gainXp, enterTile).
import { fmtShort, type DayTile } from '../mapgen';
import {
  AURA_DAYS,
  AURA_MAX,
  CHEST_GOLD,
  CHEST_HEAL,
  CHEST_XP,
  HUMAN_XP,
  MAX_LEVEL,
  START_XP_MUL,
  WISP_XP,
  XP_BASE,
} from './balance';
import { applyStats } from './classes';
import { log } from './log';
import { offerRelic } from './relics';
import type { RunState } from './state';

export function xpForLevel(n: number): number {
  return XP_BASE * n * (n - 1);
}

/** The highest level up to MAX_LEVEL whose threshold `xp` reaches. */
export function levelFor(xp: number): number {
  let L = 1;
  while (L < MAX_LEVEL && xp >= xpForLevel(L + 1)) L++;
  return L;
}

export function startingXp(total91: number): number {
  return Math.round(START_XP_MUL * Math.sqrt(total91));
}

export function auraTier(streak: number): number {
  return Math.min(Math.floor(streak / AURA_DAYS), AURA_MAX);
}

/** Adds XP (Human × 1.1, rounded); a level-up recomputes stats and heals to full, with one log line. */
export function gainXp(s: Pick<RunState, 'hero' | 'log' | 'events'>, amount: number): void {
  const h = s.hero;
  const x = h.race === 'human' ? Math.round(amount * HUMAN_XP) : amount;
  h.xp += x;
  s.events.push({ type: 'xp', amount: x });
  const L = levelFor(h.xp);
  if (L > h.level) {
    h.level = L;
    applyStats(h);
    h.hp = h.maxHp;
    log(s, `Level up! You are now level ${L}. HP fully restored.`);
    s.events.push({ type: 'levelUp', level: L });
  }
}

const plural = (n: number) => (n === 1 ? '' : 's');

export function collectWisp(s: RunState, tile: DayTile): void {
  tile.resolved = true;
  s.stats.wisps++;
  log(s, `A soul wisp from ${fmtShort(tile.day.date)} (${tile.day.count} contribution${plural(tile.day.count)}): +${WISP_XP} XP.`);
  s.events.push({ type: 'wisp', col: tile.col, row: tile.row, xp: WISP_XP });
  gainXp(s, WISP_XP);
}

/** Heal, treasure, log, XP, then the relic offer, in the prototype's order. */
export function openChest(s: RunState, tile: DayTile): void {
  const h = s.hero;
  tile.resolved = true;
  s.stats.chests++;
  const gold = CHEST_GOLD[tile.size === 2 ? 2 : 1];
  const before = h.hp;
  h.hp = Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp * CHEST_HEAL));
  h.treasure += gold;
  const healed = h.hp - before;
  log(s, `A chest from ${fmtShort(tile.day.date)}: +${gold} treasure${healed > 0 ? `, +${healed} HP` : ''}, +${CHEST_XP} XP.`);
  s.events.push({ type: 'chest', col: tile.col, row: tile.row, gold, healed });
  gainXp(s, CHEST_XP);
  offerRelic(s);
}
