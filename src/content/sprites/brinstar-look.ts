import { NES } from '@engine/gfx/palette';
import { draw, hash, themed, type Rows } from './look-art';

/**
 * Samus's look for 4-2 in the campaign (theme `brinstar`): blue bubble rock in the dark, in the
 * spirit of the NES Metroid's Brinstar (her cavern below 4-2 keeps its own teal rock). Original
 * art. Every frame keeps its tile's collision shape.
 *
 * - ground: deep blue rock full of round bubbles, lit up-left.
 * - breakable bricks: Brinstar's shootable blocks, four blue squares with orange insets per tile.
 * - hard blocks: white vent blocks; used blocks: plain blue blocks.
 * - pipes: pale grey tubes (SMB's pipe shapes) with a dark joint half way down each body tile.
 * - `tree-top` / `tree-trunk`: a bubble-rock ledge on a segmented blue column; the bridge is a
 *   tube; `castle-brick` is the rock with fewer, darker bubbles.
 * - `?` blocks and coins: SMB's own frames, gold in the dark.
 *
 * Tile palette `tiles-brinstar` keeps the 12 shared roles: 1-3 blues, 4/7 gold, 5/6 the tubes'
 * grey and white, 8 white, 9/a the shootable blocks' orange (4-2 has no water), b lava red.
 *
 * Decor (palette `decor-brinstar`: 1-3 blues, 4-5 white and grey, 6-8 greys for a castle, 9-a
 * orange):
 * - `brinstar-brush` (32x16): a clump of spiky blue brush, standing on its bottom row.
 * - `brinstar-column` (16x48): a pillar of bubble rock for the background.
 */

export const brinstarTilePalette: string[] = [
  NES.black,
  NES.blueDark,
  '#0070ec',
  NES.blueLight,
  NES.yellow,
  NES.lightGray,
  NES.white,
  NES.yellowLight,
  NES.white,
  NES.orangeBrown,
  NES.peach,
  NES.lava,
];

export const brinstarDecorPalette: string[] = [
  NES.black,
  NES.blueDark,
  '#0070ec',
  NES.blueLight,
  NES.white,
  NES.lightGray,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.orangeBrown,
  NES.peach,
];

/* ---------- tiles ---------- */

type Bubble = readonly [number, number, number];

/** Round bubbles on a w x h torus over a dark base (`base`), each rimmed black and lit up-left. */
const bubbles = (w: number, h: number, list: readonly Bubble[], base: string, seed: number): string[] =>
  draw(w, h, (x, y) => {
    for (const [cx, cy, r] of list)
      for (const oy of [-h, 0, h])
        for (const ox of [-w, 0, w]) {
          const dx = x - (cx + ox);
          const dy = y - (cy + oy);
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          if (d > r - 1) return '0';
          if (dx + dy < -r * 0.5 && d > r - 2.2) return '3';
          if (dx < -r * 0.2 && dy < -r * 0.2 && d < 1.2) return '8';
          return '2';
        }
    return base !== '.' && hash(x, y, seed) < 0.06 ? '0' : base;
  });

const ROCK: readonly Bubble[] = [
  [3.5, 3.5, 3.9],
  [11.5, 3, 3.2],
  [7.5, 10.5, 4.1],
  [14.5, 12, 2.7],
  [1.5, 13, 2.7],
  [12.5, 7.5, 1.6],
];
const groundBrinstar = bubbles(16, 16, ROCK, '1', 51);

/** The castle-brick rock: smaller bubbles, sparser, on the dark blue. */
const castleBrickBrinstar = bubbles(
  16,
  16,
  [
    [4, 4, 2.4],
    [12, 9, 2.6],
    [5, 13, 1.8],
  ],
  '1',
  52,
);

/** A shootable block: a blue square with an orange inset ring around a dark centre (8x8). */
const shootable = [
  '33333330',
  '32222210',
  '32999210',
  '32900210',
  '32900210',
  '32222210',
  '31111110',
  '00000000',
];
const brickBrinstar = [...shootable, ...shootable].map((r) => r + r);

