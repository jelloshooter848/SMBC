import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * World map art (original): 16×16 terrain tiles and small decorative actor frames for the eight
 * themed world map pages (World 2's Hyrule since 0.4.24), the Warp Zone hub and the Mini Game
 * Arena. One frame set recolours into every theme through the `map-<theme>` palettes, which all
 * share these roles:
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

/** The Warp Zone's deep indigo between worlds: its void, and the page's sky colour behind it. */
export const WARP_SPACE = '#1c0858';
/* Two NES violets (2C02 $03 and $12) the curated NES table doesn't name. */
const INDIGO = '#4428bc';
const VIOLET = '#6844fc';
const lava: [string, string] = [NES.lava, NES.lavaLight];
/** The Mini Game Arena's night sky (and the page's sky colour). */
export const ARENA_NIGHT = '#081848';
/* The pitch's light green squares: NES 2C02 $2A, which the curated NES table doesn't name. */
const PITCH_LIGHT = '#58d854';
/* Hyrule's field and forest greens: NES 2C02 $2A and $1A, which the curated NES table doesn't name. */
const HYRULE_FIELD = '#58d854';
const HYRULE_FOREST = '#007800';

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
  /*
   * The Warp Zone, the space between worlds: violet platforms floating in a starry indigo void
   * (the "water", the same colour as the sky, with a pink glow along every rim), walkways of pale
   * light (sand), bridges of light (wood) and pink crystals (accent).
   */
  'map-warp': theme({
    ground: [INDIGO, VIOLET, NES.purple],
    sand: [NES.skyLight, NES.lavender],
    water: [WARP_SPACE, WARP_SPACE, INDIGO, NES.pink],
    rock: [NES.black, INDIGO, VIOLET],
    leaf: [NES.black, NES.magenta, NES.pink],
    wood: [NES.skyLight, NES.blueLight],
    accent: [NES.pink, NES.yellowLight, NES.magenta],
    lava,
    wall: stone,
    white: [NES.white, NES.lavender],
  }),
  /*
   * The Mini Game Arena, a stadium at night: a checkered pitch in two greens (ground), grey
   * concrete stands and steel light towers (rock), fans (wood: skin and hair) in red, yellow,
   * cyan, blue and white shirts (accent, leaf, wall, white), blue ad boards (wall). There is no
   * sea on this page; "water" is the night sky's colour in case one is ever drawn.
   */
  'map-arena': theme({
    ground: [NES.greenDark, NES.green, PITCH_LIGHT],
    sand: [NES.tan, NES.tanDark],
    water: [ARENA_NIGHT, ARENA_NIGHT, NES.blueDark, NES.lavender],
    rock: [NES.darkGray, NES.gray, NES.lightGray],
    leaf: [NES.teal, NES.cyan, NES.skyLight],
    wood: [NES.peach, NES.brownDark],
    accent: [NES.redBright, NES.yellow, NES.redDark],
    lava,
    wall: [NES.blueMid, NES.blueLight, NES.blueDark],
    white: [NES.white, NES.lightGray],
  }),
  /*
   * Hyrule (World 2 since 0.4.24, Link's world): a Zelda II overworld of light field grass, dark
   * forests (leaf), brown mountains and boulders (rock), sand roads, a blue lake and sea, palace,
   * ruins and graves of grey stone (wall), red and yellow accents for its flowers, fairies and
   * blobs.
   */
  'map-hyrule': theme({
    ground: [NES.green, HYRULE_FIELD, NES.greenLight],
    sand: [NES.tan, NES.tanDark],
    water: [NES.blueDark, NES.blueMid, NES.blueLight, NES.white],
    rock: [NES.brownDark, NES.orangeBrown, NES.brownLight],
    leaf: [NES.greenDark, HYRULE_FOREST, NES.green],
    wood: [NES.brownLight, NES.orangeBrown],
    accent: [NES.redBright, NES.yellowLight, NES.redDark],
    lava,
    wall: stone,
    white: [NES.white, NES.skyLight],
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

/** A cluster of glowing crystals: a tall spire between two shards (the Warp Zone's scenery). */
const CRYSTAL = stamp(GROUND, [
  '.......00.......',
  '......0oi0......',
  '.....0oiir0.....',
  '.....0oiir0.....',
  '.....0oiir0.....',
  '..00.0oiir0.....',
  '.0oi00oiir0.....',
  '.0oir0oiir0.00..',
  '.0oir0oiir00oi0.',
  '.0oir0oiir0oir0.',
  '.0oir0oiir0oir0.',
  '.0oir0oiir0oir0.',
  '..000000000000..',
  '.11111111111111.',
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
/* The Mini Game Arena (0.4.7): a stadium at night                                             */
/* ------------------------------------------------------------------------------------------ */

/*
 * The arena page's own tiles. In the `map-arena` palette the ground roles are the pitch's two
 * greens, rock is the stands' concrete and the light towers' steel, wood is the fans' skin and
 * hair, and accent, leaf, wall and white are the shirts, banners, pennants and ad boards.
 */

/** The pitch: a checkerboard of 8-px squares (ground main and light), a speck or two in each. */
const ARENA_FLOOR: Rows = (() => {
  const a = ['22222222', '22222222', '22232222', '22222222', '22222222', '22222322', '22222222', '22222222'];
  const b = ['33333333', '33333333', '33333333', '33323333', '33333333', '33333333', '32333333', '33333333'];
  return [...a.map((r, y) => r + (b[y] as string)), ...b.map((r, y) => r + (a[y] as string))];
})();

/**
 * One 8-px tier of the stands: four seated fans 4 px apart (hair, face, a shirt in one of
 * `shirts`), the step's lit edge and face below. `offset` staggers the tier (wrapping, so the
 * tile repeats seamlessly); the fans listed in `cheer` have both hands up.
 */
function crowdTier(shirts: string, offset: number, cheer: readonly number[]): Rows {
  const rows = ['a', 'a', 'a', 'a', 'a', 'c', 'b', 'a'].map((c) => Array.from({ length: 16 }, () => c));
  for (let k = 0; k < 4; k++) {
    const x0 = offset + k * 4;
    const s = shirts[k] as string;
    const put = (dx: number, y: number, c: string) => {
      (rows[y] as string[])[(x0 + dx) % 16] = c;
    };
    put(1, 0, 'h');
    put(2, 0, 'h');
    put(1, 1, 'g');
    put(2, 1, 'g');
    for (let y = 2; y < 5; y++) for (let dx = 0; dx < 4; dx++) put(dx, y, s);
    if (cheer.includes(k)) {
      put(0, 0, 'g');
      put(3, 0, 'g');
      put(0, 1, s);
      put(3, 1, s);
    }
  }
  return rows.map((r) => r.join(''));
}

/** The crowd's animation frames; in each a few fans (per tier: back row, front row) cheer. */
export const ARENA_CROWD_FRAMES = 4;
type Cheer = readonly [back: readonly number[], front: readonly number[]];
const CROWD: Record<'a' | 'b', { shirts: readonly [string, string]; cheer: readonly Cheer[] }> = {
  a: {
    shirts: ['iejo', 'mjie'],
    cheer: [
      [[1], [2]],
      [[3], []],
      [[0], [3]],
      [[], [0, 1]],
    ],
  },
  b: {
    shirts: ['joim', 'eomi'],
    cheer: [
      [[], [1]],
      [[2], [3]],
      [[0, 3], []],
      [[1], [2]],
    ],
  },
};
const crowd = (v: 'a' | 'b', f: number): Rows => {
  const { shirts, cheer } = CROWD[v];
  const [back, front] = cheer[f % ARENA_CROWD_FRAMES] as Cheer;
  return [...crowdTier(shirts[0], 0, back), ...crowdTier(shirts[1], 2, front)];
};

/** A team banner (12×15) hung over the stands from a rod; its tails swing with `sway` (0 or 1). */
const banner = (sway: number): Rows =>
  [
    '0cccccccccc0',
    '.0iiiiiiir0.',
    '.0iiijiiir0.',
    '.0iijjjiir0.',
    '.0ijjjjjjr0.',
    '.0iijjjiir0.',
    '.0ijjijjir0.',
    '.0iiiiiiir0.',
    '.0ooooooor0.',
    '.0iiiiiiir0.',
    '.0iiiiiiir0.',
    '.0iiir0iir0.',
    '.0iir0.0ir0.',
    '.0ir0...0r0.',
    '.000.....00.',
  ].map((r, y) => (y >= 9 && sway ? '.' + r.slice(0, -1) : r));

/** The barrier between the stands and the pitch: a rail, red and blue ad boards, its shadow. */
const ARENA_WALL = stamp(ARENA_FLOOR, [
  '0000000000000000',
  'nnnnnnnnnnnnnnnn',
  'qqqqqqqqqqqqqqqq',
  '0rrrrrrr0qqqqqqq',
  '0iooiooi0mmmjmmm',
  '0ioiioii0mmjjjmm',
  '0iooiooi0mmmjmmm',
  '0rrrrrrr0qqqqqqq',
  '0000000000000000',
  '1111111111111111',
  '1.1.1.1.1.1.1.1.',
]);

/** Bunting: a sagging line of pennants on transparent sky; each tip swings with `w` (0-2). */
const bunting = (w: number): Rows => {
  const rows = fill('.').map((r) => r.split(''));
  const ropeY = (x: number) => 3 + Math.round(2 * Math.sin((Math.PI * x) / 16));
  for (let x = 0; x < 16; x++) (rows[ropeY(x)] as string[])[x] = 'c';
  const colours = 'ijeo';
  for (let k = 0; k < 4; k++) {
    const x0 = k * 4;
    const tip = [0, 1, -1][(w + k) % 3] as number;
    const cells: [number, number][] = [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [1 + Math.min(0, tip), 3],
      [1 + Math.max(0, tip), 3],
      [1 + tip, 4],
    ];
    const top = ropeY(x0 + 1);
    for (const [dx, dy] of cells) (rows[top + dy] as string[])[x0 + dx] = colours[k] as string;
  }
  return rows.map((r) => r.join(''));
};

/**
 * A light tower, 16×48: a bank of six lamps on a lattice mast that widens to its foot;
 * `glint` puts a small sparkle over the top lamps.
 */
const lightTower = (glint: boolean): Rows => {
  const head = [
    glint ? '........j.......' : '................',
    glint ? '.......jojj.....' : '................',
    '.0000000000000..',
    '.0ooj0ooj0ooj0..',
    '.0ojj0ojj0ojj0..',
    '.0aaaaaaaaaaa0..',
    '.0ooj0ooj0ooj0..',
    '.0ojj0ojj0ojj0..',
    '.0000000000000..',
    '......0b0.......',
  ];
  const mast = Array.from({ length: 38 }, (_, i) => {
    const half = 1 + Math.floor(i / 13);
    const row = Array.from({ length: 16 }, () => '.');
    const [l, r] = [7 - half, 7 + half];
    for (let x = l; x <= r; x++) row[x] = i === 37 ? 'a' : (x + i) % 4 === 0 || (x - i) % 4 === 0 ? 'c' : '.';
    if (i < 37) row[l] = row[r] = 'b';
    return row.join('');
  });
  return [...head, ...mast];
};

/** The scoreboard's tiny font (3-4 px wide, 5 tall). */
const BOARD_GLYPHS: Record<string, Rows> = {
  A: ['.o.', 'o.o', 'ooo', 'o.o', 'o.o'],
  R: ['oo.', 'o.o', 'oo.', 'o.o', 'o.o'],
  E: ['ooo', 'o..', 'oo.', 'o..', 'ooo'],
  N: ['o..o', 'oo.o', 'o.oo', 'o..o', 'o..o'],
  '0': ['ooo', 'o.o', 'o.o', 'o.o', 'ooo'],
  V: ['o.o', 'o.o', 'o.o', 'o.o', '.o.'],
  S: ['ooo', 'o..', 'ooo', '..o', 'ooo'],
  ' ': ['...', '...', '...', '...', '...'],
};
/** `text` in the board font, glyphs 1 px apart, each glyph in its colour from `colours`. */
const boardText = (text: string, colours: string): Rows =>
  Array.from({ length: 5 }, (_, y) =>
    text
      .split('')
      .map((ch, i) => ((BOARD_GLYPHS[ch] as Rows)[y] as string).replace(/o/g, colours[i] as string))
      .join('.'),
  );

/**
 * The big scoreboard, 48×32: ARENA over a 00 VS 00 score on a black screen, framed by marquee
 * bulbs that trade colours with `phase` (0 or 1), standing on two legs.
 */
const scoreboard = (phase: number): Rows => {
  const W = 48;
  const rows = Array.from({ length: 32 }, () => Array.from({ length: W }, () => '.'));
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < W; x++) {
      const edge = y === 0 || y === 23 || x === 0 || x === W - 1;
      const frame = y <= 2 || y >= 21 || x <= 2 || x >= W - 3;
      (rows[y] as string[])[x] = edge ? '0' : frame ? 'b' : '0';
    }
  // Bulbs every 3 px along the middle of the frame, alternating yellow and red.
  const bulbs: [number, number][] = [];
  for (let x = 1; x < W - 1; x += 3) bulbs.push([x, 1], [W - 1 - x, 22]);
  for (let y = 4; y < 21; y += 3) bulbs.push([1, 24 - y], [W - 2, y]);
  bulbs.forEach(([x, y], k) => ((rows[y] as string[])[x] = (k + phase) % 2 ? 'i' : 'j'));
  const put = (text: Rows, dy: number) => {
    const dx = Math.floor((W - (text[0] as string).length) / 2);
    text.forEach((r, y) => {
      for (let x = 0; x < r.length; x++)
        if (r[x] !== '.') (rows[dy + y] as string[])[dx + x] = r[x] as string;
    });
  };
  put(boardText('ARENA', 'jjjjj'), 5);
  put(boardText('00 VS 00', 'ii.oo.ii'), 13);
  for (const lx of [10, 34])
    for (let y = 24; y < 32; y++) {
      const row = rows[y] as string[];
      row[lx] = row[lx + 3] = '0';
      row[lx + 1] = 'c';
      row[lx + 2] = 'b';
    }
  return rows.map((r) => r.join(''));
};

/* ------------------------------------------------------------------------------------------ */
/* Hyrule (World 2, 0.4.24): forest, a palace, ruins, graves and the critters                  */
/* ------------------------------------------------------------------------------------------ */

/**
 * A dense forest: round crowns packed on a 16x16 torus (so a block of it tiles both ways), each
 * lit up-left, dark between them.
 */
const FOREST: Rows = (() => {
  const crowns: [number, number][] = [
    [4, 4],
    [12, 3],
    [8, 10],
    [0, 11],
    [16, 11],
    [4, 16],
    [12, 15],
  ];
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      let best: [number, number] | null = null;
      for (const [cx, cy] of crowns)
        for (const oy of [-16, 0, 16])
          for (const ox of [-16, 0, 16]) {
            const dx = x - cx - ox;
            const dy = y - cy - oy;
            if (dx * dx + dy * dy <= 17 && (!best || cy + oy > best[1])) best = [cx + ox, cy + oy];
          }
      if (!best) return '0';
      const dx = x - best[0];
      const dy = y - best[1];
      const d = dx * dx + dy * dy;
      if (d > 12) return 'd';
      if (dx + dy < -2) return 'f';
      return 'e';
    }).join(''),
  );
})();

/** The palace (three tiles wide, two tall): a stepped stone pediment over six columns and a door. */
const PALACE_W = 48;
const PALACE: Rows = Array.from({ length: 32 }, (_, y) =>
  Array.from({ length: PALACE_W }, (_, x) => {
    const c = PALACE_W / 2 - 0.5;
    const dx = Math.abs(x - c);
    if (y < 12) {
      // the pediment: steps 4 px wide, 2 px tall, up to the apex at y 2, a gold crest on top
      const half = 23.5 - Math.floor((11 - y) / 2) * 4;
      if (y < 2) return dx < 1 ? 'j' : '.';
      if (dx > half) return '.';
      if (dx > half - 1 || y === 11 || (y % 2 === 1 && dx > half - 4)) return '0';
      if (dx < 3 && y > 5 && y < 9) return y === 6 || y === 8 ? 'q' : 'j'; // the crest's emblem
      return x < c ? 'n' : 'm';
    }
    if (y < 15) return y === 12 ? 'n' : y === 14 ? '0' : 'q'; // the entablature
    if (y >= 29) return y === 29 ? 'n' : y === 31 ? '0' : 'm'; // the steps
    // the door: an arch in the middle
    if (dx < 5 && (y > 20 || Math.hypot(dx, y - 21) < 5)) return dx > 4 || y === 16 ? 'q' : '0';
    // the columns: 4 px wide every 8 px, shadowed between
    const col = (x + 2) % 8;
    if (col < 4) return col === 0 ? 'n' : col === 3 ? 'q' : 'm';
    return 'q';
  }).join(''),
);
const palacePart = (i: number, row: 0 | 1): Rows =>
  PALACE.slice(row * 16, row * 16 + 16).map((r) => r.slice(i * 16, i * 16 + 16));

/** Stone ruins on the field: a broken column, a toppled drum and a standing stump. */
const RUINS = stamp(GROUND, [
  '................',
  '...000..........',
  '..0nm00.........',
  '..0nmq0.........',
  '..0nmq0....000..',
  '..0nmq0...0nmq0.',
  '..0nmq0...0nmq0.',
  '..0nmq0...0nmq0.',
  '..0nmq0...0nmq0.',
  '.0nnmmq0..0nmq0.',
  '.00000000.00000.',
  '.....0000000....',
  '....0nnmmmmq0...',
  '....0qqqqqqq0...',
  '.....0000000....',
  '................',
]);

/** Graves: a stone cross and a round headstone, a mound before each. */
const GRAVES = stamp(GROUND, [
  '................',
  '....00..........',
  '....0n0.........',
  '..000n000.......',
  '..0nnnmq0..000..',
  '..000mq00.0nnm0.',
  '....0m0..0nmmmq0',
  '....0m0..0nq0mq0',
  '....0m0..0nmmmq0',
  '....0q0..0nmmmq0',
  '...00000.0nmmmq0',
  '..01111100000000',
  '..01111101111110',
  '...00000.000000.',
  '................',
  '................',
]);

/** A red blob resting (squat) and mid-hop (tall), a white shine, two dark eyes. */
const BLOB = [
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......0000......',
    '....00iiii00....',
    '...0ioiiiiii0...',
    '..0iooiiiiiir0..',
    '..0iiii0ii0ir0..',
    '.0iiiii0ii0irr0.',
    '.0riiiiiiiirrr0.',
    '..000000000000..',
    '................',
  ],
  [
    '................',
    '................',
    '.......00.......',
    '......0ii0......',
    '.....0ioii0.....',
    '.....0ooii0.....',
    '....0iiiiir0....',
    '....0i0ii0r0....',
    '....0i0ii0r0....',
    '....0iiiiir0....',
    '....0iiiirr0....',
    '....0riirrr0....',
    '.....0rrrr0.....',
    '......0000......',
    '................',
    '................',
  ],
];

