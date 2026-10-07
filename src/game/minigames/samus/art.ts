import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { zebesDef } from '@content/sprites/zebes';

/*
 * Zebes Escape's art and sounds (content/sprites/zebes.ts, the `cavern` theme, content/music and
 * content/sfx), in one place: the names the escape uses.
 */

/** The sheet the cavern's creatures, the statue, the alarm lights and the ship are drawn from. */
export const ZEBES_SHEET = 'zebes';
/** A creature struck by a shot (not with reduce flashing). */
export const ZEBES_FLASH = 'zebes-flash';
/** The Zoomer's frames turned a quarter (crawling up a wall on its left), made from the sheet. */
export const ZEBES_WALL_SHEET = 'zebes-wall';

/** Every frame of the zebes sheet the escape draws. */
export const ZEBES_FRAMES = [
  'chozo-0',
  'chozo-1',
  'ship',
  'zoomer-0',
  'zoomer-1',
  'ripper-0',
  'ripper-1',
  'skree-0',
  'skree-1',
  'alarm-0',
  'alarm-1',
] as const;

/** The escape loop, the alarm, the win jingle, the ship's engines, the cavern's end. */
export const ZEBES_SOUNDS = {
  escape: 'zebes-escape',
  alarm: 'alarm',
  victory: 'castle-clear',
  liftoff: 'beam',
  blast: 'explosion',
} as const;

/** `rows` turned a quarter clockwise: the bottom row becomes the left column. */
export function rotateClockwise(rows: readonly string[]): string[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const out: string[] = [];
  for (let r = 0; r < w; r++) {
    let line = '';
    for (let c = 0; c < h; c++) line += rows[h - 1 - c]?.[r] ?? '.';
    out.push(line);
  }
  return out;
}

/** The Zoomer on a wall: its frames turned so it holds a wall on its left, head up. */
export const ZEBES_WALL_DEF: SpriteDef = {
  palette: zebesDef.palette,
  frames: Object.fromEntries(
    ['zoomer-0', 'zoomer-1'].map((f) => [f, rotateClockwise(zebesDef.frames[f] ?? [])]),
  ),
};

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

/** Draws a Zoomer frame turned for a wall (the sheet is made from the zebes frames on first use). */
export function drawZebesWall(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  flipX: boolean,
  flipY: boolean,
  palette?: string,
): void {
  if (!assets.has(ZEBES_WALL_SHEET)) {
    if (typeof assets.define !== 'function') return drawZebes(r, assets, frame, x, y, flipX, flipY, palette);
    assets.define(ZEBES_WALL_SHEET, ZEBES_WALL_DEF);
  }
  r.sprite(assets.sheet(ZEBES_WALL_SHEET, palette), frame, x, y, flipX, flipY);
}
