import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MmlError, parseMml } from '@engine/audio/mml';
import { adoptDataEpoch } from '@engine/save/storage';
import { valueFits } from '@engine/save/backup';
import { decodeShare, encodeShare, songCode, takeSongCode } from '@engine/share';
import {
  MAX_SONG_CHARS,
  SONG_LIBRARY_KEY,
  clearDamagedSongLibrary,
  deleteSong,
  loadSongs,
  renameSong,
  saveSong,
} from './library';
import { MAX_SONG_STEPS, parseSongDoc, readTitle, type DocError } from './song-doc';

/*
 * The break-it review of Music Lab (v0.4.77), tests first: hostile song text and links, song
 * names that are Object.prototype's, CRLF positions, a song with no notes, a newer library.
 */

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  adoptDataEpoch();
});
afterEach(() => store.clear());

const err = (text: string): DocError => {
  const r = parseSongDoc(text);
  if (r.ok) throw new Error('expected an error');
  return r.error;
};

describe('MUST 1: repeats cannot hang the tab', () => {
  it('parseMml stops at its step limit with an ordinary error where it was hit', () => {
    const t0 = Date.now();
    let e: MmlError | null = null;
    try {
      parseMml('[[[[c64]99]99]99]99', 'pulse', { maxSteps: 1000 });
    } catch (x) {
      e = x as MmlError;
    }
    expect(e).toBeInstanceOf(MmlError);
    expect(e?.reason).toMatch(/too long/);
    expect(Date.now() - t0).toBeLessThan(500);
    // A repeat of nothing, run millions of times, is caught too.
    expect(() => parseMml('c []9999999', 'pulse', { maxSteps: 1000 })).toThrow(MmlError);
    // Without a limit nothing changes (the built-in songs: song-parity.test.ts).
    expect(parseMml('[c]3').events).toHaveLength(3);
  });

  it('Music Lab documents use the limit: the hostile link text is an error, quickly, with a position', () => {
    const t0 = Date.now();
    const e = err('pulse1: [[[[c64]99]99]99]99');
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(e).toMatchObject({ line: 1, channel: 'pulse1' });
    expect(e.message).toMatch(/too long/);
    expect(err('pulse1: c []9999999').message).toMatch(/too long/);
    expect(MAX_SONG_STEPS).toBeGreaterThanOrEqual(50_000);
  });

  it('a #song= hash is read once and cleared, so a reload does not open it again', () => {
    const replaced: string[] = [];
    const win = {
      location: { hash: '#song=abc_-1', pathname: '/SMBC/', search: '?x=1' },
      history: { replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) },
    };
    expect(takeSongCode(win)).toBe('abc_-1');
    expect(replaced).toEqual(['/SMBC/?x=1']);
    // Any other hash is left alone.
    win.location.hash = '#level=abc';
    expect(takeSongCode(win)).toBeNull();
    expect(replaced).toHaveLength(1);
  });

  it('songCode reads only a whole #song= hash', () => {
    expect(songCode('#song=abc')).toBe('abc');
    expect(songCode('#song=abc&x=1')).toBeNull();
    expect(songCode('#xsong=abc')).toBeNull();
    expect(songCode('x#song=abc')).toBeNull();
    expect(songCode('#song=')).toBeNull();
  });
});

describe('MUST 2: a song link inflates at most a capped size', () => {
  it('a link that inflates past the cap is refused; one within it decodes', async () => {
    const big = 'c'.repeat(MAX_SONG_CHARS * 4 + 10);
    const code = await encodeShare(big);
    expect(code[0]).toBe('z');
    await expect(decodeShare(code, MAX_SONG_CHARS * 4)).rejects.toThrow(/too big/);
    const ok = 'pulse1: c d e';
    expect(await decodeShare(await encodeShare(ok), MAX_SONG_CHARS * 4)).toBe(ok);
    // Without a cap (level links) it is as before.
    expect(await decodeShare(code)).toBe(big);
  });

  it('an uncompressed link longer than the cap is refused too', async () => {
    const code = 'r' + btoa('c'.repeat(200)).replace(/=+$/, '');
    await expect(decodeShare(code, 100)).rejects.toThrow(/too big/);
  });
});

describe('SHOULD 6: song names that are Object.prototype’s', () => {
  it('__proto__, constructor and toString save, list, rename and delete as any name', () => {
    for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(saveSong(name, `pulse1: c ; ${name}`), name).toEqual({ ok: true });
      expect(loadSongs().songs[name], name).toBe(`pulse1: c ; ${name}`);
    }
    expect(Object.keys(loadSongs().songs).sort()).toEqual(
      ['__proto__', 'constructor', 'hasOwnProperty', 'toString'].sort(),
    );
    expect(renameSong('toString', 'valueOf')).toEqual({ ok: true });
    expect(renameSong('valueOf', 'constructor')).toEqual({ ok: false, reason: 'exists' });
    expect(deleteSong('__proto__')).toEqual({ ok: true });
    expect(Object.keys(loadSongs().songs).sort()).toEqual(['constructor', 'hasOwnProperty', 'valueOf']);
  });

  it('a name that is not in the library is missing, even when it is a prototype name', () => {
    expect(renameSong('constructor', 'X')).toEqual({ ok: false, reason: 'missing' });
    expect(deleteSong('toString')).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('SHOULD 7: the library key is always an object', () => {
  it('a backup with the library as null (or a list) is refused', () => {
    expect(valueFits(SONG_LIBRARY_KEY, 'null')).toBe(false);
    expect(valueFits(SONG_LIBRARY_KEY, '[]')).toBe(false);
    expect(valueFits(SONG_LIBRARY_KEY, '3')).toBe(false);
  });
});

describe('NITs', () => {
  it('8: CRLF text keeps its positions', () => {
    expect(err('pulse1:\r\n  c d\r\n  e Z f')).toMatchObject({ line: 3, col: 5 });
    expect(err('title: a\r\ntempo: 999\r\npulse1: c')).toMatchObject({ line: 2, col: 8 });
    const r = parseSongDoc('title: a\r\ntempo: 120\r\nloop: off\r\npulse1: c d\r\n');
    expect(r.ok && [r.doc.title, r.doc.tempo, r.doc.loop]).toEqual(['a', 120, false]);
  });

  it('9: commands without a single note or rest are "no notes yet"', () => {
    expect(err('loop: off\npulse1: v10').message).toMatch(/no notes yet/);
    expect(err('pulse1: v10 o4\nnoise: v3').message).toMatch(/no notes yet/);
    expect(parseSongDoc('loop: off\npulse1: r4').ok).toBe(true);
  });

  it('10: the title line is read even when the song has an error', () => {
    expect(readTitle('title: My jam ; draft\npulse1: z')).toBe('My jam ; draft');
    expect(readTitle('pulse1: c')).toBe('');
  });

  it('11: a library from a newer version is told apart from a damaged one, and can be cleared', () => {
    store.set(SONG_LIBRARY_KEY, JSON.stringify({ v: 2, songs: {} }));
    expect(loadSongs()).toMatchObject({ unreadable: true, reason: 'newer' });
    expect(saveSong('A', 'c')).toEqual({ ok: false, reason: 'newer' });
    expect(clearDamagedSongLibrary()).toEqual({ ok: true });
    store.set(SONG_LIBRARY_KEY, '{nope');
    expect(loadSongs()).toMatchObject({ unreadable: true, reason: 'damaged' });
  });
});
