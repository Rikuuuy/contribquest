import { describe, expect, it } from 'vitest';
import type { DayTile } from '../../src/mapgen';
import { BEST_DAY_LINE, bossInfo, tileInfo } from '../../src/render/map/tooltip';
import { demoSet, mapOf } from '../fixtures/run';
import { makeSet, windowDays } from '../fixtures/sets';

/** A seen, unresolved tile on Tue 3 Nov 2026 with 4 contributions. */
function tile(o: Partial<DayTile> = {}): DayTile {
  return {
    col: 5,
    row: 2,
    idx: 37,
    day: { date: '2026-11-03', count: 4, level: 2 },
    kind: 'fog',
    tier: 0,
    resolved: false,
    visited: false,
    seen: true,
    ...o,
  };
}

describe('requirement 8.2: tileInfo', () => {
  it('heads every tooltip with the date and a pluralised count', () => {
    expect(tileInfo(tile()).when).toBe('Tue 3 Nov 2026 · 4 contributions');
    expect(tileInfo(tile({ day: { date: '2026-11-03', count: 1, level: 1 } })).when).toBe('Tue 3 Nov 2026 · 1 contribution');
    expect(tileInfo(tile({ day: { date: '2026-11-03', count: 0, level: 0 } })).when).toBe('Tue 3 Nov 2026 · 0 contributions');
  });

  it('hides an unseen tile in the fog', () => {
    expect(tileInfo(tile({ seen: false, kind: 'monster', tier: 3 })).what).toBe('Hidden in the fog');
    expect(tileInfo(tile({ seen: false, kind: 'chest' })).what).toBe('Hidden in the fog');
  });

  it('names monsters, with ", banished" once resolved', () => {
    expect(tileInfo(tile({ kind: 'monster', tier: 1 })).what).toBe('Lost Ghost');
    expect(tileInfo(tile({ kind: 'monster', tier: 2 })).what).toBe('Bug Imp');
    expect(tileInfo(tile({ kind: 'monster', tier: 3 })).what).toBe('Flaky Test Ghoul');
    expect(tileInfo(tile({ kind: 'monster', tier: 4, resolved: true })).what).toBe('Merge Conflict Lich, banished');
  });

  it('labels quiet days, wisps, chests, and the start', () => {
    expect(tileInfo(tile({ kind: 'fog' })).what).toBe('A quiet day');
    expect(tileInfo(tile({ kind: 'fog', deco: true })).what).toBe('A quiet day');
    expect(tileInfo(tile({ kind: 'fog', resolved: true })).what).toBe('A quiet day, rested');
    expect(tileInfo(tile({ kind: 'wisp' })).what).toBe('A soul wisp');
    expect(tileInfo(tile({ kind: 'wisp', resolved: true })).what).toBe('A soul wisp, taken');
    expect(tileInfo(tile({ kind: 'chest', size: 2 })).what).toBe('A chest');
    expect(tileInfo(tile({ kind: 'chest', resolved: true })).what).toBe('A chest, taken');
    expect(tileInfo(tile({ kind: 'start', resolved: true })).what).toBe('The crypt where you woke');
  });

  it('adds the best-day line, also in the fog', () => {
    expect(tileInfo(tile({ kind: 'monster', tier: 4, bestDay: true })).best).toBe(BEST_DAY_LINE);
    expect(tileInfo(tile({ kind: 'monster', tier: 4, bestDay: true, seen: false }))).toEqual({
      when: 'Tue 3 Nov 2026 · 4 contributions',
      what: 'Hidden in the fog',
      best: 'The Phantom rose from this day.',
    });
    expect(tileInfo(tile()).best).toBeNull();
  });

  it('never mentions the Gate', () => {
    const kinds: DayTile['kind'][] = ['fog', 'wisp', 'chest', 'monster', 'start'];
    for (const kind of kinds)
      for (const resolved of [false, true])
        for (const seen of [false, true]) {
          const i = tileInfo(tile({ kind, resolved, seen, tier: kind === 'monster' ? 2 : 0 }));
          expect(`${i.when} ${i.what} ${i.best ?? ''}`).not.toMatch(/gate/i);
        }
  });
});

describe('requirement 8.2: the boss node', () => {
  it('names the Phantom after the best day and says whether it waits or is banished', () => {
    const map = mapOf(demoSet());
    const best = map.tiles[map.bossIdx]!;
    expect(best.day.date).toBe('2026-11-03');
    expect(bossInfo(map, false)).toEqual({ when: 'The Phantom of Tue 3 Nov 2026', what: 'Waits after the last week', best: null });
    expect(bossInfo(map, true).what).toBe('Banished');
  });

  it('uses the empty-quarter name when there is no best day', () => {
    const map = mapOf(makeSet(windowDays(() => ({ count: 0 }))));
    expect(map.emptyQuarter).toBe(true);
    expect(bossInfo(map, false).when).toBe('The Phantom of the Empty Quarter');
  });
});
