import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, hash } from './paint';

/*
 * The Top Secret Area as the inside of Kakariko Village's secret house (0.4.41, campaign look
 * `tsa-house` of 2-top-secret; docs/WORLD_MAP.md): a cosy room seen from the side, all original.
 * The ground row is polished floorboards over a stone footing; behind, a plastered wall between
 * dark beams with a stone wainscot, a window on a sunny sky, two hanging lamps (their glow never
 * flickers) and a little painting. The ? blocks stay SMB's ? blocks and the pipe stays a pipe,
 * tinted copper to fit. Outside the campaign the area keeps its Super Mario World look.
 *
 * - the theme's tiles (`tree-top@tsa-house`, the boards; `ground@tsa-house`, the footing) in the
 *   tile palette `tiles-tsa-house` (the 12 shared roles: the pipe's two greens are copper here);
 * - the back wall, one 256×208 frame of the `tsa-house` sheet, placed as the decor
 *   `tsa-house:wall` behind the tiles.
 */

/** The 12 tile roles (sprites/tiles.ts): wood browns, SMB's gold, a copper pipe. */
export const tsaHouseTilePalette: string[] = [
  NES.black,
  '#583418', // wood dark
  '#9c6430', // wood
  '#d09048', // wood light
  NES.yellow,
  '#a85c28', // pipe: copper
  '#e09858', // pipe light
  NES.yellowLight,
  NES.white,
  NES.blueMid,
  NES.blueLight,
  NES.lava,
];

/** Floorboards: a lit top edge, boards in two rows with staggered ends. */
const boards = (() => {
  const c = new Canvas();
  c.each((x, y) => {
    if (y === 0) return '3';
    if (y === 1) return '2';
    if (y === 7 || y === 15) return '1';
    const row = y < 7 ? 0 : 1;
    if ((x + row * 8) % 16 === 15) return '1';
    return hash(x, y, 7) < 0.07 ? '1' : '2';
  });
  return c.rows();
})();

/** The footing under the boards: dark stones. */
const footing = (() => {
  const c = new Canvas();
  c.each((x, y) => {
    const row = Math.floor(y / 8);
    if (y % 8 === 7 || (x + row * 8) % 16 === 15) return '0';
    return y % 8 === 0 ? '2' : '1';
  });
  return c.rows();
})();

export const tsaHouseTileFrames: Record<string, readonly string[]> = {
  'tree-top': boards,
  ground: footing,
};

/**
 * `tsa-house` palette: 0 black  1-2 plaster (light, shade)  3-5 beams (dark, mid, light)
 * 6-8 stone (dark, mid, light)  9-a sky (mid, light)  b white  c-d lamp glow (bright, warm)
 * e iron  f red  g-h green (mid, dark)  i clay.
 */
export const tsaHousePalettes: Record<string, string[]> = {
  'tsa-house': [
    NES.black,
    '#e8d4a8',
    '#c8b080',
    '#583418',
    '#8c5828',
    '#b8783c',
    '#5c5048',
    '#8c7c6c',
    '#b4a490',
    '#88c8f8',
    '#c8e8ff',
    '#f8f8f8',
    '#f8e070',
    '#f8a830',
    '#383838',
    '#c83830',
    '#40a040',
    '#206828',
    '#b05830',
  ],
};

/** The back wall (256×208: the whole room above the floor). */
function backWall(): string[] {
  const W = 256;
  const H = 208;
  const c = new Canvas(W, H);
  // Plaster with a little mottling.
  c.each((x, y) => (hash(x >> 2, y >> 2, 3) < 0.12 ? '2' : '1'));
  // The stone wainscot.
  c.each((x, y) => {
    if (y < 150) return null;
    const row = Math.floor((y - 150) / 10);
    if ((y - 150) % 10 === 9 || (x + row * 11) % 22 === 21) return '6';
    return (y - 150) % 10 === 0 ? '8' : '7';
  });
  c.rect(0, 146, W, 4, '4');
  c.rect(0, 146, W, 1, '5');
  c.rect(0, 149, W, 1, '3');
  // The ceiling beam and the posts.
  c.rect(0, 0, W, 12, '4');
  c.rect(0, 10, W, 2, '3');
  c.rect(0, 0, W, 2, '5');
  for (const x of [0, 96, 160, 248]) {
    c.rect(x, 12, 8, 134, '4');
    c.rect(x, 12, 2, 134, '5');
    c.rect(x + 6, 12, 2, 134, '3');
  }
  // The window: sky, a cloud, a frame with a cross, a sill and a pot of flowers.
  const wx = 24;
  const wy = 40;
  c.rect(wx - 4, wy - 4, 56, 72, '3');
  c.rect(wx - 2, wy - 2, 52, 68, '4');
  c.rect(wx, wy, 48, 64, '9');
  c.each((x, y) => (x >= wx && x < wx + 48 && y >= wy && y < wy + 24 && hash(x, 9) > 0.995 ? 'a' : null));
  c.ellipse(wx + 14, wy + 16, 9, 4, 'b');
  c.ellipse(wx + 22, wy + 13, 7, 5, 'b');
  c.ellipse(wx + 34, wy + 40, 8, 3, 'a');
  c.rect(wx + 23, wy, 2, 64, '4');
  c.rect(wx, wy + 31, 48, 2, '4');
  c.rect(wx - 6, wy + 64, 60, 4, '5');
  c.rect(wx - 6, wy + 68, 60, 2, '3');
  c.ellipse(wx + 24, wy + 59, 7, 5, 'i');
  c.ellipse(wx + 24, wy + 51, 10, 5, (x, y) => ((x + y) % 3 === 0 ? 'h' : 'g'));
  for (const fx of [wx + 17, wx + 24, wx + 31]) {
    c.rect(fx - 1, wy + 46, 3, 3, 'f');
    c.set(fx, wy + 47, 'c');
  }
  // Two hanging lamps: a chain, a brass cap, a warm glass, a soft halo (never flickering).
  for (const lx of [128, 228]) {
    c.rect(lx, 12, 1, 34, 'e');
    c.ellipse(lx + 0.5, 62, 16, 14, (_x, _y, d) => (d > 0.55 ? null : c.get(_x, _y) === '1' ? 'c' : null));
    c.rect(lx - 5, 46, 11, 3, 'e');
    c.rect(lx - 4, 49, 9, 12, 'd');
    c.rect(lx - 3, 50, 7, 9, 'c');
    c.rect(lx - 1, 51, 3, 6, 'b');
    c.rect(lx - 5, 61, 11, 2, 'e');
  }
  // A small painting: a hill under a sun, in a gilt frame.
  const px = 168;
  const py = 70;
  c.rect(px - 3, py - 3, 46, 36, 'd');
  c.rect(px - 2, py - 2, 44, 34, '5');
  c.rect(px, py, 40, 30, 'a');
  c.ellipse(px + 30, py + 8, 4, 4, 'c');
  const inFrame = (x: number, y: number) => x >= px && x < px + 40 && y >= py && y < py + 30;
  c.ellipse(px + 14, py + 30, 18, 12, (x, y) => (inFrame(x, y) ? 'g' : null));
  c.ellipse(px + 14, py + 30, 12, 8, (x, y) => (inFrame(x, y) ? 'h' : null));
  return c.rows();
}

export const tsaHouseDef: SpriteDef = { palette: 'tsa-house', frames: { wall: backWall() } };
