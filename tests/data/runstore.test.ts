import { describe, expect, it } from 'vitest';
import {
  clearRun,
  readClassWins,
  readRun,
  readTrophies,
  writeClassWins,
  writeRun,
  writeTrophies,
} from '../../src/data/runstore';
import { ClassWinsSchema, TrophyHaveSchema } from '../../src/data/schema';
import { memoryStorage, throwingStorage } from '../fixtures/storage';

describe('runstore', () => {
  it('FR-SAV-1: writes, reads, and clears the run at cq:v2:run (v1.6)', () => {
    const s = memoryStorage();
    writeRun(s, { version: 2 });
    expect(JSON.parse(s.data.get('cq:v2:run') ?? 'null')).toEqual({ version: 2 });
    expect(readRun(s)).toEqual({ version: 2 });
    clearRun(s);
    expect(s.data.has('cq:v2:run')).toBe(false);
    expect(readRun(s)).toBeNull();
  });

  it('FR-SAV-3: never reads, writes, or removes the prototype key cq:v1:run (v1.6)', () => {
    const old = '{"version":1,"from":"prototype"}';
    const s = memoryStorage({ 'cq:v1:run': old });
    expect(readRun(s)).toBeNull();
    writeRun(s, { version: 2 });
    expect(s.data.get('cq:v1:run')).toBe(old);
    clearRun(s);
    expect(s.data.get('cq:v1:run')).toBe(old);
    expect(s.data.has('cq:v2:run')).toBe(false);
  });

  it('FR-TRO-1: trophies at cq:v1:trophies and class wins at cq:v1:classwins', () => {
    const s = memoryStorage();
    writeTrophies(s, { first: '2026-11-19', speed: '2026-11-20' });
    writeClassWins(s, { knight: true });
    expect(JSON.parse(s.data.get('cq:v1:trophies') ?? 'null')).toEqual({ first: '2026-11-19', speed: '2026-11-20' });
    expect(JSON.parse(s.data.get('cq:v1:classwins') ?? 'null')).toEqual({ knight: true });
    expect(readTrophies(s)).toEqual({ first: '2026-11-19', speed: '2026-11-20' });
    expect(readClassWins(s)).toEqual({ knight: true });
  });

  it('FR-SAV-1: corrupt JSON and missing keys read as null', () => {
    const s = memoryStorage({ 'cq:v2:run': '{oops', 'cq:v1:trophies': 'nope', 'cq:v1:classwins': '{' });
    expect(readRun(s)).toBeNull();
    expect(readTrophies(s)).toBeNull();
    expect(readClassWins(s)).toBeNull();
    expect(readRun(memoryStorage())).toBeNull();
  });

  it('FR-SAV-1: a throwing or missing storage never throws', () => {
    for (const st of [throwingStorage, null]) {
      expect(readRun(st)).toBeNull();
      expect(readTrophies(st)).toBeNull();
      expect(readClassWins(st)).toBeNull();
      expect(() => writeRun(st, { version: 2 })).not.toThrow();
      expect(() => clearRun(st)).not.toThrow();
      expect(() => writeTrophies(st, {})).not.toThrow();
      expect(() => writeClassWins(st, {})).not.toThrow();
    }
  });
});

describe('TrophyHaveSchema and ClassWinsSchema', () => {
  it('FR-TRO-1: keep known ids, strip unknown keys, reject bad values', () => {
    expect(TrophyHaveSchema.parse({ first: '2026-11-19', bogus: 'x' })).toEqual({ first: '2026-11-19' });
    expect(TrophyHaveSchema.safeParse({ first: 'yesterday' }).success).toBe(false);
    expect(TrophyHaveSchema.safeParse(null).success).toBe(false);
    expect(ClassWinsSchema.parse({ mage: true, bard: true })).toEqual({ mage: true });
    expect(ClassWinsSchema.safeParse({ mage: 1 }).success).toBe(false);
  });
});
