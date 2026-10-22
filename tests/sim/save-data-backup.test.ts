import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  MAX_BACKUP_CHARS,
  REFUSAL_TEXT,
  backupFileName,
  buildBackup,
  eraseGameData,
  isGameKey,
  parseBackup,
  readGameData,
  replaceGameData,
  type Backup,
} from '@engine/save/backup';
import { crc32 } from '@engine/save/zip';
import { DATA_EPOCH_KEY, adoptDataEpoch, loadJson, saveJson } from '@engine/save/storage';
import { defaultSettings, loadSettings, saveSettings, SETTINGS_KEY } from '@engine/save/settings';
import { loadProgress, PROGRESS_KEY, saveProgress } from '@engine/save/progress';
import { listSaves, loadSave, newSave, saveKey, writeSave } from '@game/save/save-files';
import { classicFileKey, listClassicFiles, migrateClassicFiles } from '@game/original-files';
import { CLASSIC_RESUME_KEY, classicResumeKey } from '@game/run-resume';
import { LIBRARY_KEY, loadLibrary, saveLibrary } from '@game/level/library';
import { DEV_LAST_KEY } from '@game/scenes/dev-play';
import { FakeStorage, installStorage } from './save-data-helpers';

/*
 * SAVE DATA (owner items 86-88), edge cases first (rule 33a): the backup holds every key the game
 * keeps in this browser, byte for byte; a file that is damaged, cut short, not JSON, another
 * game's, a newer format's or a newer game's changes nothing; an import or an erase is all or
 * nothing (a quota or a write failing midway puts everything back); storage that throws on read
 * or write is refused cleanly; a stale tab can never write its old state over a new import.
 */

const VERSION = '0.4.74';
const NOW = new Date(2026, 9, 22, 14, 30);

let ls: FakeStorage;
beforeEach(() => {
  ls = installStorage(new FakeStorage());
  adoptDataEpoch();
});

/** A classic resume (0.4.67 single slot, 0.4.68 per-set slot) as an older build wrote it. */
function oldRun(levelId = '2-1', extra: Record<string, unknown> = {}) {
  return {
    v: 1,
    levelId,
    rules: 'classic',
    hero: 'mario',
    score: 1200,
    coins: 14,
    lives: 3,
    world: 2,
    stage: 1,
    powerState: 'big',
    hp: 1,
    kit: {},
    warped: false,
    checkpoint: null,
    savedAt: 5,
    ...extra,
  };
}

/** Every kind of thing the game keeps, as the game itself writes it (plus a key from a newer build). */
function seed(): Record<string, string> {
  const s = defaultSettings();
  s.audio.master = 0.7;
  s.classicCheats.on = ['all-items'] as unknown as typeof s.classicCheats.on;
  s.assist.infiniteLives = true;
  s.classicTutorialsSeen = ['tut-run', 'tut-swim'];
  s.packs = ['retro'];
  saveSettings(s);
  const p = loadProgress();
  saveProgress({ ...p, ...{ beaten: ['smb'] } } as typeof p);
  writeSave(newSave(1, 'mario', null));
  writeSave(newSave(3, 'luigi', null));
  // A Classic file, an old per-set slot waiting for a free file, and the 0.4.67 single slot.
  ls.setItem(
    classicFileKey({ set: 'smb', slot: 2 }),
    JSON.stringify({ v: 1, set: 'smb', slot: 2, rules: {}, continues: 1, run: oldRun(), savedAt: 9 }),
  );
  ls.setItem(classicResumeKey('lost'), JSON.stringify(oldRun('ll-1-2')));
  ls.setItem(CLASSIC_RESUME_KEY, JSON.stringify(oldRun('sp-1-1')));
  saveLibrary({ v: 1, levels: { 'My Level': 'name: My Level\n', 'Ünïcode ☃': 'x' } });
  ls.setItem(DEV_LAST_KEY, JSON.stringify({ level: '1-1' }));
  // Something a newer build keeps that this one does not know: kept all the same.
  ls.setItem('smbc.future-thing', '{"v":9}');
  // Not the game's: another app on the same origin (GitHub Pages shares one per account).
  ls.setItem('other-app.token', 'keep me');
  ls.setItem('smbcx', 'not ours either');
  return ls.snapshot(isGameKey);
}

