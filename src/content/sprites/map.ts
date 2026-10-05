import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * World map art (original): 16×16 terrain tiles and small decorative actor frames for the eight
 * themed map pages. One frame set recolours into every theme through the `map-<theme>` palettes,
 * which all share these roles:
 *
 *   0 outline / darkest        1 ground dark       2 ground main       3 ground light
 *   4 sand main                5 sand dark         6 water dark        7 water main
 *   8 water light (ripples)    9 foam              a rock dark         b rock main
 *   c rock light               d leaf dark         e leaf main         f leaf light
 *   g wood main                h wood dark         i accent (flowers, mushroom caps, flags)
 *   j accent light (flower centres, moon, stars)   k lava main         l lava light
 *   m wall main                n wall light        o white (snow, spots, clouds)
 *   p white shade              q wall dark (mortar) r accent dark (cap shadow)
 *
 * "Water" is each page's surrounding sea: real water on most pages, a sea of clouds in the sky
 * world and molten lava in Bowser's land, so the generated shores work everywhere.
 *
 * Animated tiles are numbered frames (`water-0`..`water-7`, shores, bridges and surf follow the
 * water's frame so their foam laps in step). The page legend lives in src/content/worldmap/render.ts.
 */

type Rows = string[];

/** Colours per theme in role order (see above). */
const theme = (c: {
  ground: [string, string, string];
  sand: [string, string];
  water: [string, string, string, string];
  rock: [string, string, string];
  leaf: [string, string, string];
  wood: [string, string];
  accent: [string, string, string];
  lava: [string, string];
  wall: [string, string, string];
  white: [string, string];
}): string[] => [
  NES.black,
  c.ground[0],
  c.ground[1],
  c.ground[2],
  c.sand[0],
  c.sand[1],
  c.water[0],
  c.water[1],
  c.water[2],
  c.water[3],
  c.rock[0],
  c.rock[1],
  c.rock[2],
  c.leaf[0],
  c.leaf[1],
  c.leaf[2],
  c.wood[0],
  c.wood[1],
  c.accent[0],
  c.accent[1],
  c.lava[0],
  c.lava[1],
  c.wall[0],
  c.wall[1],
  c.white[0],
  c.white[1],
  c.wall[2],
  c.accent[2],
];

const stone: [string, string, string] = [NES.gray, NES.lightGray, NES.darkGray];
const lava: [string, string] = [NES.lava, NES.lavaLight];

export const mapPalettes: Record<string, string[]> = {
  'map-grass': theme({
    ground: [NES.greenDark, NES.green, NES.greenPipe],
    sand: [NES.tan, NES.tanDark],
    water: [NES.blueMid, NES.blueLight, NES.skyLight, NES.white],
    rock: [NES.brownDark, NES.orangeBrown, NES.brownLight],
    leaf: [NES.greenDark, NES.greenMid, NES.greenLight],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.redBright, NES.yellow, NES.redDark],
    lava,
    wall: stone,
    white: [NES.white, NES.skyLight],
  }),
  /* Sandy islands: the ground itself is beach sand, shells for flowers. */
  'map-sea': theme({
    ground: [NES.brownLight, NES.tan, NES.white],
    sand: [NES.tanDark, NES.brownLight],
    water: [NES.blueMid, NES.blueLight, NES.skyLight, NES.white],
    rock: [NES.brownDark, NES.orangeBrown, NES.brownLight],
    leaf: [NES.greenDark, NES.green, NES.greenLight],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.pink, NES.white, NES.magenta],
    lava,
    wall: stone,
    white: [NES.white, NES.skyLight],
  }),
  /* Dark green hills under a night sky; snow caps and a pale moon. */
  'map-night': theme({
    ground: [NES.black, NES.greenDark, NES.green],
    sand: [NES.tanDark, NES.brownLight],
    water: [NES.black, NES.blueDark, NES.blueMid, NES.lavender],
    rock: [NES.black, NES.darkGray, NES.gray],
    leaf: [NES.black, NES.greenDark, NES.green],
    wood: [NES.brown, NES.brownDark],
    accent: [NES.purple, NES.yellowLight, NES.blueDark],
    lava,
    wall: stone,
    white: [NES.white, NES.lavender],
  }),
  /* Mushroom woods: green floor, orange-leaved trees, red caps with white spots. */
  'map-mushroom': theme({
    ground: [NES.greenDark, NES.green, NES.greenPipe],
    sand: [NES.tan, NES.tanDark],
    water: [NES.blueMid, NES.blueLight, NES.skyLight, NES.white],
    rock: [NES.brownDark, NES.orangeBrown, NES.brownLight],
    leaf: [NES.brownDark, NES.orange, NES.peach],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.redBright, NES.yellow, NES.redDark],
    lava,
    wall: stone,
    white: [NES.white, NES.tan],
  }),
  /* Treetop canopies on tall trunks above a white sea of clouds. */
  'map-sky': theme({
    ground: [NES.greenDark, NES.greenMid, NES.greenLight],
    sand: [NES.tan, NES.tanDark],
    water: [NES.lavender, NES.white, NES.skyLight, NES.skyLight],
    rock: [NES.brownDark, NES.brown, NES.brownLight],
    leaf: [NES.greenDark, NES.green, NES.greenPipe],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.redBright, NES.yellow, NES.redDark],
    lava,
    wall: stone,
    white: [NES.white, NES.skyLight],
  }),
  /* Snow fields at night. */
  'map-snow': theme({
    ground: [NES.purple, NES.lavender, NES.white],
    sand: [NES.lavender, NES.purple],
    water: [NES.black, NES.blueDark, NES.blueUnderground, NES.white],
    rock: [NES.black, NES.darkGray, NES.gray],
    leaf: [NES.black, NES.greenDark, NES.teal],
    wood: [NES.brown, NES.brownDark],
    accent: [NES.blueLight, NES.yellowLight, NES.blueMid],
    lava,
    wall: stone,
    white: [NES.white, NES.lavender],
  }),
  /* Dry coastal grass over grey sea cliffs. */
  'map-coast': theme({
    ground: [NES.olive, NES.brown, NES.yellowLight],
    sand: [NES.tan, NES.tanDark],
    water: [NES.blueDark, NES.blueMid, NES.blueLight, NES.white],
    rock: [NES.darkGray, NES.gray, NES.lightGray],
    leaf: [NES.greenDark, NES.green, NES.greenPipe],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.redBright, NES.yellow, NES.redDark],
    lava,
    wall: stone,
    white: [NES.white, NES.lightGray],
  }),
  /* Ash and rock around a sea of lava. */
  'map-bowser': theme({
    ground: [NES.black, NES.darkGray, NES.gray],
    sand: [NES.gray, NES.darkGray],
    water: [NES.redDark, NES.lava, NES.lavaLight, NES.yellowLight],
    rock: [NES.black, NES.brownDark, NES.orangeBrown],
    leaf: [NES.black, NES.darkGray, NES.gray],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.redBright, NES.yellow, NES.redDark],
    lava,
    wall: [NES.darkGray, NES.gray, NES.black],
    white: [NES.lightGray, NES.gray],
  }),
};

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const fill = (c: string, w = 16, h = 16): Rows => Array.from({ length: h }, () => c.repeat(w));

