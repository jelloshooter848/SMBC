import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';
import { stoneBlock } from './castlevania-look';
import { alienLairFrames, contraJungleFrames } from './contra-tiles';

/**
 * World 7 as Bill's world (0.4.30, campaign only): the looks of World 7's levels in the spirit of
 * an NES jungle run-and-gun (7-3 keeps its 0.4.9 jungle, contra-tiles.ts; Bill's camp and the
 * waterfall climb their own). Original art, nothing traced. Every tile frame keeps its tile's
 * collision shape (solid tiles fill their 16x16; a bridge's deck is its top rows; a chain is
 * scenery), and `?` blocks, coins, the flagpole, pipes and lava stay SMB's own so they read at a
 * glance.
 *
 * - `contra-snow` (7-1): the snowfield before the enemy base at night. Packed snow over frozen
 *   ground, concrete bunker blocks, riveted steel; the Bullet Bill blasters are steel pillbox
 *   cannons with snow on their barrels and SMB's pale badge (they still read as blasters). Far
 *   snowy peaks and the base's wall are painted behind (world/theme-backdrop.ts); its trees are
 *   snowy pines and firs.
 * - `contra-base` (7-1-bonus): the enemy base's inner corridors, the underground still. Steel
 *   deck grating, bulkhead panels, riveted plate; a corridor wall of panels and conduits painted
 *   behind, with no light on it that blinks.
 * - `contra-shore` (7-2-intro, 7-2-exit): the jungle shore. Sand, the jungle's mossy brick, stone;
 *   a palm-and-fern treeline painted behind.
 * - `contra-river` (7-2): the jungle river. Mossy riverbed rock, green water. It is no water
 *   theme (no restyle is one): 7-2 swims by its map's `swim: true`, and World fills the deep from
 *   the waves down in the waves' green (FLOODED in world/tile-render.ts, the palette's slot 9).
 * - `contra-lair` (7-4): Red Falcon's alien lair, in the castle family. Bill's mini game's flesh,
 *   bone and egg clutches (contra-tiles.ts) over SMB's lava, a spine bridge on a sinew chain;
 *   ribbed organic walls and the lair's great heart painted behind, still (nothing pulses).
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 green, 8 white (the lair's bone), 9/a the look's own pair (snow, hazard paint, sand,
 * river water, acid), b SMB's lava red.
 */

export const contraSnowTilePalette: string[] = [
  NES.black,
  '#2c3448',
  '#5c6880',
  '#9ca8c0',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#b4c8e4',
  '#f4f8ff',
  NES.lava,
];

export const contraBaseTilePalette: string[] = [
  NES.black,
  '#1c2620',
  '#3c4c40',
  '#6c806c',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#802010',
  '#d8a020',
  NES.lava,
];

export const contraShoreTilePalette: string[] = [
  NES.black,
  NES.greenDark,
  '#887000',
  NES.brownLight,
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.lightGray,
  '#c8a050',
  '#f0d898',
  NES.lava,
];

/** The river's green: the waves' body (slot 9) and the water World floods 7-2 with. */
export const CONTRA_RIVER_WATER = '#145c44';

export const contraRiverTilePalette: string[] = [
  NES.black,
  '#1c2810',
  '#3c5020',
  '#6c8038',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  CONTRA_RIVER_WATER,
  '#60b888',
  NES.lava,
];

export const contraLairTilePalette: string[] = [
  NES.black,
  '#580018',
  '#a01030',
  '#f87898',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  '#f0d8b0',
  '#00a844',
  '#58f898',
  NES.lava,
];

/* ---------- shared shapes ---------- */

/** Courses of blocks `bw` x 8, offset by half a block each course: lit top, shaded bottom row. */
const courses = (bw: number, lit: string, main: string, dark: string, seed: number): string[] =>
  draw(16, 16, (x, y) => {
    const course = y >> 3;
    const bx = (x + (course % 2 ? bw >> 1 : 0)) % bw;
    if (y % 8 === 7 || bx === bw - 1) return '0';
    if (y % 8 === 0) return lit;
    if (y % 8 === 6) return dark;
    return hash(x, y, seed) < 0.08 ? dark : main;
  });

