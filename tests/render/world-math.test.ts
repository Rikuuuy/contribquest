import { describe, expect, it } from 'vitest';
import {
  bossNodeWorld,
  cameraFor,
  easeOutBack,
  followAim,
  inView,
  MAP_OFFSET,
  overviewAim,
  PX,
  riseDelay,
  slabHeight,
  spriteWorldSize,
  tileWorld,
  type SpriteRole,
  type Vec3,
} from '../../src/render/world/math';

const MAPS = [
  { cols: 13, rows: 7, bossNode: { col: 13, row: 4 } },
  { cols: 14, rows: 7, bossNode: { col: 14, row: 0 } },
] as const;
const ASPECTS = [
  ['16:9', 16 / 9],
  ['390/844', 390 / 844],
] as const;

/** The 8 corners of a box centred on (x, z) with half width `h`, from the ground to height `top`. */
function box(x: number, z: number, h: number, top: number): Vec3[] {
  const out: Vec3[] = [];
  for (const dx of [-h, h]) for (const dz of [-h, h]) for (const y of [0, top]) out.push([x + dx, y, z + dz]);
  return out;
}

describe('requirement 19.1: slabs on the grid', () => {
  it('slabHeight is 0.18 + 0.12 × level, 0.18–0.66', () => {
    expect([0, 1, 2, 3, 4].map(slabHeight).map((h) => +h.toFixed(4))).toEqual([0.18, 0.3, 0.42, 0.54, 0.66]);
  });

  it('tileWorld spaces tiles 1 unit apart, column → x, row 0 farthest from the camera', () => {
    expect(tileWorld(0, 0)).toEqual([0, 0]);
    expect(tileWorld(5, 2)[0] - tileWorld(4, 2)[0]).toBe(1);
    expect(tileWorld(4, 3)[1] - tileWorld(4, 2)[1]).toBe(1);
    // The camera sits at +z from its aim, so a smaller z is farther away.
    expect(MAP_OFFSET[2]).toBeGreaterThan(0);
    for (let r = 1; r < 7; r++) expect(tileWorld(0, 0)[1]).toBeLessThan(tileWorld(0, r)[1]);
  });

  it('bossNodeWorld is one unit right of the last column at the boss row', () => {
    for (const m of MAPS) {
      const [x, z] = bossNodeWorld(m);
      expect(x).toBe(tileWorld(m.cols - 1, 0)[0] + 1);
      expect(z).toBe(tileWorld(0, m.bossNode.row)[1]);
    }
  });
});

describe('requirement 20.4: sprite pixel sizes', () => {
  it('every role gives square pixels and a (w + 2) × (h + 2) plane', () => {
    for (const role of Object.keys(PX) as SpriteRole[]) {
      const s = spriteWorldSize(24, 24, role);
      expect(s.w).toBeCloseTo(26 * s.px, 10);
      expect(s.h).toBeCloseTo(26 * s.px, 10);
      const m = spriteWorldSize(16, 24, role);
      expect(m.w / 18).toBeCloseTo(m.h / 26, 10);
    }
  });

  it('uses the art-style scale rules', () => {
    expect(PX.hero).toBe(1 / 17);
    expect([PX.mon1, PX.mon2, PX.mon3, PX.mon4]).toEqual([1 / 18, 1 / 18, 1 / 17, 1 / 17]);
    expect(PX.item).toBe(1 / 20);
    expect(PX.boss).toBe(1 / 15);
    expect(PX.arenaHero).toBe(1 / 16);
    expect([PX.arenaMon1, PX.arenaMon2, PX.arenaMon3, PX.arenaMon4, PX.arenaBoss]).toEqual([3 / 32, 3 / 32, 3.5 / 32, 4 / 32, 4.5 / 32]);
    // The map hero is about 1.5 units tall.
    expect(spriteWorldSize(24, 24, 'hero').h).toBeCloseTo(1.53, 2);
  });
});