/** Paint `top` over `bottom` with its top-left at (dx, dy); '.' in `top` keeps what is under it. */
function stamp(bottom: readonly string[], top: readonly string[], dx = 0, dy = 0): Rows {
  const out = bottom.map((r) => r.split(''));
  top.forEach((row, y) => {
    const line = out[y + dy];
    if (!line) return;
    for (let x = 0; x < row.length; x++) {
      const c = row[x] as string;
      if (c !== '.' && x + dx >= 0 && x + dx < line.length) line[x + dx] = c;
    }
  });
  return out.map((r) => r.join(''));
}

/** Rotate a row left by n pixels (wrapping), so tiled rows stay seamless. */
const rotate = (row: string, n: number): string => {
  const k = ((n % row.length) + row.length) % row.length;
  return row.slice(k) + row.slice(0, k);
};

const transpose = (rows: readonly string[]): Rows =>
  Array.from({ length: (rows[0] ?? '').length }, (_, x) => rows.map((r) => r[x] ?? '.').join(''));

/* ------------------------------------------------------------------------------------------ */
/* Ground, sand, flowers                                                                       */
/* ------------------------------------------------------------------------------------------ */

const GROUND = [
  '2222222222222222',
  '2222222222232222',
  '2322222222222222',
  '2222221222222222',
  '2222222222222222',
  '2222222222222212',
  '2222222322222222',
  '2222222222222222',
  '2212222222222222',
  '2222222222232222',
  '2222222222222222',
  '2222322222222222',
  '2222222222222222',
  '2222222221222222',
  '2232222222222232',
  '2222222222222222',
];

