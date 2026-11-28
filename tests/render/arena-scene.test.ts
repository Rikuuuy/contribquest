import { BufferGeometry, Color, Material, Matrix4, Mesh, Points, Sprite, type InstancedMesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import {
  arenaHit,
  arenaPhase2,
  arenaSpecFor,
  arenaStrike,
  buildArena,
  disposeArena,
  FOE_AT,
  HERO_AT,
  LUNGE,
  tickArena,
  type ArenaScene,
  type ArenaSpec,
} from '../../src/render/world/arena-scene';
import { countLights } from '../../src/render/world/atmosphere';
import { buildMapScene, type WorldDeps } from '../../src/render/world/map-scene';
import { motionFlags } from '../../src/render/world/motion-flags';
import type { CanvasSource } from '../../src/render/world/textures';
import { makeTestRun } from '../fixtures/run';

const stub = (width: number, height: number) => ({ width, height }) as unknown as CanvasSource;
const deps: WorldDeps = {
  spriteCanvas: (key) => (key.startsWith('hero:') ? stub(26, 26) : key.startsWith('mon:phantom') ? stub(18, 26) : stub(18, 18)),
  textCanvas: (text) => stub(8 * text.length, 8),
};
const FULL = motionFlags(false);
const STILL = motionFlags(true);

const spec = (over: Partial<ArenaSpec> = {}): ArenaSpec => ({ date: '2026-03-14', level: 3, boss: false, cls: 'mage', race: 'human', tier: 2, ...over });

function matrices(m: InstancedMesh): number[][] {
  const out: number[][] = [];
  const x = new Matrix4();
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, x);
    out.push([...x.elements]);
  }
  return out;
}

const seeded = (a: ArenaScene) => [a.props.graves, a.props.pillars, a.props.trunks, a.props.blossoms].map(matrices);

describe('requirement 22.1: the seeded graveyard arena', () => {
  it('builds the same props for the same source date', () => {
    expect(seeded(buildArena(spec(), deps, 'high'))).toEqual(seeded(buildArena(spec(), deps, 'high')));
  });

  it('builds different props for a different date', () => {
    expect(seeded(buildArena(spec({ date: '2026-03-15' }), deps, 'high'))).not.toEqual(seeded(buildArena(spec(), deps, 'high')));
  });

  it('has the sample props: five tombstones, two pillars, two trees with nine blossoms each, a fence and a rail', () => {
    const a = buildArena(spec(), deps, 'high');
    expect(a.props.graves.count).toBe(5);
    expect(a.props.pillars.count).toBe(2);
    expect(a.props.trunks.count).toBe(2);
    expect(a.props.blossoms.count).toBe(18);
    expect(a.props.bars.count).toBeGreaterThan(50);
    expect(a.props.cobbles.count).toBeGreaterThan(80);
  });

  it('colours the grass with the source day lit level colour', () => {
    const a = buildArena(spec({ level: 4 }), deps, 'high');
    expect(a.props.grass.material.color.getHexString()).toBe(new Color('#3fd35f').getHexString());
  });
});

describe('requirement 22.2: fighters, lights, and the boss variant', () => {
  it('puts the hero on the left facing right and the foe on the right facing left', () => {
    const a = buildArena(spec(), deps, 'high');
    expect(a.hero.bb.root.position.x).toBeCloseTo(HERO_AT[0]);
    expect(a.foe.bb.root.position.x).toBeCloseTo(FOE_AT[0]);
    expect(a.hero.bb.mesh.scale.x).toBeGreaterThan(0);
    expect(a.foe.bb.mesh.scale.x).toBeLessThan(0);
    expect(a.hero.bb.role).toBe('arenaHero');
    expect(a.foe.bb.role).toBe('arenaMon2');
  });

  it('hovers the boss 0.12 above the floor, doubles the purple light, and darkens the sky', () => {
    const plain = buildArena(spec(), deps, 'high');
    const boss = buildArena(spec({ boss: true, tier: 5 }), deps, 'high');
    expect(boss.foe.home.y).toBeCloseTo(FOE_AT[1] + 0.12);
    expect(boss.foe.bb.role).toBe('arenaBoss');
    expect(boss.foeLight.light.intensity).toBe(plain.foeLight.light.intensity * 2);
    expect(plain.foeLight.light.color.getHexString()).toBe(new Color('#b060ff').getHexString());
    expect((boss.scene.background as Color).getHexString()).toBe(new Color('#0d0718').getHexString());
    expect(boss.rig.halo.material.opacity).toBeCloseTo(0.8);
  });

  it('uses the same number of lights as the map scene (fixed pool)', () => {
    const run = makeTestRun();
    const map = buildMapScene(run.map, deps, 'high');
    expect(countLights(buildArena(spec(), deps, 'high').scene)).toEqual(countLights(map.scene));
    expect(countLights(buildArena(spec(), deps, 'high').scene).point).toBe(4);
  });

  it('is lit: every pooled point light has a positive intensity', () => {
    const a = buildArena(spec(), deps, 'high');
    for (const s of a.rig.slots) expect(s.light.intensity).toBeGreaterThan(0);
  });

  it('reads the spec from a fight', () => {
    const run = makeTestRun();
    expect(arenaSpecFor(run)).toBeNull();
  });
});

