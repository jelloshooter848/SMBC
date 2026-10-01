import type { Palette, PaletteBook } from '@engine/gfx/palette';
import { hexToRgb } from '@engine/gfx/palette';

/**
 * Derives colour-blind-safe and high-contrast variants from the default palettes. The
 * derivations are simple hue/contrast remaps that keep the index roles intact, so every
 * sprite stays readable without hand-drawing alternate art.
 */
export function colorblindPalettes(
  defaults: Record<string, readonly string[]>,
): Omit<PaletteBook, 'default'> {
  const map = (
    fn: (rgb: [number, number, number]) => [number, number, number],
  ): Partial<Record<string, Palette>> => {
    const out: Record<string, Palette> = {};
    for (const [name, pal] of Object.entries(defaults)) out[name] = pal.map((c) => toHex(fn(hexToRgb(c))));
    return out;
  };
  return {
    // Deuteranopia/protanopia: push reds toward orange/magenta and greens toward blue-green/teal.
    deuteranopia: map(([r, g, b]) => {
      if (r > g * 1.3 && r > b * 1.3) return [r, Math.round(g * 0.6), Math.round(Math.min(255, b + 40))];
      if (g > r * 1.3 && g > b * 1.2) return [Math.round(r * 0.5), g, Math.round(Math.min(255, b + 80))];
      return [r, g, b];
    }),
    protanopia: map(([r, g, b]) => {
      if (r > g * 1.3 && r > b * 1.3)
        return [Math.min(255, r + 20), Math.round(g * 0.7), Math.round(Math.min(255, b + 90))];
      if (g > r * 1.3 && g > b * 1.2) return [Math.round(r * 0.4), g, Math.round(Math.min(255, b + 100))];
      return [r, g, b];
    }),
    // Tritanopia: separate blues/yellows: shift blue toward magenta and yellow toward orange-red.
    tritanopia: map(([r, g, b]) => {
      if (b > r * 1.3 && b > g * 1.3) return [Math.round(Math.min(255, r + 80)), Math.round(g * 0.7), b];
      if (r > b * 1.5 && g > b * 1.5) return [r, Math.round(g * 0.7), b];
      return [r, g, b];
    }),
    // High contrast: crush midtones toward black/white while keeping hue.
    highContrast: map(([r, g, b]) => {
      const l = (r + g + b) / 3;
      const k = l > 128 ? 1.35 : 0.55;
      return [clamp(r * k), clamp(g * k), clamp(b * k)];
    }),
  };
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = ([r, g, b]: [number, number, number]) =>
  '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('');
