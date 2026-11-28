// The combat panel and battle screen layout (presentation requirements 11.1–11.3, 18.1–18.5; prototype
// buildBars, renderTabs, renderCombat, setBar, qteLoop). It fills the `#combat` markup from the state, runs the
// frame loop for the 2D stage and the QTE gauge, and sends Attack. The gauge and the stage are 2D canvases, so
// the fight stays playable without WebGL. It never schedules `advance` or `timeout`: main.ts owns those timers.
import {
  classDiff,
  heroClass,
  RACE_NAMES,
  relicById,
  sourceLabel,
  timingPercent,
  type Action,
  type Fight,
  type GameEvent,
  type RunState,
} from '../../engine';
import { tileAt } from '../../mapgen';
import { $, esc, sizeCanvas } from '../dom';
import { gradeLine, type HitLog } from '../hit-meter';
import { relicIcon } from '../hud';
import { REDUCED } from '../motion';
import { PACING } from '../pacing';
import { drawQte, GAUGE } from '../qte-gauge';
import { MONSTER_SPRITE, monsterKey, spriteCache } from '../sprites/build';
import { drawSprite } from '../sprites/draw';
import { drawStage, newMarks, stageBg, STAGE, type StageMarks } from '../stage';

export type CombatDeps = {
  dispatch: (a: Action) => void;
  /** `performance.now()` when the current test started. */
  testStart: () => number;
  /** The timing offset in ms (subtracted from presses by main.ts). */
  offset: () => number;
  /** The hit-error history, for the meter between tests. */
  hits: () => Readonly<HitLog>;
};

export type CombatScreen = {
  /**
   * Draws a state. `err` is the signed error of the press or release this step graded (requirement 17.3), or
   * null. Hides the panel and stops the loop when no fight is open.
   */
  update(state: RunState, err?: number | null): void;
};

/** The foe tab's pattern line by tier (prototype FOE_PATTERN). */
export const FOE_PATTERN: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: 'One plain strike per turn.',
  2: 'Strikes twice. The second hit comes fast.',
  3: 'Flaky: its strike can freeze mid-swing. Do not press at the old pace.',
  4: 'Merge conflict: a dashed decoy ring comes with the real one. Dodge the solid ring.',
  5: 'Two strikes per turn. Below half HP it enters Phase 2: three fast strikes that mix every pattern.',
};

/** The foe's pattern line: the boss drops the phase-2 warning once in phase 2, and a bound boss never gets it. */
export function foePattern(m: Fight['m']): string {
  if (m.tier !== 5) return FOE_PATTERN[m.tier];
  const [first, ...rest] = FOE_PATTERN[5].split('. ');
  return m.phase2 ? rest.join('. ') : m.bound ? `${first}.` : FOE_PATTERN[5];
}

/** The fight's source label: the day tile, or the best day for the boss. */
export function fightSource(s: RunState, f: Fight): string {
  const boss = f.m.tier === 5;
  const tile = boss ? s.map.tiles[s.map.bossIdx] : tileAt(s.map, f.col, f.row);
  if (!tile) return boss && s.map.emptyQuarter ? 'Born from 91 days of silence' : '';
  return sourceLabel(tile, s.map, boss);
}

const pct = (a: number, b: number) => Math.min(100, Math.max(0, (a / Math.max(1, b)) * 100));

const HEART_SVG =
  '<svg class="heart" viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true"><path fill="#ff5a6a" d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/><path fill="#ffb3bc" d="M1 1h1v1H1z"/></svg>';

/** The foe and hero tab bodies (requirement 18.4); every value is escaped. */
export function tabHtml(s: RunState, tab: 'hero' | 'foe'): string {
  const f = s.combat;
  if (!f) return '';
  const m = f.m;
  const h = s.hero;
  if (tab === 'foe') {
    return `<div class="tl"><b>${esc(m.name.length > 24 ? 'The Phantom' : m.name)}</b><span>${m.tier === 5 ? 'BOSS' : `TIER ${m.tier}`}</span></div>
      <span class="mini"><i style="width:${pct(m.hp, m.maxHp)}%"></i></span>
      <div class="sub">${Math.max(0, m.hp)}/${m.maxHp} HP · hits for about ${m.dmg}<br>${esc(foePattern(m))}</div>`;
  }
  const relics = h.relics
    .map((id) => {
      const r = relicById(id);
      return `<img src="${relicIcon(id)}" alt="${esc(r.name)}" title="${esc(r.name)}: ${esc(r.text)}">`;
    })
    .join('');
  const race = RACE_NAMES[h.race] ?? RACE_NAMES.human;
  return `<div class="tl"><b>${esc(h.name)}</b><span>LV ${h.level}</span></div>
      <span class="mini g"><i style="width:${pct(h.hp, h.maxHp)}%"></i></span>
      <div class="sub">${Math.max(0, h.hp)}/${h.maxHp} HP · ATK ${h.atk} · ${esc(race)} ${esc(heroClass(h).name)} (${esc(classDiff(h.cls).label)})<br>Timing windows ${timingPercent(s).pct}%${relics ? `<br>${relics}` : ''}</div>`;
}