/** Lumpy ground in three shades (`dark`, `main`, `lit`), a few `crack` pixels. */
const lumps = (seed: number, dark: string, main: string, lit: string, crack = '0'): string[] =>
  draw(16, 16, (x, y) => {
    if (hash(x, y, seed) < 0.05) return crack;
    const n = hash(x >> 2, y >> 2, seed + 1) + hash(x >> 1, y >> 1, seed + 2) * 0.5;
    if (n > 1.05) return lit;
    if (n > 0.55) return main;
    return dark;
  });

/** A riveted steel plate: lit top-left edges, a rivet in each corner, a seam across its middle. */
const plate = (seam: boolean): string[] =>
  draw(16, 16, (x, y) => {
    if (x === 15 || y === 15) return '0';
    if (x === 0 || y === 0) return '3';
    if (x === 14 || y === 14) return '1';
    if ((x === 2 || x === 12) && (y === 2 || y === 12)) return '3';
    if ((x === 3 || x === 13) && (y === 3 || y === 13)) return '0';
    if (seam && y === 7) return '1';
    if (seam && y === 8) return '3';
    return '2';
  });

/** A spent block: the stone gone dark, four studs where the `?` was. */
const spent = (seed: number, stud: string): string[] =>
  stoneBlock('2', '1', '0', seed).map((r, y) =>
    y === 3 || y === 11 ? `${r.slice(0, 3)}${stud}${r.slice(4, 11)}${stud}${r.slice(12)}` : r,
  );

/* ---------- 7-1: the snowfield (`contra-snow`) ---------- */

/** Packed snow over frozen ground: drifts lit white, blue shadows, a stone poking through. */
const packedSnow = lumps(301, '3', '9', 'a', '2');

/** A concrete bunker block (the bricks): pale courses, a crust of snow along each top. */
const bunker = courses(8, '9', '3', '2', 303);

/**
 * The pillbox cannons: SMB's Bullet Bill blaster in the snowfield's steel greys (its pale badge
 * kept), snow lying on its barrel.
 */
const pillboxes = (base: Record<string, Rows>): Record<string, Rows> => ({
  'blaster-top': (base['blaster-top'] as Rows).map((r, y) =>
    y === 1 ? '0aaaaaaaaaaaaaa0' : y === 2 ? '0a9aa9aa9aa9aa90' : r,
  ),
  'blaster-base': [...(base['blaster-base'] as Rows)],
});

export function contraSnowTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: packedSnow,
      'castle-brick': packedSnow,
      brick: bunker,
      hard: plate(true),
      used: spent(305, '9'),
      ...pillboxes(base),
    },
    'contra-snow',
  );
}

/* ---------- 7-1-bonus: the base's corridors (`contra-base`) ---------- */

/** Steel deck grating (the floor): a lattice of bars over the dark, lit along its top. */
const grating = draw(16, 16, (x, y) => {
  if (y === 0) return '3';
  if (y === 15) return '0';
  if (x % 4 === 0 || y % 4 === 0) return x % 4 === 0 && y % 4 === 0 ? '3' : '2';
  return '1';
});

/** Bulkhead panels (the bricks): two panels a block, a hazard stripe along the foot. */
const bulkhead = draw(16, 16, (x, y) => {
  if (x === 7 || x === 15 || y === 15) return '0';
  if (y === 0 || x === 0 || x === 8) return '3';
  if (y >= 12 && y <= 13) return (x + y) % 4 < 2 ? 'a' : '0';
  if (y === 14) return '1';
  return hash(x, y, 311) < 0.05 ? '1' : '2';
});

export function contraBaseTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: grating,
      'castle-brick': grating,
      brick: bulkhead,
      hard: plate(false),
      used: spent(313, '9'),
    },
    'contra-base',
  );
}

