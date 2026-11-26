import { describe, expect, it } from 'vitest';
import { buildSet, parseApiResponse } from '../../src/data/normalize';
import { generateMap } from '../../src/mapgen/generate';
import { FIXTURES } from '../fixtures/profiles';

describe('PRD fixture profiles', () => {
  it.each(Object.keys(FIXTURES))('%s generates a valid map', (name) => {
    const parsed = parseApiResponse(FIXTURES[name]!());
    if (!parsed.ok) throw new Error(parsed.error.message);
    const set = buildSet(name, 'live', parsed.value.days, parsed.value.total, '2026-11-16T12:00:00.000Z');
    const r = generateMap(set);
    expect(r.ok).toBe(true);
  });
});
