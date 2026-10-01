import { Apu } from './apu';
import { compileSong, parseMml, type CompiledSong, type Sfx, type Song, type Track } from './mml';
import { Sequencer, scheduleOnce } from './sequencer';

/** The game talks to audio through this so the headless sim can pass a no-op. */
export interface AudioSink {
  playMusic(id: string): void;
  stopMusic(): void;
  /** Play a non-looping jingle; the previous music is not resumed automatically. */
  playJingle(id: string, onEnd?: () => void): void;
  sfx(id: string): void;
  setTempoScale(scale: number): void;
  pause(): void;
  resume(): void;
}

export const NULL_AUDIO: AudioSink = {
  playMusic() {},
  stopMusic() {},
  playJingle(_id, onEnd) {
    onEnd?.();
  },
  sfx() {},
  setTempoScale() {},
  pause() {},
  resume() {},
};

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

interface CompiledSfx {
  bpm: number;
  pulse?: Track;
  pulse2?: Track;
  noise?: Track;
  triangle?: Track;
}

/**
 * Lazily creates the AudioContext on the first user gesture (browsers block autoplay) and owns
 * the song/sfx libraries. Everything before unlock() is a silent no-op.
 */
export class AudioManager implements AudioSink {
  private ctx: AudioContext | null = null;
  private apu: Apu | null = null;
  private seq: Sequencer | null = null;
  private readonly songs = new Map<string, Song>();
  private readonly compiled = new Map<string, CompiledSong>();
  private readonly sfxLib = new Map<string, Sfx>();
  private readonly sfxCompiled = new Map<string, CompiledSfx>();
  private pendingMusic: string | null = null;
  private currentMusic: string | null = null;
  private volumes: Volumes = { master: 0.8, music: 1, sfx: 1, muted: false };
  private tempoScale = 1;

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  registerSongs(songs: Song[]): void {
    for (const s of songs) this.songs.set(s.id, s);
  }
  registerSfx(list: Sfx[]): void {
    for (const s of list) this.sfxLib.set(s.id, s);
  }

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.apu = new Apu(this.ctx);
    this.seq = new Sequencer(this.ctx, this.apu.voices);
    this.applyVolumes();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.pendingMusic) {
      const id = this.pendingMusic;
      this.pendingMusic = null;
      this.playMusic(id);
    }
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.apu) return;
    const v = this.volumes;
    this.apu.master.gain.value = v.muted ? 0 : v.master * 0.5;
    this.apu.musicGain.gain.value = v.music;
    this.apu.sfxGain.gain.value = v.sfx;
  }

  private song(id: string): CompiledSong | null {
    const c = this.compiled.get(id);
    if (c) return c;
    const s = this.songs.get(id);
    if (!s) {
      console.warn(`unknown song "${id}"`);
      return null;
    }
    const cs = compileSong(s);
    this.compiled.set(id, cs);
    return cs;
  }

  playMusic(id: string): void {
    if (!this.seq) {
      this.pendingMusic = id;
      return;
    }
    if (this.currentMusic === id && this.seq.playing) return;
    const s = this.song(id);
    if (!s) return;
    this.currentMusic = id;
    this.seq.onEnd = null;
    this.seq.tempoScale = this.tempoScale;
    this.seq.play(s);
  }

  stopMusic(): void {
    this.pendingMusic = null;
    this.currentMusic = null;
    this.seq?.stop();
  }

  playJingle(id: string, onEnd?: () => void): void {
    if (!this.seq) {
      onEnd?.();
      return;
    }
    const s = this.song(id);
    if (!s) {
      onEnd?.();
      return;
    }
    this.currentMusic = null;
    this.seq.tempoScale = 1;
    this.seq.onEnd = onEnd ?? null;
    this.seq.play({ ...s, loop: false });
  }

  setTempoScale(scale: number): void {
    this.tempoScale = scale;
    this.seq?.setTempoScale(scale);
  }

  sfx(id: string): void {
    if (!this.ctx || !this.apu) return;
    let c = this.sfxCompiled.get(id);
    if (!c) {
      const def = this.sfxLib.get(id);
      if (!def) {
        console.warn(`unknown sfx "${id}"`);
        return;
      }
      c = { bpm: def.bpm ?? 150 };
      if (def.pulse) c.pulse = parseMml(def.pulse, 'pulse');
      if (def.pulse2) c.pulse2 = parseMml(def.pulse2, 'pulse');
      if (def.noise) c.noise = parseMml(def.noise, 'noise');
      if (def.triangle) c.triangle = parseMml(def.triangle, 'triangle');
      this.sfxCompiled.set(id, c);
    }
    const v = this.apu.voices;
    const tracks: { track: Track; voice: typeof v.sfxPulse }[] = [];
    if (c.pulse) tracks.push({ track: c.pulse, voice: v.sfxPulse });
    if (c.pulse2) tracks.push({ track: c.pulse2, voice: v.sfxPulse2 });
    if (c.noise) tracks.push({ track: c.noise, voice: v.sfxNoise });
    if (c.triangle) tracks.push({ track: c.triangle, voice: v.sfxTriangle });
    scheduleOnce(this.ctx, tracks, c.bpm);
  }

  pause(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }
}
