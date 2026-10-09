import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { houseDef, housePalettes } from './house';

type Size = readonly [w: number, h: number];

/** The frames story/opening.ts draws Mario's house with, at their sizes. */
const FRAMES: Record<string, Size> = {
  window: [56, 48],
  bed: [64, 36],
  lamp: [20, 36],
  picture: [24, 22],
  'cap-hook': [16, 16],
  clock: [18, 28],
  'gate-block': [16, 16],
  'door-shut': [32, 56],
  'door-open': [32, 56],
};

describe("Mario's house sheet (0.4.36)", () => {
  it('validates, rasterizes with its own palette and is registered', () => {
    validateDef('house', houseDef);
    expect(SPRITES.house).toBe(houseDef);
    expect(PALETTES.default?.house).toEqual(housePalettes.house);
    expect(() => rasterizeToBuffer(houseDef, housePalettes.house as string[])).not.toThrow();
  });

  it('has every frame at its size, none empty, and nothing else', () => {
    expect(Object.keys(houseDef.frames).sort()).toEqual(Object.keys(FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(FRAMES)) {
      const f = houseDef.frames[name] as readonly string[];
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      expect(f.join('').replace(/\./g, '').length, name).toBeGreaterThan(w * h * 0.4);
    }
  });

  it('the bed is red, the lamp a spotted red cap, the open door shows the green outside', () => {
    const has = (name: string, c: string) =>
      (houseDef.frames[name] as readonly string[]).join('').includes(c);
    expect(has('bed', '5') && has('bed', '1')).toBe(true);
    expect(has('lamp', '5') && has('lamp', '1')).toBe(true);
    expect(has('door-open', 'a') && !has('door-shut', 'a')).toBe(true);
  });
});
