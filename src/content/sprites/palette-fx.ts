import { hexToRgb, type Palette, type PaletteFx } from '@engine/gfx/palette';

/**
 * Whole-palette recolours (PaletteBook.fx), asked for as `<palette>~<fx>`:
 * - `silhouette`: every colour black (character select's locked heroes);
 * - `rim`: every colour a mid grey (the outline drawn around a silhouette so it reads on black);
 * - `brainwashed` / `brainwashed-glow`: a captive hero's dark purple trance, by brightness (the
 *   glow a little lighter, for the captive's slow pulse).
 */
export type HeroFx = 'silhouette' | 'rim' | 'brainwashed' | 'brainwashed-glow';

/** The palette name for `palette` recoloured by `fx` ('luigi' → 'luigi~silhouette'). */
export function fxPalette(palette: string, fx: HeroFx): string {
  return `${palette}~${fx}`;
}

const hex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

/** A purple ramp by brightness: black stays a deep violet, white becomes a pale lilac. */
function purple(boost: number): PaletteFx {
  return (pal: Palette) =>
    pal.map((c) => {
      const [r, g, b] = hexToRgb(c);
      const t = Math.min(1, ((0.3 * r + 0.55 * g + 0.15 * b) / 255) * (1 + boost) + boost * 0.5);
      return `#${hex(36 + 168 * t)}${hex(8 + 120 * t)}${hex(60 + 190 * t)}`;
    });
}

export const HERO_FX: Record<HeroFx, PaletteFx> = {
  silhouette: (pal) => pal.map(() => '#000000'),
  rim: (pal) => pal.map(() => '#7c7c7c'),
  brainwashed: purple(0),
  'brainwashed-glow': purple(0.25),
};
