import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Mario's house (0.4.36, owner note: the opening happens at Mario's house, not the castle): the
 * furniture of a small, cozy room, drawn by story/opening.ts over its wallpaper, wainscot and
 * plank floor (plain rectangles there). Original 8-bit art generated here from shapes; nothing is
 * traced.
 *
 * Frames (the scene relies on their sizes, see house.test.ts):
 * - `window` (56x48): a wood-framed window with red curtains, a blue morning sky, a cloud and a
 *   green hill outside, and a sill.
 * - `bed` (64x36): a wooden bed with a red blanket, a white trim and a pillow.
 * - `lamp` (20x36): a nightstand with a mushroom lamp on it (a red cap with white spots).
 * - `picture` (24x22): a gold frame round a picture of Peach's castle.
 * - `cap-hook` (16x16): a peg with Luigi's green cap hanging on it.
 * - `clock` (18x28): a wall clock with a pendulum.
 * - `gate-block` (16x16): not furniture: a block of the training gates that close 1-0's way until
 *   a task is done (red and white barrier stripes).
 * - `door-shut` / `door-open` (32x56): the front door (planks, a round window, a brass knob);
 *   open, it shows the bright morning outside with the door swung in against the frame.
 */

/**
 * `house` index roles:
 *   0 outline     1 white       2 wood dark   3 wood        4 wood light  5 red
 *   6 red dark    7 cream       8 sky         9 sky light   a green       b green light
 *   c gold        d pale gold   e grey        f light grey  g green dark
 */
export const housePalettes: Record<string, string[]> = {
  house: [
    NES.black,
    NES.white,
    NES.brownDark,
    NES.brown,
    NES.brownLight,
    NES.redBright,
    NES.redDark,
    NES.tan,
    NES.sky,
    NES.skyLight,
    NES.green,
    NES.greenLight,
    NES.yellow,
    NES.yellowLight,
    NES.gray,
    NES.lightGray,
    NES.greenDark,
  ],
};

type Grid = string[][];
const blank = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill('.'));
const rows = (g: Grid): string[] => g.map((r) => r.join(''));
/** Paint a w x h box at (x, y) in `c` (clipped to the grid). */
function box(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const row = g[yy];
      if (row && xx >= 0 && xx < row.length) row[xx] = c;
    }
}
const dot = (g: Grid, x: number, y: number, c: string): void => box(g, x, y, 1, 1, c);
/** A filled disc of radius r centred on (cx, cy). */
function disc(g: Grid, cx: number, cy: number, r: number, c: string): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (Math.hypot(x - cx, y - cy) <= r) dot(g, x, y, c);
}
/** A box outlined in `edge` and filled with `fill`. */
function panel(g: Grid, x: number, y: number, w: number, h: number, fill: string, edge = '0'): void {
  box(g, x, y, w, h, edge);
  box(g, x + 1, y + 1, w - 2, h - 2, fill);
}

/** The window: curtains, a wood frame with four panes, the morning outside, a sill. */
function windowFrame(): string[] {
  const g = blank(56, 48);
  // The frame and the view: sky, a lighter band low down, a cloud, a hill with a highlight.
  panel(g, 6, 2, 44, 42, '2');
  box(g, 8, 4, 40, 38, '3');
  box(g, 10, 6, 36, 34, '8');
  box(g, 10, 26, 36, 14, '9');
  disc(g, 18, 14, 3, '1');
  disc(g, 22, 13, 4, '1');
  disc(g, 26, 15, 2.5, '1');
  for (let x = 10; x < 46; x++) {
    const top = Math.round(30 + Math.pow((x - 33) / 9, 2) * 3);
    box(g, x, Math.max(24, top), 1, 40 - Math.max(24, top), 'a');
    if (x > 27 && x < 36 && top >= 24) dot(g, x, top + 1, 'b');
  }
  box(g, 10, 37, 36, 3, 'g');
  // The cross bars (wood with a light edge).
  box(g, 27, 4, 3, 38, '3');
  box(g, 27, 4, 1, 38, '4');
  box(g, 8, 21, 40, 3, '3');
  box(g, 8, 21, 40, 1, '4');
  // The sill.
  box(g, 3, 42, 50, 3, '4');
  box(g, 3, 45, 50, 2, '2');
  box(g, 3, 41, 50, 1, '0');
  // Curtains: a rod over the top, folds down each side, tied back a little.
  box(g, 0, 0, 56, 2, '2');
  for (const side of [0, 1]) {
    for (let y = 2; y < 40; y++) {
      const w = y > 24 && y < 30 ? 6 : 9;
      const x0 = side === 0 ? 0 : 56 - w;
      box(g, x0, y, w, 1, '5');
      for (let f = 2; f < w; f += 3) dot(g, side === 0 ? x0 + f : x0 + w - 1 - f, y, '6');
      dot(g, side === 0 ? x0 + w - 1 : x0, y, '6');
    }
    box(g, side === 0 ? 0 : 50, 26, 6, 2, 'c');
  }
  return rows(g);
}

