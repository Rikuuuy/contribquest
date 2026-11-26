import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../../src/data/settings';
import { readJson, removeKey, writeJson } from '../../src/data/storage';
import { memoryStorage, throwingStorage as throwing } from '../fixtures/storage';

describe('storage', () => {
  it('FR-IMP-7: reads, writes, and removes JSON', () => {
    const s = memoryStorage();
    writeJson(s, 'k', { a: 1 });
    expect(readJson(s, 'k')).toEqual({ a: 1 });
    removeKey(s, 'k');
    expect(readJson(s, 'k')).toBeNull();
  });

  it('FR-IMP-7: a throwing storage never throws and reads null', () => {
    expect(() => writeJson(throwing, 'k', 1)).not.toThrow();
    expect(() => removeKey(throwing, 'k')).not.toThrow();
    expect(readJson(throwing, 'k')).toBeNull();
  });

  it('FR-IMP-7: invalid JSON and unserialisable values are handled', () => {
    expect(readJson(memoryStorage({ k: '{not json' }), 'k')).toBeNull();
    const s = memoryStorage();
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => writeJson(s, 'k', cyclic)).not.toThrow();
    expect(s.data.has('k')).toBe(false);
  });

  it('FR-IMP-7: null storage is a no-op', () => {
    expect(readJson(null, 'k')).toBeNull();
    expect(() => writeJson(null, 'k', 1)).not.toThrow();
    expect(() => removeKey(null, 'k')).not.toThrow();
  });
});

describe('settings', () => {
  it('FR-COM-7: defaults when nothing is stored', () => {
    expect(DEFAULT_SETTINGS).toEqual({ calm: false, assist: false, mute: false, heroClass: 'wanderer', heroRace: 'human' });
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('FR-COM-7: stored values merge over the defaults', () => {
    const s = memoryStorage({ 'cq:v1:settings': JSON.stringify({ mute: true, heroRace: 'elf' }) });
    expect(loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, mute: true, heroRace: 'elf' });
  });

  it('FR-CLS-1: an unknown class or race is replaced with its default', () => {
    const s = memoryStorage({
      'cq:v1:settings': JSON.stringify({ heroClass: 'paladin', heroRace: 'dwarf', calm: true }),
    });
    expect(loadSettings(s)).toEqual({ ...DEFAULT_SETTINGS, calm: true });
  });

  it('FR-COM-7: corrupt or mistyped settings fall back to defaults', () => {
    expect(loadSettings(memoryStorage({ 'cq:v1:settings': '{oops' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage({ 'cq:v1:settings': '"text"' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage({ 'cq:v1:settings': '{"assist":"yes"}' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('FR-COM-7: a throwing storage returns defaults and saving does not throw', () => {
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(throwing, DEFAULT_SETTINGS)).not.toThrow();
  });

  it('FR-COM-7, FR-CLS-1: saving writes the whole record', () => {
    const s = memoryStorage();
    const next: Settings = { calm: true, assist: true, mute: false, heroClass: 'mage', heroRace: 'vampire' };
    saveSettings(s, next);
    expect(JSON.parse(s.data.get('cq:v1:settings')!)).toEqual(next);
    expect(loadSettings(s)).toEqual(next);
  });
});
