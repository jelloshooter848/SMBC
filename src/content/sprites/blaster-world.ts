import { NES } from '@engine/gfx/palette';
import { draw, hash, over, recolour, themed, type Rows } from './look-art';
import { stoneBlock } from './castlevania-look';
import { bmDungeonTileFrames } from './sophia-tiles';
import { contraWorldDecorFrames } from './contra-world';

/**
 * World 8 as Sophia's world (0.4.31, campaign only): the looks of World 8's levels in the spirit
 * of an NES tank-and-dungeon game. Original art, nothing traced. 8-4 and its areas are Bowser's
 * real castle and keep SMB's look (Sophia's own underworld areas under it keep `underworld`,
 * sophia-tiles.ts). Every tile frame keeps its tile's collision shape (solid tiles fill their
 * 16x16; the wall and its battlements keep SMB's outline), and `?` blocks, coins, the flagpole,
 * pipes and lava stay SMB's own so they read at a glance.
 *
 * - `bm-forest` (8-1): the Underworld's surface, its first area: mossy stone ruins over dark
 *   forest earth; a forest of gnarled trees and broken columns and arches painted behind under a
 *   starry night (world/theme-backdrop.ts); its trees gnarled, twisted ones.
 * - `bm-techno` (8-2): the techno castle (area 2's castle of machine panels): steel panels with
 *   circuit traces, bolted plate; the Bullet Bill blasters machine cannons (still SMB's shape and
 *   badge, a warning stripe on their barrels). The castle's machine towers are painted behind;
 *   nothing on them blinks.
 * - `bm-ice` (8-3): the frozen ruins (the ice area): packed ice over frozen stone, iced bricks;
 *   the Hammer Bros' castle walls iced stone in SMB's outline, its blasters rimed. Ice spires painted behind under a
 *   starry night; its trees frozen pines.
 * - `bm-vault` (8-1-bonus, 8-2-bonus): Jason's on-foot dungeon seen from the side, the
 *   underground still: the overhead dungeon's steel plates, grilles and riveted blocks
 *   (sophia-tiles.ts's `@bm-dungeon` shapes) in a sea-green steel; a wall of panels and a vent
 *   grille painted behind, still.
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 green, 8 white, 9/a the look's own pair (moss, circuit and warning paint, frost,
 * sludge), b SMB's lava red.
 */

export const bmForestTilePalette: string[] = [
  NES.black,
  '#2c2c24',
  '#605c48',
  '#a09c80',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#1c5c1c',
  '#58a830',
  NES.lava,
];

export const bmTechnoTilePalette: string[] = [
  NES.black,
  '#141c3c',
  '#34487c',
  '#7890c8',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#00a8a8',
  '#fcd860',
  NES.lava,
];

export const bmIceTilePalette: string[] = [
  NES.black,
  '#30507c',
  '#6c9cd0',
  '#b8dcf8',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#88c8e8',
  '#f0fcfc',
  NES.lava,
];

export const bmVaultTilePalette: string[] = [
  NES.black,
  '#0c2c28',
  '#286058',
  '#64ac9c',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#507800',
  '#a8d838',
  NES.lava,
];

/* ---------- shared shapes ---------- */

/** Courses of blocks `bw` x 8, offset by half a block each course: lit top, shaded bottom row. */
const courses = (bw: number, lit: string, main: string, dark: string, seed: number, fleck = dark): string[] =>
  draw(16, 16, (x, y) => {
    const course = y >> 3;
    const bx = (x + (course % 2 ? bw >> 1 : 0)) % bw;
    if (y % 8 === 7 || bx === bw - 1) return '0';
    if (y % 8 === 0) return lit;
    if (y % 8 === 6) return dark;
    return hash(x, y, seed) < 0.08 ? fleck : main;
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

/** A spent block: the stone gone dark, four studs where the `?` was. */
const spent = (seed: number, stud: string): string[] =>
  stoneBlock('2', '1', '0', seed).map((r, y) =>
    y === 3 || y === 11 ? `${r.slice(0, 3)}${stud}${r.slice(4, 11)}${stud}${r.slice(12)}` : r,
  );

/* ---------- 8-1: the forest and stone ruins (`bm-forest`) ---------- */

/** Forest earth over buried ruin stone: dark lumps, moss in the cracks. */
const forestEarth = lumps(801, '1', '2', '3', '9');

/** Mossy ruin courses (the bricks): old stone, moss creeping along the joints. */
const ruinCourses = courses(8, '3', '2', '1', 803, '9').map((r, y) =>
  [...r].map((c, x) => (c === '0' && y % 8 === 7 && hash(x, y, 804) < 0.35 ? 'a' : c)).join(''),
);

/** A carved ruin block (the hard block): SMB's stone bevel, a worn ring carved in its face. */
const carved = stoneBlock('3', '2', '1', 805).map((r, y) =>
  [...r]
    .map((c, x) => {
      const d = Math.hypot(x - 7, y - 7);
      return d > 3.4 && d < 4.6 && c !== '0' ? '1' : c;
    })
    .join(''),
);

export function bmForestTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: forestEarth,
      'castle-brick': forestEarth,
      brick: ruinCourses,
      hard: carved,
      used: spent(807, '9'),
    },
    'bm-forest',
  );
}

