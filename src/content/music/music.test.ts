import { describe, expect, it } from 'vitest';
import { compileSong, parseMml, PPQ, type Sfx, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { sfx } from '../sfx/sfx';

const SONG_IDS = [
  'overworld',
  'underground',
  'castle',
  'water',
  'star',
  'title',
  'hurry',
  'death',
  'level-clear',
  'castle-clear',
  'game-over',
  'world-clear',
  'map',
  'map-bowser',
  'credits',
  'dungeon',
  'keeper',
];

const SFX_IDS = [
  'jump-small',
  'jump-big',
  'coin',
  'stomp',
  'kick',
  'bump',
  'break',
  'powerup-appear',
  'powerup',
  'pipe',
  '1up',
  'fireball',
  'flagpole',
  'bowser-fall',
  'bowser-laugh',
  'bowser-flame',
  'firework',
  'pause',
  'sword',
  'buster',
  'hit',
  'hurt-enemy',
  'charge',
  'select',
  'timer-tick',
  'vine',
  'secret',
  'sword-stab',
  'door-open',
  'key-get',
];

const seconds = (ticks: number, bpm: number): number => (ticks / PPQ) * (60 / bpm);

describe('songs', () => {
  it('defines every expected id exactly once', () => {
    const ids = songs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of SONG_IDS) expect(ids).toContain(id);
  });

  describe.each(songs.map((s) => [s.id, s] as const))('%s', (_id, song) => {
    const compiled = compileSong(song);
    const tracks = Object.entries(compiled.tracks) as [string, Track][];

    it('compiles with at least one channel', () => {
      expect(tracks.length).toBeGreaterThan(0);
      for (const [, t] of tracks) expect(t.events.length).toBeGreaterThan(0);
    });

    it('has the same length on every channel', () => {
      const lengths = Object.fromEntries(tracks.map(([name, t]) => [name, t.length]));
      for (const [, t] of tracks) expect(t.length, JSON.stringify(lengths)).toBe(compiled.length);
    });

    it('has the same loop point on every channel', () => {
      const loops = tracks.map(([, t]) => t.loopTick);
      expect(new Set(loops).size).toBe(1);
      expect(loops[0]).toBeLessThan(compiled.length);
    });

    if (song.loop) {
      it('is at least 4 bars long', () => {
        expect(compiled.length).toBeGreaterThanOrEqual(PPQ * 16);
      });
    } else {
      it('is a jingle: not looping and under 8 seconds', () => {
        expect(compiled.loop).toBe(false);
        expect(seconds(compiled.length, song.bpm)).toBeLessThan(8);
      });
    }
  });
});

describe('sfx', () => {
  it('defines every expected id exactly once', () => {
    const ids = sfx.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of SFX_IDS) expect(ids).toContain(id);
  });

  const kinds: [keyof Sfx, 'pulse' | 'triangle' | 'noise'][] = [
    ['pulse', 'pulse'],
    ['pulse2', 'pulse'],
    ['triangle', 'triangle'],
    ['noise', 'noise'],
  ];

  describe.each(sfx.map((s) => [s.id, s] as const))('%s', (_id, effect) => {
    const bpm = effect.bpm ?? 150;
    const tracks = kinds.flatMap(([key, kind]) => {
      const src = effect[key];
      return typeof src === 'string' ? [[key, parseMml(src, kind)] as const] : [];
    });

    it('parses every channel on its voice kind', () => {
      expect(tracks.length).toBeGreaterThan(0);
      for (const [, t] of tracks) expect(t.events.some((e) => e.note !== null)).toBe(true);
    });

    it('is under 3 seconds', () => {
      for (const [, t] of tracks) expect(seconds(t.length, bpm)).toBeLessThan(3);
    });
  });
});

describe("Link's dungeon music", () => {
  const song = (id: string) => compileSong(songs.find((s) => s.id === id) as (typeof songs)[number]);

  it('the dungeon theme and the boss loop both loop, the boss faster and shorter', () => {
    const dungeon = song('dungeon');
    const keeper = song('keeper');
    expect(dungeon.loop && keeper.loop).toBe(true);
    expect(keeper.bpm).toBeGreaterThan(dungeon.bpm);
    expect(seconds(keeper.length, keeper.bpm)).toBeLessThan(seconds(dungeon.length, dungeon.bpm));
    // whole bars on every channel
    for (const s of [dungeon, keeper]) expect(s.length % (PPQ * 4)).toBe(0);
  });

  it('the puzzle chime rises to its last note', () => {
    const chime = sfx.find((s) => s.id === 'secret') as Sfx;
    const notes = parseMml(chime.pulse as string, 'pulse')
      .events.map((e) => e.note)
      .filter((n): n is number => n !== null);
    expect(notes.at(-1)).toBe(Math.max(...notes));
    expect(notes.at(-1)).toBeGreaterThan(notes[0] as number);
  });
});
