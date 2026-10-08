import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';
import { megamanStageArt as mm } from './megaman-look';

/**
 * World 3 as Mega Man's world (0.4.26, campaign only): the Mega Man 2-style stage looks of the
 * levels past 3-1 (3-1 and its sky keep the night stage, megaman-look.ts; the space station its
 * own steel). Original art in the spirit of the NES Mega Man 2, nothing traced. Every tile frame
 * keeps its tile's collision shape (solid tiles fill their 16x16; a bridge's deck is its top rows;
 * a chain or a strut is scenery), and `?` blocks, coins, the flagpole and lava stay SMB's own so
 * they read at a glance. Where a shape fits, it is the night stage's (`megamanStageArt`) drawn in
 * the look's own palette.
 *
 * - `megaman-metal` (3-1's bonus room): a Metal Man-style factory. Conveyor-belt floor over rusted
 *   steel, braced crates for bricks, the station's grey steel pipes; big gears turn on the back
 *   wall ([campaign-decor] `mm-gear`). The underground still (its enemies, its solid floors).
 * - `megaman-wood` (3-2): a Wood Man-style forest. A floor of logs, plank bricks, log ends for the
 *   staircase blocks; its trees are tall robot-forest trees, and a dark forest of trunks under a
 *   leaf canopy is painted behind the level (world/theme-backdrop.ts).
 * - `megaman-air` (3-3): Air Man-style sky. Its treetops are cloud platforms on steel pylons, its
 *   floor steel decking, under a deep daylight blue that the lifts' planks and the balance lifts'
 *   ropes stand out against.
 * - `megaman-fortress` (3-4): Wily's fortress, in the castle family. Teal steel panels and bolted
 *   plates with red warning strips, a girder bridge and a steel chain over SMB's lava; a wall of
 *   machinery with skull plates is painted behind it.
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 green, 8 white, 9/a the look's own pair (steel greys, leaf greens, cloud shades), b
 * SMB's lava red.
 */

export const megamanMetalTilePalette: string[] = [
  NES.black,
  '#5c1c00',
  '#a84400',
  '#e48c4c',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  NES.gray,
  NES.lightGray,
  NES.lava,
];

export const megamanWoodTilePalette: string[] = [
  NES.black,
  '#4c2c00',
  '#8c5418',
  '#d49048',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  NES.greenDark,
  NES.green,
  NES.lava,
];

/** Air Man's sky: a deep daylight blue (SKY in world/tile-render.ts). */
export const AIR_SKY = '#2858d8';

export const megamanAirTilePalette: string[] = [
  NES.black,
  '#305070',
  '#7898b8',
  '#c8e0f8',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#88b0f0',
  '#d8e8fc',
  NES.lava,
];

export const megamanFortressTilePalette: string[] = [
  NES.black,
  '#004040',
  '#008080',
  '#60d0c8',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  NES.gray,
  NES.lightGray,
  NES.lava,
];

/* ---------- shared ---------- */

const PIPES = [
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
];

/** SMB's pipes in grey steel (slots 9/a), ring joints down the bodies as the night stage's. */
const steelPipes = (base: Record<string, Rows>): Record<string, Rows> =>
  Object.fromEntries(
    PIPES.map((n) => {
      const rows = base[n] as Rows;
      const ringed = n.includes('body') ? mm.ringed(rows) : rows;
      return [n, recolour(ringed, { '5': '9', '6': 'a' })];
    }),
  );

/* ---------- 3-1's bonus room: Metal Man's factory (`megaman-metal`) ---------- */

/** A conveyor belt over rusted steel: grey tread with dark cleats, rivets on the plate below. */
const groundMetal = draw(16, 16, (x, y) => {
  if (y === 15 || x === 15) return '0';
  if (y === 0) return 'a';
  if (y < 5) return (x + 2 * y) % 6 === 0 ? '0' : y === 4 ? '9' : 'a';
  if (y === 5) return '0';
  if (y === 6) return '3';
  if ((x === 3 || x === 12) && (y === 9 || y === 13)) return '3';
  if (x === 0) return '3';
  if (x === 14 || y === 14) return '1';
  return '2';
});

/** A braced crate: lit rim, an X brace across its face. */
const brickMetal = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '3';
  if (x === 14 || y === 14) return '1';
  if (x === y || x === 14 - y) return '3';
  if (x === y + 1 || x === 15 - y) return '1';
  return '2';
});

export function megamanMetalTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: groundMetal,
      'castle-brick': mm.panels,
      brick: brickMetal,
      hard: mm.hard,
      used: mm.used,
      ...steelPipes(base),
    },
    'megaman-metal',
  );
}

/* ---------- 3-2: Wood Man's forest (`megaman-wood`) ---------- */

