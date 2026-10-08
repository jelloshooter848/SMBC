import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { resolvePalette } from '@engine/gfx/palette';
import { PALETTES, SPRITES } from './index';
import { CROSSOVER_LETTERS, RIFT_STAGES, RIFT_PALETTES, titleLogoDef, titleRiftDef } from './title-logo';
import { FONT_COLOURS } from './font';

describe('title logo sprites', () => {
  it('are registered and valid pixel text', () => {
    expect(SPRITES['title-logo']).toBe(titleLogoDef);
    expect(SPRITES['title-rift']).toBe(titleRiftDef);
    validateDef('title-logo', titleLogoDef);
    validateDef('title-rift', titleRiftDef);
  });

  it('draw one frame per CROSSOVER letter, the SMB tag, the REMIX stamp and the short logo', () => {
    expect(CROSSOVER_LETTERS).toBe('CROSSOVER');
    const f = titleLogoDef.frames;
    for (let i = 0; i < CROSSOVER_LETTERS.length; i++) expect(f[`cross-${i}`]).toBeDefined();
    for (const name of [
      'smb-tag',
      'remix',
      'remix-2x',
      'remix-shadow',
      'smbc-line',
      'dust-0',
      'dust-1',
      'dust-2',
    ])
      expect(f[name], name).toBeDefined();
    // The stamp's slam frame is twice its size.
    expect(f['remix-2x']!.length).toBe(f.remix!.length * 2);
    expect(f['remix-2x']![0]!.length).toBe(f.remix![0]!.length * 2);
  });

  it('rasterize with their palettes (every colour index exists)', () => {
    rasterizeToBuffer(titleLogoDef, resolvePalette(PALETTES, titleLogoDef.palette, 'default'));
    for (const p of RIFT_PALETTES) rasterizeToBuffer(titleRiftDef, resolvePalette(PALETTES, p, 'default'));
    expect(Object.keys(titleRiftDef.frames)).toHaveLength(RIFT_STAGES);
  });

  it('rotate the four rift colours across the cycling palettes', () => {
    expect(RIFT_PALETTES).toHaveLength(4);
    const pals = RIFT_PALETTES.map((p) => resolvePalette(PALETTES, p, 'default'));
    expect(new Set(pals.map((p) => p.join())).size).toBe(4);
  });
});

describe('font colours', () => {
  it('has gold, grey, cyan and black variants of the white font', () => {
    for (const c of ['gold', 'grey', 'cyan', 'black'] as const) {
      const p = resolvePalette(PALETTES, FONT_COLOURS[c], 'default');
      const white = resolvePalette(PALETTES, 'font', 'default');
      expect(p[1]).not.toBe(white[1]);
      expect(p.length).toBe(white.length);
    }
  });
});
