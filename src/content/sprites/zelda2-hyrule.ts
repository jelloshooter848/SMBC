import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';

/**
 * World 2 as Hyrule (0.4.24, campaign only): the Zelda II looks of the levels past 2-1, in the
 * spirit of the NES Zelda II. Original art, nothing traced. Every tile frame keeps its tile's
 * collision shape (solid tiles fill their 16x16; a bridge's deck is its top rows; a chain is
 * scenery), and `?` blocks, coins, the flagpole and lava stay SMB's own so they read at a glance.
 *
 * - `zelda2-water` (2-2): a lake over a sunken palace. The lakebed is mossy cobbles, the hard blocks
 *   sunken palace masonry, the waves a dark lake with a thin white crest. It is no water theme (no
 *   restyle is one): 2-2 swims by its map's `swim: true`, and World fills the deep from the waves
 *   down in the lake's blue (FLOODED in world/tile-render.ts, the palette's slot 9).
 * - `zelda2-palace` (2-4): a palace of slate-blue brick and bevelled stone, iron chains, a stone
 *   bridge over SMB's lava; a hall wall hung with red curtains is painted behind it
 *   (world/theme-backdrop.ts) and knight statues stand on its floors.
 * - `zelda2-cave` (2-1's bonus room, the Moblin's cave): rough brown rock and boulders, rock
 *   bricks, stone pipes.
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 green, 8 white, 9/a the lake's water (2-2) or iron and stone greys (2-4, the cave's
 * pipes), b SMB's lava red.
 */

/** The lake's deep blue: the wave tiles' body (slot 9) and the water World floods 2-2 with. */
export const HYRULE_LAKE = '#1838a0';

export const zelda2WaterTilePalette: string[] = [
  NES.black,
  '#005050',
  '#48a090',
  '#a0e8d0',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  HYRULE_LAKE,
  '#4c78e8',
  NES.lava,
];

export const zelda2PalaceTilePalette: string[] = [
  NES.black,
  '#2c2c6c',
  '#5858b8',
  '#a8a8f0',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  NES.gray,
  NES.lightGray,
  NES.lava,
];

export const zelda2CaveTilePalette: string[] = [
  NES.black,
  NES.brownDark,
  '#885818',
  NES.brownLight,
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#585858',
  '#a8a8a8',
  NES.lava,
];

/* ---------- shared shapes ---------- */

/**
 * A bevelled block filling its cell: a black seam right and below, a lit top and left edge, a
 * shaded bottom and right, a few pits on its face (`pits` of them in 100).
 */
const bevel = (lit: string, main: string, dark: string, seed: number, pits = 7): string[] =>
  draw(16, 16, (x, y) => {
    if (x === 15 || y === 15) return '0';
    if ((x === 0 || x === 14) && (y === 0 || y === 14)) return '0';
    if (y === 0 || x === 0) return lit;
    if (y === 14 || x === 14) return dark;
    if (hash(x, y, seed) < pits / 100) return dark;
    return main;
  });

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

/** Rounded cobbles on a 16x16 torus: two rows of stones, offset, black between. */
const cobbles = (lit: string, main: string, dark: string, seed: number): string[] => {
  const stones: [number, number, number, number][] = [
    // cx, cy, rx, ry
    [3.5, 3.5, 4, 3.6],
    [11.5, 3.5, 4, 3.6],
    [7.5, 11.5, 4, 3.6],
    [15.5, 11.5, 4, 3.6],
  ];
  return draw(16, 16, (x, y) => {
    for (const [cx, cy, rx, ry] of stones)
      for (const ox of [-16, 0, 16])
        for (const oy of [-16, 0, 16]) {
          const dx = (x - cx - ox) / rx;
          const dy = (y - cy - oy) / ry;
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          if (d > 0.62 && dx + dy < 0) return lit;
          if (d > 0.62 && dx + dy > 0.4) return dark;
          return hash(x, y, seed) < 0.1 ? dark : main;
        }
    return '0';
  });
};

/** A pipe recoloured into other slots (SMB's shape, so its outline and openings stay). */
const pipeIn = (base: Record<string, Rows>, main: string, light: string): Record<string, Rows> =>
  Object.fromEntries(
    [
      'pipe-top-left',
      'pipe-top-right',
      'pipe-bottom-left',
      'pipe-bottom-right',
      'pipe-body-left',
      'pipe-body-right',
      'pipe-h-top-left',
      'pipe-h-top-right',
      'pipe-h-bottom-left',
      'pipe-h-bottom-right',
    ].map((n) => [n, recolour(base[n] as Rows, { '5': main, '6': light })]),
  );

/* ---------- 2-2: the lake (`zelda2-water`) ---------- */