describe('requirements 19.3, 19.4: cameras', () => {
  it('follow aim is 1.5 columns right of the hero at the middle row', () => {
    expect(followAim({ col: 4, row: 6 })).toEqual({ x: 5.5, y: 0, z: 3 });
  });

  it('map follow camera at 16:9 matches art-style.md', () => {
    const aim = followAim({ col: 2, row: 1 });
    const c = cameraFor('follow', aim, 16 / 9);
    expect(c.fov).toBe(40);
    expect(c.near).toBe(0.1);
    expect(c.far).toBe(200);
    expect(c.look).toEqual([3.5, 0, 3]);
    expect(c.pos[0]).toBeCloseTo(3.5 - 1.6, 10);
    expect(c.pos[1]).toBeCloseTo(7.2, 10);
    expect(c.pos[2]).toBeCloseTo(3 + 9, 10);
  });

  it('portrait follow camera widens to 55° and pulls back 1.25×', () => {
    const c = cameraFor('follow', followAim({ col: 0, row: 0 }), 390 / 844);
    expect(c.fov).toBe(55);
    expect(c.pos[1]).toBeCloseTo(7.2 * 1.25, 10);
    expect(c.pos[2]).toBeCloseTo(3 + 9 * 1.25, 10);
  });

  it('battle camera at 8:3 matches the sample', () => {
    const c = cameraFor('battle', { x: 0, y: 0, z: 0 }, 8 / 3);
    expect(c).toEqual({ pos: [-0.6, 2.3, 7.4], look: [0.1, 1.45, 0], fov: 40, near: 0.1, far: 200 });
  });

  it.each(ASPECTS)('follow camera at %s keeps columns c … c + 2 and rows 0–6 in view', (_name, aspect) => {
    for (const m of MAPS)
      for (let c = 0; c < m.cols; c++) {
        const cam = cameraFor('follow', followAim({ col: c, row: 3 }), aspect);
        for (let col = c; col <= Math.min(c + 2, m.cols - 1); col++)
          for (let row = 0; row < 7; row++) {
            const [x, z] = tileWorld(col, row);
            for (const p of box(x, z, 0.45, slabHeight(4))) expect(inView(cam, aspect, p), `col ${col} row ${row}`).toBe(true);
          }
      }
  });

  it.each(ASPECTS)('overview camera at %s keeps every slab and the boss node in view', (_name, aspect) => {
    for (const m of MAPS) {
      const aim = overviewAim(m);
      const cam = cameraFor('overview', aim, aspect);
      expect(cam.fov).toBe(aspect < 1 ? 55 : 40);
      for (let col = 0; col < m.cols; col++)
        for (let row = 0; row < 7; row++) {
          const [x, z] = tileWorld(col, row);
          for (const p of box(x, z, 0.45, slabHeight(4))) expect(inView(cam, aspect, p)).toBe(true);
        }
      const [bx, bz] = bossNodeWorld(m);
      for (const p of box(bx, bz, 0.8, 0.9)) expect(inView(cam, aspect, p)).toBe(true);
      // k is at least 1: never closer than the follow framing.
      const k = (cam.pos[1] - aim.y) / MAP_OFFSET[1];
      expect(k).toBeGreaterThanOrEqual(1);
    }
  });

  it('inView rejects points behind the camera and far outside', () => {
    const cam = cameraFor('follow', followAim({ col: 0, row: 3 }), 16 / 9);
    expect(inView(cam, 16 / 9, [cam.look[0], 0, cam.look[2]])).toBe(true);
    expect(inView(cam, 16 / 9, [cam.pos[0], cam.pos[1], cam.pos[2] + 5])).toBe(false);
    expect(inView(cam, 16 / 9, [cam.look[0] + 50, 0, cam.look[2]])).toBe(false);
  });
});

describe('requirement 19.4: rise timing', () => {
  it('riseDelay is col × 70 + row × 12 ms', () => {
    expect(riseDelay(0, 0)).toBe(0);
    expect(riseDelay(3, 5)).toBe(270);
    expect(riseDelay(13, 6)).toBe(982);
  });

  it('easeOutBack runs 0 → 1 and overshoots on the way', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 10);
    expect(easeOutBack(1)).toBe(1);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)))).toBeGreaterThan(1);
  });
});
