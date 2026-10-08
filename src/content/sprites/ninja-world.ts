import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';
import { stoneBlock } from './castlevania-look';

/**
 * World 6 as Ryu's world (0.4.29, campaign only): the looks of World 6's levels in the spirit of
 * the NES ninja action games (6-2 and its coin heaven keep their 0.4.12 night city,
 * ninja-city-look.ts, and Ryu's dojo its `dojo`). Original art, nothing traced. Every tile frame
 * keeps its tile's collision shape (solid tiles fill their 16x16; a bridge's deck is its top rows;
 * a chain or a cliff is scenery), and `?` blocks, coins, the flagpole, pipes and lava stay SMB's
 * own so they read at a glance; Bullet Bill blasters are black iron with their pale badge.
 *
 * - `ng-field` (6-1): a moonlit field at the edge of a bamboo forest, a ninja game's opening
 *   act. Dark earth, bamboo bundles for bricks, mossy stone under a starry night; the full moon,
 *   far peaks and a bamboo grove are painted behind (world/theme-backdrop.ts). Its trees are
 *   bamboo clumps and stone lanterns.
 * - `ng-sewer` (6-2-bonus, 6-2-bonus2): the city's sewers under 6-2's street, the underground
 *   still. Grimy concrete with slime along its seams, sewer brick, riveted steel.
 * - `ng-harbor` (6-2-water): a night harbour under the city's piers. Barnacled quay stone,
 *   rope-bound cargo crates and dark blue water. It is no water theme (no restyle is one):
 *   6-2-water swims by its map's `swim: true`, and World fills the deep from the waves down in
 *   the waves' blue (FLOODED in world/tile-render.ts, the palette's slot 9).
 * - `ng-pass` (6-3): a snowy mountain pass at night. Its treetops are snow-capped rock ledges on
 *   frozen cliffs, its floor frozen rock, its bricks ice; snowy peaks are painted behind under the
 *   moon, a dark sky that the lifts' cream planks and the balance lifts' ropes stand out against.
 * - `ng-temple` (6-4): the demon temple, Jaquio's lair, in the castle family. Crimson stone,
 *   carved blocks with gold eyes, a lacquered bridge on a gold chain over SMB's lava; a carved
 *   wall and demon-headed pillars are painted behind.
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 green, 8 white, 9/a the look's own pair (bamboo, slime, harbour water, ice and snow,
 * temple gold), b SMB's lava red.
 */

export const ngFieldTilePalette: string[] = [
  NES.black,
  '#241c10',
  '#4c3c24',
  '#7c6840',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#2c7c34',
  '#8cc858',
  NES.lava,
];

export const ngSewerTilePalette: string[] = [
  NES.black,
  '#1c2024',
  '#40484c',
  '#707c80',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#3c6c1c',
  '#84b83c',
  NES.lava,
];

/** The harbour's dark blue: the waves' body (slot 9) and the water World floods 6-2-water with. */
export const NG_HARBOR_WATER = '#102c74';

export const ngHarborTilePalette: string[] = [
  NES.black,
  '#20201c',
  '#48463c',
  '#7c7a68',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  NG_HARBOR_WATER,
  '#5c88d8',
  NES.lava,
];

export const ngPassTilePalette: string[] = [
  NES.black,
  '#242c48',
  '#48557c',
  '#7c90b8',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#9cc4e8',
  '#f8f8ff',
  NES.lava,
];

