// Colours from art-style.md "Palette" and the prototype (LEVEL_COLORS, LEVEL_HI, COLORS).

/** Day levels 0–4: GitHub dark-mode greens (also the "ectoplasm"). */
export const LEVEL_COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] as const;
/** Day level highlights 0–4. */
export const LEVEL_HI = ['#262d3a', '#1b6b3e', '#1d9a4c', '#52d06c', '#8dffa0'] as const;

export const UI = {
  bg: '#0b0e14',
  bgGlow: '#241a3a',
  map: '#0d1117',
  panel: '#121722',
  line: '#263042',
  text: '#e6edf3',
  muted: '#8b98ab',
  orange: '#ff9a3c',
  gold: '#ffd257',
  amber: '#ffb13c',
  purple: '#b48cff',
  purpleDeep: '#7b4bc9',
  purpleDark: '#5d3fb0',
  purplePale: '#d9c6ff',
  purpleLight: '#e7d8ff',
  red: '#ff6b6b',
} as const;

/** The 1 px outline every sprite gets. */
export const OUTLINE = '#05060a';
/** Silhouette colours for hit flashes and afterimages. */
export const SILHOUETTE = { white: '#ffffff', red: '#ff4040', gold: '#ffd257' } as const;
/** Ember rim light around the boss sprite. */
export const MON_RIM: Readonly<Record<string, string>> = { phantom: '#ff8a3d' };
/** Bone white, the race key `u`. */
export const BONE = '#f4efe0';

export const GRADE_COLORS = { perfect: '#ffd257', good: '#39d353', miss: '#ff6b6b' } as const;
/** Difficulty stars 1–4 (index 0 is one star). */
export const STAR_COLORS = ['#8dffa0', '#9fd8ff', '#ffb38a', '#ff6b6b'] as const;

/** Shared sprite palette: the character keys of the 12-wide `SPRITES` and the 16-wide monster grids. */
export const COLORS: Readonly<Record<string, string>> = {
  k: '#0b0b10',
  w: '#e8e6f0',
  p: '#7b4bc9',
  P: '#4b2a85',
  f: '#f2c79b',
  y: '#ffd257',
  o: '#c8641e',
  d: '#7a3f12',
  r: '#e2483d',
  a: '#8c2620',
  g: '#86b86f',
  G: '#4e7d3f',
  c: '#5b4a3a',
  s: '#8b93a3',
  S: '#545a69',
  v: '#a58bff',
  V: '#5d3fb0',
  e: '#ff7b29',
  b: '#2a1d14',
  u: '#5fb4ff',
  n: '#39d353',
  z: '#cdbcff',
  Z: '#0c0820',
  q: '#241a52',
};
