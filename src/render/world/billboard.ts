// Billboard sprites (v1.6, requirement 20; art-style.md "Billboards"): a Group holding one plane anchored at its
// bottom centre, textured with the cached sprite canvas. Facing mirrors the plane; it never rotates it.
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type Camera } from 'three';
import { spriteWorldSize, type SpriteRole } from './math';
import { cachedTexture } from './textures';

export type Facing = 1 | -1;

export type Billboard = {
  /** Position this at the anchor (slab top + 0.01, or the arena floor); its orientation copies the camera. */
  root: Group;
  /** The textured plane; `scale.x` carries the facing (and the landing squash), `scale.y` the squash. */
  mesh: Mesh<PlaneGeometry, MeshStandardMaterial>;
  role: SpriteRole;
  key: string;
};

function textureOf(key: string) {
  const t = cachedTexture(key);
  if (!t) throw new Error(`No sprite texture for "${key}"`);
  return t;
}

/** A plane of the sprite's size (outline included) with its bottom edge at y = 0. */
function planeFor(width: number, height: number, role: SpriteRole): PlaneGeometry {
  const s = spriteWorldSize(width - 2, height - 2, role);
  const g = new PlaneGeometry(s.w, s.h);
  g.translate(0, s.h / 2, 0);
  return g;
}

/**
 * A billboard for a registered sprite texture (`spriteTexture(key, canvas)` first). Material: standard,
 * roughness 1, metalness 0, alpha test 0.5, opaque cut-out, double-sided; casts the moon's shadow.
 */
export function makeBillboard(texKey: string, role: SpriteRole): Billboard {
  const map = textureOf(texKey);
  const img = map.image as { width: number; height: number };
  const mat = new MeshStandardMaterial({
    map,
    roughness: 1,
    metalness: 0,
    alphaTest: 0.5,
    transparent: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(planeFor(img.width, img.height, role), mat);
  mesh.castShadow = true;
  const root = new Group();
  root.add(mesh);
  return { root, mesh, role, key: texKey };
}

/** Faces right (1) or left (−1) by mirroring the plane: only the sign of `scale.x` changes. */
export function setFacing(b: Billboard, dir: Facing): void {
  b.mesh.scale.x = Math.abs(b.mesh.scale.x) * dir;
}

/** Swaps to the cached texture for `texKey` (frame, rig offset, or flash version); never redraws a canvas. */
export function setFrame(b: Billboard, texKey: string): void {
  if (b.key === texKey) return;
  const map = textureOf(texKey);
  const img = map.image as { width: number; height: number };
  const old = b.mesh.material.map?.image as { width: number; height: number } | undefined;
  if (!old || old.width !== img.width || old.height !== img.height) {
    b.mesh.geometry.dispose();
    b.mesh.geometry = planeFor(img.width, img.height, b.role);
  }
  b.mesh.material.map = map;
  b.key = texKey;
}

/** Turns every billboard to the camera's orientation (call once per frame; allocates nothing). */
export function faceCamera(list: readonly Billboard[], camera: Camera): void {
  for (let i = 0; i < list.length; i++) list[i]!.root.quaternion.copy(camera.quaternion);
}