/** The lakebed: mossy cobbles, a few strands of green moss on their tops. */
const groundLake = cobbles('3', '2', '1', 31).map((r, y) =>
  [...r].map((c, x) => (c === '3' && y % 8 < 2 && hash(x, y, 33) < 0.35 ? '5' : c)).join(''),
);

/** Sunken palace masonry: a bevelled block, moss on its top edge and a carved ring on its face. */
const hardLake = bevel('3', '2', '1', 35).map((r, y) =>
  [...r]
    .map((c, x) => {
      if (y === 0 && x > 0 && x < 15 && hash(x, 0, 37) < 0.45) return '5';
      const d = Math.hypot(x - 7, y - 7);
      if (d > 3 && d < 4.2) return '1';
      return c;
    })
    .join(''),
);

/** A spent block of the same stone, unlit. */
const usedLake = bevel('2', '1', '0', 39, 12);

/**
 * The lake's surface: a thin white crest with a light ripple under it, breaking at two places
 * (`shift` moves them along), the dark lake below with a few glints.
 */
const lakeWaves = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const u = (x + shift) % 16;
    const crest = u === 2 || u === 3 || u === 10 || u === 11;
    if (y === 0) return crest ? '8' : '.';
    if (y === 1) return crest ? 'a' : u === 1 || u === 4 || u === 9 || u === 12 ? '8' : '.';
    if (y === 2) return 'a';
    if (y === 3) return (u + 1) % 4 === 0 ? 'a' : '9';
    return hash((x + shift) % 16, y, 41) < 0.03 ? 'a' : '9';
  });

/** The lake's tile frames (`<tile>@zelda2-water`): stone pipes in the masonry's teal. */
export function zelda2WaterTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: groundLake,
      hard: hardLake,
      used: usedLake,
      brick: courses(16, '3', '2', '1', 43),
      'castle-brick': courses(16, '3', '2', '1', 45),
      'water-0': lakeWaves(0),
      'water-1': lakeWaves(4),
      ...pipeIn(base, '2', '3'),
    },
    'zelda2-water',
  );
}

/* ---------- 2-4: the palace (`zelda2-palace`) ---------- */

/** Palace brickwork: long slate bricks in offset courses, lit along their tops. */
const brickworkPalace = courses(16, '3', '2', '1', 51);

/** A bevelled palace stone (the hard blocks), its face plain but for a few pits. */
const hardPalace = bevel('3', '2', '1', 53);

/** The breakable blocks: short bricks on SMB's brick courses (the same mortar), with cracks. */
const brickPalace = [
  '3333333033333330',
  '2222222022222220',
  '2212222022221220',
  '0000000000000000',
  '3330333333303333',
  '2220222122202222',
  '1220222222201222',
  '0000000000000000',
  '3333333033333330',
  '2222122022222220',
  '2222222022122220',
  '0000000000000000',
  '3330333333303333',
  '2220222222202212',
  '2120222222202222',
  '0000000000000000',
];

/** A spent block: dark stone with a lit rim and four iron studs where the `?` was. */
const usedPalace = bevel('2', '1', '0', 57, 0).map((r, y) =>
  y === 3 || y === 11 ? `${r.slice(0, 3)}a${r.slice(4, 11)}a${r.slice(12)}` : r,
);

/** The bridge over the lava: a deck of dressed slabs bound with iron, open below. */
const bridgePalace = draw(16, 16, (x, y) => {
  if (y === 0) return 'a';
  if (y < 4) return x === 7 || x === 15 ? '9' : hash(x, y, 59) < 0.12 ? '1' : '2';
  if (y === 4) return '0';
  if (y < 9 && (x === 2 || x === 3 || x === 12 || x === 13)) return y === 8 ? '0' : x % 2 ? '9' : 'a';
  return '.';
});

/** The bridge's chain: oval iron links. */
const chainPalace = draw(16, 16, (x, y) => {
  const ly = y % 8;
  if (y % 8 < 5) {
    // an upright link
    const d = Math.hypot((x - 7.5) / 2.5, (ly - 2) / 2.6);
    if (d <= 1 && d > 0.45) return x < 8 ? 'a' : '9';
    if (d > 1 && d <= 1.35) return '0';
    return '.';
  }
  // the crosswise link between
  if (x >= 6 && x <= 9) return ly === 6 ? (x < 8 ? 'a' : '9') : '0';
  return '.';
});

export function zelda2PalaceTileFrames(): Record<string, Rows> {
  return themed(
    {
      'castle-brick': brickworkPalace,
      ground: brickworkPalace,
      hard: hardPalace,
      brick: brickPalace,
      used: usedPalace,
      bridge: bridgePalace,
      chain: chainPalace,
    },
    'zelda2-palace',
  );
}

/* ---------- 2-1's bonus room and the Moblin's cave (`zelda2-cave`) ---------- */

