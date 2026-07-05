// Synth-only race audio (no asset files). A single WebAudio graph: an engine hum whose pitch and
// volume track the car's velocity, plus one-shot crash / cash / pot-tick sounds. The context is
// created lazily on the first "Watch a race" tap so it satisfies the autoplay gesture policy.
// Honors a persisted mute toggle and prefers-reduced-motion (muted by default under reduced motion).

const MUTE_KEY = 'comborace.muted';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function initialMuted(): boolean {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(MUTE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  }
  return prefersReducedMotion();
}

type Listener = (muted: boolean) => void;

class RaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private muted = initialMuted();
  private started = false;
  private readonly listeners = new Set<Listener>();

  isMuted(): boolean {
    return this.muted;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  toggleMuted(): void {
    this.setMuted(!this.muted);
  }

  setMuted(next: boolean): void {
    this.muted = next;
    try {
      localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    } catch {
      // storage unavailable; keep the in-memory value
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(next ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    for (const fn of this.listeners) fn(next);
  }

  // Called from the user gesture that starts a race. Builds the graph once and resumes the context.
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
      }
      void this.ctx.resume();
      if (!this.started) this.startEngine();
    } catch {
      // audio unavailable; stay silent
    }
  }

  private startEngine(): void {
    if (!this.ctx || !this.master) return;
    this.started = true;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 70;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  // speed in [0,1]: how fast the tracked car is climbing. alive false idles the hum toward silence.
  setEngine(speed: number, alive: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const s = Math.max(0, Math.min(1, speed));
    const now = this.ctx.currentTime;
    const targetFreq = 62 + s * 84;
    const targetGain = alive ? 0.015 + s * 0.05 : 0;
    const targetCut = 360 + s * 900;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.12);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.engineFilter.frequency.setTargetAtTime(targetCut, now, 0.12);
  }

  private blip(freq: number, at: number, dur: number, type: OscillatorType, peak: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  crash(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    // Low thud: a sine dropping in pitch.
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.55);
    // Noise burst for the impact texture.
    const len = Math.floor(this.ctx.sampleRate * 0.35);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 1200;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(this.master);
    noise.start(now);
  }

  cash(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.blip(f, now + i * 0.085, 0.22, 'triangle', 0.28));
  }

  potTick(): void {
    if (this.muted || !this.ctx) return;
    this.blip(1320, this.ctx.currentTime, 0.05, 'square', 0.04);
  }
}

export const raceAudio = new RaceAudio();

export function unlockRaceAudio(): void {
  raceAudio.unlock();
}
