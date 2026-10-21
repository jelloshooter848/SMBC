import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';
import { SPRITES } from '@content/sprites';
import { SELECT_FACE_IDS } from '@content/sprites/select-faces';

/**
 * Classic mode's select screen in the original 3.1.21's layout and colours (CharacterSelectBox.as,
 * CharacterSkinMenu.as / GridMenuBox.as, checked against the owner's screenshots of the original;
 * our own drawing and art): the HUD on top with a framed face, a framed panel of portrait cells, a
 * framed name box under it (the skin's name in quotes, the hero, the game), and the hero standing
 * on the next level's sky and ground below. Colours come from a look (SELECT_THEMES). Its skin menu is the same panel holding a
 * grid of the hero's looks, five across and three down a page, titled with the look's name over
 * its source game.
 *
 * The original draws on a 512 x 480 stage; every size here is its own, halved (CharacterSelectBox,
 * CharNameBox, GridMenuBox, MessageBox, TopScreenText). Its boxes are as big as what they hold
 * (MessageBox.createGraphics sizes the fill to its content and puts a 7 px frame round it, here a
 * bevel and rivets inside the same 7 px) and are centred on a fixed point. A list longer than the
 * original's twelve slots (Options > Expansion heroes: 15) takes the wider SELECT_GRID, eight to a
 * row.
 */

/** A portrait grid: cells `cell` px square, `gap` px apart, `cols` to a row, its top-left at (x, y). */
export interface GridLayout {
  readonly cols: number;
  readonly cell: number;
  readonly gap: number;
  readonly x: number;
  readonly y: number;
}

/** A grid of `cols` columns centred on the screen. */
function centredGrid(cols: number, cell: number, gap: number, y: number): GridLayout {
  return { cols, cell, gap, x: 128 - ((cols * cell + (cols - 1) * gap) >> 1), y };
}

/** A box's frame round its content (MessageBoxBackground's corner pieces, 14 px at 512). */
export const BOX_FRAME = 7;

/**
 * The grid panel (CharacterSelectBox): centred on y 80 (Y_POS 160), its portraits 2 px in from
 * the fill's top-left (SPACE_BETWEEN_PORTRAITS) with 2 px more on the right (resizeBox widthOfs 4)
 * and 1 px for the fill (createGraphics +2); the fill is as tall as its rows (two: 56 px). Two
 * rows: 185 x 70, its top at y 45 (80 - 70 / 2), so its cells start 9 px in (BOX_FRAME + 2) at y 54.
 */
export const PANEL = {
  top: 45,
  padLeft: BOX_FRAME + 2,
  padTop: BOX_FRAME + 2,
  padRight: BOX_FRAME + 3,
  padBottom: BOX_FRAME,
} as const;

/**
 * The original's grid (CharacterSelectBox.as 41-42, 69-73: PORTRAIT_SIZE 52, SPACE_BETWEEN_PORTRAITS
 * 4, NUM_PORTS_PER_ROW_ARR [6, 6], halved): two rows of six, 26 px cells 2 px apart, inside the
 * panel at y 45 (PANEL).
 */
export const ORIGINAL_GRID: GridLayout = centredGrid(6, 26, 2, PANEL.top + PANEL.padTop);

/** The wider grid for more than twelve slots: eight to a row (Expansion heroes' 15 take two rows). */
export const SELECT_GRID: GridLayout = centredGrid(8, 26, 3, PANEL.top + PANEL.padTop);

/**
 * The name box (CharNameBox): only as wide as its widest line and as tall as its lines. Its fill is
 * sized to its placeholder ("The Legend of Zelda 2", 316 px at 512) and its three 28 px lines (72
 * px), in the 7 px frame: 158 x 52, centred on y 145 (NAME_BOX_Y_POS 290), so its top is y 119. A
 * hero's own look has two lines and the box closes up from the bottom (resizeBox keeps its top):
 * 38 px. Its lines are 14 px apart from 8 px in. Our prompt goes under it, on the sky.
 */
