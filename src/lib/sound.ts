// مؤثرات صوتية مولّدة بالكامل عبر Web Audio (بدون ملفات صوتية وبدون موسيقى)

import type { SoundId } from './types';

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  t: number;
  dur: number;
  type?: Wave;
  gain?: number;
  attack?: number;
  freqEnd?: number;
  detune?: number;
  lowpass?: number;
  dest?: AudioNode;
}

interface NoiseOpts {
  t: number;
  dur: number;
  gain?: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  volume = 0.8;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(comp);
      comp.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noiseBuf = buf;
    }
    return this.ctx;
  }

  /** يجب استدعاؤها بعد تفاعل المستخدم (سياسة المتصفحات للتشغيل التلقائي) */
  async unlock(): Promise<boolean> {
    const ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  configure(opts: { enabled?: boolean; volume?: number }): void {
    if (opts.enabled !== undefined) this.enabled = opts.enabled;
    if (opts.volume !== undefined) {
      this.volume = Math.max(0, Math.min(1, opts.volume));
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  play(id: SoundId): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const fn = SOUNDS[id];
    if (fn) fn(this, ctx.currentTime + 0.02);
  }

  // ───── لبنات بناء الصوت ─────

  tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, o.t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), o.t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain ?? 0.2;
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(peak, o.t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest ?? this.master!);
    osc.start(o.t);
    osc.stop(o.t + o.dur + 0.05);
  }

  noise(o: NoiseOpts): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1000, o.t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(peak, o.t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(o.t, Math.random());
    src.stop(o.t + o.dur + 0.05);
  }

  kick(t: number, gain = 0.6, from = 150, to = 40, dur = 0.4): void {
    this.tone({ freq: from, freqEnd: to, t, dur, gain, type: 'sine', attack: 0.002 });
  }

  bell(t: number, freq: number, gain = 0.08, dur = 1.2): void {
    this.tone({ freq, t, dur, gain, type: 'sine', attack: 0.003 });
    this.tone({ freq: freq * 2.01, t, dur: dur * 0.6, gain: gain * 0.4, type: 'sine', attack: 0.003 });
    this.tone({ freq: freq * 3.03, t, dur: dur * 0.35, gain: gain * 0.2, type: 'sine', attack: 0.003 });
  }

  crash(t: number, gain = 0.25, dur = 1.8): void {
    this.noise({ t, dur, gain, filter: 'highpass', freq: 3500, q: 0.7, attack: 0.002 });
    this.noise({ t, dur: dur * 0.6, gain: gain * 0.6, filter: 'bandpass', freq: 7000, q: 0.8, attack: 0.002 });
  }

  applause(t: number, dur = 4, density = 45): void {
    const n = Math.floor(dur * density);
    for (let i = 0; i < n; i++) {
      const p = Math.random();
      // كثافة تتصاعد ثم تهدأ
      const at = t + dur * (p < 0.7 ? Math.sqrt(Math.random()) * 0.75 : 0.75 + Math.random() * 0.25);
      const fade = at - t > dur * 0.7 ? 1 - (at - t - dur * 0.7) / (dur * 0.3) : 1;
      this.noise({
        t: at,
        dur: 0.025 + Math.random() * 0.03,
        gain: (0.05 + Math.random() * 0.08) * Math.max(0.15, fade),
        filter: 'bandpass',
        freq: 900 + Math.random() * 1800,
        q: 1.3,
        attack: 0.001,
      });
    }
    this.noise({ t, dur, gain: 0.035, filter: 'bandpass', freq: 1500, q: 0.4, attack: 0.4 });
  }
}

type SoundFn = (e: SoundEngine, t: number) => void;

const ARP = [523.25, 659.25, 783.99, 1046.5];

