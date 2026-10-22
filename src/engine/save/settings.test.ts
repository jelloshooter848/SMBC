import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MASTER,
  defaultSettings,
  OLD_DEFAULT_MASTER,
  SETTINGS_VERSION,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  TOUCH_SCALE_MAX,
  TOUCH_SCALE_MIN,
} from './settings';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('settings', () => {
  it('returns defaults when nothing is stored or storage is corrupt', () => {
    expect(loadSettings()).toEqual(defaultSettings());
    store.set(SETTINGS_KEY, '{not json');
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it('Safety floor assist: off by default, off for files saved before it, kept once set', () => {
    expect(defaultSettings().assist.safetyFloor).toBe(false);
    const old = defaultSettings() as unknown as { assist: Record<string, unknown> };
    delete old.assist.safetyFloor;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().assist.safetyFloor).toBe(false);
    const on = defaultSettings();
    on.assist.safetyFloor = true;
    saveSettings(on);
    expect(loadSettings().assist.safetyFloor).toBe(true);
  });

  it('key hints: off by default, off for files saved before the option, kept once set', () => {
    expect(defaultSettings().input.keyHints).toBe(false);
    const old = defaultSettings() as unknown as { input: Record<string, unknown> };
    delete old.input.keyHints;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().input.keyHints).toBe(false);
    const on = defaultSettings();
    on.input.keyHints = true;
    saveSettings(on);
    expect(loadSettings().input.keyHints).toBe(true);
  });

  it('round-trips and fills in missing fields', () => {
    const s = defaultSettings();
    s.audio.music = 0.5;
    s.assist.invulnerable = true;
    saveSettings(s);
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, audio: { music: 0.25 }, bogus: 1 }));
    const loaded = loadSettings();
    expect(loaded.audio.music).toBe(0.25);
    expect(loaded.audio.master).toBe(DEFAULT_MASTER);
    expect(loaded.assist.invulnerable).toBe(false);
    expect((loaded as unknown as { bogus?: number }).bogus).toBeUndefined();
  });

  it('ignores values of the wrong type', () => {
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, video: { integerScale: 'yes' } }));
    expect(loadSettings().video.integerScale).toBe(false); // FILL, the default (0.4.74)
  });
});

// The owner (0.4.49): the game started far louder than whatever was playing before. The default
// master volume is 6 dB lower (0.8 -> 0.4; scratchpad loudness numbers in the 0.4.49 report).
describe('settings: the quieter default master volume (v2)', () => {
  it('a new player starts at the new default, 6 dB below the old one', () => {
    expect(defaultSettings().audio.master).toBe(DEFAULT_MASTER);
    expect(DEFAULT_MASTER).toBe(0.4);
    expect(OLD_DEFAULT_MASTER).toBe(0.8);
    expect(20 * Math.log10(DEFAULT_MASTER / OLD_DEFAULT_MASTER)).toBeCloseTo(-6.02, 1);
    expect(defaultSettings().v).toBe(SETTINGS_VERSION);
    expect(SETTINGS_VERSION).toBe(3); // v3: O-08's backup reminders off by default
  });

  it('settings still at the old default (0.8, never changed) move to the new default', () => {
    const old = { ...defaultSettings(), v: 1, audio: { master: 0.8, music: 0.6, sfx: 1, muted: false } };
    store.set(SETTINGS_KEY, JSON.stringify(old));
    const s = loadSettings();
    expect(s.audio.master).toBe(DEFAULT_MASTER);
    expect(s.audio.music).toBe(0.6); // the rest is kept
    expect(s.v).toBe(SETTINGS_VERSION);
    // Saved again, it is v2 and stays put.
    saveSettings(s);
    expect(JSON.parse(store.get(SETTINGS_KEY) as string).v).toBe(SETTINGS_VERSION);
    expect(loadSettings().audio.master).toBe(DEFAULT_MASTER);
  });

  it("any other master the player chose is kept, and v2's 0.8 is the player's own", () => {
    for (const master of [0, 0.1, 0.5, 0.7, 0.9, 1]) {
      store.set(SETTINGS_KEY, JSON.stringify({ v: 1, audio: { master, music: 1, sfx: 1, muted: false } }));
      expect(loadSettings().audio.master, String(master)).toBe(master);
    }
    // Muted at the old default: the volume moves, mute stays.
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, audio: { master: 0.8, muted: true } }));
    expect(loadSettings().audio).toMatchObject({ master: DEFAULT_MASTER, muted: true });
    // A v2 file set to 80% by the player after the change is not moved.
    store.set(SETTINGS_KEY, JSON.stringify({ v: 2, audio: { master: 0.8 } }));
    expect(loadSettings().audio.master).toBe(0.8);
    // Files with no version (the earliest) count as v1.
    store.set(SETTINGS_KEY, JSON.stringify({ audio: { master: 0.8 } }));
    expect(loadSettings().audio.master).toBe(DEFAULT_MASTER);
  });
});

describe('settings: fields added after release', () => {
  it('defaults input.dpad to fixed for old saves and rejects unknown styles', () => {
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { touch: 'on', touchScale: 1.2 } }));
    const s = loadSettings();
    expect(s.input.dpad).toBe('fixed');
    expect(s.input.touch).toBe('on');
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { dpad: 'wobbly' } }));
    expect(loadSettings().input.dpad).toBe('fixed');
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { dpad: 'floating' } }));
    expect(loadSettings().input.dpad).toBe('floating');
  });

  it('a stored Touch size of 0.6 (old minimum) loads as the readable minimum 1', () => {
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { touchScale: 0.6 } }));
    expect(loadSettings().input.touchScale).toBe(TOUCH_SCALE_MIN);
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { touchScale: 1.3 } }));
    expect(loadSettings().input.touchScale).toBe(1.3);
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { touchScale: 9 } }));
    expect(loadSettings().input.touchScale).toBe(TOUCH_SCALE_MAX);
  });

  it('gives old stored bindings the new run action without touching remaps', () => {
    const old = defaultSettings().input.bindings.map((b) => {
      const kb: Record<string, string[]> = { ...b.keyboard, jump: ['KeyQ'] };
      delete kb.run;
      const pad: Record<string, string[]> = { ...b.gamepad };
      delete pad.run;
      return { ...b, keyboard: kb, gamepad: pad };
    });
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, input: { bindings: old } }));
    const s = loadSettings();
    for (const b of s.input.bindings) {
      expect(b.keyboard.run).toEqual([]);
      expect(b.gamepad.run).toEqual([]);
      expect(b.keyboard.jump).toEqual(['KeyQ']);
    }
  });
});
