import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';

/**
 * Link's look for 2-1 in the campaign (theme `zelda2`): a side-view field in the spirit of the NES
 * Zelda II. Original art, nothing traced. Every frame keeps its tile's collision shape (solid
 * tiles fill their 16x16; the bridge's deck is its top rows; the pillar is scenery).
 *
 * - ground: the field's leafy grass, round clumps of green over black.
 * - breakable bricks: palace bricks (magenta, pink-speckled), on SMB's brick courses so they still
 *   read as bricks; used blocks are the palace's plain ledge blocks.
 * - hard blocks (2-1's staircases): speckled grey field stones.
 * - pipes: the same pipes, of grey speckled stone (the field's standing stones).
 * - `tree-top` / `tree-trunk`: a stone lintel on a standing stone; the bridge is a stone slab.
 * - `?` blocks, coins, the flagpole and cloud blocks: SMB's own frames, so they read at a glance.
 *
 * Tile palette `tiles-zelda2` keeps the 12 shared roles (tiles.ts): 1-3 the palace's magentas,
 * 4/7 gold, 5/6 the grass (and the flagpole), 8 white, 9/a stone greys (2-1 has no water).
 *
 * Decor (palette `decor-zelda2`: 1-3 greens, 4-5 white cloud with a grey dither, 6-8 stone greys
 * for a castle that reads as a grey palace, 9-a bark):
 * - `cloud-1/2/3@zelda2` (32/48/64 x16): flat dithered clouds, used for a level's `cloud-*`.
 * - `tree-big@zelda2` (16x48), `tree-small@zelda2` (16x32): round-crowned forest trees.
 * - `henge` (48x32): two standing stones under a lintel, for the field's background. Its stone
 *   is the castle slots (6-8): it is drawn for `decor-zelda2` only.
 */

export const zelda2TilePalette: string[] = [
  NES.black,
  '#680038',
  '#a8005c',
  '#f878b8',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#585858',
  '#a8a8a8',
  NES.lava,
];

export const zelda2DecorPalette: string[] = [
  NES.black,
  NES.greenDark,
  NES.green,
  NES.greenPipe,
  NES.white,
  '#a8a8a8',
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.brownDark,
  NES.brown,
];

/* ---------- tiles ---------- */

/**
 * Leafy clumps on a 16x16 torus (so the field tiles both ways): each pixel takes the lowest clump
 * covering it (lower clumps overlap the ones above), lit up-left, its rim black.
 */
const CLUMPS: readonly (readonly [number, number])[] = [
  [3, 1],
  [11, 1],
  [7, 5],
  [15, 5],
  [3, 9],
  [11, 9],
  [7, 13],
  [15, 13],
];
const leaves = (light: string, main: string, rim: string, seed: number): string[] =>
  draw(16, 16, (x, y) => {
    let best: [number, number, number] | null = null;
    for (const [cx, cy] of CLUMPS) {
      for (const oy of [-16, 0, 16])
        for (const ox of [-16, 0, 16]) {
          const dx = x - (cx + ox);
          const dy = y - (cy + oy);
          const d = Math.hypot(dx * 0.9, dy);
          if (d <= 4.2 && (!best || cy + oy > best[2])) best = [dx, dy, cy + oy];
        }
    }
    if (!best) return rim;
    const [dx, dy] = best;
    const d = Math.hypot(dx * 0.9, dy);
    if (d > 3.4) return rim;
    if (dx + dy < -2.5 || hash(x, y, seed) < 0.06) return light;
    return main;
  });

const groundZelda = leaves('6', '5', '0', 21);

/** SMB's brick courses as palace brick: lit tops, speckled faces, a shaded bottom row. */
const brickBase = [
  '3333333033333330',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
  '3333333033333330',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
];
const speckle = (rows: Rows, from: string, to: string, p: number, seed: number): string[] =>
  rows.map((r, y) => [...r].map((c, x) => (c === from && hash(x, y, seed) < p ? to : c)).join(''));
const brickZelda = speckle(speckle(brickBase, '2', '3', 0.18, 3), '1', '2', 0.2, 4);

/** The palace's plain ledge block: a lit left edge and top, dark speckled face. */
const usedZelda = draw(16, 16, (x, y) => {
  if (y === 15 || x === 15) return '0';
  if (y === 0 || x === 0) return x === 0 && y === 0 ? '0' : '3';
  if (x === 1 || y === 1) return '2';
  if (x === 14 || y === 14) return '0';
  return hash(x, y, 7) < 0.14 ? '2' : '1';
});

/** A field stone: dark grey with light speckle, rounded corners, lit up-left. */
const stone = (w: number, h: number, seed: number): string[] =>
  draw(w, h, (x, y) => {
    const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
    if (corner) return '0';
    if (x === w - 1 || y === h - 1) return '0';
    if (x === 0 || y === 0) return 'a';
    if (x === w - 2 || y === h - 2) return hash(x, y, seed) < 0.3 ? 'a' : '0';
    return hash(x, y, seed) < 0.28 ? 'a' : '9';
  });
const hardZelda = stone(16, 16, 11);

/** The lintel: a stone slab across the whole tile (it repeats sideways), dark underside. */
const treeTopZelda = draw(16, 16, (x, y) => {
  if (y === 0) return 'a';
  if (y >= 14) return y === 15 ? '0' : hash(x, y, 13) < 0.4 ? 'a' : '0';
  return hash(x, y, 13) < 0.28 ? 'a' : '9';
});

