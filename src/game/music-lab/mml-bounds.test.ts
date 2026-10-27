import { describe, expect, it } from 'vitest';
import { MmlError, midiToHz, parseMml } from '@engine/audio/mml';
import { songs } from '@content/music/songs';
import { songToDoc as songToDocText } from './song-doc';
import { MAX_SONG_EVENTS, MAX_SONG_STEPS, parseSongDoc } from './song-doc';

/*
 * Pre-0.5.0 items 255 and 256 (Music Lab review), tests first: with a step budget set, one command
 * can't scan the whole text over and over, and a note or slide can't reach a frequency the synth
 * refuses. Without a budget (the game's own songs and sounds) parsing is exactly as before.
 */

/** The 83-character `#song=` link of the review: `pulse1:` + `[c+-+-…(about 19k)]49000`. */
const HOSTILE = 'pulse1:[c' + '+-'.repeat(9_500) + ']49000';

const err = (src: string, ch: 'pulse' | 'triangle' | 'noise' = 'pulse'): MmlError => {
  try {
    parseMml(src, ch, { maxSteps: MAX_SONG_STEPS });
  } catch (e) {
    if (e instanceof MmlError) return e;
    throw e;
  }
  throw new Error(`no error for ${src.slice(0, 40)}`);
};

describe('255: the budget counts the characters read', () => {
  it('the review link is refused fast, as too long', () => {
    const t0 = performance.now();
    const r = parseSongDoc(HOSTILE);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/too long/);
  });

  it('a long comment inside a repeat counts each time through', () => {
    // Four commands a time through (under the old count: 1,600 steps); 400,000 characters.
    const src = `[c ;${'x'.repeat(1000)}\n]400`;
    expect(err(src).reason).toMatch(/too long/);
  });

  it('a long run of sharps and flats inside a repeat counts each time through', () => {
    expect(err(`[c${'+-'.repeat(2000)}]200`).reason).toMatch(/too long/);
  });

  it('the digits after ] count each time they are read again (review: a 71-character link)', () => {
    const t0 = performance.now();
    const r = parseSongDoc('pulse1:[c]' + '0'.repeat(19_000) + '99999');
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/too long/);
  });

  it('three channels of the same, each with 6,000 zeros, are refused fast too', () => {
    const ch = (name: string) => `${name}:[c]${'0'.repeat(6_000)}99999\n`;
    const t0 = performance.now();
    const r = parseSongDoc(ch('pulse1') + ch('pulse2') + ch('triangle'));
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.ok).toBe(false);
  });

  it('a nested repeat’s long count is counted too', () => {
    const t0 = performance.now();
    expect(err(`[[c]${'0'.repeat(5_000)}99]${'0'.repeat(5_000)}99`).reason).toMatch(/too long/);
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('the refusal says the text is too long to read, not a step count', () => {
    const e = err(`[c]${'0'.repeat(19_000)}99999`);
    expect(e.reason).toBe('too long to read (check the repeat counts)');
  });

  it('every game song still reads within Music Lab’s budget', () => {
    for (const s of songs)
      for (const ch of ['pulse1', 'pulse2', 'triangle', 'noise'] as const) {
        const src = s[ch];
        if (!src) continue;
        const kind = ch === 'noise' ? 'noise' : ch === 'triangle' ? 'triangle' : 'pulse';
        expect(() => parseMml(src, kind, { maxSteps: MAX_SONG_STEPS }), `${s.id} ${ch}`).not.toThrow();
      }
  });

  it('without a budget nothing changes: the long run still reads (no limit)', () => {
    const t = parseMml(`[c${'+-'.repeat(2000)}]200`);
    expect(t.events).toHaveLength(200);
    expect(t.events[0]?.note).toBe(60);
  });
});