/** A fairy: a tiny bright body between two pale wings, up and down. */
const FAIRY = [
  [
    '..pp........pp..',
    '.p88p......p88p.',
    '.p888p....p888p.',
    '..p888p..p888p..',
    '...p88pjjp88p...',
    '....ppjoojpp....',
    '......joij......',
    '......jooj......',
    '.......ii.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '......jjjj......',
    '...ppjoojjpp....',
    '.pp888joij888pp.',
    'p8888pjoojp8888p',
    '.pppp..ii..pppp.',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
];

/** A river creature surfacing: its finned head peeking out, then head and shoulders. */
const ZORA = [
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......0i0......',
    '......0iir0.....',
    '.....00ddd00....',
    '....0deeeeed0...',
    '...0deo0eo0ed0..',
    '...888888888888.',
    '..8.9..9..9..8..',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '.......0i0......',
    '......0iir0.....',
    '.....00ddd00....',
    '....0deeeeed0...',
    '...0deo0eo0ed0..',
    '...0deeeeeeed0..',
    '..0i0deeeeed0i0.',
    '..0ir0dfffd0ri0.',
    '...00deffffed00.',
    '....0deeeeeed0..',
    '...888888888888.',
    '..8.9..9..9..8..',
    '................',
  ],
];

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

/** A comet heading right, its sparkling tail flickering between two frames. */
const COMET = [
  [
    '................',
    '..........pjj...',
    '.....p.ppjjooj..',
    '..p.pppjjjoooo..',
    '.....p.ppjjooj..',
    '..........pjj...',
    '................',
    '................',
  ],
  [
    '................',
    '...........jj...',
    '...p..pppjjooj..',
    '.p..ippjjjoooo..',
    '......pppjjooj..',
    '...........jj...',
    '................',
    '................',
  ],
];

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
  crystal: CRYSTAL,
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
  'comet-0': COMET[0] as Rows,
  'comet-1': COMET[1] as Rows,
  'arena-floor': ARENA_FLOOR,
  'arena-wall': ARENA_WALL,
  'arena-tower-0': lightTower(false),
  'arena-tower-1': lightTower(true),
  'arena-scoreboard-0': scoreboard(0),
  'arena-scoreboard-1': scoreboard(1),
  // Hyrule (World 2): forest, the palace (roof row, then columns and door), ruins, graves and the
  // critters (blob, fairy, river creature).
  forest: FOREST,
  'palace-roof-left': palacePart(0, 0),
  'palace-roof-mid': palacePart(1, 0),
  'palace-roof-right': palacePart(2, 0),
  'palace-left': palacePart(0, 1),
  'palace-door': palacePart(1, 1),
  'palace-right': palacePart(2, 1),
  ruins: RUINS,
  graves: GRAVES,
  'blob-0': BLOB[0] as Rows,
  'blob-1': BLOB[1] as Rows,
  'fairy-0': FAIRY[0] as Rows,
  'fairy-1': FAIRY[1] as Rows,
  'zora-0': ZORA[0] as Rows,
  'zora-1': ZORA[1] as Rows,
};
for (let f = 0; f < ARENA_CROWD_FRAMES; f++) {
  frames[`arena-crowd-a-${f}`] = crowd('a', f);
  frames[`arena-crowd-b-${f}`] = crowd('b', f);
  // The banner hangs over the stands, the crowd cheering on around it.
  frames[`arena-banner-${f}`] = stamp(crowd('b', f), banner(f >> 1), 2, 0);
}
for (let w = 0; w < 3; w++) frames[`arena-bunting-${w}`] = bunting(w);
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
