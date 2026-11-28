import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { burst, clockScale, hitStop, makeFx3d, newClock, ring, setFxQuality, shake, slash, slowMo, tickFx, visualDt } from '../../src/render/world/fx3d';
import { motionFlags } from '../../src/render/world/motion-flags';
import { FRAME_BUDGET } from '../../src/render/world/quality';

const FULL = motionFlags(false);
const STILL = motionFlags(true);
const cam = new PerspectiveCamera();

describe('requirement 25.4: the fixed particle pool', () => {
  it('never grows past its size and drops particles when full', () => {
    const fx = makeFx3d(FRAME_BUDGET.poolArena);
    const len = fx.pos.length;
    expect(burst(fx, 0, 0, 0, { n: 300, color: '#ffffff' })).toBe(300);
    expect(burst(fx, 0, 0, 0, { n: 300, color: '#ffffff' })).toBe(FRAME_BUDGET.poolArena - 300);
    expect(burst(fx, 0, 0, 0, { n: 10, color: '#ffffff' })).toBe(0);
    expect(fx.live).toBe(FRAME_BUDGET.poolArena);
    expect(fx.pos.length).toBe(len);
    expect(fx.points.geometry.getAttribute('position').count).toBe(FRAME_BUDGET.poolArena);
  });

  it('reuses slots once particles die', () => {
    const fx = makeFx3d(16);
    burst(fx, 0, 0, 0, { n: 16, color: '#ff0000', life: 0.1 });
    expect(burst(fx, 0, 0, 0, { n: 1, color: '#ff0000' })).toBe(0);
    for (let i = 0; i < 10; i++) tickFx(fx, 0.05, cam);
    expect(fx.live).toBe(0);
    expect(burst(fx, 0, 0, 0, { n: 16, color: '#ff0000' })).toBe(16);
    expect(fx.pos.length).toBe(48);
  });

  it('halves the usable pool at quality low', () => {
    const fx = makeFx3d(100, 'low');
    expect(burst(fx, 0, 0, 0, { n: 100, color: '#ffffff' })).toBe(50);
    expect(fx.points.geometry.drawRange.count).toBe(50);
    setFxQuality(fx, 'high');
    expect(burst(fx, 0, 0, 0, { n: 100, color: '#ffffff' })).toBe(50);
  });

  it('fades particles out and parks dead ones', () => {
    const fx = makeFx3d(4);
    burst(fx, 0, 1, 0, { n: 1, color: '#ffffff', life: 1 });
    tickFx(fx, 0.01, cam);
    const i = fx.alive.indexOf(1);
    expect(fx.col[i * 3]).toBeGreaterThan(0);
    for (let k = 0; k < 40; k++) tickFx(fx, 0.05, cam);
    expect(fx.col[i * 3]).toBe(0);
    expect(fx.pos[i * 3 + 1]).toBeLessThan(-50);
  });

  it('uses small fixed pools of rings and slashes', () => {
    const fx = makeFx3d(4);
    let rings = 0;
    for (let i = 0; i < 20; i++) if (ring(fx, 0, 0, 0, { color: '#fff' })) rings++;
    expect(rings).toBe(fx.rings.length);
    let slashes = 0;
    for (let i = 0; i < 20; i++) if (slash(fx, 0, 0, 0, { color: '#fff' })) slashes++;
    expect(slashes).toBe(fx.slashes.length);
    for (let k = 0; k < 20; k++) tickFx(fx, 0.05, cam);
    expect(ring(fx, 0, 0, 0, { color: '#fff' })).toBe(true);
  });
});

describe('requirements 13.1, 13.2: hit-stop and slow motion', () => {
  it('freezes the visual clock during hit-stop', () => {
    const c = newClock();
    hitStop(c, 1000, 90, FULL);
    expect(clockScale(c, 1050)).toBe(0);
    expect(visualDt(c, 1050, 0.016)).toBe(0);
    expect(clockScale(c, 1091)).toBe(1);
  });

  it('runs at 0.3 during slow motion', () => {
    const c = newClock();
    slowMo(c, 0, 340, 0.3, FULL);
    expect(visualDt(c, 100, 0.02)).toBeCloseTo(0.006);
    expect(visualDt(c, 400, 0.02)).toBeCloseTo(0.02);
  });

  it('caps dt at 50 ms', () => {
    expect(visualDt(newClock(), 0, 0.5)).toBeCloseTo(0.05);
  });
});

describe('requirement 26.3: reduced motion', () => {
  it('makes shake, hit-stop, and slow motion no-ops', () => {
    const fx = makeFx3d(4);
    shake(fx, 12, STILL);
    expect(fx.shakeAmp).toBe(0);
    tickFx(fx, 0.016, cam);
    expect(fx.shakeOff.length()).toBe(0);
    const c = newClock();
    hitStop(c, 0, 90, STILL);
    slowMo(c, 0, 340, 0.3, STILL);
    expect(clockScale(c, 10)).toBe(1);
  });

  it('shakes by n / 100 units and decays', () => {
    const fx = makeFx3d(4);
    shake(fx, 9, FULL);
    expect(fx.shakeAmp).toBeCloseTo(0.09);
    for (let i = 0; i < 30; i++) tickFx(fx, 0.05, cam);
    expect(fx.shakeAmp).toBe(0);
  });
});