const gameKeys = () => ls.snapshot(isGameKey);
const backupOf = (): Backup => JSON.parse(buildBackup({ gameVersion: VERSION, now: NOW }).text) as Backup;

describe("the inventory: which keys are the game's", () => {
  it("every key the game writes is a game key; other apps' keys and the tab marker are not", () => {
    for (const k of [
      SETTINGS_KEY,
      PROGRESS_KEY,
      saveKey(1),
      saveKey(2),
      saveKey(3),
      classicFileKey({ set: 'smb', slot: 1 }),
      classicFileKey({ set: 'lost', slot: 3 }),
      classicFileKey({ set: 'special', slot: 2 }),
      CLASSIC_RESUME_KEY,
      classicResumeKey('smb'),
      classicResumeKey('lost'),
      classicResumeKey('special'),
      LIBRARY_KEY,
      DEV_LAST_KEY,
      'smbc.anything-newer',
      'smbc-anything-newer',
    ])
      expect(isGameKey(k), k).toBe(true);
    for (const k of ['other-app.token', 'smbcx', 'SMBC.settings', 'my-smbc.settings', '', DATA_EPOCH_KEY])
      expect(isGameKey(k), k).toBe(false);
  });
});

describe('export', () => {
  it('the backup holds every game key byte for byte, a format version and the game version', () => {
    const want = seed();
    const out = buildBackup({ gameVersion: VERSION, now: NOW });
    expect(out.fileName).toBe('smbc-remix-backup-2026-10-22.json');
    expect(out.keys).toBe(Object.keys(want).length);
    const b = JSON.parse(out.text) as Backup;
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(b.gameVersion).toBe(VERSION);
    expect(b.data).toEqual(want);
    expect(b.data['other-app.token']).toBeUndefined();
    expect(b.data[DATA_EPOCH_KEY]).toBeUndefined();
  });

  it('the file name is the local date, zero padded', () => {
    expect(backupFileName(new Date(2027, 0, 5, 23, 59))).toBe('smbc-remix-backup-2027-01-05.json');
  });

  it('an empty device exports a valid backup with no data', () => {
    const b = backupOf();
    expect(b.data).toEqual({});
    expect(parseBackup(JSON.stringify(b), VERSION).ok).toBe(true);
  });

  it('storage that throws on read: the export is refused (no half backup)', () => {
    seed();
    ls.throwOnRead = true;
    expect(() => buildBackup({ gameVersion: VERSION, now: NOW })).toThrow();
    expect(() => readGameData()).toThrow();
  });
});

