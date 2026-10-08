import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';
import { stoneBlock } from './castlevania-look';

/**
 * World 5 as Simon's world, Transylvania (0.4.28, campaign only): the Castlevania-style looks of
 * World 5's levels before 5-4 (5-4 keeps its 0.4.12 castle hall, castlevania-look.ts, and Simon's
 * dungeon and crypt their `crypt`). Original art in the spirit of the NES vampire-hunting games,
 * nothing traced. Every tile frame keeps its tile's collision shape (solid tiles fill their
 * 16x16), and `?` blocks, coins, the flagpole, pipes and lava stay SMB's own so they read at a
 * glance; the Bullet Bill blasters are black iron with their pale skull badge, light enough to
 * read on the night.
 *
 * - `cv-gate` (5-1): the castle's courtyard gate. Worn flagstones, grey castle bricks, carved
 *   stone blocks under a starry night; a crenellated courtyard wall with barred gates and
 *   Dracula's castle far off are painted behind (world/theme-backdrop.ts). Its trees are stone
 *   statues and torch braziers.
 * - `cv-catacomb` (5-1-bonus): the catacombs, the underground still. Dark earth stone and an
 *   ossuary's skull bricks.
 * - `cv-town` (5-2): a Simon's Quest-style town street at night. Cobbles, red house brick, grey
 *   stone; rooftops, chimneys and a church spire with lit windows are painted behind. Its trees
 *   are street lamps and shop signs.
 * - `cv-storm` (5-2-sky): the coin heaven over the town, a stormy night over the castle: the
 *   town's blocks (it shares the town's palette), heavy storm clouds to stand on, the castle far
 *   off and lightning painted behind (never with reduce flashing).
 * - `cv-lake` (5-2-water): the underground lake under the town's sewers. Mossy stones, iron
 *   grates and murky green water. It is no water theme (no restyle is one): 5-2-water swims by
 *   its map's `swim: true`, and World fills the deep from the waves down in the waves' green
 *   (FLOODED in world/tile-render.ts, the palette's slot 9).
 * - `cv-clock` (5-3): the clock tower. Its treetops are wooden beams on the tower's timber
 *   scaffolds, its floor oak planks, its hard blocks brass-bound crates; a clock face and gears
 *   are painted behind.
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 green, 8 white, 9/a the look's own pair (iron greys, bone, murky water, brass), b SMB's
 * lava red.
 */

const IRON_GREY = '#5c5c70';
const IRON_LIGHT = '#a0a0b4';

export const cvGateTilePalette: string[] = [
  NES.black,
  '#3c2c24',
  '#7c6450',
  '#b89c80',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  IRON_GREY,
  IRON_LIGHT,
  NES.lava,
];

export const cvCatacombTilePalette: string[] = [
  NES.black,
  '#24180c',
  '#5c4430',
  '#94785c',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#a89c80',
  '#e4dcc0',
  NES.lava,
];

export const cvTownTilePalette: string[] = [
  NES.black,
  '#4c1c10',
  '#94402c',
  '#d0805c',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  IRON_GREY,
  IRON_LIGHT,
  NES.lava,
];

/** The underground lake's murky green: the waves' body (slot 9) and the water World floods 5-2-water with. */
export const CV_LAKE_WATER = '#1c4c28';

export const cvLakeTilePalette: string[] = [
  NES.black,
  '#1c2420',
  '#44544c',
  '#7c9084',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  CV_LAKE_WATER,
  '#4c8c58',
  NES.lava,
];

export const cvClockTilePalette: string[] = [
  NES.black,
  '#301c0c',
  '#704824',
  '#b07c40',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#806018',
  '#d8b048',
  NES.lava,
];

/* ---------- shared shapes ---------- */

/** Courses of bricks `bw` x 8, offset by half a brick each course: lit top, shaded bottom row. */
const courses = (bw: number, lit: string, main: string, dark: string, seed: number): string[] =>
  draw(16, 16, (x, y) => {
    const course = y >> 3;
    const bx = (x + (course % 2 ? bw >> 1 : 0)) % bw;
    if (y % 8 === 7 || bx === bw - 1) return '0';
    if (y % 8 === 0) return lit;
    if (y % 8 === 6) return dark;
    return hash(x, y, seed) < 0.08 ? dark : main;
  });

