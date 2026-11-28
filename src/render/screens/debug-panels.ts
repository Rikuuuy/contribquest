// Plain stand-ins for the relic and end screens on the /next/ page, so a run can be played through the boss node
// before those screens exist (presentation groups 5 and 8). The fight is `combat.ts`. Text only: no canvas, no
// effects. Every value is escaped.
import { relicById, resultsView, type RunState } from '../../engine';
import { esc } from '../dom';

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
