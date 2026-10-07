import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * The wand breaking at the end of 8-4 (campaign, docs/STORY.md 2.12): the king's stolen wand (the
 * same gold rod and pink orb Larry carries, smb3.ts), the glowing pieces it breaks into, and the
 * jagged crack in the air they fall through. Original 8-bit art generated here as text rows;
 * nothing is traced.
 *
 * Conventions the scene (story/wand-break.ts) relies on:
 * - `wand-0..3` (20x20) are the spin, the orb pointing up, up-right, right and down-right, the
 *   wand's middle on the frame's centre; the other four directions are the same frames drawn
 *   flipped both ways. `wand-crack` is `wand-0` with a white crack down it, and `wand-glow` the
 *   cracked wand held in a white rim (the steady highlight that stands in for the flash when
 *   reduce flashing is on).
 * - `piece-0..2` (8x8) are the pieces, each in a lavender glow, centred.
 * - `rift-0/1` (24x56) are the open crack, the two shimmer frames differing only in the rim's
 *   colour and a few sparks; `rift-open-0/1` are the crack a third and two thirds open, centred in
 *   the same box.
 */

/**
 * `wand` index roles:
 *   0 black / outline   1 white           2 gold            3 pale gold       4 brown (rod shade)
 *   5 pink (the orb)    6 magenta         7 lavender glow   8 purple          9 pale cyan
 *   a deep blue (the crack's depth)
 */
export const wandPalettes: Record<string, string[]> = {
  wand: [
    NES.black,
    NES.white,
    NES.yellow,
    NES.yellowLight,
    NES.brown,
    NES.pink,
    NES.magenta,
    NES.lavender,
    NES.purple,
    NES.skyLight,
    NES.blueDark,
  ],
};

type Grid = string[][];
const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill('.'));
const rows = (g: Grid): string[] => g.map((r) => r.join(''));
const get = (g: Grid, x: number, y: number): string => g[y]?.[x] ?? '.';
const put = (g: Grid, x: number, y: number, c: string): void => {
  const row = g[y];
  if (row && x >= 0 && x < row.length) row[x] = c;
};

/** Ring every drawn pixel's empty 4-neighbours in `c` (an outline). */
const outline = (g: Grid, c: string): void => {
  const marks: [number, number][] = [];
  g.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v !== '.') return;
      const near = [get(g, x - 1, y), get(g, x + 1, y), get(g, x, y - 1), get(g, x, y + 1)];
      if (near.some((n) => n !== '.')) marks.push([x, y]);
    }),
  );
  for (const [x, y] of marks) put(g, x, y, c);
};

const WAND = 20;

/** The wand turned `step` eighths of a turn clockwise from orb-up (0..3). */
const wandGrid = (step: number): Grid => {
  const g = grid(WAND, WAND);
  const t = (step * Math.PI) / 4;
  // d points from the middle to the orb, n across the rod (its lit side negative).
  const dx = Math.sin(t);
  const dy = -Math.cos(t);
  for (let y = 0; y < WAND; y++)
    for (let x = 0; x < WAND; x++) {
      const px = x + 0.5 - WAND / 2;
      const py = y + 0.5 - WAND / 2;
      const a = px * dx + py * dy;
      const b = -px * dy + py * dx;
      const orb = (a - 4) * (a - 4) + b * b;
      if (orb <= 2.9 * 2.9) {
        // The orb: pink, a white glint up-left, magenta underneath.
        const glint = (a - 5) * (a - 5) + (b + 1) * (b + 1) <= 0.8;
        put(g, x, y, glint ? '1' : a < 2.6 ? '6' : '5');
      } else if (a >= 0.6 && a <= 1.6 && Math.abs(b) <= 1.7) put(g, x, y, '2');
      else if (a >= -7 && a < 0.6 && Math.abs(b) <= 1) put(g, x, y, a < -5.5 ? '4' : b < 0 ? '3' : '2');
    }
  return g;
};
const wandFrame = (step: number): string[] => {
  const g = wandGrid(step);
  outline(g, '0');
  return rows(g);
};