const TUFT = ['3.3.3', '13131', '.111.'];
const TUFTS = stamp(stamp(stamp(GROUND, TUFT, 2, 2), TUFT, 10, 8), TUFT, 4, 12);

const FLOWER = ['.i.', 'iji', '.i.', 'd.d'];
const flowers = (sway: number): Rows =>
  stamp(stamp(stamp(GROUND, FLOWER, 2 + sway, 2), FLOWER, 10 - sway, 5), FLOWER, 5 + sway, 10);

const SAND = [
  '4444444444444444',
  '4444444454444444',
  '4544444444444444',
  '4444444444444454',
  '4444445444444444',
  '4444444444444444',
  '4444444444544444',
  '4454444444444444',
  '4444444444444444',
  '4444444544444444',
  '4444444444444544',
  '4544444444444444',
  '4444444444444444',
  '4444444445444444',
  '4444544444444444',
  '4444444444444454',
];

const DRIFT = ['..oooo....', '.oooooop..', 'oooooooopp', '.pppppppp.'];
const SNOW_DRIFT = stamp(stamp(GROUND, DRIFT, 1, 3), DRIFT, 6, 10);

/* ------------------------------------------------------------------------------------------ */
/* Water, shores, surf, bridges                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Water rows as 8-px periods; odd groups drift right, even groups left, one pixel per frame. */
const WATER_ROWS: [period: string, dir: number][] = [
  ['77777777', 0],
  ['77777777', 0],
  ['78877777', 1],
  ['67767777', 1],
  ['77777777', 0],
  ['77777777', 0],
  ['77777887', -1],
  ['77776776', -1],
  ['77777777', 0],
  ['77777777', 0],
  ['77887777', 1],
  ['77677677', 1],
  ['77777777', 0],
  ['77777777', 0],
  ['88777777', -1],
  ['77677777', -1],
];
export const WATER_FRAMES = 8;

const water = (f: number): Rows =>
  WATER_ROWS.map(([p, dir], y) => rotate(p.repeat(2), -dir * f + (y >> 2) * 3));

/** Wobble of a shoreline along the tile (0 at both ends so neighbouring tiles join). */
const WOB = [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0];
const wob = (i: number): number => WOB[((i % 16) + 16) % 16] as number;
const DN = 4; // water depth on a north shore
const DS = 5; // ... on a south shore (a cliff face sits above it)
const DW = 4; // ... on west and east shores

const sides = {
  n: (x: number, y: number) => y < DN + wob(x),
  s: (x: number, y: number) => y >= 16 - DS - wob(x),
  w: (x: number, y: number) => x < DW + wob(y),
  e: (x: number, y: number) => x >= 16 - DW - wob(y),
};
type Mask = (x: number, y: number) => boolean;
/** Rounds the water's tip in an inner corner: (dx, dy) measured inward from the tip's centre. */
const round = (dx: number, dy: number): boolean => dx <= 0 || dy <= 0 || dx * dx + dy * dy <= 4;

/** A round pond four tiles wide and three tall, cut into tiles `pond-0`..`pond-11` (row-major). */
export const POND_W = 4;
export const POND_H = 3;
const pondMask =
  (i: number): Mask =>
  (x, y) =>
    ((x + (i % POND_W) * 16 - 32) / 28) ** 2 + ((y + Math.floor(i / POND_W) * 16 - 24) / 19.5) ** 2 < 1;

