import { describe, expect, it } from 'vitest';
import { compileSong, parseMml, PPQ, type Sfx, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { sophiaSongs } from './sophia';
import { sfx } from '../sfx/sfx';
import { sophiaSfx } from '../sfx/sophia';
import { themeMusic } from '@game/level/schema';

const seconds = (ticks: number, bpm: number): number => (ticks / PPQ) * (60 / bpm);
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
const track = (c: ReturnType<typeof song>, name: string) =>
  (c.tracks as Record<string, Track>)[name] as Track;
const pitchClasses = (t: Track) => new Set(t.events.flatMap((e) => (e.note === null ? [] : [e.note % 12])));
const bars = (c: ReturnType<typeof song>) => c.length / (PPQ * 4);
const sounding = (t: Track) => t.events.filter((e) => e.note !== null);

describe("Sophia's Underworld music", () => {
  it('is registered with the game songs and sounds, and the themes play it', () => {
    for (const s of sophiaSongs) expect(songs).toContain(s);
    for (const e of sophiaSfx) expect(sfx).toContain(e);
    expect(sophiaSongs.map((s) => s.id)).toEqual([
      'bm-area',
      'bm-dungeon',
      'bm-boss',
      'bm-garage',
      'bm-cutscene',
    ]);
    // the brief's sounds and the build spec's (SO-54)
    for (const id of [
      'sophia-jump',
      'sophia-cannon',
      'sophia-hover',
      'sophia-open',
      'jason-shot',
      'grenade',
      'mutant-die',
      'frog',
      'sophia-land',
      'sophia-shoot-normal',
      'sophia-shoot-hyper',
      'sophia-shoot-crusher',
      'sophia-missile',
      'sophia-explode',
      'sophia-hit-enemy',
      'sophia-kill',
      'sophia-hurt',
      'sophia-die',
      'sophia-select',
      'sophia-pickup',
    ])
      expect(
        sophiaSfx.map((s) => s.id),
        id,
      ).toContain(id);
    expect(themeMusic('underworld')).toBe('bm-area');
    expect(themeMusic('bm-dungeon')).toBe('bm-dungeon');
  });

  it('every loop is 8 whole bars on every channel', () => {
    for (const s of sophiaSongs) {
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      expect(bars(c), s.id).toBe(8);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
  });

  it('the garage and the opening are calm; the dungeon treads; the area marches; the boss is fastest', () => {
    const [area, dungeon, boss, garage, cut] = [
      'bm-area',
      'bm-dungeon',
      'bm-boss',
      'bm-garage',
      'bm-cutscene',
    ].map(song) as [
      ReturnType<typeof song>,
      ReturnType<typeof song>,
      ReturnType<typeof song>,
      ReturnType<typeof song>,
      ReturnType<typeof song>,
    ];
    expect(garage.bpm).toBeLessThan(dungeon.bpm);
    expect(cut.bpm).toBeLessThan(dungeon.bpm);
    expect(dungeon.bpm).toBeLessThan(area.bpm);
    expect(area.bpm).toBeLessThan(boss.bpm);
    // the march's bass runs in eighths; the boss gallops; the garage's bass holds half notes
    expect(sounding(track(area, 'triangle')).every((e) => e.len === PPQ / 2)).toBe(true);
    expect(sounding(track(boss, 'triangle')).some((e) => e.len === PPQ / 4)).toBe(true);
    expect(sounding(track(garage, 'triangle')).every((e) => e.len === PPQ * 2)).toBe(true);
    // A minor turning on E major's G-sharp; the dungeon leans on the flat second; the boss on the tritone
    expect(pitchClasses(track(area, 'pulse1')).has(8)).toBe(true);
    expect(pitchClasses(track(dungeon, 'pulse1')).has(3)).toBe(true);
    expect(pitchClasses(track(boss, 'pulse1')).has(6)).toBe(true);
    // the opening's roll swells in its last bar
    const roll = track(cut, 'noise').events.filter((e) => e.note !== null);
    expect((roll.at(-1) as (typeof roll)[number]).vol).toBeGreaterThan(
      (roll[0] as (typeof roll)[number]).vol,
    );
    // the tunes are not one another's
    const lead = (c: ReturnType<typeof song>) =>
      track(c, 'pulse1')
        .events.map((e) => e.note)
        .join();
    expect(new Set([area, dungeon, boss, garage, cut].map(lead)).size).toBe(5);
  });

  it('the shots are quick, the hover can repeat, the death and its blast are long', () => {
    for (const id of [
      'sophia-cannon',
      'sophia-shoot-normal',
      'sophia-shoot-hyper',
      'jason-shot',
      'sophia-hit-enemy',
    ])
      expect(length(id), id).toBeLessThanOrEqual(0.25);
    expect(length('sophia-hover')).toBeLessThanOrEqual(0.25);
    expect(length('sophia-shoot-crusher')).toBeGreaterThan(length('sophia-shoot-normal'));
    expect(length('sophia-die')).toBeGreaterThan(length('sophia-kill'));
    for (const id of ['sophia-explode', 'sophia-kill', 'grenade', 'sophia-die'])
      expect(effect(id).noise, id).toBeDefined();
    // the jump rises; the pickup climbs to its top note
    expect(effect('sophia-jump').pulse).toMatch(/p\d/);
    const pick = notes(effect('sophia-pickup').pulse as string);
    expect(pick.at(-1)).toBe(Math.max(...pick));
    // the death falls: its first note is its highest
    const death = notes(effect('sophia-die').pulse as string);
    expect(death[0]).toBe(Math.max(...death));
  });
});