/** Rough cave rock: lumps lit up-left on the dark, a few black cracks. */
const rockCave = draw(16, 16, (x, y) => {
  const n = hash(x >> 2, y >> 2, 61) + hash(x >> 1, y >> 1, 62) * 0.5;
  const crack = hash(x, y, 63) < 0.05;
  if (crack) return '0';
  if (n > 1.05) return '3';
  if (n > 0.55) return '2';
  return '1';
});

/** A boulder block: a rounded rock filling the cell (dark corners), lit up-left. */
const boulderCave = draw(16, 16, (x, y) => {
  const d = Math.hypot((x - 7.5) / 8.4, (y - 7.5) / 8.4);
  if (d > 1) return '0';
  if (d > 0.88) return x + y < 15 ? '2' : '1';
  if (x + y < 9 && hash(x, y, 65) < 0.7) return '3';
  return hash(x, y, 66) < 0.1 ? '1' : '2';
});

export function zelda2CaveTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: rockCave,
      'castle-brick': rockCave,
      hard: boulderCave,
      brick: courses(8, '3', '2', '1', 67),
      used: bevel('2', '1', '0', 69, 12),
      ...pipeIn(base, '9', 'a'),
    },
    'zelda2-cave',
  );
}

/* ---------- decor ---------- */

/*
 * The lake's decor (`decor-zelda2-water`): 1-3 lake weed greens; 4-5 the sunken ruins' stone, a
 * dim blue-grey under the water (SMB's ruin pillars, statue and temple of the sky ruins are drawn
 * in it as a sunken palace); 6-8 a castle's slots in the same dim stone; 9-a deep water.
 */
export const zelda2WaterDecorPalette: string[] = [
  NES.black,
  '#004018',
  '#007830',
  '#40b050',
  '#6c8cc0',
  '#3c5c98',
  '#102860',
  '#2c4c90',
  '#5878c0',
  '#102878',
  '#2850b0',
];

/*
 * The palace's decor (`decor-zelda2-palace`): 1-3 the hall's wall, a shade darker than the
 * level's brick so it stays behind; 4-6 the curtains' reds (shade, main, lit fold); 7 gold;
 * 8-a the statues' stone (dark, mid, light).
 */
export const zelda2PalaceDecorPalette: string[] = [
  NES.black,
  '#100c28',
  '#1c1c48',
  '#2c2c64',
  '#580010',
  NES.redDark,
  NES.redBright,
  NES.yellow,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
];

/* The cave's decor (`decor-zelda2-cave`): 1-3 the rock's browns, dimmed; the rest a castle's. */
export const zelda2CaveDecorPalette: string[] = [
  NES.black,
  '#201000',
  '#402800',
  '#6c4818',
  NES.white,
  NES.lightGray,
  NES.brownDark,
  '#885818',
  NES.brownLight,
  NES.brownDark,
  NES.brown,
];

/** Lake weed (16x32): three swaying strands rooted in the lakebed, leaves both sides. */
const lakeweed = draw(16, 32, (x, y) => {
  for (const [root, lean, top, seed] of [
    [4, -0.12, 6, 1],
    [8, 0.1, 0, 2],
    [12, -0.08, 10, 3],
  ] as const) {
    if (y < top) continue;
    const t = (31 - y) / (31 - top);
    const cx = root + lean * (31 - y) + Math.sin(t * 5 + seed) * 1.2;
    const d = x - cx;
    if (Math.abs(d) < 0.8) return '2';
    const leaf = (y + seed * 3) % 6;
    if (leaf < 2 && d > 0 && d < 3.2) return d < 1.8 ? '3' : '1';
    if (leaf >= 3 && leaf < 5 && d < 0 && d > -3.2) return d > -1.8 ? '2' : '1';
  }
  return '.';
});

/** A rock pile (32x16) on a floor: three boulders, lit up-left. */
const rocks = draw(32, 16, (x, y) => {
  for (const [cx, cy, r] of [
    [9, 10, 6.5],
    [21, 11, 5.5],
    [15, 6, 5],
  ] as const) {
    const d = Math.hypot(x - cx, (y - cy) * 1.15);
    if (d > r) continue;
    if (d > r - 1) return '0';
    return x - cx + (y - cy) < -r / 2 ? '3' : hash(x, y, 71) < 0.12 ? '1' : '2';
  }
  return '.';
});

/** A stalactite (16x16) hanging from a cave's roof: its top row flush with the rock. */
const stalactite = draw(16, 16, (x, y) => {
  for (const [cx, w, len] of [
    [5, 4, 15],
    [11, 3, 9],
  ] as const) {
    const half = (w * (len - y)) / len;
    const d = x - cx;
    if (y > len || Math.abs(d) > half) continue;
    if (Math.abs(d) > half - 1) return '0';
    return d < 0 ? '3' : '2';
  }
  return '.';
});

