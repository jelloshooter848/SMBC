import { NES } from '@engine/gfx/palette';
import { draw, hash, recolour, themed, type Rows } from './look-art';
import { tourianArt as tn } from './tourian-look';

/**
 * World 4 as Samus's world, Zebes (0.4.27, campaign only): the Metroid-style looks of World 4's
 * levels past 4-2's Brinstar (4-2 keeps its 0.4.12 look, brinstar-look.ts; Samus's cavern its own
 * rock and Larry's airship its SMB3 look; the bonus rooms reuse Brinstar). Original art in the
 * spirit of the NES Metroid, nothing traced. Every tile frame keeps its tile's collision shape
 * (solid tiles fill their 16x16; a bridge's deck is its top rows; a chain or a stalk is scenery),
 * and `?` blocks, coins, the flagpole and lava stay SMB's own so they read at a glance.
 *
 * - `crateria` (4-1, 4-2's way in and out and the vine's warp room): Zebes's surface. Mauve
 *   crag rock with teal lichen, Chozo ruin bricks, steel vent blocks, steel pipes, under a dusky
 *   storm sky with far rock spires painted behind (world/theme-backdrop.ts); 4-2-warp's mushroom
 *   platform is an alien stalk.
 * - `norfair` (4-3): Norfair. Red bubble rock, hot pipe sections for the hard blocks, and its
 *   mushroom platforms as bubble platforms on hot stalks, under a dark red sky the lifts' cream
 *   planks and the balance lifts' ropes stand out against.
 * - `tourian-lair` (4-4): Tourian, Mother Brain's lair, in the castle family. ZEBES ESCAPE's
 *   Tourian panels and tubes (tourian-look.ts) in a darker green, a grate bridge and a red cable
 *   over SMB's lava; dim machinery and glass tubes are painted behind (world/theme-backdrop.ts).
 *
 * Tile palettes keep the 12 shared roles (tiles.ts): 1-3 the blocks (dark, main, lit), 4/7 SMB's
 * gold, 5/6 pipes, 8 white, 9/a the look's own pair (lichen teal, hot-pipe orange, warning red),
 * b SMB's lava red.
 */

export const crateriaTilePalette: string[] = [
  NES.black,
  '#3c2838',
  '#7c5868',
  '#bc94a0',
  NES.yellow,
  '#4c7c74',
  '#a0d0c0',
  NES.yellowLight,
  NES.white,
  '#1c6c5c',
  '#4cb89c',
  NES.lava,
];

export const norfairTilePalette: string[] = [
  NES.black,
  '#580c00',
  '#a83010',
  '#f07838',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#c03800',
  '#fcb040',
  NES.lava,
];

export const tourianLairTilePalette: string[] = [
  NES.black,
  '#003020',
  '#207850',
  '#78d0a0',
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#a80020',
  '#f83860',
  NES.lava,
];

/** Zebes's surface sky: a dusky storm indigo (SKY in world/tile-render.ts). */
export const CRATERIA_SKY = '#18183c';
/** Norfair's sky: a dark, hot red. */
export const NORFAIR_SKY = '#300808';

/* ---------- shared ---------- */

/** A bevelled plate: lit top and left, shaded bottom and right, a black seam. */
const plate = (fill: string) =>
  draw(16, 16, (x, y) => {
    if (x === 15 || y === 15) return '0';
    if (x === 0 || y === 0) return '3';
    if (x === 14 || y === 14) return '1';
    return fill;
  });

/** A stalk under a platform cap (not solid): a segmented column, lit left, a ring every 5 px. */
const stalk = (lit: string, main: string, ring: string) =>
  draw(16, 16, (x, y) => {
    if (x < 4 || x > 11) return '.';
    if (x === 4 || x === 11) return '0';
    if (y % 5 === 2) return ring;
    return x === 5 ? lit : x === 10 ? '1' : main;
  });

/* ---------- Zebes's surface (`crateria`) ---------- */

/** Crag rock: two courses of angular plates, lit up-left, teal lichen on some tops. */
const groundCrateria = draw(16, 16, (x, y) => {
  const course = y >> 3;
  const ly = y & 7;
  const seams = course ? [2, 11] : [6, 15];
  if (ly === 7 || seams.includes(x)) return '0';
  if (ly === 0) return hash(x, course, 41) < 0.3 ? 'a' : '3';
  if (seams.includes((x + 15) % 16)) return '3';
  if (ly === 6 || seams.includes((x + 1) % 16)) return '1';
  if (ly === 1 && hash(x, course, 41) < 0.3) return '9';
  return hash(x, y, 43) < 0.12 ? '1' : '2';
});

