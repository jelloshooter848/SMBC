import { describe, expect, it } from 'vitest';
import { compileSong, PPQ, type Track } from '@engine/audio/mml';
import { MAP_PAGES, mapPage, SMB_PAGES } from '@content/worldmap';
import { songs } from './songs';
import { WORLD_MAP_SONGS, worldMapSongs } from './world-maps';

// A song for each world map (0.4.48): eight original loops, one per SMB page, each in the style
// of its world's game. The warp hub, the Lost Kingdom and Kakariko keep their own music.

const byId = (id: string) => songs.find((s) => s.id === id);
const seconds = (ticks: number, bpm: number): number => (ticks / PPQ) * (60 / bpm);
const maxVol = (t: Track | undefined): number =>
  Math.max(0, ...(t?.events ?? []).map((e) => (e.note === null ? 0 : e.vol)));
const BAR = PPQ * 4;

describe('the world map songs', () => {
  it('are eight, one per world, all registered in the song list', () => {
    expect(WORLD_MAP_SONGS).toHaveLength(8);
    expect(new Set(WORLD_MAP_SONGS).size).toBe(8);
    expect(worldMapSongs.map((s) => s.id)).toEqual(WORLD_MAP_SONGS);
    for (const id of WORLD_MAP_SONGS) expect(byId(id), id).toBeDefined();
  });

  it('play on their own world pages, in order', () => {
    expect(SMB_PAGES.map((p) => p.music)).toEqual(WORLD_MAP_SONGS);
  });

  it('leave the other pages their own music: the warp hub, the Lost Kingdom, the Arena', () => {
    for (const p of MAP_PAGES.filter((p) => p.group !== 'smb'))
      expect(WORLD_MAP_SONGS, p.id).not.toContain(p.music);
    expect(mapPage('hub')?.music).toBe('map');
  });

  describe.each(worldMapSongs.map((s) => [s.id, s] as const))('%s', (_id, song) => {
    const c = compileSong(song);
    const tracks = c.tracks as Record<string, Track | undefined>;

    it('loops whole bars from the top, about 20-40 seconds a pass, on all four voices', () => {
      expect(c.loop).toBe(true);
      expect(c.length % BAR).toBe(0);
      expect(tracks.pulse1?.loopTick).toBe(0);
      const s = seconds(c.length, song.bpm);
      expect(s).toBeGreaterThanOrEqual(20);
      expect(s).toBeLessThanOrEqual(40);
      for (const ch of ['pulse1', 'pulse2', 'triangle', 'noise'])
        expect(tracks[ch]?.events.length, ch).toBeGreaterThan(0);
    });

    it('is no louder than the existing map song, voice for voice', () => {
      const map = compileSong(byId('map') as (typeof songs)[number]).tracks as Record<
        string,
        Track | undefined
      >;
      for (const ch of ['pulse1', 'pulse2', 'noise'])
        expect(maxVol(tracks[ch]), ch).toBeLessThanOrEqual(maxVol(map[ch]));
    });
  });

  it('are distinct from each other and from the map song: no two share a tempo and a lead', () => {
    const lead = (id: string) => {
      const t = compileSong(byId(id) as (typeof songs)[number]).tracks.pulse1 as Track;
      return t.events.map((e) => e.note).join(',');
    };
    const leads = [...WORLD_MAP_SONGS, 'map', 'map-bowser'].map(lead);
    expect(new Set(leads).size).toBe(leads.length);
  });
});
