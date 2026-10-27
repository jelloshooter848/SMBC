import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATA_EPOCH_KEY, adoptDataEpoch, onStaleStorage } from '@engine/save/storage';
import { eraseGameData, isGameKey, readGameData, valueFits } from '@engine/save/backup';
import { onlineCopy } from '@engine/online/online-backup';
import {
  MAX_SONG_CHARS,
  MAX_SONGS,
  SONG_LIBRARY_KEY,
  cleanSongName,
  deleteSong,
  loadSongs,
  renameSong,
  saveSong,
} from './library';

/*
 * Music Lab's song library (item 136), rule 33a: the edge cases first. One game key,
 * `smbc.songs` = { v: 1, songs: { name: MML text } }, so a backup, Erase all data and the online
 * copy carry it as they carry the level editor's `smbc.levels`.
 */

const store = new Map<string, string>();
let throwOn: 'get' | 'set' | 'quota' | null = null;

const fakeStorage = {
  get length() {
    return store.size;
  },
  key: (i: number) => [...store.keys()][i] ?? null,
  getItem: (k: string) => {
    if (throwOn === 'get') throw new Error('SecurityError');
    return store.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (throwOn === 'set') throw new Error('SecurityError');
    if (throwOn === 'quota') throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    store.set(k, v);
  },
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => {
  store.clear();
  throwOn = null;
  (globalThis as { localStorage?: unknown }).localStorage = fakeStorage;
  adoptDataEpoch();
});
afterEach(() => {
  onStaleStorage(null);
  store.clear();
  adoptDataEpoch();
});

const raw = () =>
  JSON.parse(store.get(SONG_LIBRARY_KEY) ?? 'null') as { v: number; songs: Record<string, unknown> };

describe('Music Lab library: the plain cases', () => {
  it('starts empty, saves, lists, renames and deletes', () => {
    expect(loadSongs()).toMatchObject({ songs: {}, damaged: 0, unreadable: false });
    expect(saveSong('My tune', 'pulse1: c d e')).toEqual({ ok: true });
    expect(loadSongs().songs).toEqual({ 'My tune': 'pulse1: c d e' });
    expect(renameSong('My tune', 'Better tune')).toEqual({ ok: true });
    expect(Object.keys(loadSongs().songs)).toEqual(['Better tune']);
    expect(deleteSong('Better tune')).toEqual({ ok: true });
    expect(loadSongs().songs).toEqual({});
    expect(raw()).toEqual({ v: 1, songs: {} });
  });

  it('saving under a name it already has replaces that song', () => {
    saveSong('A', 'c');
    expect(saveSong('A', 'd')).toEqual({ ok: true });
    expect(loadSongs().songs).toEqual({ A: 'd' });
  });

  it('names are trimmed, kept short, and never empty', () => {
    expect(cleanSongName('  Hi  ')).toBe('Hi');
    expect(cleanSongName('   ')).toBeNull();
    expect(cleanSongName('x'.repeat(80))?.length).toBeLessThanOrEqual(24);
    expect(saveSong('   ', 'c')).toEqual({ ok: false, reason: 'name' });
  });

  it('a rename onto another song’s name, or of a song that is gone, is refused', () => {
    saveSong('A', 'c');
    saveSong('B', 'd');
    expect(renameSong('A', 'B')).toEqual({ ok: false, reason: 'exists' });
    expect(renameSong('Gone', 'C')).toEqual({ ok: false, reason: 'missing' });
    expect(loadSongs().songs).toEqual({ A: 'c', B: 'd' });
  });
});