/** Mounts the combat panel on the page's `#combat` markup. */
export function createCombatScreen(deps: CombatDeps, root: ParentNode = document): CombatScreen {
  const box = $('#combat', root);
  const fightEl = $('.fight', root);
  const slot = $('#stage-slot', root);
  const monHp = $('#c-mon-hp', root);
  const plate = $('#c-hero-hp', root);
  const grade = $('#qte-grade', root);
  const clog = $('#clog', root);
  const tabBody = $('#tab-body', root);
  const chooseRow = $('#choose-row', root);
  const qteRow = $('#qte-row', root);
  const btnAttack = $<HTMLButtonElement>('#btn-attack', root);
  const btnQte = $<HTMLButtonElement>('#btn-qte', root);

  const qteCtx = sizeCanvas($<HTMLCanvasElement>('#qte', root), GAUGE.w, GAUGE.h);
  const stageCv = document.createElement('canvas');
  stageCv.className = 'stage2d';
  stageCv.width = STAGE.w * STAGE.zoom;
  stageCv.height = STAGE.h * STAGE.zoom;
  slot.prepend(stageCv);
  const stageCtx = stageCv.getContext('2d');

  let state: RunState | null = null;
  let fightKey: string | null = null;
  let tab: 'hero' | 'foe' = 'foe';
  let bg: HTMLCanvasElement | null = null;
  let marks: StageMarks = newMarks();
  let hpTimer: ReturnType<typeof setTimeout> | null = null;
  let raf = 0;
  let lastTestId = -1;

  root.querySelectorAll<HTMLButtonElement>('.tabs button[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset['tab'] === 'hero' ? 'hero' : 'foe';
      renderTabs();
    }),
  );
  btnAttack.addEventListener('click', () => {
    if (state?.status === 'combat' && state.combat?.phase === 'choose') deps.dispatch({ type: 'attack' });
  });

  function renderTabs(): void {
    if (!state?.combat) return;
    root.querySelector('#tab-hero')?.setAttribute('aria-selected', String(tab === 'hero'));
    root.querySelector('#tab-foe')?.setAttribute('aria-selected', String(tab === 'foe'));
    tabBody.innerHTML = tabHtml(state, tab);
  }

  function buildBars(s: RunState, f: Fight): void {
    const boss = f.m.tier === 5;
    monHp.innerHTML = `<span class="bar"><i class="ghost"></i><i class="fill"></i><span class="ticks"></span>${boss && !f.m.bound ? '<span class="bb-mark" title="Phase 2 at half HP"></span>' : ''}</span>
      <div class="bb-row"><span id="m-chips"></span><span class="hpnum"></span></div>`;
    plate.innerHTML = `<div class="pn">${HEART_SVG}<span class="nm">${esc(s.hero.name)}</span><span class="hpnum"></span></div>
      <span class="bar"><i class="ghost"></i><i class="fill"></i></span>
      <div class="tm">TIMING<span class="tb"><i></i></span><b></b></div><div class="rl"></div>`;
    const pc = sizeCanvas($<HTMLCanvasElement>('#m-portrait', root), 58, 58);
    pc.clearRect(0, 0, 58, 58);
    const key = monsterKey(MONSTER_SPRITE[f.m.tier]);
    const ph = (spriteCache.get(key)?.base.height ?? 14) * 3;
    drawSprite(pc, key, 29, ph > 58 ? 2 + ph / 2 : 31, 3, 1, { flip: true });
  }

  function setBar(el: HTMLElement, hp: number, max: number): void {
    const w = `${pct(hp, max)}%`;
    const fill = el.querySelector<HTMLElement>('.fill');
    const ghost = el.querySelector<HTMLElement>('.ghost');
    if (fill) fill.style.width = w;
    if (ghost) ghost.style.width = w;
    const num = el.querySelector<HTMLElement>('.hpnum');
    if (num) num.textContent = `${Math.max(0, hp)}/${max}`;
  }

  function onEvents(events: readonly GameEvent[], now: number): void {
    const at = now + PACING.hpBarDelay;
    for (const e of events) {
      if (e.type === 'heroHit' && e.dmgs.some((d) => d > 0)) {
        marks.monHurt = at;
        marks.crit = e.grades.includes('perfect');
      } else if (e.type === 'counter' && e.dmg > 0) marks.monHurt = at;
      else if (e.type === 'monsterHit' && e.dmg > 0) marks.heroHurt = at;
      else if (e.type === 'monsterDown') marks.monDie = at;
    }
  }

  function frame(now: number): void {
    raf = 0;
    const s = state;
    const f = s?.combat;
    if (!s || !f || s.status !== 'combat') return;
    raf = requestAnimationFrame(frame);
    const test = f.phase === 'test' ? f.test : null;
    drawQte(qteCtx, test, now - deps.testStart(), {
      now,
      assist: s.opts.assist,
      reduced: REDUCED,
      events: f.events,
      offset: deps.offset(),
      hits: deps.hits(),
    });
    // The 2D stage is drawn only while the 3D arena canvas is not in the slot (WebGL missing or failed).
    if (stageCtx && bg && !slot.querySelector('canvas.world')) drawStage(stageCtx, bg, s, marks, now, REDUCED);
  }

  function hide(): void {
    box.hidden = true;
    fightKey = null;
    if (hpTimer !== null) clearTimeout(hpTimer);
    hpTimer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  return {
    update(s: RunState, err: number | null = null): void {
      state = s;
      const f = s.status === 'combat' ? s.combat : null;
      if (!f) return hide();
      const now = performance.now();
      const key = `${f.col},${f.row},${f.m.name}`;
      const first = key !== fightKey || s.events.some((e) => e.type === 'fightStart');
      box.hidden = false;
      if (first) {
        fightKey = key;
        tab = 'foe';
        marks = newMarks();
        lastTestId = -1;
        grade.className = 'grade';
        grade.textContent = '';
        bg = stageBg(f.m.tier === 5, f.col * 7 + f.row);
        fightEl.classList.toggle('boss', f.m.tier === 5);
        buildBars(s, f);
      } else onEvents(s.events, now);

      $('#m-name', root).textContent = f.m.name;
      const timing = timingPercent(s).pct;
      const chips = root.querySelector<HTMLElement>('#m-chips');
      if (chips)
        chips.innerHTML =
          `<span class="chip csrc">${esc(fightSource(s, f))}</span><span class="chip time">TIMING ${timing}%</span>` +
          (f.m.tier === 5 ? `<span class="chip ${f.m.phase2 ? 'p2' : ''}">${f.m.phase2 ? 'PHASE 2' : 'PHASE 1'}</span>` : '');
      const tb = plate.querySelector<HTMLElement>('.tb i');
      if (tb) tb.style.width = `${Math.min(100, Math.max(0, timing / 1.25))}%`;
      const tmb = plate.querySelector<HTMLElement>('.tm b');
      if (tmb) tmb.textContent = `${timing}%`;
      const rl = plate.querySelector<HTMLElement>('.rl');
      if (rl) rl.innerHTML = s.hero.relics.map((id) => `<img src="${relicIcon(id)}" alt="">`).join('');

      // HP bars change when the hit lands on the stage, 110 ms after the test resolves (requirement 11.1).
      if (hpTimer !== null) clearTimeout(hpTimer);
      const hp = s.hero.hp;
      const maxHp = s.hero.maxHp;
      const mhp = f.m.hp;
      const apply = () => {
        hpTimer = null;
        if (fightKey !== key) return;
        setBar(plate, hp, maxHp);
        setBar(monHp, mhp, f.m.maxHp);
        renderTabs();
      };
      if (f.phase === 'wait' && !first) hpTimer = setTimeout(apply, PACING.hpBarDelay);
      else apply();

      clog.innerHTML = f.lines.map((l) => `<div>&gt; ${esc(l)}</div>`).join('');

      const g = s.events.find((e): e is Extract<GameEvent, { type: 'graded' }> => e.type === 'graded');
      if (g) {
        grade.className = `grade ${f.last?.cls ?? ''}`;
        grade.textContent = gradeLine(g.text, err, g.result.why);
        if (!REDUCED) {
          void grade.offsetWidth;
          grade.classList.add('pop');
        }
      }

      chooseRow.hidden = f.phase !== 'choose';
      qteRow.hidden = f.phase !== 'test' || s.opts.assist;
      if (first && f.phase === 'choose') btnAttack.focus({ preventScroll: true });
      if (f.phase === 'test' && f.testId !== lastTestId) {
        lastTestId = f.testId;
        if (!s.opts.assist) btnQte.focus({ preventScroll: true });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    },
  };
}
