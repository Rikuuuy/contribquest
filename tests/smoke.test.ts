import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import { MODULE as data } from '../src/data/index';
import { MODULE as mapgen } from '../src/mapgen/index';
import { MODULE as engine } from '../src/engine/index';

describe('scaffold smoke', () => {
  it('imports the placeholder modules', () => {
    expect([data, mapgen, engine]).toEqual(['data', 'mapgen', 'engine']);
  });

  it('runs fast-check and zod', () => {
    const schema = z.number().int();
    fc.assert(fc.property(fc.integer(), (n) => schema.safeParse(n).success));
  });
});
