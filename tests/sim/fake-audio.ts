import { vi } from 'vitest';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import type { Apu } from '@engine/audio/apu';
import { AudioManager } from '@engine/audio/audio-manager';
import type { Sequencer } from '@engine/audio/sequencer';

/**
 * A real AudioManager on a fake AudioContext (as src/engine/audio/audio-fade.test.ts), for the
 * title music sims (BUG-12, BUG-13). Call inside a test with fake timers on.
 */

/** An AudioParam that remembers its automation calls. */
export class Param {
  value = 1;
  calls: string[] = [];
  cancelScheduledValues(t: number) {
    this.calls.push(`cancel@${t}`);
  }
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push(`set ${v}@${t}`);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(`ramp ${v}@${t}`);
  }
}

class Node {
  out: Node[] = [];
  gain = new Param();
  frequency = new Param();
  playbackRate = new Param();
  buffer: unknown = null;
  loop = false;
  type = '';
  connect(n: Node) {
    this.out.push(n);
    return n;
  }
  start() {}
  stop() {}
  setPeriodicWave() {}
  getChannelData() {
    return new Float32Array(8);
  }
}

export class FakeContext {
  static last: FakeContext | null = null;
  /** The state a new context starts in (a browser that allows sound at once: 'running'). */
  static startState = 'running';
  state = FakeContext.startState;
  sampleRate = 48000;
  currentTime = 2;
  destination = new Node();
  constructor() {
    FakeContext.last = this;
  }
  createGain() {
    return new Node();
  }
  createOscillator() {
    return new Node();
  }
  createBufferSource() {
    return new Node();
  }
  createBuffer() {
    return new Node();
  }
  createPeriodicWave() {
    return {};
  }
  /** false: resume() stays pending (iOS, before the gesture's resume lands). */
  static resumes = true;
  resume() {
    if (!FakeContext.resumes) return new Promise<void>(() => {});
    this.state = 'running';
    return Promise.resolve();
  }
}

/** Stubs the browser globals the AudioManager uses (window.AudioContext, document). */
export function stubAudioGlobals(): void {
  vi.stubGlobal('window', {
    AudioContext: FakeContext,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener() {},
    // An audio element (the media session) or a canvas (the sprites: drawn to nothing here).
    createElement: () => ({ setAttribute() {}, play: () => Promise.resolve(), getContext: () => null }),
  });
}

/** A real AudioManager with the game's songs and sounds; `unlocked`: as after the first press. */
export function fakeAudio(unlocked = true) {
  const audio = new AudioManager();
  audio.registerSongs(songs);
  audio.registerSfx(sfx);
  if (unlocked) audio.unlock();
  const inner = audio as unknown as { apu: Apu | null; seq: Sequencer | null; currentMusic: string | null };
  return {
    audio,
    /** The song playing now (null: none, or a jingle). */
    current: () => inner.currentMusic,
    /** The music fade's automation (Apu.musicFade). */
    fade: () => (inner.apu as Apu).musicFade.gain as unknown as Param,
    apu: () => inner.apu as Apu,
    seq: () => inner.seq as Sequencer,
    ctx: () => FakeContext.last as FakeContext,
  };
}
