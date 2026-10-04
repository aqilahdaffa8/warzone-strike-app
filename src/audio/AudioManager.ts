/**
 * AudioManager — fully procedural SFX + adaptive BGM using the Web Audio API.
 * No external audio files are required (see public/assets/CREDITS.md).
 *
 * The AudioContext is created lazily on the first user gesture (browser
 * autoplay policy). Every public method is a safe no-op until then.
 */

export type MusicMode = 'off' | 'calm' | 'combat' | 'boss';
export type RifleKind = 'akm' | 'm4';
export type ReloadKind = 'sniper' | 'akm' | 'm4' | 'bazooka';
export type ExplosionKind = 'grenade' | 'rocket';

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  reverb: ConvolverNode;
  noise: AudioBuffer;
  droneGain: GainNode;
  droneFilter: BiquadFilterNode;
  droneOscs: OscillatorNode[];
}

interface OutOptions {
  at?: Vec3Like;
  volume?: number;
  reverb?: number;
  maxDist?: number;
}

interface NoiseOptions {
  dur: number;
  f0: number;
  f1?: number;
  type?: BiquadFilterType;
  q?: number;
  peak: number;
  attack?: number;
}

interface ToneOptions {
  type: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  peak: number;
  attack?: number;
  lp?: number;
}

interface VoiceOptions {
  f0: number;
  f1: number;
  dur: number;
  peak: number;
  formant0: number;
  formant1: number;
  vibratoHz?: number;
}

const MUTE_STORAGE_KEY = 'warzone.audio.muted';
const DEFAULT_MAX_HEARING_DISTANCE = 80;
const MUSIC_LEVEL = 0.5;
const MUSIC_DUCKED_LEVEL = 0.12;

const MODE_BPM: Record<Exclude<MusicMode, 'off'>, number> = {
  calm: 72,
  combat: 124,
  boss: 148,
};

// Semitone offsets from A1 (55 Hz) for each bar of a 4-bar loop.
const PROGRESSION_COMBAT = [0, 0, -4, -2];
const PROGRESSION_BOSS = [0, 1, 0, -2];
const BOSS_GALLOP = [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1];
const BOSS_ARP = [0, 3, 7, 10];
const CALM_BELL_SCALE = [0, 3, 5, 7, 10];

class AudioManager {
  private graph: Graph | null = null;
  private muted: boolean = false;
  private ducked: boolean = false;

  private listenerX: number = 0;
  private listenerZ: number = 0;
  private listenerFwdX: number = 0;
  private listenerFwdZ: number = -1;

  private readonly lastPlayed: Record<string, number> = {};

  private desiredMode: MusicMode = 'off';
  private currentMode: MusicMode = 'off';
  private schedulerTimer: number | null = null;
  private nextStepTime: number = 0;
  private step: number = 0;

  constructor() {
    try {
      this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch (_) {
      this.muted = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle / global controls
  // ---------------------------------------------------------------------------

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  public unlock(): void {
    if (!this.graph) {
      this.graph = this.createGraph();
      if (!this.graph) return;
      this.applyMasterVolume();
      this.applyMusicLevel();
      this.applyMusicMode(true);
    }
    if (this.graph.ctx.state === 'suspended') {
      void this.graph.ctx.resume();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? '1' : '0');
    } catch (_) {
      // Storage may be unavailable; mute still works for this session.
    }
    this.applyMasterVolume();
    return this.muted;
  }

  public setListener(pos: Vec3Like, forwardX: number, forwardZ: number): void {
    this.listenerX = pos.x;
    this.listenerZ = pos.z;
    const len = Math.hypot(forwardX, forwardZ);
    if (len > 0.0001) {
      this.listenerFwdX = forwardX / len;
      this.listenerFwdZ = forwardZ / len;
    }
  }

  public setMusic(mode: MusicMode): void {
    this.desiredMode = mode;
    this.applyMusicMode(false);
  }

  /** Lowers the music volume (e.g. while paused). */
  public setDuck(ducked: boolean): void {
    this.ducked = ducked;
    this.applyMusicLevel();
  }

  // ---------------------------------------------------------------------------
  // Player weapons
  // ---------------------------------------------------------------------------

  public sniperShot(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.7 });
    if (!out) return;
    this.noise(g, out, t, { dur: 0.06, f0: 2600, type: 'highpass', peak: 0.9, attack: 0.0005 });
    this.noise(g, out, t, { dur: 0.28, f0: 1800, f1: 300, type: 'bandpass', q: 0.8, peak: 0.8 });
    this.tone(g, out, t, { type: 'sine', f0: 140, f1: 35, dur: 0.65, peak: 1.0 });
    this.tone(g, out, t, { type: 'triangle', f0: 230, f1: 60, dur: 0.26, peak: 0.5 });
    this.noise(g, out, t + 0.02, { dur: 1.4, f0: 1200, f1: 200, type: 'lowpass', peak: 0.22, attack: 0.02 });
  }