const SOUNDS: Record<SoundId, SoundFn> = {
  select: (e, t) => {
    e.tone({ freq: 660, freqEnd: 990, t, dur: 0.08, type: 'square', gain: 0.07, lowpass: 3000 });
    e.tone({ freq: 1320, t: t + 0.03, dur: 0.12, gain: 0.06 });
  },
  lockin: (e, t) => {
    e.kick(t, 0.35, 120, 50, 0.2);
    e.tone({ freq: 523, t, dur: 0.12, type: 'triangle', gain: 0.12 });
    e.tone({ freq: 784, t: t + 0.07, dur: 0.25, type: 'triangle', gain: 0.12 });
  },
  question: (e, t) => {
    e.noise({ t, dur: 0.45, gain: 0.12, filter: 'bandpass', freq: 300, freqEnd: 3000, q: 1.2, attack: 0.25 });
    e.tone({ freq: 98, t: t + 0.25, dur: 0.35, type: 'sawtooth', gain: 0.18, lowpass: 700 });
    e.tone({ freq: 147, t: t + 0.45, dur: 0.9, type: 'sawtooth', gain: 0.2, lowpass: 900 });
    e.kick(t + 0.45, 0.45);
    e.tone({ freq: 1568, freqEnd: 2093, t: t + 0.45, dur: 0.7, gain: 0.04 });
  },
  reveal: (e, t) => {
    e.noise({ t, dur: 0.4, gain: 0.12, filter: 'bandpass', freq: 500, freqEnd: 4000, q: 1, attack: 0.2 });
    e.bell(t + 0.3, 1046.5, 0.07);
    e.bell(t + 0.3, 1568, 0.04);
  },
  tick: (e, t) => {
    e.tone({ freq: 1000, t, dur: 0.05, gain: 0.14 });
    e.noise({ t, dur: 0.02, gain: 0.05, filter: 'highpass', freq: 5000 });
  },
  tickUrgent: (e, t) => {
    e.tone({ freq: 1400, t, dur: 0.06, type: 'square', gain: 0.08, lowpass: 4000 });
    e.tone({ freq: 700, t, dur: 0.1, gain: 0.12 });
  },
  timeout: (e, t) => {
    e.tone({ freq: 140, t, dur: 1.0, type: 'sawtooth', gain: 0.22, lowpass: 1200, attack: 0.01 });
    e.tone({ freq: 147, t, dur: 1.0, type: 'sawtooth', gain: 0.22, lowpass: 1200, attack: 0.01 });
    e.tone({ freq: 70, t, dur: 1.0, type: 'square', gain: 0.1, lowpass: 400, attack: 0.01 });
  },
  correct: (e, t) => {
    ARP.forEach((f, i) => e.tone({ freq: f, t: t + i * 0.08, dur: i === 3 ? 0.7 : 0.18, type: 'triangle', gain: 0.14 }));
    e.bell(t + 0.32, 2093, 0.05, 0.8);
    e.kick(t, 0.25, 200, 80, 0.15);
  },
  wrong: (e, t) => {
    e.tone({ freq: 233, freqEnd: 207, t, dur: 0.28, type: 'square', gain: 0.14, lowpass: 900 });
    e.tone({ freq: 185, freqEnd: 155, t: t + 0.3, dur: 0.5, type: 'square', gain: 0.16, lowpass: 800 });
  },
  capture: (e, t) => {
    e.kick(t, 0.65, 160, 38, 0.45);
    e.noise({ t, dur: 0.3, gain: 0.25, filter: 'lowpass', freq: 900, q: 0.7, attack: 0.002 });
    e.noise({ t: t - 0.25, dur: 0.28, gain: 0.08, filter: 'bandpass', freq: 400, freqEnd: 3000, attack: 0.2 });
    e.bell(t + 0.02, 783.99, 0.07, 0.9);
    e.bell(t + 0.02, 1174.66, 0.05, 0.9);
  },
  steal: (e, t) => {
    e.noise({ t, dur: 0.35, gain: 0.22, filter: 'bandpass', freq: 3500, freqEnd: 300, q: 1.4, attack: 0.02 });
    const hit = t + 0.3;
    e.kick(hit, 0.7, 130, 35, 0.5);
    [523, 1380, 2120, 3010].forEach((f, i) => e.tone({ freq: f, t: hit, dur: 0.9 - i * 0.15, gain: 0.07 - i * 0.012, attack: 0.001 }));
    e.tone({ freq: 392, freqEnd: 196, t: hit + 0.1, dur: 0.6, type: 'sawtooth', gain: 0.08, lowpass: 1500 });
  },
  golden: (e, t) => {
    for (let i = 0; i < 12; i++) e.tone({ freq: 1800 + Math.random() * 2600, t: t + i * 0.045, dur: 0.14, gain: 0.05 });
    e.tone({ freq: 1046.5, t, dur: 1.0, type: 'triangle', gain: 0.05, attack: 0.1 });
    e.tone({ freq: 1568, t, dur: 1.0, type: 'triangle', gain: 0.04, attack: 0.1 });
  },
  crown: (e, t) => {
    e.noise({ t, dur: 0.6, gain: 0.12, filter: 'lowpass', freq: 220, q: 0.8, attack: 0.5 });
    [392, 523.25, 659.25].forEach((f) => e.tone({ freq: f, t: t + 0.5, dur: 0.22, type: 'sawtooth', gain: 0.07, lowpass: 2500 }));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => e.tone({ freq: f, t: t + 0.78, dur: 1.2, type: 'sawtooth', gain: 0.06, lowpass: 3000, attack: 0.02 }));
    e.kick(t + 0.78, 0.6);
    e.crash(t + 0.78, 0.18, 1.6);
  },
  remontada: (e, t) => {
    e.tone({ freq: 150, freqEnd: 1200, t, dur: 1.3, type: 'sawtooth', gain: 0.1, lowpass: 5000, attack: 1.1 });
    e.noise({ t, dur: 1.3, gain: 0.18, filter: 'bandpass', freq: 400, freqEnd: 6000, q: 0.8, attack: 1.2 });
    const b = t + 1.3;
    e.kick(b, 0.85, 120, 28, 0.9);
    e.crash(b, 0.3, 2.2);
    [261.63, 329.63, 392, 523.25].forEach((f) => e.tone({ freq: f, t: b, dur: 1.6, type: 'sawtooth', gain: 0.05, lowpass: 2500, attack: 0.01 }));
    e.applause(b + 0.2, 3, 40);
  },
  event: (e, t) => {
    for (let i = 0; i < 4; i++) e.tone({ freq: i % 2 ? 660 : 880, t: t + i * 0.16, dur: 0.15, type: 'square', gain: 0.08, lowpass: 2500 });
    e.kick(t + 0.66, 0.5);
    e.bell(t + 0.66, 220, 0.08, 1.4);
  },
  wheelTick: (e, t) => {
    e.tone({ freq: 1800, t, dur: 0.025, gain: 0.08 });
    e.noise({ t, dur: 0.015, gain: 0.05, filter: 'highpass', freq: 4000 });
  },
  wheelStop: (e, t) => {
    e.bell(t, 880, 0.1, 1.5);
    e.bell(t + 0.08, 1318.5, 0.07, 1.5);
    e.bell(t + 0.16, 1760, 0.05, 1.5);
  },
  drumroll: (e, t) => {
    const dur = 2.4;
    for (let x = 0; x < dur; x += 0.035) {
      const g = 0.04 + (x / dur) * 0.16;
      e.noise({ t: t + x, dur: 0.05, gain: g, filter: 'bandpass', freq: 1800, q: 0.9, attack: 0.002 });
    }
    e.kick(t + dur, 0.6);
    e.crash(t + dur, 0.25, 1.8);
  },
  applause: (e, t) => e.applause(t, 4.5, 50),
  suspense: (e, t) => {
    for (let i = 0; i < 5; i++) {
      e.kick(t + i * 0.85, 0.5, 70, 40, 0.25);
      e.kick(t + i * 0.85 + 0.22, 0.32, 65, 40, 0.25);
    }
  },
  shield: (e, t) => {
    e.tone({ freq: 220, freqEnd: 440, t, dur: 0.6, type: 'triangle', gain: 0.12, attack: 0.05 });
    e.tone({ freq: 330, freqEnd: 660, t, dur: 0.6, type: 'triangle', gain: 0.08, attack: 0.05 });
    e.noise({ t: t + 0.45, dur: 0.4, gain: 0.08, filter: 'highpass', freq: 6000, q: 0.7 });
    e.bell(t + 0.5, 1318.5, 0.05, 1);
  },
  ability: (e, t) => {
    e.tone({ freq: 600, freqEnd: 1800, t, dur: 0.45, type: 'sine', gain: 0.1, attack: 0.02 });
    for (let i = 0; i < 6; i++) e.tone({ freq: 2000 + i * 300, t: t + 0.3 + i * 0.05, dur: 0.12, gain: 0.04 });
  },
  gong: (e, t) => {
    [110, 164.3, 222.2, 262, 331].forEach((f, i) => e.tone({ freq: f, t, dur: 2.8 - i * 0.3, gain: 0.11 - i * 0.015, attack: 0.004 }));
    e.noise({ t, dur: 0.6, gain: 0.1, filter: 'lowpass', freq: 400, q: 0.6 });
  },
  winner: (e, t) => {
    e.kick(t, 0.8, 120, 30, 0.8);
    e.crash(t, 0.3, 2.4);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => e.tone({ freq: f, t: t + 0.15 + i * 0.12, dur: 1.4, type: 'sawtooth', gain: 0.045, lowpass: 3200, attack: 0.02 }));
    e.applause(t + 0.3, 6, 55);
    for (let i = 0; i < 6; i++) {
      const at = t + 0.8 + i * 0.55 + Math.random() * 0.2;
      e.kick(at, 0.25, 300, 60, 0.15);
      e.noise({ t: at + 0.05, dur: 0.6, gain: 0.06, filter: 'highpass', freq: 5000, q: 0.5 });
    }
  },
  whoosh: (e, t) => e.noise({ t, dur: 0.4, gain: 0.18, filter: 'bandpass', freq: 400, freqEnd: 2600, q: 1.1, attack: 0.15 }),
  crash: (e, t) => {
    e.kick(t, 0.5);
    e.crash(t, 0.3, 2);
  },
  bonus: (e, t) => {
    e.tone({ freq: 987.77, t, dur: 0.09, type: 'square', gain: 0.07, lowpass: 5000 });
    e.tone({ freq: 1318.5, t: t + 0.08, dur: 0.45, type: 'square', gain: 0.07, lowpass: 5000 });
  },
  penalty: (e, t) => {
    e.tone({ freq: 392, freqEnd: 262, t, dur: 0.45, type: 'triangle', gain: 0.14 });
    e.tone({ freq: 330, freqEnd: 220, t: t + 0.25, dur: 0.55, type: 'triangle', gain: 0.12 });
  },
};

export const sfx = new SoundEngine();

export const SOUNDBOARD: { id: SoundId; name: string; icon: string }[] = [
  { id: 'drumroll', name: 'طبول', icon: '🥁' },
  { id: 'suspense', name: 'تشويق', icon: '💓' },
  { id: 'applause', name: 'تصفيق', icon: '👏' },
  { id: 'correct', name: 'صح', icon: '✅' },
  { id: 'wrong', name: 'خطأ', icon: '❌' },
  { id: 'timeout', name: 'صافرة', icon: '📣' },
  { id: 'gong', name: 'غونغ', icon: '🔔' },
  { id: 'crash', name: 'ضربة', icon: '💥' },
  { id: 'whoosh', name: 'انتقال', icon: '💨' },
  { id: 'event', name: 'تنبيه', icon: '🚨' },
];