describe('256: with a budget, notes stay 0-127 and slides within ±96', () => {
  it('a slide past 96 semitones either way is an error, at the p', () => {
    expect(err('c p97 c').reason).toMatch(/slide/);
    expect(err('c p-97 c').reason).toMatch(/slide/);
    expect(err('c p-97 c').start).toBe(2);
    expect(err('p99999999999999999999999 c').reason).toMatch(/slide/);
    expect(() => parseMml('p96 c p-96 c', 'pulse', { maxSteps: MAX_SONG_STEPS })).not.toThrow();
  });

  it('a note above 127 or below 0 is an error, at the note', () => {
    expect(err(`c${'+'.repeat(19_000)}`).reason).toMatch(/note/);
    expect(err('o0 c-------------').reason).toMatch(/note/);
    expect(err('c d o8 b+++++++++').start).toBe(7);
    // The ends of the range are fine: o8 b+ is 120 (a semitone over b), o0 c- is 11.
    expect(() => parseMml('o8 b+ g+++++++ o0 c-', 'pulse', { maxSteps: MAX_SONG_STEPS })).not.toThrow();
  });

  it('every frequency a bounded song can ask for is finite', () => {
    const t = parseMml('o8 g+++++++ p96 c o0 c- p-96 c', 'pulse', { maxSteps: MAX_SONG_STEPS });
    for (const e of t.events) {
      expect(Number.isFinite(midiToHz(e.note as number))).toBe(true);
      expect(Number.isFinite(midiToHz((e.note as number) + e.slide))).toBe(true);
    }
  });

  it('without a budget nothing changes: big slides and notes still parse', () => {
    expect(parseMml('p200 c').events[0]?.slide).toBe(200);
    expect(parseMml(`c${'+'.repeat(200)}`).events[0]?.note).toBe(260);
  });
});

/** Item 285: the 81-character link of the review, about a million notes over four channels. */
const NOTE_BOMB = ['pulse1', 'pulse2', 'triangle']
  .map((ch) => `${ch}:[${'c'.repeat(440)}]560\n`)
  .concat(`noise:[${'k'.repeat(440)}]560\n`)
  .join('');

describe('285: with a budget, the notes are capped too', () => {
  it('a channel past maxEvents is "too many notes", at the note that passed it', () => {
    let e: unknown = null;
    try {
      parseMml('r [c d]200', 'pulse', { maxSteps: MAX_SONG_STEPS, maxEvents: 100 });
    } catch (x) {
      e = x;
    }
    expect(e).toBeInstanceOf(MmlError);
    expect((e as MmlError).reason).toBe('too many notes (check the repeat counts)');
    // The 101st event: the rest, then 50 times through c d.
    expect((e as MmlError).start).toBe(3);
    expect(() => parseMml('r [c d]2', 'pulse', { maxSteps: MAX_SONG_STEPS, maxEvents: 5 })).not.toThrow();
  });

  it('the review link is refused fast, as too many notes', () => {
    const t0 = performance.now();
    const r = parseSongDoc(NOTE_BOMB);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/^pulse1: too many notes/);
  });

  it('the cap is for the whole song: four channels of 30,000 notes each are refused, on the fourth', () => {
    const doc = ['pulse1', 'pulse2', 'triangle']
      .map((ch) => `${ch}: [c]30000\n`)
      .concat('noise: [k]30000\n')
      .join('');
    const r = parseSongDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/^noise: too many notes/);
    expect(MAX_SONG_EVENTS).toBe(100_000);
  });

  it('the game’s songs are far under it (the most, 705 notes, about 140 times under)', () => {
    for (const s of songs) {
      const r = parseSongDoc(songToDocText(s));
      expect(r.ok, s.id).toBe(true);
      if (r.ok) {
        const n = Object.values(r.doc.compiled.tracks).reduce((a, t) => a + (t?.events.length ?? 0), 0);
        expect(n * 100, s.id).toBeLessThan(MAX_SONG_EVENTS);
      }
    }
  });

  it('without a budget nothing changes: no cap on notes', () => {
    expect(parseMml('[c]200000').events).toHaveLength(200_000);
  });
});
