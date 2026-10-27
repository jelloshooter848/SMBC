import { describe, expect, it } from 'vitest';
import { songs } from '@content/music/songs';
import { compileSong, MmlError, parseMml } from '@engine/audio/mml';
import {
  NEW_SONG,
  parseSongDoc,
  readSettings,
  setLoop,
  setTempo,
  songToDoc,
  type DocError,
} from './song-doc';

const err = (text: string): DocError => {
  const r = parseSongDoc(text);
  if (r.ok) throw new Error('expected an error');
  return r.error;
};

describe('MML errors carry a line and column (Music Lab)', () => {
  it('the parser reports the line, column and start of the bad command', () => {
    try {
      parseMml('c8 d8\n  e8 z');
      throw new Error('no error');
    } catch (e) {
      expect(e).toBeInstanceOf(MmlError);
      const m = e as MmlError;
      expect([m.line, m.col, m.start, m.pos]).toEqual([2, 6, 11, 11]);
      expect(m.message).toBe('unexpected "z" at 11: "8 d8\n  e8 z"');
    }
    // A bad value points at its command, not past it.
    const v = (() => {
      try {
        parseMml('c8\nv99 c');
      } catch (e) {
        return e as MmlError;
      }
    })() as MmlError;
    expect([v.reason, v.line, v.col]).toEqual(['volume 0-15 expected', 2, 1]);
    // An unclosed repeat points at its [.
    const u = (() => {
      try {
        parseMml('c [d [e]2');
      } catch (e) {
        return e as MmlError;
      }
    })() as MmlError;
    expect([u.reason, u.col]).toEqual(['unclosed [', 3]);
  });
});

describe('Music Lab documents', () => {
  it('every built-in song round-trips through a document to the very same compiled song', () => {
    for (const s of songs) {
      const r = parseSongDoc(songToDoc(s));
      if (!r.ok) throw new Error(`${s.id}: ${r.error.message} at ${r.error.line}:${r.error.col}`);
      const a = compileSong(s);
      const b = r.doc.compiled;
      expect({ ...b, id: s.id }, s.id).toEqual(a);
      expect(r.doc.title).toBe(s.id);
    }
  });

  it('the new-song template plays: all four channels, the same length', () => {
    const r = parseSongDoc(NEW_SONG);
    if (!r.ok) throw new Error(r.error.message);
    const t = r.doc.compiled.tracks;
    const lens = [t.pulse1, t.pulse2, t.triangle, t.noise].map((x) => x?.length);
    expect(new Set(lens).size).toBe(1);
    expect(r.doc).toMatchObject({ title: 'New song', tempo: 132, loop: true });
  });

  it('an MML error is placed at its line and column in the whole document', () => {
    const e = err('title: x\ntempo: 120\npulse1:\n  c d e\n  f g q9 a\nnoise: k s');
    expect(e).toMatchObject({ line: 5, col: 7, channel: 'pulse1', message: 'pulse1: gate 1-8 expected' });
    // The highlighted span covers the bad command.
    const text = 'pulse1: c d e\nnoise: k c';
    const e2 = err(text);
    expect(e2).toMatchObject({ line: 2, col: 10, channel: 'noise' });
    expect(text.slice(e2.start, e2.end)).toBe('c');
  });

  it('settings errors and stray text are placed too', () => {
    expect(err('tempo: 999\npulse1: c')).toMatchObject({ line: 1, col: 8, message: 'tempo 40-300 expected' });
    expect(err('loop: maybe\npulse1: c')).toMatchObject({ line: 1, col: 7 });
    expect(err('c d e')).toMatchObject({ line: 1, col: 1 });
    expect(err('pulse1: c\nbass: c')).toMatchObject({ line: 2, col: 1 });
    expect(err('pulse1: c\npulse1: d')).toMatchObject({
      line: 2,
      col: 1,
      message: 'pulse1 is written twice',
    });
    expect(err('title: empty')).toMatchObject({ line: 1, col: 1 });
  });

  it('comments and blank lines before the channels are fine', () => {
    const r = parseSongDoc('; my song\n\ntitle: A ; first try\npulse1: c4 ; hi: there\n');
    expect(r.ok && r.doc.title).toBe('A ; first try');
  });

  it('tempo and loop controls edit the text, keeping the rest', () => {
    let t = 'title: a\npulse1: c';
    t = setTempo(t, 999);
    expect(t).toBe('title: a\ntempo: 300\npulse1: c');
    t = setTempo(t, 90);
    t = setLoop(t, false);
    expect(t).toBe('title: a\ntempo: 90\nloop: off\npulse1: c');
    expect(readSettings(t)).toEqual({ tempo: 90, loop: false });
    expect(readSettings('pulse1: z')).toEqual({ tempo: 140, loop: true });
  });
});
