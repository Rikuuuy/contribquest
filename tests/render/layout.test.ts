import { describe, expect, it } from 'vitest';
import { layout, mapTileSize, tileXY } from '../../src/render/layout';

describe('FR-MAP-2, NFR Responsiveness: map tile size', () => {
  it.each([
    [360, 13, 26],
    [360, 14, 26],
    [680, 13, 44],
    [680, 14, 41],
    [940, 13, 52],
    [940, 14, 52],
    [1400, 13, 52],
    [1400, 14, 52],
  ])('a %i px main with %i columns gives %i px tiles', (width, cols, tile) => {
    expect(mapTileSize(width, cols)).toBe(tile);
  });

  it('never leaves 26–52 px', () => {
    for (let w = 200; w <= 2000; w += 37)
      for (const cols of [13, 14]) {
        const t = mapTileSize(w, cols);
        expect(t).toBeGreaterThanOrEqual(26);
        expect(t).toBeLessThanOrEqual(52);
      }
  });
});

describe('FR-MAP-2: layout', () => {
  it('with labels: 34 px left and 22 px top, plus the boss node column', () => {
    const L = layout({ cols: 14 }, 40, 4, true);
    expect(L).toEqual({ tile: 40, gap: 4, ox: 34, oy: 22, w: 34 + 15 * 44 + 4, h: 22 + 7 * 44 + 4, cols: 14, rows: 7 });
  });

  it('without labels: 4 px offsets (teaser and share card)', () => {
    const L = layout({ cols: 13 }, 22, 3, false);
    expect(L).toEqual({ tile: 22, gap: 3, ox: 4, oy: 4, w: 4 + 14 * 25 + 4, h: 4 + 7 * 25 + 4, cols: 13, rows: 7 });
  });

  it('tileXY gives integer corners one step apart', () => {
    const L = layout({ cols: 14 }, 40, 4, true);
    expect(tileXY(L, 0, 0)).toEqual([34, 22]);
    expect(tileXY(L, 3, 6)).toEqual([34 + 3 * 44, 22 + 6 * 44]);
    for (const v of tileXY(L, 13, 5)) expect(Number.isInteger(v)).toBe(true);
  });
});