/** The bed: headboard and footboard of wood, a red blanket with a white trim, a pillow. */
function bed(): string[] {
  const g = blank(64, 36);
  // Headboard (rounded top) and footboard.
  panel(g, 0, 2, 9, 34, '3', '2');
  box(g, 1, 0, 7, 3, '2');
  box(g, 2, 1, 5, 2, '3');
  box(g, 2, 4, 1, 26, '4');
  panel(g, 56, 12, 8, 24, '3', '2');
  box(g, 57, 13, 1, 18, '4');
  // The mattress under a red blanket, folds and a white trim at its top.
  panel(g, 8, 14, 49, 16, '5');
  for (let x = 14; x < 56; x += 7) box(g, x, 18, 1, 11, '6');
  box(g, 9, 15, 47, 2, '1');
  box(g, 9, 27, 47, 2, '6');
  // The pillow.
  panel(g, 9, 8, 14, 9, '7');
  box(g, 10, 9, 12, 2, '1');
  // Legs.
  box(g, 2, 30, 4, 6, '2');
  box(g, 58, 30, 4, 6, '2');
  return rows(g);
}

/** A nightstand with a mushroom lamp: a red cap with white spots on a cream stem. */
function lamp(): string[] {
  const g = blank(20, 36);
  panel(g, 0, 20, 20, 16, '3', '2');
  box(g, 1, 21, 18, 1, '4');
  box(g, 2, 27, 16, 1, '2');
  dot(g, 10, 24, 'c');
  dot(g, 10, 31, 'c');
  // The stem, then the cap: a dome outlined in black.
  panel(g, 7, 11, 6, 9, '7');
  box(g, 8, 12, 1, 7, '1');
  for (let y = 1; y <= 11; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((11 - y) / 10.5, 2))) * 9);
    box(g, 10 - half, y, half * 2, 1, '0');
    box(g, 11 - half, y, half * 2 - 2, 1, y === 11 ? '0' : '5');
  }
  disc(g, 10, 5, 2.2, '1');
  disc(g, 4.5, 8, 1.5, '1');
  disc(g, 15.5, 8, 1.5, '1');
  return rows(g);
}

/** A gold frame round a picture of Peach's castle on a hill. */
function picture(): string[] {
  const g = blank(24, 22);
  panel(g, 0, 0, 24, 22, 'c', '2');
  box(g, 1, 1, 22, 1, 'd');
  box(g, 1, 1, 1, 20, 'd');
  box(g, 3, 3, 18, 16, '9');
  box(g, 3, 15, 18, 4, 'a');
  // The castle: a light grey keep with battlements, a tower with a red roof, a dark door.
  box(g, 6, 9, 12, 7, 'f');
  for (let x = 6; x < 18; x += 2) dot(g, x, 8, 'f');
  box(g, 10, 5, 4, 4, 'f');
  box(g, 10, 3, 4, 2, '5');
  dot(g, 11, 2, '5');
  dot(g, 12, 2, '5');
  box(g, 11, 12, 2, 4, '2');
  box(g, 7, 10, 1, 2, '2');
  box(g, 16, 10, 1, 2, '2');
  box(g, 6, 15, 1, 1, 'e');
  return rows(g);
}