/** A spent block: the stone gone dark, four studs where the `?` was. */
const spent = (seed: number, stud: string): string[] =>
  stoneBlock('2', '1', '0', seed).map((r, y) =>
    y === 3 || y === 11 ? `${r.slice(0, 3)}${stud}${r.slice(4, 11)}${stud}${r.slice(12)}` : r,
  );

/** Bullet Bill blasters in black iron (SMB's shape, its pale skull badge kept). */
const IRON = { '1': '0', '2': '9', '3': 'a' };
const blasters = (base: Record<string, Rows>): Record<string, Rows> => ({
  'blaster-top': recolour(base['blaster-top'] as Rows, IRON),
  'blaster-base': recolour(base['blaster-base'] as Rows, IRON),
});

/* ---------- 5-1: the courtyard gate (`cv-gate`) ---------- */

/** Worn flagstones: two courses of broad slabs, lit along their tops, a few chips. */
const flagstones = draw(16, 16, (x, y) => {
  const course = y >> 3;
  const ly = y & 7;
  const seam = course ? 4 : 11;
  if (ly === 7 || x === seam) return '0';
  if (ly === 0 || x === (seam + 1) % 16) return '3';
  if (ly === 6 || x === (seam + 15) % 16) return '1';
  return hash(x, y, 71) < 0.1 ? '1' : '2';
});

export function cvGateTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: flagstones,
      'castle-brick': flagstones,
      brick: courses(8, '3', '2', '1', 73),
      hard: stoneBlock('3', '2', '1', 75),
      used: spent(77, 'a'),
      ...blasters(base),
    },
    'cv-gate',
  );
}

/* ---------- 5-1-bonus: the catacombs (`cv-catacomb`) ---------- */

/** Rough earth stone: lumps lit up-left on the dark, a few black cracks. */
const earthStone = draw(16, 16, (x, y) => {
  if (hash(x, y, 81) < 0.05) return '0';
  const n = hash(x >> 2, y >> 2, 82) + hash(x >> 1, y >> 1, 83) * 0.5;
  if (n > 1.05) return '3';
  if (n > 0.55) return '2';
  return '1';
});

/** An ossuary brick: a skull set in its niche of dark stone, bone white. */
const skullBrick = [
  '0000000000000000',
  '0111111111111110',
  '011100000000.110',
  '0110aaaaaaaa0110',
  '010aaaaaaaaaa010',
  '010aa99aa99aa010',
  '010a9009a9009a00',
  '010a9009a9009a00',
  '010aaaa99aaaaa00',
  '0110aaa00aaa0110',
  '01110aaaaaa01110',
  '011110a9a9011110',
  '0111110aaa011110',
  '0111111000111110',
  '0111111111111110',
  '0000000000000000',
].map((r) => r.replace('.', '0'));

export function cvCatacombTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: earthStone,
      'castle-brick': earthStone,
      brick: skullBrick,
      hard: stoneBlock('3', '2', '1', 85),
      used: spent(87, '9'),
    },
    'cv-catacomb',
  );
}

/* ---------- 5-2: the town (`cv-town`) and its stormy coin heaven (`cv-storm`) ---------- */

/** Cobbles: rounded stones in two offset rows, black between, lit up-left. */
const cobbles = draw(16, 16, (x, y) => {
  for (const [cx, cy] of [
    [3.5, 3.5],
    [11.5, 3.5],
    [7.5, 11.5],
    [15.5, 11.5],
    [-0.5, 11.5],
  ] as const) {
    const dx = (x - cx) / 3.9;
    const dy = (y - cy) / 3.6;
    const d = dx * dx + dy * dy;
    if (d > 1) continue;
    if (d > 0.55 && dx + dy < 0) return '3';
    if (d > 0.55 && dx + dy > 0.4) return '1';
    return hash(x, y, 91) < 0.1 ? '1' : '2';
  }
  return '0';
});