describe('import: the round trip', () => {
  it('export, erase, import gives byte-identical storage', () => {
    const before = seed();
    const text = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    expect(eraseGameData().ok).toBe(true);
    expect(gameKeys()).toEqual({});
    const parsed = parseBackup(text, VERSION);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(replaceGameData(parsed.backup.data).ok).toBe(true);
    expect(gameKeys()).toEqual(before);
    // Another app's keys were never touched.
    expect(ls.getItem('other-app.token')).toBe('keep me');
    expect(ls.getItem('smbcx')).toBe('not ours either');
  });

  it('an import replaces everything: keys the backup lacks are gone afterwards', () => {
    seed();
    const text = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    ls.setItem(saveKey(2), JSON.stringify(newSave(2, 'mario', null)));
    ls.setItem('smbc-classic-file-special-3', '{}');
    const p = parseBackup(text, VERSION);
    if (!p.ok) throw new Error(p.reason);
    expect(replaceGameData(p.backup.data).ok).toBe(true);
    expect(ls.getItem(saveKey(2))).toBeNull();
    expect(ls.getItem('smbc-classic-file-special-3')).toBeNull();
  });

  it('two imports in a row: the second wins whole, nothing of the first is left', () => {
    seed();
    const first = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    eraseGameData();
    adoptDataEpoch();
    saveJson(SETTINGS_KEY, { v: 3, mine: 1 });
    saveJson('smbc.only-in-second', 2);
    const second = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    const a = parseBackup(first, VERSION);
    const b = parseBackup(second, VERSION);
    if (!a.ok || !b.ok) throw new Error('unreadable');
    expect(replaceGameData(a.backup.data).ok).toBe(true);
    expect(replaceGameData(b.backup.data).ok).toBe(true);
    expect(gameKeys()).toEqual(b.backup.data);
    expect(ls.getItem(saveKey(1))).toBeNull();
  });

  it("an old-format backup goes through the game's own migrations once imported", () => {
    // A backup made by an older build: settings v1 with the old master default, the 0.4.67
    // single Classic slot and a 0.4.68 per-set slot.
    const data: Record<string, string> = {
      [SETTINGS_KEY]: JSON.stringify({ v: 1, audio: { master: 0.8, music: 0.5, sfx: 0.5, muted: false } }),
      [CLASSIC_RESUME_KEY]: JSON.stringify(oldRun('3-1')),
      [classicResumeKey('lost')]: JSON.stringify(oldRun('ll-2-1')),
    };
    const old = parseBackup(JSON.stringify(withChecksum({ gameVersion: '0.4.60', data })), VERSION);
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    expect(replaceGameData(old.backup.data).ok).toBe(true);
    adoptDataEpoch();
    const s = loadSettings();
    expect(s.v).toBe(3);
    expect(s.audio.master).toBe(0.4);
    expect(s.backupReminders).toBe(false);
    expect(migrateClassicFiles({ classic: s.classic, difficulty: 'normal', continuesUsed: 0 })).toBe(true);
    expect(listClassicFiles('smb')[0]?.run.levelId).toBe('3-1');
    expect(listClassicFiles('lost')[0]?.run.levelId).toBe('ll-2-1');
    expect(ls.getItem(CLASSIC_RESUME_KEY)).toBeNull();
  });

  it('campaign saves and the level library read back after an import', () => {
    seed();
    const text = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    eraseGameData();
    adoptDataEpoch();
    expect(listSaves()).toEqual([null, null, null]);
    const p = parseBackup(text, VERSION);
    if (!p.ok) throw new Error(p.reason);
    replaceGameData(p.backup.data);
    adoptDataEpoch();
    expect(loadSave(1)?.slot).toBe(1);
    expect(loadSave(3)?.slot).toBe(3);
    expect(Object.keys(loadLibrary().levels)).toEqual(['My Level', 'Ünïcode ☃']);
    expect(loadSettings().classicTutorialsSeen).toEqual(['tut-run', 'tut-swim']);
  });
});

/** A backup document with a correct checksum over `data`. */
function withChecksum(b: { gameVersion: string; data: Record<string, string>; formatVersion?: number }) {
  const doc = {
    format: BACKUP_FORMAT,
    formatVersion: b.formatVersion ?? BACKUP_FORMAT_VERSION,
    gameVersion: b.gameVersion,
    exportedAt: NOW.toISOString(),
    data: b.data,
  };
  const sorted = Object.fromEntries(Object.entries(b.data).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)));
  const crc = crc32(new TextEncoder().encode(JSON.stringify(sorted)));
  return { ...doc, checksum: crc.toString(16).padStart(8, '0') };
}

