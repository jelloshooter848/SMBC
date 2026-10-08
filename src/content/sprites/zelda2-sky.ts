import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { draw, hash, type Rows } from './look-art';

/**
 * Link's sky palace (2-1-sky2 in the campaign): a palace on the clouds in the spirit of the NES
 * Zelda II's palaces. Original art drawn here from pixel functions, nothing traced. It is its own
 * sheet (`zelda2-sky`, in its own palette), placed by the map's `[campaign-decor]` as
 * `zelda2-sky:<piece>`; those pieces stand behind the tiles like the classic decor
 * (decoration.ts `decorInFront`), and none of them animates.
 *
 * Palette `zelda2-sky`:
 *   0 black            1-3 the palace's magentas (tiles-zelda2's brick)   4-7 stone, dark to white
 *   8 gold  9 pale gold  a gold shade      b-c banner and curtain reds
 *   d indigo (the hall's back wall)        e-f the sky through a window (zelda2's sky colour)
 *
 * Pieces (bottom-left anchored, like all decor):
 * - `wall` (64x128): the hall's dark back wall, faint indigo courses; tiles sideways.
 * - `window` (32x48): an arched window in it, sky and a cloud through it.
 * - `column` (16x128): a fluted stone column, capital and base; `column-broken` (16x64) outside.
 * - `gate` (80x144): the great gate, two pylons under a stepped pediment with a gold triad, the
 *   dark doorway between them (the players walk through it, in front).
 * - `statue` (16x48): a stone knight with spear and shield on a plinth, facing right; `statue-r`
 *   its mirror. They flank the altar.
 * - `crest` (64x48): the triad crest over Link: three gold triangles (a tall one between two
 *   small ones) on a gold-rimmed plaque, wings of gold either side. An original emblem.
 * - `banner` (16x48): a red banner with a gold triangle, hung from the ceiling.
 * - `curtain` (32x16): the palace's red drapes along the ceiling, gold fringe; tiles sideways.
 * - `brazier` (16x24): a stone stand with a gold bowl and a still flame.
 * - `cloud-sea` (64x32): puffy clouds below the palace; tiles sideways.
 */

export const zelda2SkyPalette: string[] = [
  NES.black,
  '#680038',
  '#a8005c',
  '#f878b8',
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.white,
  NES.yellow,
  NES.yellowLight,
  NES.brown,
  NES.redDark,
  NES.redBright,
  '#24188c',
  '#6888fc',
  NES.skyLight,
];

const mirror = (rows: Rows): string[] => rows.map((r) => [...r].reverse().join(''));

/** Rough-cut stone: lit up-left edge `6`, dark edge `4`, speckled face. */
const stoneAt = (x: number, y: number, w: number, h: number, seed: number): string => {
  if (x === 0 || y === 0) return '6';
  if (x === w - 1 || y === h - 1) return '4';
  return hash(x, y, seed) < 0.22 ? '6' : hash(x, y, seed + 1) < 0.18 ? '4' : '5';
};

/* ---------- the hall ---------- */

const wall = draw(64, 128, (x, y) => {
  const course = Math.floor(y / 16);
  const joint = (x + (course % 2) * 16) % 32 === 0;
  if (y % 16 === 0 || joint) return 'd';
  return hash(x, y, 61) < 0.03 ? 'd' : '0';
});

const archWindow = draw(32, 48, (x, y) => {
  const cx = 15.5;
  const outerR = 15.5;
  const innerR = 11.5;
  const archY = 16;
  const d = Math.hypot(x - cx, y - archY);
  const inArch = y < archY ? d <= outerR : x >= 0 && x <= 31;
  if (!inArch) return '.';
  const inOpen = y < archY ? d <= innerR : x >= 4 && x <= 27 && y <= 43;
  if (!inOpen) {
    // the stone frame: lit inner left, dark right, a sill along the bottom
    if (y >= 44) return y === 44 ? '6' : y === 47 ? '4' : '5';
    if (x < 16) return d > outerR - 1.2 || x === 0 ? '4' : '6';
    return d > outerR - 1.2 || x === 31 ? '4' : '5';
  }
  // the sky, a cloud drifting across the lower half, a mullion down the middle
  if (x === 15 || x === 16) return x === 15 ? '6' : '4';
  const cloud = Math.hypot((x - 10) / 7, (y - 30) / 3.5) <= 1 || Math.hypot((x - 21) / 6, (y - 33) / 3) <= 1;
  if (cloud) return y > 32 ? 'f' : '7';
  return y < 14 ? 'e' : hash(x, y, 63) < 0.04 ? 'f' : 'e';
});

