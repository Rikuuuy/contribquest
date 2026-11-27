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
  REST_HEAL,
  START_XP_MUL,
  WISP_HEAL,
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

/** Heals `ceil(maxHp × frac)` up to max HP; returns the HP restored. */
function healBy(h: RunState['hero'], frac: number): number {
  const n = Math.min(h.maxHp - h.hp, Math.ceil(h.maxHp * frac));
  h.hp += n;
  return n;
}

/** v1.6: the wisp heal comes before the XP, so a level-up from the XP still ends at full HP. */
export function collectWisp(s: RunState, tile: DayTile): void {
  tile.resolved = true;
  s.stats.wisps++;
  const healed = healBy(s.hero, WISP_HEAL);
  log(
    s,
    `A soul wisp from ${fmtShort(tile.day.date)} (${tile.day.count} contribution${plural(tile.day.count)}): +${WISP_XP} XP${healed > 0 ? `, +${healed} HP` : ''}.`,
  );
  s.events.push({ type: 'wisp', col: tile.col, row: tile.row, xp: WISP_XP, healed });
  gainXp(s, WISP_XP);
}

/** v1.6 quiet day (fog): a small rest, no XP, no RNG draw. */
export function restDay(s: RunState, tile: DayTile): void {
  tile.resolved = true;
  const healed = healBy(s.hero, REST_HEAL);
  const day = fmtShort(tile.day.date);
  log(s, healed > 0 ? `A quiet day (${day}). You catch your breath: +${healed} HP.` : `A quiet day (${day}). Nothing stirs.`);
  s.events.push({ type: 'rest', col: tile.col, row: tile.row, healed });
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