export const NAME_BOX = { x: 49, y: 119, w: 158, h: 52, h2: 38, top: 8, step: 14 } as const;

/** A select-slot hero's skin preview, in px (Character.SKIN_PREVIEW_SIZE, already 256-px units). */
export interface SkinPreview {
  readonly w: number;
  readonly h: number;
}

/**
 * The original's skin preview sizes by select-slot hero id (Character subclasses' SKIN_PREVIEW_SIZE).
 * Luigi takes Mario's big size (MarioBase SKIN_PREVIEW_SIZE_BIG, 26 x 36) as Princess Peach stands
 * tall; a hero not listed takes Bill's (35 x 38, the tallest).
 */
export const SKIN_PREVIEWS: Readonly<Record<string, SkinPreview>> = {
  mario: { w: 26, h: 36 },
  luigi: { w: 26, h: 36 },
  link: { w: 21, h: 21 },
  samus: { w: 30, h: 38 },
  simon: { w: 23, h: 34 },
  megaman: { w: 33, h: 33 },
  bass: { w: 33, h: 33 },
  bill: { w: 35, h: 38 },
  ryu: { w: 30, h: 36 },
  sophia: { w: 36, h: 24 },
};
const DEFAULT_PREVIEW: SkinPreview = { w: 35, h: 38 };

/**
 * The skin menu (GridMenuBox, halved): cells 1 px bigger than the preview on every side (setUpBorder:
 * SCALE * 2), 2 px apart (spaceBetweenItems 4); as many to a row as fit 210 px (MAX_WIDTH_FOR_ROW
 * 420), as many rows as fit 132 px (VERTICAL_SPACE_FOR_PORTRAITS_LIMIT 264). The look's name on
 * top, the grid 16 px under it (ITEMS_MARGIN_Y 32), the game 8 px under the grid (
 * BOTTOM_TEXT_MARGIN 16), centred on y 120 (STAGE_HEIGHT / 2).
 */
export const SKIN_MENU = {
  rowWidth: 210,
  rowsHeight: 132,
  gap: 2,
  gridTop: 16,
  textUnder: 8,
  centreY: 120,
} as const;

/** Hero `hostId`'s skin menu grid: its cells' size, how many to a row and how many rows a page. */
export function skinGrid(hostId: string): { cols: number; rows: number; w: number; h: number; gap: number } {
  const p = SKIN_PREVIEWS[hostId] ?? DEFAULT_PREVIEW;
  const w = p.w + 2;
  const h = p.h + 2;
  const gap = SKIN_MENU.gap;
  const cols = Math.max(1, Math.floor(SKIN_MENU.rowWidth / (w + gap)));
  let rows = 1;
  while ((rows + 1) * h + rows * gap <= SKIN_MENU.rowsHeight) rows++;
  return { cols, rows, w, h, gap };
}

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

/**
 * How much a MessageBox grows (or shrinks) each frame: MessageBox.grow adds SCALE_INC (7) times
 * the frame's time (1/60 s) to its scale, from 0.01, so it is full size in 9 frames.
 */
export const BOX_GROW_PER_FRAME = 7 / 60;

/**
 * A MessageBox's panel (`w` x `h` at full size) centred on (cx, cy) at `scale` (0-1), as
 * MessageBox.grow and shrink scale it about its centre. Too small for its frame, it is a plain
 * patch of the frame's light colour.
 */