/* ---------- 8-2: the techno castle (`bm-techno`) ---------- */

/** A machine panel: bevelled steel, a circuit trace running across it, a bolt in two corners. */
const panel = (seed: number, trace: boolean): string[] =>
  draw(16, 16, (x, y) => {
    if (x === 15 || y === 15) return '0';
    if (x === 0 || y === 0) return '3';
    if (x === 14 || y === 14) return '1';
    if ((x === 2 && y === 2) || (x === 12 && y === 12)) return '8';
    if (trace) {
      const ty = 7 + (x > 7 ? 3 : 0);
      if ((y === ty && x > 2 && x < 13) || (x === 7 && y >= 7 && y <= 10)) return '9';
    }
    return hash(x, y, seed) < 0.04 ? '1' : '2';
  });

/** The castle floor: deck plates in two halves, a vent of slots in each. */
const deck = draw(16, 16, (x, y) => {
  if (y === 0) return '3';
  if (y === 15 || x === 15 || (x === 7 && y > 0)) return '0';
  if (x === 0 || x === 8) return '3';
  if (y >= 4 && y <= 11 && y % 2 === 0 && x % 8 >= 2 && x % 8 <= 5) return '0';
  return y === 14 ? '1' : '2';
});

/** The machine cannons: SMB's blaster in the castle's steel, a warning stripe round its muzzle. */
const machineCannons = (base: Record<string, Rows>): Record<string, Rows> => ({
  'blaster-top': (base['blaster-top'] as Rows).map((r, y) =>
    y === 1 ? '0aaaaaaaaaaaaaa0' : y === 2 ? '0a0aa0aa0aa0aa00' : r,
  ),
  'blaster-base': [...(base['blaster-base'] as Rows)],
});

export function bmTechnoTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: deck,
      'castle-brick': deck,
      brick: panel(811, true),
      hard: panel(813, false),
      used: spent(815, '9'),
      ...machineCannons(base),
    },
    'bm-techno',
  );
}

/* ---------- 8-3: the frozen ruins (`bm-ice`) ---------- */

/** Packed ice over frozen stone: pale drifts, blue shadows, a frost glint here and there. */
const packedIce = lumps(821, '2', '9', 'a', '3');

/** Iced stone courses: the ruins' blocks, frost along each top. */
const icedCourses = courses(8, 'a', '2', '1', 823, '9');

/** The castle wall in ice: SMB's outline (the battlements' gaps kept), iced stone courses. */
const icedWall = (base: Record<string, Rows>): Record<string, Rows> => {
  const top = (base['wall-top'] as Rows).slice(0, 4).map((r) => recolour([r], { '2': 'a', '1': '9' })[0]!);
  return { wall: icedCourses, 'wall-top': over(top, icedCourses) };
};

export function bmIceTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: packedIce,
      'castle-brick': packedIce,
      brick: icedCourses,
      hard: stoneBlock('a', '9', '2', 825),
      used: spent(827, 'a'),
      ...icedWall(base),
      // its blasters frozen: SMB's cannon, rime along the barrel's top
      'blaster-top': (base['blaster-top'] as Rows).map((r, y) =>
        y === 1 ? '0aaaaaaaaaaaaaa0' : y === 2 ? '0a9aa9aa9aa9aa90' : r,
      ),
      'blaster-base': [...(base['blaster-base'] as Rows)],
    },
    'bm-ice',
  );
}

