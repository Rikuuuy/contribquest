import { describe, expect, it } from 'vitest';
import { ClassIdSchema, RaceIdSchema, type ClassId } from '../../src/data/schema';
import { RACE_INFO } from '../../src/engine';
import { BONE } from '../../src/render/palette';
import { mixHex, shadeGrid } from '../../src/render/sprites/build';
import { OUTFITS } from '../../src/render/sprites/grids';
import { HERO_FRAMES, heroFrame, heroPixels } from '../../src/render/sprites/hero';

const CLASSES = ClassIdSchema.options;
const RACES = RaceIdSchema.options;
const UNMASKED = CLASSES.filter((c) => !OUTFITS[c].masked);
const at = (g: (string | null)[][], x: number, y: number) => g[y]?.[x];
/** Every colour auto-shading can give a base colour. */
const shades = (hex: string) => [hex, mixHex(hex, 'b', 0.38), mixHex(hex, 'w', 0.3), mixHex(hex, 'b', 0.18), mixHex(hex, 'b', 0.1)];

describe('FR-FX-1: hero sprite grids', () => {
  it('heroPixels is 24 × 24 for every class, race, and frame', () => {
    for (const cls of CLASSES)
      for (const race of RACES)
        for (const frame of HERO_FRAMES) {
          const g = heroPixels(cls, race, frame);
          expect(g.length, `${cls} ${race} ${frame}`).toBe(24);
          for (const row of g) expect(row.length).toBe(24);
        }
  });

  it('every opaque pixel is a #rrggbb colour', () => {
    for (const row of heroPixels('wanderer', 'orc', 'step')) for (const c of row) if (c !== null) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('FR-RACE-3: race faces', () => {
  it('Elf ears are skin pixels at each outfit’s ear points', () => {
    for (const cls of CLASSES) {
      const g = heroPixels(cls, 'elf');
      for (const [x, y] of OUTFITS[cls].face.ear) expect(shades(RACE_INFO.elf.skin[0]), `${cls} ${x},${y}`).toContain(at(g, x, y));
    }
  });

  it('Orc tusks are bone white beside the mouth', () => {
    for (const cls of UNMASKED) {
      const g = heroPixels(cls, 'orc');
      expect(OUTFITS[cls].face.tusks.length).toBeGreaterThan(0);
      for (const [x, y] of OUTFITS[cls].face.tusks) expect(at(g, x, y), `${cls} ${x},${y}`).toBe(BONE);
    }
  });

  it('Vampire fangs are bone white on the mouth', () => {
    for (const cls of UNMASKED) {
      const g = heroPixels(cls, 'vampire');
      for (const [x, y] of OUTFITS[cls].face.mouth) expect(at(g, x, y), `${cls} ${x},${y}`).toBe(BONE);
    }
  });

  it('Skeleton teeth alternate bone and mouth colour, with a dark nose', () => {
    for (const cls of UNMASKED) {
      const g = heroPixels(cls, 'skeleton');
      OUTFITS[cls].face.mouth.forEach(([x, y], i) => expect(at(g, x, y)).toBe(i % 2 ? RACE_INFO.skeleton.mouth : BONE));
      for (const [x, y] of OUTFITS[cls].face.nose) expect(at(g, x, y)).toBe(OUTFITS[cls].pal['k']);
    }
  });

  it('the masked Rogue gets no mouth features', () => {
    const cls: ClassId = 'rogue';
    expect(OUTFITS[cls].masked).toBe(true);
    const human = heroPixels(cls, 'human');
    for (const race of ['orc', 'skeleton', 'vampire'] as const) {
      const g = heroPixels(cls, race);
      g.forEach((row, y) => row.forEach((c, x) => {
        if (c === BONE) expect(at(human, x, y), `${race} ${x},${y}`).toBe(BONE);
      }));
    }
  });

  it('eyes use the race eye colour, flat', () => {
    for (const race of RACES) {
      const g = heroPixels('knight', race);
      for (const [x, y] of OUTFITS.knight.face.eyes) expect(at(g, x, y)).toBe(RACE_INFO[race].eye);
    }
  });
});

describe('FR-FX-1: frames', () => {
  it('blink closes the eyes and look shifts them one pixel', () => {
    const eyes = OUTFITS.wanderer.face.eyes;
    const eye = RACE_INFO.human.eye;
    const blink = heroPixels('wanderer', 'human', 'blink');
    for (const [x, y] of eyes) expect(at(blink, x, y)).not.toBe(eye);
    const right = heroPixels('wanderer', 'human', 'lookR');
    const left = heroPixels('wanderer', 'human', 'lookL');
    for (const [x, y] of eyes) {
      expect(at(right, x + 1, y)).toBe(eye);
      expect(at(left, x - 1, y)).toBe(eye);
    }
  });

  it('sway grows the cape only on odd rows 13–19; step also moves the feet on rows 22–23', () => {
    const idle = heroPixels('wanderer', 'human', 'idle');
    const sway = heroPixels('wanderer', 'human', 'sway');
    const step = heroPixels('wanderer', 'human', 'step');
    const opaque = (g: (string | null)[][], y: number) => g[y]?.filter((c) => c !== null).length ?? 0;
    for (let y = 0; y < 24; y++) {
      const grown = opaque(sway, y) - opaque(idle, y);
      expect(grown, `row ${y}`).toBe(y >= 13 && y <= 19 && y % 2 ? 1 : 0);
    }
    // Compare shapes, not colours: moving a foot changes the shading of the row above it.
    const mask = (g: (string | null)[][], from: number, to: number) => g.slice(from, to).map((r) => r.map((c) => (c ? 1 : 0)).join('')).join('|');
    expect(mask(step, 22, 24)).not.toBe(mask(sway, 22, 24));
    expect(mask(step, 0, 22)).toBe(mask(sway, 0, 22));
  });

  it('heroFrame: step while moving, blink 130 ms every 3400 ms, look, then sway and idle every 520 ms', () => {
    expect(heroFrame(1000, { moving: true, reduced: false })).toBe('step');
    expect(heroFrame(3400 * 2 + 50, { reduced: false })).toBe('blink');
    expect(heroFrame(3400 * 2 + 50, { moving: true, reduced: false })).toBe('step');
    expect(heroFrame(600, { look: -1, reduced: false })).toBe('lookL');
    expect(heroFrame(600, { look: 1, reduced: false })).toBe('lookR');
    expect(heroFrame(200, { reduced: false })).toBe('idle');
    expect(heroFrame(600, { reduced: false })).toBe('sway');
    expect(heroFrame(1100, { reduced: false })).toBe('idle');
  });

  it('heroFrame is always idle with reduced motion', () => {
    for (const now of [0, 50, 600, 6850]) expect(heroFrame(now, { moving: true, look: 1, reduced: true })).toBe('idle');
  });
});

describe('Visual direction: auto-shade, light from the top left', () => {
  const base = '#808080';
  const g = shadeGrid(['AAA', 'AAA', 'AAA'], { A: base, k: base });

  it('right and bottom edges are 38% darker', () => {
    for (const y of [0, 1, 2]) expect(g[y]?.[2]).toBe(mixHex(base, 'b', 0.38));
    for (const x of [0, 1, 2]) expect(g[2]?.[x]).toBe(mixHex(base, 'b', 0.38));
  });

  it('the top-left rim is 30% lighter', () => {
    expect(g[0]?.[0]).toBe(mixHex(base, 'w', 0.3));
    expect(g[0]?.[1]).toBe(mixHex(base, 'w', 0.3));
    expect(g[1]?.[0]).toBe(mixHex(base, 'w', 0.3));
  });

  it('an inner pixel two from the right edge is 18% darker', () => {
    expect(g[1]?.[1]).toBe(mixHex(base, 'b', 0.18));
  });

  it('flat keys are unchanged', () => {
    const flat = shadeGrid(['kkk', 'kkk', 'kkk'], { k: base });
    for (const row of flat) for (const c of row) expect(c).toBe(base);
  });
});
