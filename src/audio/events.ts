// Engine events → sounds, and the screen → music mode (design "Event → sound and effect map"; requirements 3.3,
// 11.4, 14.3). Pure, so sound never depends on the renderer and every row is unit tested. Delays match the effects
// they belong to (impact 100 ms after a swing, 110 ms after a monster strike, 170 ms between combo hits).
import type { GameEvent, Mode, QteTest, RunState } from '../engine';
import type { MusicMode, SoundName } from './sfx';

/** One sound, `at` ms after the step, at `gain` × its volume. */
export type SoundCue = { name: SoundName; at: number; gain?: number };

export type SoundCtx = {
  /** The test now open (after the step), for the flaky stutter. */
  test?: QteTest | null;
  /** The mode of the test the step's press went to, if the step was a press. */
  press?: Mode | null;
  /** Trophies newly earned by the run that just ended. */
  newTrophies?: number;
};

/** Timing of the sounds (ms), shared with the stage effects. */
export const SOUND_AT = {
  heroImpact: 100,
  comboGap: 170,
  death: 150,
  monImpact: 110,
  counter: 330,
  levelUp: 250,
  phase2: 250,
  shard: 300,
  bound: 750,
  relicOffer: 380,
  trophy: 900,
} as const;

const STRIKE_MODES: ReadonlySet<Mode> = new Set(['bar', 'combo', 'charge']);
const HIT_SOUND = { perfect: 'crit', good: 'hit', miss: 'glance' } as const;
const GUARD_SOUND = { perfect: 'dodge', good: 'block', miss: 'hurt' } as const;

/** The sounds for a step's events (v1.6 set: no `blocked` or `gate`; `rest`, cache heal, `bound`). */
export function soundsFor(events: readonly GameEvent[], ctx: SoundCtx = {}): SoundCue[] {
  const out: SoundCue[] = [];
  const add = (name: SoundName, at = 0, gain?: number) => out.push(gain === undefined ? { name, at } : { name, at, gain });
  if (ctx.press === 'charge') add('charge');
  for (const e of events) {
    switch (e.type) {
      case 'moved':
        if (e.from.col !== e.to.col || e.from.row !== e.to.row) add('step');
        break;
      case 'wisp':
        add('wisp');
        break;
      case 'rest':
        add('wisp', 0, 0.5);
        break;
      case 'heal':
        if (e.source === 'cache') add('relic');
        break;
      case 'chest':
        add('chest');
        break;
      case 'levelUp':
        add('levelup', SOUND_AT.levelUp);
        break;
      case 'fightStart':
        add(e.boss ? 'boss' : 'encounter');
        break;
      case 'testStart':
        add(STRIKE_MODES.has(e.mode) || e.pattern === 'quick' ? 'windup' : 'warn');
        if (e.pattern === 'flaky' && ctx.test?.pauseAt !== undefined) add('stutter', ctx.test.pauseAt);
        break;
      case 'heroHit': {
        e.grades.forEach((g, i) => add(HIT_SOUND[g], i * SOUND_AT.comboGap + SOUND_AT.heroImpact));
        if (e.killed) add('death', (Math.max(1, e.grades.length) - 1) * SOUND_AT.comboGap + SOUND_AT.heroImpact + SOUND_AT.death);
        break;
      }
      case 'monsterHit':
        add(GUARD_SOUND[e.grade], SOUND_AT.monImpact);
        break;
      case 'counter':
        add('hit', SOUND_AT.counter + SOUND_AT.heroImpact);
        if (e.killed) add('death', SOUND_AT.counter + SOUND_AT.heroImpact + SOUND_AT.death);
        break;
      case 'phase2':
        add('phase', SOUND_AT.phase2);
        break;
      case 'graded':
        if (e.result.why === 'rubber duck') add('relic');
        break;
      case 'shard':
        add('shard', SOUND_AT.shard);
        if (e.bound) add('ward', SOUND_AT.bound);
        break;
      case 'relicOffer':
        add('chest', SOUND_AT.relicOffer);
        break;
      case 'relicPicked':
        add('relic');
        break;
      case 'runEnded':
        add(e.won ? 'win' : 'lose');
        if (e.won && (ctx.newTrophies ?? 0) > 0) add('relic', SOUND_AT.trophy);
        break;
      default:
        break;
    }
  }
  return out;
}

export type ScreenId = 'start' | 'loading' | 'summary' | 'map' | 'end';

/**
 * The music for a screen and state: menu screens play `menu`, the end screen and a finished run are `off`, a
 * fight plays `combat`, `boss`, or `boss2` (phase 2), and the map plays `explore`.
 */
export function musicModeFor(screen: ScreenId, state: RunState | null): MusicMode {
  if (screen === 'start' || screen === 'loading' || screen === 'summary') return 'menu';
  if (screen === 'end' || !state || state.status === 'won' || state.status === 'lost') return 'off';
  const f = state.status === 'combat' ? state.combat : null;
  if (f) return f.m.tier === 5 ? (f.m.phase2 ? 'boss2' : 'boss') : 'combat';
  return 'explore';
}