/** A vent block: white bevel, grey face, three dark slits. */
const hardBrinstar = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '6';
  if (x === 14 || y === 14) return '0';
  if (x >= 4 && x <= 11 && (y === 5 || y === 8 || y === 11)) return '0';
  if (x >= 4 && x <= 11 && (y === 6 || y === 9 || y === 12)) return '6';
  return '5';
});

/** An emptied block: a plain blue block, bevelled. */
const usedBrinstar = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '3';
  if (x === 14 || y === 14) return '0';
  if ((x === 4 || x === 11) && y >= 4 && y <= 11) return '1';
  if ((y === 4 || y === 11) && x >= 4 && x <= 11) return '1';
  return '2';
});

/** A ledge of the rock (solid all through), its top row lit. */
const treeTopBrinstar = groundBrinstar.map((r, y) => (y === 0 ? r.replace(/[12]/g, '3') : r));

/** The segmented column (scenery): rounded blue segments, four per tile. */
const treeTrunkBrinstar = draw(16, 16, (x, y) => {
  const ly = y % 4;
  const w = ly === 0 || ly === 3 ? 4 : 5;
  const dx = Math.abs(x - 7.5);
  if (dx > w) return '.';
  if (dx > w - 1 || ly === 3) return '0';
  return x < 7 ? '3' : '2';
});

/** A tube bridge: a pale tube on the top five rows, open below. */
const bridgeBrinstar = draw(16, 16, (x, y) => {
  if (y === 0 || y === 4) return '0';
  if (y === 1) return '6';
  if (y < 4) return x === 15 ? '0' : '5';
  return '.';
});

/** Tubes: SMB's pipes in the grey and white slots, a dark joint across the middle of each body tile. */
const jointed = (rows: Rows): string[] => rows.map((r, y) => (y === 7 ? r.replace(/[56]/g, '0') : r));

/**
 * The look's tile frames (registered in tiles.ts as `<tile>@brinstar`); `base` is the tile
 * sheet's own frames.
 */
export function brinstarTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  const keep = (n: string): Rows => base[n] as Rows;
  return themed(
    {
      ground: groundBrinstar,
      brick: brickBrinstar,
      used: usedBrinstar,
      hard: hardBrinstar,
      'castle-brick': castleBrickBrinstar,
      'tree-top': treeTopBrinstar,
      'tree-trunk': treeTrunkBrinstar,
      bridge: bridgeBrinstar,
      'pipe-body-left': jointed(keep('pipe-body-left')),
      'pipe-body-right': jointed(keep('pipe-body-right')),
      ...Object.fromEntries(
        [
          'pipe-top-left',
          'pipe-top-right',
          'pipe-h-top-left',
          'pipe-h-top-right',
          'pipe-h-bottom-left',
          'pipe-h-bottom-right',
          'question-0',
          'question-1',
          'question-2',
          'coin-0',
          'coin-1',
          'coin-2',
          'coin-3',
          'flag-shaft',
          'flag-ball',
        ].map((n) => [n, keep(n)]),
      ),
    },
    'brinstar',
  );
}

/* ---------- decor ---------- */

/** Spiky brush: blades fanning up from a dark root, lit on their left edges. */
const brush = draw(32, 16, (x, y) => {
  const blades = [3, 7, 10, 14, 17, 21, 24, 28];
  for (const [i, bx] of blades.entries()) {
    const lean = (i % 3) - 1;
    const height = 9 + ((i * 5) % 6);
    const top = 15 - height;
    if (y < top) continue;
    const t = (15 - y) / height; // 0 at the root, 1 at the tip
    const cx = bx + lean * t * 3;
    const half = 3.2 * (1 - t) + 0.6;
    if (Math.abs(x - cx) <= half) return x < cx ? '3' : y > 12 ? '1' : '2';
  }
  return y >= 14 && x > 1 && x < 30 ? '1' : '.';
});

/** A pillar of the bubble rock: the rock's texture down a 12-wide shaft, its sides dark blue. */
const column = draw(16, 48, (x, y) => {
  if (x < 2 || x > 13) return '.';
  if (x === 2 || x === 13) return '1';
  return groundBrinstar[y % 16]?.[x] ?? '1';
});

export const brinstarDecorFrames: Record<string, Rows> = {
  'brinstar-brush': brush,
  'brinstar-column': column,
};