/** Shore kinds: which side(s) of the land tile hold water. */
export const SHORES: Record<string, Mask> = {
  n: sides.n,
  s: sides.s,
  w: sides.w,
  e: sides.e,
  nw: (x, y) => sides.n(x, y) || sides.w(x, y) || (x < 7 && y < 7 && (x - 7) ** 2 + (y - 7) ** 2 > 9),
  ne: (x, y) => sides.n(x, y) || sides.e(x, y) || (x > 8 && y < 7 && (x - 8) ** 2 + (y - 7) ** 2 > 9),
  sw: (x, y) => sides.s(x, y) || sides.w(x, y) || (x < 7 && y > 7 && (x - 7) ** 2 + (y - 7) ** 2 > 9),
  se: (x, y) => sides.s(x, y) || sides.e(x, y) || (x > 8 && y > 7 && (x - 8) ** 2 + (y - 7) ** 2 > 9),
  'in-nw': (x, y) => sides.n(x, y) && sides.w(x, y) && round(x - DW + 2, y - DN + 2),
  'in-ne': (x, y) => sides.n(x, y) && sides.e(x, y) && round(17 - DW - x, y - DN + 2),
  'in-sw': (x, y) => sides.s(x, y) && sides.w(x, y) && round(x - DW + 2, 17 - DS - y),
  'in-se': (x, y) => sides.s(x, y) && sides.e(x, y) && round(17 - DW - x, 17 - DS - y),
};

/**
 * Land over water along `mask`: a dark rim on the land edge, a rock cliff face above water to the
 * south, and foam that laps against the shore in step with the water frame.
 */
function shore(mask: Mask, f: number, land: readonly string[] = GROUND): Rows {
  const wet = water(f);
  const lap = f % 4;
  const dist = (x: number, y: number): number => {
    let best = 9;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < best && !mask(x + dx, y + dy)) best = d;
      }
    return best;
  };
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      if (mask(x, y)) {
        const d = dist(x, y);
        if (d === 1) return lap === 3 ? '8' : '9';
        if (d === 2 && (lap === 1 || lap === 2)) return lap === 1 ? '9' : '8';
        return (wet[y] as string)[x] as string;
      }
      for (let k = 1; k <= 4; k++) if (mask(x, y + k)) return k === 1 ? '0' : k === 4 ? 'c' : 'b';
      if (mask(x - 1, y) || mask(x + 1, y) || mask(x, y - 1)) return '1';
      return (land[y] as string)[x] as string;
    }).join(''),
  );
}

/** Beach: sand on top, the sea washing up and back underneath. */
function surf(f: number): Rows {
  const reach = [0, 1, 2, 1, 0, -1, -1, 0][f] as number;
  const edge = (x: number) => 8 + wob(x) - reach;
  const wet = water(f);
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const e = edge(x);
      if (y < e - 2) return (SAND[y] as string)[x] as string;
      if (y < e) return '5';
      if (y === e) return '9';
      if (y === e + 1 && reach > 0) return '9';
      return (wet[y] as string)[x] as string;
    }).join(''),
  );
}

const CLIFF = [
  'cccccccccccccccc',
  'bbbcbbbbbbbcbbbb',
  'bbbbbbabbbbbbbbb',
  'bbabbbabbbbbabbb',
  'bbabbbbbbbbbabbb',
  'bbbbbbbbbabbbbbb',
  'abbbbbbbbabbbbba',
  'abbbbcbbbbbbbbba',
  'bbbbbabbbbbcbbbb',
  'bbbbbabbbbbabbbb',
  'bbbbbbbbbbbabbbb',
  'bbbcbbbbabbbbbbb',
  'bbbabbbbabbbbbcb',
  'bbbabbbbbbbbbbab',
  'abbbbbbbbbbbbbab',
  'aaabbbaaaabbbaaa',
];

/** A cliff face standing in the water, foam breaking at its foot. */
function cliffSea(f: number): Rows {
  const wet = water(f);
  const foot = (x: number) => 10 + wob(x);
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const e = foot(x);
      if (y < e) return y === e - 1 ? 'a' : ((CLIFF[y] as string)[x] as string);
      if (y === e || (y === e + 1 && (x + f) % 4 < 2)) return '9';
      return (wet[y] as string)[x] as string;
    }).join(''),
  );
}