/** Chozo ruin bricks: dressed stone in running courses, a carved ring glowing teal on the upper. */
const brickCrateria = draw(16, 16, (x, y) => {
  const course = y >> 3;
  const ly = y & 7;
  const bx = (x + (course ? 8 : 0)) % 16;
  if (ly === 7 || bx === 15) return '0';
  if (ly === 0 || bx === 0) return '3';
  if (ly === 6 || bx === 14) return '1';
  if (!course) {
    const d = Math.hypot(x - 7.5, ly - 3.5);
    if (d > 1.6 && d < 2.8) return 'a';
  }
  return '2';
});

/** A steel vent block: a lit bevel round a round vent, its slats dark. */
const hardCrateria = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (x === 0 || y === 0) return '3';
  if (x === 14 || y === 14) return '1';
  const d = Math.hypot(x - 7, y - 7);
  if (d < 5.2 && d > 4.2) return '0';
  if (d <= 4.2) return y % 2 ? '0' : '1';
  if ((x === 2 || x === 12) && (y === 2 || y === 12)) return '3';
  return '2';
});

/** An alien stalk's cap: a broad teal cap with paler bumps, outlined, its underside dark. */
const capCrateria = draw(16, 16, (x, y) => {
  if (y === 0 || y === 15) return '0';
  if (y === 14) return '1';
  for (const [cx, cy] of [
    [3, 4],
    [11, 3],
    [7, 9],
    [14, 10],
    [1, 11],
  ] as const) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < 1.2) return '3';
    if (d < 2.2) return 'a';
  }
  return '9';
});

export function crateriaTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: groundCrateria,
      'castle-brick': groundCrateria,
      brick: brickCrateria,
      hard: hardCrateria,
      used: plate('1'),
      'mushroom-top': capCrateria,
      'mushroom-stem': stalk('a', '9', '1'),
    },
    'crateria',
  );
}

/* ---------- 4-3: Norfair (`norfair`) ---------- */

type Bubble = readonly [number, number, number];

/** Round bubbles on a 16x16 torus over `base`, rimmed black, lit up-left, a glint in each. */
const bubbleRock = (list: readonly Bubble[], base: (x: number, y: number) => string) =>
  draw(16, 16, (x, y) => {
    for (const [cx, cy, r] of list)
      for (const oy of [-16, 0, 16])
        for (const ox of [-16, 0, 16]) {
          const dx = x - (cx + ox);
          const dy = y - (cy + oy);
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          if (d > r - 1) return '0';
          if (dx + dy < -r * 0.5 && d > r - 2.2) return '3';
          if (dx < -r * 0.2 && dy < -r * 0.2 && d < 1.2) return 'a';
          return '2';
        }
    return base(x, y);
  });

const ROCK: readonly Bubble[] = [
  [4, 4, 3.6],
  [12, 3, 2.8],
  [8.5, 11, 4],
  [1.5, 12.5, 2.2],
  [14.5, 12, 2],
];

/** Norfair's bubble rock: orange bubbles packed in a dark red crust. */
const groundNorfair = bubbleRock(ROCK, (x, y) => (hash(x, y, 51) < 0.08 ? '0' : '1'));

/** Cracked bubble rock (the bricks): the crust split by a black seam into four. */
const brickNorfair = draw(16, 16, (x, y) =>
  x === 15 || y === 15 || (y === 7 && x < 15) || x === (y < 8 ? 7 : 3)
    ? '0'
    : (groundNorfair[y]![x] as string),
);

/** A length of hot pipe (the hard blocks): glowing along the top, a dark band at each joint. */
const hardNorfair = draw(16, 16, (x, y) => {
  if (y === 0 || y === 15) return '0';
  if (x === 0 || x === 8) return '0';
  if (x === 1 || x === 9) return y < 12 ? 'a' : '9';
  if (x === 7 || x === 15) return '1';
  if (y < 4) return 'a';
  if (y < 11) return '9';
  return '1';
});

/** A bubble platform: three lit bubbles on a crust, outlined, its flat top solid all through. */
const capNorfair = draw(16, 16, (x, y) => {
  if (y === 0 || y === 15) return '0';
  if (y === 14) return '1';
  for (const [cx, cy, r] of [
    [3.5, 5, 3.6],
    [11.5, 5, 3.6],
    [7.5, 10, 3.2],
  ] as const) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > r) continue;
    if (d > r - 1) return '0';
    if (dx + dy < -r * 0.5) return '3';
    return '2';
  }
  return '1';
});

export function norfairTileFrames(): Record<string, Rows> {
  return themed(
    {
      ground: groundNorfair,
      'castle-brick': groundNorfair,
      brick: brickNorfair,
      hard: hardNorfair,
      used: plate('1'),
      'mushroom-top': capNorfair,
      'mushroom-stem': stalk('a', '9', '0'),
    },
    'norfair',
  );
}

/* ---------- 4-4: Tourian, Mother Brain's lair (`tourian-lair`) ---------- */