/* ---------- the coin rooms: Jason's dungeon in side view (`bm-vault`) ---------- */

export function bmVaultTileFrames(): Record<string, Rows> {
  const pick = (n: string) => bmDungeonTileFrames[n] as Rows;
  return themed(
    {
      ground: pick('ground'),
      'castle-brick': pick('castle-brick'),
      brick: pick('brick'),
      hard: pick('hard'),
      used: pick('used'),
    },
    'bm-vault',
  );
}

/* ---------- decor ---------- */

/*
 * Decor palettes keep decor.ts's roles: 1-3 the backdrops' dim shades (dark, main, lit; also the
 * hills and bushes), 4-5 the clouds, 6-8 stone (the end castle; 8 also snow and frost), 9-a wood
 * (trunks) and the backdrops' warm accent. Nothing in them blinks.
 */

const STONE: [string, string, string] = ['#3c3c48', '#6c6c78', '#e0dcc4'];
const WOOD: [string, string] = ['#4c3020', '#7c5434'];

export const bmForestDecorPalette: string[] = [
  NES.black,
  '#0c1c10',
  '#18301c',
  '#2c4830',
  '#30344c',
  '#1c2034',
  ...STONE,
  ...WOOD,
];

export const bmTechnoDecorPalette: string[] = [
  NES.black,
  '#0c1024',
  '#18203c',
  '#283458',
  '#2c2c48',
  '#1c1c30',
  ...STONE,
  '#104848',
  '#5c4818',
];

export const bmIceDecorPalette: string[] = [
  NES.black,
  '#18284c',
  '#284070',
  '#4c6c9c',
  '#384868',
  '#202c44',
  STONE[0],
  STONE[1],
  '#e8f4fc',
  ...WOOD,
];

export const bmVaultDecorPalette: string[] = [
  NES.black,
  '#081814',
  '#102820',
  '#1c3c34',
  '#2c2c40',
  '#1c1c2c',
  ...STONE,
  '#283c10',
  '#40581c',
];

/** The far forest (64x48): a canopy of round, ragged crowns over dark trunks. */
const farForest = draw(64, 48, (x, y) => {
  const crown = 14 + Math.round(Math.sin(x / 4) * 3 + Math.sin(x / 9 + 1) * 4);
  if (y < crown) return '.';
  if (y < crown + 2) return '3';
  if (y > 30 && (x % 16 === 5 || x % 16 === 6)) return '1';
  return hash(x >> 1, y >> 1, 831) < 0.3 ? '1' : '2';
});

/**
 * The stone ruins (96x48): a broken arch, two snapped columns and fallen blocks, dim against the
 * night.
 */
const ruins = draw(96, 48, (x, y) => {
  // the arch: two piers and the half of its curve still standing
  for (const px of [10, 38])
    if (x >= px && x < px + 6 && y >= 16) return x === px ? '8' : y % 8 === 0 ? '6' : '7';
  const ax = x - 27;
  const ay = y - 22;
  const r = Math.hypot(ax, ay * 1.1);
  if (ay < 0 && r > 11 && r < 17 && x < 34) return r < 12 ? '8' : '7';
  // the columns, snapped at different heights, fluted
  for (const [cx, top] of [
    [58, 10],
    [76, 22],
  ] as const) {
    if (x >= cx && x < cx + 7 && y >= top) {
      if (y === top) return hash(x, y, 833) < 0.5 ? '.' : '8';
      return x === cx ? '8' : x % 2 === 0 ? '6' : '7';
    }
  }
  // fallen blocks at their feet
  if (y >= 42 && ((x >= 48 && x < 56) || (x >= 86 && x < 94))) return y === 42 ? '8' : '6';
  return '.';
});

/** A gnarled tree (16x48), the forest's big tree: a twisted trunk, a ragged dark crown. */
const gnarledBig = draw(16, 48, (x, y) => {
  const cx = 7.5 + Math.sin(y / 5) * 1.5;
  if (y >= 22) {
    if (Math.abs(x - cx) < 1.6) return x < cx ? 'a' : '9';
    if (y > 44 && Math.abs(x - 7.5) < 3.5 + (y - 44)) return '9'; // its roots
    return '.';
  }
  const d = Math.hypot((x - 7.5) / 7.5, (y - 12) / 11);
  if (d > 1 || hash(x, y, 841) < 0.12 * d) return '.';
  if (d > 0.85) return '1';
  return hash(x >> 1, y >> 1, 842) < 0.35 ? '3' : '2';
});

