import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';

/*
 * Zebes Escape's art and sounds (content/sprites/zebes.ts and tourian-zebes.ts, the `tourian`
 * theme, content/music and content/sfx), in one place: the names the escape uses.
 */

/** The sheet Tourian's doors, barriers, brain, guards and the alarm lights are drawn from. */
export const ZEBES_SHEET = 'zebes';
/** A creature struck by a shot (not with reduce flashing). */
export const ZEBES_FLASH = 'zebes-flash';
/** A red door (its bubble in reds: it takes missiles). */
export const ZEBES_RED = 'zebes-red';

/** The zebes sheet's frames the escape draws besides Tourian's: the alarm lights. */
export const ZEBES_FRAMES = ['alarm-0', 'alarm-1'] as const;

/** Tourian's frames of the zebes sheet (content/sprites/tourian-zebes.ts). */
export const TOURIAN_FRAMES = [
  'bubble-door',
  'bubble-door-open',
  'brain-0',
  'brain-1',
  'tank',
  'tank-cracked',
  'tank-broken',
  'zebetite-0',
  'zebetite-1',
  'zebetite-2',
  'zebetite-3',
  'cannon-0',
  'cannon-1',
  'cannon-2',
  'rinka-0',
  'rinka-1',
] as const;

/**
 * Samus materialising, Tourian's music, the escape loop, the alarm, the ending's jingle, the
 * planet's end.
 */
export const ZEBES_SOUNDS = {
  start: 'zebes-start',
  tourian: 'tourian',
  escape: 'zebes-escape',
  alarm: 'alarm',
  victory: 'castle-clear',
  blast: 'explosion',
} as const;

/** Draws `frame` of the zebes sheet (in `palette`) with its top-left at (x, y). */
export function drawZebes(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  flipX = false,
  flipY = false,
  palette?: string,
): void {
  r.sprite(assets.sheet(ZEBES_SHEET, palette), frame, x, y, flipX, flipY);
}
