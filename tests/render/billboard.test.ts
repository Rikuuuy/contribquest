import { NearestFilter, PerspectiveCamera, SRGBColorSpace } from 'three';
import { describe, expect, it } from 'vitest';
import { faceCamera, makeBillboard, setFacing, setFrame } from '../../src/render/world/billboard';
import { PX } from '../../src/render/world/math';
import { cachedTexture, glowTexture, spriteTexture, textTexture, type CanvasSource } from '../../src/render/world/textures';

/** A canvas stand-in: three only reads its size until it uploads. */
const stub = (width: number, height: number) => ({ width, height }) as unknown as CanvasSource;

describe('requirement 20.1: sprite textures', () => {
  it('use nearest filtering both ways, no mipmaps, sRGB', () => {
    const t = spriteTexture('t:hero', stub(26, 26));
    expect(t.magFilter).toBe(NearestFilter);
    expect(t.minFilter).toBe(NearestFilter);
    expect(t.generateMipmaps).toBe(false);
    expect(t.colorSpace).toBe(SRGBColorSpace);
  });

  it('return the same texture for the same key (requirement 20.3)', () => {
    const a = spriteTexture('t:same', stub(18, 18));
    const b = spriteTexture('t:same', stub(99, 99));
    expect(b).toBe(a);
    expect(cachedTexture('t:same')).toBe(a);
    expect(spriteTexture('t:other', stub(18, 18))).not.toBe(a);
  });

  it('glow and label textures are fresh per call', () => {
    const g = glowTexture('#8dffb0');
    expect(g.image.width).toBe(64);
    const d = g.image.data as Uint8Array;
    const centre = (32 * 64 + 32) * 4;
    expect(d[centre + 3]).toBeGreaterThan(200);
    expect(d[3]).toBe(0);
    expect(glowTexture('#8dffb0')).not.toBe(g);
    const l = textTexture('Mon', () => stub(30, 8));
    expect(l.magFilter).toBe(NearestFilter);
    expect(textTexture('Mon', () => stub(30, 8))).not.toBe(l);
  });
});

describe('requirements 20.2, 20.4: billboards', () => {
  it('plane is (w + 2) × px by (h + 2) × px with its bottom at y = 0', () => {
    spriteTexture('b:hero', stub(26, 26));
    const b = makeBillboard('b:hero', 'hero');
    const box = b.mesh.geometry.boundingBox ?? (b.mesh.geometry.computeBoundingBox(), b.mesh.geometry.boundingBox!);
    expect(box.max.x - box.min.x).toBeCloseTo(26 * PX.hero, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(26 * PX.hero, 6);
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.min.x).toBeCloseTo(-box.max.x, 6);
    expect(b.root.children).toEqual([b.mesh]);
  });

  it('uses an opaque cut-out, double-sided standard material that casts shadows', () => {
    spriteTexture('b:chest', stub(14, 14));
    const b = makeBillboard('b:chest', 'item');
    const m = b.mesh.material;
    expect(m.type).toBe('MeshStandardMaterial');
    expect(m.map).toBe(cachedTexture('b:chest'));
    expect(m.alphaTest).toBe(0.5);
    expect(m.transparent).toBe(false);
    expect(m.roughness).toBe(1);
    expect(m.metalness).toBe(0);
    expect(m.side).toBe(2);
    expect(b.mesh.castShadow).toBe(true);
  });

  it('refuses an unregistered key', () => {
    expect(() => makeBillboard('b:missing', 'hero')).toThrow();
  });

  it('setFacing flips scale.x only', () => {
    spriteTexture('b:mon', stub(18, 18));
    const b = makeBillboard('b:mon', 'mon1');
    setFacing(b, -1);
    expect(b.mesh.scale.toArray()).toEqual([-1, 1, 1]);
    expect(b.mesh.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(b.root.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    setFacing(b, -1);
    expect(b.mesh.scale.x).toBe(-1);
    setFacing(b, 1);
    expect(b.mesh.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('setFrame swaps to the cached texture and keeps the facing', () => {
    const idle = spriteTexture('b:f:idle', stub(26, 26));
    const white = spriteTexture('b:f:idle:white', stub(26, 26));
    const b = makeBillboard('b:f:idle', 'hero');
    setFacing(b, -1);
    const geo = b.mesh.geometry;
    setFrame(b, 'b:f:idle:white');
    expect(b.mesh.material.map).toBe(white);
    expect(b.mesh.geometry).toBe(geo);
    expect(b.key).toBe('b:f:idle:white');
    setFrame(b, 'b:f:idle');
    expect(b.mesh.material.map).toBe(idle);
    expect(b.mesh.scale.x).toBe(-1);
    expect(spriteTexture('b:f:idle', stub(1, 1))).toBe(idle);
  });

  it('faceCamera copies the camera orientation to every billboard', () => {
    spriteTexture('b:face', stub(26, 26));
    const list = [makeBillboard('b:face', 'hero'), makeBillboard('b:face', 'hero')];
    const cam = new PerspectiveCamera(40, 16 / 9, 0.1, 200);
    cam.position.set(-1.6, 7.2, 12);
    cam.lookAt(0, 0, 3);
    faceCamera(list, cam);
    for (const b of list) expect(b.root.quaternion.equals(cam.quaternion)).toBe(true);
  });
});
