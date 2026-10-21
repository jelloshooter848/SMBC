import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { FONT_COLOURS } from '@content/sprites/font';
import { DEFAULT_SELECT_THEME, drawPanel } from './select-grid';

/**
 * The CLASSIC menus' boxes in the original's style (O-04; messageBoxes/MenuBox.as, MessageBox.as):
 * a framed box in the select's own look (drawPanel, DEFAULT_SELECT_THEME), centred, as wide as its
 * text plus a margin, a mushroom cursor, the highlighted row in the select's pink tint and
 * disabled rows grey. BUG-02 (owner): the boxes sit under the logo and keep the demo's ground and
 * heroes in view, so their rows are closer than the original's 34 stage px (12 px, the REMIX
 * title menu's step) and a box shows 6 rows at most, scrolling (with arrows) past that. A box grows open from 1 % in BOX_GROW frames
 * (MessageBox.resizeBox, about 0.14 s), at once with Reduce flashing. All the art is ours.
 */

/** Frames a box takes to grow open (MessageBox.as: about 0.14 s). */
export const BOX_GROW = 8;
/** Row spacing (BUG-02: 12 px; the original's MenuBox.as has 34 stage px, our 17). */
export const BOX_ROW_H = 12;
/** Rows shown before the box scrolls (BUG-02: 6, so a box ends above the demo's heroes; MenuBox.as: 9). */
export const BOX_ROWS = 6;
/** The box's frame to its first row's cell, and its last row's cell to the frame (px). */
const BOX_PAD = 5;
/** A row's text in its cell (px from the cell's top). */
const ROW_TEXT_DY = 2;
/**
 * Where every box over the CLASSIC title starts (BUG-02): just under the logo (CLASSIC ends at
 * y 91), so a box of BOX_ROWS rows ends at 176, above a big hero standing on the demo's ground (208).
 */
export const BOX_TOP = 94;
/** Inside margin each side (MenuBox.as: 20 stage px; ours a little wider for the cursor). */
const MARGIN = 10;
/** The cursor's column in front of the rows. */
const CURSOR_W = 12;

export interface BoxRow {
  label: string;
  /** Drawn right-aligned in the box (a setting's value). */
  value?: string;
  /** A mark after the value (BEATEN). */
  mark?: string;
  /** Greyed out (and skipped by the cursor). */
  disabled?: boolean;
}

/**
 * Our mushroom cursor (8 x 8): `r` cap red, `w` white, `k` black, `s` the stem. Our own drawing;
 * two frames, the second a pixel lower (held on the first with Reduce flashing).
 */
export const MUSHROOM_CURSOR: readonly string[] = [
  '..rrrr..',
  '.rwwrrr.',
  'rwwrrwwr',
  'rrrrrwwr',
  'rrrrrrrr',
  '.kswsk..',
  '..ssss..',
  '..ssss..',
];
const CURSOR_COLOURS: Record<string, string> = {
  r: '#d82800',
  w: '#fcfcfc',
  k: '#000000',
  s: '#fcbcb0',
};

/** The cursor's frame now: it bobs every 16 frames, still with Reduce flashing. */
export function cursorBob(t: number, calm: boolean): 0 | 1 {
  return calm ? 0 : (((t >> 4) % 2) as 0 | 1);
}

export function drawMushroom(r: Renderer, x: number, y: number, t: number, calm: boolean): void {
  const dy = cursorBob(t, calm);
  MUSHROOM_CURSOR.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const c = CURSOR_COLOURS[row[cx] as string];
      if (c) r.rect(x + cx, y + cy + dy, 1, 1, c);
    }
  });
}

/** How open a box is (0..1) `age` frames after it opened. */
export function boxGrowth(age: number, calm: boolean): number {
  if (calm) return 1;
  return Math.max(0.01, Math.min(1, age / BOX_GROW));
}

/** A box's size for these rows (screen px). */
export function boxSize(rows: readonly BoxRow[]): { w: number; h: number } {
  const cols = Math.max(
    1,
    ...rows.map((row) => {
      const right = [row.value, row.mark].filter(Boolean).join(' ');
      return row.label.length + (right ? right.length + 2 : 0);
    }),
  );
  const shown = Math.min(BOX_ROWS, rows.length);
  return { w: Math.min(248, cols * 8 + CURSOR_W + MARGIN * 2), h: shown * BOX_ROW_H + BOX_PAD * 2 };
}

