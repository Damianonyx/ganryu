import { clamp, rand } from "./math";

export class AudioBus {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  amb: GainNode | null = null;
  muted = false;
  unlocked = false;
  private wind: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  private water: { filter: BiquadFilterNode; gain: GainNode } | null = null;

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.amb = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.amb.gain.value = 0.45;
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.startBeds();
    this.unlocked = true;
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(v ? 0 : 0.7, this.ctx.currentTime, 0.04);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private noiseBuffer() {
    if (!this.ctx) return null;
    const len = this.ctx.sampleRate * 1.4;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  private startBeds() {
    if (!this.ctx || !this.amb) return;
    const buf = this.noiseBuffer();
    if (!buf) return;

    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windF = this.ctx.createBiquadFilter();
    windF.type = "bandpass";
    windF.frequency.value = 420;
    windF.Q.value = 0.7;
    const windG = this.ctx.createGain();
    windG.gain.value = 0.22;
    windSrc.connect(windF);
    windF.connect(windG);
    windG.connect(this.amb);
    windSrc.start();
    this.wind = { filter: windF, gain: windG };

    const waterSrc = this.ctx.createBufferSource();
    waterSrc.buffer = buf;
    waterSrc.loop = true;
    waterSrc.playbackRate.value = 0.55;
    const waterF = this.ctx.createBiquadFilter();
    waterF.type = "lowpass";
    waterF.frequency.value = 380;
    const waterG = this.ctx.createGain();
    waterG.gain.value = 0.12;
    waterSrc.connect(waterF);
    waterF.connect(waterG);
    waterG.connect(this.amb);
    waterSrc.start();
    this.water = { filter: waterF, gain: waterG };
  }

  tick(t: number) {
    if (!this.ctx || !this.wind) return;
    const now = this.ctx.currentTime;
    const f = 360 + Math.sin(t * 0.17) * 90 + Math.sin(t * 0.07) * 40;
    this.wind.filter.frequency.setTargetAtTime(f, now, 0.2);
  }

  clash(intensity = 1) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const k = clamp(intensity, 0.4, 1.6);

    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(140 + rand(0, 40), t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.18 * k, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(og);
    og.connect(this.sfx);
    osc.start(t);
    osc.stop(t + 0.16);

    const ring = this.ctx.createOscillator();
    ring.type = "sawtooth";
    ring.frequency.setValueAtTime(1200 + rand(-200, 280), t);
    ring.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    const rg = this.ctx.createGain();
    rg.gain.setValueAtTime(0.07 * k, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 700;
    ring.connect(hp);
    hp.connect(rg);
    rg.connect(this.sfx);
    ring.start(t);
    ring.stop(t + 0.22);

    this.noiseBurst(0.08 * k, 1800, 0.09);
  }

  whoosh(intensity = 1) {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const buf = this.noiseBuffer();
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1.4 + rand(0, 0.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * intensity, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + 0.2);
  }

  step() {
    this.noiseBurst(0.05, 220, 0.07, 0.7);
  }

  splash() {
    this.noiseBurst(0.16, 500, 0.28, 0.4);
    this.noiseBurst(0.1, 1400, 0.18, 1.1);
  }

  land() {
    this.noiseBurst(0.08, 160, 0.1, 0.5);
  }

  private noiseBurst(gain: number, freq: number, dur: number, rate = 1) {
    if (!this.ctx || !this.sfx) return;
    const buf = this.noiseBuffer();
    if (!buf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate + rand(-0.08, 0.08);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