/** A gnarled sapling (16x32), the forest's small tree. */
const gnarledSmall = draw(16, 32, (x, y) => {
  const cx = 7.5 + Math.sin(y / 4) * 1;
  if (y >= 16) return Math.abs(x - cx) < 1.2 ? (x < cx ? 'a' : '9') : '.';
  const d = Math.hypot((x - 7.5) / 6.5, (y - 8) / 8);
  if (d > 1 || hash(x, y, 843) < 0.12 * d) return '.';
  if (d > 0.82) return '1';
  return hash(x >> 1, y >> 1, 844) < 0.35 ? '3' : '2';
});

/**
 * The techno castle (128x64): machine towers of stacked panels joined by pipes, their windows dark
 * and never lit, an antenna on the tallest.
 */
const technoCastle = draw(128, 64, (x, y) => {
  for (const [tx, w, top] of [
    [8, 20, 14],
    [44, 28, 4],
    [90, 22, 20],
  ] as const) {
    if (x >= tx && x < tx + w && y >= top) {
      if (y === top || x === tx) return '3';
      if ((y - top) % 10 === 5 && x > tx + 3 && x < tx + w - 3 && (x - tx) % 6 < 3) return '0'; // windows
      if ((x - tx) % 10 === 0) return '1';
      return '2';
    }
  }
  if (x === 57 && y < 4) return '3'; // the antenna
  // the pipes between the towers
  if ((y === 34 || y === 37) && ((x >= 28 && x < 44) || (x >= 72 && x < 90))) return '3';
  if (y > 34 && y < 37 && ((x >= 28 && x < 44) || (x >= 72 && x < 90))) return '9';
  // a low wall along the foot
  if (y >= 52) return y === 52 ? '3' : x % 16 === 0 ? '1' : '2';
  return '.';
});

/** Ice spires (128x64): jagged frozen crags, lit along one face, frost on their tips. */
const iceSpires = draw(128, 64, (x, y) => {
  const tops: [number, number, number][] = [];
  for (let k = 0; k < 9; k++)
    tops.push([
      k * 16 + Math.floor(hash(k, 0, 851) * 8),
      6 + Math.floor(hash(k, 1, 851) * 30),
      0.7 + hash(k, 2, 851) * 0.6,
    ]);
  let best = Infinity;
  let lit = false;
  for (const [px, py, slope] of [
    ...tops,
    ...tops.map(([a, b, c]) => [a + 128, b, c] as [number, number, number]),
    ...tops.map(([a, b, c]) => [a - 128, b, c] as [number, number, number]),
  ]) {
    const h = py + (Math.abs(x - px) / slope) * 1.6;
    if (h < best) {
      best = h;
      lit = x < px;
    }
  }
  if (y < best) return '.';
  if (y < best + 3) return '8';
  return lit ? '3' : y > 52 ? '1' : '2';
});

/** The dungeon wall (64x64): riveted panels in a grid and a vent grille, dim; nothing lit. */
const vaultWall = draw(64, 64, (x, y) => {
  if (x >= 20 && x <= 43 && y >= 36 && y <= 51) {
    if (x === 20 || y === 36) return '3';
    if (x === 43 || y === 51) return '0';
    return y % 3 === 0 ? '0' : '1';
  }
  if (x % 32 === 31 || y % 32 === 31) return '0';
  if (x % 32 === 0 || y % 32 === 0) return '3';
  if ((x % 32 === 3 || x % 32 === 28) && (y % 32 === 3 || y % 32 === 28)) return '3';
  return '2';
});

/** World 8's decor frames: the backdrops' pieces and the restyled trees. */
export const blasterWorldDecorFrames: Record<string, Rows> = {
  'bmf-forest': farForest,
  'bmf-ruins': ruins,
  'tree-big@bm-forest': gnarledBig,
  'tree-small@bm-forest': gnarledSmall,
  'bmt-castle': technoCastle,
  'bmi-peaks': iceSpires,
  'tree-big@bm-ice': contraWorldDecorFrames['tree-big@contra-snow'] as Rows,
  'tree-small@bm-ice': contraWorldDecorFrames['tree-small@contra-snow'] as Rows,
  'bmv-wall': vaultWall,
};
