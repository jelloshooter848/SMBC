import { describe, expect, it } from 'vitest';
import { compileSong, parseMml, PPQ, type Sfx, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { smb3Songs } from './smb3';
import { sfx } from '../sfx/sfx';
import { smb3Sfx } from '../sfx/smb3';
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

describe("Larry's airship music", () => {
  it('is registered with the game songs and sounds', () => {
    for (const s of smb3Songs) expect(songs).toContain(s);
    for (const e of smb3Sfx) expect(sfx).toContain(e);
    expect(smb3Songs.map((s) => s.id)).toEqual(['airship', 'smb3-boss', 'toad-house', 'bonus-game']);
    expect(smb3Sfx.map((s) => s.id)).toEqual(['card-flip', 'slot-stop', 'bonus-win', 'item-use']);
    // the airship theme plays its own tune by default
    expect(themeMusic('airship')).toBe('airship');
  });

  it('every loop is whole bars on every channel', () => {
    for (const s of smb3Songs) {
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      expect(c.length % (PPQ * 4), s.id).toBe(0);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
  });

  it('the airship creeps in a minor key; the duel is faster and shorter', () => {
    const ship = song('airship');
    const boss = song('smb3-boss');
    expect(ship.bpm).toBeLessThan(140);
    expect(boss.bpm).toBeGreaterThan(ship.bpm);
    expect(seconds(boss.length, boss.bpm)).toBeLessThan(seconds(ship.length, ship.bpm));
    // D minor: F natural and the flat-two (E-flat) in the tune, never F-sharp
    const pcs = pitchClasses(track(ship, 'pulse1'));
    expect(pcs.has(5)).toBe(true);
    expect(pcs.has(3)).toBe(true);
    expect(pcs.has(6)).toBe(false);
    // the duel drives a sixteenth-note ostinato underneath
    expect(track(boss, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
  });

  it("Toad's house is cheerful (major, brisk) and the bonus game is quicker still", () => {
    const toad = song('toad-house');
    const game = song('bonus-game');
    // F major: B-flat and A in the tune, no A-flat
    const pcs = pitchClasses(track(toad, 'pulse1'));
    expect(pcs.has(10)).toBe(true);
    expect(pcs.has(9)).toBe(true);
    expect(pcs.has(8)).toBe(false);
    expect(toad.bpm).toBeGreaterThanOrEqual(130);
    expect(game.bpm).toBeGreaterThan(toad.bpm);
  });

  it('the card flip and the reel stop are short enough to fire in quick succession', () => {
    expect(length('card-flip')).toBeLessThanOrEqual(0.15);
    expect(length('slot-stop')).toBeLessThanOrEqual(0.25);
    expect(effect('slot-stop').noise).toBeDefined();
  });

  it('the win fanfare and the item sparkle climb to their last note', () => {
    for (const id of ['bonus-win', 'item-use']) {
      const n = notes(effect(id).pulse as string);
      expect(n.at(-1), id).toBe(Math.max(...n));
      expect(n.at(-1), id).toBeGreaterThan(n[0] as number);
    }
    expect(length('bonus-win')).toBeGreaterThan(length('card-flip'));
    expect(length('bonus-win')).toBeGreaterThan(length('item-use'));
  });
});