/** Town stone (the hard blocks): grey cut stone. */
const townStone = stoneBlock('a', '9', '0', 93);

/** Storm clouds to stand on: SMB's cloud block heavy and grey, dark underneath, black-rimmed. */
const stormCloud = (base: Rows): string[] =>
  recolour(base, { '8': 'a', a: '0' }).map((r, y) => (y >= 10 ? r.replace(/a/g, '9') : r));

const townFrames = (): Record<string, Rows> => ({
  ground: cobbles,
  'castle-brick': courses(8, '3', '2', '1', 95),
  brick: courses(8, '3', '2', '1', 95),
  hard: townStone,
  used: spent(97, 'a'),
});

export function cvTownTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed({ ...townFrames(), ...blasters(base) }, 'cv-town');
}

export function cvStormTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    { ...townFrames(), ...blasters(base), 'cloud-block': stormCloud(base['cloud-block'] as Rows) },
    'cv-storm',
  );
}

/* ---------- 5-2-water: the underground lake (`cv-lake`) ---------- */

/** Mossy stones: dressed courses, moss (slot a) creeping over their tops. */
const mossStone = courses(16, '3', '2', '1', 101).map((r, y) =>
  [...r].map((c, x) => (y % 8 < 2 && c !== '0' && hash(x, y, 103) < 0.45 ? 'a' : c)).join(''),
);

/** A stone block with a sewer's iron grate set in it. */
const grateBlock = stoneBlock('3', '2', '1', 105).map((r, y) =>
  [...r]
    .map((c, x) => {
      if (x < 3 || x > 12 || y < 3 || y > 12) return c;
      if (x === 3 || x === 12 || y === 3 || y === 12) return '0';
      return x % 3 === 1 ? '3' : '0';
    })
    .join(''),
);

/** The lake's surface: a thin pale crest over the murky green, breaking in two places. */
const murkyWaves = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const u = (x + shift) % 16;
    const crest = u === 2 || u === 3 || u === 10 || u === 11;
    if (y === 0) return crest ? 'a' : '.';
    if (y === 1) return crest ? '9' : u === 1 || u === 4 || u === 9 || u === 12 ? 'a' : '.';
    if (y === 2) return 'a';
    if (y === 3) return (u + 1) % 4 === 0 ? 'a' : '9';
    return hash((x + shift) % 16, y, 107) < 0.03 ? 'a' : '9';
  });

export function cvLakeTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: mossStone,
      'castle-brick': mossStone,
      brick: courses(8, '3', '2', '1', 109),
      hard: grateBlock,
      used: spent(111, '3'),
      'water-0': murkyWaves(0),
      'water-1': murkyWaves(4),
    },
    'cv-lake',
  );
}

/* ---------- 5-3: the clock tower (`cv-clock`) ---------- */

/** Oak planks: two boards a tile, lit along their tops, dark grain, a black seam. */
const planks = draw(16, 16, (x, y) => {
  const ly = y & 7;
  const joint = y >> 3 ? 5 : 12;
  if (ly === 7 || x === joint) return '0';
  if (ly === 0) return '3';
  if (ly === 6) return '1';
  return hash(x >> 2, y, 121) < 0.25 ? '1' : '2';
});

/** A brass-bound crate (the hard blocks): oak boards, brass corners and bands. */
const crate = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return 'a';
  if (x === 14 || y === 14) return '9';
  if ((x < 3 || x > 11) && (y < 3 || y > 11)) return (x + y) % 2 ? 'a' : '9';
  if (x === y || x === 14 - y) return '1';
  return y % 4 === 3 ? '1' : '2';
});

/** A wooden beam (the treetops): a squared oak beam, lit along its top, iron bolts, solid all through. */
const beam = draw(16, 16, (x, y) => {
  if (y === 15) return '0';
  if (y === 0) return '0';
  if (y === 1) return '3';
  if (y === 14) return '1';
  if ((x === 3 || x === 12) && (y === 4 || y === 10)) return 'a';
  if ((x === 3 || x === 12) && (y === 5 || y === 11)) return '9';
  if (y === 7) return '1';
  return hash(x >> 1, y, 123) < 0.15 ? '1' : '2';
});

