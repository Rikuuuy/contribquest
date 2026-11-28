// Pacing between fight steps (presentation requirement 12, design.md "Pacing"; prototype `later` delays in
// resolveAttack, resolveDefend, and the phase2Fresh flag). Pure: no timers here, main.ts owns them.
import type { Fight, FightNext, GameEvent } from '../engine';

export type PacingInput = { fight: Fight; events: readonly GameEvent[]; resolved: 'strike' | 'guard' };

export const PACING = {
  strikeKill: 950,
  strikeKillBoss: 1300,
  strikeNext: 600,
  phase2: 1500,
  comboGap: 170,
  counterKill: 1250,
  counterKillBoss: 1600,
  heroDown: 1100,
  nextStrikePerfect: 750,
  nextStrike: 500,
  choosePerfect: 700,
  choose: 400,
  relicShow: 380,
  blessingRise: 1500,
  blessingNoRise: 300,
  raceLine: 1900,
  levelUpFx: 250,
  hpBarDelay: 110,
  fightDust: 300,
  phase2Fx: 250,
} as const;

/** `strike` when the step's events hold a `heroHit`, `guard` otherwise (v1.6: no flee). */
export function resolvedKind(events: readonly GameEvent[], _next?: FightNext | null): 'strike' | 'guard' {
  return events.some((e) => e.type === 'heroHit') ? 'strike' : 'guard';
}

const BOSS_TIER = 5;

/** Holds the prototype's `phase2Fresh` flag: set by a `phase2` event, cleared by the next strike delay or choice. */
export class Pacer {
  phase2Fresh = false;

  /** Milliseconds from entering `wait` until `advance` is sent. */
  delayFor({ fight, events, resolved }: PacingInput): number {
    if (events.some((e) => e.type === 'phase2')) this.phase2Fresh = true;
    const next = fight.next;
    if (!next) return 0;
    const boss = fight.m.tier === BOSS_TIER;
    if (resolved === 'strike') {
      const hit = events.find((e): e is Extract<GameEvent, { type: 'heroHit' }> => e.type === 'heroHit');
      const extra = Math.max(0, (hit?.grades.length ?? 1) - 1) * PACING.comboGap;
      if (next.kind === 'win') return (boss ? PACING.strikeKillBoss : PACING.strikeKill) + extra;
      const ms = this.phase2Fresh ? PACING.phase2 : PACING.strikeNext;
      this.phase2Fresh = false;
      return ms + extra;
    }
    if (next.kind === 'win') return boss ? PACING.counterKillBoss : PACING.counterKill;
    if (next.kind === 'lose') return PACING.heroDown;
    const perfect = events.some((e) => e.type === 'counter');
    if (next.kind === 'strike') return perfect ? PACING.nextStrikePerfect : PACING.nextStrike;
    const ms = this.phase2Fresh ? PACING.phase2 : perfect ? PACING.choosePerfect : PACING.choose;
    this.phase2Fresh = false;
    return ms;
  }

  /** Called when a fight starts. */
  reset(): void {
    this.phase2Fresh = false;
  }
}
