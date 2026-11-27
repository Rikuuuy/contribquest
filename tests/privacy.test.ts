// Privacy rule (progression requirement 12, FR-SAV-2): the game talks only to the contribution API and the
// GitHub avatar URL, and has no cookies, beacons, or analytics.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { API_BASE } from '../src/data/constants';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Every source file under src/, with its path relative to src/. */
function sources(dir = SRC): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(full));
    else if (/\.(ts|js|mjs|json|html|css)$/.test(e.name)) out.push({ path: relative(SRC, full), text: readFileSync(full, 'utf8') });
  }
  return out;
}

const ALLOWED = [API_BASE, 'https://github.com/'];

describe('FR-SAV-2: network and storage privacy', () => {
  const files = sources();

  it('reads the source tree', () => {
    expect(files.some((f) => f.path === 'main.ts')).toBe(true);
    expect(files.some((f) => f.path.startsWith('engine'))).toBe(true);
  });

  it('every https:// URL in src/ is API_BASE or https://github.com/', () => {
    const bad: string[] = [];
    let found = 0;
    for (const f of files) {
      for (const m of f.text.matchAll(/https:\/\/[^\s'"`)<>]*/g)) {
        found++;
        if (!ALLOWED.some((a) => m[0].startsWith(a))) bad.push(`${f.path}: ${m[0]}`);
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  it('has no plain http:// URL', () => {
    const bad = files.flatMap((f) => [...f.text.matchAll(/http:\/\/[^\s'"`)<>]*/g)].map((m) => `${f.path}: ${m[0]}`));
    expect(bad).toEqual([]);
  });

  it('uses no document.cookie, sendBeacon, or analytics import', () => {
    const bad: string[] = [];
    for (const f of files) {
      if (/document\s*\.\s*cookie/.test(f.text)) bad.push(`${f.path}: document.cookie`);
      if (/sendBeacon/.test(f.text)) bad.push(`${f.path}: sendBeacon`);
      for (const m of f.text.matchAll(/(?:import|require)\s*\(?[^'"`]*['"`]([^'"`]+)['"`]/g)) {
        if (/analytics|gtag|google-analytics|plausible|posthog|segment|mixpanel|amplitude|sentry/i.test(m[1] ?? ''))
          bad.push(`${f.path}: imports ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
