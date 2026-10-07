import { NES } from '@engine/gfx/palette';
import { draw, hash, themed, type Rows } from './look-art';

/**
 * Mega Man's look for 3-1 in the campaign (theme `megaman-stage`): a robot master's night stage
 * in the spirit of the NES Mega Man 2 and 3, violet tech plating and orange pipeworks under a
 * starry navy sky (his space station above 3-1 keeps its own grey steel). Original art. Every
 * frame keeps its tile's collision shape.
 *
 * - ground: a grid of dark violet floor plates.
 * - breakable bricks: SMB's brick courses in violet plating, a bolt on each brick.
 * - hard blocks (3-1's staircases): bolted plates with a mint light strip; used blocks: dark,
 *   empty panels.
 * - pipes: orange pipeworks, the same shapes with ring joints down the body.
 * - the bridge: a girder catwalk (deck on top, open truss under it). `tree-top` / `tree-trunk`:
 *   a girder ledge on a lattice strut. `castle-brick`: the wall panels.
 * - `?` blocks, coins, the flagpole, water and cloud blocks: SMB's own frames.
 *
 * Tile palette `tiles-megaman-stage` keeps the 12 shared roles: 1-3 violets, 4/7 gold, 5/6 the
 * pipes' orange (the flagpole too), 8 white, 9/a water blue, b the mint light strip.
 *
 * Decor (palette `decor-megaman-stage`: 1-3 violets, 4-5 dim night clouds, 6-8 steel greys for a
 * castle that reads as a fortress, 9-a amber lamps and windows):
 * - `tree-big@megaman-stage` (16x48) and `tree-small@megaman-stage` (16x32): dark violet lattice
 *   radio masts, background only (the solid pipes keep the orange). Used for a level's trees.
 * - `mm-skyline` (64x32): a row of dark factory blocks with lit windows, for the background.
 */

export const megamanTilePalette: string[] = [
  NES.black,
  '#24188c',
  '#9878f8',
  '#d8b8f8',
  NES.yellow,
  NES.orange,
  NES.peach,
  NES.yellowLight,
  NES.white,
  NES.blueMid,
  NES.blueLight,
  '#58f898',
];

export const megamanDecorPalette: string[] = [
  NES.black,
  '#24188c',
  '#4428bc',
  '#6844fc',
  '#4c4c9c',
  '#24246c',
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.orange,
  NES.peach,
];

/* ---------- tiles ---------- */

/** An 8-wide bevelled wall panel (12 rows): lit top-left, a vent of two dark slits. */
const panel = [
  '03333330',
  '03222221',
  '03222221',
  '03211221',
  '03222221',
  '03211221',
  '03222221',
  '03211221',
  '03222221',
  '03222221',
  '01111111',
  '00000000',
];
const panels = (rows: number): string[] =>
  Array.from({ length: rows }, (_, y) => (panel[y % 12] as string).repeat(2));

/** An 8x8 floor plate: lit top and left, a dark seam right and below. */
const plate = [
  '22222220',
  '21111100',
  '21111100',
  '21131100',
  '21111100',
  '21111100',
  '20000000',
  '00000000',
];

/** The floor: a grid of dark plates (darker than the bricks), four to a tile. */
const groundMM = [...plate, ...plate].map((r) => r + r);

/** SMB's brick courses, a white bolt on each brick. */
const brickMM = [
  '3333333033333330',
  '2822222028222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220282222202822',
  '1110111111101111',
  '0000000000000000',
  '3333333033333330',
  '2822222028222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220282222202822',
  '1110111111101111',
  '0000000000000000',
];

/** A bolted plate: bevelled, four bolts, a mint light strip across the middle. */
const hardMM = [
  '3333333333333330',
  '3822222222222810',
  '3222222222222210',
  '3221111111112210',
  '3221000000012210',
  '3221bbbbbbb12210',
  '3221bbbbbbb12210',
  '3221000000012210',
  '3221111111112210',
  '3222222222222210',
  '3222222222222210',
  '3222222222222210',
  '3222222222222210',
  '3822222222222810',
  '3111111111111110',
  '0000000000000000',
];

/** An emptied block: a dark panel, lit rim, the strip gone dark. */
const usedMM = [
  '0000000000000000',
  '0333333333333310',
  '0311111111111110',
  '0311111111111110',
  '0311000000001110',
  '0311022222201110',
  '0311022222201110',
  '0311000000001110',
  '0311111111111110',
  '0311111111111110',
  '0311111111111110',
  '0311111111111110',
  '0311111111111110',
  '0311111111111110',
  '0311111111111110',
  '0000000000000000',
];

