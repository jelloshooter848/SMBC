import { describe, expect, it } from 'vitest';
import { compileSong, parseMml, PPQ, type Sfx, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { contraSongs } from './contra';
import { sfx } from '../sfx/sfx';
import { contraSfx } from '../sfx/contra';
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

describe("Bill's jungle music", () => {
  it('is registered with the game songs and sounds', () => {
    for (const s of contraSongs) expect(songs).toContain(s);
    for (const e of contraSfx) expect(sfx).toContain(e);
    expect(contraSongs.map((s) => s.id)).toEqual([
      'contra-jungle',
      'contra-stage',
      'contra-boss',
      'contra-lair',
      'contra-card',
    ]);
    expect(contraSfx.map((s) => s.id)).toEqual([
      'bridge-boom',
      'falcon',
      'contra-death',
      'spread',
      'laser',
      'konami',
    ]);
    expect(themeMusic('contra-jungle')).toBe('contra-jungle');
    expect(themeMusic('alien-lair')).toBe('contra-lair');
  });

  it('every loop is whole bars on every channel; the card is a short sting', () => {
    for (const s of contraSongs) {
      const c = compileSong(s);
      expect(c.length % (PPQ * 4), s.id).toBe(0);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
      expect(c.loop, s.id).toBe(s.id !== 'contra-card');
    }
    const card = song('contra-card');
    expect(bars(card)).toBe(2);
    expect(seconds(card.length, card.bpm)).toBeLessThan(4);
    // it ends on its highest note, held
    const lead = notes(contraSongs[4]?.pulse1 as string);
    expect(lead.at(-1)).toBe(Math.max(...lead));
  });

  it('the jungle drives in eighths over a moving bass; the stage marches faster; the boss faster still', () => {
    const jungle = song('contra-jungle');
    const stage = song('contra-stage');
    const boss = song('contra-boss');
    expect(jungle.bpm).toBeGreaterThanOrEqual(140);
    expect(stage.bpm).toBeGreaterThan(jungle.bpm);
    expect(boss.bpm).toBeGreaterThan(stage.bpm);
    for (const c of [jungle, stage, boss]) expect(bars(c)).toBe(8);
    // a running bass: every bass note an eighth (the boss gallops in sixteenths and eighths)
    for (const c of [jungle, stage])
      expect(sounding(track(c, 'triangle')).every((e) => e.len === PPQ / 2)).toBe(true);
    expect(track(boss, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
    // D minor turning on A major's C-sharp; E minor turning on B major's D-sharp
    expect(pitchClasses(track(jungle, 'pulse1')).has(1)).toBe(true);
    expect(pitchClasses(track(stage, 'pulse1')).has(3)).toBe(true);
    // the march rolls its snares in sixteenths
    expect(track(stage, 'noise').events.filter((e) => e.len === PPQ / 4).length).toBeGreaterThan(32);
    // the tunes are not one another's
    expect(track(stage, 'pulse1').events.map((e) => e.note)).not.toEqual(
      track(jungle, 'pulse1').events.map((e) => e.note),
    );
  });

  it("Red Falcon's lair is slow, slides a half step and beats like a heart", () => {
    const lair = song('contra-lair');
    expect(lair.bpm).toBeLessThan(song('contra-jungle').bpm);
    expect(bars(lair)).toBe(8);
    // E and the flat second F in the lead
    const pcs = pitchClasses(track(lair, 'pulse1'));
    expect(pcs.has(4) && pcs.has(5)).toBe(true);
    // two lub-dubs a bar: four bass hits per bar, short
    const bass = sounding(track(lair, 'triangle'));
    expect(bass.length).toBe(8 * 4);
    expect(bass.every((e) => e.len <= PPQ / 2)).toBe(true);
    // a long-note lead over a trembling harmony
    const lead = sounding(track(lair, 'pulse1'));
    expect(lead.reduce((a, e) => a + e.len, 0) / lead.length).toBeGreaterThanOrEqual(PPQ * 1.5);
    expect(track(lair, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
  });

  it('the boom rumbles longest; the shots are quick; the pickup and the code climb to their top', () => {
    expect(effect('bridge-boom').noise).toBeDefined();
    expect(length('bridge-boom')).toBeGreaterThan(0.6);
    expect(length('bridge-boom')).toBeLessThanOrEqual(1.5);
    for (const id of ['spread', 'laser']) expect(length(id), id).toBeLessThanOrEqual(0.25);
    expect(effect('laser').pulse).toMatch(/p-\d/);
    for (const id of ['falcon', 'konami']) {
      const n = notes(effect(id).pulse as string);
      expect(n.at(-1), id).toBe(Math.max(...n));
    }
    expect(length('konami')).toBeGreaterThan(length('falcon'));
    // the death falls: its first note is its highest, then a thud on the noise
    const death = notes(effect('contra-death').pulse as string);
    expect(death[0]).toBe(Math.max(...death));
    expect(effect('contra-death').noise).toBeDefined();
  });
});