/** Plank bridge (left-right) over water; rows 3-12 are the deck. */
const DECK = [
  '0000000000000000',
  'hhhhhhhhhhhhhhhh',
  'gggghggggghggggg',
  'gggghggggghggggg',
  'gggghggggghggggg',
  'gggghggggghggggg',
  'gggghggggghggggg',
  'gggghggggghggggg',
  'hhhhhhhhhhhhhhhh',
  '0000000000000000',
];
const bridgeH = (f: number): Rows => stamp(water(f), DECK, 0, 3);
const bridgeV = (f: number): Rows => stamp(water(f), transpose(DECK), 3, 0);

/** Deck pieces laid over a shore's water strip where a bridge lands. */
const landing = (kind: 'w' | 'e' | 'n' | 's', f: number): Rows => {
  const base = shore(SHORES[kind] as Mask, f);
  const strip = (len: number) => DECK.map((r) => r.slice(0, len));
  if (kind === 'w') return stamp(base, strip(6), 0, 3);
  if (kind === 'e') return stamp(base, strip(6), 10, 3);
  if (kind === 'n') return stamp(base, transpose(strip(6)), 3, 0);
  return stamp(base, transpose(strip(10)), 3, 6);
};

/* ------------------------------------------------------------------------------------------ */
/* Scenery                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const TREE = stamp(GROUND, [
  '.....000000.....',
  '...00ffeeee00...',
  '..0ffeeeeeeed0..',
  '.0feeeefeeeeed0.',
  '.0eeeeeeeeeeed0.',
  '0feeeeeeeefeedd0',
  '0eeeeeeeeeeeedd0',
  '0eeefeeeeeeeddd0',
  '0eeeeeeeeedeedd0',
  '.0deeeeeeeeddd0.',
  '.0ddeedddddddd0.',
  '..00dddddddd00..',
  '....000hg000....',
  '......0hg0......',
  '.....11hg011....',
  '......11111.....',
]);

const PALM = stamp(GROUND, [
  '....000.000.....',
  '..00fee0eef00...',
  '.0feeeeeeeeef0..',
  '0ee00eeheee00e0.',
  '0e0.0e0h00e0.0e0',
  '.0..0.0hg0.0..0.',
  '.......0hg0.....',
  '.......0hg0.....',
  '........0hg0....',
  '........0hg0....',
  '........0hg0....',
  '.......0hg0.....',
  '.......0hg0.....',
  '......0hhgg0....',
  '.....1111111....',
  '................',
]);

const HILL_SHAPE = [
  '................',
  '................',
  '.....000000.....',
  '...00ffffee00...',
  '..0fffeeeeeee0..',
  '.0ffeeeeeeeeed0.',
  '.0feeeeeeeeeed0.',
  '0ffeeeeeeeeeedd0',
  '0feeeeeeeeeeedd0',
  '0feeeeeeeeeeedd0',
  '0eeeeeeeeeeeddd0',
  '0eeeeeeeeeeeddd0',
  '0deeeeeeeeedddd0',
  '0ddeeeeeeeddddd0',
  '.0dddddddddddd0.',
  '..000000000000..',
];
const HILL = stamp(GROUND, HILL_SHAPE);
const HILL_SNOW = stamp(
  HILL,
  [
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '...oooooooopp...',
    '..ooooooooooop..',
    '..opo.oooo.op...',
    '...p...op...p...',
  ],
  0,
  0,
);

const MOUNTAIN = stamp(GROUND, [
  '.......00.......',
  '......0oo0......',
  '.....0oooo0.....',
  '....0oocopp0....',
  '....0occbbbb0...',
  '...0ccbbbbbab0..',
  '...0cbbbbbbbab0.',
  '..0cbbbbbbbbaab0',
  '..0cbbbbbbbbbaa0',
  '.0cbbbbbbbbbbaa0',
  '.0cbbbbbbbbbbba0',
  '0cbbbbbbbbbbbbaa',
  '0cbbbbbbbbbbbbba',
  '0bbbbbbbbbbbbbba',
  '0aaaaaaaaaaaaaa0',
  '.11111111111111.',
]);

const ROCK = stamp(GROUND, [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '...00cccbbb00...',
  '..0cccbbbbbba0..',
  '..0ccbbbbbbba0..',
  '.0cbbbbbbbbbaa0.',
  '.0cbbbbbbbbaaa0.',
  '.0bbbbbbbbbaaa0.',
  '..0abbbbbaaaa0..',
  '...0000000000...',
  '..111111111111..',
  '................',
  '................',
]);

/** Horizon: rolling ground with the sky showing above it (plain and snow-capped). */
const RIDGE = stamp(
  [...fill('.', 16, 9), ...GROUND.slice(9)],
  [
    '................',
    '................',
    '................',
    '................',
    '.....000000.....',
    '...0033333300...',
    '..033322222330..',
    '.03322222222330.',
    '0332222222222330',
    '3322222222222233',
  ],
);
const RIDGE_SNOW = stamp(RIDGE, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....ooooo......',
  '...ooooooooo....',
  '..oopo.oooopo...',
  '..p.....pp..p...',
]);

