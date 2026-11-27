// Reduced-motion flags for the world renderer (v1.6, pure). Every world module reads these instead of `REDUCED`
// (requirement 26; art-style.md "Reduced motion (3D additions)").

export type MotionFlags = {
  /** Ease the camera to a new aim (else cut). */
  cameraEase: boolean;
  /** The slab rise and the overview-to-follow move. */
  rise: boolean;
  /** Billboard bob and breathe. */
  bob: boolean;
  /** Procedural rig frames. */
  rigs: boolean;
  /** Sprite frame animation (else heroes stay on `idle`). */
  frames: boolean;
  /** Lantern flicker (else base intensity). */
  flicker: boolean;
  /** Firefly drift (else frozen in place, still visible). */
  fireflyDrift: boolean;
  /** Fog-bank drift (else frozen in place, still visible). */
  fogDrift: boolean;
  /** Arena petals. */
  petals: boolean;
  /** Legal-tile highlight pulse (else static at full opacity). */
  pulse: boolean;
  /** Hero hop and landing squash (else moved instantly). */
  hop: boolean;
  /** Event light flashes. */
  flashes: boolean;
  whiteOut: boolean;
  shake: boolean;
  hitStop: boolean;
  slowMo: boolean;
  /** Floating text rises (else fades in place). */
  textRise: boolean;
};

const KEYS = [
  'cameraEase',
  'rise',
  'bob',
  'rigs',
  'frames',
  'flicker',
  'fireflyDrift',
  'fogDrift',
  'petals',
  'pulse',
  'hop',
  'flashes',
  'whiteOut',
  'shake',
  'hitStop',
  'slowMo',
  'textRise',
] as const satisfies readonly (keyof MotionFlags)[];

const FULL = Object.freeze(Object.fromEntries(KEYS.map((k) => [k, true])) as MotionFlags);
const STILL = Object.freeze(Object.fromEntries(KEYS.map((k) => [k, false])) as MotionFlags);

/** Every motion on, or every motion off when the player asks for reduced motion. The timing gauges are not here: they always move. */
export function motionFlags(reduced: boolean): Readonly<MotionFlags> {
  return reduced ? STILL : FULL;
}
