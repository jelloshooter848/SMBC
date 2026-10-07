import { describe, expect, it } from 'vitest';
import { compileSong, PPQ, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { lookSongs } from './looks';
import { themeMusic } from '@game/level/schema';

const song = (id: string) => compileSong(songs.find((s) => s.id === id) as (typeof songs)[number]);
const track = (c: ReturnType<typeof song>, name: string) =>
  (c.tracks as Record<string, Track>)[name] as Track;
const pitchClasses = (t: Track) => new Set(t.events.flatMap((e) => (e.note === null ? [] : [e.note % 12])));
const bars = (c: ReturnType<typeof song>) => c.length / (PPQ * 4);
const sounding = (t: Track) => t.events.filter((e) => e.note !== null);
const notes = (t: Track) => sounding(t).map((e) => e.note);

describe('campaign look music (2-1, 3-1, 4-2)', () => {
  it('is registered with the game songs and plays as its look theme', () => {
    for (const s of lookSongs) expect(songs).toContain(s);
    expect(lookSongs.map((s) => s.id)).toEqual(['zelda2-field', 'mm-stage-31', 'brinstar']);
    expect(themeMusic('zelda2')).toBe('zelda2-field');
    expect(themeMusic('megaman-stage')).toBe('mm-stage-31');
    expect(themeMusic('brinstar')).toBe('brinstar');
  });

  it('each loops 16 whole bars on every channel', () => {
    for (const s of lookSongs) {
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      expect(bars(c), s.id).toBe(16);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
  });

  it("Link's field runs in sixteenths over an octave bass, A minor turning on E major", () => {
    const c = song('zelda2-field');
    expect(c.bpm).toBeGreaterThanOrEqual(144);
    expect(track(c, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
    expect(sounding(track(c, 'triangle')).every((e) => e.len === PPQ / 2)).toBe(true);
    const lead = pitchClasses(track(c, 'pulse1'));
    expect(lead.has(8)).toBe(true); // G-sharp
    expect(lead.has(6)).toBe(true); // F-sharp: the Dorian lift in bar 7
  });

  it("Mega Man's night stage is the fastest, skips in its bass and rolls sixteenths, E minor turning on B", () => {
    const c = song('mm-stage-31');
    expect(c.bpm).toBeGreaterThan(song('zelda2-field').bpm);
    expect(track(c, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
    const bass = sounding(track(c, 'triangle'));
    expect(bass.filter((e) => e.len === PPQ / 4).length).toBe(
      bass.filter((e) => e.len === PPQ / 2).length * (2 / 3),
    );
    expect(pitchClasses(track(c, 'pulse1')).has(3)).toBe(true); // D-sharp
    // not the station's tune
    expect(notes(track(c, 'pulse1'))).not.toEqual(notes(track(song('mm-station'), 'pulse1')));
  });

  it('Brinstar is the slowest: long lead notes over a syncopated bass, D minor turning on A', () => {
    const c = song('brinstar');
    expect(c.bpm).toBeLessThan(song('zelda2-field').bpm);
    const lead = sounding(track(c, 'pulse1'));
    expect(lead.reduce((a, e) => a + e.len, 0) / lead.length).toBeGreaterThanOrEqual(PPQ * 0.75);
    // the bass rests twice a bar; a dotted eighth and a sixteenth open every bar
    const bass = track(c, 'triangle').events;
    expect(bass.filter((e) => e.note === null).length).toBe(16 * 2);
    for (let bar = 0; bar < 16; bar++) {
      const first = bass.find((e) => e.tick === bar * PPQ * 4);
      expect([first?.len, first?.note === null], `bar ${bar + 1}`).toEqual([(PPQ * 3) / 4, false]);
    }
    expect(pitchClasses(track(c, 'pulse1')).has(1)).toBe(true); // C-sharp
    expect(notes(track(c, 'pulse1'))).not.toEqual(notes(track(song('cavern'), 'pulse1')));
  });
});