describe('Music Lab library: rule 33a edge cases', () => {
  it('a full set: the 51st new song is refused, replacing one of the 50 still works', () => {
    for (let i = 0; i < MAX_SONGS; i++) expect(saveSong(`Song ${i}`, 'c')).toEqual({ ok: true });
    expect(saveSong('One more', 'c')).toEqual({ ok: false, reason: 'full' });
    expect(saveSong('Song 3', 'd')).toEqual({ ok: true });
    expect(Object.keys(loadSongs().songs)).toHaveLength(MAX_SONGS);
  });

  it('a song longer than the limit is refused, nothing written', () => {
    expect(saveSong('Long', 'c'.repeat(MAX_SONG_CHARS + 1))).toEqual({ ok: false, reason: 'too-long' });
    expect(store.has(SONG_LIBRARY_KEY)).toBe(false);
  });

  it('storage that throws on read: the list is unreadable and a save never writes over it', () => {
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { Kept: 'c' } }));
    throwOn = 'get';
    expect(loadSongs()).toMatchObject({ songs: {}, unreadable: true });
    expect(saveSong('New', 'd')).toEqual({ ok: false, reason: 'read' });
    throwOn = null;
    expect(loadSongs().songs).toEqual({ Kept: 'c' });
  });

  it('storage that throws on write: refused as a write, the library unchanged', () => {
    saveSong('Kept', 'c');
    throwOn = 'set';
    expect(saveSong('New', 'd')).toEqual({ ok: false, reason: 'write' });
    throwOn = 'quota';
    expect(saveSong('New', 'd')).toEqual({ ok: false, reason: 'quota' });
    expect(deleteSong('Kept')).toEqual({ ok: false, reason: 'quota' });
    throwOn = null;
    expect(loadSongs().songs).toEqual({ Kept: 'c' });
  });

  it('damaged entries are skipped and counted, kept as stored, and the good ones still load', () => {
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { Good: 'c', Bad: 42, Worse: null } }));
    expect(loadSongs()).toMatchObject({ songs: { Good: 'c' }, damaged: 2, unreadable: false });
    expect(saveSong('New', 'd')).toEqual({ ok: true });
    expect(raw().songs).toEqual({ Good: 'c', Bad: 42, Worse: null, New: 'd' });
  });

  it('a damaged library (not JSON, not the shape) or a newer format is never written over', () => {
    for (const bad of ['{nope', '"text"', '[1,2]', JSON.stringify({ v: 1, songs: [] })]) {
      store.set(SONG_LIBRARY_KEY, bad);
      expect(loadSongs()).toMatchObject({ songs: {}, unreadable: true });
      expect(saveSong('New', 'd')).toEqual({ ok: false, reason: 'damaged' });
      expect(deleteSong('New')).toEqual({ ok: false, reason: 'damaged' });
      expect(store.get(SONG_LIBRARY_KEY)).toBe(bad);
    }
  });

  it('a library from a newer version is never written over either (told apart: newer)', () => {
    const newer = JSON.stringify({ v: 2, songs: {} });
    store.set(SONG_LIBRARY_KEY, newer);
    expect(loadSongs()).toMatchObject({ songs: {}, unreadable: true, reason: 'newer' });
    expect(saveSong('New', 'd')).toEqual({ ok: false, reason: 'newer' });
    expect(deleteSong('New')).toEqual({ ok: false, reason: 'newer' });
    expect(store.get(SONG_LIBRARY_KEY)).toBe(newer);
  });

  it('two tabs: each save re-reads the library, so neither tab loses the other’s songs', () => {
    saveSong('From A', 'c');
    // Tab B writes its own song meanwhile (straight into storage, as another tab would).
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { 'From A': 'c', 'From B': 'e' } }));
    expect(saveSong('A again', 'd')).toEqual({ ok: true });
    expect(Object.keys(loadSongs().songs).sort()).toEqual(['A again', 'From A', 'From B']);
    // B deleted a song A then renames: refused as missing, nothing brought back.
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { 'From B': 'e' } }));
    expect(renameSong('From A', 'X')).toEqual({ ok: false, reason: 'missing' });
    expect(Object.keys(loadSongs().songs)).toEqual(['From B']);
  });

  it('a stale tab (data imported or erased in another tab) writes nothing and is told', () => {
    saveSong('Kept', 'c');
    let told = 0;
    onStaleStorage(() => told++);
    store.set(DATA_EPOCH_KEY, 'another-tab');
    expect(saveSong('New', 'd')).toEqual({ ok: false, reason: 'stale' });
    expect(renameSong('Kept', 'X')).toEqual({ ok: false, reason: 'stale' });
    expect(deleteSong('Kept')).toEqual({ ok: false, reason: 'stale' });
    expect(told).toBeGreaterThan(0);
    expect(raw().songs).toEqual({ Kept: 'c' });
  });
});

describe('Music Lab library: backups, Erase and the online copy carry it', () => {
  it('is a game key, read into a backup and the online copy as stored', () => {
    saveSong('Tune', 'pulse1: c');
    expect(isGameKey(SONG_LIBRARY_KEY)).toBe(true);
    const data = readGameData(fakeStorage);
    expect(data[SONG_LIBRARY_KEY]).toBe(store.get(SONG_LIBRARY_KEY));
    expect(onlineCopy(data)[SONG_LIBRARY_KEY]).toBe(store.get(SONG_LIBRARY_KEY));
  });

  it('Erase all data removes it', () => {
    saveSong('Tune', 'pulse1: c');
    expect(eraseGameData(fakeStorage)).toEqual({ ok: true });
    expect(store.has(SONG_LIBRARY_KEY)).toBe(false);
  });

  it('a backup import takes the library only in its stored shape', () => {
    expect(valueFits(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { A: 'c' } }))).toBe(true);
    // A damaged entry is the library reader's to skip, not a reason to refuse the whole backup.
    expect(valueFits(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { A: 3 } }))).toBe(true);
    expect(valueFits(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: [] }))).toBe(false);
    expect(valueFits(SONG_LIBRARY_KEY, JSON.stringify(['x']))).toBe(false);
    expect(valueFits(SONG_LIBRARY_KEY, '{nope')).toBe(false);
  });
});
