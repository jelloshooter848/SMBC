import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as settingsModule from '@engine/save/settings';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type ClassicCheatsSettings,
  type Settings,
} from '@engine/save/settings';
import { DATA_EPOCH_KEY, adoptDataEpoch, onStaleStorage } from '@engine/save/storage';
import { makeGame, store, useStorage } from './heroes-harness';

/*
 * Item 150 (owner-approved, save safety; rule 33a: the edge cases first). Two tabs share one
 * smbc.settings. A save re-reads what is stored and writes only what this tab changed since it
 * last read or wrote it: monotonic fields (cheat unlocks, beaten games, cheat counts, notes shown
 * once, the old Tutorials list) never go backwards, and a preference takes this tab's value only
 * when this tab changed it. After a SAVE DATA import or erase (the data marker) a stale tab still
 * writes nothing and reloads. Every Settings field is classified (SETTINGS_MERGE).
 */

useStorage();
beforeEach(() => adoptDataEpoch());
afterEach(() => {
  store.clear();
  (settingsModule as unknown as { onSettingsMerged?: (fn: null) => void }).onSettingsMerged?.(null);
  onStaleStorage(null);
  adoptDataEpoch();
});

const stored = (): Settings => JSON.parse(store.get(SETTINGS_KEY) ?? 'null') as Settings;

describe('150: two tabs, one settings file', () => {
  it('B unlocks cheats and beats SMB; A then saves (a death, a hero pick): B’s unlocks stay', () => {
    saveSettings(defaultSettings());
    const a = loadSettings();
    const b = loadSettings();
    b.classicCheats.unlocked.allGroundIsBricks = true;
    b.classicCheats.unlocked.infiniteLives = true;
    b.classicCheats.beaten.smb = true;
    saveSettings(b);
    // A saves something of its own.
    a.classicCheats.stats.enemiesDefeated += 4;
    saveSettings(a);
    const s = stored();
    expect(s.classicCheats.unlocked.allGroundIsBricks).toBe(true);
    expect(s.classicCheats.unlocked.infiniteLives).toBe(true);
    expect(s.classicCheats.beaten.smb).toBe(true);
    expect(s.classicCheats.stats.enemiesDefeated).toBe(4);
    // A's own copy now has them too (a later save of A keeps them).
    expect(a.classicCheats.unlocked.infiniteLives).toBe(true);
    saveSettings(a);
    expect(stored().classicCheats.beaten.smb).toBe(true);
  });

  it('B picks a skin, A changes a video setting: both survive', () => {
    saveSettings(defaultSettings());
    const a = loadSettings();
    const b = loadSettings();
    b.classicSkins = { megaman: 'protoman' };
    saveSettings(b);
    a.video.showFps = true;
    saveSettings(a);
    const s = stored();
    expect(s.classicSkins).toEqual({ megaman: 'protoman' });
    expect(s.video.showFps).toBe(true);
    // Each tab picks a skin for another hero: both kept.
    a.classicSkins = { ...(a.classicSkins ?? {}), samus: 'pit' };
    saveSettings(a);
    expect(stored().classicSkins).toEqual({ megaman: 'protoman', samus: 'pit' });
  });

  it('a preference both tabs changed: the last tab to change it wins; one only B changed stays B’s', () => {
    saveSettings(defaultSettings());
    const a = loadSettings();
    const b = loadSettings();
    b.audio.music = 0.3;
    b.audio.sfx = 0.2;
    saveSettings(b);
    a.audio.music = 0.7;
    saveSettings(a);
    expect(stored().audio.music).toBe(0.7);
    expect(stored().audio.sfx).toBe(0.2);
  });

  it('cheat counts from both tabs add up; notes shown once and the old Tutorials list never go back', () => {
    const base = defaultSettings();
    base.classicCheats.stats.bricksBroken = 10;
    base.classicTutorialsSeen = ['start'];
    saveSettings(base);
    const a = loadSettings();
    const b = loadSettings();
    b.classicCheats.stats.bricksBroken += 3;
    (b.homeScreen as NonNullable<Settings['homeScreen']>).tipDone = true;
    b.classicTutorialsSeen = ['start', 'mushroom'];
    saveSettings(b);
    a.classicCheats.stats.bricksBroken += 5;
    a.classicTutorialsSeen = ['start', 'flower'];
    saveSettings(a);
    const s = stored();
    expect(s.classicCheats.stats.bricksBroken).toBe(18);
    expect(s.homeScreen?.tipDone).toBe(true);
    expect([...(s.classicTutorialsSeen ?? [])].sort()).toEqual(['flower', 'mushroom', 'start']);
  });

  it('one tab: every change it makes is saved as before (a preference turned back too)', () => {
    const a = loadSettings();
    a.video.showFps = true;
    a.packs = ['retro'];
    saveSettings(a);
    expect(stored().video.showFps).toBe(true);
    a.video.showFps = false;
    a.packs = [];
    a.classicCheats.on.infiniteLives = true;
    saveSettings(a);
    expect(stored().video.showFps).toBe(false);
    expect(stored().packs).toEqual([]);
    expect(loadSettings().classicCheats.on.infiniteLives).toBe(true);
  });

  it('after a SAVE DATA import or erase (the data marker), a stale tab writes nothing and is told to reload', () => {
    const a = loadSettings();
    let told = 0;
    onStaleStorage(() => told++);
    // Another tab imports (or erases): a new marker, new data.
    store.set(DATA_EPOCH_KEY, 'other');
    const imported = defaultSettings();
    imported.classicCheats.unlocked.waterMode = true;
    store.set(SETTINGS_KEY, JSON.stringify(imported));
    a.video.showFps = true;
    saveSettings(a);
    expect(told).toBeGreaterThan(0);
    expect(stored().video.showFps).toBe(false);
    expect(stored().classicCheats.unlocked.waterMode).toBe(true);
  });
});

