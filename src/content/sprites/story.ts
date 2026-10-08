import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Props for the 0.4.23 story's opening scenes (docs/STORY.md 2.1, 2.2): the wand Bowser shows off
 * at the end of 1-0 (a short rod with a gold star on its tip), the pink wax seal at the foot of
 * Peach's note, and the folded sheet Toad waves as he runs out of the castle. Original 8-bit art
 * generated here as text rows; nothing is traced.
 *
 * Conventions the scenes (story/bowser-spell.ts, story/opening.ts) rely on:
 * - `star-wand-0` / `star-wand-1` (9x17) are the wand held upright, the star on top; `-1` is the
 *   star's twinkle (white glints on its points), the same size, and differs only in the star.
 *   With reduce flashing the scenes keep to `-0`.
 * - `wax-seal` (13x13) is a round seal with a little gold crown pressed into it.
 * - `note-sheet` (8x9) is a sheet of paper with a few written lines, held at its left edge.
 */

/**
 * `story` index roles:
 *   0 black / outline   1 white            2 gold              3 pale gold        4 dark brown
 *   5 brown (the rod)   6 seal red         7 seal pink         8 seal dark        9 cream paper
 *   a paper shade       b ink brown
 */
export const storyPalettes: Record<string, string[]> = {
  story: [
    NES.black,
    NES.white,
    NES.yellow,
    NES.yellowLight,
    NES.brownDark,
    NES.brown,
    NES.red,
    NES.pink,
    NES.redDark,
    NES.tan,
    NES.tanDark,
    NES.brownDark,
  ],
};

type Grid = string[][];
const toGrid = (rows: readonly string[]): Grid => rows.map((r) => [...r]);
const rows = (g: Grid): string[] => g.map((r) => r.join(''));
const get = (g: Grid, x: number, y: number): string => g[y]?.[x] ?? '.';

/** Ring every drawn pixel's empty 4-neighbours in `c` (an outline). */
const outline = (g: Grid, c: string): Grid => {
  const out = g.map((r) => [...r]);
  g.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v !== '.') return;
      const near = [get(g, x - 1, y), get(g, x + 1, y), get(g, x, y - 1), get(g, x, y + 1)];
      if (near.some((n) => n !== '.')) (out[y] as string[])[x] = c;
    }),
  );
  return out;
};

// The wand: a five-pointed star (pale gold face, gold rim) on a brown rod, drawn inside a 9x17
// box with a one-pixel margin for the outline.
const WAND = [
  '.........',
  '....3....',
  '....2....',
  '.2223222.',
  '..23332..',
  '...222...',
  '..22.22..',
  '..2...2..',
  '....5....',
  '....5....',
  '....4....',
  '....5....',
  '....5....',
  '....4....',
  '....5....',
  '....4....',
  '.........',
];
const wand0 = rows(outline(toGrid(WAND), '0'));
// The twinkle: white glints on the top point and the two arms' tips, and the centre.
const wand1 = (() => {
  const g = toGrid(wand0);
  for (const [x, y] of [
    [4, 1],
    [1, 3],
    [7, 3],
    [4, 4],
  ] as const)
    (g[y] as string[])[x] = '1';
  return rows(g);
})();

/** The wax seal: a disc of seal red, a pink sheen up-left, a dark rim, a gold crown in the middle. */
const SEAL = 13;
const sealGrid = (): Grid => {
  const g: Grid = Array.from({ length: SEAL }, () => Array<string>(SEAL).fill('.'));
  const c = (SEAL - 1) / 2;
  for (let y = 0; y < SEAL; y++)
    for (let x = 0; x < SEAL; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > 6.2) continue;
      const row = g[y] as string[];
      // A slightly lumpy rim, as pressed wax is.
      if (d > 5.3) row[x] = (x * 7 + y * 3) % 5 === 0 ? '.' : '8';
      else row[x] = x + y < c * 2 - 4 ? '7' : '6';
    }
  // The crown: three points over a band, centred.
  const crown = ['2.2.2', '22222', '23332', '22222'];
  crown.forEach((r, dy) =>
    [...r].forEach((v, dx) => {
      if (v !== '.') (g[4 + dy] as string[])[4 + dx] = v;
    }),
  );
  return g;
};

// The sheet Toad waves: cream paper with a shaded fold and three lines of writing.
const NOTE = [
  '00000000',
  '09999990',
  '09bbb9a0',
  '0999999a',
  '09bbbb90',
  '09999990',
  '09bb99a0',
  '0999999a',
  '00000000',
];

export const storyDef: SpriteDef = {
  palette: 'story',
  frames: {
    'star-wand-0': wand0,
    'star-wand-1': wand1,
    'wax-seal': rows(sealGrid()),
    'note-sheet': NOTE,
  },
};
