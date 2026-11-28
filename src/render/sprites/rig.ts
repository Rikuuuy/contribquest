// Procedural rigs (prototype heroRig, monRig, rigOffsets): a rig gives every sprite row a whole-pixel [dx, dy]
// offset, so bodies lean, breathe, crouch, and ripple without hand-drawn frames. dx points the way the sprite faces;
// dy only pushes rows down (0–3). Pure: `drawSprite` turns the offsets into a cached shifted canvas.
import type { ClassId } from '../../data/schema';

/** Row → [dx, dy] in sprite pixels. */
export type Rig = (row: number) => readonly [number, number];

/** The widest a row may move sideways, px; rigged canvases are padded by this on both sides. */
export const RIG_PAD = 4;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export type HeroRigOpts = {
  moving?: boolean;
  look?: -1 | 0 | 1;
  /** 0–1 while an attack test charges. */
  windup?: number;
  /** 0–1 while bracing for a hit. */
  brace?: number;
  lunge?: number;
  hurt?: number;
  dodge?: number;
  land?: number;
  seed?: number;
  cls?: ClassId;
};

/** Only the wanderer's cape ripples; whole-row shifts would bend staffs and legs. */
const HEM: Readonly<Record<ClassId, number>> = { wanderer: 1, mage: 0, knight: 0, rogue: 0 };

/** The hero rig (24 rows: head 0–11, torso 12–21, feet 22–23 stay planted). Null with reduced motion. */
export function heroRig(now: number, o: HeroRigOpts, reduced: boolean): Rig | null {
  if (reduced) return null;
  const t = (now + (o.seed ?? 0)) / 1000;
  const hem = o.cls ? HEM[o.cls] : 1;
  let lean = 0.75 * Math.sin(t * 1.9);
  let crouch = 0;
  let lag = 0;
  let flow = 1;
  const breath = Math.sin(t * 3.3) > 0.4 ? 1 : 0;
  if (o.moving) {
    lean = 1.6 + 0.6 * Math.sin(t * 14);
    lag = -1;
    flow = 1.8;
  }
  if (o.look) lean = o.look * 1.6;
  if (o.brace) {
    lean = -1.4 * o.brace;
    crouch = 1.6 * o.brace;
  }
  if (o.windup) {
    lean = -3 * o.windup;
    crouch = 2 * o.windup;
  }
  if (o.lunge) {
    lean = 4 * o.lunge;
    lag = -2 * o.lunge;
    flow = 2;
  }
  if (o.hurt) {
    lean = -3.5 * o.hurt;
    lag = 1.5 * o.hurt;
    flow = 2;
  }
  if (o.dodge) {
    lean = -2.5 * o.dodge;
    flow = 2;
  }
  if (o.land) crouch = Math.max(crouch, 2 * o.land);
  crouch = Math.round(crouch);
  return (r) => {
    if (r >= 22) return [0, 0];
    let dx = (lean * (22 - r)) / 22 + (r < 5 ? (lag * (5 - r)) / 5 : 0);
    if (r >= 16) dx += hem * 0.7 * flow * Math.sin(t * 5 - r * 0.9);
    const dy = r <= 11 ? breath + crouch : r <= 14 ? crouch : r <= 17 ? Math.round(crouch / 2) : 0;
    return [dx, Math.min(dy, 3)];
  };
}

export type MonRigOpts = { windup?: number; lunge?: number; hurt?: number; seed?: number };

/**
 * Monster rigs, one motion per kind: the ghost's tail waves, the imp skitters and hops, the ghoul shambles and
 * reaches, the lich's robe hem ripples, the Phantom's wisps curl. Null with reduced motion.
 */
export function monRig(tier: 1 | 2 | 3 | 4 | 5, now: number, o: MonRigOpts, reduced: boolean): Rig | null {
  if (reduced) return null;
  const t = (now + (o.seed ?? 0)) / 1000;
  let lean = 0;
  let crouch = 0;
  if (o.windup) {
    lean = -2.5 * o.windup;
    crouch = Math.round(1.5 * o.windup);
  }
  if (o.lunge) lean = 3.5 * o.lunge;
  if (o.hurt) lean = -3 * o.hurt;
  const hop = Math.sin(t * 11) > 0.55 ? 1 : 0;
  const shamble = Math.sin(t * 2.3);
  const nod = Math.sin(t * 4.6) > 0.5 ? 1 : 0;
  const H = tier === 5 ? 24 : 16;
  return (r) => {
    let dx = (lean * (H - 1 - r)) / (H - 1);
    let dy = r < H / 2 ? crouch : 0;
    if (tier === 1) dx += r >= 9 ? ((Math.sin(t * 4.2 - r * 0.85) * (r - 8)) / 6) * 1.7 : 0.7 * Math.sin(t * 1.6);
    else if (tier === 2) {
      if (r >= 12) dx += (r % 2 ? 1 : -1) * Math.sin(t * 11) * 1.2;
      else {
        dx += 0.6 * Math.sin(t * 3);
        dy += hop;
      }
    } else if (tier === 3) {
      dx += (1.4 * shamble * (14 - r)) / 14 + (r >= 8 && r <= 9 && Math.sin(t * 2.3 + 1) > 0.2 ? 1 : 0);
      if (r <= 6) dy += nod;
    } else if (tier === 4) {
      if (r >= 10) dx += (Math.sin(t * 3.5 - r * 1.1) * 1.3 * (r - 9)) / 5;
      else dx += 0.6 * Math.sin(t * 1.4);
    } else {
      if (r >= 15) dx += (Math.sin(t * 3 - r * 0.8) * 1.8 * (r - 14)) / 9;
      else dx += (0.9 * Math.sin(t * 1.3) * (15 - r)) / 15;
      if (r >= 8 && r <= 10) dx += Math.sin(t * 2.1) > 0.3 ? 1 : 0;
    }
    return [dx, dy];
  };
}

/**
 * Whole-pixel offsets for rows 0 … H − 1 as a flat [dx0, dy0, dx1, dy1, …] list (dx within ±RIG_PAD, dy 0–3), or
 * null when every row stays put.
 */
export function rigOffsets(rig: Rig, H: number): number[] | null {
  const offs: number[] = [];
  let any = false;
  for (let r = 0; r < H; r++) {
    const o = rig(r);
    const dx = clamp(Math.round(o[0] || 0), -RIG_PAD, RIG_PAD);
    const dy = clamp(Math.round(o[1] || 0), 0, 3);
    offs.push(dx, dy);
    if (dx || dy) any = true;
  }
  return any ? offs : null;
}
