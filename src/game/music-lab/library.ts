import { storageIsStale, storageReadable } from '@engine/save/storage';

/*
 * Music Lab's song library (item 136): the player's songs, by name, as their Music Lab text
 * (song-doc.ts). One game key, so a SAVE DATA backup, Erase all data and the online copy carry it
 * as they carry the level editor's `smbc.levels` (engine/save/backup.ts lists it).
 *
 * Every change re-reads what is stored and changes only its own entry, so a second tab's songs are
 * never lost. A library this build cannot read (not JSON, another shape, a newer format) or
 * storage that cannot be read is never written over; a stale tab (SAVE DATA's data marker) writes
 * nothing. Single entries that are not text are skipped on load and left as they are stored.
 */

export const SONG_LIBRARY_KEY = 'smbc.songs';
/** The most songs the library holds (a whole library stays well inside localStorage). */
export const MAX_SONGS = 50;
/** The longest song text kept (the game's longest song is about 6,000 characters). */
export const MAX_SONG_CHARS = 20_000;
export const MAX_SONG_NAME = 24;

export interface StoredSongLibrary {
  v: 1;
  songs: Record<string, unknown>;
}

export interface LoadedSongs {
  /** The readable songs, name to text. */
  songs: Record<string, string>;
  /** Entries skipped because they are not song text. */
  damaged: number;
  /** The library could not be read at all (storage, or damaged / newer data): it is never written. */
  unreadable: boolean;
}

export type SongRefusal =
  'name' | 'exists' | 'missing' | 'full' | 'too-long' | 'read' | 'damaged' | 'stale' | 'quota' | 'write';
export type SongWrite = { ok: true } | { ok: false; reason: SongRefusal };

/** What each refusal tells the player. */
export const SONG_REFUSALS: Record<SongRefusal, string> = {
  name: 'Give the song a name first.',
  exists: 'Another song already has that name.',
  missing: 'That song is no longer in the library.',
  full: `The library is full (${MAX_SONGS} songs). Delete one first.`,
  'too-long': 'That song is too long to save.',
  read: 'The library cannot be read on this device. Nothing was saved.',
  damaged: 'The library is damaged or from a newer version. Nothing was saved.',
  stale: 'The game data changed in another tab. Reloading.',
  quota: 'Storage is full. Nothing was saved.',
  write: 'Storage refused the change. Nothing was saved.',
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** `name` trimmed and cut to MAX_SONG_NAME, or null when nothing is left. */
export function cleanSongName(name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, MAX_SONG_NAME).trim();
  return n ? n : null;
}

type Raw = { ok: true; lib: StoredSongLibrary } | { ok: false; reason: 'read' | 'damaged' };

function readRaw(): Raw {
  if (!storageReadable()) return { ok: false, reason: 'read' };
  let text: string | null;
  try {
    text = localStorage.getItem(SONG_LIBRARY_KEY);
  } catch {
    return { ok: false, reason: 'read' };
  }
  if (text === null) return { ok: true, lib: { v: 1, songs: {} } };
  try {
    const v = JSON.parse(text) as unknown;
    if (isPlainObject(v) && v.v === 1 && isPlainObject(v.songs))
      return { ok: true, lib: { v: 1, songs: v.songs } };
  } catch {
    /* damaged */
  }
  return { ok: false, reason: 'damaged' };
}

const isSong = (t: unknown): t is string => typeof t === 'string' && t.length <= MAX_SONG_CHARS;

export function loadSongs(): LoadedSongs {
  const r = readRaw();
  if (!r.ok) return { songs: {}, damaged: 0, unreadable: true };
  const songs: Record<string, string> = {};
  let damaged = 0;
  for (const [name, text] of Object.entries(r.lib.songs)) {
    if (isSong(text)) songs[name] = text;
    else damaged++;
  }
  return { songs, damaged, unreadable: false };
}

const isQuota = (e: unknown): boolean => {
  const n = (e as { name?: string } | null)?.name;
  const c = (e as { code?: number } | null)?.code;
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || c === 22 || c === 1014;
};

/** Re-read the library, let `change` edit its songs (or refuse), and write it back. */
function update(change: (songs: Record<string, unknown>) => SongRefusal | null): SongWrite {
  if (storageIsStale()) return { ok: false, reason: 'stale' };
  const r = readRaw();
  if (!r.ok) return { ok: false, reason: r.reason };
  const songs = { ...r.lib.songs };
  const refused = change(songs);
  if (refused) return { ok: false, reason: refused };
  try {
    localStorage.setItem(SONG_LIBRARY_KEY, JSON.stringify({ v: 1, songs }));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: isQuota(e) ? 'quota' : 'write' };
  }
}

const count = (songs: Record<string, unknown>): number => Object.values(songs).filter(isSong).length;

/** Save `text` as `name` (a song already under that name is replaced). */
export function saveSong(name: string, text: string): SongWrite {
  const n = cleanSongName(name);
  if (!n) return { ok: false, reason: 'name' };
  if (text.length > MAX_SONG_CHARS) return { ok: false, reason: 'too-long' };
  return update((songs) => {
    if (!isSong(songs[n]) && count(songs) >= MAX_SONGS) return 'full';
    songs[n] = text;
    return null;
  });
}

export function renameSong(from: string, to: string): SongWrite {
  const n = cleanSongName(to);
  if (!n) return { ok: false, reason: 'name' };
  return update((songs) => {
    const text = songs[from];
    if (!isSong(text)) return 'missing';
    if (n === from) return null;
    if (n in songs) return 'exists';
    // Keep the library's order: the renamed song stays where it was.
    const entries = Object.entries(songs).map(([k, v]): [string, unknown] => (k === from ? [n, v] : [k, v]));
    for (const k of Object.keys(songs)) delete songs[k];
    for (const [k, v] of entries) songs[k] = v;
    return null;
  });
}

export function deleteSong(name: string): SongWrite {
  return update((songs) => {
    if (!(name in songs)) return 'missing';
    delete songs[name];
    return null;
  });
}
