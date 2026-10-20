import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';
import { SPRITES } from '@content/sprites';

/**
 * Classic mode's select screen in the original 3.1.21's layout and colours (CharacterSelectBox.as,
 * CharacterSkinMenu.as / GridMenuBox.as, checked against the owner's screenshots of the original;
 * our own drawing and art): the HUD on top with a framed face, a periwinkle panel of royal-blue
 * portrait cells, a framed name box under it (the skin's name in quotes, the hero, the game), and
 * the hero standing on the current level's ground below. Its skin menu is the same panel holding a
 * grid of the hero's looks, five across and three down a page, titled with the look's name over
 * its source game.
 *
 * The original's portraits are 52 px, 4 px apart, six to a row, on a 512 px stage. Six to a row
 * would take four rows for our 24 slots (23 heroes and Random), which does not leave the name box
 * and the ground room on 240 px, so ours are eight to a row: 26 px cells, 3 px apart, three rows.
 */

/** The portrait grid: cells `cell` px square, `gap` px apart, `cols` to a row. */
export const SELECT_GRID = { cols: 8, cell: 26, gap: 3, x: 13, y: 36 } as const;
/** The panel round the grid starts this far above and left of it. */
const PANEL_PAD = 6;

/** The skin menu's grid: at most `cols` x `rows` cells of `w` x `h` px a page, `gap` px apart. */
export const SKIN_GRID = { cols: 5, rows: 3, w: 32, h: 36, gap: 3 } as const;
/** The skin menu's panel top (it is sized to its looks, centred, as GridMenuBox sizes its own). */
export const SKIN_PANEL_Y = 30;

/** The original's colours (NES palette values matching its screenshots). */
export const PANEL = {
  /** The panels' and the name box's fill: periwinkle. */
  fill: '#6888fc',
  /** The frame: a light line each side of a blue band. */
  frameLight: '#fcfcfc',
  frameBand: '#0058f8',
  /** The corner squares, red set in white. */
  corner: '#f83800',
  /** The cells: royal blue in a thin white border. */
  cell: '#0000fc',
  cellBorder: '#fcfcfc',
  /** The cursor: a thin salmon border. */
  cursor: '#f87858',
  /** The down-arrows (more pages). */
  arrow: '#fcfcfc',
} as const;

/** The frame's width: light line, two px of blue band, light line. */
export const FRAME = 4;

/**
 * A framed panel: a light line, a blue band and a light line round the periwinkle fill, and a red
 * square set in a white frame at each corner.
 */
export function drawPanel(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = PANEL.fill,
): void {
  r.rect(x, y, w, h, PANEL.frameLight);
  r.rect(x + 1, y + 1, w - 2, h - 2, PANEL.frameBand);
  r.rect(x + 3, y + 3, w - 6, h - 6, PANEL.frameLight);
  r.rect(x + FRAME, y + FRAME, w - 2 * FRAME, h - 2 * FRAME, fill);
  for (const [cx, cy] of [
    [x, y],
    [x + w - 6, y],
    [x, y + h - 6],
    [x + w - 6, y + h - 6],
  ] as const) {
    r.rect(cx, cy, 6, 6, PANEL.frameLight);
    r.rect(cx + 1, cy + 1, 4, 4, PANEL.corner);
  }
}

/** A cell: royal blue in a thin white border, or the cursor's thin salmon one. */
export function drawCell(r: Renderer, x: number, y: number, w: number, h: number, selected: boolean): void {
  r.rect(x, y, w, h, selected ? PANEL.cursor : PANEL.cellBorder);
  r.rect(x + 1, y + 1, w - 2, h - 2, PANEL.cell);
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
  const w = Math.max(gw + 20, 184);
  const h = gh + 46;
  const x = 128 - (w >> 1);
  return { x, y: SKIN_PANEL_Y, w, h, gx: 128 - (gw >> 1), gy: SKIN_PANEL_Y + 19, cols };
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
export function drawDownArrow(r: Renderer, x: number, y: number, colour: string = PANEL.arrow): void {
  for (let i = 0; i < 4; i++) r.rect(x + i, y + i, 7 - 2 * i, 1, colour);
}

const faces = new Map<string, { cx: number; top: number }>();

/**
 * Where a frame's head is: the centre column of its top 12 drawn rows, and its first drawn row
 * (from the frame's own text rows). The select shows each hero as a face close-up, the way the
 * original's portraits are: our standing art doubled, its head filling the cell.
 */
export function faceOf(sheet: string, frame: string): { cx: number; top: number } {
  const key = `${sheet}/${frame}`;
  const hit = faces.get(key);
  if (hit) return hit;
  const rows = SPRITES[sheet]?.frames[frame] ?? [];
  let top = rows.findIndex((r) => /[^.]/.test(r));
  if (top < 0) top = 0;
  let x0 = Infinity;
  let x1 = -1;
  for (let y = top; y < Math.min(rows.length, top + 12); y++) {
    const r = rows[y] ?? '';
    for (let x = 0; x < r.length; x++)
      if (r[x] !== '.') {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  }
  const face = { cx: x1 < 0 ? 8 : (x0 + x1 + 1) / 2, top };
  faces.set(key, face);
  return face;
}

/**
 * A face close-up in a box: frame `frame` of `sheet` (already palette-bound by the caller's draw)
 * at `scale`, its head centred in the box (x, y, w) with `pad` px above it.
 */
export function faceAt(
  sheet: string,
  frame: string,
  x: number,
  y: number,
  w: number,
  scale: number,
  pad = 1,
): { x: number; y: number } {
  const f = faceOf(sheet, frame);
  return { x: Math.round(x + w / 2 - f.cx * scale), y: y + pad - f.top * scale };
}