/* ---------- 7-2's way in and out: the jungle shore (`contra-shore`) ---------- */

/** Beach sand: rippled, a pebble or a shell here and there. */
const sand = draw(16, 16, (x, y) => {
  if (hash(x, y, 321) < 0.04) return '3';
  if (hash(x, y, 322) < 0.03) return '8';
  if ((x + Math.round(Math.sin(y / 2) * 2) + 32) % 8 === 0) return '9';
  return hash(x >> 1, y >> 1, 323) < 0.25 ? '9' : 'a';
});

export function contraShoreTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: sand,
      'castle-brick': sand,
      brick: contraJungleFrames.brick as Rows,
      hard: stoneBlock('3', '2', '1', 325),
      used: spent(327, '9'),
      'tree-top': contraJungleFrames['tree-top'] as Rows,
      'tree-trunk': contraJungleFrames['tree-trunk'] as Rows,
      'blaster-top': base['blaster-top'] as Rows,
      'blaster-base': base['blaster-base'] as Rows,
    },
    'contra-shore',
  );
}

/* ---------- 7-2: the jungle river (`contra-river`) ---------- */

/** Mossy riverbed rock: dark lumps, moss along the cracks. */
const riverbed = lumps(331, '1', '2', '3').map((r, y) =>
  [...r].map((c, x) => (c === '0' && hash(x, y, 332) < 0.6 ? 'a' : c)).join(''),
);

/** The river's surface: a pale green crest over the water, drifting. */
const riverWaves = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const u = (x + shift) % 16;
    const crest = (u >= 2 && u <= 5) || (u >= 10 && u <= 13);
    if (y === 0) return crest ? '8' : '.';
    if (y === 1) return crest || u % 4 === 0 ? 'a' : '.';
    if (y === 2) return 'a';
    if (y === 3) return (u + 1) % 5 === 0 ? 'a' : '9';
    return hash((x + shift) % 16, y, 333) < 0.03 ? 'a' : '9';
  });

export function contraRiverTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: riverbed,
      'castle-brick': riverbed,
      brick: courses(8, '3', '2', '1', 335),
      hard: stoneBlock('3', '2', '1', 337),
      used: spent(339, 'a'),
      'water-0': riverWaves(0),
      'water-1': riverWaves(6),
    },
    'contra-river',
  );
}

/* ---------- 7-4: Red Falcon's alien lair (`contra-lair`) ---------- */

/** Bill's mini game's lair blocks; the spine bridge hangs on SMB's chain in bone. */
export function contraLairTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  const pick = (n: string) => alienLairFrames[n] as Rows;
  return themed(
    {
      ground: pick('ground'),
      'castle-brick': pick('castle-brick'),
      brick: pick('brick'),
      hard: pick('hard'),
      used: pick('used'),
      bridge: pick('bridge'),
      chain: recolour(base.chain as Rows, { '1': '1', '2': '2', '3': '8' }),
    },
    'contra-lair',
  );
}

/* ---------- decor ---------- */

/*
 * Decor palettes keep decor.ts's roles: 1-3 the backdrops' dim shades (dark, main, lit; also the
 * hills and bushes), 4-5 the clouds, 6-8 stone (the end castle; 8 also snow and bone), 9-a wood
 * (trunks) and the backdrops' warm accent. Nothing in them blinks.
 */

const STONE: [string, string, string] = ['#3c3c48', '#6c6c78', '#e0dcc4'];
const WOOD: [string, string] = ['#5c3c20', '#8c6038'];

export const contraSnowDecorPalette: string[] = [
  NES.black,
  '#1c2438',
  '#2c3850',
  '#48587a',
  '#3c4458',
  '#262c3c',
  STONE[0],
  STONE[1],
  '#e8f0fc',
  ...WOOD,
];

export const contraBaseDecorPalette: string[] = [
  NES.black,
  '#0c1410',
  '#18241c',
  '#28382c',
  '#2c2c40',
  '#1c1c2c',
  ...STONE,
  '#401810',
  '#6c5018',
];