/** A grate bridge: a lit deck over a slotted grate, red lights under it. */
const bridgeTourian = draw(16, 16, (x, y) => {
  if (y === 0 || y === 6) return '0';
  if (y === 1) return '3';
  if (y >= 2 && y <= 4) return x % 4 === 3 ? '0' : '2';
  if (y === 5) return '1';
  if (y === 7 && (x === 3 || x === 11)) return '9';
  return '.';
});

/** The bridge's cable: Tourian's chain links in a red sheath. */
const chainTourian = (base: Rows): string[] => recolour(base, { '3': 'a' });

export function tourianLairTileFrames(base: Record<string, Rows>): Record<string, Rows> {
  return themed(
    {
      ground: tn.panel,
      'castle-brick': tn.panel,
      brick: tn.cracked,
      hard: tn.tube,
      used: tn.spent,
      bridge: bridgeTourian,
      chain: chainTourian(base.chain as Rows),
    },
    'tourian-lair',
  );
}

/* ---------- decor ---------- */

/*
 * Decor palettes keep decor.ts's roles: 1-3 hill and bush shades (each look's own dim background
 * tones), 4-5 cloud fill and outline, 6-8 a castle's mortar, brick and merlon tops (Chozo stone),
 * 9-a wood.
 */

/** Zebes's surface: dim violet mounds and far spires, storm clouds, grey Chozo stone. */
export const crateriaDecorPalette: string[] = [
  NES.black,
  '#2c1c34',
  '#4c3458',
  '#6c5078',
  '#5c5c78',
  '#30304c',
  '#3c3c48',
  '#6c6c80',
  '#9c9cb0',
  '#4c2c08',
  '#8c5418',
];

/** Norfair: dim lava-rock mounds, smoke for clouds, red stone. */
export const norfairDecorPalette: string[] = [
  NES.black,
  '#3c0800',
  '#641400',
  '#8c2c08',
  '#5c3030',
  '#2c1010',
  '#401010',
  '#782818',
  '#a84828',
  '#4c2c08',
  '#8c5418',
];

/**
 * Tourian's: 1-3 the machinery wall's dim green, 4-5 the tubes' dim glass (all darker than the
 * solid panels' green, so the backdrop never reads as a block), 9-a dim red lights.
 */
export const tourianLairDecorPalette: string[] = [
  NES.black,
  '#001810',
  '#00281c',
  '#004430',
  '#183c34',
  '#2c5c50',
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  '#400010',
  '#600018',
];

/** Far rock spires (64x48) on Zebes's surface, dim against the storm sky, lit on their left. */
const spires = draw(64, 48, (x, y) => {
  let h = 0;
  let lit = false;
  for (const [px, ph, k] of [
    [8, 46, 2.6],
    [24, 30, 2],
    [40, 42, 3],
    [55, 24, 1.6],
  ] as const) {
    const v = ph - Math.abs(x - px) * k;
    if (v > h) {
      h = v;
      lit = x < px;
    }
  }
  if (48 - y > h) return '.';
  if (48 - y > h - 1.5) return '1';
  return lit && hash(x, y >> 2, 47) < 0.85 ? '3' : '2';
});

/** Tourian's machinery wall (32x32): dim panels with seams, a conduit along the middle. */
const tourianWall = draw(32, 32, (x, y) => {
  if (y >= 14 && y <= 17) return y === 14 ? '3' : y === 17 ? '1' : '2';
  if (x % 16 === 15 || y % 16 === 15) return '1';
  if (x % 16 === 0 || y % 16 === 0) return '3';
  if ((x % 16 === 3 || x % 16 === 12) && (y % 16 === 3 || y % 16 === 12)) return 'a';
  return '2';
});

/**
 * A dim glass tube (32x64) of the kind Tourian keeps its creatures in: a capped column of glass,
 * bubbles rising in it, a red light in its base. No creature in it, nothing to stand on.
 */
const tourianTube = draw(32, 64, (x, y) => {
  if (x < 4 || x > 27) return '.';
  if (y < 6 || y > 55)
    return x === 4 || x === 27 || y === 0 || y === 63 ? '0' : y === 59 && x % 6 === 3 ? 'a' : '3';
  if (x === 4 || x === 27) return '0';
  if (x === 5 || x === 26) return '5';
  for (const [bx, by, r] of [
    [12, 44, 2],
    [18, 30, 1.5],
    [11, 18, 1.2],
    [20, 50, 1.2],
  ] as const)
    if (Math.abs(Math.hypot(x - bx, y - by) - r) < 0.6) return '5';
  return x === 8 && y > 10 && y < 50 ? '5' : '4';
});

/** World 4's decor frames: the surface's far spires, Tourian's wall and glass tubes. */
export const zebesWorldDecorFrames: Record<string, Rows> = {
  'zc-spires': spires,
  'zt-wall': tourianWall,
  'zt-tube': tourianTube,
};
