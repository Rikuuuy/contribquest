import { describe, expect, it } from 'vitest';
import { legalMoves, viewAhead } from '../../src/engine/explore';
import { CHEST_TITLE, RELICS, offerRelic, pickRelic, relicById } from '../../src/engine/relics';
import type { Action, RelicId, RunState } from '../../src/engine/state';
import { step } from '../../src/engine/step';
import { nextFloat } from '../../src/mapgen/rng';
import { makeTestRun } from '../fixtures/run';

const ALL: RelicId[] = ['duck', 'hotfix', 'force', 'linter', 'stack', 'coffee', 'blame', 'pair', 'review', 'cache'];

/** Advances an RNG state by n draws. */
function drawn(rng: number, n: number): number {
  let st = rng;
  for (let i = 0; i < n; i++) st = nextFloat(st)[1];
  return st;
}

/** A run with an open offer of the given ids. */
function offering(ids: RelicId[], o: Parameters<typeof makeTestRun>[0] = {}): RunState {
  const s = makeTestRun(o);
  s.status = 'relic';
  s.relicOffer = [...ids];
  s.relicTitle = CHEST_TITLE;
  return s;
}

describe('FR-REL-1: RELICS', () => {
  it('has the prototype ids, names, and texts in order', () => {
    expect(RELICS).toEqual([
      { id: 'duck', name: 'Rubber Duck', text: 'The first missed timing in each fight counts as Good.' },
      { id: 'hotfix', name: 'Hotfix', text: 'Every perfect dodge heals 6% of max HP.' },
      { id: 'force', name: 'Force Push', text: 'Critical hits deal 25% more damage.' },
      { id: 'linter', name: 'Linter', text: 'The Perfect timing window is 25 ms wider.' },
      { id: 'stack', name: 'Stack Overflow', text: '+3 ATK.' },
      { id: 'coffee', name: 'Cold Brew', text: '+10 max HP, and heal 10 now.' },
      { id: 'blame', name: 'Git Blame', text: 'Counter-attacks deal full ATK instead of half.' },
      { id: 'pair', name: 'Pair Programmer', text: 'Glancing blows deal 60% more damage.' },
      { id: 'review', name: 'Code Review', text: 'See one more week ahead.' },
      { id: 'cache', name: 'CI Cache', text: 'After each won fight, heal 10% of max HP.' },
    ]);
  });

  it('relicById finds each relic', () => {
    for (const r of RELICS) expect(relicById(r.id)).toBe(r);
  });
});

