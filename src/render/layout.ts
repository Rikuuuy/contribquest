// Flat map layout (prototype enterMap sizing, layout, tileXY). Used by the flat renderer, the share card,
// and `tileFromPoint`.

/** Pixel layout of the flat map. `w` includes the v1.6 boss node, one gap right of the last column. */
export type Layout = {
  tile: number;
  gap: number;
  /** Left and top offsets: 34 and 22 px with labels, 4 px without. */
  ox: number;
  oy: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
};

const ROWS = 7;
const MIN_TILE = 26;
const MAX_TILE = 52;
const MAX_AVAIL = 940;

/**
 * Tile size for a map with `cols` columns in a `<main>` that is `mainWidth` CSS px wide (requirement 4.1):
 * `T = clamp(floor((avail − 40) / cols) − 4, 26, 52)` with `avail = min(940, mainWidth − 8)`.
 */
export function mapTileSize(mainWidth: number, cols: number): number {
  const avail = Math.min(MAX_AVAIL, mainWidth - 8);
  const t = Math.floor((avail - 40) / cols) - 4;
  return Math.max(MIN_TILE, Math.min(MAX_TILE, t));
}

/** The layout for `map` at tile size `tile` and spacing `gap`, with or without the weekday and month labels. */
export function layout(map: { cols: number }, tile: number, gap: number, labels: boolean): Layout {
  const ox = labels ? 34 : 4;
  const oy = labels ? 22 : 4;
  // v1.6: one more column of width (tile + gap) holds the boss node.
  return {
    tile,
    gap,
    ox,
    oy,
    w: ox + (map.cols + 1) * (tile + gap) + 4,
    h: oy + ROWS * (tile + gap) + 4,
    cols: map.cols,
    rows: ROWS,
  };
}

/** Top-left corner of the cell at `col`, `row`, in layout pixels (integers when the inputs are). */
export function tileXY(L: Layout, col: number, row: number): [number, number] {
  return [L.ox + col * (L.tile + L.gap), L.oy + row * (L.tile + L.gap)];
}
