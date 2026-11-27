import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readRun } from '../../src/data/runstore';
import { legalMoves } from '../../src/engine/explore';
import { continueLabel, restore, serialize } from '../../src/engine/save';
import { newRun, type RunSettings } from '../../src/engine/run';
import { step } from '../../src/engine/step';
import type { Action, RunState } from '../../src/engine/state';
import { tileAt } from '../../src/mapgen';
import { demoSet, makeFightRun, makeTestRun } from '../fixtures/run';
import { memoryStorage } from '../fixtures/storage';

const SETTINGS: RunSettings = { heroClass: 'wanderer', heroRace: 'human', calm: false, assist: false };

function demoRun(): RunState {
  const r = newRun(demoSet(), null, SETTINGS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** The first legal move from the hero's position. */
function firstMove(s: RunState): Action {
  const o = legalMoves(s)[0]!;
  return { type: 'move', to: { col: o.col, row: o.row } };
}

/** What `writeRun` stores and `readRun` reads back. */
const throughJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('FR-SAV-1: serialize and restore', () => {
  it('round-trips a new run through JSON', () => {
    const s = demoRun();
    expect(restore(throughJson(serialize(s)))).toEqual(s);
  });

  it('drops the per-step events and restores them as []', () => {
    const d = demoRun();
    const s = step(d, firstMove(d));
    const withEvents: RunState = { ...s, events: [{ type: 'won' }] };
    const saved = serialize(withEvents);
    expect('events' in saved).toBe(false);
    expect(restore(throughJson(saved))?.events).toEqual([]);
  });

  it('writes version 2, both sets, and the tiles with their run-time flags', () => {
    const s = demoRun();
    const saved = throughJson(serialize(s)) as Record<string, unknown>;
    expect(saved['version']).toBe(2);
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

  it('round-trips the boss fight and an ended run on the boss node (v1.6)', () => {
    const fight = makeFightRun(5);
    expect(fight.pos).toEqual(fight.map.bossNode);
    expect(restore(throughJson(serialize(fight)))).toEqual({ ...fight, events: [] });
    for (const status of ['won', 'lost'] as const) {
      const ended: RunState = { ...fight, status, combat: null };
      expect(restore(throughJson(serialize(ended)))).toEqual(ended);
    }
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

/**
 * `localStorage["cq:v1:run"]` written by prototype/index.html after "Play the demo", "Enter the graph",
 * picking the Commit Blessing relic, and four moves. It shares the origin and the key, so it must be ignored.
 */
const prototypeSave = JSON.parse(readFileSync(new URL('../fixtures/prototype-save.json', import.meta.url), 'utf8')) as Record<
  string,
  unknown
>;

/** A save as the v1.5 port wrote it: version 1, a boss tile flag, a Gate tile, `gateIdx`, and `shardsNeeded`. */
function portV1Save(): Record<string, unknown> {
  const saved = throughJson(serialize(demoRun())) as Record<string, unknown>;
  const map = saved['map'] as { tiles: Record<string, unknown>[]; bossIdx: number; bossNode?: unknown };
  const tiles = map.tiles.map((t, i) =>
    i === map.bossIdx ? { ...t, kind: 'boss', tier: 5, boss: true } : i === 90 ? { ...t, kind: 'gate' } : t,
  );
  const { bossNode: _node, ...rest } = map;
  return { ...saved, version: 1, map: { ...rest, tiles, gateIdx: 90, shardsNeeded: 3 } };
}

describe('FR-SAV-1: invalid saves are "no save"', () => {
  it('rejects any version other than 2', () => {
    const saved = throughJson(serialize(demoRun())) as Record<string, unknown>;
    for (const version of [1, 3, '2']) expect(restore({ ...saved, version })).toBeNull();
  });

  it('rejects a v1.5 port save, and each v1.5-only shape on its own (v1.6)', () => {
    expect(restore(portV1Save())).toBeNull();
    const saved = throughJson(serialize(demoRun())) as Record<string, unknown>;
    const map = saved['map'] as { tiles: Record<string, unknown>[] };
    const withTile = (i: number, patch: Record<string, unknown>) => ({
      ...saved,
      map: { ...map, tiles: map.tiles.map((t, j) => (j === i ? { ...t, ...patch } : t)) },
    });
    expect(restore(withTile(90, { kind: 'gate' }))).toBeNull();
    expect(restore(withTile(40, { kind: 'boss' }))).toBeNull();
    expect(restore(withTile(40, { boss: true }))).toBeNull();
    expect(restore({ ...saved, map: { ...map, gateIdx: 90 } })).toBeNull();
    expect(restore({ ...saved, map: { ...map, shardsNeeded: 2 } })).toBeNull();
    expect(restore({ ...saved, shards: 4 })).toBeNull();
  });

  it('rejects a flee test and an escape next step (v1.6)', () => {
    let s = makeFightRun(2);
    s = step(s, { type: 'attack' });
    expect(s.combat?.phase).toBe('test');
    const saved = throughJson(serialize(s)) as Record<string, unknown>;
    const combat = saved['combat'] as Record<string, unknown>;
    expect(restore(saved)).not.toBeNull();
    expect(restore({ ...saved, combat: { ...combat, test: { ...(combat['test'] as object), kind: 'flee' } } })).toBeNull();
    expect(restore({ ...saved, combat: { ...combat, phase: 'wait', test: null, next: { kind: 'escape' } } })).toBeNull();
  });

  it('rejects a pos on a void cell, off the map, or on the boss node while exploring (v1.6)', () => {
    const s = makeTestRun();
    const saved = throughJson(serialize(s)) as Record<string, unknown>;
    let voidCell: { col: number; row: number } | null = null;
    for (let col = 0; col < s.map.cols && !voidCell; col++)
      for (let row = 0; row < 7 && !voidCell; row++) if (!tileAt(s.map, col, row)) voidCell = { col, row };
    expect(voidCell).not.toBeNull();
    expect(restore({ ...saved, pos: voidCell })).toBeNull();
    expect(restore({ ...saved, pos: { col: -1, row: 0 } })).toBeNull();
    expect(restore({ ...saved, pos: { col: s.map.cols + 1, row: 0 } })).toBeNull();
    expect(restore({ ...saved, pos: s.map.bossNode })).toBeNull();
    // The boss node with a non-boss fight is also rejected.
    const fight = throughJson(serialize(makeFightRun(2))) as Record<string, unknown>;
    expect(restore({ ...fight, pos: s.map.bossNode })).toBeNull();
  });

  it('rejects a save with a missing or mistyped field', () => {
    const saved = throughJson(serialize(demoRun())) as Record<string, unknown>;
    for (const key of ['set', 'map', 'hero', 'opts', 'stats', 'newTrophies', 'undying']) {
      const { [key]: _gone, ...rest } = saved;
      expect(restore(rest), key).toBeNull();
    }
    expect(restore({ ...saved, status: 'paused' })).toBeNull();
    expect(restore({ ...saved, hero: { ...(saved['hero'] as object), cls: 'bard' } })).toBeNull();
    const map = saved['map'] as { tiles: unknown[] };
    expect(restore({ ...saved, map: { ...map, tiles: map.tiles.slice(1) } })).toBeNull();
  });

  it('rejects the save captured from the prototype, and never reads it from its own key', () => {
    expect(prototypeSave['version']).toBe(1);
    expect((prototypeSave['map'] as { tiles: unknown[] }).tiles).toHaveLength(91);
    expect(restore(prototypeSave)).toBeNull();
    expect(readRun(memoryStorage({ 'cq:v1:run': JSON.stringify(prototypeSave) }))).toBeNull();
    // Even under the v2 key, the v1 shape is rejected.
    expect(restore(readRun(memoryStorage({ 'cq:v2:run': JSON.stringify(prototypeSave) })))).toBeNull();
  });

  it('rejects non-JSON and non-objects without throwing', () => {
    expect(restore(readRun(memoryStorage({ 'cq:v2:run': '{not json' })))).toBeNull();
    for (const v of [null, undefined, 42, 'save', [], {}, '{"version":2}']) expect(restore(v)).toBeNull();
  });
});