/** A floor of stacked logs: each 8 px course a log, lit on top, grain streaks, a ring end. */
const groundWood = draw(16, 16, (x, y) => {
  const course = y >> 3;
  const ly = y & 7;
  const end = (x + (course ? 8 : 0)) % 16;
  if (ly === 7) return '0';
  if (end === 15) return '0';
  if (end === 14 && ly > 0 && ly < 6) return ly === 3 ? '1' : '3';
  if (ly === 0) return '3';
  if (ly === 6) return '1';
  return hash(x >> 2, y, 71) < 0.18 ? '1' : '2';
});

/** A log end (the staircase blocks): rings around a dark heart, bark round the rim. */
const hardWood = draw(16, 16, (x, y) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 8.2) return '0';
  if (d > 7) return '1';
  if (d < 1.5) return '1';
  if (hash(x, y, 73) < 0.04) return '1';
  return Math.floor(d) % 2 ? '3' : '2';
});

export function megamanWoodTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: groundWood,
      'castle-brick': groundWood,
      brick: mm.brick,
      hard: hardWood,
      used: mm.used,
    },
    'megaman-wood',
  );
}

/* ---------- 3-3: Air Man's sky (`megaman-air`) ---------- */

/**
 * A cloud platform: white puffs lit up-left over a cloud body, a steel rim with two bolts under
 * it. Solid all through (the treetop's whole cell is its ledge), its top edge flat.
 */
const cloudPlatform = draw(16, 16, (x, y) => {
  if (y === 15) return '0';
  if (y >= 12) return y === 12 ? '3' : (x === 3 || x === 12) && y === 13 ? '1' : '2';
  if (y === 11) return '9';
  if (y === 0) return '8';
  for (const cx of [3.5, 11.5]) {
    const dx = x - cx;
    const dy = y - 5;
    const d = Math.hypot(dx, dy * 1.2);
    if (d <= 4.5) return dx + dy < -1.5 ? '8' : d > 3.6 && dx + dy > 1 ? '9' : 'a';
  }
  return y > 8 ? '9' : 'a';
});

export function megamanAirTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: mm.ground,
      'castle-brick': mm.panels,
      brick: mm.brick,
      hard: recolour(mm.hard, { b: '9' }),
      used: mm.used,
      'tree-top': cloudPlatform,
      'tree-trunk': mm.treeTrunk,
      bridge: mm.bridge,
    },
    'megaman-air',
  );
}

/* ---------- 3-4: Wily's fortress (`megaman-fortress`) ---------- */

/** The fortress's steel chain: upright and crosswise links in grey. */
const chainFortress = draw(16, 16, (x, y) => {
  const ly = y % 8;
  if (ly < 5) {
    const d = Math.hypot((x - 7.5) / 2.5, (ly - 2) / 2.6);
    if (d <= 1 && d > 0.45) return x < 8 ? 'a' : '9';
    if (d > 1 && d <= 1.35) return '0';
    return '.';
  }
  if (x >= 6 && x <= 9) return ly === 6 ? (x < 8 ? 'a' : '9') : '0';
  return '.';
});

export function megamanFortressTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: mm.panels,
      'castle-brick': mm.panels,
      brick: mm.brick,
      hard: mm.hard,
      used: mm.used,
      bridge: mm.bridge,
      chain: chainFortress,
    },
    'megaman-fortress',
  );
}

/* ---------- decor ---------- */

/*
 * Decor palettes keep decor.ts's roles: 1-3 hill and bush greens (here each look's own background
 * shades), 4-5 cloud fill and outline, 6-8 a castle's mortar, brick and merlon tops (steel greys,
 * so 3-2's and 3-3's castles read as fortresses), 9-a wood.
 */

/** The factory's: 1-3 the gears' dim rust, so they stay behind the level. */
export const megamanMetalDecorPalette: string[] = [
  NES.black,
  '#2c0c00',
  '#5c2400',
  '#8c4418',
  NES.darkGray,
  NES.black,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.gray,
  NES.lightGray,
];

/** The forest's: 1-3 leaf greens, its clouds leaf canopy, 9-a bark. */
export const megamanWoodDecorPalette: string[] = [
  NES.black,
  '#002800',
  '#006800',
  '#38a838',
  '#005800',
  '#002800',
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  '#4c2c08',
  '#8c5418',
];

/** The sky's: white clouds outlined in pale blue. */
export const megamanAirDecorPalette: string[] = [
  NES.black,
  '#305070',
  '#7898b8',
  '#c8e0f8',
  NES.white,
  NES.skyLight,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.gray,
  NES.lightGray,
];

/**
 * The fortress's: 1-3 the machinery wall's dim teal, 4-5 the skulls' dim bone (darker than the
 * solid panels' teal, so the backdrop never reads as a block), 9-a their eyes' red.
 */
export const megamanFortressDecorPalette: string[] = [
  NES.black,
  '#001818',
  '#002c2c',
  '#004848',
  '#444444',
  '#545454',
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  '#580000',
  NES.redDark,
];