const CAP_W = 48;
/** Giant mushroom cap, three tiles wide, on ground. */
const CAP: Rows = (() => {
  const spots = [
    [8, 5, 2.2],
    [22, 3, 2.6],
    [36, 6, 2.2],
    [15, 9, 1.6],
    [30, 10, 1.6],
  ] as const;
  const inside = (x: number, y: number) => {
    if (y > 13) return false;
    if (y >= 10) return x >= 1 && x <= CAP_W - 2;
    return ((x + 0.5 - CAP_W / 2) / (CAP_W / 2 - 1)) ** 2 + ((y - 10) / 9.5) ** 2 <= 1;
  };
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: CAP_W }, (_, x) => {
      if (!inside(x, y))
        return y === 14 && x > 1 && x < CAP_W - 2 ? '1' : ((GROUND[y] as string)[x % 16] as string);
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) return '0';
      for (const [sx, sy, r] of spots) if ((x - sx) ** 2 + (y - sy) ** 2 <= r * r) return 'o';
      if (y >= 12) return 'r';
      if (x > CAP_W * 0.72 && y > 4) return 'r';
      return 'i';
    }).join(''),
  );
})();
const capPart = (i: number): Rows => CAP.map((r) => r.slice(i * 16, i * 16 + 16));
const STEM = stamp(GROUND, [
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '....04444550....',
  '...0444444550...',
  '...0444444550...',
  '..044444445550..',
  '..000000000000..',
  '..111111111111..',
]);

