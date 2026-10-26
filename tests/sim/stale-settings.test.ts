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
import { store, useStorage } from './heroes-harness';

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