/** The standing stone under it (scenery): a speckled column, lit left, dark right. */
const treeTrunkZelda = draw(16, 16, (x, y) => {
  if (x < 3 || x > 12) return '.';
  if (x === 3) return 'a';
  if (x === 12) return '0';
  if (x === 11) return hash(x, y, 17) < 0.3 ? 'a' : '0';
  return hash(x, y, 17) < 0.28 ? 'a' : '9';
});

/** A stone slab bridge: the deck on the top five rows, short corbels under its ends. */
const bridgeZelda = draw(16, 16, (x, y) => {
  if (y === 0) return 'a';
  if (y < 4) return hash(x, y, 19) < 0.28 ? 'a' : '9';
  if (y === 4) return '0';
  if (y < 8 && (x === 1 || x === 2 || x === 13 || x === 14)) return y === 7 ? '0' : '9';
  return '.';
});

/** Palace masonry: the bricks again, darker (shade and mortar), a speckle of the brick colour. */
const castleBrickZelda = speckle(recolour(brickBase, { '3': '2', '2': '1', '1': '0' }), '1', '2', 0.12, 23);

/** A pipe of the field's grey stone: SMB's pipe shape and shading, speckled. */
const stonePipe = (rows: Rows, seed: number): string[] =>
  speckle(recolour(rows, { '5': '9', '6': 'a' }), '9', 'a', 0.16, seed);

/**
 * The look's tile frames (registered in tiles.ts as `<tile>@zelda2`). `base` is the tile sheet's
 * own frames: the pipes are recoloured from them; `?` blocks, coins, the flagpole and cloud blocks
 * are kept as they are.
 */
export function zelda2TileFrames(base: Record<string, Rows>): Record<string, Rows> {
  const keep = (n: string): Rows => base[n] as Rows;
  return themed(
    {
      ground: groundZelda,
      brick: brickZelda,
      used: usedZelda,
      hard: hardZelda,
      'castle-brick': castleBrickZelda,
      'tree-top': treeTopZelda,
      'tree-trunk': treeTrunkZelda,
      bridge: bridgeZelda,
      'pipe-top-left': stonePipe(keep('pipe-top-left'), 31),
      'pipe-top-right': stonePipe(keep('pipe-top-right'), 32),
      'pipe-body-left': stonePipe(keep('pipe-body-left'), 33),
      'pipe-body-right': stonePipe(keep('pipe-body-right'), 34),
      'pipe-h-top-left': stonePipe(keep('pipe-h-top-left'), 35),
      'pipe-h-top-right': stonePipe(keep('pipe-h-top-right'), 36),
      'pipe-h-bottom-left': stonePipe(keep('pipe-h-bottom-left'), 37),
      'pipe-h-bottom-right': stonePipe(keep('pipe-h-bottom-right'), 38),
      ...Object.fromEntries(
        [
          'question-0',
          'question-1',
          'question-2',
          'coin-0',
          'coin-1',
          'coin-2',
          'coin-3',
          'flag-shaft',
          'flag-ball',
          'cloud-block',
        ].map((n) => [n, keep(n)]),
      ),
    },
    'zelda2',
  );
}

/* ---------- decor ---------- */

/** A flat cloud: overlapping puffs of white, the lower rows dithered grey, a flat bottom. */
const cloud = (w: number, seed: number): string[] => {
  const puffs = Array.from({ length: Math.round(w / 12) }, (_, i) => {
    const cx = 6 + (i * (w - 12)) / Math.max(1, Math.round(w / 12) - 1);
    return [cx, 9 - (i % 2 === 0 ? 2 : 0) - hash(i, 0, seed) * 2, 5 + (i % 2) * 0.8] as const;
  });
  return draw(w, 16, (x, y) => {
    if (y > 13) return '.';
    const inside =
      y >= 9 ? x >= 3 && x <= w - 4 : puffs.some(([cx, cy, r]) => Math.hypot(x - cx, (y - cy) * 1.3) <= r);
    if (!inside) return '.';
    if (y >= 11) return (x + y) % 2 === 0 ? '5' : '4';
    return '4';
  });
};

/** A forest tree: a round crown of leaf clumps over a short bark trunk. */
const tree = (h: number, seed: number): string[] => {
  const crown = h - 10;
  const lf = leaves('3', '2', '1', seed);
  return draw(16, h, (x, y) => {
    if (y < crown) {
      const cy = crown / 2;
      const r = crown / 2;
      const d = Math.hypot((x - 7.5) / 8, (y - cy) / r);
      if (d > 1) return '.';
      if (d > 0.9) return '0';
      return lf[y % 16]?.[x] ?? '2';
    }
    if (x < 6 || x > 9) return '.';
    if (x === 6) return 'a';
    if (x === 9) return '0';
    return '9';
  });
};

/** Two standing stones under a lintel (stone in the castle slots 6-8). */
const henge = draw(48, 32, (x, y) => {
  const st = (x0: number, w: number, y0: number, h: number, seed: number): string | null => {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return null;
    const lx = x - x0;
    const ly = y - y0;
    if ((lx === 0 || lx === w - 1) && (ly === 0 || ly === h - 1)) return '.';
    if (lx === w - 1 || ly === h - 1) return '6';
    if (lx === 0 || ly === 0) return '8';
    return hash(x, y, seed) < 0.28 ? '8' : '7';
  };
  return st(2, 44, 0, 9, 41) ?? st(6, 10, 9, 23, 42) ?? st(32, 10, 9, 23, 43) ?? '.';
});

export const zelda2DecorFrames: Record<string, Rows> = {
  'cloud-1@zelda2': cloud(32, 1),
  'cloud-2@zelda2': cloud(48, 2),
  'cloud-3@zelda2': cloud(64, 3),
  'tree-big@zelda2': tree(48, 5),
  'tree-small@zelda2': tree(32, 6),
  henge,
};