const column = (h: number, broken: boolean, seed: number): string[] =>
  draw(16, h, (x, y) => {
    // A broken shaft: its top is a jagged break, no capital.
    const breakAt = broken ? 6 + Math.round(4 * Math.abs(Math.sin(x * 1.7 + seed))) : -1;
    if (broken && y < breakAt) return '.';
    if (broken && y === breakAt) return x < 3 || x > 12 ? '.' : '6';
    if (!broken) {
      // capital: an abacus slab, then a rolled echinus
      if (y < 3) return y === 0 ? '6' : y === 2 ? '4' : '5';
      if (y < 7) {
        if (x < 1 || x > 14) return '.';
        if (y === 6) return x < 3 || x > 12 ? '.' : '4';
        return x === 1 || (x < 8 && y === 3) ? '6' : x === 14 ? '4' : '5';
      }
    }
    // base: a plinth and a torus
    if (y >= h - 3) return y === h - 3 ? '6' : y === h - 1 ? '4' : '5';
    if (y >= h - 6) {
      if (x < 1 || x > 14) return '.';
      return x === 1 ? '6' : x === 14 ? '4' : '5';
    }
    // the shaft, fluted: light, mid and shadow flutes
    if (x < 3 || x > 12) return '.';
    if (x === 3) return '6';
    if (x === 12) return '0';
    if (x === 11) return '4';
    if (x === 5 || x === 8) return '4';
    if (x === 4 || x === 6) return '7';
    return hash(x, y, seed) < 0.1 ? '6' : '5';
  });

/* ---------- the gate ---------- */

/** A small gold triangle with its tip at (tx, ty), `h` tall: lit left, shaded right. */
const triangle = (x: number, y: number, tx: number, ty: number, h: number): string | null => {
  const dy = y - ty;
  if (dy < 0 || dy >= h) return null;
  const half = dy;
  const dx = x - tx;
  if (dx < -half || dx > half) return null;
  if (dy === h - 1) return 'a';
  if (dx === -half) return '9';
  if (dx === half) return 'a';
  return '8';
};

const gate = draw(80, 144, (x, y) => {
  // the stepped pediment: three steps up to a crown block, a gold triad in its face
  const steps = [
    [0, 80, 24, 40],
    [8, 72, 12, 24],
    [24, 56, 0, 12],
  ] as const;
  for (const [x0, x1, y0, y1] of steps) {
    if (x >= x0 && x < x1 && y >= y0 && y < y1) {
      // the triad on the middle step: one tall triangle between two small ones
      const tri = triangle(x, y, 39, 13, 10) ?? triangle(x, y, 29, 17, 6) ?? triangle(x, y, 50, 17, 6);
      if (y0 === 12 && tri) return tri;
      if (y === y1 - 1) return '1';
      if (y === y0) return '3';
      // palace brick courses, magenta
      const course = Math.floor((y - y0) / 4);
      if ((y - y0) % 4 === 3) return '1';
      if ((x + course * 4) % 8 === 0) return '1';
      return hash(x, y, 71) < 0.18 ? '3' : '2';
    }
  }
  if (y < 40) return '.';
  // the two pylons, dressed stone with a magenta band
  const pylon = x < 16 ? x : x >= 64 ? x - 64 : -1;
  if (pylon >= 0) {
    if (y >= 40 && y < 46) return y === 40 ? '3' : y === 45 ? '1' : '2';
    if (y >= 132) return y === 132 ? '6' : y === 143 ? '4' : '5';
    return stoneAt(pylon, (y - 46) % 14, 16, 14, x < 16 ? 73 : 74);
  }
  // the lintel over the doorway, a gold keystone in its middle
  if (y < 52) {
    if (x >= 36 && x < 44) return y === 40 ? '9' : y === 51 ? 'a' : '8';
    return stoneAt(x - 16, y - 40, 48, 12, 75);
  }
  // the doorway: an arch, dark inside, indigo shadow down its jambs
  const archTop = 52 + Math.round(10 - Math.sqrt(Math.max(0, 24 * 24 - (x - 39.5) * (x - 39.5))) / 2.4);
  if (y < archTop) return x < 40 ? '6' : '5';
  if (x === 16 || x === 63 || y === archTop) return 'd';
  return '0';
});

/* ---------- the altar ---------- */

const statue = draw(16, 48, (x, y) => {
  // plinth
  if (y >= 38) {
    if (y === 38) return '6';
    if (y === 47) return '4';
    if (x === 0) return '6';
    if (x === 15) return '4';
    return y === 42 ? '4' : '5';
  }
  // the spear, upright in front (right of the knight), a gold head
  if (x === 13) {
    if (y >= 1 && y <= 5) return y === 1 ? '9' : '8';
    if (y >= 6 && y < 38) return '4';
  }
  if ((x === 12 || x === 14) && (y === 4 || y === 5)) return 'a';
  // helmet with a crest plume
  if (y < 4) return x >= 5 && x <= 8 && y >= 1 ? (x === 5 ? '6' : '5') : '.';
  if (y < 11) {
    if (x < 4 || x > 10) return '.';
    if (y === 8 && x >= 8) return '0'; // the visor slit, looking right
    return x === 4 ? '6' : x === 10 ? '4' : '5';
  }
  // body: shoulders, then the tall shield held before him (on his right side, toward the altar)
  if (y < 30) {
    if (x >= 7 && x <= 12) {
      if (x === 7 || y === 11 || y === 29) return '4';
      if (x === 12) return '4';
      // a small triangle carved on the shield
      const t = triangle(x, y, 9, 17, 4);
      if (t) return '6';
      return '5';
    }
    if (x < 2 || x > 12) return '.';
    return x === 2 ? '6' : '5';
  }
  // legs, apart
  if (x >= 3 && x <= 5) return x === 3 ? '6' : '5';
  if (x >= 8 && x <= 10) return x === 10 ? '4' : '5';
  return '.';
});

