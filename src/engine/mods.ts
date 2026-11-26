// Combat flags from the hero's relics and race.
import type { Hero } from './state';

export type Mods = {
  linter: boolean;
  elf: boolean;
  force: boolean;
  pair: boolean;
  blame: boolean;
  hotfix: boolean;
  cache: boolean;
  duck: boolean;
  vampire: boolean;
  skeleton: boolean;
};

export const NO_MODS: Readonly<Mods> = Object.freeze({
  linter: false,
  elf: false,
  force: false,
  pair: false,
  blame: false,
  hotfix: false,
  cache: false,
  duck: false,
  vampire: false,
  skeleton: false,
});

export function modsOf(hero: Pick<Hero, 'relics' | 'race'>): Mods {
  const r = hero.relics;
  return {
    linter: r.includes('linter'),
    elf: hero.race === 'elf',
    force: r.includes('force'),
    pair: r.includes('pair'),
    blame: r.includes('blame'),
    hotfix: r.includes('hotfix'),
    cache: r.includes('cache'),
    duck: r.includes('duck'),
    vampire: hero.race === 'vampire',
    skeleton: hero.race === 'skeleton',
  };
}