describe('150: every Settings field is classified', () => {
  it('SETTINGS_MERGE names each field of Settings and of its cheats, and nothing else', () => {
    const merge = (settingsModule as unknown as { SETTINGS_MERGE?: Record<string, unknown> }).SETTINGS_MERGE;
    expect(merge).toBeDefined();
    // Every field, the optional ones too.
    const full: Required<Settings> = {
      ...defaultSettings(),
      homeScreen: { tipDone: false, noticeDone: false, offlineDone: false },
      classicSkins: {},
      classicHeroesOff: [],
      classicTutorials: false,
      classicTutorialsSeen: [],
    };
    expect(Object.keys(merge ?? {}).sort()).toEqual(Object.keys(full).sort());
    const cheats = (merge ?? {}).classicCheats as Record<string, unknown>;
    const fields: (keyof ClassicCheatsSettings)[] = ['on', 'unlocked', 'stats', 'beaten', 'continuesUsed'];
    expect(Object.keys(cheats).sort()).toEqual([...fields].sort());
    expect(Object.keys(defaultSettings().classicCheats).sort()).toEqual([...fields].sort());
  });
});

describe('150 review: a merge whose write fails, counts, and the live game', () => {
  it('the write after a merge fails once (storage full); the retry after another write is right', () => {
    saveSettings(defaultSettings());
    const a = loadSettings();
    const b = loadSettings();
    b.classicCheats.stats.enemiesDefeated = 5;
    b.video.palette = 'x' as Settings['video']['palette'];
    saveSettings(b);
    a.classicCheats.stats.enemiesDefeated = 2;
    // A's save merges, then its write fails (once).
    const ls = globalThis.localStorage as Storage;
    const set = ls.setItem.bind(ls);
    let fail = true;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: ls.getItem.bind(ls),
      removeItem: ls.removeItem.bind(ls),
      setItem: (k: string, v: string) => {
        if (fail && k === SETTINGS_KEY) {
          fail = false;
          throw new Error('QuotaExceededError');
        }
        set(k, v);
      },
    };
    saveSettings(a);
    expect(stored().classicCheats.stats.enemiesDefeated).toBe(5);
    // B changes the palette again; A saves again.
    b.video.palette = 'y' as Settings['video']['palette'];
    saveSettings(b);
    saveSettings(a);
    expect(stored().classicCheats.stats.enemiesDefeated).toBe(7);
    expect(stored().video.palette).toBe('y');
  });

  it('merged counts stop at 999999; a count new since the last read adds all of this tab’s', () => {
    saveSettings(defaultSettings());
    const a = loadSettings();
    const b = loadSettings();
    b.classicCheats.stats.hammerBrosDefeated = 999990;
    saveSettings(b);
    a.classicCheats.stats.hammerBrosDefeated = 50;
    saveSettings(a);
    expect(stored().classicCheats.stats.hammerBrosDefeated).toBe(999999);
    // A count missing from this tab's last read (an older file): all of this tab's is added.
    const d = loadSettings();
    // This tab's last read lacks the count (an older file).
    const raw = JSON.parse(store.get(SETTINGS_KEY) ?? '{}');
    delete raw.classicCheats.stats.cheepsDefeated;
    store.set(SETTINGS_KEY, JSON.stringify(raw));
    const e = loadSettings();
    e.classicCheats.stats.cheepsDefeated = 4;
    d.classicCheats.stats.cheepsDefeated = 3;
    saveSettings(d);
    saveSettings(e);
    expect(stored().classicCheats.stats.cheepsDefeated).toBe(7);
  });

  it('a merge outside Options (a cheat-count flush) is reported, so the live game takes the other tab’s bindings and volume', () => {
    saveSettings(defaultSettings());
    const a = loadSettings();
    const b = loadSettings();
    b.audio.music = 0.25;
    b.input.bindings[0]!.keyboard.jump = ['KeyQ'];
    saveSettings(b);
    const merged: Settings[] = [];
    const hook = (
      settingsModule as unknown as { onSettingsMerged?: (fn: ((s: Settings) => void) | null) => void }
    ).onSettingsMerged;
    expect(hook).toBeDefined();
    hook?.((s) => merged.push(s));
    const h = makeGame({ deps: { settings: a, applySettings: () => {} } });
    a.classicCheats.stats.bricksBroken += 1;
    (h.game as unknown as { cheatStatsDirty: boolean }).cheatStatsDirty = true;
    h.game.flushCheatStats();
    expect(merged).toEqual([a]);
    expect(a.audio.music).toBe(0.25);
    expect(a.input.bindings[0]?.keyboard.jump).toEqual(['KeyQ']);
    // A save with nothing to merge reports nothing.
    saveSettings(a);
    expect(merged.length).toBe(1);
  });
});
