import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, SETTINGS_KEY } from './settings';

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
