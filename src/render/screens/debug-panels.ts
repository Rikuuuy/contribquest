// Plain stand-ins for the fight, relic, and end screens on the /next/ page, so a run can be played through the
// boss node before those screens exist (fight: presentation groups 6–7 and run B; relic and end: groups 5 and 8).
// Text only: no canvas, no effects. Every value is escaped.
import { relicById, resultsView, type RunState } from '../../engine';
import { esc } from '../dom';

const hpText = (hp: number, max: number) => `HP ${Math.max(0, hp)}/${max}`;

/** The `#combat` overlay as a text panel: names, HP, the combat log, and the attack or timing prompt. */
export function renderFightPanel(root: ParentNode, s: RunState): void {
  const box = root.querySelector<HTMLElement>('#combat');
  if (!box) return;
  const f = s.status === 'combat' ? s.combat : null;
  box.hidden = !f;
  if (!f) return;
  const set = (sel: string, html: string) => {
    const el = root.querySelector<HTMLElement>(sel);
    if (el) el.innerHTML = html;
  };
  root.querySelector('.fight')?.classList.toggle('boss', f.m.tier === 5);
  set('#m-name', esc(f.m.name));
  set('#c-mon-hp', esc(hpText(f.m.hp, f.m.maxHp)));
  set('#c-hero-hp', esc(`${s.hero.name}: ${hpText(s.hero.hp, s.hero.maxHp)}`));
  set('#clog', f.lines.map((l) => `<div>${esc(l)}</div>`).join(''));
  const grade = root.querySelector<HTMLElement>('#qte-grade');
  if (grade) {
    grade.className = `grade ${f.last?.cls ?? ''}`;
    grade.textContent = f.last?.text ?? '';
  }
  const t = f.phase === 'test' ? f.test : null;
  set(
    '#tab-body',
    t
      ? esc(`${t.kind === 'attack' ? 'Strike' : 'Guard'}: ${t.mode} (${t.pattern}). Press Space, or tap Now!, on the beat.`)
      : f.phase === 'choose'
        ? 'Press A, or tap Attack.'
        : '',
  );
  const choose = root.querySelector<HTMLElement>('#choose-row');
  const qte = root.querySelector<HTMLElement>('#qte-row');
  if (choose) choose.hidden = f.phase !== 'choose';
  if (qte) qte.hidden = f.phase !== 'test';
}

/** The `#relic` dialog: one button per offered relic; `pick(i)` sends `pickRelic`. */
export function renderRelicPanel(root: ParentNode, s: RunState, pick: (i: number) => void): void {
  const box = root.querySelector<HTMLElement>('#relic');
  if (!box) return;
  const ids = s.status === 'relic' ? s.relicOffer : null;
  box.hidden = !ids;
  if (!ids) return;
  const title = root.querySelector<HTMLElement>('#relic-title');
  if (title && s.relicTitle) title.textContent = s.relicTitle;
  const cards = root.querySelector<HTMLElement>('#relic-cards');
  if (!cards) return;
  cards.innerHTML = ids
    .map((id, i) => {
      const r = relicById(id);
      return `<button type="button" class="ghost" data-relic="${i}"><b>${i + 1}. ${esc(r.name)}</b><br>${esc(r.text)}</button>`;
    })
    .join(' ');
  cards.querySelectorAll<HTMLButtonElement>('button[data-relic]').forEach((b) =>
    b.addEventListener('click', () => pick(Number(b.dataset['relic']))),
  );
}

/** Fills `#screen-end` with the results text after a win or a loss. */
export function renderEndPanel(root: ParentNode, s: RunState): void {
  const v = resultsView(s);
  const set = (sel: string, text: string) => {
    const el = root.querySelector<HTMLElement>(sel);
    if (el) el.textContent = text;
  };
  set('#end-title', v.title);
  set('#end-sub', v.sub);
  const dl = (rows: [string, string][]) => rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('');
  const game = root.querySelector<HTMLElement>('#end-game');
  const gh = root.querySelector<HTMLElement>('#end-gh');
  if (game) game.innerHTML = dl(v.game);
  if (gh) gh.innerHTML = dl(v.gh);
  set('#end-today', v.today);
}
