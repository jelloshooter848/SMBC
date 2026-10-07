import { NES } from '@engine/gfx/palette';

/*
 * Art for World 2's Top Secret Area (0.4.10), all original:
 *
 * - the `smw-secret` theme, in the spirit of a Super Mario World secret room: grass-topped dirt
 *   (`tree-top@smw-secret` is the grassy surface, `ground@smw-secret` the dirt under it), a used
 *   block of its own, its own tile palette (the 12 shared roles: ? blocks, coins and pipes keep
 *   their gold and green), and the decor: a big sparkly hill, a small one and green bushes in
 *   their own palette (`decor-smw`) under a cream sky;
 * - on the items sheet (items palette): the Yoshi egg (still, tipped left and right while it
 *   wobbles, cracked; a bit of shell), the friendly Moblin of 2-1's hidden cave (Zelda-style,
 *   16x24, facing LEFT: two breathing frames and his surprise), the cave's fire (two frames),
 *   the cave mouth past 2-1's castle and the map's Top Secret Area node.
 *
 * Hills and bushes are computed from shapes (so their curves stay exact); the rest is drawn here.
 */

type Rows = readonly string[];

const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

/* ---------- the theme's tiles (`@smw-secret`) ---------- */

/** The 12 tile roles (sprites/tiles.ts): warm dirt, SMB's gold, SMW's grass greens. */
export const smwSecretTilePalette: string[] = [
  NES.black,
  '#985820', // dirt dark (speckles, block rims)
  '#d89850', // dirt main
  '#f8d090', // dirt light
  NES.yellow,
  NES.green, // grass, pipes
  NES.greenPipe, // grass light
  NES.yellowLight,
  NES.white,
  NES.blueMid,
  NES.blueLight,
  NES.lava,
];

/** Speckles on the dirt: a few dark and light grains on the main tone, the same on every tile. */
const GRAINS: readonly (readonly [number, number, string])[] = [
  [2, 1, '1'],
  [3, 1, '3'],
  [10, 2, '1'],
  [11, 2, '1'],
  [6, 5, '1'],
  [7, 5, '3'],
  [14, 6, '1'],
  [1, 8, '1'],
  [2, 8, '1'],
  [9, 9, '1'],
  [10, 9, '3'],
  [5, 11, '1'],
  [13, 12, '1'],
  [14, 12, '3'],
  [3, 14, '1'],
  [8, 14, '1'],
  [9, 14, '1'],
];

/** The dirt under the grass: the main tone with its grains; tiles both ways. */
const dirt = draw(16, 16, (x, y) => GRAINS.find(([gx, gy]) => gx === x && gy === y)?.[2] ?? '2');

/** The grassy surface: blades on top, the green turf, a dark wavy edge, then the dirt. */
const grass: Rows = [
  '.6..66.6..6.66.6',
  '6666666666666666',
  '6566665666656665',
  '5555555555555555',
  '5555555555555555',
  '0550555505505550',
  '1001100110011001',
  ...dirt.slice(7),
];

/** A used block: dirt-brown, a dark rim, a lighter bevel and four rivets. */
const used: Rows = [
  '0000000000000000',
  '0333333333333310',
  '0310222222220110',
  '0302222222222010',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0302222222222010',
  '0310222222220110',
  '0311111111111110',
  '0000000000000000',
];

export const smwSecretTileFrames: Record<string, Rows> = {
  ground: dirt,
  'tree-top': grass,
  used,
};

/* ---------- the theme's decor (`decor-smw` palette) ---------- */

/**
 * `decor-smw`: the decor roles (sprites/decor.ts): 1 hill outline, 2 hill green, 3 hill light,
 * 4 sparkle white, 5 sparkle glow; the castle and wood roles as the overworld's.
 */
export const smwDecorPalette: string[] = [
  NES.black,
  '#006830',
  '#20a848',
  '#80d878',
  NES.white,
  '#f8f0a0',
  NES.brownDark,
  NES.orangeBrown,
  NES.tanDark,
  NES.brown,
  NES.brownLight,
];

/**
 * A rounded hill `w` wide and `h` tall: a half-ellipse dome on straight sides, outlined, its
 * light stripes running down its left half, and white four-point sparkles at `sparkles`.
 */
