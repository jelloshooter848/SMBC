import { describe, expect, it } from 'vitest';
import { validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { storyDef, storyPalettes } from './story';

type Size = readonly [w: number, h: number];

/** The frame contract the opening and Bowser's spell (story/opening.ts, story/bowser-spell.ts) draw. */
const FRAMES: Record<string, Size> = {
  'star-wand-0': [9, 17],
  'star-wand-1': [9, 17],
  'wax-seal': [13, 13],
  'note-sheet': [8, 9],
};

const rows = (name: string): readonly string[] => storyDef.frames[name] as readonly string[];

describe('story sheet (0.4.23 props)', () => {
  it('validates and is registered with its palette', () => {
    validateDef('story', storyDef);
    expect(SPRITES.story).toBe(storyDef);
    expect(PALETTES.default?.story).toEqual(storyPalettes.story);
  });

  it('has every contract frame at its size, none empty, and nothing else', () => {
    expect(Object.keys(storyDef.frames).sort()).toEqual(Object.keys(FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      expect(f.join('').replace(/\./g, '').length, name).toBeGreaterThan(0);
    }
  });

  it('the wand: a gold star on a brown rod; the twinkle differs only in the star', () => {
    const a = rows('star-wand-0');
    const b = rows('star-wand-1');
    expect(a.slice(0, 8).join('')).toMatch(/2/);
    expect(a.slice(9).join('')).toMatch(/5/);
    expect(b.slice(8)).toEqual(a.slice(8));
    expect(b.join('')).not.toEqual(a.join(''));
    expect(b.slice(0, 8).join('')).toMatch(/1/);
  });

  it('the seal holds a gold crown on red wax', () => {
    const s = rows('wax-seal').join('');
    expect(s).toMatch(/6/);
    expect(s).toMatch(/2/);
  });
});