/** Treetop platform in the sky (left end, middle, right end) and the trunk under it. */
const TREETOP_MID = [
  '.ff..fff..fff..f',
  'ffffffffffffffff',
  'eeffeeeeffeeeeff',
  'eeeeeeeeeeeeeeee',
  'eeeeedeeeeeeedee',
  'eeeeeeeeedeeeeee',
  'edeeeeeeeeeeeeed',
  'eeeeeeedeeeeeeee',
  'deeedeeeeeedeeee',
  'dddddddddddddddd',
  '0000000000000000',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const TREETOP_LEFT = TREETOP_MID.map((r, y) => {
  const cut = [4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1][y];
  return cut === undefined ? r : '.'.repeat(cut) + '0' + r.slice(cut + 1);
});
const TREETOP_RIGHT = TREETOP_LEFT.map((r) => r.split('').reverse().join(''));
const TRUNK = Array.from({ length: 16 }, (_, y) => (y % 5 === 2 ? '.....0hgghg0....' : '.....0hgggg0....'));

/** Castle stonework: plain wall, battlements against the sky, and a gate. */
const WALL = [
  'qqqqqqqqqqqqqqqq',
  'nnnnnnnqnnnnnnnq',
  'nmmmmmmqnmmmmmmq',
  'nmmmmmmqnmmmmmmq',
  'qqqqqqqqqqqqqqqq',
  'nnnqnnnnnnnqnnnn',
  'mmmqnmmmmmmqnmmm',
  'mmmqnmmmmmmqnmmm',
  'qqqqqqqqqqqqqqqq',
  'nnnnnnnqnnnnnnnq',
  'nmmmmmmqnmmmmmmq',
  'nmmmmmmqnmmmmmmq',
  'qqqqqqqqqqqqqqqq',
  'nnnqnnnnnnnqnnnn',
  'mmmqnmmmmmmqnmmm',
  'mmmqnmmmmmmqnmmm',
];
const BATTLEMENT = [
  '0000....0000....',
  '0nn0....0nn0....',
  '0mm0....0mm0....',
  '0mm0....0mm0....',
  '0000000000000000',
  ...WALL.slice(5),
];
const GATE = stamp(WALL, [
  '................',
  '................',
  '................',
  '......0000......',
  '....00000000....',
  '...0000000000...',
  '...0000000000...',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
]);

const PIPE = stamp(GROUND, [
  '................',
  '0000000000000000',
  '0fffeeeeeeeeedd0',
  '0feeeeeeeeeeedd0',
  '0000000000000000',
  '.0ffeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.0feeeeeeeeedd0.',
  '.00000000000000.',
  '.11111111111111.',
  '................',
]);

/** Cannon on a stone block, facing left. */
const BLASTER = stamp(GROUND, [
  '................',
  '.....00000000...',
  '...00cbbbbbbb0..',
  '..0cbbbbbbbbbb0.',
  '..0b000bbbbbba0.',
  '..0b0j0bbbbbba0.',
  '..0b000bbbbbba0.',
  '..0bbbbbbbbbaa0.',
  '...00aaaaaaaa0..',
  '....0000000000..',
  '...0nnnnnnnnnq0.',
  '...0nmmmmmmmmq0.',
  '...0nmmmmmmmmq0.',
  '...0qqqqqqqqqq0.',
  '...000000000000.',
  '..111111111111..',
]);

/* Sky details on transparent backgrounds. */
const starTile = (size: number, cx: number, cy: number): Rows => {
  const rows = fill('.').map((r) => r.split(''));
  const put = (x: number, y: number, c: string) => {
    const row = rows[y];
    if (row && x >= 0 && x < 16) row[x] = c;
  };
  put(cx, cy, size > 0 ? 'o' : 'j');
  for (let k = 1; k <= size; k++) {
    const c = k === size ? 'p' : 'j';
    put(cx - k, cy, c);
    put(cx + k, cy, c);
    put(cx, cy - k, c);
    put(cx, cy + k, c);
  }
  return rows.map((r) => r.join(''));
};

const MOON: Rows = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    const a = (x - 8) ** 2 + (y - 8) ** 2;
    const b = (x - 11) ** 2 + (y - 6) ** 2;
    if (a > 36) return '.';
    if (b < 26) return '.';
    return a > 25 || b < 34 ? 'p' : 'j';
  }).join(''),
);

const CLOUD = [
  '................',
  '................',
  '................',
  '.....0000.......',
  '....0oooo0.00...',
  '..000oooooo0o0..',
  '.0oooooooooooo0.',
  '0ooooooooooooop0',
  '0poooooooooooop0',
  '.0pppppppppppp0.',
  '..000000000000..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const LAVA = (f: number): Rows => {
  const base = [
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkllkkkkkkkkkkk',
    'kkkkkkkkkkkllkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkllkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kllkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkllk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkllkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkklkkkk',
    'kkkllkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
  ].map((r, y) => rotate(r, (y & 1 ? 1 : -1) * f));
  const bubbles: [number, number][] = [
    [4, 5],
    [11, 11],
    [7, 13],
    [12, 3],
  ];
  const [bx, by] = bubbles[f] as [number, number];
  return stamp(base, ['.jj.', 'jllj', '.jj.'], bx - 1, by - 1);
};

/* ------------------------------------------------------------------------------------------ */
/* Actor frames                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** A pennant on a pole, its tip swinging with `w` (0-2). */
const flag = (w: number): Rows =>
  Array.from({ length: 16 }, (_, y) => {
    if (y === 0) return '.j..............';
    const len = [0, 10, 9, 8, 6, 4, 2][y];
    if (!len) return '.0..............';
    const wave = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0],
      [0, 1, 1, 0, -1, 0, 0],
    ][w]?.[y] as number;
    const cloth = 'i'.repeat(len + wave - 1) + 'r';
    return ('.0' + cloth).padEnd(16, '.');
  });

