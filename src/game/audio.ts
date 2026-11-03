export class AudioBus {
  ctx: AudioContext | null = null;
  muted = false;
  private master: GainNode | null = null;
  private wind: OscillatorNode | null = null;
  private windG: GainNode | null = null;

  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.22;
    this.master.connect(this.ctx.destination);
    this.startWind();
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v ? 0 : 0.22, this.ctx.currentTime, 0.05);
  }

  private startWind() {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = 70;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(this.master);
    o.start();
    this.wind = o;
    this.windG = g;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  slash() {
    this.tone(420, 0.12, "sawtooth", 0.08, -220);
    this.tone(1200, 0.06, "square", 0.04, -800);
  }
  clash() {
    this.tone(180, 0.18, "square", 0.16, -80);
    this.tone(90, 0.22, "sawtooth", 0.1, 40);
  }
  hit() {
    this.tone(90, 0.16, "sine", 0.18, -40);
  }
  parry() {
    this.tone(880, 0.1, "triangle", 0.1, 200);
  }
  fold() {
    this.tone(220, 0.4, "sine", 0.1, -120);
    this.tone(55, 0.6, "triangle", 0.08, 20);
  }
  win() {
    this.tone(440, 0.2, "triangle", 0.1, 80);
    this.tone(660, 0.28, "sine", 0.08, 40);
  }
  lose() {
    this.tone(160, 0.5, "sawtooth", 0.1, -100);
  }
  tick(t: number) {
    if (this.wind && this.ctx) this.wind.frequency.setTargetAtTime(62 + Math.sin(t * 0.3) * 8, this.ctx.currentTime, 0.2);
  }
}
