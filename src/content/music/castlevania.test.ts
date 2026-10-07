import { describe, expect, it } from 'vitest';
import { compileSong, parseMml, PPQ, type Sfx, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { castlevaniaSongs } from './castlevania';
import { sfx } from '../sfx/sfx';
import { castlevaniaSfx } from '../sfx/castlevania';
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
const notes = (src: string, kind: 'pulse' | 'triangle' = 'pulse') =>
  parseMml(src, kind)
    .events.map((e) => e.note)
    .filter((n): n is number => n !== null);
const track = (c: ReturnType<typeof song>, name: string) =>
  (c.tracks as Record<string, Track>)[name] as Track;
const pitchClasses = (t: Track) => new Set(t.events.flatMap((e) => (e.note === null ? [] : [e.note % 12])));

describe("Simon's crypt and castle music", () => {
  it('is registered with the game songs and sounds', () => {
    for (const s of castlevaniaSongs) expect(songs).toContain(s);
    for (const e of castlevaniaSfx) expect(sfx).toContain(e);
    expect(castlevaniaSongs.map((s) => s.id)).toEqual(['crypt', 'cv-stage', 'cv-boss', 'cv-beast']);
    expect(castlevaniaSfx.map((s) => s.id)).toEqual([
      'whip-wall',
      'candle',
      'dracula-teleport',
      'beast-roar',
    ]);
    expect(themeMusic('crypt')).toBe('crypt');
  });

  it('every loop is whole bars on every channel', () => {
    for (const s of castlevaniaSongs) {
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      expect(c.length % (PPQ * 4), s.id).toBe(0);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
  });

  it('the crypt is slow and minor, with a Phrygian flat two; the castle stage drives', () => {
    const crypt = song('crypt');
    const stage = song('cv-stage');
    expect(crypt.bpm).toBeLessThan(100);
    // A minor: C natural and B-flat in the tune or the harmony, never C-sharp
    const pcs = new Set([...pitchClasses(track(crypt, 'pulse1')), ...pitchClasses(track(crypt, 'pulse2'))]);
    expect(pcs.has(0)).toBe(true);
    expect(pcs.has(10)).toBe(true);
    expect(pcs.has(1)).toBe(false);
    // the stage drives in eighths and sixteenths at a brisk tempo
    expect(stage.bpm).toBeGreaterThanOrEqual(140);
    expect(track(stage, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
  });

  it('Dracula is faster than the stage, the beast faster still and lower', () => {
    const stage = song('cv-stage');
    const boss = song('cv-boss');
    const beast = song('cv-beast');
    expect(boss.bpm).toBeGreaterThan(stage.bpm);
    expect(beast.bpm).toBeGreaterThan(boss.bpm);
    for (const c of [boss, beast])
      expect(track(c, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
    const mean = (t: Track) => {
      const n = t.events.flatMap((e) => (e.note === null ? [] : [e.note]));
      return n.reduce((a, b) => a + b, 0) / n.length;
    };
    expect(mean(track(beast, 'pulse1'))).toBeLessThan(mean(track(boss, 'pulse1')));
    // the boss's flat two (F natural over E), the beast's tritone (D-flat over G)
    expect(pitchClasses(track(boss, 'pulse1')).has(5)).toBe(true);
    expect(pitchClasses(track(beast, 'pulse1')).has(1)).toBe(true);
  });

  it('the candle is short enough to snuff a row of them; the wall crumbles longer', () => {
    expect(length('candle')).toBeLessThanOrEqual(0.2);
    expect(length('whip-wall')).toBeGreaterThan(length('candle'));
    expect(length('whip-wall')).toBeLessThanOrEqual(0.6);
    for (const id of ['candle', 'whip-wall']) expect(effect(id).noise, id).toBeDefined();
  });

  it("Dracula's teleport shimmers down; the beast roars low and long", () => {
    const run = notes(effect('dracula-teleport').pulse as string);
    expect(run.at(-1)).toBeLessThan(run[0] as number);
    expect(length('dracula-teleport')).toBeLessThan(1);
    const roar = effect('beast-roar');
    expect(roar.noise).toBeDefined();
    expect(notes(roar.pulse as string)[0]).toBeLessThan(48);
    expect(length('beast-roar')).toBeGreaterThan(length('whip-wall'));
    expect(length('beast-roar')).toBeLessThan(1.5);
  });
});
