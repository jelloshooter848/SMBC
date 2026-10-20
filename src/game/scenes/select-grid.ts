import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';

/**
 * Classic mode's select screen in the original 3.1.21's layout (CharacterSelectBox.as and
 * CharacterSkinMenu.as / GridMenuBox.as; our own drawing): the HUD on top, a framed panel of square
 * portrait cells (the original's 52 px portraits 4 px apart on its 512 px stage, halved, then
 * fitted so 25 slots sit in three rows of nine), a framed name box under it (the skin's name in
 * quotes, the hero, the game), and the hero standing on the ground below. Its skin menu is a
 * framed grid of the hero's looks, five across and three down a page, titled with the look's
 * name over its source game.
 */

/** The portrait grid: cells `cell` px square, `gap` px apart, `cols` to a row. */
export const SELECT_GRID = { cols: 9, cell: 24, gap: 2, x: 12, y: 36 } as const;
/** The panel round the grid starts this far above and left of it. */
const PANEL_PAD = 6;

/** The skin menu's grid: at most `cols` x `rows` cells of `w` x `h` px a page, `gap` px apart. */
export const SKIN_GRID = { cols: 5, rows: 3, w: 32, h: 36, gap: 2 } as const;
/** The skin menu's panel top (it is sized to its looks, centred, as GridMenuBox sizes its own). */
export const SKIN_PANEL_Y = 30;

/** The skin menu's panel and grid for `n` looks: its box, the grid's top-left and columns. */
export function skinLayout(n: number): {
  x: number;
  y: number;
  w: number;
  h: number;
  gx: number;
  gy: number;
  cols: number;
} {
  const g = SKIN_GRID;
  const cols = Math.max(1, Math.min(g.cols, n));
  const rows = Math.max(1, Math.min(g.rows, Math.ceil(n / g.cols)));
  const gw = cols * g.w + (cols - 1) * g.gap;
  const gh = rows * g.h + (rows - 1) * g.gap;
  // Wide enough for a look's name over it and its game under it.
  const w = Math.max(gw + 16, 176);
  const h = gh + 44;
  const x = 128 - (w >> 1);
  return { x, y: SKIN_PANEL_Y, w, h, gx: 128 - (gw >> 1), gy: SKIN_PANEL_Y + 18, cols };
}

/** The panels' colours: a light blue fill, two blue border lines, red corners. */
export const PANEL = {
  fill: '#a4e4fc',
  outer: '#0000bc',
  inner: '#2038ec',
  corner: '#e40058',
  cell: '#2038ec',
  cellBorder: '#fcfcfc',
  cursor: '#f83800',
  cursorLight: '#f878f8',
} as const;

/** A framed panel: the fill, two border lines one px apart, small red squares at the corners. */
export function drawPanel(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = PANEL.fill,
): void {
  r.rect(x, y, w, h, PANEL.outer);
  r.rect(x + 1, y + 1, w - 2, h - 2, fill);
  r.rect(x + 2, y + 2, w - 4, h - 4, PANEL.inner);
  r.rect(x + 3, y + 3, w - 6, h - 6, fill);
  for (const [cx, cy] of [
    [x, y],
    [x + w - 3, y],
    [x, y + h - 3],
    [x + w - 3, y + h - 3],
  ] as const)
    r.rect(cx, cy, 3, 3, PANEL.corner);
}

/** A cell: blue with a thin white border, or the cursor's two-px red one. */
export function drawCell(r: Renderer, x: number, y: number, w: number, h: number, selected: boolean): void {
  if (selected) {
    r.rect(x - 1, y - 1, w + 2, h + 2, PANEL.cursor);
    r.rect(x + 1, y + 1, w - 2, h - 2, PANEL.cell);
  } else {
    r.rect(x, y, w, h, PANEL.cellBorder);
    r.rect(x + 1, y + 1, w - 2, h - 2, PANEL.cell);
  }
}

/** Cell `i`'s top-left on the select grid. */
export function gridCell(i: number): { x: number; y: number } {
  const g = SELECT_GRID;
  const col = i % g.cols;
  const row = Math.floor(i / g.cols);
  return { x: g.x + col * (g.cell + g.gap), y: g.y + row * (g.cell + g.gap) };
}

/** The select panel's box for `rows` rows of cells. */
export function gridPanel(rows: number): { x: number; y: number; w: number; h: number } {
  const g = SELECT_GRID;
  const w = g.cols * g.cell + (g.cols - 1) * g.gap;
  const h = rows * g.cell + (rows - 1) * g.gap;
  return { x: g.x - PANEL_PAD, y: g.y - PANEL_PAD, w: w + 2 * PANEL_PAD, h: h + 2 * PANEL_PAD };
}

/** Skin menu cell `k` of a page's top-left, for a menu of `n` looks. */
export function skinCell(k: number, n: number): { x: number; y: number } {
  const g = SKIN_GRID;
  const L = skinLayout(n);
  const col = k % L.cols;
  const row = Math.floor(k / L.cols);
  return { x: L.gx + col * (g.w + g.gap), y: L.gy + row * (g.h + g.gap) };
}

/** Draws `draw` clipped to a cell's inside (no clipping on renderers without it). */
export function inCell(r: Renderer, x: number, y: number, w: number, h: number, draw: () => void): void {
  clipped(r, x + 1, y + 1, w - 2, h - 2, draw);
}

/** A small down-arrow (more pages below), 7 px wide, its top-left at (x, y). */
export function drawDownArrow(r: Renderer, x: number, y: number, colour: string = PANEL.cursor): void {
  for (let i = 0; i < 4; i++) r.rect(x + i, y + i, 7 - 2 * i, 1, colour);
}
