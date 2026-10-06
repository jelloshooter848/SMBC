import { hexToRgb, type Palette, type PaletteFx } from '@engine/gfx/palette';

/**
 * Whole-palette recolours (PaletteBook.fx), asked for as `<palette>~<fx>`:
 * - `silhouette`: every colour black (character select's locked heroes);
 * - `rim`: every colour a mid grey (the outline drawn around a silhouette so it reads on black);
 * - `brainwashed` / `brainwashed-glow`: a captive hero's dark purple trance, by brightness (the
 *   glow a little lighter, for the captive's slow pulse).
 * Map pages add `shade-<theme>` / `shade-<theme>-glow` (mapShadeFx): a hidden hero's faint
 * silhouette on the world map, in the page's own ground shade.
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

/** The trance's lilac the map shade's shimmer leans toward. */
const SHIMMER = '#b070e8';
/** How far (0..1) the silhouette's colour moves from the ground's shade toward its main colour. */
const SHADE_LIFT = 0.35;
/** How far (0..1) the shimmer moves the shade toward SHIMMER: faint. */
const SHIMMER_MIX = 0.22;

function mix(a: string, b: string, k: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${ca.map((c, i) => hex(c + ((cb[i] as number) - c) * k)).join('')}`;
}

/**
 * The world map's hidden-hero effects, one pair per map theme palette (`map-<theme>`): every
 * colour becomes that theme's ground shade (palette role 1, a darker tone of the ground the hero
 * stands on) lifted a little toward the ground's main colour (role 2), so the silhouette is just
 * barely visible; `-glow` tints it faintly toward the
 * trance's lilac, for the slow shimmer (left out with reduce flashing).
 */
export function mapShadeFx(mapPalettes: Record<string, readonly string[]>): Record<string, PaletteFx> {
  const out: Record<string, PaletteFx> = {};
  for (const [name, pal] of Object.entries(mapPalettes)) {
    const theme = name.replace(/^map-/, '');
    // A little lighter than the ground's own shade, toward its main colour: barely there.
    const shade = mix(pal[1] ?? '#000000', pal[2] ?? '#000000', SHADE_LIFT);
    const glow = mix(shade, SHIMMER, SHIMMER_MIX);
    out[`shade-${theme}`] = (p) => p.map(() => shade);
    out[`shade-${theme}-glow`] = (p) => p.map(() => glow);
  }
  return out;
}

/** The palette name of `palette` as a hidden hero's map shade on a `theme` page. */
export function mapShadePalette(palette: string, theme: string, glow: boolean): string {
  return `${palette}~shade-${theme}${glow ? '-glow' : ''}`;
}
