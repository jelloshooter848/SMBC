import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { compileSong, parseMml, type Track } from './mml';
import { scheduleOnce } from './sequencer';
import type { Voice } from './apu';

/*
 * Music Lab (0.4.77) reads the game's own songs through the same parser and gave its errors a line
 * and column. Every built-in song and sound must still parse, and render, exactly as before:
 * the fixture holds a hash of each one's events and of the notes it sends the synth, taken from
 * the parser as it was before Music Lab. Regenerate only for a deliberate music change:
 * SONG_PARITY_WRITE=1 pnpm vitest run src/engine/audio/song-parity.test.ts
 */

const FIXTURE = new URL('./song-parity.fixture.json', import.meta.url);

const hash = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** Every note the synth is sent for one pass of the tracks (scheduleOnce on recording voices). */
function render(tracks: Track[], bpm: number): string {
  const notes: unknown[] = [];
  const voice = (ch: number): Voice =>
    ({
      note: (n: number, t: number, d: number, o: unknown) => notes.push([ch, n, +t.toFixed(6), +d.toFixed(6), o]),
      stop: () => undefined,
    }) as unknown as Voice;
  const ctx = { currentTime: 0 } as unknown as BaseAudioContext;
  scheduleOnce(
    ctx,
    tracks.map((track, i) => ({ track, voice: voice(i) })),
    bpm,
    0,
  );
  return hash(notes);
}

function current(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of songs) {
    const c = compileSong(s);
    const t = c.tracks;
    const list = [t.pulse1, t.pulse2, t.triangle, t.noise].filter((x): x is Track => !!x);
    out[`song:${s.id}`] = `${hash(c)}/${render(list, s.bpm)}`;
  }
  for (const f of sfx) {
    const list: Track[] = [];
    if (f.pulse) list.push(parseMml(f.pulse, 'pulse'));
    if (f.pulse2) list.push(parseMml(f.pulse2, 'pulse'));
    if (f.noise) list.push(parseMml(f.noise, 'noise'));
    if (f.triangle) list.push(parseMml(f.triangle, 'triangle'));
    out[`sfx:${f.id}`] = `${hash(list)}/${render(list, f.bpm ?? 150)}`;
  }
  return out;
}

describe('built-in songs parse and render as before Music Lab', () => {
  it('every song and sound matches its fixture hash', () => {
    const now = current();
    if (process.env.SONG_PARITY_WRITE) writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n');
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
    expect(Object.keys(now).length).toBeGreaterThan(100);
    expect(now).toEqual(fixture);
  });
});