export const ngTempleTilePalette: string[] = [
  NES.black,
  '#300c1c',
  '#641c34',
  '#a0405c',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#8c6410',
  '#e0b040',
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

/** Lumpy ground: lumps lit up-left on the dark, a few black cracks. */
const lumps = (seed: number, fleck?: string): string[] =>
  draw(16, 16, (x, y) => {
    if (hash(x, y, seed) < 0.05) return '0';
    if (fleck && hash(x, y, seed + 7) < 0.04) return fleck;
    const n = hash(x >> 2, y >> 2, seed + 1) + hash(x >> 1, y >> 1, seed + 2) * 0.5;
    if (n > 1.05) return '3';
    if (n > 0.55) return '2';
    return '1';
  });

/** A spent block: the stone gone dark, four studs where the `?` was. */
const spent = (seed: number, stud: string): string[] =>
  stoneBlock('2', '1', '0', seed).map((r, y) =>
    y === 3 || y === 11 ? `${r.slice(0, 3)}${stud}${r.slice(4, 11)}${stud}${r.slice(12)}` : r,
  );

/** Bullet Bill blasters in black iron (SMB's shape, its pale badge kept). */
const IRON = { '1': '0', '2': '1', '3': '3' };
const blasters = (base: Record<string, Rows>): Record<string, Rows> => ({
  'blaster-top': recolour(base['blaster-top'] as Rows, IRON),
  'blaster-base': recolour(base['blaster-base'] as Rows, IRON),
});

/* ---------- 6-1: the moonlit bamboo field (`ng-field`) ---------- */

/** A bundle of cut bamboo (the bricks): four green stalks with their nodes, a rope band round them. */
const bambooBundle = draw(16, 16, (x, y) => {
  if (y === 15 || x === 15) return '0';
  const stalk = x % 4;
  if (stalk === 3) return '0';
  if (y === 7 || y === 8) return y === 7 ? '3' : '2'; // the rope band
  const node = (y + (x >> 2) * 3) % 8 === 2;
  if (node) return stalk === 0 ? 'a' : '1';
  return stalk === 0 ? 'a' : stalk === 1 ? '9' : '1';
});

export function ngFieldTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  const earth = lumps(201, '9');
  return themed(
    {
      ground: earth,
      'castle-brick': earth,
      brick: bambooBundle,
      hard: stoneBlock('3', '2', '1', 203),
      used: spent(205, 'a'),
      ...blasters(base),
    },
    'ng-field',
  );
}

/* ---------- 6-2's coin rooms: the city's sewers (`ng-sewer`) ---------- */

/** Grimy concrete slabs, slime (slot 9/a) creeping along their seams. */
const sewerSlab = courses(16, '3', '2', '1', 211).map((r, y) =>
  [...r].map((c, x) => (y % 8 === 6 && hash(x, y, 213) < 0.5 ? (hash(x, y, 214) < 0.3 ? 'a' : '9') : c)).join(''),
);

/** Riveted steel (the hard blocks): a plate with a rivet in each corner and a cross brace. */
const steelPlate = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '3';
  if (x === 14 || y === 14) return '1';
  if ((x === 2 || x === 12) && (y === 2 || y === 12)) return '3';
  if ((x === 3 || x === 13) && (y === 3 || y === 13)) return '0';
  if (x === y || x === 14 - y) return '1';
  return '2';
});

/**
 * The sewer's bricks are SMB's underground brick in the sewer's colours: Ryu's trick panel in
 * 6-2-bonus (the `ninja` sheet's `trick-wall-0`, that brick pixel for pixel) is drawn in palette
 * `ninja-ng-sewer` (trick-wall.ts trickPalette) and cannot be told from the wall round it.
 */
export function ngSewerTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: sewerSlab,
      'castle-brick': sewerSlab,
      brick: base['brick@underground'] as Rows,
      hard: steelPlate,
      used: spent(217, '9'),
    },
    'ng-sewer',
  );
}

/* ---------- 6-2-water: the night harbour (`ng-harbor`) ---------- */

/** Quay stone: dressed courses with pale barnacles here and there. */
const quayStone = courses(16, '3', '2', '1', 221).map((r, y) =>
  [...r].map((c, x) => (c !== '0' && hash(x, y, 223) < 0.06 ? '8' : c)).join(''),
);

/** A cargo crate (the hard blocks): planks with a rope lashed round it crosswise. */
const cargoCrate = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15 || x === 0 || y === 0) return '0';
  if (x === 7 || x === 8 || y === 7 || y === 8) return x === 8 || y === 8 ? '2' : '3';
  if (y % 5 === 4) return '1';
  return x === 1 || y === 1 ? '3' : '2';
});

