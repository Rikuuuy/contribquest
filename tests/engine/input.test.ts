import { describe, expect, it } from 'vitest';
import { combatKey } from '../../src/engine/input';

describe('FR-COM-6, FR-CLS-9: combat keys', () => {
  it('Space, Enter, A, J, and K are hit keys, in any case', () => {
    for (const k of [' ', 'Enter', 'a', 'A', 'j', 'J', 'k', 'K']) expect(combatKey(k), k).toBe('hit');
  });

  it('v1.6: F and Escape have no fight action', () => {
    for (const k of ['f', 'F', 'Escape']) expect(combatKey(k), k).toBeNull();
  });

  it('other keys do nothing', () => {
    for (const k of ['ArrowUp', 'w', 's', 'd', 'm', '1', 'Tab', 'Shift', '']) expect(combatKey(k), k).toBeNull();
  });
});
