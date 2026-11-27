// Textures for the world renderer (v1.6). Sprite textures wrap the canvases `buildSprite` already makes (outline
// included) and are cached by sprite key for the page session; glow and label textures belong to their scene and
// are disposed with it (design "Textures").
import { CanvasTexture, DataTexture, LinearFilter, NearestFilter, SRGBColorSpace, type Texture } from 'three';

/** Anything three can upload as a canvas texture; Node tests pass `{ width, height }` stubs. */
export type CanvasSource = HTMLCanvasElement | OffscreenCanvas;

const sprites = new Map<string, CanvasTexture<CanvasSource>>();

/** Pixel-art settings: nearest-neighbour both ways, no mipmaps, sRGB (requirement 20.1). */
function pixelArt<T extends Texture>(t: T): T {
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * The cached texture for a sprite key (`hero:{cls}:{race}:{frame}`, `mon:{kind}`, plus `:white|red|gold` and rig
 * offsets). The first call wraps `canvas`; later calls return the same texture and never re-upload it.
 */
export function spriteTexture(key: string, canvas: CanvasSource): CanvasTexture<CanvasSource> {
  let t = sprites.get(key);
  if (!t) {
    t = pixelArt(new CanvasTexture(canvas));
    sprites.set(key, t);
  }
  return t;
}

/** The cached sprite texture for `key`, or undefined before `spriteTexture` registered it. */
export function cachedTexture(key: string): CanvasTexture<CanvasSource> | undefined {
  return sprites.get(key);
}

/** Glow texture side in pixels. */
const GLOW = 64;

/**
 * A soft radial glow in `hex` (`#rrggbb`) for additive sprites and points: alpha 1 at the centre, 0.35 at 35%
 * of the radius, 0 at the edge (the sample's `glowTex`). Built as data, so it needs no canvas.
 */
export function glowTexture(hex: string): DataTexture {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const data = new Uint8Array(GLOW * GLOW * 4);
  const c = (GLOW - 1) / 2;
  for (let y = 0; y < GLOW; y++)
    for (let x = 0; x < GLOW; x++) {
      const d = Math.min(1, Math.hypot(x - c, y - c) / (GLOW / 2));
      const a = d < 0.35 ? 1 - (d / 0.35) * 0.65 : 0.35 * (1 - (d - 0.35) / 0.65);
      const i = (y * GLOW + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(a * 255);
    }
  const t = new DataTexture(data, GLOW, GLOW);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** A ground-label texture from a pixel-font text canvas (`deps.textCanvas(text)`), with pixel-art filtering. */
export function textTexture(text: string, make: (text: string) => CanvasSource): CanvasTexture<CanvasSource> {
  return pixelArt(new CanvasTexture(make(text)));
}
