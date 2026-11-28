// The page background canvas `#bg` (prototype bgCelebrate; requirement 13.5): win confetti or falling ash at the
// end of a run. It runs a frame loop only while particles are alive, so it costs nothing the rest of the time.
import { sizeCanvas } from './dom';
import { fxBurst, fxBusy, fxDraw, fxUpdate, makeFx } from './fx';

export type Background = {
  /** Confetti from four points along the bottom (won) or ash drifting down from the top (lost); none when reduced. */
  celebrate(won: boolean, reduced: boolean): void;
};

const CONFETTI = ['#ffd257', '#39d353', '#b48cff', '#ffffff'];
const ASH = ['#7a7f8c', '#4a4e58', '#ff6b6b'];

export function createBackground(cv: HTMLCanvasElement): Background {
  const fx = makeFx();
  let ctx: CanvasRenderingContext2D | null = null;
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;

  function size(): void {
    w = globalThis.innerWidth || 1;
    h = globalThis.innerHeight || 1;
    try {
      ctx = sizeCanvas(cv, w, h);
    } catch {
      ctx = null;
    }
  }

  function frame(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    fxUpdate(fx, dt);
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    fxDraw(fx, ctx);
    raf = fxBusy(fx) ? requestAnimationFrame(frame) : 0;
  }

  function run(): void {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  globalThis.addEventListener?.('resize', () => {
    if (raf) size();
  });

  return {
    celebrate(won: boolean, reduced: boolean): void {
      if (reduced) return;
      size();
      if (!ctx) return;
      if (won) {
        for (let i = 0; i < 4; i++)
          setTimeout(() => {
            fxBurst(fx, w * (0.2 + 0.2 * i), h * 0.85, 40, { color: CONFETTI, speed: 420, angle: -Math.PI / 2, spread: 1.2, grav: 380, drag: 0.6, life: 2.2, size: 5, glow: true });
            run();
          }, i * 220);
      } else {
        fxBurst(fx, w / 2, -20, 70, { color: ASH, speed: 60, angle: Math.PI / 2, spread: 2.5, grav: 40, drag: 0.4, life: 4, size: 3, jitter: w });
        run();
      }
    },
  };
}