/** The harbour's surface: a pale moonlit crest over the dark blue, breaking in two places. */
const harbourWaves = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const u = (x + shift) % 16;
    const crest = u >= 1 && u <= 3 ? true : u >= 9 && u <= 11;
    if (y === 0) return crest ? '8' : '.';
    if (y === 1) return crest ? 'a' : u === 0 || u === 4 || u === 8 || u === 12 ? 'a' : '.';
    if (y === 2) return 'a';
    if (y === 3) return (u + 2) % 5 === 0 ? 'a' : '9';
    return hash((x + shift) % 16, y, 227) < 0.03 ? 'a' : '9';
  });

export function ngHarborTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: quayStone,
      'castle-brick': quayStone,
      brick: courses(8, '3', '2', '1', 229),
      hard: cargoCrate,
      used: spent(231, '3'),
      'water-0': harbourWaves(0),
      'water-1': harbourWaves(6),
    },
    'ng-harbor',
  );
}

/* ---------- 6-3: the snowy mountain pass (`ng-pass`) ---------- */

/** A snow-capped rock ledge (the treetops): deep snow on top, icicles dripping, rock below; solid. */
const snowLedge = draw(16, 16, (x, y) => {
  if (y === 0) return x % 5 === 2 ? '9' : 'a';
  if (y <= 3) return 'a';
  if (y === 4) return x % 3 === 0 ? '9' : 'a';
  if (y === 5) return x % 3 === 0 ? '9' : x % 6 === 4 ? '3' : '2';
  if (y === 15) return '0';
  return hash(x >> 1, y >> 1, 241) < 0.3 ? '1' : hash(x, y, 242) < 0.08 ? '3' : '2';
});

/** The frozen cliff under the ledges (scenery): a column of rock, ice streaking down it. */
const frozenCliff = draw(16, 16, (x, y) => {
  if (x < 2 || x > 13) return '.';
  if (x === 2) return '3';
  if (x === 13) return '0';
  if ((x === 5 || x === 10) && (y + x) % 7 < 4) return '9';
  return hash(x >> 1, y >> 2, 243) < 0.35 ? '1' : '2';
});

/** Frozen rock (the floor): lumpy rock, ice glinting in it. */
const frozenRock = lumps(245, '9');

/** Ice bricks: pale ice courses, lit white along their tops. */
const iceBrick = courses(8, 'a', '9', '3', 247);

export function ngPassTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: frozenRock,
      'castle-brick': frozenRock,
      brick: iceBrick,
      hard: stoneBlock('3', '2', '1', 249),
      used: spent(251, 'a'),
      'tree-top': snowLedge,
      'tree-trunk': frozenCliff,
      ...blasters(base),
    },
    'ng-pass',
  );
}

/* ---------- 6-4: the demon temple, Jaquio's lair (`ng-temple`) ---------- */

/** A carved temple block (the hard blocks): crimson stone, a gold demon eye set in it. */
const eyeBlock = stoneBlock('3', '2', '1', 261).map((r, y) =>
  [...r]
    .map((c, x) => {
      const dx = (x - 7.5) / 4.5;
      const dy = (y - 7.5) / 2.5;
      const d = dx * dx + dy * dy;
      if (d > 1) return c;
      if (d > 0.6) return 'a';
      return Math.abs(x - 7.5) < 1 ? '0' : '9';
    })
    .join(''),
);

/** A lacquered bridge: a red deck with gold studs over a black beam. */
const bridgeTemple = draw(16, 16, (x, y) => {
  if (y === 0) return '3';
  if (y === 1 || y === 2) return x % 8 === 3 ? 'a' : '2';
  if (y === 3) return '1';
  if (y === 4) return '0';
  if (y === 5 && (x === 3 || x === 12)) return '9';
  return '.';
});

export function ngTempleTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  const stone = courses(16, '3', '2', '1', 263);
  return themed(
    {
      ground: stone,
      'castle-brick': stone,
      brick: courses(8, '3', '2', '1', 265),
      hard: eyeBlock,
      used: spent(267, 'a'),
      bridge: bridgeTemple,
      chain: recolour(base.chain as Rows, { '3': 'a' }),
    },
    'ng-temple',
  );
}

/* ---------- decor ---------- */