/** The tower's timber scaffold under the beams (scenery): an upright post braced with crossed struts. */
const scaffold = draw(16, 16, (x, y) => {
  if (x >= 5 && x <= 10)
    return x === 5 ? '3' : x === 10 ? '0' : y % 8 === 3 && x === 7 ? 'a' : x === 9 ? '1' : '2';
  const d = Math.abs(x - 7.5) - Math.abs(y - 7.5);
  if (Math.abs(d) < 1) return '1';
  return '.';
});

export function cvClockTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: planks,
      'castle-brick': planks,
      brick: courses(8, '3', '2', '1', 125),
      hard: crate,
      used: spent(127, 'a'),
      'tree-top': beam,
      'tree-trunk': scaffold,
    },
    'cv-clock',
  );
}

/* ---------- decor ---------- */

/*
 * Decor palettes keep decor.ts's roles: 1-3 the backdrops' dim shades (dark, main, lit), 4-5 the
 * clouds (dim night clouds), 6-8 castle stone (the end castle, the statues, lamp posts; 8 also
 * the moon), 9-a fire and lamplight (red, yellow; in the storm the lightning).
 */

const NIGHT_CLOUD = '#2c2c44';
const NIGHT_CLOUD_EDGE = '#1c1c30';
const STONE: [string, string, string] = ['#3c3c4c', '#6c6c7c', '#b0acb8'];
const FIRE: [string, string] = ['#c83010', '#fcbc3c'];