describe('import: files that change nothing', () => {
  /** Each bad file: refused with this reason, and storage exactly as it was. */
  function refused(text: string, reason: keyof typeof REFUSAL_TEXT, version = VERSION) {
    const before = ls.snapshot();
    const p = parseBackup(text, version);
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.reason).toBe(reason);
      expect(REFUSAL_TEXT[p.reason].length).toBeLessThanOrEqual(28);
    }
    expect(ls.snapshot()).toEqual(before);
  }

  beforeEach(() => void seed());

  it('a truncated file', () => {
    const t = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    refused(t.slice(0, Math.floor(t.length / 2)), 'not-json');
    refused(t.slice(0, -1), 'not-json');
  });

  it('not JSON at all, or empty, or a picture', () => {
    refused('', 'not-json');
    refused('hello', 'not-json');
    refused('\u0089PNG\r\n\u001a\n', 'not-json');
  });

  it("JSON that is not a backup: another game's save, an array, a number, a level map", () => {
    refused('[]', 'not-backup');
    refused('42', 'not-backup');
    refused('null', 'not-backup');
    refused(JSON.stringify({ saveData: { coins: 9 }, game: 'Other Game' }), 'not-backup');
    refused(JSON.stringify({ format: 'other-game-backup', formatVersion: 1, data: {} }), 'not-backup');
    refused(JSON.stringify({ schema: 1, name: 'my-pack' }), 'not-backup');
  });

  it("a damaged backup: one changed letter, a value that is not text, a key that is not the game's", () => {
    const b = backupOf();
    const settings = b.data[SETTINGS_KEY] as string;
    refused(
      JSON.stringify({ ...b, data: { ...b.data, [SETTINGS_KEY]: settings.replace('0.7', '0.9') } }),
      'damaged',
    );
    refused(JSON.stringify({ ...b, checksum: undefined }), 'damaged');
    refused(JSON.stringify({ ...b, checksum: 'zz' }), 'damaged');
    refused(
      JSON.stringify(
        withChecksum({ gameVersion: VERSION, data: { [SETTINGS_KEY]: 5 as unknown as string } }),
      ),
      'damaged',
    );
    refused(
      JSON.stringify(withChecksum({ gameVersion: VERSION, data: { 'other-app.token': 'x' } })),
      'damaged',
    );
    refused(
      JSON.stringify(withChecksum({ gameVersion: VERSION, data: { [DATA_EPOCH_KEY]: 'x' } })),
      'damaged',
    );
    refused(JSON.stringify({ ...b, data: [] }), 'damaged');
    refused(JSON.stringify({ ...b, gameVersion: 7 }), 'damaged');
  });

  it('a newer format', () => {
    refused(
      JSON.stringify(withChecksum({ gameVersion: VERSION, data: {}, formatVersion: 2 })),
      'newer-format',
    );
  });

  it('a backup from a newer game version (a downgrade could misread its data)', () => {
    refused(JSON.stringify(withChecksum({ gameVersion: '0.4.75', data: {} })), 'newer-game');
    refused(JSON.stringify(withChecksum({ gameVersion: '0.5.0', data: {} })), 'newer-game');
    refused(JSON.stringify(withChecksum({ gameVersion: '1.0.0-dev.abc', data: {} })), 'newer-game');
    // The same release, or a dev build of it, or older: fine.
    for (const v of ['0.4.74', '0.4.74-dev.1234abc', '0.4.9', '0.3.99'])
      expect(parseBackup(JSON.stringify(withChecksum({ gameVersion: v, data: {} })), VERSION).ok, v).toBe(
        true,
      );
    expect(
      parseBackup(JSON.stringify(withChecksum({ gameVersion: '0.4.74', data: {} })), '0.4.74-dev.9f').ok,
    ).toBe(true);
  });

  it("a file too big for any browser's storage is refused before it is read", () => {
    refused('x'.repeat(MAX_BACKUP_CHARS + 1), 'too-big');
  });
});

