import { describe, expect, it } from 'vitest';
import { compileSong, PPQ, type Track } from '@engine/audio/mml';
import { songs } from './songs';

// BUG-14: the REMIX title ('title') has its own theme, so going to the CLASSIC title (which plays
// 'overworld') no longer sounds like the same song restarting.
const song = (id: string) => {
  const s = songs.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return { song: s, compiled: compileSong(s) };
};
const BAR = PPQ * 4;
const pitches = (t: Track, from = 0): number[] =>
  t.events.filter((e) => e.tick >= from && e.note !== null).map((e) => e.note as number);
const intervals = (p: number[]): string[] => p.slice(1).map((n, i) => String(n - (p[i] as number)));

describe('the REMIX title theme', () => {
  const title = song('title');
  const overworld = song('overworld');

  it('keeps a two-bar fanfare before the loop point, then loops from bar 3', () => {
    expect(title.song.loop).toBe(true);
    for (const t of Object.values(title.compiled.tracks)) expect(t.loopTick).toBe(2 * BAR);
    expect(Object.keys(title.compiled.tracks).sort()).toEqual(['noise', 'pulse1', 'pulse2', 'triangle']);
  });

  it('hits the fanfare downbeat at tick 0, where the stamp lands', () => {
    for (const t of Object.values(title.compiled.tracks)) {
      const first = t.events[0];
      expect(first?.tick).toBe(0);
      expect(first?.note).not.toBeNull();
    }
  });

  it('has a 16-to-24-bar loop in C at a different tempo from the overworld', () => {
    const loopBars = (title.compiled.length - 2 * BAR) / BAR;
    expect(loopBars).toBeGreaterThanOrEqual(16);
    expect(loopBars).toBeLessThanOrEqual(24);
    expect(title.song.bpm).not.toBe(overworld.song.bpm);
    // Ends its loop on the dominant G (pulse1's last note is B, the leading tone into C).
    const lead = title.compiled.tracks.pulse1 as Track;
    expect((lead.events.at(-1)?.note as number) % 12).toBe(11);
  });

  it("shares no six-note melodic shape with the overworld's tune", () => {
    const mine = intervals(pitches(title.compiled.tracks.pulse1 as Track)).join(',');
    const theirs = intervals(pitches(overworld.compiled.tracks.pulse1 as Track));
    for (let i = 0; i + 5 <= theirs.length; i++) {
      const window = theirs.slice(i, i + 5).join(',');
      expect(mine.includes(`,${window},`) || mine.startsWith(`${window},`), window).toBe(false);
    }
  });
});
