// Releases the GPU resources of a scene graph (v1.6, requirement 25.5): geometries, materials, and their
// textures, except the session-wide sprite cache.
import { Line, Material, Mesh, Points, Sprite, Texture, type Object3D } from 'three';
import { isCachedSprite } from './textures';

/** Number of geometries, materials, and textures released by one `disposeTree` call. */
export type Disposed = { geometries: number; materials: number; textures: number };

/**
 * Disposes every geometry, material, and material texture under `root` once each. Textures for which `keep`
 * returns true (by default the cached sprite textures) stay alive.
 */
export function disposeTree(root: Object3D, keep: (t: Texture) => boolean = isCachedSprite): Disposed {
  const geos = new Set<{ dispose(): void }>();
  const mats = new Set<Material>();
  const texs = new Set<Texture>();
  root.traverse((o) => {
    // Sprites share one module-wide quad in three, so only their materials are released.
    if (o instanceof Mesh || o instanceof Points || o instanceof Line || o instanceof Sprite) {
      if (!(o instanceof Sprite)) geos.add(o.geometry);
      const m = o.material as Material | Material[];
      for (const x of Array.isArray(m) ? m : [m]) mats.add(x);
    }
  });
  for (const m of mats)
    for (const v of Object.values(m)) if (v instanceof Texture && !keep(v)) texs.add(v);
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const t of texs) t.dispose();
  return { geometries: geos.size, materials: mats.size, textures: texs.size };
}