describe('requirements 22.3, 22.4: strikes and phase 2', () => {
  it('lunges the attacker 0.6 toward the target and back', () => {
    const a = buildArena(spec(), deps, 'high');
    arenaStrike(a, 'hero', 1000);
    tickArena(a, 1100, 0.016, FULL);
    expect(a.hero.bb.root.position.x).toBeCloseTo(HERO_AT[0] + LUNGE);
    tickArena(a, 1400, 0.016, FULL);
    expect(a.hero.bb.root.position.x).toBeCloseTo(HERO_AT[0]);
    arenaStrike(a, 'foe', 2000);
    tickArena(a, 2100, 0.016, FULL);
    expect(a.foe.bb.root.position.x).toBeCloseTo(FOE_AT[0] - LUNGE);
  });

  it('swaps textures for rig poses and flashes, never redrawing', () => {
    const a = buildArena(spec(), deps, 'high');
    arenaStrike(a, 'hero', 1000);
    tickArena(a, 1060, 0.016, FULL);
    expect(a.hero.bb.key).toBe(`${a.hero.base}:rig:lunge`);
    arenaHit(a, 'foe', 1000, 'gold', FULL);
    tickArena(a, 1050, 0.016, FULL);
    expect(a.foe.bb.key).toBe(`${a.foe.base}:gold`);
    arenaHit(a, 'hero', 3000, 'red', STILL);
    tickArena(a, 3050, 0.016, STILL);
    expect(a.hero.bb.key).toBe(a.hero.base);
  });

  it('eases the foe light and the sky toward red after 250 ms, or at once with reduced motion', () => {
    const a = buildArena(spec({ boss: true, tier: 5 }), deps, 'high');
    arenaPhase2(a, 0, FULL);
    tickArena(a, 200, 0.016, FULL);
    expect(a.foeLight.light.color.getHexString()).toBe(new Color('#b060ff').getHexString());
    tickArena(a, 700, 0.016, FULL);
    expect(a.foeLight.light.color.getHexString()).toBe(new Color('#ff3a3a').getHexString());
    expect((a.scene.background as Color).getHexString()).toBe(new Color('#2a0d1a').getHexString());
    const b = buildArena(spec({ boss: true, tier: 5 }), deps, 'high');
    arenaPhase2(b, 0, STILL);
    expect(b.foeLight.light.color.getHexString()).toBe(new Color('#ff3a3a').getHexString());
  });

  it('hides petals with reduced motion', () => {
    const a = buildArena(spec(), deps, 'high');
    tickArena(a, 0, 0.016, STILL);
    expect(a.petals.visible).toBe(false);
    tickArena(a, 16, 0.016, FULL);
    expect(a.petals.visible).toBe(true);
  });
});

describe('requirement 25.5: disposal', () => {
  it('disposeArena releases every geometry and material it created', () => {
    const a = buildArena(spec(), deps, 'high');
    const geos = new Set<BufferGeometry>();
    const mats = new Set<Material>();
    a.scene.traverse((o: Object3D) => {
      if (o instanceof Mesh || o instanceof Points || o instanceof Sprite) {
        if (!(o instanceof Sprite)) geos.add(o.geometry as BufferGeometry);
        mats.add(o.material as Material);
      }
    });
    let disposed = 0;
    for (const g of geos) g.addEventListener('dispose', () => disposed++);
    const r = disposeArena(a);
    expect(r.geometries).toBe(geos.size);
    expect(r.materials).toBe(mats.size);
    expect(disposed).toBe(geos.size);
    expect(a.billboards).toHaveLength(0);
  });
});
