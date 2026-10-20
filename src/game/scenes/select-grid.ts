import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';
import { SPRITES } from '@content/sprites';

/**
 * Classic mode's select screen in the original 3.1.21's layout and colours (CharacterSelectBox.as,
 * CharacterSkinMenu.as / GridMenuBox.as, checked against the owner's screenshots of the original;
 * our own drawing and art): the HUD on top with a framed face, a framed panel of portrait cells, a
 * framed name box under it (the skin's name in quotes, the hero, the game), and the hero standing
 * on the next level's sky and ground below. Colours come from a look (SELECT_THEMES). Its skin menu is the same panel holding a
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

/**
 * A look for the select and its skin menu. In the original every menu colour comes from the
 * interface skin, which follows the map skin (GraphicsManager MESSAGE_BOX_BG_COLOR_PNT,
 * GameSettings._interfaceSkin = USE_MAP_SKIN). Two of its looks, as data.
 */
export interface SelectTheme {
  /** Panel and name box fill. */
  fill: string;
  /**
   * The panel's edge: a bevel (`light` top/left line, `shadow` bottom/right line) or lines (from the
   * outside in, one px each, then the fill).
   */
  frame: { kind: 'bevel'; light: string; shadow: string } | { kind: 'lines'; lines: readonly string[] };
  /** The corners: a 2 px rivet with a shadow, set 3 px in, or a 6 px ring round a 4 px square. */
  corner: { kind: 'rivet'; colour: string; shadow: string } | { kind: 'ring'; ring: string; centre: string };
  /** The cells' fill, and their edge: a bevel (`shadow` top/left, `light` bottom/right) or a line. */
  cell: string;
  cellEdge: { kind: 'bevel'; light: string; shadow: string } | { kind: 'line'; colour: string };
  /** The 1 px cursor ring's colour cycle (130 ms a step), and revive mode's. */
  cursor: readonly string[];
  reviveCursor: readonly string[];
  /** Font palettes: the hero's name (FontCharMenu NORMAL), the look and game lines (SELECTED). */
  nameFont: string;
  tintFont: string;
  /** The text's shadow (a font palette). */
  shadowFont: string;
  /** The HUD face's 1 px frame. */
  hudFrame: string;
  /** The skin menu's down-arrows and their shadow. */
  arrow: string;
  arrowShadow: string;
}

/** The two looks: the default SMB NES (brick orange) and Zelda II (the owner's screenshots). */
export const SELECT_THEMES: Readonly<Record<'smb-nes' | 'zelda2', SelectTheme>> = {
  'smb-nes': {
    fill: '#c84c0c',
    frame: { kind: 'bevel', light: '#fcbcb0', shadow: '#000000' },
    corner: { kind: 'rivet', colour: '#fcbcb0', shadow: '#000000' },
    cell: '#7c0800',
    cellEdge: { kind: 'bevel', light: '#fcbcb0', shadow: '#000000' },
    cursor: ['#fce4a0', '#fce4a0', '#fce4a0', '#f0bc3c', '#887000', '#f0bc3c'],
    reviveCursor: ['#a8f0bc', '#a8f0bc', '#a8f0bc', '#4cdc48', '#00a800', '#4cdc48'],
    nameFont: 'font',
    tintFont: 'font-sel-fcbcb0',
    shadowFont: 'font-black',
    hudFrame: '#fc9838',
    arrow: '#fcfcfc',
    arrowShadow: '#000000',
  },
  zelda2: {
    fill: '#5c94fc',
    frame: { kind: 'lines', lines: ['#fcfcfc', '#2038ec', '#2038ec', '#fcfcfc', '#5c94fc', '#5c94fc'] },
    corner: { kind: 'ring', ring: '#fcfcfc', centre: '#d82800' },
    cell: '#2038ec',
    cellEdge: { kind: 'line', colour: '#fcfcfc' },
    cursor: ['#fc7460', '#fc7460', '#fc7460', '#d82800', '#a40000', '#d82800'],
    reviveCursor: ['#80d010', '#80d010', '#80d010', '#009400', '#009400', '#009400'],
    nameFont: 'font',
    tintFont: 'font-sel-c4d4fc',
    shadowFont: 'font-sel-2038ec',
    hudFrame: '#fcfcfc',
    arrow: '#fcfcfc',
    arrowShadow: '#2038ec',
  },
};

/** The look in use: the original's out-of-the-box one (map skin SMB NES) until the owner chooses. */
export const DEFAULT_SELECT_THEME: SelectTheme = SELECT_THEMES['smb-nes'];

/** The cursor ring's colour now: its cycle at 130 ms a step (8 frames), held still with Reduce flashing. */
export function cursorColour(cycle: readonly string[], t: number, reduceFlashing: boolean): string {
  return (reduceFlashing ? cycle[0] : cycle[Math.floor(t / 8) % cycle.length]) ?? '#fcfcfc';
}

/** A framed panel in look `th`: its edge, its fill and its four corners. */
export function drawPanel(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  th: SelectTheme = DEFAULT_SELECT_THEME,
): void {
  const f = th.frame;
  if (f.kind === 'bevel') {
    r.rect(x, y, w, h, f.shadow);
    r.rect(x, y, w - 1, h - 1, f.light);
    r.rect(x + 1, y + 1, w - 2, h - 2, th.fill);
  } else {
    f.lines.forEach((c, k) => r.rect(x + k, y + k, w - 2 * k, h - 2 * k, c));
    const k = f.lines.length;
    r.rect(x + k, y + k, w - 2 * k, h - 2 * k, th.fill);
  }
  const c = th.corner;
  if (c.kind === 'rivet') {
    for (const [cx, cy] of [
      [x + 3, y + 3],
      [x + w - 6, y + 3],
      [x + 3, y + h - 6],
      [x + w - 6, y + h - 6],
    ] as const) {
      r.rect(cx + 1, cy + 1, 2, 2, c.shadow);
      r.rect(cx, cy, 2, 2, c.colour);
    }
  } else {
    for (const [cx, cy] of [
      [x, y],
      [x + w - 6, y],
      [x, y + h - 6],
      [x + w - 6, y + h - 6],
    ] as const) {
      r.rect(cx, cy, 6, 6, c.ring);
      r.rect(cx + 1, cy + 1, 4, 4, c.centre);
    }
  }
}

/** A cell in look `th`, with the cursor's 1 px ring (`cursor`, a colour) when it is on it. */
export function drawCell(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  cursor: string | null,
  th: SelectTheme = DEFAULT_SELECT_THEME,
): void {
  const e = th.cellEdge;
  if (e.kind === 'line') {
    r.rect(x, y, w, h, e.colour);
  } else {
    r.rect(x, y, w, h, e.light);
    r.rect(x, y, w - 1, h - 1, e.shadow);
  }
  r.rect(x + 1, y + 1, w - 2, h - 2, th.cell);
  if (cursor) {
    r.rect(x, y, w, 1, cursor);
    r.rect(x, y + h - 1, w, 1, cursor);
    r.rect(x, y, 1, h, cursor);
    r.rect(x + w - 1, y, 1, h, cursor);
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

/** A small down-arrow (more pages below), 7 px wide, its top-left at (x, y), with its shadow. */
export function drawDownArrow(
  r: Renderer,
  x: number,
  y: number,
  th: SelectTheme = DEFAULT_SELECT_THEME,
): void {
  for (let i = 0; i < 4; i++) r.rect(x + i + 1, y + i + 1, 7 - 2 * i, 1, th.arrowShadow);
  for (let i = 0; i < 4; i++) r.rect(x + i, y + i, 7 - 2 * i, 1, th.arrow);
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
