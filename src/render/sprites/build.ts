// Sprite building (prototype shadeCanvas, outlineSprite, silhouette, sprFrom, buildSprite). The grid steps are pure
// and work on colour grids; only `buildSprite` touches a canvas. Every sprite is cached once per key for the session.
import { COLORS, MON_RIM, OUTLINE, SILHOUETTE } from '../palette';
import { MONSTERS34, SPRITES, type Grid, type MonsterName, type SpriteName } from './grids';

/** A sprite as colours: `#rrggbb` per pixel, null where transparent. Indexed `[y][x]`. */
export type ColorGrid = (string | null)[][];

/** Mixes `#rrggbb` toward white (`w`) or black (`b`) by `k` (0–1). */
export function mixHex(hex: string, to: 'w' | 'b', k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = to === 'w' ? 255 : 0;
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v + (t - v) * k).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Keys that are never auto-shaded: eyes, dark lines, mouth, bone, glow, and the boss's stars and void. */
const FLAT: ReadonlySet<string> = new Set(['e', 'k', 'm', 'u', 'x', 'z', 'Z']);
/** Cloth keys that get the faint diagonal texture. */
const CLOTH: ReadonlySet<string> = new Set(['A', 'C', 'p', 'v']);

/**
 * Turns a character grid into colours with the art-style auto-shading, light from the top left:
 * transparent right or below → 38% darker; else transparent above or left → 30% lighter (rim);
 * else transparent two right or one down-right → 18% darker; else cloth where (x + y) % 7 = 0 → 10% darker.
 * Keys missing from `pal` are transparent.
 */
export function shadeGrid(g: readonly (readonly string[])[] | Grid, pal: Readonly<Record<string, string>>): ColorGrid {
  const H = g.length;
  const W = g[0]?.length ?? 0;
  const at = (x: number, y: number): string => (y < 0 || y >= H || x < 0 || x >= W ? '.' : (g[y]?.[x] ?? '.'));
  const out: ColorGrid = [];
  for (let y = 0; y < H; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      let col = ch === '.' ? undefined : pal[ch];
      if (col && !FLAT.has(ch)) {
        if (at(x + 1, y) === '.' || at(x, y + 1) === '.') col = mixHex(col, 'b', 0.38);
        else if (at(x, y - 1) === '.' || at(x - 1, y) === '.') col = mixHex(col, 'w', 0.3);
        else if (at(x + 2, y) === '.' || at(x + 1, y + 1) === '.') col = mixHex(col, 'b', 0.18);
        else if ((x + y) % 7 === 0 && CLOTH.has(ch)) col = mixHex(col, 'b', 0.1);
      }
      row.push(col ?? null);
    }
    out.push(row);
  }
  return out;
}

/** Colours a character grid without shading (the 12-wide item sprites); `over` replaces palette keys. */
export function colorGrid(rows: Grid, over?: Readonly<Record<string, string>>): ColorGrid {
  return rows.map((r) => [...r].map((ch) => (ch === '.' ? null : (over?.[ch] ?? COLORS[ch] ?? null))));
}

/** Adds a 1 px `color` outline: each opaque pixel stamps its 4 neighbours, so the grid grows 2 px each way. */
export function outline(g: ColorGrid, color: string = OUTLINE): ColorGrid {
  const H = g.length;
  const W = g[0]?.length ?? 0;
  const out: ColorGrid = Array.from({ length: H + 2 }, () => new Array<string | null>(W + 2).fill(null));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (g[y]?.[x] == null) continue;
      for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) {
        const r = out[y + dy];
        if (r) r[x + dx] = color;
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = g[y]?.[x];
      const r = out[y + 1];
      if (c != null && r) r[x + 1] = c;
    }
  return out;
}

/** Every opaque pixel in one colour (the white, red, and gold flash versions). */
export function silhouette(g: ColorGrid, color: string): ColorGrid {
  return g.map((r) => r.map((c) => (c == null ? null : color)));
}

/** The cached versions of one sprite. `flat` is the shaded sprite without outline (rigs rebuild rows from it). */
export type SpriteSet = {
  flat: HTMLCanvasElement;
  base: HTMLCanvasElement;
  white: HTMLCanvasElement;
  red: HTMLCanvasElement;
  gold: HTMLCanvasElement;
  rim?: string;
};

/** Draws a colour grid onto a new canvas, one canvas pixel per sprite pixel. */
export function gridCanvas(g: ColorGrid): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = g[0]?.length ?? 0;
  c.height = g.length;
  const x = c.getContext('2d');
  if (!x) throw new Error('2D canvas context unavailable');
  g.forEach((row, y) =>
    row.forEach((col, i) => {
      if (col == null) return;
      x.fillStyle = col;
      x.fillRect(i, y, 1, 1);
    }),
  );
  return c;
}

/** Builds the outlined sprite (plus an optional rim outline outside the dark one) and its three silhouettes. */
export function buildSprite(g: ColorGrid, rim?: string): SpriteSet {
  let base = outline(g, OUTLINE);
  if (rim) base = outline(base, rim);
  const set: SpriteSet = {
    flat: gridCanvas(g),
    base: gridCanvas(base),
    white: gridCanvas(silhouette(base, SILHOUETTE.white)),
    red: gridCanvas(silhouette(base, SILHOUETTE.red)),
    gold: gridCanvas(silhouette(base, SILHOUETTE.gold)),
  };
  if (rim) set.rim = rim;
  return set;
}

/** Every built sprite for the page session, by key (`chest`, `mon:ghost`, `hero:{cls}:{race}:{frame}`, …). */
export const spriteCache = new Map<string, SpriteSet>();

/** The cached sprite for `key`, building it from `make()` the first time. */
export function cachedSprite(key: string, make: () => SpriteSet): SpriteSet {
  let s = spriteCache.get(key);
  if (!s) {
    s = make();
    spriteCache.set(key, s);
  }
  return s;
}

/** Key of a 12-wide item sprite (chest, grave, coffin, relic icons, 12-wide monsters); built on first use. */
export function itemKey(name: SpriteName): string {
  cachedSprite(name, () => buildSprite(colorGrid(SPRITES[name])));
  return name;
}

/** Key of a 16-wide shaded monster sprite (the phantom gets its ember rim); built on first use. */
export function monsterKey(name: MonsterName): string {
  const key = `mon:${name}`;
  cachedSprite(key, () => buildSprite(shadeGrid(MONSTERS34[name], COLORS), MON_RIM[name]));
  return key;
}

/**
 * Crossed bones for a resolved fight, as a 12×12 grid: the prototype draws them as two round-capped strokes
 * (`drawBones`, `rgba(232,230,240,.35)`); billboards need a sprite, so the strokes are rasterised here in the
 * same colour over the dark map.
 */
const BONES: Grid = [
  'uu........uu',
  'uuu......uuu',
  '.uuu....uuu.',
  '..uuu..uuu..',
  '...uuuuuu...',
  '....uuuu....',
  '....uuuu....',
  '...uuuuuu...',
  '..uuu..uuu..',
  '.uuu....uuu.',
  'uuu......uuu',
  'uu........uu',
];

/** Key of the crossed-bones sprite; built on first use. */
export function bonesKey(): string {
  cachedSprite('bones', () => buildSprite(colorGrid(BONES, { u: '#6b6878' })));
  return 'bones';
}

/** Monster sprite names by tier (5 is the boss). */
export const MONSTER_SPRITE: Readonly<Record<1 | 2 | 3 | 4 | 5, MonsterName>> = { 1: 'ghost', 2: 'imp', 3: 'ghoul', 4: 'lich', 5: 'phantom' };
