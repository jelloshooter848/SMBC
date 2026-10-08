import { describe, expect, it } from 'vitest';
import { validateDef } from '@engine/gfx/pixelart';
import { WELCOMES } from '@game/story/script';
import { PALETTES, SPRITES } from './index';
import { LOCAL_SPRITES, localsDef, localsPalettes } from './locals';

// The world map's locals (docs/STORY.md 2.3b): one original 16x20 sprite (idle and blink) for
// each world with a welcome.

describe('locals sheet', () => {
  it('validates and is registered', () => {
    validateDef('locals', localsDef);
    expect(SPRITES.locals).toBe(localsDef);
    expect(PALETTES.default.locals).toBe(localsPalettes.locals);
  });

  it('draws a local for every welcome, two 16x20 frames each that differ (the blink)', () => {
    expect(Object.keys(LOCAL_SPRITES).sort()).toEqual(Object.keys(WELCOMES).sort());
    for (const who of Object.values(LOCAL_SPRITES)) {
      const a = localsDef.frames[`${who}-0`];
      const b = localsDef.frames[`${who}-1`];
      expect(a?.length, who).toBe(20);
      expect(b?.length, who).toBe(20);
      for (const row of [...(a ?? []), ...(b ?? [])]) expect(row.length, who).toBe(16);
      expect(a).not.toEqual(b);
    }
    expect(Object.keys(localsDef.frames)).toHaveLength(Object.keys(LOCAL_SPRITES).length * 2);
  });

  it('uses only colours its palette has', () => {
    const n = localsPalettes.locals?.length ?? 0;
    for (const rows of Object.values(localsDef.frames))
      for (const row of rows) for (const ch of row) if (ch !== '.') expect(parseInt(ch, 36)).toBeLessThan(n);
  });
});