describe('import: all or nothing', () => {
  function backupData(): Record<string, string> {
    // A different device's data, to be imported over this one.
    const other = new FakeStorage();
    installStorage(other);
    adoptDataEpoch();
    saveJson(SETTINGS_KEY, { v: 3, other: true });
    writeSave(newSave(2, 'link', null));
    saveLibrary({ v: 1, levels: { big: 'y'.repeat(4000) } });
    const p = parseBackup(buildBackup({ gameVersion: VERSION, now: NOW }).text, VERSION);
    installStorage(ls);
    adoptDataEpoch();
    if (!p.ok) throw new Error(p.reason);
    return p.backup.data;
  }

  it('the quota running out midway puts every key back as it was', () => {
    const data = backupData();
    const before = (seed(), ls.snapshot());
    // A write fails partway through (the third), then storage works again for the roll back.
    ls.writesLeft = 2;
    const r = replaceGameData(data);
    expect(r).toMatchObject({ ok: false, reason: 'quota' });
    expect(ls.snapshot()).toEqual(before);
  });

  it('a file over the space left: refused, nothing changed', () => {
    const data = backupData();
    const before = (seed(), ls.snapshot());
    // Exactly full: the bigger backup runs out of room partway, after the old data is gone.
    ls.quota = ls.used();
    const r = replaceGameData(data);
    expect(r).toMatchObject({ ok: false, reason: 'quota' });
    expect(ls.snapshot()).toEqual(before);
  });

  it('an import that only fits once the old data is gone still goes in', () => {
    const data = backupData();
    seed();
    const size = Object.entries(data).reduce((n, [k, v]) => n + k.length + v.length, 0);
    const others = ls.used() - Object.entries(gameKeys()).reduce((n, [k, v]) => n + k.length + v.length, 0);
    ls.quota = others + size + 200;
    expect(replaceGameData(data).ok).toBe(true);
    expect(gameKeys()).toEqual(data);
  });

  it('storage that throws on every write: refused, nothing changed', () => {
    const data = backupData();
    const before = (seed(), ls.snapshot());
    ls.throwOnWrite = true;
    expect(replaceGameData(data)).toMatchObject({ ok: false, reason: 'write' });
    ls.throwOnWrite = false;
    expect(ls.snapshot()).toEqual(before);
  });

  it('storage that throws on read: refused before anything is written', () => {
    const data = backupData();
    seed();
    const before = new Map(ls.map);
    ls.throwOnRead = true;
    expect(replaceGameData(data)).toMatchObject({ ok: false, reason: 'read' });
    expect(ls.map).toEqual(before);
  });

  it('a failed import leaves this tab able to save (its marker is put back too)', () => {
    const data = backupData();
    seed();
    ls.writesLeft = 3;
    expect(replaceGameData(data).ok).toBe(false);
    expect(saveJson(SETTINGS_KEY, { v: 3, after: 1 })).toBe(true);
  });
});