  /** Bolt-action cycle after a sniper shot. */
  public sniperBolt(delaySeconds: number = 0.6): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime + delaySeconds;
    const out = this.makeOut(g, { volume: 0.7 });
    if (!out) return;
    this.click(g, out, t, 900, 0.5);
    this.noise(g, out, t + 0.05, { dur: 0.12, f0: 700, f1: 1800, type: 'bandpass', q: 2, peak: 0.25 });
    this.click(g, out, t + 0.22, 1300, 0.55);
  }

  public rifleShot(kind: RifleKind): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.25, volume: 0.85 + Math.random() * 0.15 });
    if (!out) return;
    const p = 0.93 + Math.random() * 0.14;
    if (kind === 'akm') {
      this.tone(g, out, t, { type: 'sine', f0: 115 * p, f1: 50, dur: 0.17, peak: 0.85 });
      this.noise(g, out, t, { dur: 0.13, f0: 2200 * p, f1: 500, type: 'bandpass', q: 0.9, peak: 0.75 });
      this.noise(g, out, t, { dur: 0.03, f0: 3000, type: 'highpass', peak: 0.5, attack: 0.0005 });
    } else {
      this.tone(g, out, t, { type: 'sine', f0: 175 * p, f1: 70, dur: 0.12, peak: 0.65 });
      this.noise(g, out, t, { dur: 0.09, f0: 3200 * p, f1: 900, type: 'bandpass', q: 1.1, peak: 0.65 });
      this.noise(g, out, t, { dur: 0.025, f0: 4500, type: 'highpass', peak: 0.45, attack: 0.0005 });
    }
  }

  public bazookaFire(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.6 });
    if (!out) return;
    this.noise(g, out, t, { dur: 0.7, f0: 300, f1: 1800, type: 'bandpass', q: 0.7, peak: 0.7, attack: 0.05 });
    this.tone(g, out, t, { type: 'sine', f0: 90, f1: 30, dur: 0.55, peak: 1.0 });
    this.noise(g, out, t, { dur: 0.3, f0: 3000, f1: 400, type: 'lowpass', peak: 0.8 });
  }

  public dryFire(): void {
    if (!this.throttle('dry', 220)) return;
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.7 });
    if (!out) return;
    this.tone(g, out, t, { type: 'square', f0: 900, f1: 600, dur: 0.03, peak: 0.2 });
    this.noise(g, out, t, { dur: 0.02, f0: 3000, type: 'bandpass', q: 1, peak: 0.15 });
  }

  public knifeSlash(didHit: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.9 });
    if (!out) return;
    this.noise(g, out, t, { dur: 0.18, f0: 1500, f1: 5000, type: 'bandpass', q: 1.2, peak: 0.45, attack: 0.04 });
    if (didHit) {
      this.tone(g, out, t + 0.07, { type: 'triangle', f0: 260, f1: 90, dur: 0.12, peak: 0.5 });
      this.noise(g, out, t + 0.07, { dur: 0.08, f0: 2500, f1: 1000, type: 'bandpass', q: 1, peak: 0.5 });
    }
  }

  public grenadeThrow(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.8 });
    if (!out) return;
    this.tone(g, out, t, { type: 'square', f0: 2400, f1: 1800, dur: 0.03, peak: 0.15 });
    this.noise(g, out, t + 0.05, { dur: 0.25, f0: 500, f1: 1200, type: 'bandpass', q: 0.8, peak: 0.25, attack: 0.05 });
  }

  public explosion(pos: Vec3Like, kind: ExplosionKind): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const isRocket = kind === 'rocket';
    const out = this.makeOut(g, {
      at: pos,
      maxDist: 140,
      volume: isRocket ? 1.0 : 0.85,
      reverb: 0.8,
    });
    if (!out) return;
    this.tone(g, out, t, { type: 'sine', f0: 80, f1: 22, dur: isRocket ? 1.5 : 1.2, peak: 1.2 });
    this.noise(g, out, t, { dur: 1.6, f0: 4000, f1: 150, type: 'lowpass', peak: 1.0, attack: 0.004 });
    this.noise(g, out, t, { dur: 0.4, f0: 1200, f1: 300, type: 'bandpass', q: 0.7, peak: 0.8 });
    for (let i = 0; i < 8; i++) {
      this.noise(g, out, t + 0.1 + Math.random() * 1.1, {
        dur: 0.04,
        f0: 3000 + Math.random() * 2000,
        type: 'highpass',
        peak: 0.12 + Math.random() * 0.08,
        attack: 0.001,
      });
    }
  }

  public weaponSwitch(): void {
    if (!this.throttle('switch', 80)) return;
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.6 });
    if (!out) return;
    this.click(g, out, t, 1500, 0.4);
    this.noise(g, out, t + 0.02, { dur: 0.08, f0: 800, f1: 400, type: 'bandpass', q: 1, peak: 0.15 });
  }

  public reloadStart(kind: ReloadKind): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.8 });
    if (!out) return;
    if (kind === 'bazooka') {
      this.noise(g, out, t, { dur: 0.3, f0: 500, f1: 1500, type: 'bandpass', q: 3, peak: 0.3, attack: 0.03 });
      this.tone(g, out, t + 0.1, { type: 'square', f0: 300, f1: 180, dur: 0.08, peak: 0.15 });
    } else if (kind === 'sniper') {
      this.click(g, out, t, 900, 0.5);
      this.noise(g, out, t + 0.05, { dur: 0.14, f0: 700, f1: 1700, type: 'bandpass', q: 2, peak: 0.25 });
    } else {
      this.click(g, out, t, 1200, 0.5);
      this.noise(g, out, t + 0.03, { dur: 0.12, f0: 800, f1: 300, type: 'bandpass', q: 1.2, peak: 0.25 });
    }
  }

  public reloadEnd(kind: ReloadKind): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.9 });
    if (!out) return;
    if (kind === 'bazooka') {
      this.tone(g, out, t, { type: 'sine', f0: 120, f1: 60, dur: 0.22, peak: 0.7 });
      this.noise(g, out, t, { dur: 0.1, f0: 900, type: 'bandpass', q: 1.5, peak: 0.45 });
    } else if (kind === 'sniper') {
      this.click(g, out, t, 1100, 0.6);
      this.click(g, out, t + 0.2, 1400, 0.6);
    } else {
      this.click(g, out, t, 1000, 0.7);
      this.click(g, out, t + 0.14, 1700, 0.5);
    }
  }

  // ---------------------------------------------------------------------------
  // Hit feedback
  // ---------------------------------------------------------------------------

  public hitmarker(isHeadshot: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: isHeadshot ? 1.0 : 0.8 });
    if (!out) return;
    if (isHeadshot) {
      this.tone(g, out, t, { type: 'sine', f0: 2600, dur: 0.3, peak: 0.5, attack: 0.001 });
      this.tone(g, out, t, { type: 'sine', f0: 3900, dur: 0.22, peak: 0.3, attack: 0.001 });
      this.tone(g, out, t, { type: 'triangle', f0: 1300, f1: 900, dur: 0.08, peak: 0.25, attack: 0.001 });
      this.noise(g, out, t, { dur: 0.02, f0: 6000, type: 'highpass', peak: 0.2, attack: 0.0005 });
    } else {
      this.tone(g, out, t, { type: 'sine', f0: 2200, dur: 0.05, peak: 0.35, attack: 0.001 });
      this.tone(g, out, t, { type: 'triangle', f0: 3300, dur: 0.03, peak: 0.2, attack: 0.001 });
    }
  }

  // ---------------------------------------------------------------------------
  // Player body
  // ---------------------------------------------------------------------------

  public footstep(isSprinting: boolean, flip: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: isSprinting ? 1.0 : 0.7 });
    if (!out) return;
    const p = (flip ? 1.1 : 1.0) * (0.92 + Math.random() * 0.16);
    this.noise(g, out, t, {
      dur: 0.09,
      f0: (isSprinting ? 900 : 650) * p,
      f1: 200,
      type: 'lowpass',
      peak: isSprinting ? 0.3 : 0.2,
      attack: 0.003,
    });
    this.tone(g, out, t, { type: 'sine', f0: 90 * p, f1: 50, dur: 0.08, peak: 0.25 });
    this.noise(g, out, t, { dur: 0.04, f0: 2500, type: 'highpass', peak: 0.06 });
  }

  public land(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.9 });
    if (!out) return;
    this.noise(g, out, t, { dur: 0.14, f0: 800, f1: 150, type: 'lowpass', peak: 0.4 });
    this.tone(g, out, t, { type: 'sine', f0: 80, f1: 35, dur: 0.15, peak: 0.45 });
  }

  public playerHurt(amount: number): void {
    if (!this.throttle('hurt', 80)) return;
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.9 });
    if (!out) return;
    this.tone(g, out, t, { type: 'sine', f0: 120, f1: 50, dur: 0.25, peak: 0.7 });
    this.noise(g, out, t, { dur: 0.2, f0: 1500, f1: 200, type: 'lowpass', peak: 0.5 });
    this.tone(g, out, t + 0.02, { type: 'sawtooth', f0: 200, f1: 110, dur: 0.22, peak: 0.25, lp: 900 });
    if (amount >= 25) {
      this.tone(g, out, t, { type: 'sine', f0: 3000, dur: 0.6, peak: 0.04, attack: 0.01 });
    }
  }

  public playerDeath(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.6 });
    if (!out) return;
    this.tone(g, out, t, { type: 'sine', f0: 100, f1: 25, dur: 1.8, peak: 0.8 });
    this.noise(g, out, t, { dur: 1.5, f0: 800, f1: 100, type: 'lowpass', peak: 0.4 });
  }

  // ---------------------------------------------------------------------------
  // Enemies
  // ---------------------------------------------------------------------------

  public enemyMelee(pos: Vec3Like, isBoss: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { at: pos, maxDist: 50, volume: isBoss ? 1.3 : 1.0 });
    if (!out) return;
    const p = isBoss ? 0.7 : 1.0;
    this.noise(g, out, t, { dur: 0.2, f0: 800 * p, f1: 300, type: 'bandpass', q: 0.9, peak: 0.35, attack: 0.03 });
    this.tone(g, out, t + 0.08, { type: 'sine', f0: 100 * p, f1: 50, dur: 0.15, peak: 0.5 });
    this.voice(g, out, t, {
      f0: 120 * p,
      f1: 90 * p,
      dur: 0.35,
      peak: isBoss ? 0.4 : 0.28,
      formant0: 600,
      formant1: 900,
    });
  }

  public enemyShot(pos: Vec3Like, isBoss: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, {
      at: pos,
      maxDist: 75,
      volume: isBoss ? 0.9 : 0.6,
      reverb: 0.3,
    });
    if (!out) return;
    if (isBoss) {
      this.tone(g, out, t, { type: 'sawtooth', f0: 900, f1: 120, dur: 0.45, peak: 0.5, lp: 2500 });
      this.tone(g, out, t, { type: 'sine', f0: 70, f1: 35, dur: 0.4, peak: 0.6 });
      this.noise(g, out, t, { dur: 0.2, f0: 2000, f1: 400, type: 'bandpass', q: 0.8, peak: 0.3 });
    } else {
      const p = 0.9 + Math.random() * 0.2;
      this.noise(g, out, t, { dur: 0.1, f0: 2400 * p, f1: 700, type: 'bandpass', q: 1, peak: 0.6 });
      this.tone(g, out, t, { type: 'sine', f0: 140 * p, f1: 60, dur: 0.1, peak: 0.5 });
    }
  }

  public enemyGrowl(pos: Vec3Like, isBoss: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { at: pos, maxDist: 45, volume: isBoss ? 1.0 : 0.7, reverb: 0.2 });
    if (!out) return;
    if (isBoss) {
      this.voice(g, out, t, { f0: 55, f1: 38, dur: 1.2, peak: 0.55, formant0: 300, formant1: 550, vibratoHz: 9 });
    } else {
      const base = 85 + Math.random() * 35;
      this.voice(g, out, t, {
        f0: base,
        f1: base * 0.7,
        dur: 0.55,
        peak: 0.35,
        formant0: 450,
        formant1: 750,
        vibratoHz: 14,
      });
    }
  }

  public enemyDeath(pos: Vec3Like, isBoss: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { at: pos, maxDist: 90, volume: isBoss ? 1.2 : 0.85, reverb: 0.35 });
    if (!out) return;
    if (isBoss) {
      this.voice(g, out, t, { f0: 90, f1: 28, dur: 2.0, peak: 0.6, formant0: 500, formant1: 250, vibratoHz: 7 });
      this.tone(g, out, t + 0.4, { type: 'sine', f0: 70, f1: 25, dur: 1.2, peak: 0.9 });
      this.noise(g, out, t + 0.4, { dur: 1.0, f0: 1500, f1: 150, type: 'lowpass', peak: 0.5 });
    } else {
      this.voice(g, out, t, { f0: 160, f1: 40, dur: 0.7, peak: 0.45, formant0: 700, formant1: 350 });
      this.tone(g, out, t + 0.25, { type: 'sine', f0: 80, f1: 40, dur: 0.2, peak: 0.5 });
      this.noise(g, out, t + 0.25, { dur: 0.15, f0: 700, f1: 150, type: 'lowpass', peak: 0.3 });
    }
  }

  public bossRoar(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.7, volume: 1.0 });
    if (!out) return;
    this.voice(g, out, t, { f0: 48, f1: 34, dur: 2.2, peak: 0.8, formant0: 280, formant1: 600, vibratoHz: 8 });
    this.noise(g, out, t, { dur: 2.0, f0: 500, f1: 150, type: 'lowpass', peak: 0.3, attack: 0.15 });
    this.tone(g, out, t, { type: 'sine', f0: 60, f1: 30, dur: 1.6, peak: 0.7, attack: 0.1 });
  }

  // ---------------------------------------------------------------------------
  // Game flow stingers
  // ---------------------------------------------------------------------------

  public waveStart(isBoss: boolean): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.6, volume: 0.9 });
    if (!out) return;
    const second = isBoss ? 155.5 : 165;
    this.tone(g, out, t, { type: 'sawtooth', f0: 110, f1: 112, dur: 1.4, peak: 0.25, attack: 0.05, lp: 900 });
    this.tone(g, out, t, { type: 'sawtooth', f0: second, f1: second * 1.01, dur: 1.4, peak: 0.2, attack: 0.05, lp: 900 });
    if (isBoss) {
      this.tone(g, out, t, { type: 'sine', f0: 55, f1: 40, dur: 1.8, peak: 0.6, attack: 0.05 });
      this.noise(g, out, t, { dur: 0.6, f0: 1200, f1: 200, type: 'lowpass', peak: 0.4 });
    }
  }

  public waveClear(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.5, volume: 0.8 });
    if (!out) return;
    const notes = [440, 523.25, 659.25, 880];
    notes.forEach((f, i) => {
      this.tone(g, out, t + i * 0.12, { type: 'triangle', f0: f, dur: 0.6, peak: 0.3, attack: 0.005 });
    });
  }

  public crateLanded(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.8, reverb: 0.3 });
    if (!out) return;
    this.tone(g, out, t, { type: 'sine', f0: 70, f1: 35, dur: 0.3, peak: 0.6 });
    for (let i = 0; i < 3; i++) {
      this.tone(g, out, t + 0.2 + i * 0.15, { type: 'sine', f0: 1200, dur: 0.08, peak: 0.25, attack: 0.002 });
    }
  }

  public pickup(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { volume: 0.8, reverb: 0.3 });
    if (!out) return;
    this.tone(g, out, t, { type: 'sine', f0: 880, f1: 1320, dur: 0.2, peak: 0.3 });
    this.tone(g, out, t + 0.1, { type: 'triangle', f0: 1760, dur: 0.25, peak: 0.2 });
  }

  public defeat(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.8, volume: 0.9 });
    if (!out) return;
    [220, 174.61, 146.83, 110].forEach((f, i) => {
      this.tone(g, out, t + 0.3 + i * 0.45, { type: 'sawtooth', f0: f, dur: 1.2, peak: 0.18, attack: 0.03, lp: 700 });
    });
    this.tone(g, out, t + 0.3, { type: 'sine', f0: 60, f1: 30, dur: 2.5, peak: 0.6 });
  }

  public victory(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const out = this.makeOut(g, { reverb: 0.7, volume: 0.9 });
    if (!out) return;
    [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
      this.tone(g, out, t + i * 0.18, { type: 'triangle', f0: f, dur: 1.4, peak: 0.28, attack: 0.01 });
    });
    this.tone(g, out, t + 0.72, { type: 'sine', f0: 1046.5, dur: 1.8, peak: 0.15, attack: 0.01 });
  }

  // ---------------------------------------------------------------------------
  // Graph construction & routing
  // ---------------------------------------------------------------------------

  private createGraph(): Graph | null {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) {
      console.warn('[Audio] Web Audio API is not supported in this browser.');
      return null;
    }

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch (err) {
      console.warn('[Audio] Failed to create AudioContext:', err);
      return null;
    }

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.connect(comp);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);

    const music = ctx.createGain();
    music.gain.value = MUSIC_LEVEL;
    music.connect(master);

    // Reverb: generated impulse response (decaying stereo noise).
    const reverb = ctx.createConvolver();
    const irLen = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
      }
    }
    reverb.buffer = ir;
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.6;
    reverb.connect(reverbOut);
    reverbOut.connect(sfx);

    // Shared white-noise buffer (3 seconds).
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) {
      nd[i] = Math.random() * 2 - 1;
    }

    // Persistent ambient drone (silent until a music mode is set).
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(music);
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 220;
    droneFilter.Q.value = 2;
    droneFilter.connect(droneGain);

    const droneOscs: OscillatorNode[] = [];
    const droneDefs: Array<{ type: OscillatorType; mult: number; detune: number; level: number }> = [
      { type: 'sawtooth', mult: 1, detune: -6, level: 0.5 },
      { type: 'sawtooth', mult: 1, detune: 6, level: 0.5 },
      { type: 'sine', mult: 0.5, detune: 0, level: 0.8 },
    ];
    for (const def of droneDefs) {
      const osc = ctx.createOscillator();
      osc.type = def.type;
      osc.frequency.value = 55 * def.mult;
      osc.detune.value = def.detune;
      const lvl = ctx.createGain();
      lvl.gain.value = def.level;
      osc.connect(lvl);
      lvl.connect(droneFilter);
      osc.start();
      droneOscs.push(osc);
    }

    // Slow LFO breathing on the drone filter.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(droneFilter.frequency);
    lfo.start();

    // Distant battlefield wind/rumble bed.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noise;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.5;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(droneGain);
    windSrc.start();

    return { ctx, master, sfx, music, reverb, noise, droneGain, droneFilter, droneOscs };
  }

  private applyMasterVolume(): void {
    const g = this.graph;
    if (!g) return;
    g.master.gain.setTargetAtTime(this.muted ? 0 : 1, g.ctx.currentTime, 0.02);
  }

  private applyMusicLevel(): void {
    const g = this.graph;
    if (!g) return;
    g.music.gain.setTargetAtTime(this.ducked ? MUSIC_DUCKED_LEVEL : MUSIC_LEVEL, g.ctx.currentTime, 0.15);
  }

  /**
   * Creates a routing node for one sound: gain (volume/distance) -> optional
   * lowpass (distance) -> optional stereo pan -> sfx bus, plus a reverb send.
   * Returns null when the sound is too far away to be heard.
   */
  private makeOut(g: Graph, opts: OutOptions): GainNode | null {
    let volume = opts.volume ?? 1;
    let pan = 0;
    let lowpass = 0;

    if (opts.at) {
      const dx = opts.at.x - this.listenerX;
      const dz = opts.at.z - this.listenerZ;
      const dist = Math.hypot(dx, dz);
      const maxDist = opts.maxDist ?? DEFAULT_MAX_HEARING_DISTANCE;
      if (dist > maxDist) return null;
      volume *= (1 / (1 + dist * 0.12)) * Math.min(1, (maxDist - dist) / 10);
      if (volume < 0.005) return null;
      if (dist > 0.5) {
        const rightX = -this.listenerFwdZ;
        const rightZ = this.listenerFwdX;
        pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / dist)) * 0.85;
      }
      if (dist > 15) {
        lowpass = Math.max(1200, 9000 - dist * 120);
      }
    }

    const bus = g.ctx.createGain();
    bus.gain.value = volume;

    let tail: AudioNode = bus;
    if (lowpass > 0) {
      const lp = g.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      tail.connect(lp);
      tail = lp;
    }
    if (pan !== 0 && typeof g.ctx.createStereoPanner === 'function') {
      const panner = g.ctx.createStereoPanner();
      panner.pan.value = pan;
      tail.connect(panner);
      tail = panner;
    }
    tail.connect(g.sfx);

    if (opts.reverb && opts.reverb > 0) {
      const send = g.ctx.createGain();
      send.gain.value = opts.reverb;
      bus.connect(send);
      send.connect(g.reverb);
    }
    return bus;
  }

  private throttle(key: string, minIntervalMs: number): boolean {
    const now = performance.now();
    const last = this.lastPlayed[key] ?? -Infinity;
    if (now - last < minIntervalMs) return false;
    this.lastPlayed[key] = now;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Synthesis primitives
  // ---------------------------------------------------------------------------

  private env(param: AudioParam, t: number, attack: number, dur: number, peak: number): void {
    const a = Math.min(attack, dur * 0.5);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private noise(g: Graph, out: AudioNode, t: number, o: NoiseOptions): void {
    const src = g.ctx.createBufferSource();
    src.buffer = g.noise;
    const filter = g.ctx.createBiquadFilter();
    filter.type = o.type ?? 'lowpass';
    filter.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 20), t + o.dur);
    }
    filter.Q.value = o.q ?? 0.7;
    const gain = g.ctx.createGain();
    this.env(gain.gain, t, o.attack ?? 0.002, o.dur, o.peak);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + o.dur + 0.05);
  }

  private tone(g: Graph, out: AudioNode, t: number, o: ToneOptions): void {
    const osc = g.ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 10), t + o.dur);
    }
    const gain = g.ctx.createGain();
    this.env(gain.gain, t, o.attack ?? 0.002, o.dur, o.peak);
    if (o.lp) {
      const lp = g.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      osc.connect(lp);
      lp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(out);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  /** Short mechanical click (noise tick + tiny square blip). */
  private click(g: Graph, out: AudioNode, t: number, freq: number, peak: number): void {
    this.noise(g, out, t, { dur: 0.03, f0: freq * 2, type: 'bandpass', q: 2, peak, attack: 0.0005 });
    this.tone(g, out, t, { type: 'square', f0: freq, f1: freq * 0.6, dur: 0.025, peak: peak * 0.3, attack: 0.0005 });
  }

  /** Crude creature vocalisation: vibrato sawtooth through a sweeping formant + breath noise. */
  private voice(g: Graph, out: AudioNode, t: number, o: VoiceOptions): void {
    const osc = g.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(o.f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 10), t + o.dur);

    const vib = g.ctx.createOscillator();
    vib.frequency.value = o.vibratoHz ?? 11;
    const vibGain = g.ctx.createGain();
    vibGain.gain.value = o.f0 * 0.05;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const formant = g.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 4;
    formant.frequency.setValueAtTime(o.formant0, t);
    formant.frequency.exponentialRampToValueAtTime(Math.max(o.formant1, 20), t + o.dur);

    const low = g.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1400;

    const gain = g.ctx.createGain();
    this.env(gain.gain, t, Math.min(0.06, o.dur * 0.2), o.dur, o.peak);

    osc.connect(formant);
    formant.connect(low);
    low.connect(gain);
    gain.connect(out);

    osc.start(t);
    vib.start(t);
    osc.stop(t + o.dur + 0.05);
    vib.stop(t + o.dur + 0.05);

    this.noise(g, out, t, {
      dur: o.dur,
      f0: 900,
      type: 'bandpass',
      q: 0.8,
      peak: o.peak * 0.35,
      attack: Math.min(0.08, o.dur * 0.3),
    });
  }

  // ---------------------------------------------------------------------------
  // Adaptive music
  // ---------------------------------------------------------------------------

  private applyMusicMode(force: boolean): void {
    const g = this.graph;
    if (!g) return;
    if (!force && this.currentMode === this.desiredMode) return;

    this.currentMode = this.desiredMode;
    this.step = 0;
    const now = g.ctx.currentTime;
    const mode = this.currentMode;

    if (mode === 'off') {
      g.droneGain.gain.setTargetAtTime(0, now, 0.4);
      this.stopScheduler();
      return;
    }

    const rootFreq = mode === 'boss' ? 58.27 : 55;
    const droneLevel = mode === 'calm' ? 0.5 : mode === 'combat' ? 0.22 : 0.3;
    const cutoff = mode === 'calm' ? 220 : mode === 'combat' ? 380 : 600;
    g.droneOscs.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(i === 2 ? rootFreq * 0.5 : rootFreq, now, 0.8);
    });
    g.droneFilter.frequency.setTargetAtTime(cutoff, now, 0.8);
    g.droneGain.gain.setTargetAtTime(droneLevel, now, 0.6);

    this.startScheduler();
  }

  private startScheduler(): void {
    const g = this.graph;
    if (!g) return;
    this.nextStepTime = g.ctx.currentTime + 0.1;
    if (this.schedulerTimer !== null) return;
    this.schedulerTimer = window.setInterval(() => this.tick(), 40);
  }

  private stopScheduler(): void {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private tick(): void {
    const g = this.graph;
    if (!g || this.currentMode === 'off') return;
    const now = g.ctx.currentTime;
    // Recover gracefully when the tab was throttled in the background.
    if (this.nextStepTime < now - 0.5) {
      this.nextStepTime = now + 0.05;
    }
    while (this.nextStepTime < now + 0.2) {
      this.scheduleStep(g, this.step, this.nextStepTime);
      const bpm = MODE_BPM[this.currentMode];
      this.nextStepTime += 60 / bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }

  private scheduleStep(g: Graph, step: number, t: number): void {
    const mode = this.currentMode;
    const out = g.music;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;

    if (mode === 'calm') {
      if (s === 0 && bar % 2 === 0) {
        this.kick(g, out, t, 0.2);
      }
      if (s % 8 === 0 && Math.random() < 0.55) {
        const semi = CALM_BELL_SCALE[Math.floor(Math.random() * CALM_BELL_SCALE.length)] ?? 0;
        const octave = Math.random() < 0.5 ? 2 : 4;
        this.tone(g, out, t, {
          type: 'sine',
          f0: 110 * octave * Math.pow(2, semi / 12) * 0.5,
          dur: 3.0,
          peak: 0.07,
          attack: 0.02,
        });
      }
      return;
    }

    if (mode === 'combat') {
      const root = 55 * Math.pow(2, (PROGRESSION_COMBAT[bar] ?? 0) / 12);
      if (s % 4 === 0 || (s === 10 && bar === 3)) this.kick(g, out, t, 0.55);
      if (s === 4 || s === 12) this.snare(g, out, t, 0.25);
      if (s % 2 === 0) this.hat(g, out, t, s === 14 ? 0.1 : 0.06, s === 14 ? 0.1 : 0.03);
      if (s % 2 === 0) {
        const f = s === 6 || s === 14 ? root * 2 : root;
        this.tone(g, out, t, { type: 'sawtooth', f0: f, dur: 0.16, peak: 0.24, attack: 0.004, lp: 420 });
      }
      return;
    }

    // Boss
    const root = 55 * Math.pow(2, (PROGRESSION_BOSS[bar] ?? 0) / 12);
    if (s % 4 === 0 || s === 10) this.kick(g, out, t, 0.6);
    if (s === 4 || s === 12) this.snare(g, out, t, 0.3);
    if (s === 15 && bar === 3) this.snare(g, out, t, 0.12);
    this.hat(g, out, t, 0.04 + (s % 2 === 0 ? 0.03 : 0), 0.03);
    if (BOSS_GALLOP[s] === 1) {
      const f = s % 8 === 6 ? root * 2 : root;
      this.tone(g, out, t, { type: 'sawtooth', f0: f, dur: 0.1, peak: 0.28, attack: 0.003, lp: 520 });
    }
    if (s === 0 || (s === 8 && bar % 2 === 1)) {
      for (const semi of [0, 3, 6]) {
        this.tone(g, out, t, {
          type: 'sawtooth',
          f0: root * 4 * Math.pow(2, semi / 12),
          dur: 0.5,
          peak: 0.08,
          attack: 0.005,
          lp: 1800,
        });
      }
    }
    if (s % 2 === 1) {
      const semi = BOSS_ARP[(s >> 1) % BOSS_ARP.length] ?? 0;
      this.tone(g, out, t, {
        type: 'square',
        f0: root * 8 * Math.pow(2, semi / 12),
        dur: 0.08,
        peak: 0.04,
        attack: 0.002,
        lp: 3000,
      });
    }
  }

  private kick(g: Graph, out: AudioNode, t: number, peak: number): void {
    this.tone(g, out, t, { type: 'sine', f0: 150, f1: 40, dur: 0.18, peak, attack: 0.001 });
  }

  private snare(g: Graph, out: AudioNode, t: number, peak: number): void {
    this.noise(g, out, t, { dur: 0.15, f0: 1800, type: 'bandpass', q: 0.8, peak, attack: 0.001 });
    this.tone(g, out, t, { type: 'triangle', f0: 190, f1: 120, dur: 0.08, peak: peak * 0.6, attack: 0.001 });
  }

  private hat(g: Graph, out: AudioNode, t: number, peak: number, dur: number): void {
    this.noise(g, out, t, { dur, f0: 7000, type: 'highpass', peak, attack: 0.001 });
  }
}

export const audio = new AudioManager();
