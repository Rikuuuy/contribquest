// HUD, map log, and the low-HP danger overlay (prototype renderHud, renderLog; requirements 3.1–3.4, v1.6).
// `hudView` is pure; the render functions write the DOM.
import { classDiff, heroClass, relicById, timingPercent, xpForLevel, type RelicId, type RunState } from '../engine';
import { EMPTY_QUARTER_BOSS } from '../engine/monsters';
import { fmtShort } from '../mapgen';
import { esc } from './dom';
import { itemKey, spriteCache } from './sprites/build';

export type HudView = {
  name: string;
  cls: string;
  stars: 1 | 2 | 3 | 4;
  timing: { pct: number; maxed: boolean };
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  next: number | null;
  xpPct: number;
  atk: number;
  treasure: number;
  relics: { id: RelicId; name: string; text: string }[];
  shards: { have: number; max: 3 };
  /** "Week 4/14", or "Boss" on the boss node. */
  week: string;
  /** One of the four v1.6 boss lines (requirement 3.1). */
  boss: string;
  banished: boolean;
  lowHp: boolean;
};

const MAX_LEVEL = 10;
const LOW_HP = 0.3;

/** "The Phantom of {fmtShort}", or the empty-quarter name. */
function phantomName(s: RunState): string {
  const best = s.map.tiles[s.map.bossIdx];
  return s.map.emptyQuarter || !best ? EMPTY_QUARTER_BOSS : `The Phantom of ${fmtShort(best.day.date)}`;
}

/** The boss line for the shards held, or "Phantom banished" after the win. */
export function bossLine(s: RunState): string {
  if (s.bossDown) return 'Phantom banished';
  const have = Math.min(3, Math.max(0, s.shards));
  const name = phantomName(s);
  if (have === 0) return `${name} waits after the last week`;
  if (have < 3) return `${name}: ${10 * have}% weaker`;
  return `${name} is bound: no Phase 2`;
}

/** Plain HUD data for a run (requirement 3.1). */
export function hudView(s: RunState): HudView {
  const h = s.hero;
  const next = h.level >= MAX_LEVEL ? null : xpForLevel(h.level + 1);
  const cur = xpForLevel(h.level);
  const xpPct = next ? Math.max(0, Math.min(100, ((h.xp - cur) / (next - cur)) * 100)) : 100;
  const low = h.hp > 0 && h.hp / h.maxHp < LOW_HP && (s.status === 'exploring' || s.status === 'combat');
  return {
    name: h.name,
    cls: heroClass(h).name.toUpperCase(),
    stars: classDiff(h.cls).stars,
    timing: timingPercent(s),
    level: h.level,
    hp: h.hp,
    maxHp: h.maxHp,
    xp: h.xp,
    next,
    xpPct,
    atk: h.atk,
    treasure: h.treasure,
    relics: h.relics.map((id) => {
      const r = relicById(id);
      return { id, name: r.name, text: r.text };
    }),
    shards: { have: s.shards, max: 3 },
    week: s.pos.col >= s.map.cols ? 'Boss' : `Week ${s.pos.col + 1}/${s.map.cols}`,
    boss: bossLine(s),
    banished: s.bossDown,
    lowHp: low,
  };
}

const STAR_PATH = 'M5 0.4l1.4 3 3.2.4-2.4 2.2.6 3.2L5 7.6 2.2 9.2l.6-3.2L.4 3.8l3.2-.4z';

/** The prototype's difficulty stars. */
export function starsHtml(n: number): string {
  const one = (i: number) =>
    `<svg viewBox="0 0 10 10" width="10" height="10"><path d="${STAR_PATH}" fill="${i < n ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="0.9"/></svg>`;
  return `<span class="stars" role="img" aria-label="${n} of 4 stars">${[0, 1, 2, 3].map(one).join('')}</span>`;
}

const icons = new Map<RelicId, string>();

/** A relic icon as a data URL of its sprite canvas, built once per relic. */
function relicIcon(id: RelicId): string {
  let u = icons.get(id);
  if (!u) {
    const key = itemKey(`r_${id}`);
    u = spriteCache.get(key)?.base.toDataURL() ?? '';
    icons.set(id, u);
  }
  return u;
}

type Bumps = { lv: number; hp: number; xp: number; atk: number; tr: number; sh: number };
let prev: Bumps | null = null;

/** Forgets the last HUD values, so a new run's first render plays no bump. */
export function resetHud(): void {
  prev = null;
}

/**
 * Writes the HUD into `el` and plays the bump on changed values and the level flash on a level-up
 * (requirement 3.2), unless reduced motion is on.
 */
export function renderHud(el: HTMLElement, v: HudView, reduced: boolean): void {
  const relics = v.relics.length
    ? `<span class="relics">${v.relics.map((r) => `<img src="${relicIcon(r.id)}" alt="${esc(r.name)}" title="${esc(r.name)}: ${esc(r.text)}">`).join('')}</span>`
    : '';
  el.innerHTML = `
    <span class="name">${esc(v.name)}</span> <span class="cls">${esc(v.cls)} <span class="cd d${v.stars}">${starsHtml(v.stars)}</span></span>
    <span class="press ${v.timing.maxed ? 'max' : ''}" title="Width of your timing windows. They shrink every time you banish a monster.">Timing <b>${v.timing.pct}%</b></span>
    <span>Lv <b data-k="lv">${v.level}</b></span>
    <span>HP <span class="bar"><i style="width:${(v.hp / Math.max(1, v.maxHp)) * 100}%"></i></span> <b data-k="hp">${v.hp}</b>/${v.maxHp}</span>
    <span>XP <span class="bar xp"><i style="width:${v.xpPct}%"></i></span> <span data-k="xp">${v.xp}</span>${v.next ? `/${v.next}` : ''}</span>
    <span>ATK <b data-k="atk">${v.atk}</b></span>
    <span style="color:var(--orange)">Treasure <b data-k="tr">${v.treasure}</b></span>
    ${relics}
    <span class="week">${esc(v.week)}</span>
    <span class="boss">Soul shards <b data-k="sh">${v.shards.have}/${v.shards.max}</b></span>
    <span class="boss ${v.banished ? 'down' : ''}">${esc(v.boss)}</span>`;
  const now: Bumps = { lv: v.level, hp: v.hp, xp: v.xp, atk: v.atk, tr: v.treasure, sh: v.shards.have };
  if (prev && !reduced) {
    for (const k of Object.keys(now) as (keyof Bumps)[])
      if (now[k] !== prev[k]) el.querySelector(`[data-k="${k}"]`)?.classList.add('bump');
    if (now.lv > prev.lv) {
      el.classList.remove('lvl');
      void el.offsetWidth;
      el.classList.add('lvl');
    }
  }
  prev = now;
}

/** The map log: the last 4 lines in the `aria-live` region (requirement 3.4). */
export function renderLog(el: HTMLElement, lines: readonly string[]): void {
  el.innerHTML = lines
    .slice(-4)
    .map((l) => `<div>${esc(l)}</div>`)
    .join('');
}

/**
 * The pulsing red danger overlay while HP is low (requirement 3.3); never with reduced motion. Returns `low`, so
 * the caller can tell the audio module (group 9).
 */
export function renderDanger(el: HTMLElement, low: boolean, reduced: boolean): boolean {
  el.classList.toggle('on', low && !reduced);
  return low;
}