/** A girder: a plated deck on the top four rows, then an open X truss, a bottom chord. */
const girder = (deck: Rows): string[] =>
  draw(16, 16, (x, y) => {
    if (y < 4) return deck[y]?.[x] ?? '0';
    if (y === 4) return '0';
    if (y === 11) return '1';
    if (y === 12) return '0';
    if (y > 12) return '.';
    const t = y - 5; // 0..5 inside the truss
    const a = (x + t) % 8;
    const b = (x - t + 16) % 8;
    if (a === 0 || b === 0) return '1';
    if (a === 1 || b === 1) return '0';
    return '.';
  });
const deck = ['3333333333333333', '2282222222822222', '2222222222222222', '1111111111111111'];
const bridgeMM = girder(deck);

/** A girder ledge (solid all through: the truss filled in with the dark violet). */
const treeTopMM = draw(16, 16, (x, y) => {
  const g = bridgeMM[y]?.[x] ?? '.';
  if (y > 12) return y === 15 ? '0' : '1';
  return g === '.' ? '0' : g;
});

/** A lattice strut (scenery): two rails with cross bars. */
const treeTrunkMM = draw(16, 16, (x, y) => {
  if (x === 4 || x === 11) return '2';
  if (x === 5 || x === 12) return '1';
  if (x > 5 && x < 11 && (y % 8 === x - 6 || y % 8 === 10 - x)) return '1';
  return '.';
});

const castleBrickMM = panels(16);

/** Pipes in orange with a ring joint (a dark line over a lit one) half way down each body tile. */
const ringed = (rows: Rows): string[] =>
  rows.map((r, y) => (y === 7 ? r.replace(/[56]/g, '0') : y === 8 ? r.replace(/5/g, '6') : r));

/**
 * The look's tile frames (registered in tiles.ts as `<tile>@megaman-stage`); `base` is the tile
 * sheet's own frames.
 */
export function megamanTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  const keep = (n: string): Rows => base[n] as Rows;
  return themed(
    {
      ground: groundMM,
      brick: brickMM,
      used: usedMM,
      hard: hardMM,
      'castle-brick': castleBrickMM,
      'tree-top': treeTopMM,
      'tree-trunk': treeTrunkMM,
      bridge: bridgeMM,
      'pipe-body-left': ringed(keep('pipe-body-left')),
      'pipe-body-right': ringed(keep('pipe-body-right')),
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
          'water-0',
          'water-1',
          'cloud-block',
        ].map((n) => [n, keep(n)]),
      ),
    },
    'megaman-stage',
  );
}

/* ---------- decor ---------- */

/**
 * A lattice radio mast in the background (dark violets 1-2, a single amber lamp pixel at its
 * tip): legs tapering from 14 px wide at the foot to 3 px under the antenna, X-braced every
 * six rows. Open between the struts, so the sky shows through; nothing like a solid pipe.
 */
const mast = (h: number): string[] =>
  draw(16, h, (x, y) => {
    const top = 4;
    if (y < top) return x === 7 ? (y === 0 ? 'a' : '2') : '.';
    const t = (y - top) / (h - top - 1);
    const half = 1.5 + t * 5.5;
    const l = Math.round(7.5 - half);
    const r = Math.round(7.5 + half);
    if (x === l || x === r) return '2';
    if (x < l || x > r) return '.';
    const seg = (y - top) % 6;
    if (seg === 0) return '1';
    const k = seg / 6;
    if (x === Math.round(l + (r - l) * k) || x === Math.round(r - (r - l) * k)) return '1';
    return '.';
  });

const towerMM = mast(48);
const ventMM = mast(32);

/** Factory blocks of three heights, a lit window here and there, a flat foot. */
const skyline = draw(64, 32, (x, y) => {
  const tops = [10, 10, 4, 4, 16, 16, 8, 8];
  const block = Math.floor(x / 8);
  const top = tops[block] ?? 12;
  if (y < top) return '.';
  if (y === top) return '2';
  if (x % 8 === 7) return '0';
  const wx = x % 8;
  const wy = (y - top) % 5;
  if (wx >= 2 && wx <= 4 && wy >= 2 && wy <= 3)
    return hash(block, Math.floor((y - top) / 5), 9) < 0.35 ? 'a' : '0';
  return '1';
});

export const megamanDecorFrames: Record<string, Rows> = {
  'tree-big@megaman-stage': towerMM,
  'tree-small@megaman-stage': ventMM,
  'mm-skyline': skyline,
};