describe('FR-REL-1: offerRelic', () => {
  it('offers three relics, sets the chest title and status, and emits relicOffer', () => {
    const s = makeTestRun();
    offerRelic(s);
    expect(s.status).toBe('relic');
    expect(s.relicTitle).toBe('The chest holds a relic. Choose one.');
    expect(s.relicOffer).toHaveLength(3);
    expect(s.events).toEqual([{ type: 'relicOffer', ids: s.relicOffer, title: CHEST_TITLE }]);
  });

  it('uses the given title', () => {
    const s = makeTestRun();
    offerRelic(s, 'A title.');
    expect(s.relicTitle).toBe('A title.');
  });

  it('shuffles the unowned relics with Fisher-Yates on the run RNG (unowned − 1 draws)', () => {
    const owned: RelicId[] = ['stack', 'duck', 'review'];
    const s = makeTestRun({ relics: owned });
    const rng0 = s.rng;
    offerRelic(s);
    const pool = ALL.filter((id) => !owned.includes(id));
    let st = rng0;
    for (let i = pool.length - 1; i > 0; i--) {
      const [v, next] = nextFloat(st);
      st = next;
      const j = Math.floor(v * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    expect(s.relicOffer).toEqual(pool.slice(0, 3));
    expect(s.rng).toBe(drawn(rng0, 7 - 1));
  });

  it('offers fewer than three when fewer are unowned; one left needs no draw', () => {
    const two = makeTestRun({ relics: ALL.slice(0, 8) });
    const r2 = two.rng;
    offerRelic(two);
    expect([...(two.relicOffer ?? [])].sort()).toEqual(['cache', 'review']);
    expect(two.rng).toBe(drawn(r2, 1));
    const one = makeTestRun({ relics: ALL.slice(0, 9) });
    const r1 = one.rng;
    offerRelic(one);
    expect([one.relicOffer, one.rng]).toEqual([['cache'], r1]);
  });

  it('makes no offer and draws nothing when every relic is owned', () => {
    const s = makeTestRun({ relics: ALL });
    const rng0 = s.rng;
    offerRelic(s);
    expect([s.status, s.relicOffer, s.rng, s.events]).toEqual(['exploring', null, rng0, []]);
  });
});

describe('FR-REL-1: status relic blocks gameplay', () => {
  it('ignores moves, class and race changes, the blessing, and fight actions', () => {
    const s = offering(['duck', 'force', 'stack']);
    const blocked: Action[] = [
      ...legalMoves(s).map((o): Action => ({ type: 'move', to: { col: o.col, row: o.row } })),
      { type: 'chooseClass', cls: 'knight' },
      { type: 'chooseRace', race: 'orc' },
      { type: 'offerBlessing' },
      { type: 'enterMap' },
      { type: 'attack' },
      { type: 'advance' },
    ];
    for (const a of blocked) {
      const n = step(s, a);
      expect({ ...n, events: [] }).toEqual({ ...s, events: [] });
      expect(n.events).toEqual([]);
    }
  });

  it('still accepts the settings toggles', () => {
    const n = step(offering(['duck', 'force', 'stack']), { type: 'setOptions', opts: { calm: true, assist: true } });
    expect([n.status, n.opts]).toEqual(['relic', { calm: true, assist: true }]);
  });
});

describe('FR-REL-1, FR-REL-4: pickRelic', () => {
  it('picks by index 0–2: adds the relic, clears the offer, logs, emits relicPicked', () => {
    for (const i of [0, 1, 2]) {
      const ids: RelicId[] = ['duck', 'force', 'cache'];
      const s = step(offering(ids), { type: 'pickRelic', i });
      const r = relicById(ids[i]!);
      expect([s.hero.relics, s.relicOffer, s.status]).toEqual([[r.id], null, 'exploring']);
      expect(s.log.at(-1)).toBe(`Relic: ${r.name}. ${r.text}`);
      expect(s.events).toEqual([{ type: 'relicPicked', id: r.id }]);
    }
  });

  it('ignores an index outside the offer', () => {
    const s = offering(['duck', 'force']);
    for (const i of [-1, 2, 3, 1.5, Number.NaN]) {
      const n = step(s, { type: 'pickRelic', i });
      expect([n.status, n.relicOffer, n.hero.relics, n.events]).toEqual(['relic', ['duck', 'force'], [], []]);
    }
  });

  it('is ignored without an offer', () => {
    const s = makeTestRun();
    const n = step(s, { type: 'pickRelic', i: 0 });
    expect({ ...n, events: [] }).toEqual(s);
  });

  it('Stack Overflow recomputes ATK', () => {
    const s = offering(['stack']);
    const atk = s.hero.atk;
    pickRelic(s, 0);
    expect(s.hero.atk).toBe(atk + 3);
  });

  it('Cold Brew raises max HP by 10 and heals 10', () => {
    const s = offering(['coffee'], { hero: { hp: 20 } });
    const max = s.hero.maxHp;
    pickRelic(s, 0);
    expect([s.hero.maxHp, s.hero.hp]).toEqual([max + 10, 30]);
  });

  it('Cold Brew heal is clamped to max HP', () => {
    const s = offering(['coffee']);
    pickRelic(s, 0);
    expect(s.hero.hp).toBe(s.hero.maxHp);
    // Rogue max HP is × 0.9, so Cold Brew adds 9 max HP and the 10 HP heal is clamped.
    const k = offering(['coffee'], { cls: 'rogue' });
    const max = k.hero.maxHp;
    pickRelic(k, 0);
    expect([k.hero.maxHp, k.hero.hp]).toEqual([max + 9, max + 9]);
  });

  it('Code Review marks one more column seen at once (v1.6)', () => {
    const s = offering(['review']);
    const next = s.pos.col + 3;
    const col = s.map.tiles.filter((t) => t.col === next);
    expect(col.length).toBeGreaterThan(0);
    expect(col.every((t) => !t.seen)).toBe(true);
    pickRelic(s, 0);
    expect(viewAhead(s.hero.relics)).toBe(3);
    expect(col.every((t) => t.seen)).toBe(true);
    expect(s.map.tiles.filter((t) => t.col > next).every((t) => !t.seen)).toBe(true);
  });
});

describe('FR-REL-1: chest then offer', () => {
  it('a chest ends with an offer, and the pick returns to exploring', () => {
    const s0 = makeTestRun({ level: 1 });
    const reaches = (f: { col: number; row: number }, t: { col: number; row: number }) =>
      legalMoves({ ...s0, pos: { col: f.col, row: f.row } }).some((o) => o.col === t.col && o.row === t.row);
    const chest = s0.map.tiles.find(
      (t) => t.kind === 'chest' && s0.map.tiles.some((f) => f.col === t.col - 1 && reaches(f, t)),
    )!;
    const from = s0.map.tiles.find((f) => f.col === chest.col - 1 && reaches(f, chest))!;
    s0.pos = { col: from.col, row: from.row };
    const s = step(s0, { type: 'move', to: { col: chest.col, row: chest.row } });
    expect(s.status).toBe('relic');
    expect(s.events.map((e) => e.type)).toEqual(['moved', 'chest', 'xp', 'relicOffer']);
    expect(step(s, { type: 'pickRelic', i: 0 }).status).toBe('exploring');
  });
});