function hill(w: number, h: number, sparkles: readonly (readonly [number, number])[]): string[] {
  const rx = w / 2;
  const ry = Math.min(h, rx);
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    // Below the dome's middle the sides run straight down.
    if (y >= ry) return true;
    const dx = (x + 0.5 - rx) / rx;
    const dy = (y + 0.5 - ry) / ry;
    return dx * dx + dy * dy <= 1;
  };
  const glow = new Set<string>();
  const star = new Set<string>();
  for (const [sx, sy] of sparkles) {
    star.add(`${sx},${sy}`);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      star.add(`${sx + dx},${sy + dy}`);
      glow.add(`${sx + 2 * dx},${sy + 2 * dy}`);
    }
  }
  return draw(w, h, (x, y) => {
    if (!inside(x, y)) return '.';
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)) return '1';
    if (star.has(`${x},${y}`)) return '4';
    if (glow.has(`${x},${y}`)) return '5';
    // Light stripes down the left half, curving with the dome.
    const band = (x + Math.floor(y / 6)) % 10;
    if (x < w * 0.55 && band < 2 && inside(x, y - 3)) return '3';
    return '2';
  });
}

/** A bush: three round green puffs side by side on a flat bottom, outlined, lit on top. */
function bush(): string[] {
  const puffs: [number, number, number][] = [
    [8, 9, 7.5],
    [24, 7, 8.5],
    [40, 9, 7.5],
  ];
  const inside = (x: number, y: number): boolean =>
    y >= 0 &&
    y < 16 &&
    x >= 0 &&
    x < 48 &&
    puffs.some(
      ([cx, cy, r]) =>
        (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r || (y >= cy && Math.abs(x + 0.5 - cx) <= r),
    );
  return draw(48, 16, (x, y) => {
    if (!inside(x, y)) return '.';
    if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)) return '1';
    if (!inside(x, y - 2) || !inside(x - 2, y - 1)) return '3';
    return '2';
  });
}

export const smwDecorFrames: Record<string, Rows> = {
  'smw-hill-big': hill(112, 96, [
    [30, 22],
    [52, 14],
    [76, 30],
    [22, 52],
    [64, 58],
    [90, 70],
    [40, 78],
  ]),
  'smw-hill-small': hill(64, 48, [
    [20, 16],
    [42, 26],
    [30, 38],
  ]),
  'smw-bush': bush(),
};

/* ---------- items sheet (items palette: 0 outline, 1 white, 3 cream, 4 green, 7 orange, 9 brown, b grey) ---------- */

/** The Yoshi egg: white with green spots, cream shade low on its right. */
const yoshiEgg: Rows = [
  '................',
  '......0000......',
  '.....011110.....',
  '....01144110....',
  '...0114441110...',
  '...0111441110...',
  '..011111111440..',
  '..014411114440..',
  '..044441111410..',
  '..014411111130..',
  '..011111441130..',
  '..011114441330..',
  '...0311444330...',
  '....03333330....',
  '.....000000.....',
  '................',
];

/** Tipped while it wobbles: its top half one pixel over, the bottom where it stands. */
const tip = (rows: Rows, dir: -1 | 1): string[] =>
  rows.map((r, y) => (y >= 8 ? r : dir < 0 ? `${r.slice(1)}.` : `.${r.slice(0, -1)}`));

/** Cracked: a jagged black crack across its middle. */
const crack = new Set(['3,7', '4,8', '5,7', '6,8', '7,9', '8,8', '9,7', '10,8', '11,9', '12,8']);
const yoshiEggCrack = yoshiEgg.map((r, y) =>
  [...r].map((c, x) => (crack.has(`${x},${y}`) ? '0' : c)).join(''),
);

/** A bit of shell (8x8), flying off as the egg bursts. */
const eggShell: Rows = [
  '..0000..',
  '.011140.',
  '01144410',
  '01114110',
  '0111110.',
  '.0001110',
  '....000.',
  '........',
];

/** The Moblin (16x24, facing LEFT): pointed ears, a pale snout, a spear held upright in front. */
const moblin0: Rows = [
  '..b.............',
  '.bbb............',
  '..b....0...0....',
  '..9...070.070...',
  '..9..077777770..',
  '..9.07777777770.',
  '..9.07701777770.',
  '..9.07700777770.',
  '..903337777777790',
  '..033333077777990',
  '..030333077779990',
  '..033333077799990',
  '..901110777999990',
  '..9000077799990..',
  '..9.0777333990...',
  '.077770333330....',
  '.077770333330....',
  '..900703333790...',
  '..9.07733779990..',
  '..9.077777999990.',
  '..9..0777999990..',
  '..9..077000790...',
  '..9.0777000777...',
  '..9.000000000000.',
].map((r) => r.slice(0, 16).padEnd(16, '.'));

/** Breathing: his chest and belly up a pixel, the head the same. */
const moblin1: Rows = [
  ...moblin0.slice(0, 14),
  ...moblin0.slice(15, 21),
  moblin0[20] as string,
  ...moblin0.slice(21),
];