export const contraShoreDecorPalette: string[] = [
  NES.black,
  '#003c10',
  '#00702c',
  '#30a048',
  '#2c3458',
  '#1c2038',
  ...STONE,
  ...WOOD,
];

export const contraRiverDecorPalette: string[] = [
  NES.black,
  '#0c2014',
  '#143020',
  '#204430',
  '#2c3458',
  '#1c2038',
  ...STONE,
  ...WOOD,
];

export const contraLairDecorPalette: string[] = [
  NES.black,
  '#200008',
  '#380814',
  '#501020',
  '#2c2c40',
  '#1c1c2c',
  STONE[0],
  STONE[1],
  '#6c5048',
  '#3c1c24',
  '#5c2c34',
];

/**
 * A ridge of far peaks (`w` x `h`): jagged mountains lit along their left slopes, snow (`cap`)
 * on their tops. The ridge wraps round: its left edge meets its right.
 */
const peaks = (w: number, h: number, seed: number, cap: string): string[] => {
  const tops: [number, number][] = [];
  for (let x = -8; x < w + 8; x += 18 + Math.floor(hash(x, 0, seed) * 14))
    tops.push([x, Math.floor(4 + hash(x, 1, seed) * (h * 0.45))]);
  const height = (x: number): number =>
    Math.min(...tops.map(([px, py]) => py + Math.abs(x - px) * (0.9 + hash(px, 2, seed) * 0.4)));
  return draw(w, h, (x, y) => {
    const top = Math.min(height(x), height(x + w), height(x - w));
    if (y < top) return '.';
    const left = height(x - 1) > top;
    if (y < top + 5 + hash(x, 3, seed) * 3) return left ? cap : '3';
    return left && y < top + 12 ? '2' : '1';
  });
};

/**
 * The enemy base far off (96x48): its defense wall with two gun towers and a radar mast, dim
 * against the night; its slit windows dark, never lit.
 */
const farBase = draw(96, 48, (x, y) => {
  // the radar mast and its dish
  if (x >= 46 && x <= 47 && y >= 4 && y < 20) return '3';
  if (y >= 2 && y <= 5 && Math.abs(x - 46.5) <= 6 - (y - 2) * 1.2) return y === 2 ? '3' : '2';
  // two gun towers
  for (const tx of [14, 74]) {
    if (x >= tx && x < tx + 10 && y >= 12) {
      if (y === 12 || x === tx) return '3';
      if (y === 18 && x > tx + 2 && x < tx + 8) return '0';
      return '2';
    }
    if (y >= 9 && y < 12 && x >= tx + 4 && x < tx + 14) return y === 9 ? '3' : '1'; // its barrel
  }
  // the wall, crenellated
  if (y >= 20) {
    if (y < 23) return x % 8 < 5 ? (y === 20 ? '3' : '2') : '.';
    if (y % 6 === 0) return '1';
    return x % 12 === 0 ? '1' : '2';
  }
  return '.';
});

/** A snowy pine (16x48), the snowfield's big tree: dark tiers of needles, snow on each. */
const snowPine = draw(16, 48, (x, y) => {
  const dx = Math.abs(x - 7.5);
  if (y >= 40) return dx < 1.5 ? (x < 8 ? 'a' : '9') : '.';
  const tier = y % 10;
  const half = 1 + tier * 0.7 + Math.floor(y / 10) * 0.6;
  if (dx > half) return '.';
  if (tier <= 1 || (tier === 2 && dx > half - 2)) return '8';
  return x < 8 ? '2' : '1';
});

/** A snow-laden fir (16x32), the snowfield's small tree: a squat cone heavy with snow. */
const snowFir = draw(16, 32, (x, y) => {
  const dx = Math.abs(x - 7.5);
  if (y >= 26) return dx < 1.5 ? 'a' : '.';
  const half = 1 + y * 0.28;
  if (dx > half) return '.';
  if (y % 7 <= 1) return '8';
  return x < 8 ? '2' : '1';
});

