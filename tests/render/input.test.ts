import { describe, expect, it } from 'vitest';
import { isArrowKey, isMuteKey, relicKey, routeKey, tileFromPoint } from '../../src/render/input';
import { layout } from '../../src/render/layout';

describe('FR-MOV-1: route keys (v1.6)', () => {
  it('ArrowUp/W pick up, ArrowRight/D ahead, ArrowDown/S down, in any case', () => {
    for (const k of ['ArrowUp', 'w', 'W']) expect(routeKey(k), k).toBe('up');
    for (const k of ['ArrowRight', 'd', 'D']) expect(routeKey(k), k).toBe('ahead');
    for (const k of ['ArrowDown', 's', 'S']) expect(routeKey(k), k).toBe('down');
  });

  it('ArrowLeft/A, F, Escape, and other keys pick nothing', () => {
    for (const k of ['ArrowLeft', 'a', 'A', 'f', 'F', 'Escape', ' ', 'Enter', '1', 'm', '']) expect(routeKey(k), k).toBeNull();
  });

  it('all four arrow keys have their default prevented, nothing else', () => {
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) expect(isArrowKey(k), k).toBe(true);
    for (const k of ['w', 'a', 's', 'd', ' ', 'Tab', 'arrowup']) expect(isArrowKey(k), k).toBe(false);
  });
});

describe('FR-REL-1: relic keys', () => {
  it('1, 2, 3 pick cards 0, 1, 2', () => {
    expect([relicKey('1'), relicKey('2'), relicKey('3')]).toEqual([0, 1, 2]);
  });

  it('other keys pick nothing', () => {
    for (const k of ['0', '4', 'a', 'Enter', '']) expect(relicKey(k), k).toBeNull();
  });
});

describe('FR-FX-8: mute key', () => {
  const on = (tagName: string | null, isContentEditable = false) => (tagName ? ({ tagName, isContentEditable } as unknown as EventTarget) : null);

  it('M or m outside text fields toggles mute', () => {
    expect(isMuteKey({ key: 'm', target: on('BODY') })).toBe(true);
    expect(isMuteKey({ key: 'M', target: on('CANVAS') })).toBe(true);
    expect(isMuteKey({ key: 'm', target: null })).toBe(true);
  });

  it('M while typing in a text field does nothing', () => {
    for (const tag of ['INPUT', 'input', 'TEXTAREA', 'SELECT']) expect(isMuteKey({ key: 'm', target: on(tag) }), tag).toBe(false);
    expect(isMuteKey({ key: 'm', target: on('DIV', true) })).toBe(false);
  });

  it('other keys never mute', () => {
    expect(isMuteKey({ key: 'n', target: on('BODY') })).toBe(false);
  });
});

describe('NFR Responsiveness: tileFromPoint', () => {
  const L = layout({ cols: 14 }, 40, 4, true); // w = 34 + 15 × 44 + 4 = 698

  it('maps a point at full size to its cell', () => {
    const rect = { left: 100, top: 50, width: L.w };
    expect(tileFromPoint(L, rect, 100 + 34 + 1, 50 + 22 + 1)).toEqual({ col: 0, row: 0 });
    expect(tileFromPoint(L, rect, 100 + 34 + 3 * 44 + 20, 50 + 22 + 6 * 44 + 20)).toEqual({ col: 3, row: 6 });
  });

  it('scales the point back when the canvas is shown at half size', () => {
    const rect = { left: 0, top: 0, width: L.w / 2 };
    const [x, y] = [34 + 5 * 44 + 10, 22 + 2 * 44 + 10];
    expect(tileFromPoint(L, rect, x / 2, y / 2)).toEqual({ col: 5, row: 2 });
  });

  it('returns null outside the day grid and for bad input', () => {
    const rect = { left: 0, top: 0, width: L.w };
    expect(tileFromPoint(L, rect, 10, 10)).toBeNull();
    expect(tileFromPoint(L, rect, 34 + 14 * 44 + 5, 30)).toBeNull();
    expect(tileFromPoint(L, rect, 40, 22 + 7 * 44 + 1)).toBeNull();
    expect(tileFromPoint(L, { left: 0, top: 0, width: 0 }, 40, 40)).toBeNull();
    expect(tileFromPoint(L, rect, Number.NaN, 40)).toBeNull();
  });
});