/** A wooden peg with Luigi's green cap hanging on it (a white disc on the front). */
function capHook(): string[] {
  const g = blank(16, 16);
  panel(g, 6, 0, 4, 4, '3', '2');
  for (let y = 3; y < 12; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((11 - y) / 8.5, 2))) * 7);
    box(g, 8 - half, y, half * 2, 1, '0');
    box(g, 9 - half, y, half * 2 - 2, 1, 'a');
  }
  box(g, 2, 11, 14, 3, '0');
  box(g, 3, 12, 12, 1, 'g');
  disc(g, 8, 7.5, 2.6, '1');
  box(g, 7, 6, 1, 3, 'a');
  box(g, 7, 8, 3, 1, 'a');
  return rows(g);
}

/** A wall clock: a wood case, a white face with its hands at ten past eight, a gold pendulum. */
function clock(): string[] {
  const g = blank(18, 28);
  panel(g, 0, 0, 18, 28, '3', '2');
  box(g, 1, 1, 1, 26, '4');
  box(g, 0, 0, 18, 2, '2');
  disc(g, 8.5, 8.5, 6, '0');
  disc(g, 8.5, 8.5, 5, '1');
  for (const [x, y] of [
    [8, 4],
    [13, 8],
    [8, 13],
    [4, 8],
  ] as const)
    dot(g, x, y, '0');
  box(g, 8, 6, 1, 3, '0');
  box(g, 9, 8, 3, 1, '0');
  panel(g, 6, 16, 6, 10, '2', '0');
  box(g, 8, 17, 1, 5, 'c');
  disc(g, 8.5, 22.5, 1.6, 'c');
  return rows(g);
}

/**
 * A block of the training gate (tutorial/stage-tutorial.ts, 1-0's gates): red and white barrier
 * stripes running up to the right in a dark frame, a shade along its bottom and right edges.
 */
function gateBlock(): string[] {
  const g = blank(16, 16);
  box(g, 0, 0, 16, 16, '0');
  for (let y = 1; y < 15; y++)
    for (let x = 1; x < 15; x++) dot(g, x, y, ((x + y) >> 2) % 2 === 0 ? '5' : '1');
  box(g, 1, 14, 14, 1, 'e');
  box(g, 14, 1, 1, 14, 'e');
  return rows(g);
}

/** The front door, shut: planks, hinge straps, a round window and a brass knob. */
function doorShut(): string[] {
  const g = blank(32, 56);
  panel(g, 0, 0, 32, 56, '3', '2');
  for (const x of [8, 16, 24]) box(g, x, 1, 1, 54, '2');
  for (const x of [1, 9, 17, 25]) box(g, x, 1, 1, 54, '4');
  box(g, 1, 8, 30, 3, '2');
  box(g, 1, 45, 30, 3, '2');
  disc(g, 16, 22, 6, '2');
  disc(g, 16, 22, 5, '4');
  disc(g, 16, 22, 4, '9');
  box(g, 13, 19, 2, 2, '1');
  disc(g, 25, 31, 2, 'c');
  dot(g, 24, 30, 'd');
  return rows(g);
}

/** The front door, open: the bright morning through the doorway, the door swung in at the left. */
function doorOpen(): string[] {
  const g = blank(32, 56);
  box(g, 0, 0, 32, 56, '9');
  box(g, 0, 0, 32, 20, '8');
  disc(g, 22, 10, 3, '1');
  disc(g, 26, 11, 2.5, '1');
  for (let x = 0; x < 32; x++) {
    const top = Math.round(36 + Math.pow((x - 22) / 8, 2) * 2);
    box(g, x, Math.min(top, 44), 1, 56, 'a');
  }
  box(g, 0, 44, 32, 12, 'b');
  for (let x = 1; x < 32; x += 4) dot(g, x, 46 + ((x * 3) % 7), 'a');
  // The door, seen edge-on against the frame.
  panel(g, 0, 0, 7, 56, '3', '2');
  box(g, 1, 1, 1, 54, '4');
  box(g, 4, 30, 2, 3, 'c');
  return rows(g);
}

export const houseDef: SpriteDef = {
  palette: 'house',
  frames: {
    window: windowFrame(),
    bed: bed(),
    lamp: lamp(),
    picture: picture(),
    'cap-hook': capHook(),
    clock: clock(),
    'gate-block': gateBlock(),
    'door-shut': doorShut(),
    'door-open': doorOpen(),
  },
};
