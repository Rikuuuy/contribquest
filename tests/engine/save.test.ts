import { describe, expect, it } from 'vitest';
import { continueLabel, restore, serialize } from '../../src/engine/save';
import { newRun, type RunSettings } from '../../src/engine/run';
import { step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { demoSet, makeFightRun } from '../fixtures/run';

const SETTINGS: RunSettings = { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false };

function demoRun(): RunState {
  const r = newRun(demoSet(), null, SETTINGS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** What `writeRun` stores and `readRun` reads back. */
const throughJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('FR-SAV-1: serialize and restore', () => {
  it('round-trips a new run through JSON', () => {
    const s = demoRun();
    expect(restore(throughJson(serialize(s)))).toEqual(s);
  });

  it('drops the per-step events and restores them as []', () => {
    const s = step(demoRun(), { type: 'move', dir: 'right' });
    const withEvents: RunState = { ...s, events: [{ type: 'won' }] };
    const saved = serialize(withEvents);
    expect('events' in saved).toBe(false);
    expect(restore(throughJson(saved))?.events).toEqual([]);
  });

  it('writes version 1, both sets, and the tiles with their run-time flags', () => {
    const s = demoRun();
    const saved = throughJson(serialize(s)) as Record<string, unknown>;
    expect(saved['version']).toBe(1);
    expect(saved['set']).toEqual(s.set);
    expect(saved['heroSet']).toBeNull();
    expect(saved['map']).toEqual(s.map);
    expect(Object.keys(saved['map'] as object)).not.toContain('grid');
  });

  it('serialize does not share objects with the live state', () => {
    const s = demoRun();
    const saved = serialize(s);
    saved.hero.hp = 1;
    (saved.map.tiles[5] as { resolved: boolean }).resolved = true;
    expect(s.hero.hp).not.toBe(1);
    expect(s.map.tiles[5]?.resolved).toBe(false);
  });
});

describe('FR-COM-7: restoring a fight', () => {
  it('a fight in a timing test resumes at choose with no test and no input events', () => {
    let s = makeFightRun(2);
    s = step(s, { type: 'attack' });
    s = step(s, { type: 'press', t: 10, key: 'k' } as Action);
    expect(s.combat?.phase).toBe('test');
    const r = restore(throughJson(serialize(s)));
    expect(r?.combat?.phase).toBe('choose');
    expect(r?.combat?.test).toBeNull();
    expect(r?.combat?.events).toEqual([]);
    expect(r?.status).toBe('combat');
  });

  it('a fight in wait is kept as it was', () => {
    let s = makeFightRun(2);
    s = step(s, { type: 'attack' });
    s = step(s, { type: 'forceGrade', grade: 'good' });
    expect(s.combat?.phase).toBe('wait');
    expect(restore(throughJson(serialize(s)))).toEqual({ ...s, events: [] });
  });
});

describe('FR-SAV-1: continue label', () => {
  it("names the map set's username", () => {
    expect(continueLabel(serialize(demoRun()))).toBe("Continue demo-necromancer's run");
  });
});
