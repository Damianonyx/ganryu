import { SOUND_EVENTS, type SoundEvent } from "./script.ts";

/**
 * Temporary procedural sound design for the cinematic (Web Audio, no files).
 * Placeholder for a composed score, recorded voice-over, and foley.
 *
 * Browsers only allow audio after a user gesture. `unlock()` must be called
 * from a pointer/key handler; until then the film plays silently and the UI
 * offers a "Sound" button. Ambient beds are evaluated from film time each
 * frame, so enabling sound mid-film joins at the right mood.
 */

type Beds = { warm: number; tension: number; fire: number; muffle: number; wind: number; resolve: number };

const smooth = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const window01 = (t: number, a: number, b: number, c: number, d: number) => smooth(a, b, t) * (1 - smooth(c, d, t));

export function bedLevels(t: number): Beds {
  return {
    warm: window01(t, 0, 1.5, 8.8, 9.4),
    tension: window01(t, 9, 11, 38, 38.4) + window01(t, 40, 41, 48.5, 49.2) * 0.5,
    fire: window01(t, 14.5, 16, 38, 38.3) * 0.9 + window01(t, 39.4, 40.2, 43.2, 43.4),
    muffle: window01(t, 43.4, 44.4, 48.4, 49.2),
    wind: window01(t, 49, 50.5, 57.5, 58.5) + window01(t, 61, 61.5, 67, 67.6) * 0.4,
    resolve: window01(t, 58.5, 62, 72.8, 73.2) * (0.5 + 0.5 * smooth(62, 70, t)),
  };
}

export class CinematicScore {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private beds: Partial<Record<keyof Beds, GainNode>> = {};
  private stops: Array<() => void> = [];
  private lastT = -1;
  private muted = false;
  private paused = false;
  private disposed = false;

  get state(): "locked" | "running" | "suspended" {
    if (!this.ctx) return "locked";
    return this.ctx.state === "running" ? "running" : "suspended";
  }

  /** Call from a user gesture. Returns true if audio is running. */
  unlock(): boolean {
    if (this.disposed) return false;
    try {
      if (!this.ctx) {
        const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return false;
        this.ctx = new C();
        this.build();
      }
      void this.ctx.resume();
      return this.ctx.state === "running";
    } catch {
      return false;
    }
  }

  setMuted(v: boolean) {
    this.muted = v;
    this.applyMaster();
  }

  setPaused(v: boolean) {
    this.paused = v;
    this.applyMaster();
  }

