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
  // Mega Man's station.
  'mm-station',
  'mm-boss',
  // Samus's cavern below 4-2 and ZEBES ESCAPE.
  'cavern',
  'zebes-escape',
  // The Mini Game Arena.
  'arena',
  // Larry Koopa's airship and the bonus spot behind it.
  'airship',
  'smb3-boss',
  'toad-house',
  'bonus-game',
  // Simon's crypt under 5-4 and his mini game.
  'crypt',
  'cv-stage',
  'cv-boss',
  'cv-beast',
  // Ryu's hideout under 6-2 and his mini game.
  'dojo',
  'ng-stage',
  'ng-boss',
  'ng-cutscene',
  // Bill's jungle under 7-3 and his mini game.
  'contra-jungle',
  'contra-stage',
  'contra-boss',
  'contra-lair',
  'contra-card',
  // Sophia's Underworld and her mini game.
  'bm-area',
  'bm-dungeon',
  'bm-boss',
  'bm-garage',
  'bm-cutscene',
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
  // Shadow Keep v2 items.
  'boomerang',
  'bomb-fuse',
  'bomb-blast',
  'item-get',
  // Mega Man's station.
  'boss-fill',
  'beam',
  'capsule',
  // ZEBES ESCAPE.
  'alarm',
  // The bonus spot behind Larry's airship and the item inventory.
  'card-flip',
  'slot-stop',
  'bonus-win',
  'item-use',
  // Simon's crypt and his mini game.
  'whip-wall',
  'candle',
  'dracula-teleport',
  'beast-roar',
  // Ryu's hideout and his mini game.
  'panel-spin',
  'slash',
  'hawk',
  'clang',
  // Bill's jungle and his mini game.
  'bridge-boom',
  'falcon',
  'contra-death',
  'spread',
  'laser',
  'konami',
  // Sophia, Jason and the Underworld.
  'sophia-jump',
  'sophia-land',
  'sophia-cannon',
  'sophia-shoot-normal',
  'sophia-shoot-hyper',
  'sophia-shoot-crusher',
  'sophia-missile',
  'sophia-explode',
  'sophia-hit-enemy',
  'sophia-kill',
  'sophia-hover',
  'sophia-open',
  'sophia-hurt',
  'sophia-die',
  'sophia-select',
  'sophia-pickup',
  'jason-shot',
  'grenade',
  'mutant-die',
  'frog',
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

describe('Shadow Keep item sounds', () => {
  const effect = (id: string) => sfx.find((s) => s.id === id) as Sfx;
  const length = (id: string) => {
    const e = effect(id);
    const lens = (['pulse', 'pulse2', 'triangle', 'noise'] as const).flatMap((k) => {
      const src = e[k];
      const kind = k === 'pulse2' ? 'pulse' : k;
      return typeof src === 'string' ? [seconds(parseMml(src, kind).length, e.bpm ?? 150)] : [];
    });
    return Math.max(...lens);
  };

  it('the boomerang whirr and the fuse hiss are short enough to repeat while the item is out', () => {
    expect(length('boomerang')).toBeLessThanOrEqual(0.25);
    expect(length('bomb-fuse')).toBeLessThanOrEqual(0.25);
    expect(effect('bomb-fuse').noise).toBeDefined();
  });

  it('the blast is a big noise burst, longer than the fuse', () => {
    expect(effect('bomb-blast').noise).toBeDefined();
    expect(length('bomb-blast')).toBeGreaterThan(length('bomb-fuse'));
  });

  it('the item fanfare climbs to its last note and outlasts the key jingle', () => {
    const notes = parseMml(effect('item-get').pulse as string, 'pulse')
      .events.map((e) => e.note)
      .filter((n): n is number => n !== null);
    expect(notes.at(-1)).toBe(Math.max(...notes));
    expect(length('item-get')).toBeGreaterThan(length('key-get'));
  });
});

describe("Mega Man's station music", () => {
  const song = (id: string) => compileSong(songs.find((s) => s.id === id) as (typeof songs)[number]);
  const effect = (id: string) => sfx.find((s) => s.id === id) as Sfx;
  const length = (id: string) => {
    const e = effect(id);
    const lens = (['pulse', 'pulse2', 'triangle', 'noise'] as const).flatMap((k) => {
      const src = e[k];
      const kind = k === 'pulse2' ? 'pulse' : k;
      return typeof src === 'string' ? [seconds(parseMml(src, kind).length, e.bpm ?? 150)] : [];
    });
    return Math.max(...lens);
  };
  const notes = (src: string) =>
    parseMml(src, 'pulse')
      .events.map((e) => e.note)
      .filter((n): n is number => n !== null);

  it('the stage theme is fast with a sixteenth-note lead; the boss loop is faster and shorter', () => {
    const stage = song('mm-station');
    const boss = song('mm-boss');
    expect(stage.loop && boss.loop).toBe(true);
    expect(stage.bpm).toBeGreaterThanOrEqual(150);
    expect(boss.bpm).toBeGreaterThan(stage.bpm);
    expect(seconds(boss.length, boss.bpm)).toBeLessThan(seconds(stage.length, stage.bpm));
    for (const s of [stage, boss]) expect(s.length % (PPQ * 4)).toBe(0);
    // An arpeggiated lead: most of the stage lead's notes are sixteenths.
    const lead = (stage.tracks as Record<string, Track>).pulse1 as Track;
    const sounding = lead.events.filter((e) => e.note !== null);
    const sixteenths = sounding.filter((e) => e.len === PPQ / 4).length;
    expect(sixteenths / sounding.length).toBeGreaterThan(0.5);
  });

  it('the life-bar tick is short enough to repeat once per notch', () => {
    expect(length('boss-fill')).toBeLessThanOrEqual(0.08);
  });

  it('the teleport beam climbs and the capsule fanfare rings out on its top note', () => {
    const beam = notes(effect('beam').pulse as string);
    expect(beam.at(-1)).toBe(Math.max(...beam));
    const capsule = notes(effect('capsule').pulse as string);
    expect(capsule.at(-1)).toBe(Math.max(...capsule));
    expect(length('capsule')).toBeGreaterThan(length('beam'));
  });
});