describe('a stale tab (another tab open since before the import)', () => {
  /** A second tab: its own copy of the storage module, loaded now (its page load). */
  async function openTab() {
    vi.resetModules();
    const tab = await import('@engine/save/storage');
    tab.loadJson(SETTINGS_KEY);
    return tab;
  }

  it('after an import or an erase, its writes and removals are refused and it is told', async () => {
    seed();
    const tab = await openTab();
    const stale = vi.fn();
    tab.onStaleStorage(stale);
    const text = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    const p = parseBackup(text, VERSION);
    if (!p.ok) throw new Error(p.reason);
    expect(replaceGameData(p.backup.data).ok).toBe(true);
    const after = ls.snapshot();
    expect(tab.saveJson(SETTINGS_KEY, { v: 3, stale: true })).toBe(false);
    tab.removeKey(saveKey(1));
    expect(ls.snapshot()).toEqual(after);
    expect(stale).toHaveBeenCalled();

    const tab2 = await openTab();
    expect(eraseGameData().ok).toBe(true);
    expect(tab2.saveJson(SETTINGS_KEY, { v: 3, stale: true })).toBe(false);
    expect(gameKeys()).toEqual({});
  });

  it('a stale tab writing in the middle of an import cannot slip its state in', async () => {
    seed();
    const text = buildBackup({ gameVersion: VERSION, now: NOW }).text;
    const tab = await openTab();
    let n = 0;
    ls.afterSet = () => {
      if (n++ === 2) tab.saveJson(SETTINGS_KEY, { v: 3, stale: true });
    };
    const p = parseBackup(text, VERSION);
    if (!p.ok) throw new Error(p.reason);
    expect(replaceGameData(p.backup.data).ok).toBe(true);
    ls.afterSet = null;
    expect(gameKeys()).toEqual(p.backup.data);
  });

  it("an old build's tab (no guard) writing midway: the import notices and puts everything back", () => {
    const before = seed();
    const p = parseBackup(buildBackup({ gameVersion: VERSION, now: NOW }).text, VERSION);
    if (!p.ok) throw new Error(p.reason);
    eraseGameData();
    adoptDataEpoch();
    ls.setItem(SETTINGS_KEY, '{"v":3,"mine":1}');
    const mine = ls.snapshot();
    let n = 0;
    ls.afterSet = (k) => {
      if (k !== SETTINGS_KEY && n++ === 1) ls.map.set(saveKey(2), '{"stale":true}');
    };
    const r = replaceGameData(p.backup.data);
    ls.afterSet = null;
    expect(r).toMatchObject({ ok: false, reason: 'changed' });
    expect(ls.snapshot()).toEqual(mine);
    expect(before).not.toEqual(mine);
  });

  it('the tab that imported adopts the new data once it reloads; a fresh tab writes normally', async () => {
    seed();
    const p = parseBackup(buildBackup({ gameVersion: VERSION, now: NOW }).text, VERSION);
    if (!p.ok) throw new Error(p.reason);
    replaceGameData(p.backup.data);
    // This tab's own old state is refused too, until the reload.
    expect(saveJson(SETTINGS_KEY, { v: 3, old: true })).toBe(false);
    const fresh = await openTab();
    expect(fresh.saveJson(SETTINGS_KEY, { v: 3, fresh: true })).toBe(true);
    expect(JSON.parse(ls.getItem(SETTINGS_KEY) as string)).toEqual({ v: 3, fresh: true });
  });

  it('with no import ever made, nothing changes for anyone (no marker, every write allowed)', async () => {
    const tab = await openTab();
    expect(saveJson(SETTINGS_KEY, { a: 1 })).toBe(true);
    expect(tab.saveJson(SETTINGS_KEY, { a: 2 })).toBe(true);
    expect(loadJson(SETTINGS_KEY)).toEqual({ a: 2 });
    expect(ls.getItem(DATA_EPOCH_KEY)).toBeNull();
  });
});

describe('erase all data', () => {
  it("leaves no game key behind, only the tab marker; other apps' keys stay", () => {
    seed();
    expect(eraseGameData().ok).toBe(true);
    expect(gameKeys()).toEqual({});
    expect(Object.keys(ls.snapshot())).toEqual([DATA_EPOCH_KEY, 'other-app.token', 'smbcx'].sort());
  });

  it('afterwards the game reads as on first launch', () => {
    seed();
    eraseGameData();
    adoptDataEpoch();
    expect(loadSettings()).toEqual(defaultSettings());
    expect(listSaves()).toEqual([null, null, null]);
    expect(listClassicFiles('smb')).toEqual([null, null, null]);
    expect(loadLibrary()).toEqual({ v: 1, levels: {} });
  });

  it('storage throwing on write: nothing is erased, and it says so', () => {
    const before = (seed(), ls.snapshot());
    ls.throwOnWrite = true;
    expect(eraseGameData()).toMatchObject({ ok: false });
    ls.throwOnWrite = false;
    expect(ls.snapshot()).toEqual(before);
  });

  it('storage throwing on read: nothing is erased, and it says so', () => {
    seed();
    const before = new Map(ls.map);
    ls.throwOnRead = true;
    expect(eraseGameData()).toMatchObject({ ok: false, reason: 'read' });
    expect(ls.map).toEqual(before);
  });

  it('an empty device erases fine', () => {
    expect(eraseGameData().ok).toBe(true);
    expect(gameKeys()).toEqual({});
  });
});
