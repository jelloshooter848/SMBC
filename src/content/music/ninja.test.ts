import { describe, expect, it } from 'vitest';
import { compileSong, parseMml, PPQ, type Sfx, type Track } from '@engine/audio/mml';
import { songs } from './songs';
import { ninjaSongs } from './ninja';
import { sfx } from '../sfx/sfx';
import { ninjaSfx } from '../sfx/ninja';
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

describe("Ryu's hideout and ninja music", () => {
  it('is registered with the game songs and sounds', () => {
    for (const s of ninjaSongs) expect(songs).toContain(s);
    for (const e of ninjaSfx) expect(sfx).toContain(e);
    expect(ninjaSongs.map((s) => s.id)).toEqual(['dojo', 'ng-stage', 'ng-boss', 'ng-cutscene', 'ng-city']);
    expect(ninjaSfx.map((s) => s.id)).toEqual(['panel-spin', 'slash', 'hawk', 'clang']);
    expect(themeMusic('dojo')).toBe('dojo');
    expect(themeMusic('ninja-night')).toBe('ng-stage');
  });

  it('every loop is whole bars on every channel', () => {
    for (const s of ninjaSongs) {
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      expect(c.length % (PPQ * 4), s.id).toBe(0);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
  });

  it('the dojo is slow and keeps to the in scale (E F A B C) in its tune and its koto', () => {
    const dojo = song('dojo');
    expect(dojo.bpm).toBeLessThan(90);
    const inScale = new Set([4, 5, 9, 11, 0]);
    for (const ch of ['pulse1', 'pulse2'])
      for (const pc of pitchClasses(track(dojo, ch))) expect(inScale.has(pc), `${ch}: ${pc}`).toBe(true);
    // plucked: short gates that fade
    expect(ninjaSongs[0]?.pulse1).toMatch(/x1/);
  });

  it('the stage drives in sixteenths; the boss is faster still and leans on the tritone', () => {
    const stage = song('ng-stage');
    const boss = song('ng-boss');
    expect(stage.bpm).toBeGreaterThanOrEqual(140);
    expect(boss.bpm).toBeGreaterThan(stage.bpm);
    for (const c of [stage, boss]) {
      expect(track(c, 'pulse2').events.every((e) => e.len === PPQ / 4)).toBe(true);
      expect(bars(c)).toBe(8);
    }
    // C minor with F-sharp in the hook
    const hook = pitchClasses(track(boss, 'pulse1'));
    expect(hook.has(3)).toBe(true);
    expect(hook.has(6)).toBe(true);
    // the stage turns on E major's G-sharp
    expect(pitchClasses(track(stage, 'pulse1')).has(8)).toBe(true);
  });

  it('the cutscene is a short, slow loop under a trembling harmony', () => {
    const cut = song('ng-cutscene');
    expect(bars(cut)).toBe(4);
    expect(cut.bpm).toBeLessThan(song('ng-stage').bpm);
    expect(seconds(cut.length, cut.bpm)).toBeLessThan(15);
    expect(track(cut, 'pulse2').events.every((e) => e.len === PPQ / 8)).toBe(true);
  });

  it('the slash is quick; the clash rings longer; the panel whooshes longer than both', () => {
    expect(length('slash')).toBeLessThanOrEqual(0.15);
    expect(length('clang')).toBeGreaterThan(length('slash'));
    expect(length('panel-spin')).toBeGreaterThan(length('clang'));
    expect(length('panel-spin')).toBeLessThanOrEqual(1);
    for (const id of ['panel-spin', 'slash']) expect(effect(id).noise, id).toBeDefined();
    // the clang is high and metallic: two pulses well above the staff
    expect(notes(effect('clang').pulse as string)[0]).toBeGreaterThan(84);
    expect(effect('clang').pulse2).toBeDefined();
  });

  it("the hawk's cry is high and falls away", () => {
    const cry = effect('hawk');
    expect(notes(cry.pulse as string)[0]).toBeGreaterThan(72);
    expect(cry.pulse).toMatch(/p-\d/);
    expect(length('hawk')).toBeLessThan(0.6);
  });
});