export interface BoxOptions {
  /** Centre (screen px). */
  cx: number;
  cy: number;
  /** 0..1: how far it has grown open (boxGrowth). */
  grow: number;
  /** Frames, for the cursor. */
  t: number;
  calm: boolean;
}

/** Draw a menu box; returns where it is (screen px, full size). */
export function drawMenuBox(
  r: Renderer,
  assets: AssetRegistry,
  rows: readonly BoxRow[],
  index: number,
  o: BoxOptions,
): { x: number; y: number; w: number; h: number } {
  const { w, h } = boxSize(rows);
  const x = Math.round(o.cx - w / 2);
  const y = Math.max(0, Math.min(240 - h, Math.round(o.cy - h / 2)));
  const gw = Math.max(2, Math.round(w * o.grow));
  const gh = Math.max(2, Math.round(h * o.grow));
  drawPanel(r, Math.round(o.cx - gw / 2), Math.round(y + h / 2 - gh / 2), gw, gh, DEFAULT_SELECT_THEME);
  if (o.grow < 1) return { x, y, w, h };
  const first = Math.max(0, Math.min(index - Math.floor(BOX_ROWS / 2), rows.length - BOX_ROWS));
  const plain = assets.sheet('font');
  const pink = assets.sheet('font', DEFAULT_SELECT_THEME.tintFont);
  const grey = assets.sheet('font', FONT_COLOURS.grey);
  const text = (s: string, tx: number, ty: number, sheet: typeof plain) => r.text(sheet, s, tx, ty);
  rows.slice(first, first + BOX_ROWS).forEach((row, i) => {
    const ry = y + BOX_PAD + i * BOX_ROW_H + ROW_TEXT_DY;
    const sel = first + i === index;
    const sheet = row.disabled ? grey : sel ? pink : plain;
    const lx = x + MARGIN + CURSOR_W;
    if (sel) drawMushroom(r, x + MARGIN, ry, o.t, o.calm);
    text(row.label.toUpperCase(), lx, ry, sheet);
    let right = x + w - MARGIN;
    if (row.mark) {
      right -= row.mark.length * 8;
      text(row.mark, right, ry, sheet);
      right -= 8;
    }
    if (row.value) {
      const v = row.value.toUpperCase();
      text(v, right - v.length * 8, ry, sheet);
    }
  });
  // More rows above or below the ones shown: a small arrow at the frame's right, top or bottom.
  if (first > 0) scrollArrow(r, x + w - 8, y + 2, -1);
  if (first + BOX_ROWS < rows.length) scrollArrow(r, x + w - 8, y + h - 5, 1);
  return { x, y, w, h };
}

/** A 5 x 3 arrow (up: `dir` -1) with its top-left at (x, y). */
function scrollArrow(r: Renderer, x: number, y: number, dir: -1 | 1): void {
  for (let i = 0; i < 3; i++) {
    const row = dir < 0 ? i : 2 - i;
    r.rect(x + 2 - i, y + row, 1 + i * 2, 1, '#fcfcfc');
  }
}

/**
 * The centre y of a box of `rows` over the CLASSIC title (BUG-02): its top at BOX_TOP, moved up
 * only when it would not end clear of the line under it (boxLayout).
 */
export function boxCentreUnderLogo(rows: readonly BoxRow[]): number {
  return BOX_TOP + boxSize(rows).h / 2;
}

/** The lines under a CLASSIC box: the status line (when there is one) and the BACK hint. */
export const BOX_STATUS_Y = 218;
export const BOX_BACK_Y = 230;
/** The gap kept between a box and the line under it. */
const BOX_GAP = 3;

/**
 * Where a box of `rows` rows goes (its centre y) with the lines under it: centred at `cy` when it
 * fits, else moved up so it ends clear of the status line (or the BACK hint without one).
 */
export function boxLayout(
  rows: readonly BoxRow[],
  status: boolean,
  cy: number,
): { cy: number; top: number; bottom: number; statusY: number | null; backY: number } {
  const { h } = boxSize(rows);
  const limit = (status ? BOX_STATUS_Y : BOX_BACK_Y) - BOX_GAP;
  const top = Math.max(0, Math.min(Math.round(cy - h / 2), limit - h));
  return { cy: top + h / 2, top, bottom: top + h, statusY: status ? BOX_STATUS_Y : null, backY: BOX_BACK_Y };
}