export function drawScaledPanel(
  r: Renderer,
  cx: number,
  cy: number,
  w: number,
  h: number,
  scale: number,
  th: SelectTheme = DEFAULT_SELECT_THEME,
): void {
  const s = Math.max(0, Math.min(1, scale));
  const sw = Math.max(1, Math.round(w * s));
  const sh = Math.max(1, Math.round(h * s));
  const x = Math.round(cx - sw / 2);
  const y = Math.round(cy - sh / 2);
  if (sw < 8 || sh < 8) {
    r.rect(x, y, sw, sh, th.frame.kind === 'bevel' ? th.frame.light : (th.frame.lines[0] ?? th.fill));
    return;
  }
  drawPanel(r, x, y, sw, sh, th);
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
export function gridCell(i: number, g: GridLayout = SELECT_GRID): { x: number; y: number } {
  const col = i % g.cols;
  const row = Math.floor(i / g.cols);
  return { x: g.x + col * (g.cell + g.gap), y: g.y + row * (g.cell + g.gap) };
}

/** The select panel's box for `rows` rows of cells (PANEL's padding round the grid). */
export function gridPanel(
  rows: number,
  g: GridLayout = SELECT_GRID,
): { x: number; y: number; w: number; h: number } {
  const w = g.cols * g.cell + (g.cols - 1) * g.gap;
  const h = rows * g.cell + (rows - 1) * g.gap;
  const P = PANEL;
  return {
    x: g.x - P.padLeft,
    y: g.y - P.padTop,
    w: w + P.padLeft + P.padRight,
    h: h + P.padTop + P.padBottom,
  };
}

/** The skin menu's panel, grid and text rows for its looks. */
export interface SkinLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The grid's top-left, its cells and how many a page. */
  gx: number;
  gy: number;
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  gap: number;
  per: number;
  /** The look's name and its game: their text rows. */
  titleY: number;
  gameY: number;
}

/**
 * Hero `hostId`'s skin menu for `n` looks whose longest name or game is `textW` px: a box as wide
 * as its grid or its text (GridMenuBox's fill fits its content, + 1), framed, centred on y 120;
 * the grid from the fill's left edge, the text centred over it.
 */
export function skinLayout(n: number, hostId = 'megaman', textW = 0): SkinLayout {
  const g = skinGrid(hostId);
  const cols = Math.max(1, Math.min(g.cols, n));
  const rows = Math.max(1, Math.min(g.rows, Math.ceil(n / g.cols)));
  const gw = cols * g.w + (cols - 1) * g.gap;
  const gh = rows * g.h + (rows - 1) * g.gap;
  const inW = Math.max(gw, textW) + 1;
  const inH = SKIN_MENU.gridTop + gh + SKIN_MENU.textUnder + 8;
  const w = inW + 2 * BOX_FRAME;
  const h = inH + 2 * BOX_FRAME;
  const x = 128 - (w >> 1);
  const y = SKIN_MENU.centreY - (h >> 1);
  const gy = y + BOX_FRAME + SKIN_MENU.gridTop;
  return {
    x,
    y,
    w,
    h,
    // Left-aligned in the fill (GridMenuBox.setUpText: items from x 0, ITEMS_MARGIN_X 0).
    gx: x + BOX_FRAME,
    gy,
    cols,
    rows: g.rows,
    cw: g.w,
    ch: g.h,
    gap: g.gap,
    per: g.cols * g.rows,
    titleY: y + BOX_FRAME,
    gameY: gy + gh + SKIN_MENU.textUnder,
  };
}

/** Skin menu cell `k` of a page's top-left (layout `L`). */
export function skinCell(k: number, L: SkinLayout): { x: number; y: number } {
  const col = k % L.cols;
  const row = Math.floor(k / L.cols);
  return { x: L.gx + col * (L.cw + L.gap), y: L.gy + row * (L.ch + L.gap) };
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

/**
 * Look `id`'s own drawn face on the `select-faces` sheet (24 x 24), when it has one: each select
 * slot hero's own look. Any other look: null (its standing art's head, doubled: faceAt).
 */
export function drawnFace(id: string): { sheet: string; palette: string; frame: string } | null {
  return SELECT_FACE_IDS.includes(id) ? { sheet: 'select-faces', palette: 'select-faces', frame: id } : null;
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