/*
 * Decor palettes keep decor.ts's roles: 1-3 the backdrops' dim shades (dark, main, lit), 4-5 the
 * clouds (dim night clouds), 6-8 stone (the end castle, the lanterns; 8 also the moon), 9-a fire
 * and lamplight (red, yellow; the temple's dim gold).
 */

const NIGHT_CLOUD = '#2c2c48';
const NIGHT_CLOUD_EDGE = '#1c1c34';
const STONE: [string, string, string] = ['#3c3c48', '#6c6c78', '#e0dcc4'];
const FIRE: [string, string] = ['#c83010', '#fcbc3c'];

export const ngFieldDecorPalette: string[] = [
  NES.black,
  '#0c1418',
  '#142420',
  '#1c3828',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const ngSewerDecorPalette: string[] = [
  NES.black,
  '#101414',
  '#1c2420',
  '#2c3830',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const ngHarborDecorPalette: string[] = [
  NES.black,
  '#0c1020',
  '#141c34',
  '#1c2c48',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const ngPassDecorPalette: string[] = [
  NES.black,
  '#18203c',
  '#283658',
  '#4c5c84',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  ...FIRE,
];

export const ngTempleDecorPalette: string[] = [
  NES.black,
  '#140410',
  '#220818',
  '#341028',
  NIGHT_CLOUD,
  NIGHT_CLOUD_EDGE,
  ...STONE,
  '#5c4010',
  '#84601c',
];

/** The full moon (32x32): a pale disc, its seas a shade darker. */
const moon = draw(32, 32, (x, y) => {
  const d = Math.hypot(x - 15.5, y - 15.5);
  if (d > 14) return '.';
  for (const [cx, cy, r] of [
    [10, 11, 3],
    [19, 9, 2.5],
    [17, 19, 4.5],
    [9, 20, 2],
  ] as const)
    if (Math.hypot(x - cx, y - cy) < r) return '7';
  return '8';
});

/**
 * A ridge of far peaks (`w` x `h`): jagged mountains lit along their left slopes, their caps in
 * `cap` (the field's dim peaks, the pass's snow).
 */
const peaks = (w: number, h: number, seed: number, cap: string): string[] => {
  const tops: [number, number][] = [];
  for (let x = -8; x < w + 8; x += 18 + Math.floor(hash(x, 0, seed) * 14))
    tops.push([x, Math.floor(4 + hash(x, 1, seed) * (h * 0.45))]);
  const height = (x: number): number =>
    Math.min(...tops.map(([px, py]) => py + Math.abs(x - px) * (0.9 + hash(px, 2, seed) * 0.4)));
  return draw(w, h, (x, y) => {
    // the ridge wraps round: the left edge meets the right
    const top = Math.min(height(x), height(x + w), height(x - w));
    if (y < top) return '.';
    const left = height(x - 1) > top;
    if (y < top + 5 + hash(x, 3, seed) * 3) return left ? cap : cap === '3' ? '2' : '6';
    return left && y < top + 12 ? '2' : '1';
  });
};

/** A grove of bamboo (64x64): tall dim stalks with their nodes, leaf sprays at the top. */
const bambooGrove = draw(64, 64, (x, y) => {
  for (const [sx, lean] of [
    [4, 0.05],
    [15, -0.04],
    [27, 0.03],
    [38, -0.06],
    [50, 0.04],
    [58, -0.02],
  ] as const) {
    const cx = sx + (64 - y) * lean;
    const dx = x - cx;
    if (Math.abs(dx) <= 1.2) {
      if ((y + sx) % 14 === 0) return '1';
      return dx < 0 ? '3' : '2';
    }
    // a spray of narrow leaves near the stalk's top
    if (y < 22 && Math.abs(dx) < 7 && Math.abs(dx) > 1.5) {
      const leaf = (y + Math.abs(dx) * (dx < 0 ? 0.6 : -0.6) + sx) % 7;
      if (leaf < 1.2) return '2';
    }
  }
  return '.';
});

/** A clump of bamboo (16x48), the field's big tree: three stalks with nodes and leaves. */
const bambooClump = draw(16, 48, (x, y) => {
  for (const sx of [3, 8, 12]) {
    const top = sx === 8 ? 0 : 8;
    if (y < top) continue;
    if (x === sx || x === sx + 1) {
      if ((y + sx) % 10 === 0) return '0';
      return x === sx ? 'a' : '9';
    }
  }
  if (y < 20 && (x + y) % 5 === 0 && hash(x, y, 271) < 0.6) return '9';
  return '.';
});

/** A stone lantern (16x32), the field's small tree: a cap, its fire box lit, a post on a base. */
const stoneLantern = draw(16, 32, (x, y) => {
  if (y < 2) return x >= 6 && x <= 9 ? '8' : '.';
  if (y < 6) return Math.abs(x - 7.5) <= (y - 1) * 1.8 ? (y === 5 ? '6' : '7') : '.';
  if (y < 13) {
    if (x < 3 || x > 12) return '.';
    if (x === 3 || x === 12) return '7';
    return y > 7 && y < 12 && x > 4 && x < 11 ? (x > 6 && x < 9 ? 'a' : '9') : '6';
  }
  if (y < 15) return x >= 2 && x <= 13 ? (y === 13 ? '8' : '6') : '.';
  if (y < 28) return x >= 6 && x <= 9 ? (x === 6 ? '8' : '7') : '.';
  return x >= 3 && x <= 12 ? (y === 28 ? '8' : '6') : '.';
});

/** The temple's carved wall (64x64): dim stone courses, a gold demon glyph in a carved frame. */
const templeWall = draw(64, 64, (x, y) => {
  const fx = x - 32;
  const fy = y - 30;
  // the carved frame round the glyph
  if (Math.abs(fx) <= 14 && Math.abs(fy) <= 14) {
    if (Math.abs(fx) === 14 || Math.abs(fy) === 14) return '3';
    if (Math.abs(fx) === 13 || Math.abs(fy) === 13) return '0';
    // the demon's face: horns, eyes and a fanged mouth
    const horn = fy < -4 && Math.abs(Math.abs(fx) - 8 + (fy + 4) * 0.5) < 1.2;
    const eye = Math.abs(fy + 1) <= 1 && Math.abs(Math.abs(fx) - 5) <= 2;
    const mouth = fy >= 5 && fy <= 7 && Math.abs(fx) <= 6 && (fy !== 7 || fx % 3 !== 0);
    if (horn || eye || mouth) return '9';
    return '1';
  }
  const course = y >> 4;
  const bx = (x + (course % 2 ? 16 : 0)) % 32;
  if (y % 16 === 15 || bx === 31) return '1';
  if (y % 16 === 0) return '3';
  return '2';
});

/** A demon-headed pillar (32x128): a dim shaft crowned by a horned head, gold eyes. */
const templePillar = draw(32, 128, (x, y) => {
  const dx = x - 15.5;
  if (y < 24) {
    // the horned head
    const horn = y < 10 && Math.abs(Math.abs(dx) - 10 + y * 0.4) < 1.5;
    if (horn) return '3';
    const head = Math.abs(dx) < 11 - Math.max(0, y - 16) * 0.6 && y >= 6;
    if (!head) return '.';
    if (y >= 11 && y <= 13 && Math.abs(Math.abs(dx) - 5) < 2) return 'a';
    if (y >= 18 && y <= 20 && Math.abs(dx) < 5) return y === 18 && Math.round(dx) % 2 ? '9' : '0';
    return dx < 0 ? '3' : '2';
  }
  if (Math.abs(dx) > 9) return '.';
  if (Math.abs(dx) > 8) return '0';
  if ((y - 24) % 32 < 2) return '3';
  return dx < -4 ? '3' : dx > 4 ? '1' : '2';
});

/** World 6's decor frames: the backdrops' pieces and the restyled trees. */
export const ninjaWorldDecorFrames: Record<string, Rows> = {
  'ng-moon': moon,
  'ngf-peaks': peaks(128, 48, 281, '3'),
  'ngf-bamboo': bambooGrove,
  'tree-big@ng-field': bambooClump,
  'tree-small@ng-field': stoneLantern,
  'ngp-peaks': peaks(128, 64, 283, '7'),
  'ngt-wall': templeWall,
  'ngt-pillar': templePillar,
};
