import { describe, expect, it } from 'vitest';
import { MmlError, midiToHz, parseMml } from '@engine/audio/mml';
import { songs } from '@content/music/songs';
import { MAX_SONG_STEPS, parseSongDoc } from './song-doc';

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
    // Four commands a time through (under the old count: 800 steps); 200,000 characters.
    const src = `[c ;${'x'.repeat(1000)}\n]200`;
    expect(err(src).reason).toMatch(/too long/);
  });

  it('a long run of sharps and flats inside a repeat counts each time through', () => {
    expect(err(`[c${'+-'.repeat(2000)}]200`).reason).toMatch(/too long/);
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
