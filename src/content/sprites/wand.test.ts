import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { wandDef, wandPalettes } from './wand';
import { storyDef, storyPalettes } from './story';

type Size = readonly [w: number, h: number];

/** The frame contract the 8-4 wand scene (entities/effects/wand-break.ts) draws against. */
const FRAMES: Record<string, Size> = {
  'wand-0': [20, 20],
  'wand-1': [20, 20],
  'wand-2': [20, 20],
  'wand-3': [20, 20],
  'wand-crack': [20, 20],
  'wand-glow': [20, 20],
  'piece-0': [8, 8],
  'piece-1': [8, 8],
  'piece-2': [8, 8],
  'rift-open-0': [24, 56],
  'rift-open-1': [24, 56],
  'rift-0': [24, 56],
  'rift-1': [24, 56],
};

const rows = (name: string): readonly string[] => wandDef.frames[name] as readonly string[];
const opaque = (f: readonly string[]) => f.join('').replace(/\./g, '').length;

describe('wand sheet', () => {
  it('validates', () => validateDef('wand', wandDef));

  it('has every contract frame at its size, none empty, and nothing else', () => {
    expect(Object.keys(wandDef.frames).sort()).toEqual(Object.keys(FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      expect(opaque(f), name).toBeGreaterThan(0);
    }
  });

  it('the rift opens wider frame by frame, and the shimmer frames are the same shape', () => {
    const size = ['rift-open-0', 'rift-open-1', 'rift-0'].map((n) => opaque(rows(n)));
    expect(size[0]).toBeLessThan(size[1] as number);
    expect(size[1]).toBeLessThan(size[2] as number);
    // Only the rim's colour and the sparks differ.
    const crack = (n: string) => rows(n).map((r) => r.replace(/[19]/g, '.').replace(/[^.]/g, '#'));
    expect(crack('rift-0')).toEqual(crack('rift-1'));
    expect(rows('rift-0')).not.toEqual(rows('rift-1'));
  });

  it("is the star wand of Bowser's spell (story sheet `star-wand-0`), not Larry's orb wand", () => {
    // 0.4.31: the wand that breaks at 8-4 is the one he cast the spell with in 1-0 and waves at
    // the gate scenes: a five-pointed star on a brown rod, in the same colours.
    const colours = (f: readonly string[], pal: readonly string[]) =>
      new Set([...f.join('')].filter((c) => c !== '.').map((c) => pal[parseInt(c, 36)]));
    const star = colours(storyDef.frames['star-wand-0'] as string[], storyPalettes.story as string[]);
    const wand = wandPalettes.wand as string[];
    for (const name of ['wand-0', 'wand-1', 'wand-2', 'wand-3', 'wand-crack']) {
      const used = colours(rows(name), wand);
      used.delete(wand[1]); // the crack's white
      for (const c of used) expect(star.has(c), `${name}: ${c}`).toBe(true);
      // no pink orb
      expect(used.has(wand[5]), name).toBe(false);
    }
    // upright, the star's points: its top point on the middle column, its two arms level
    const up = rows('wand-0');
    const top = up.findIndex((r) => /[23]/.test(r));
    expect(up[top]!.match(/[23]/g)!.length).toBeLessThanOrEqual(2);
    expect(Math.abs(up[top]!.search(/[23]/) - 9.5)).toBeLessThanOrEqual(1);
    const arms = up.map((r) => (r.match(/[23]/g) ?? []).length);
    expect(Math.max(...arms)).toBeGreaterThanOrEqual(7);
    // the pieces it breaks into are bits of the star and the rod, in the lavender glow
    for (const name of ['piece-0', 'piece-1', 'piece-2'])
      expect(rows(name).join(''), name).not.toMatch(/[56]/);
  });

  it('is registered with its palette and renders in every colour mode', () => {
    expect(SPRITES.wand).toBe(wandDef);
    expect(PALETTES.default.wand).toBe(wandPalettes.wand);
    const used = new Set(Object.values(wandDef.frames).flatMap((f) => [...f.join('')]));
    used.delete('.');
    for (const ch of used) expect(parseInt(ch, 36), ch).toBeLessThan((wandPalettes.wand as string[]).length);
    for (const mode of PALETTE_MODES)
      expect(() => rasterizeToBuffer(wandDef, resolvePalette(PALETTES, 'wand', mode)), mode).not.toThrow();
  });
});