/** The upright wand with a white crack zigzagging down the orb and the rod. */
const crackedGrid = (): Grid => {
  const g = wandGrid(0);
  const crack: [number, number][] = [
    [10, 3],
    [9, 4],
    [10, 5],
    [10, 6],
    [9, 7],
    [10, 8],
    [10, 9],
    [9, 10],
    [10, 11],
    [9, 12],
  ];
  for (const [x, y] of crack) if (get(g, x, y) !== '.') put(g, x, y, '1');
  return g;
};
const wandCrack = (() => {
  const g = crackedGrid();
  outline(g, '0');
  return rows(g);
})();
// The steady highlight: the cracked wand in a white rim and a lavender halo, no blinking.
const wandGlow = (() => {
  const g = crackedGrid();
  outline(g, '1');
  outline(g, '7');
  return rows(g);
})();

// The pieces: an orb chip, a bit of the rod and a splinter, each glowing lavender.
const piece0 = [
  '........',
  '...77...',
  '..7517..',
  '.755557.',
  '.765567.',
  '..7667..',
  '...77...',
  '........',
];
const piece1 = [
  '........',
  '.....77.',
  '....7327',
  '...73227',
  '..73227.',
  '.73427..',
  '.777....',
  '........',
];
const piece2 = [
  '........',
  '...7....',
  '..717...',
  '.71517..',
  '..7157..',
  '...717..',
  '....7...',
  '........',
];

const RIFT_W = 24;
const RIFT_H = 56;
/** The crack's jagged centre line: an x every 7 rows, joined straight. */
const RIFT_LINE = [12, 10, 14, 9, 13, 11, 15, 11, 12];

/** The crack `open` (0..1) of the way open, with the rim of shimmer `phase`. */
const rift = (open: number, phase: 0 | 1): string[] => {
  const g = grid(RIFT_W, RIFT_H);
  const h = Math.max(4, Math.round(RIFT_H * open));
  const top = Math.round((RIFT_H - h) / 2);
  const rim = phase ? '5' : '7';
  for (let y = top; y < top + h; y++) {
    const t = (y - top + 0.5) / h;
    const f = t * (RIFT_LINE.length - 1);
    const i = Math.min(RIFT_LINE.length - 2, Math.floor(f));
    const cx = (RIFT_LINE[i] as number) + ((RIFT_LINE[i + 1] as number) - (RIFT_LINE[i] as number)) * (f - i);
    const w = 0.6 + 3.4 * Math.sin(Math.PI * t) * open;
    for (let x = 0; x < RIFT_W; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d > w) continue;
      put(g, x, y, d <= w - 2 ? 'a' : d <= w - 1 ? '8' : rim);
    }
  }
  // Sparks in the air beside it, in two sets for the shimmer.
  const sparks: [number, number][] = phase
    ? [
        [4, 14],
        [19, 22],
        [5, 37],
        [20, 44],
      ]
    : [
        [19, 10],
        [3, 25],
        [18, 33],
        [6, 48],
      ];
  if (open >= 1) for (const [x, y] of sparks) put(g, x, y, phase ? '9' : '1');
  return rows(g);
};

export const wandDef: SpriteDef = {
  palette: 'wand',
  frames: {
    'wand-0': wandFrame(0),
    'wand-1': wandFrame(1),
    'wand-2': wandFrame(2),
    'wand-3': wandFrame(3),
    'wand-crack': wandCrack,
    'wand-glow': wandGlow,
    'piece-0': piece0,
    'piece-1': piece1,
    'piece-2': piece2,
    'rift-open-0': rift(1 / 3, 0),
    'rift-open-1': rift(2 / 3, 0),
    'rift-0': rift(1, 0),
    'rift-1': rift(1, 1),
  },
};