export const cvGateDecorPalette: string[] = [
  NES.black,
  '#141026',
  '#221c3a',
  '#342c52',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const cvCatacombDecorPalette: string[] = [
  NES.black,
  '#140c08',
  '#241810',
  '#3c2c1c',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const cvTownDecorPalette: string[] = [
  NES.black,
  '#140c1c',
  '#22142c',
  '#362442',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const cvStormDecorPalette: string[] = [
  NES.black,
  '#0c0c18',
  '#181828',
  '#262638',
  '#3c4058',
  '#24283c',
  ...STONE,
  '#8888d8',
  '#e8e8ff',
];

export const cvLakeDecorPalette: string[] = [
  NES.black,
  '#0c140c',
  '#142418',
  '#203424',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const cvClockDecorPalette: string[] = [
  NES.black,
  '#100c10',
  '#1c1418',
  '#2c2024',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  '#584010',
  '#806020',
];

/** The moon (32x32): a pale disc, its seas a shade darker. */
const moon = draw(32, 32, (x, y) => {
  const d = Math.hypot(x - 15.5, y - 15.5);
  if (d > 13) return '.';
  for (const [cx, cy, r] of [
    [11, 12, 3.5],
    [19, 18, 4.5],
    [12, 21, 2],
  ] as const)
    if (Math.hypot(x - cx, y - cy) < r) return '7';
  return '8';
});

/**
 * Dracula's castle far off (128x64): a silhouette of towers with pointed roofs over the crag,
 * lit along their left edges, a few windows burning.
 */
const farCastle = (w: number, h: number, seed: number): string[] => {
  const towers: [number, number, number][] = [];
  for (let cx = 6; cx < w - 4; cx += 10 + Math.floor(hash(cx, 0, seed) * 8)) {
    const top = Math.floor(4 + hash(cx, 1, seed) * (h * 0.5));
    towers.push([cx, top, 3 + Math.floor(hash(cx, 2, seed) * 3)]);
  }
  return draw(w, h, (x, y) => {
    // the crag
    const crag = h - 8 - Math.abs(Math.sin(x / 9)) * 5;
    if (y >= crag) return x % 7 === 0 && y > crag + 1 ? '1' : '2';
    // the curtain wall
    if (y >= h * 0.6) return y === Math.ceil(h * 0.6) && x % 4 < 2 ? '.' : '2';
    for (const [cx, top, half] of towers) {
      const dx = x - cx;
      if (Math.abs(dx) > half) continue;
      // a pointed roof over the tower
      if (y < top + half * 2) return Math.abs(dx) <= (y - top) / 2 ? (dx < 0 ? '3' : '2') : '.';
      if ((y - top) % 9 === 5 && Math.abs(dx) <= 1 && hash(cx, y, seed + 1) < 0.5) return 'a';
      return dx === -half ? '3' : '2';
    }
    return '.';
  });
};

/** The courtyard wall (64x48): crenellated stone with a barred iron gate under an arch. */
const gateWall = draw(64, 48, (x, y) => {
  if (y < 6) return x % 16 < 8 ? (y === 0 ? '3' : '2') : '.';
  // the gate's arch
  const dx = x - 40;
  const archTop = 22;
  const inGate = Math.abs(dx) <= 9 && (y >= archTop || Math.hypot(dx, archTop - y) <= 9);
  if (inGate) {
    if (Math.abs(dx) === 9 || (y < archTop && Math.hypot(dx, archTop - y) > 8)) return '3';
    return x % 4 === 0 || y % 8 === 0 ? '1' : '0';
  }
  const course = y >> 3;
  const bx = (x + (course % 2 ? 8 : 0)) % 16;
  if (y % 8 === 7 || bx === 15) return '1';
  if (y % 8 === 0) return '3';
  return '2';
});

/** A stone statue (16x48) on its plinth: a cloaked figure holding a spear. */
const statue = draw(16, 48, (x, y) => {
  if (y >= 36) return y === 36 ? '8' : y === 47 ? '6' : x === 0 || x === 15 ? '6' : '7';
  if (x === 12 && y < 36) return y < 4 ? '8' : '6'; // the spear
  const cx = 7;
  if (y < 8) {
    const d = Math.hypot(x - cx, y - 4.5);
    return d < 3.6 ? (x < cx ? '8' : '7') : '.';
  }
  const half = 2 + (y - 8) * 0.18;
  if (Math.abs(x - cx) > half) return '.';
  if (Math.abs(x - cx) > half - 1) return '6';
  return x < cx ? '8' : '7';
});

/** A torch brazier (16x32): an iron bowl on a post, its fire burning. */
const brazier = draw(16, 32, (x, y) => {
  if (y < 10) {
    const half = (y + 1) * 0.55;
    const dx = Math.abs(x - 7.5);
    if (dx > half) return '.';
    return dx < half * 0.45 && y > 3 ? 'a' : '9';
  }
  if (y < 14) return x >= 2 && x <= 13 ? (y === 10 ? '7' : '6') : '.';
  if (y < 30) return x >= 6 && x <= 9 ? (x === 6 ? '7' : '6') : '.';
  return x >= 3 && x <= 12 ? '6' : '.';
});

/** The town's rooftops (128x48): gables, chimneys and a church spire, a few windows lit. */
const roofs = draw(128, 48, (x, y) => {
  const houses: [number, number, number][] = [
    [0, 22, 20],
    [20, 16, 18],
    [38, 26, 16],
    [54, 12, 22],
    [76, 24, 18],
    [94, 18, 20],
    [114, 22, 14],
  ];
  // the church spire
  if (Math.abs(x - 66) <= 2 && y >= 0 && y < 12)
    return Math.abs(x - 66) <= y / 5 ? (x < 66 ? '3' : '2') : '.';
  for (const [hx, top, w] of houses) {
    if (x < hx || x >= hx + w) continue;
    const mid = hx + w / 2;
    const roof = top + Math.abs(x + 0.5 - mid) * 0.7;
    if (y < roof) {
      if (x === hx + 3 && y > top - 4 && y < roof) return '1'; // a chimney
      return '.';
    }
    if (y < roof + 1) return '3';
    const wx = (x - hx) % 6;
    if (y > roof + 5 && y % 9 < 4 && wx >= 2 && wx <= 3 && hash(hx, y >> 3, 131) < 0.4) return 'a';
    return x === hx ? '1' : '2';
  }
  return '.';
});

/** A street lamp (16x48): an iron post, a lantern burning on top. */
const lamp = draw(16, 48, (x, y) => {
  if (y < 12) {
    if (y < 2) return x >= 5 && x <= 10 ? '6' : '.';
    if (x < 4 || x > 11) return '.';
    if (x === 4 || x === 11 || y === 11) return '6';
    return y < 6 ? 'a' : '9';
  }
  if (y >= 44) return x >= 4 && x <= 11 ? '6' : '.';
  return x >= 7 && x <= 8 ? (x === 7 ? '7' : '6') : '.';
});

/** A shop sign (16x32): a board hung from an iron bracket on a post. */
const shopSign = draw(16, 32, (x, y) => {
  if (x >= 1 && x <= 2) return '6';
  if (y === 2 && x < 14) return '6';
  if (y >= 3 && y <= 4 && (x === 5 || x === 12)) return '6';
  if (y >= 5 && y <= 14 && x >= 3 && x <= 14) {
    if (x === 3 || x === 14 || y === 5 || y === 14) return '0';
    return (x + y) % 5 === 0 ? '8' : '7';
  }
  return '.';
});

/** The castle far off in the storm (96x64). */
const stormCastle = farCastle(96, 64, 141);

/** A bolt of lightning (16x64): a jagged white stroke with a pale glow. */
const bolt = draw(16, 64, (x, y) => {
  const path = 8 + Math.round(Math.sin(y * 0.45) * 3 + (y % 11 < 5 ? 2 : -2));
  const d = Math.abs(x - path);
  if (d === 0) return 'a';
  if (d === 1) return '9';
  return '.';
});

/** A dim clock face (64x64): a brass rim, its hours marked, the hands near midnight. */
const clockFace = draw(64, 64, (x, y) => {
  const dx = x - 31.5;
  const dy = y - 31.5;
  const d = Math.hypot(dx, dy);
  if (d > 30) return '.';
  if (d > 27) return d > 29 ? '9' : 'a';
  if (d > 26) return '1';
  const a = Math.atan2(dy, dx);
  const hour = Math.abs(((a / (Math.PI / 6)) % 1) + 1) % 1;
  if (d > 21 && (hour < 0.08 || hour > 0.92)) return '9';
  // the hands: the hour hand to eleven, the minute hand to twelve
  if (Math.abs(dx) < 1 && dy < 0 && d < 22) return '0';
  if (d < 14 && Math.abs(dx * Math.cos(Math.PI / 3) + dy * Math.sin(Math.PI / 3)) < 1 && dx < 0 && dy < 0)
    return '0';
  if (d < 2.5) return '9';
  return d < 24 ? '2' : '3';
});

/** A dim brass gear (32x32): twelve teeth, a hub and spokes. */
const gear = draw(32, 32, (x, y) => {
  const dx = x - 15.5;
  const dy = y - 15.5;
  const d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  const teeth = Math.cos(a * 12) > 0.2 ? 15 : 12.5;
  if (d > teeth) return '.';
  if (d > teeth - 1) return '9';
  if (d < 3) return '0';
  if (d < 5) return 'a';
  if (d < 9 && (Math.abs(dx) < 1.2 || Math.abs(dy) < 1.2)) return '9';
  if (d < 9) return '.';
  return 'a';
});

/** World 5's decor frames: the backdrops' pieces and the restyled trees. */
export const transylvaniaDecorFrames: Record<string, Rows> = {
  'cv-moon': moon,
  'cvg-castle': farCastle(128, 64, 133),
  'cvg-wall': gateWall,
  'tree-big@cv-gate': statue,
  'tree-small@cv-gate': brazier,
  'cvt-roofs': roofs,
  'tree-big@cv-town': lamp,
  'tree-small@cv-town': shopSign,
  'cvs-castle': stormCastle,
  'cvs-bolt': bolt,
  'cvc-clock': clockFace,
  'cvc-gear': gear,
};