/** A big gear (32x32) in the factory's dim rust: twelve teeth, a lit rim, six holes round its hub. */
const gear = draw(32, 32, (x, y) => {
  const dx = x - 15.5;
  const dy = y - 15.5;
  const d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  const tooth = Math.cos(a * 12) > 0.2;
  if (d > 15.5 || (d > 12.5 && !tooth)) return '.';
  if (d > 12.5) return d > 14.5 ? '1' : '2';
  if (d > 11.5) return dx + dy < 0 ? '3' : '1';
  if (d < 2.5) return '0';
  if (d < 4) return '3';
  const hole = Math.hypot(d - 8, 0) < 2 && Math.cos(a * 6) > 0.6;
  if (hole) return '0';
  return '2';
});

/** A robot-forest tree: a straight trunk under a squared leaf crown, a bolt plate on the trunk. */
const robotTree = (h: number): string[] =>
  draw(16, h, (x, y) => {
    const crown = 14;
    if (y < crown) {
      const inset = y === 0 || y === crown - 1 ? 2 : y === 1 || y === crown - 2 ? 1 : 0;
      if (x < inset || x > 15 - inset) return '.';
      if (x === inset || x === 15 - inset || y === 0 || y === crown - 1) return '1';
      if ((x + y) % 5 === 0) return '1';
      return x + y < 12 ? '3' : '2';
    }
    if (x < 5 || x > 10) return '.';
    if (x === 5 || x === 10) return '0';
    if ((y - crown) % 10 === 4 && x > 6 && x < 9) return '8';
    return x < 8 ? 'a' : '9';
  });

/** The forest behind 3-2 (32x32, tiles down): a dark trunk with bark streaks in the gloom. */
const forestTrunk = draw(32, 32, (x, y) => {
  if (x < 10 || x > 21) return '.';
  if (x === 10 || x === 21) return '1';
  return hash(x, y >> 2, 77) < 0.2 ? '1' : '9';
});

/** The forest's canopy band (64x32): a mass of dark leaves, its lower edge ragged. */
const forestCanopy = draw(64, 32, (x, y) => {
  const edge = 20 + Math.round(4 * Math.sin(x / 5) + 3 * Math.sin(x / 2.3));
  if (y > edge) return '.';
  if (y === edge) return '1';
  return hash(x >> 1, y >> 1, 79) < 0.3 ? '1' : '2';
});

/** Wily's machinery wall (32x32): dim panels with seams and vents, a pipe along the bottom. */
const fortressWall = draw(32, 32, (x, y) => {
  if (y >= 24 && y <= 28) return y === 24 ? '3' : y === 28 ? '1' : '2';
  if (x % 16 === 15 || y % 12 === 11) return '1';
  if (x % 16 === 0 || y % 12 === 0) return '3';
  if (y % 12 >= 4 && y % 12 <= 7 && x % 16 >= 4 && x % 16 <= 11 && y % 2 === 0) return '1';
  return '2';
});

/**
 * A skull (32x32) on the fortress wall: an original skull in dim bone, outlined, its eyes a dim,
 * steady red. No plate round it, so it reads as the wall's, never a block to stand on.
 */
const skullPlate = draw(32, 32, (x, y) => {
  const dx = x - 15.5;
  const head = Math.hypot(dx / 10.5, (y - 13) / 10);
  const jaw = y >= 19 && y <= 26 && Math.abs(dx) <= 7;
  if (head > 1.12 && !jaw) return '.';
  if ((head > 1 && !jaw) || (jaw && y > 21 && Math.abs(dx) >= 6.5)) return '0';
  // eyes: two round sockets, a dim red light in each
  for (const ex of [-4.5, 4.5]) {
    const e = Math.hypot(dx - ex, y - 13);
    if (e < 1.6) return 'a';
    if (e < 3.2) return '9';
    if (e < 3.8) return '0';
  }
  // the nose and the teeth
  if (y >= 17 && y <= 19 && Math.abs(dx) <= 1.5 - (19 - y) * 0.5) return '0';
  if (y >= 22 && y <= 25) return Math.abs(dx) <= 6 && Math.round(dx + 0.5) % 3 === 0 ? '0' : '5';
  if (y === 21 || y === 26) return '0';
  return dx < -3 && y < 12 ? '5' : '4';
});

/**
 * World 3's decor frames: the factory's gears, the forest's robot trees (its `tree-big` and
 * `tree-small`, 16x48 and 16x32) and its backdrop's trunk and canopy, the fortress's wall and
 * skull plates (its backdrop).
 */
export const megamanWorldDecorFrames: Record<string, Rows> = {
  'mm-gear': gear,
  'tree-big@megaman-wood': robotTree(48),
  'tree-small@megaman-wood': robotTree(32),
  'mmw-trunk': forestTrunk,
  'mmw-canopy': forestCanopy,
  'mmf-wall': fortressWall,
  'mmf-skull': skullPlate,
};
