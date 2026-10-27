import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATA_EPOCH_KEY, adoptDataEpoch, onStaleStorage } from '@engine/save/storage';
import { SONG_LIBRARY_KEY, clearDamagedSongLibrary, loadSongs, saveSong } from './library';

/*
 * Owner item 225 (rule 33a: the edge cases first): a song library that is damaged as a whole, or
 * written by a newer version, can be cleared from Music Lab itself (no Reset game needed). Only
 * such a library: a readable one is never cleared this way, and storage that cannot be read, or
 * a stale tab, clears nothing. A single damaged entry is still only skipped.
 */

const store = new Map<string, string>();
let throwOn: 'get' | 'remove' | null = null;

beforeEach(() => {
  store.clear();
  throwOn = null;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => {
      if (throwOn === 'get') throw new Error('SecurityError');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => {
      if (throwOn === 'remove') throw new Error('SecurityError');
      store.delete(k);
    },
  };
  adoptDataEpoch();
});
afterEach(() => {
  onStaleStorage(null);
  store.clear();
  adoptDataEpoch();
});

const DAMAGED = ['{nope', '"text"', '[1]', JSON.stringify({ v: 1, songs: [] })];
const NEWER = JSON.stringify({ v: 2, songs: { Future: 'c' } });

describe('item 225: clearing a damaged song library', () => {
  it('loadSongs says why the library is unreadable: damaged, newer, or storage', () => {
    store.set(SONG_LIBRARY_KEY, '{nope');
    expect(loadSongs()).toMatchObject({ unreadable: true, reason: 'damaged' });
    store.set(SONG_LIBRARY_KEY, NEWER);
    expect(loadSongs()).toMatchObject({ unreadable: true, reason: 'newer' });
    throwOn = 'get';
    expect(loadSongs()).toMatchObject({ unreadable: true, reason: 'read' });
  });

  it('a damaged or newer library is cleared, and saving works again after', () => {
    for (const bad of [...DAMAGED, NEWER]) {
      store.set(SONG_LIBRARY_KEY, bad);
      expect(clearDamagedSongLibrary()).toEqual({ ok: true });
      expect(store.has(SONG_LIBRARY_KEY)).toBe(false);
      expect(saveSong('Fresh', 'pulse1: c')).toEqual({ ok: true });
      store.delete(SONG_LIBRARY_KEY);
    }
  });

  it('a readable library is never cleared this way (another tab may have mended it)', () => {
    saveSong('Kept', 'c');
    expect(clearDamagedSongLibrary()).toEqual({ ok: false, reason: 'not-damaged' });
    expect(loadSongs().songs).toEqual({ Kept: 'c' });
    // A library with only a damaged entry is readable: the entry is skipped, nothing cleared.
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs: { Good: 'c', Bad: 7 } }));
    expect(clearDamagedSongLibrary()).toEqual({ ok: false, reason: 'not-damaged' });
    expect(loadSongs()).toMatchObject({ songs: { Good: 'c' }, damaged: 1 });
  });

  it('nothing stored: nothing to clear', () => {
    expect(clearDamagedSongLibrary()).toEqual({ ok: false, reason: 'not-damaged' });
  });

  it('storage that cannot be read clears nothing', () => {
    store.set(SONG_LIBRARY_KEY, '{nope');
    throwOn = 'get';
    expect(clearDamagedSongLibrary()).toEqual({ ok: false, reason: 'read' });
    throwOn = null;
    expect(store.get(SONG_LIBRARY_KEY)).toBe('{nope');
  });

  it('storage that refuses the removal: reported, the value left', () => {
    store.set(SONG_LIBRARY_KEY, '{nope');
    throwOn = 'remove';
    expect(clearDamagedSongLibrary()).toEqual({ ok: false, reason: 'write' });
    throwOn = null;
    expect(store.get(SONG_LIBRARY_KEY)).toBe('{nope');
  });

  it('a stale tab clears nothing and is told', () => {
    store.set(SONG_LIBRARY_KEY, '{nope');
    let told = 0;
    onStaleStorage(() => told++);
    store.set(DATA_EPOCH_KEY, 'other-tab');
    expect(clearDamagedSongLibrary()).toEqual({ ok: false, reason: 'stale' });
    expect(told).toBeGreaterThan(0);
    expect(store.get(SONG_LIBRARY_KEY)).toBe('{nope');
  });
});
