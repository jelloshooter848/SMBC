import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultSettings,
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
    expect(loaded.audio.master).toBe(0.8);
    expect(loaded.assist.invulnerable).toBe(false);
    expect((loaded as unknown as { bogus?: number }).bogus).toBeUndefined();
  });

  it('ignores values of the wrong type', () => {
    store.set(SETTINGS_KEY, JSON.stringify({ v: 1, video: { integerScale: 'yes' } }));
    expect(loadSettings().video.integerScale).toBe(true);
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
