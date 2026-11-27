import { FogExp2, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import {
  applySky,
  assignLights,
  countLights,
  driftFireflies,
  driftFog,
  flicker,
  makeFireflies,
  makeFogBank,
  makeLightRig,
  setFogStart,
  type LightItem,
  type LightRig,
} from '../../src/render/world/atmosphere';
import type { Quality } from '../../src/render/world/quality';

const QUALITIES: Quality[] = ['high', 'medium', 'low'];

const item = (kind: LightItem['kind'], x: number, z: number, seen = true, resolved = false): LightItem => ({
  kind,
  top: [x, 0.3, z],
  seen,
  resolved,
});

function rig(q: Quality = 'high'): { scene: Scene; rig: LightRig } {
  const scene = new Scene();
  return { scene, rig: makeLightRig(scene, q) };
}

describe('requirement 21.1: the fixed light rig', () => {
  it.each(QUALITIES)('at %s: 1 hemisphere, 2 directional, 4 point lights', (q) => {
    const { scene } = rig(q);
    expect(countLights(scene)).toEqual({ hemi: 1, directional: 2, point: 4 });
  });

  it('only the moon casts shadows, at high and medium only', () => {
    for (const q of QUALITIES) {
      const { rig: r } = rig(q);
      expect(r.moon.castShadow).toBe(q !== 'low');
      expect(r.fill.castShadow).toBe(false);
      for (const s of r.slots) expect(s.light.castShadow).toBe(false);
    }
    expect(rig('high').rig.moon.shadow.mapSize.x).toBe(2048);
    expect(rig('medium').rig.moon.shadow.mapSize.x).toBe(1024);
  });

  it('uses the sample colours and intensities', () => {
    const { rig: r } = rig();
    expect(r.hemi.color.getHexString()).toBe('6a58b8');
    expect(r.hemi.groundColor.getHexString()).toBe('10081c');
    expect(r.hemi.intensity).toBe(0.9);
    expect(r.moon.color.getHexString()).toBe('b9c4ff');
    expect(r.moon.intensity).toBe(1.6);
    expect(r.moon.shadow.bias).toBe(-0.0008);
    expect(r.fill.intensity).toBe(0.7);
    expect(r.disc.material.fog).toBe(false);
    expect(r.halo.material.opacity).toBe(0.6);
  });

  it('keeps 4 point lights through every assignment', () => {
    const { scene, rig: r } = rig();
    const cases = [
      { hero: [0, 0.18, 3] as const, boss: [14, 0.9, 2] as const, items: [item('chest', 1, 1), item('wisp', 2, 2), item('chest', 3, 3)] },
      { hero: null, boss: null, items: [] },
      { hero: [4, 0.3, 1] as const, boss: [14, 0.9, 2] as const, items: [] },
    ];
    for (const c of cases) {
      assignLights(r, c);
      expect(countLights(scene).point).toBe(4);
    }
  });
});

describe('requirement 21.2: assignLights', () => {
  it('gives the lantern, the boss node, and the two nearest seen unresolved chests or wisps', () => {
    const { rig: r } = rig();
    assignLights(r, {
      hero: [2, 0.3, 3],
      boss: [14, 0.9, 2],
      items: [
        item('chest', 9, 3),
        item('wisp', 3, 3),
        item('chest', 2, 4, false), // unseen
        item('wisp', 2, 2, true, true), // collected
        item('chest', 4, 4),
      ],
    });
    const [lantern, boss, a, b] = r.slots;
    expect(lantern!.role).toBe('lantern');
    expect(lantern!.light.color.getHexString()).toBe('ffb35c');
    expect(lantern!.light.intensity).toBe(2.6);
    expect(lantern!.light.position.toArray()).toEqual([2.35, 0.85, 3.1].map((v) => expect.closeTo(v, 6)));
    expect(boss!.role).toBe('boss');
    expect(boss!.light.color.getHexString()).toBe('a070ff');
    expect(boss!.light.intensity).toBe(3);
    expect(boss!.light.position.toArray()).toEqual([14, 2.1, 2.4].map((v) => expect.closeTo(v, 6)));
    expect(a!.role).toBe('wisp');
    expect(a!.light.color.getHexString()).toBe('8dffb0');
    expect(a!.light.intensity).toBe(1);
    expect(a!.light.position.x).toBe(3);
    expect(a!.light.position.y).toBeCloseTo(0.8, 6);
    expect(b!.role).toBe('chest');
    expect(b!.light.intensity).toBe(1.2);
    expect(b!.light.position.x).toBe(4);
    expect(r.lanternGlow.visible).toBe(true);
  });

  it('leaves unused lights at intensity 0', () => {
    const { rig: r } = rig();
    assignLights(r, { hero: [0, 0.18, 3], boss: [14, 0.9, 2], items: [item('chest', 1, 1)] });
    expect(r.slots[3]!.role).toBe('off');
    expect(r.slots[3]!.light.intensity).toBe(0);
    assignLights(r, { hero: null, boss: null, items: [] });
    for (const s of r.slots) expect(s.light.intensity).toBe(0);
    expect(r.lanternGlow.visible).toBe(false);
  });

  it('flickers only the lantern, and holds it at base with reduced motion', () => {
    const { rig: r } = rig();
    assignLights(r, { hero: [0, 0.18, 3], boss: [14, 0.9, 2], items: [] });
    flicker(r, 0.1);
    const k = 0.85 + 0.1 * Math.sin(1.3) + 0.05 * Math.sin(3.1);
    expect(r.slots[0]!.light.intensity).toBeCloseTo(2.6 * k, 10);
    expect(r.slots[1]!.light.intensity).toBe(3);
    flicker(r, 0.1, false);
    expect(r.slots[0]!.light.intensity).toBe(2.6);
  });
});

describe('requirement 21.3: sky fog and fireflies', () => {
  it('sets FogExp2 in the sky colour at 0.035 on the map and 0.05 in the arena', () => {
    const s = new Scene();
    applySky(s, 'map');
    expect(s.fog).toBeInstanceOf(FogExp2);
    expect((s.fog as FogExp2).density).toBe(0.035);
    expect((s.fog as FogExp2).color.getHexString()).toBe('140d26');
    applySky(s, 'arena');
    expect((s.fog as FogExp2).density).toBe(0.05);
  });

  it('draws 60 fireflies at high and 30 at low', () => {
    expect(makeFireflies(60, 14, 0.5, 'high').points.geometry.drawRange.count).toBe(60);
    expect(makeFireflies(60, 14, 0.5, 'medium').points.geometry.drawRange.count).toBe(60);
    expect(makeFireflies(60, 14, 0.5, 'low').points.geometry.drawRange.count).toBe(30);
    expect(makeFireflies(50, 16, 0.6, 'low').points.geometry.drawRange.count).toBe(25);
  });

  it('places fireflies 0.5–3 units up, additive, size 0.22, and drifts them in place', () => {
    const ff = makeFireflies(60, 14, 0.5);
    const m = ff.points.material;
    expect(m.size).toBe(0.22);
    expect(m.opacity).toBe(0.85);
    expect(m.depthWrite).toBe(false);
    for (let i = 0; i < 60; i++) {
      expect(ff.rest[i * 3 + 1]).toBeGreaterThanOrEqual(0.5);
      expect(ff.rest[i * 3 + 1]).toBeLessThanOrEqual(3);
    }
    const arr = ff.points.geometry.getAttribute('position').array;
    const before = Array.from(arr);
    driftFireflies(ff, 2, false);
    expect(Array.from(arr)).toEqual(before);
    driftFireflies(ff, 2);
    expect(ff.points.geometry.getAttribute('position').array).toBe(arr);
    expect(Array.from(arr)).not.toEqual(before);
  });
});

describe('requirement 21.4: the fog bank', () => {
  const map = { cols: 14, rows: 7, seed: 1234 };

  it('has three layers at 0.25, 0.4, 0.6 above the level-4 top with opacity 0.18, 0.14, 0.10', () => {
    const bank = makeFogBank(map);
    expect(bank.layers.map((l) => +(l.position.y - 0.66).toFixed(4))).toEqual([0.25, 0.4, 0.6]);
    expect(bank.layers.map((l) => l.material.opacity)).toEqual([0.18, 0.14, 0.1]);
  });

  it('setFogStart puts the near edge at col − 0.5 and covers up to the last column only', () => {
    const bank = makeFogBank(map);
    setFogStart(bank, 3);
    expect(bank.edge).toBe(2.5);
    expect(bank.root.position.x).toBe(2.5);
    expect(bank.root.visible).toBe(true);
    for (const l of bank.layers) {
      l.geometry.computeBoundingBox();
      const b = l.geometry.boundingBox!;
      expect(bank.root.position.x + b.min.x * l.scale.x).toBeCloseTo(2.5, 6);
      expect(bank.root.position.x + b.max.x * l.scale.x).toBeCloseTo(13.5, 6);
    }
    setFogStart(bank, 4);
    expect(bank.edge).toBe(3.5);
    setFogStart(bank, 14);
    expect(bank.root.visible).toBe(false);
  });

  it('drifts the texture only when motion is on', () => {
    const bank = makeFogBank(map);
    driftFog(bank, 1, false);
    expect(bank.noise.offset.x).toBe(0);
    driftFog(bank, 1);
    expect(bank.noise.offset.x).not.toBe(0);
  });
});
