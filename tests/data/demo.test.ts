import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDemo } from '../../src/data/demo';
import { demoJson } from '../../scripts/make-demo-data';

const NOW = Date.UTC(2026, 10, 16, 12);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('demo data', () => {
  it('FR-DEM-1: loading the demo never calls fetch', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    loadDemo(() => NOW);
    expect(spy).not.toHaveBeenCalled();
  });

  it('FR-DEM-3: 91 days from 2026-08-18 to 2026-11-16, streak 15, year total 1287', () => {
    const set = loadDemo(() => NOW);
    expect(set.username).toBe('demo-necromancer');
    expect(set.source).toBe('demo');
    expect(set.fetchedAt).toBe(new Date(NOW).toISOString());
    expect(set.days).toHaveLength(91);
    expect(set.days[0]!.date).toBe('2026-08-18');
    expect(set.days[90]!.date).toBe('2026-11-16');
    expect(set.streak).toBe(15);
    expect(set.yearTotal).toBe(1287);
  });

  it('FR-DEM-1: the best day, the graveyard week, and the day before the streak', () => {
    const { days } = loadDemo(() => NOW);
    expect(days[77]).toMatchObject({ count: 31, level: 4 });
    for (let i = 12; i <= 18; i++) expect(days[i]).toMatchObject({ count: 0, level: 0 });
    expect(days[75]).toMatchObject({ count: 0, level: 0 });
    for (let i = 76; i <= 90; i++) expect(days[i]!.count).toBeGreaterThan(0);
  });

  it('FR-DEM-1: the frozen file equals a fresh generator run', () => {
    const file = readFileSync(new URL('../../src/data/demo-data.json', import.meta.url), 'utf8');
    expect(file).toBe(demoJson());
  });
});