/**
 * The palace hall's wall (32x32, tiles both ways): big dim bricks in offset courses, black
 * mortar, a lit top edge on some.
 */
const palaceWall = draw(32, 32, (x, y) => {
  const course = y >> 4;
  const bx = (x + (course % 2 ? 16 : 0)) % 32;
  if (y % 16 === 15 || bx % 32 === 31 || (bx === 15 && course % 2 === 0)) return '0';
  if (y % 16 === 0 && hash(bx >> 4, course, 81) < 0.7) return '3';
  return hash(x, y, 83) < 0.04 ? '1' : '2';
});

/**
 * A red curtain (32x48) hanging from a gold rod: a scalloped valance over two drapes, parted and
 * gathered at their middle, their folds lit and shaded.
 */
const curtain = draw(32, 48, (x, y) => {
  if (y < 2) return x === 0 || x === 31 ? '0' : y === 0 ? '0' : '7';
  if (y < 9) {
    // the valance: scallops 8 px wide
    const s = x % 8;
    const depth = 7 - Math.round(Math.abs(s - 3.5) * 0.9);
    if (y - 2 > depth) return '.';
    if (y - 2 === depth) return '0';
    return s === 0 ? '4' : s < 3 ? '6' : '5';
  }
  // the two drapes: each narrows to its tie at y 30, then flares
  const tie = 30;
  const width = y < tie ? 15 - Math.round((y - 9) * 0.35) : 8 + Math.round((y - tie) * 0.45);
  const left = x < 16;
  const d = left ? x : 31 - x;
  if (d >= width) return '.';
  if (d === width - 1) return '0';
  if (y === tie || y === tie + 1) return d > width - 4 ? '7' : '0';
  const fold = (d + (left ? 0 : 1)) % 4;
  return fold === 0 ? '4' : fold === 1 ? '6' : '5';
});

/**
 * A knight's statue (16x32) on a plinth: helmet with a slit visor, broad pauldrons, a kite shield
 * on its arm and a sword held point down, in grey stone lit from the left.
 */
const statue = (() => {
  const fill = (x: number, y: number): string | null => {
    // plinth
    if (y >= 26) return x >= 1 && x <= 14 ? (y === 26 ? 'a' : x === 14 ? '8' : '9') : null;
    // sword, point down to the plinth, hilt at the shoulder
    if (x === 12 && y >= 6 && y <= 25) return y === 9 ? '8' : 'a';
    if (y === 9 && x >= 11 && x <= 13) return '8';
    // helmet
    if (y <= 6 && Math.hypot((x - 7) / 3.4, (y - 3.5) / 3.2) <= 1)
      return y === 4 && x >= 5 && x <= 9 ? '0' : x < 7 ? 'a' : '9';
    // pauldrons and torso
    if (y >= 7 && y <= 9 && x >= 2 && x <= 12 && !(y === 7 && (x === 2 || x === 12)))
      return x < 7 ? 'a' : '9';
    if (y >= 10 && y <= 18 && x >= 4 && x <= 10) return x < 7 ? '9' : '8';
    // legs and feet
    if (y >= 19 && y <= 25 && ((x >= 4 && x <= 6) || (x >= 8 && x <= 10)))
      return x < 6 || x === 8 ? 'a' : '9';
    return null;
  };
  // the shield on its arm (drawn over the body)
  const shield = (x: number, y: number): string | null => {
    if (y < 9 || y > 20) return null;
    const half = y < 16 ? 3.5 : 3.5 - (y - 15) * 0.7;
    const d = x - 4;
    if (Math.abs(d) > half) return null;
    if (Math.abs(d) > half - 1 || y === 9) return 'a';
    return (x === 4 && y < 18) || (y === 12 && Math.abs(d) < 2.5) ? 'a' : '9';
  };
  const px = (x: number, y: number): string | null => shield(x, y) ?? fill(x, y);
  return draw(16, 32, (x, y) => {
    const c = px(x, y);
    if (c) return c;
    // outline every filled shape
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      if (x + dx >= 0 && x + dx < 16 && y + dy >= 0 && y + dy < 32 && px(x + dx, y + dy)) return '0';
    return '.';
  });
})();

/**
 * Decor frames (registered in decor.ts): the lake's weed, the cave's rocks and stalactites, the
 * palace's wall and curtains (its backdrop) and its knight statues.
 */
export const zelda2HyruleDecorFrames: Record<string, Rows> = {
  'z2-lakeweed': lakeweed,
  'z2-rocks': rocks,
  'z2-stalactite': stalactite,
  'z2-palace-wall': palaceWall,
  'z2-curtain': curtain,
  'z2-statue': statue,
};