describe("Samus's cavern music", () => {
  const song = (id: string) => compileSong(songs.find((s) => s.id === id) as (typeof songs)[number]);
  const sounding = (t: Track) => t.events.filter((e) => e.note !== null);
  const tracks = (id: string) => song(id).tracks as Record<string, Track>;

  it('the cavern is slow and moody: long lead notes over a slow pulse, hardly any drums', () => {
    const cave = song('cavern');
    expect(cave.loop).toBe(true);
    expect(cave.bpm).toBeLessThanOrEqual(112);
    expect(cave.length % (PPQ * 4)).toBe(0);
    expect(seconds(cave.length, cave.bpm)).toBeGreaterThanOrEqual(30);
    const lead = sounding(tracks('cavern').pulse1 as Track);
    const mean = lead.reduce((a, e) => a + e.len, 0) / lead.length;
    expect(mean).toBeGreaterThanOrEqual(PPQ);
    // Sparse percussion, if any: at most one hit a beat.
    const noise = tracks('cavern').noise;
    if (noise) expect(sounding(noise).length).toBeLessThanOrEqual(cave.length / PPQ);
  });

  it('the escape is urgent: fast, a shorter loop, and racing sixteenth-note arpeggios', () => {
    const cave = song('cavern');
    const run = song('zebes-escape');
    expect(run.loop).toBe(true);
    expect(run.bpm).toBeGreaterThanOrEqual(160);
    expect(run.length % (PPQ * 4)).toBe(0);
    expect(seconds(run.length, run.bpm)).toBeLessThan(seconds(cave.length, cave.bpm));
    const arps = Object.values(tracks('zebes-escape')).filter((t) => {
      const s = sounding(t);
      return s.filter((e) => e.len === PPQ / 4).length / s.length > 0.6;
    });
    expect(arps.length).toBeGreaterThanOrEqual(1);
  });

  it('the alarm is a short two-tone klaxon that can repeat back to back', () => {
    const alarm = sfx.find((s) => s.id === 'alarm') as Sfx;
    const t = parseMml(alarm.pulse as string, 'pulse');
    expect(seconds(t.length, alarm.bpm ?? 150)).toBeLessThanOrEqual(0.8);
    const notes = sounding(t).map((e) => e.note);
    expect(new Set(notes).size).toBeGreaterThanOrEqual(2);
    // It ends silent or decaying, so a repeat starts clean.
    const last = t.events.at(-1);
    expect(last?.note === null || last?.decay === true).toBe(true);
  });
});

describe('the Mini Game Arena music', () => {
  const song = (id: string) => compileSong(songs.find((s) => s.id === id) as (typeof songs)[number]);
  const tracks = (id: string) => song(id).tracks as Record<string, Track>;
  const notes = (t: Track) => t.events.flatMap((e) => (e.note === null ? [] : [e.note]));

  it('is an upbeat loop of whole bars, livelier than the world map, with drums all the way', () => {
    const arena = song('arena');
    expect(arena.loop).toBe(true);
    expect(arena.bpm).toBeGreaterThan(song('map').bpm);
    expect(arena.length).toBe(PPQ * 4 * 16);
    expect(seconds(arena.length, arena.bpm)).toBeGreaterThanOrEqual(20);
    // A beat on every quarter at least: the drums never drop out.
    expect(notes(tracks('arena').noise as Track).length).toBeGreaterThanOrEqual(arena.length / PPQ);
  });

  it('opens with a fanfare: the lead leaps up the D major chord', () => {
    const lead = notes(tracks('arena').pulse1 as Track);
    const [d, fs, a, d2] = lead as [number, number, number, number];
    expect([fs - d, a - d, d2 - d]).toEqual([4, 7, 12]);
  });

  it('ends on the dominant (A), so the loop lands back home on D', () => {
    const lead = notes(tracks('arena').pulse1 as Track);
    expect(((lead.at(-1) as number) - (lead[0] as number)) % 12).toBe(7);
  });
});
