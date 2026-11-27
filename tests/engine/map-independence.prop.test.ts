import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema } from '../../src/data/schema';
import { newRun } from '../../src/engine/run';
import { generateMap } from '../../src/mapgen/generate';
import { contributionSetArb } from '../arbitraries';

describe('map independence', () => {
  it('P18: for any set, hero set, class, race, and options, newRun(...).map deep-equals generateMap(set) (apart from the start tile flags)', () => {
    expect(generateMap.length).toBe(1); // no hero parameter
    fc.assert(
      fc.property(
        contributionSetArb,
        fc.option(contributionSetArb, { nil: null }),
        fc.constantFrom(...ClassIdSchema.options),
        fc.constantFrom(...RaceIdSchema.options),
        fc.boolean(),
        fc.boolean(),
        (set, heroSet, heroClass, heroRace, calm, assist) => {
          const r = newRun(set, heroSet, { heroClass, heroRace, calm, assist });
          const g = generateMap(set);
          if (!r.ok || !g.ok) {
            expect(r.ok).toBe(g.ok);
            return;
          }
          // newRun marks the start visited and reveals the lantern radius; strip those run-time flags.
          const strip = (tiles: typeof g.value.tiles) => tiles.map(({ visited: _v, seen: _s, ...t }) => t);
          expect({ ...r.value.map, tiles: strip(r.value.map.tiles) }).toEqual({ ...g.value, tiles: strip(g.value.tiles) });
          const other = newRun(set, null, { heroClass: 'rogue', heroRace: 'orc', calm: !calm, assist: !assist });
          expect(other.ok && other.value.map).toEqual(r.value.map);
        },
      ),
      { numRuns: 60 },
    );
  });
});
