// Synthesized sound and music (prototype Sfx; requirements 14.1–14.4, 14.6; art-style "Audio"). Everything is made
// with Web Audio at run time: the build ships no audio files. Nothing plays before `init` (first key or pointer
// input), and every audio call is caught so a failure never blocks the game.

export type SoundName =
  | 'ui'
  | 'step'
  | 'wisp'
  | 'chest'
  | 'encounter'
  | 'boss'
  | 'windup'
  | 'warn'
  | 'stutter'
  | 'charge'
  | 'hit'
  | 'crit'
  | 'glance'
  | 'block'
  | 'dodge'
  | 'hurt'
  | 'death'
  | 'levelup'
  | 'shard'
  | 'ward'
  | 'relic'
  | 'phase'
  | 'rise'
  | 'win'
  | 'lose';

export type MusicMode = 'off' | 'menu' | 'explore' | 'combat' | 'boss' | 'boss2';

export type Audio = {
  /** Creates the context and chain on the first call, resumes a suspended context afterwards. */
  init(): void;
  /** Plays an effect at `gain` × its volume (1 by default). Silent before init, while muted, or on any error. */
  play(name: SoundName, gain?: number): void;
  setMode(mode: MusicMode): void;
  setLowHp(on: boolean): void;
  /** Ramps the master gain to 0 or 0.55; the caller saves the setting. */
  setMute(muted: boolean): void;
  readonly ready: boolean;
};

export type AudioDeps = {
  /** The AudioContext constructor; defaults to `AudioContext` or `webkitAudioContext`, none in Node. */
  AudioContext?: (new () => AudioContext) | null;
  /** True while the page is hidden (the scheduler adds no bells or heartbeats). */
  hidden?: () => boolean;
  setInterval?: (fn: () => void, ms: number) => unknown;
  random?: () => number;
};

export const MASTER_GAIN = 0.55;
const TICK_MS = 60;
const BELLS = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
/** Drone level, filter frequency, and second-oscillator pitch per mode (art-style "Audio"). */
const DRONE_LEVEL: Readonly<Record<MusicMode, number>> = { off: 0, menu: 0.025, explore: 0.04, combat: 0.06, boss: 0.08, boss2: 0.1 };
const DRONE_FILTER: Readonly<Record<MusicMode, number>> = { off: 220, menu: 220, explore: 220, combat: 380, boss: 520, boss2: 820 };
const DRONE_SECOND: Readonly<Record<MusicMode, number>> = { off: 55.4, menu: 55.4, explore: 55.4, combat: 55.4, boss: 58.3, boss2: 61.7 };

/** Seconds between heartbeats in a mode (0 = none); low HP on the map beats every 0.9 s. */
export function heartbeatGap(mode: MusicMode, lowHp: boolean): number {
  return mode === 'boss2' ? 0.38 : mode === 'boss' ? 0.5 : mode === 'combat' ? 0.78 : lowHp && mode === 'explore' ? 0.9 : 0;
}

type ToneOpts = { type?: OscillatorType; f?: number; f2?: number; dur?: number; vol?: number; at?: number; attack?: number; bus?: AudioNode };
type NoiseOpts = { dur?: number; vol?: number; at?: number; type?: BiquadFilterType; f?: number; f2?: number; q?: number };