  private applyMaster() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : 0.5, this.ctx.currentTime, 0.06);
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.applyMaster();

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const bed = (name: keyof Beds, make: (out: GainNode) => void) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master!);
      make(g);
      this.beds[name] = g;
    };
    const osc = (out: AudioNode, type: OscillatorType, f: number, gain: number, detune = 0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      g.gain.value = gain;
      o.connect(g).connect(out);
      o.start();
      this.stops.push(() => o.stop());
    };
    const noiseLoop = (out: AudioNode, type: BiquadFilterType, f: number, q: number, gain: number) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = type;
      filt.frequency.value = f;
      filt.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      s.connect(filt).connect(g).connect(out);
      s.start();
      this.stops.push(() => s.stop());
      return filt;
    };

    // Warm evening: open fifth with a soft third, plus a breath of air.
    bed("warm", (out) => {
      osc(out, "triangle", 146.8, 0.05);
      osc(out, "triangle", 220, 0.035, 4);
      osc(out, "sine", 369.9, 0.018, -3);
      noiseLoop(out, "bandpass", 3200, 0.7, 0.01);
    });
    // Threat: low cluster with slow beating.
    bed("tension", (out) => {
      osc(out, "sawtooth", 55, 0.025);
      osc(out, "sawtooth", 58.3, 0.02);
      osc(out, "sine", 41.2, 0.08);
    });
    // Fire: crackle-ish band-limited noise with tremolo.
    bed("fire", (out) => {
      const trem = ctx.createGain();
      trem.gain.value = 0.6;
      trem.connect(out);
      noiseLoop(trem, "lowpass", 900, 0.5, 0.12);
      noiseLoop(trem, "highpass", 2500, 0.4, 0.03);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 7.3;
      lg.gain.value = 0.35;
      lfo.connect(lg).connect(trem.gain);
      lfo.start();
      this.stops.push(() => lfo.stop());
    });
    // Buried: everything heard through stone.
    bed("muffle", (out) => {
      noiseLoop(out, "lowpass", 260, 0.6, 0.12);
      osc(out, "sine", 38, 0.05);
    });
    bed("wind", (out) => {
      const f = noiseLoop(out, "bandpass", 500, 1.4, 0.09);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.13;
      lg.gain.value = 220;
      lfo.connect(lg).connect(f.frequency);
      lfo.start();
      this.stops.push(() => lfo.stop());
    });
    // Resolve: minor drone that thickens toward the hunt.
    bed("resolve", (out) => {
      osc(out, "triangle", 73.4, 0.06);
      osc(out, "triangle", 110, 0.035, 3);
      osc(out, "sine", 174.6, 0.02);
    });
  }

  /** Advance to film time `t`; plays events crossed since the last update. */
  update(t: number) {
    if (!this.ctx || this.disposed) {
      this.lastT = t;
      return;
    }
    const now = this.ctx.currentTime;
    const lv = bedLevels(t);
    for (const k of Object.keys(lv) as Array<keyof Beds>) this.beds[k]?.gain.setTargetAtTime(lv[k], now, 0.25);
    const prev = this.lastT;
    this.lastT = t;
    if (this.paused || this.muted) return;
    // A large jump means a seek; do not fire every skipped sound at once.
    if (prev < 0 || t < prev || t - prev > 0.5) return;
    for (const e of SOUND_EVENTS) if (e.at > prev && e.at <= t) this.play(e.sound);
  }

  private hit(opts: { f?: number; f2?: number; type?: OscillatorType; dur: number; gain: number; noise?: { type: BiquadFilterType; f: number; q?: number; gain: number }; delay?: number }) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    if (opts.f) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = opts.type ?? "sine";
      o.frequency.setValueAtTime(opts.f, t0);
      if (opts.f2) o.frequency.exponentialRampToValueAtTime(opts.f2, t0 + opts.dur);
      g.gain.setValueAtTime(opts.gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + opts.dur + 0.05);
    }
    if (opts.noise && this.noise) {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const filt = ctx.createBiquadFilter();
      filt.type = opts.noise.type;
      filt.frequency.value = opts.noise.f;
      filt.Q.value = opts.noise.q ?? 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(opts.noise.gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
      s.connect(filt).connect(g).connect(this.master!);
      s.start(t0, Math.random());
      s.stop(t0 + opts.dur + 0.05);
    }
  }

  private play(sound: SoundEvent["sound"]) {
    switch (sound) {
      case "bell":
        // Inharmonic partials of a temple bell.
        for (const [f, g] of [[196, 0.22], [466, 0.1], [742, 0.06], [1093, 0.03]] as const) this.hit({ f, dur: 3.4, gain: g });
        break;
      case "arrow":
        this.hit({ dur: 0.35, gain: 0.25, noise: { type: "bandpass", f: 2400, q: 4, gain: 0.25 } });
        break;
      case "whoosh":
        this.hit({ dur: 1.4, gain: 0.3, noise: { type: "lowpass", f: 700, gain: 0.35 }, f: 90, f2: 40 });
        break;
      case "crash":
      case "door":
        this.hit({ f: 70, f2: 30, dur: 0.9, gain: 0.6, noise: { type: "lowpass", f: 1400, gain: 0.7 } });
        this.hit({ dur: 0.5, gain: 0.2, noise: { type: "bandpass", f: 3000, q: 1.5, gain: 0.25 }, delay: 0.08 });
        break;
      case "beam":
        this.hit({ f: 55, f2: 24, dur: 1.6, gain: 0.7, noise: { type: "lowpass", f: 600, gain: 0.8 } });
        break;
      case "steel":
        this.hit({ f: 2600, f2: 1800, type: "triangle", dur: 0.7, gain: 0.12, noise: { type: "highpass", f: 5000, gain: 0.12 } });
        break;
      case "draw":
        this.hit({ dur: 0.6, gain: 0.1, noise: { type: "bandpass", f: 4200, q: 6, gain: 0.14 }, f: 1500, f2: 3200, type: "sine" });
        break;
      case "thud":
        this.hit({ f: 90, f2: 45, dur: 0.35, gain: 0.45 });
        break;
      case "heartbeat":
        this.hit({ f: 60, f2: 40, dur: 0.18, gain: 0.5 });
        this.hit({ f: 55, f2: 38, dur: 0.2, gain: 0.35, delay: 0.22 });
        break;
      case "swing":
        this.hit({ dur: 0.3, gain: 0.2, noise: { type: "bandpass", f: 1200, q: 2, gain: 0.2 } });
        break;
      case "knock":
        this.hit({ f: 400, f2: 220, type: "square", dur: 0.12, gain: 0.12 });
        break;
      case "step":
        this.hit({ f: 80, f2: 50, dur: 0.22, gain: 0.3, noise: { type: "lowpass", f: 400, gain: 0.2 } });
        break;
      case "taiko":
        this.hit({ f: 80, f2: 38, dur: 1.8, gain: 0.8, noise: { type: "lowpass", f: 300, gain: 0.4 } });
        break;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.stops) {
      try {
        s();
      } catch {
        /* already stopped */
      }
    }
    this.stops = [];
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