/** Surprised: ears up, eye wide, mouth open, the spear thrown up a little. */
const moblinSurprised: Rows = [
  '.b.....0...0....',
  'bbb...070.070...',
  '.b....070.070...',
  '.9...07707770...',
  '.9..077777770...',
  '.9.0777777777 0.',
  '.9.0771117777770',
  '.9.0771017777770',
  '.9033377777777 90',
  '.0333330777779 90',
  '.0303330777799 90',
  '.0333330777999 90',
  '.0011100777999 90',
  '.90000007799990.',
  '.9.07773339990..',
  '0777703333330...',
  '0777703333330...',
  '.900703333790...',
  '.9.07733779990..',
  '.9.077777999990.',
  '.9..0777999990..',
  '.9..077000790...',
  '.9.0777000777...',
  '.9.000000000000.',
].map((r) => r.replace(/ /g, '').slice(0, 16).padEnd(16, '.'));

/** The cave fire: a red-orange flame with a yellow heart on a few embers, two flickers. */
const caveFire0: Rows = [
  '.......7........',
  '......77........',
  '......777.......',
  '.....77777......',
  '....777577......',
  '....7755777.....',
  '...77556577.....',
  '...7756665777...',
  '..77756665577...',
  '..77566666577...',
  '..77566666557...',
  '...775666577....',
  '...777555777....',
  '....7777777.....',
  '...99.99.99.....',
  '..9999999999....',
];
const caveFire1: Rows = caveFire0.map((r, y) =>
  y < 13 ? [...r].reverse().join('').slice(3).padEnd(16, '.') : r,
);

/**
 * The cave mouth past 2-1's castle (64x64): a brown rock outcrop whose dark opening, bottom
 * right, meets the screen's right edge on the ground (the way into the Moblin's cave).
 */
const MOUTH_ROCKS: readonly (readonly [number, number])[] = [
  [6, 54],
  [16, 44],
  [12, 60],
  [26, 34],
  [24, 52],
  [34, 22],
  [36, 42],
  [44, 12],
  [48, 28],
  [56, 8],
  [60, 22],
  [30, 61],
  [52, 40],
  [40, 56],
];
/** Which boulder of the outcrop a pixel belongs to (its nearest seed). */
const rockAt = (x: number, y: number): number => {
  let best = 0;
  let bestD = Infinity;
  MOUTH_ROCKS.forEach(([sx, sy], i) => {
    const d = (x - sx) ** 2 + (y - sy) ** 2 * 1.4;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};
const caveMouth: Rows = draw(64, 64, (x, y) => {
  // The outcrop: a slope from the bottom left up to a flat top at row 6.
  const solid = (px: number, py: number) =>
    py >= Math.max(6, 58 - Math.floor(px * 1.6)) && py < 64 && px < 64;
  if (!solid(x, y)) return '.';
  // The opening: an arch 26 wide at the bottom right, dark all through.
  const ox = x - 38;
  const oy = y - 34;
  if (ox >= 0 && oy >= 0 && (oy >= 13 || (ox - 13) ** 2 + (oy - 13) ** 2 <= 169)) return '0';
  if (!solid(x - 1, y) || !solid(x, y - 1)) return '0';
  // Boulders: dark seams where the next boulder starts, a lit edge on their upper left.
  const c = rockAt(x, y);
  if (rockAt(x + 1, y) !== c || rockAt(x, y + 1) !== c) return '8';
  if (rockAt(x - 1, y) !== c || rockAt(x, y - 1) !== c || rockAt(x - 1, y - 1) !== c) return '3';
  return (x * 7 + y * 13) % 29 === 0 ? '8' : '9';
});

/** The map's Top Secret Area node: the green bonus dot with a gold sparkle over it. */
const nodeTsa: Rows = [
  '.......6........',
  '......616.......',
  '.......6........',
  '................',
  '....00000000....',
  '..001111444400..',
  '.01114444444440.',
  '.01444444444400.',
  '.04444444444000.',
  '.04444444400000.',
  '..000000000000..',
  '....00000000....',
  '................',
  '................',
  '................',
  '................',
];

export const topSecretItemFrames: Record<string, Rows> = {
  'yoshi-egg': yoshiEgg,
  'yoshi-egg-l': tip(yoshiEgg, -1),
  'yoshi-egg-r': tip(yoshiEgg, 1),
  'yoshi-egg-crack': yoshiEggCrack,
  'egg-shell': eggShell,
  'moblin-0': moblin0,
  'moblin-1': moblin1,
  'moblin-surprised': moblinSurprised,
  'cave-fire-0': caveFire0,
  'cave-fire-1': caveFire1,
  'cave-mouth': caveMouth,
  'map-node-tsa': nodeTsa,
};