const crest = draw(64, 48, (x, y) => {
  // wings: feathered gold sweeps from the plaque's sides
  const plaque = x >= 16 && x < 48 && y >= 6;
  if (!plaque) {
    const side = x < 16 ? 15 - x : x - 48;
    if (side < 0) return '.';
    const top = 8 + side * 0.6;
    const bottom = 30 - side * 0.5;
    if (y < top || y > bottom) return '.';
    const feather = Math.floor((y - top) / 4);
    if ((y - top) % 4 === 3) return 'a';
    return feather === 0 ? '9' : '8';
  }
  // the plaque: a pointed shield, gold rim, dark magenta field
  const ly = y - 6;
  const inset = ly > 26 ? ly - 26 : 0;
  if (x < 16 + inset || x > 47 - inset) return '.';
  const rim = x <= 17 + inset || x >= 46 - inset || ly <= 1 || ly >= 40;
  if (rim) return x < 32 ? '9' : 'a';
  // the triad: a tall triangle between two small ones, on a gold bar
  const tri = triangle(x, y, 31, 10, 18) ?? triangle(x, y, 23, 18, 10) ?? triangle(x, y, 40, 18, 10);
  if (tri) return tri;
  if (y === 29 || y === 30) return y === 29 ? '8' : 'a';
  return hash(x, y, 81) < 0.08 ? '2' : '1';
});

const banner = draw(16, 48, (x, y) => {
  // the gold rod, and the cloth below it with a swallow-tail
  if (y < 2) return y === 0 ? '9' : 'a';
  if (x < 2 || x > 13) return '.';
  const tail = y > 40 ? y - 40 : 0;
  if (tail > 0 && x >= 8 - tail && x <= 7 + tail) return '.';
  if (x === 2 || x === 13) return '8';
  if (x === 3 && y > 2) return '9';
  const t = triangle(x, y, 7, 14, 8);
  if (t) return t;
  if (y === 26 || y === 27) return '8';
  return x > 10 ? 'b' : 'c';
});

const curtain = draw(32, 16, (x, y) => {
  // a swag: the cloth hangs lowest mid-span, a gold fringe on its hem
  const hem = 5 + Math.round(8 * Math.sin((Math.PI * (x + 0.5)) / 32));
  if (y > hem + 1) return '.';
  if (y === hem + 1) return x % 2 === 0 ? '9' : '.';
  if (y === hem) return '8';
  if (y === 0) return 'b';
  // folds: darker stripes that follow the swag
  return (x + Math.round(y * 0.5)) % 6 === 0 ? 'b' : 'c';
});

const brazier = draw(16, 24, (x, y) => {
  // a still flame (no flicker), a gold bowl, a stone stand
  if (y < 9) {
    const w = (y + 1) * 0.5;
    if (Math.abs(x - 7.5) > w) return '.';
    return Math.abs(x - 7.5) < w - 2 ? (y > 4 ? '9' : '7') : 'c';
  }
  if (y < 13) {
    const half = 7 - (y - 9);
    if (Math.abs(x - 7.5) > half) return '.';
    return y === 9 ? '9' : x < 8 ? '8' : 'a';
  }
  if (y < 21) return x >= 6 && x <= 9 ? (x === 6 ? '6' : x === 9 ? '4' : '5') : '.';
  if (x < 3 || x > 12) return '.';
  return y === 21 ? '6' : y === 23 ? '4' : '5';
});

/* ---------- the sky ---------- */

const cloudSea = draw(64, 32, (x, y) => {
  const puffs = [
    [6, 14, 8],
    [20, 10, 10],
    [36, 15, 8],
    [50, 9, 11],
    [64 + 6, 14, 8],
    [-14, 9, 11],
  ] as const;
  const inside = y >= 20 || puffs.some(([cx, cy, r]) => Math.hypot(x - cx, (y - cy) * 1.2) <= r);
  if (!inside) return '.';
  const lit = puffs.some(([cx, cy, r]) => Math.hypot(x - cx + 2, (y - cy + 2) * 1.2) <= r - 2);
  if (y >= 26) return (x + y) % 2 === 0 ? 'f' : '7';
  return lit ? '7' : 'f';
});

export const zelda2SkyPalettes: Record<string, string[]> = { 'zelda2-sky': zelda2SkyPalette };

export const zelda2SkyDef: SpriteDef = {
  palette: 'zelda2-sky',
  frames: {
    wall,
    window: archWindow,
    column: column(128, false, 91),
    'column-broken': column(64, true, 92),
    gate,
    statue,
    'statue-r': mirror(statue),
    crest,
    banner,
    curtain,
    brazier,
    'cloud-sea': cloudSea,
  },
};
