// Relics (prototype RELICS, relicById, offerRelic, pickRelic).
import { COLD_BREW_HEAL, RELIC_OFFER } from './balance';
import { applyStats } from './classes';
import { reveal } from './explore';
import { log } from './log';
import { rand } from './rand';
import type { RelicId, RunState } from './state';

export type Relic = { id: RelicId; name: string; text: string };

export const RELICS: readonly Relic[] = [
  { id: 'duck', name: 'Rubber Duck', text: 'The first missed timing in each fight counts as Good.' },
  { id: 'hotfix', name: 'Hotfix', text: 'Every perfect dodge heals 6% of max HP.' },
  { id: 'force', name: 'Force Push', text: 'Critical hits deal 25% more damage.' },
  { id: 'linter', name: 'Linter', text: 'The Perfect timing window is 25 ms wider.' },
  { id: 'stack', name: 'Stack Overflow', text: '+3 ATK.' },
  { id: 'coffee', name: 'Cold Brew', text: '+10 max HP, and heal 10 now.' },
  { id: 'blame', name: 'Git Blame', text: 'Counter-attacks deal full ATK instead of half.' },
  { id: 'pair', name: 'Pair Programmer', text: 'Glancing blows deal 60% more damage.' },
  { id: 'review', name: 'Code Review', text: 'Your lantern reveals and lights a wider area.' },
  { id: 'cache', name: 'CI Cache', text: 'Fleeing with a Good press takes no damage.' },
];

export const CHEST_TITLE = 'The chest holds a relic. Choose one.';

export function relicById(id: RelicId): Relic {
  return RELICS.find((r) => r.id === id) as Relic;
}

/** Offers up to three unowned relics, Fisher-Yates shuffled with the run RNG. No draw when all are owned. */
export function offerRelic(s: RunState, title?: string): void {
  // The prototype sets the title before checking the pool.
  s.relicTitle = title || CHEST_TITLE;
  const owned = s.hero.relics;
  const pool = RELICS.filter((r) => !owned.includes(r.id)).map((r) => r.id);
  if (!pool.length) return;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [pool[i], pool[j]] = [pool[j] as RelicId, pool[i] as RelicId];
  }
  s.relicOffer = pool.slice(0, RELIC_OFFER);
  s.status = 'relic';
  s.events.push({ type: 'relicOffer', ids: [...s.relicOffer], title: s.relicTitle });
}

/** Keeps the relic at index `i` of the offer; anything else is ignored. */
export function pickRelic(s: RunState, i: number): void {
  if (s.status !== 'relic' || !s.relicOffer) return;
  const id = Number.isInteger(i) && i >= 0 ? s.relicOffer[i] : undefined;
  if (!id) return;
  const h = s.hero;
  const r = relicById(id);
  h.relics.push(id);
  s.relicOffer = null;
  s.status = 'exploring';
  applyStats(h);
  if (id === 'coffee') h.hp = Math.min(h.maxHp, h.hp + COLD_BREW_HEAL);
  h.hp = Math.min(h.hp, h.maxHp);
  if (id === 'review') reveal(s);
  log(s, `Relic: ${r.name}. ${r.text}`);
  s.events.push({ type: 'relicPicked', id });
}