/**
 * The base's corridor wall (64x64): dim bulkhead panels, a pair of conduits running along it and
 * a dead lamp housing (dark glass, never lit).
 */
const corridorWall = draw(64, 64, (x, y) => {
  if (y >= 10 && y <= 13) return y === 10 ? '3' : y === 13 ? '1' : '2'; // the conduits
  if (y >= 16 && y <= 17) return y === 16 ? '3' : '1';
  if (y >= 40 && y <= 47 && x >= 28 && x <= 35)
    return x === 28 || y === 40 ? '3' : x === 35 || y === 47 ? '1' : '0';
  if (x % 32 === 31 || y % 32 === 31) return '1';
  if (x % 32 === 0 || y % 32 === 0) return '3';
  if (y % 32 >= 26 && y % 32 <= 28) return (x + y) % 6 < 3 ? '9' : '1';
  return '2';
});

/** The jungle shore's treeline (64x48): palm crowns over a bank of ferns and fronds. */
const shoreJungle = draw(64, 48, (x, y) => {
  // two palms, their trunks leaning
  for (const [px, lean] of [
    [14, 0.12],
    [46, -0.1],
  ] as const) {
    const cx = px + (48 - y) * lean;
    if (y >= 12 && Math.abs(x - cx) <= 1) return y % 4 === 0 ? '1' : '2';
    // the crown: drooping fronds round the top of the trunk
    const top = px + 36 * lean;
    const dx = x - top;
    const dy = y - 10;
    if (Math.abs(dx) < 13 && dy > -6 && dy < 8) {
      const droop = Math.abs(dx) * 0.45 - 4;
      if (Math.abs(dy - droop) < 1.4) return dx < 0 ? '3' : '2';
    }
  }
  // the bank of ferns along the bottom
  const bank = 32 + Math.round(Math.sin(x / 3) * 2 + Math.sin(x / 7) * 3);
  if (y >= bank) return y === bank ? '3' : (x + y) % 5 === 0 ? '1' : '2';
  return '.';
});

/** The lair's ribbed wall (64x64): dark flesh crossed by ribs, a vein winding through it. */
const lairWall = draw(64, 64, (x, y) => {
  const rib = (y + Math.round(Math.sin(x / 5) * 3) + 64) % 16;
  if (rib === 0) return '3';
  if (rib === 1) return '2';
  const vein = Math.abs(x - 32 - Math.round(Math.sin(y / 6) * 10)) < 1;
  if (vein) return '2';
  return hash(x, y, 341) < 0.05 ? '2' : '1';
});

/** The lair's great heart (64x64): a swollen heart, its arteries spreading; still, never pulsing. */
const lairHeart = draw(64, 64, (x, y) => {
  const dx = (x - 31.5) / 22;
  const dy = (y - 34) / 22;
  // a heart curve
  const v = (dx * dx + dy * dy - 1) ** 3 - dx * dx * (-dy) ** 3;
  if (v <= 0) {
    if (
      Math.abs(x - 26 - Math.round(Math.sin(y / 4) * 2)) < 1 ||
      Math.abs(y - 40 - Math.round(Math.sin(x / 5) * 2)) < 1
    )
      return '1';
    return x < 28 && y < 30 ? 'a' : '9';
  }
  // arteries out of its top
  for (const ax of [22, 32, 41]) if (y < 18 && Math.abs(x - ax - (18 - y) * (ax - 32) * 0.05) < 2) return '9';
  return '.';
});

/** World 7's decor frames: the backdrops' pieces and the restyled trees. */
export const contraWorldDecorFrames: Record<string, Rows> = {
  'cs-peaks': peaks(128, 64, 351, '8'),
  'cs-base': farBase,
  'tree-big@contra-snow': snowPine,
  'tree-small@contra-snow': snowFir,
  'cb-wall': corridorWall,
  'csh-jungle': shoreJungle,
  'cl-wall': lairWall,
  'cl-heart': lairHeart,
};