function defaultContext(): (new () => AudioContext) | null {
  const g = globalThis as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Creates the audio engine; `getMuted` reads the saved mute setting. */
export function createAudio(getMuted: () => boolean, deps: AudioDeps = {}): Audio {
  const AC = deps.AudioContext === undefined ? defaultContext() : deps.AudioContext;
  const hidden = deps.hidden ?? (() => typeof document !== 'undefined' && document.hidden);
  const every = deps.setInterval ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
  const rnd = deps.random ?? Math.random;

  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let drone: { g: GainNode; fl: BiquadFilterNode; os: OscillatorNode[] } | null = null;
  let mode: MusicMode = 'off';
  let lowHp = false;
  let nextBell = 0;
  let nextBeat = 0;
  /** Gain multiplier for the effect being played (rest plays wisp at half gain). */
  let gainK = 1;

  function tone({ type = 'square', f = 440, f2, dur = 0.1, vol = 0.15, at = 0, attack = 0.004, bus }: ToneOpts): void {
    if (!ac || !sfxBus) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const v = bus ? vol : vol * gainK;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.15, at = 0, type = 'lowpass', f = 2000, f2, q = 1 }: NoiseOpts): void {
    if (!ac || !sfxBus || !noiseBuf) return;
    const t = ac.currentTime + at;
    const s = ac.createBufferSource();
    const fl = ac.createBiquadFilter();
    const g = ac.createGain();
    s.buffer = noiseBuf;
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol * gainK, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(sfxBus);
    s.start(t, rnd() * 0.5);
    s.stop(t + dur + 0.05);
  }

  const arp = (notes: readonly number[], gap: number, o: { dur?: number; vol?: number; type?: OscillatorType } = {}) =>
    notes.forEach((f, i) => tone({ f, at: i * gap, dur: o.dur ?? 0.14, vol: o.vol ?? 0.06, type: o.type ?? 'square' }));

  /** The prototype's effects, note for note. */
  const P: Readonly<Record<SoundName, () => void>> = {
    ui: () => tone({ f: 880, dur: 0.04, vol: 0.04 }),
    charge: () => {
      tone({ type: 'sawtooth', f: 110, f2: 880, dur: 0.9, vol: 0.05, attack: 0.05 });
      noise({ dur: 0.8, vol: 0.05, type: 'bandpass', f: 400, f2: 3000, q: 3 });
    },
    stutter: () => [0, 0.07, 0.14].forEach((at) => tone({ f: 300, dur: 0.03, vol: 0.05, at })),
    relic: () => {
      arp([783.99, 987.77, 1174.66, 1567.98, 1975.53], 0.06, { type: 'sine', vol: 0.07, dur: 0.5 });
      noise({ dur: 0.5, vol: 0.05, type: 'highpass', f: 5000 });
    },
    phase: () => {
      tone({ type: 'sawtooth', f: 90, f2: 30, dur: 1.6, vol: 0.18 });
      tone({ type: 'sawtooth', f: 135, f2: 45, dur: 1.4, vol: 0.12 });
      noise({ dur: 1.5, vol: 0.25, f: 700, f2: 70 });
      arp([523.25, 466.16, 392, 311.13], 0.12, { type: 'square', vol: 0.06, dur: 0.25 });
    },
    rise: () => {
      noise({ dur: 1.3, vol: 0.09, type: 'bandpass', f: 200, f2: 3200, q: 2 });
      arp([130.81, 164.81, 196, 261.63, 329.63, 392], 0.15, { type: 'triangle', vol: 0.06, dur: 0.5 });
    },
    step: () => {
      tone({ type: 'triangle', f: 150 + rnd() * 40, f2: 80, dur: 0.06, vol: 0.07 });
      noise({ dur: 0.04, vol: 0.03, type: 'highpass', f: 2500 });
    },
    wisp: () => {
      arp([880, 1174.7, 1568], 0.05, { type: 'sine', vol: 0.08, dur: 0.3 });
      noise({ dur: 0.25, vol: 0.03, type: 'highpass', f: 6000 });
    },
    chest: () => {
      arp([523.25, 659.25, 783.99, 1046.5], 0.05, { vol: 0.06 });
      tone({ f: 1568, f2: 2093, dur: 0.12, vol: 0.05, at: 0.22 });
      tone({ f: 2093, dur: 0.18, vol: 0.04, at: 0.3, type: 'triangle' });
    },
    encounter: () => {
      tone({ type: 'sawtooth', f: 220, f2: 110, dur: 0.28, vol: 0.09 });
      tone({ type: 'square', f: 330, f2: 165, dur: 0.2, vol: 0.05, at: 0.05 });
      noise({ dur: 0.3, vol: 0.08, f: 900, f2: 200 });
    },
    boss: () => {
      tone({ type: 'sawtooth', f: 110, f2: 40, dur: 1.3, vol: 0.16 });
      tone({ type: 'sawtooth', f: 116, f2: 42, dur: 1.3, vol: 0.12 });
      tone({ type: 'square', f: 55, dur: 1.2, vol: 0.08 });
      noise({ dur: 1.4, vol: 0.18, f: 400, f2: 60 });
    },
    windup: () => tone({ type: 'triangle', f: 300, f2: 900, dur: 0.18, vol: 0.05 }),
    warn: () => {
      tone({ f: 523, dur: 0.05, vol: 0.05 });
      tone({ f: 523, dur: 0.05, vol: 0.05, at: 0.09 });
    },
    hit: () => {
      noise({ dur: 0.12, vol: 0.22, type: 'bandpass', f: 1300, q: 0.8 });
      tone({ f: 220, f2: 60, dur: 0.12, vol: 0.12 });
    },
    crit: () => {
      noise({ dur: 0.18, vol: 0.3, type: 'bandpass', f: 1800, q: 0.7 });
      tone({ type: 'sine', f: 95, f2: 35, dur: 0.35, vol: 0.35 });
      tone({ type: 'sine', f: 1320, f2: 2640, dur: 0.22, vol: 0.09, at: 0.02 });
      noise({ dur: 0.3, vol: 0.12, type: 'highpass', f: 5000, at: 0.03 });
    },
    glance: () => {
      noise({ dur: 0.09, vol: 0.12, f: 700 });
      tone({ type: 'triangle', f: 160, f2: 110, dur: 0.08, vol: 0.06 });
    },
    block: () => {
      tone({ f: 1046, dur: 0.05, vol: 0.06 });
      tone({ type: 'triangle', f: 1975, f2: 1318, dur: 0.22, vol: 0.08 });
      noise({ dur: 0.08, vol: 0.1, type: 'highpass', f: 3500 });
    },
    dodge: () => {
      noise({ dur: 0.28, vol: 0.2, type: 'bandpass', f: 400, f2: 3500, q: 1.5 });
      tone({ type: 'sine', f: 1568, dur: 0.25, vol: 0.09, at: 0.08 });
      tone({ type: 'sine', f: 2093, dur: 0.35, vol: 0.08, at: 0.14 });
    },
    hurt: () => {
      tone({ type: 'sawtooth', f: 320, f2: 70, dur: 0.26, vol: 0.14 });
      noise({ dur: 0.22, vol: 0.2, f: 1200, f2: 300 });
    },
    death: () => {
      tone({ f: 440, f2: 55, dur: 0.55, vol: 0.09 });
      noise({ dur: 0.5, vol: 0.12, f: 3000, f2: 200 });
      arp([392, 311, 262], 0.07, { type: 'triangle', vol: 0.05, dur: 0.2 });
    },
    levelup: () => {
      arp([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.07, { vol: 0.06, dur: 0.18 });
      tone({ type: 'triangle', f: 261.6, dur: 0.6, vol: 0.08, at: 0.28 });
    },
    shard: () => arp([1046.5, 1568, 2093, 2637], 0.04, { type: 'sine', vol: 0.07, dur: 0.4 }),
    ward: () => {
      noise({ dur: 0.6, vol: 0.22, type: 'highpass', f: 1500, f2: 6000 });
      arp([2093, 1568, 2637, 2093, 3136], 0.04, { type: 'sine', vol: 0.06, dur: 0.3 });
    },
    win: () => {
      (
        [
          [523.25, 0],
          [659.25, 0.15],
          [783.99, 0.3],
          [1046.5, 0.45],
          [783.99, 0.75],
          [1046.5, 0.9],
        ] as const
      ).forEach(([f, at]) => tone({ f, at, dur: at > 0.8 ? 0.7 : 0.14, vol: 0.07 }));
      tone({ type: 'triangle', f: 130.8, dur: 1.4, vol: 0.1, at: 0.45 });
    },
    lose: () => {
      (
        [
          [392, 0],
          [369.99, 0.3],
          [349.23, 0.6],
          [329.63, 0.9],
        ] as const
      ).forEach(([f, at]) => tone({ type: 'triangle', f, f2: f * 0.97, at, dur: at > 0.8 ? 1.2 : 0.3, vol: 0.09 }));
      tone({ type: 'sine', f: 65, dur: 2, vol: 0.12, at: 0.9 });
    },
  };

  function startDrone(): void {
    const c = ac;
    if (!c || !musicBus) return;
    const g = c.createGain();
    g.gain.value = 0;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 220;
    fl.Q.value = 4;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.08;
    lg.gain.value = 90;
    lfo.connect(lg);
    lg.connect(fl.frequency);
    lfo.start();
    const os = [55, 55.4, 82.4].map((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.connect(fl);
      o.start();
      return o;
    });
    fl.connect(g);
    g.connect(musicBus);
    drone = { g, fl, os };
  }

  function applyMode(): void {
    if (!ac || !drone) return;
    const t = ac.currentTime;
    drone.g.gain.setTargetAtTime(DRONE_LEVEL[mode], t, 0.6);
    drone.fl.frequency.setTargetAtTime(DRONE_FILTER[mode], t, 0.5);
    drone.os[1]?.frequency.setTargetAtTime(DRONE_SECOND[mode], t, 0.5);
  }

  /** The 60 ms scheduler: graveyard bells in menu and explore, the heartbeat in fights and at low HP. */
  function tick(): void {
    try {
      if (!ac || !musicBus || getMuted() || hidden() || mode === 'off') return;
      const t = ac.currentTime;
      if ((mode === 'explore' || mode === 'menu') && t >= nextBell) {
        const f = BELLS[Math.floor(rnd() * BELLS.length)]! * (rnd() < 0.3 ? 2 : 1);
        tone({ type: 'triangle', f, dur: 1.6, vol: mode === 'menu' ? 0.025 : 0.035, attack: 0.02, bus: musicBus });
        nextBell = t + 1.6 + rnd() * 1.8;
      }
      const gap = heartbeatGap(mode, lowHp);
      if (gap && t >= nextBeat) {
        tone({ type: 'sine', f: 62, f2: 40, dur: 0.16, vol: 0.16, bus: musicBus });
        tone({ type: 'sine', f: 58, f2: 38, dur: 0.14, vol: 0.11, at: 0.2, bus: musicBus });
        nextBeat = t + gap;
      }
    } catch {
      // Audio never blocks the game.
    }
  }

  return {
    init(): void {
      try {
        if (ac) {
          if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
          return;
        }
        if (!AC) return;
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.connect(ac.destination);
        master = ac.createGain();
        master.gain.value = getMuted() ? 0 : MASTER_GAIN;
        master.connect(comp);
        sfxBus = ac.createGain();
        sfxBus.connect(master);
        musicBus = ac.createGain();
        musicBus.gain.value = 0.9;
        const delay = ac.createDelay(1);
        delay.delayTime.value = 0.34;
        const fb = ac.createGain();
        fb.gain.value = 0.38;
        musicBus.connect(master);
        musicBus.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
        startDrone();
        applyMode();
        every(tick, TICK_MS);
      } catch {
        ac = null;
      }
    },
    play(name: SoundName, gain = 1): void {
      if (!ac || getMuted()) return;
      try {
        gainK = gain;
        P[name]();
      } catch {
        // Audio never blocks the game.
      } finally {
        gainK = 1;
      }
    },
    setMode(m: MusicMode): void {
      if (m === mode) return;
      mode = m;
      try {
        applyMode();
      } catch {
        // ignore
      }
    },
    setLowHp(on: boolean): void {
      lowHp = on;
    },
    setMute(m: boolean): void {
      try {
        if (ac && master) master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN, ac.currentTime, 0.05);
      } catch {
        // ignore
      }
    },
    get ready() {
      return ac !== null;
    },
  };
}
