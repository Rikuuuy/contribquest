// End of a run (requirement 8.1). The trophy tests (requirements 9.1–9.6) join this file with task 8.3.
import { describe, expect, it } from 'vitest';
import { endRun } from '../../src/engine/run';
import { step } from '../../src/engine/step';
import type { RunState } from '../../src/engine/state';
import { tileAt } from '../../src/mapgen/layout';
import { makeFightRun, makeTestRun } from '../fixtures/run';

/** A fight whose next `advance` ends it with `kind`. */
function ending(s: RunState, kind: 'win' | 'lose'): RunState {
  s.combat!.phase = 'wait';
  s.combat!.next = { kind };
  if (kind === 'win') s.combat!.m.hp = 0;
  else s.hero.hp = 0;
  return s;
}

describe('FR-PRO-3: endRun', () => {
  it('a win sets the status and emits won, then runEnded', () => {
    const s = makeTestRun();
    endRun(s, 'won');
    expect([s.status, s.killer]).toEqual(['won', null]);
    expect(s.events).toEqual([{ type: 'won' }, { type: 'runEnded', won: true }]);
  });

  it('a loss keeps the killer and emits lost, then runEnded', () => {
    const s = makeTestRun();
    endRun(s, 'lost', 'Merge Conflict Lich');
    expect([s.status, s.killer]).toEqual(['lost', 'Merge Conflict Lich']);
    expect(s.events).toEqual([{ type: 'lost' }, { type: 'runEnded', won: false }]);
  });

  it('a win never records a killer', () => {
    const s = makeTestRun();
    endRun(s, 'won', 'Nobody');
    expect(s.killer).toBeNull();
  });
});

describe('FR-COM-4: combat-timing ends the run through endRun', () => {
  it('loseFight: the monster that dealt the last hit is the killer', () => {
    const s = step(ending(makeFightRun(4), 'lose'), { type: 'advance' });
    expect([s.status, s.killer]).toEqual(['lost', 'Merge Conflict Lich']);
    expect(s.events.at(-1)).toEqual({ type: 'runEnded', won: false });
  });

  it('winFight on a boss standing on the Gate wins the run', () => {
    const base = ending(makeFightRun(5), 'win');
    tileAt(base.map, base.combat!.col, base.combat!.row)!.kind = 'gate';
    const s = step(base, { type: 'advance' });
    expect([s.status, s.bossDown]).toEqual(['won', true]);
    expect(s.events.slice(-2)).toEqual([{ type: 'won' }, { type: 'runEnded', won: true }]);
  });

  it('winFight on a boss away from the Gate does not end the run', () => {
    const s = step(ending(makeFightRun(5), 'win'), { type: 'advance' });
    expect(s.status).toBe('exploring');
    expect(s.events.some((e) => e.type === 'runEnded')).toBe(false);
  });

  it('entering the open Gate wins the run', () => {
    const s = makeTestRun();
    const g = s.map.tiles[90]!;
    s.bossDown = true;
    s.pos = { col: g.col, row: g.row - 1 };
    const w = step(s, { type: 'move', dir: 'down' });
    expect(w.status).toBe('won');
    expect(w.events).toEqual([{ type: 'won' }, { type: 'runEnded', won: true }]);
  });

  it('a finished run ignores further moves and fight actions', () => {
    const s = makeTestRun();
    endRun(s, 'won');
    for (const a of [{ type: 'move', dir: 'right' }, { type: 'attack' }, { type: 'advance' }] as const) {
      const r = step(s, a);
      expect(r.status).toBe('won');
      expect(r.events).toEqual([]);
    }
  });
});