const twinkle = (size: number): Rows =>
  starTile(size, 3, 3)
    .slice(0, 8)
    .map((r) => r.slice(0, 8));

const puff = (r: number): Rows =>
  Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      const d = (x - 3.5) ** 2 + (y - 3.5) ** 2;
      if (d > r * r) return '.';
      return d > (r - 1.2) ** 2 ? 'p' : 'o';
    }).join(''),
  );

const BUBBLE = [
  '........',
  '..99....',
  '.9..9...',
  '.9..9...',
  '..99....',
  '........',
  '........',
  '........',
];

const SPLASH = [
  [
    '................',
    '...9......9.....',
    '..9.9....9.9....',
    '.9...9..9...9...',
    '......99........',
    '...8999999998...',
    '..888888888888..',
    '................',
  ],
  [
    '..9..........9..',
    '.9............9.',
    '9....9....9....9',
    '....9.9..9.9....',
    '................',
    '...8.99..99.8...',
    '..8..........8..',
    '................',
  ],
];

/* ------------------------------------------------------------------------------------------ */

const frames: Record<string, readonly string[]> = {
  ground: GROUND,
  tuft: TUFTS,
  'flowers-0': flowers(0),
  'flowers-1': flowers(1),
  sand: SAND,
  drift: SNOW_DRIFT,
  cliff: CLIFF,
  tree: TREE,
  palm: PALM,
  hill: HILL,
  'hill-snow': HILL_SNOW,
  mountain: MOUNTAIN,
  rock: ROCK,
  ridge: RIDGE,
  'ridge-snow': RIDGE_SNOW,
  'cap-left': capPart(0),
  'cap-mid': capPart(1),
  'cap-right': capPart(2),
  stem: STEM,
  wall: WALL,
  battlement: BATTLEMENT,
  gate: GATE,
  pipe: PIPE,
  blaster: BLASTER,
  moon: MOON,
  cloud: CLOUD,
  'flag-0': flag(0),
  'flag-1': flag(1),
  'flag-2': flag(2),
  'smoke-0': puff(1.6),
  'smoke-1': puff(2.6),
  'smoke-2': puff(3.6),
  bubble: BUBBLE,
  'splash-0': SPLASH[0] as Rows,
  'splash-1': SPLASH[1] as Rows,
};
for (let i = 0; i < 4; i++) {
  frames[`star-${i}`] = starTile([0, 1, 2, 1][i] as number, 7, 7);
  frames[`twinkle-${i}`] = twinkle([0, 1, 2, 1][i] as number);
  frames[`lava-${i}`] = LAVA(i);
}
for (let f = 0; f < WATER_FRAMES; f++) {
  frames[`water-${f}`] = water(f);
  for (const [kind, mask] of Object.entries(SHORES)) frames[`shore-${kind}-${f}`] = shore(mask, f);
  for (const kind of ['w', 'e', 'n', 's'] as const) frames[`landing-${kind}-${f}`] = landing(kind, f);
  frames[`surf-${f}`] = surf(f);
  frames[`cliff-sea-${f}`] = cliffSea(f);
  frames[`bridge-h-${f}`] = bridgeH(f);
  frames[`bridge-v-${f}`] = bridgeV(f);
  // Sky-tree parts stand in the sea of clouds, so the sea shows around them.
  frames[`treetop-left-${f}`] = stamp(water(f), TREETOP_LEFT);
  frames[`treetop-mid-${f}`] = stamp(water(f), TREETOP_MID);
  frames[`treetop-right-${f}`] = stamp(water(f), TREETOP_RIGHT);
  frames[`trunk-${f}`] = stamp(water(f), TRUNK);
  for (let i = 0; i < POND_W * POND_H; i++) frames[`pond-${i}-${f}`] = shore(pondMask(i), f);
}

export const mapDef: SpriteDef = { palette: 'map-grass', frames };
