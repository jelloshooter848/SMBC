import { describe, expect, it } from 'vitest';
import { hexToRgb, PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { fxPalette, HERO_FX } from './palette-fx';

const BLACK = '#000000';

describe('hero palette effects (<palette>~<fx>)', () => {
  it('silhouette: every colour of the palette is black, in every colour mode', () => {
    for (const mode of PALETTE_MODES) {
      const base = resolvePalette(PALETTES, 'luigi', mode);
      expect(base.some((c) => c !== BLACK)).toBe(true);
      const pal = resolvePalette(PALETTES, fxPalette('luigi', 'silhouette'), mode);
      expect(pal).toHaveLength(base.length);
      expect(pal.every((c) => c === BLACK)).toBe(true);
    }
  });

  it("silhouette: a rasterized portrait's opaque pixels are all black, its shape unchanged", () => {
    const def = SPRITES.mario!;
    const plain = rasterizeToBuffer(def, resolvePalette(PALETTES, 'luigi', 'default'));
    const shadow = rasterizeToBuffer(def, resolvePalette(PALETTES, 'luigi~silhouette', 'default'));
    let opaque = 0;
    for (let i = 0; i < shadow.data.length; i += 4) {
      expect(shadow.data[i + 3]).toBe(plain.data[i + 3]); // same alpha: same outline
      if (shadow.data[i + 3] === 0) continue;
      opaque++;
      expect([shadow.data[i], shadow.data[i + 1], shadow.data[i + 2]]).toEqual([0, 0, 0]);
    }
    expect(opaque).toBeGreaterThan(100);
  });

  it('applies to the active mode: colour-blind and high-contrast palettes are recoloured, not the default', () => {
    for (const mode of ['deuteranopia', 'protanopia', 'tritanopia', 'highContrast'] as const) {
      const base = resolvePalette(PALETTES, 'luigi', mode);
      for (const fx of ['brainwashed', 'brainwashed-glow', 'rim'] as const)
        expect(resolvePalette(PALETTES, fxPalette('luigi', fx), mode)).toEqual(HERO_FX[fx](base));
    }
    // A palette the mode changes gives a different trance than the default's.
    const def = resolvePalette(PALETTES, 'luigi~brainwashed', 'default');
    const hc = resolvePalette(PALETTES, 'luigi~brainwashed', 'highContrast');
    expect(hc).not.toEqual(def);
  });

  it('brainwashed is a purple ramp: blue and red above green for every colour, lighter when glowing', () => {
    const pal = resolvePalette(PALETTES, 'luigi~brainwashed', 'default');
    const glow = resolvePalette(PALETTES, 'luigi~brainwashed-glow', 'default');
    pal.forEach((c, i) => {
      const [r, g, b] = hexToRgb(c);
      expect(b).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(g);
      const sum = (h: string) => hexToRgb(h).reduce((a, n) => a + n, 0);
      expect(sum(glow[i] as string)).toBeGreaterThanOrEqual(sum(c));
    });
  });

  it('effects chain left to right', () => {
    const chained = resolvePalette(PALETTES, 'luigi~brainwashed~silhouette', 'default');
    expect(chained.every((c) => c === BLACK)).toBe(true);
    const rimmed = resolvePalette(PALETTES, 'luigi~silhouette~brainwashed', 'default');
    expect(rimmed).toEqual(HERO_FX.brainwashed(resolvePalette(PALETTES, 'luigi~silhouette', 'default')));
  });

  it('an unknown effect or palette is an error, as an unknown palette is', () => {
    expect(() => resolvePalette(PALETTES, 'luigi~sparkly', 'default')).toThrow(/unknown palette effect/);
    expect(() => resolvePalette(PALETTES, 'nobody~silhouette', 'default')).toThrow(
      /unknown palette "nobody"/,
    );
    expect(() => resolvePalette({ default: { luigi: ['#fff'] } }, 'luigi~silhouette', 'default')).toThrow(
      /unknown palette effect/,
    );
  });
});
