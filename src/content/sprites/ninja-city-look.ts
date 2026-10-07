import { NES } from '@engine/gfx/palette';

/**
 * Ryu's restyle of 6-2 (0.4.12, campaign only): the `ninja-city` theme, a city street at night in
 * the spirit of an NES ninja game's first act. Original art, nothing traced.
 *
 * Tiles (`<tile>@ninja-city`, registered in tiles.ts) keep their collision shape: the ground
 * (`#`) is grey pavement slabs, bricks (`=`) red brick, hard blocks (`B`) grey concrete, pipes
 * stay green pipes with steel bands; `?` blocks, coins and the flagpole are SMB's own.
 *
 * Decor (`decor-ninja-city` palette, registered in decor.ts):
 * - `hill-big@ninja-city` (80x48) / `hill-small@ninja-city` (48x32): a red-brick shop front and a
 *   low brick wall stand where 6-2's hills stood; `bush-1/2/3@ninja-city` (32/48/64 x16) are
 *   street railings; `cloud-1/2/3@ninja-city` thin indigo night clouds. drawDecor picks them for
 *   the level's own `[decor]` under the theme, so the street dresses itself.
 * - `ng-skyline` (128x96): the city behind, dark towers with a few lit windows; tiles
 *   horizontally. Painted behind the level by `drawThemeBackdrop` (game/world/theme-backdrop.ts).
 * - `ng-lamp` (16x64): a street lamp with a red banner, for the level to place.
 * The small end castle keeps its shape, in red brick.
 */

type Rows = readonly string[];

const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

/* ---------- the tile palette (the 12 shared roles, see tiles.ts) ---------- */

/*
 * The street: concrete greys in the block slots; gold, the pipes' greens and white as SMB's; the
 * water slots and the lava slot hold the red brick (dark, light, main).
 */
export const ninjaCityTilePalette: string[] = [
  NES.black,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.white,
  '#881400',
  NES.orange,
  NES.orangeBrown,
];

/* ---------- the tiles (`@ninja-city`) ---------- */

/* The street (`#`): a big pavement slab, lit along its top and left, seams dark, a few chips. */
const groundCity = draw(16, 16, (x, y) => {
  if (y === 15 || x === 15) return '1';
  if (y === 0 || x === 0) return '3';
  if (hash(x, y, 4) < 0.05) return '1';
  if (hash(x, y, 8) < 0.04) return '3';
  return '2';
});

/* Concrete (`B`): a bevelled grey block with a crack across one corner. */
const hardCity = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15) return '0';
  if (y === 0 || x === 0) return '3';
  if (y === 14 || x === 14) return '1';
  if (y === 1 || x === 1) return '3';
  if (y === 13 || x === 13) return '1';
  if ((x === 9 && y < 5) || (x === 10 && y >= 4 && y < 7) || (y === 6 && x > 10 && x < 13)) return '1';
  return '2';
});

/* Spent block: dark concrete, four bolts. */
const usedCity = draw(16, 16, (x, y) => {
  if (x === 15 || y === 15 || ((x === 0 || x === 14) && (y === 0 || y === 14))) return '0';
  if ((x === 3 || x === 11) && (y === 3 || y === 11)) return '3';
  if (y === 0 || x === 0) return '2';
  if (y === 14 || x === 14) return '0';
  return '1';
});

/* Red brick (`=`): the SMB brick's courses (same mortar), lit on top, shaded underneath. */
const brickCity = [
  'aaaaaaa0aaaaaaa0',
  'bbbbbbb0bbbbbbb0',
  '9999999099999990',
  '0000000000000000',
  'aaa0aaaaaaa0aaaa',
  'bbb0bbbbbbb0bbbb',
  '9990999999909999',
  '0000000000000000',
  'aaaaaaa0aaaaaaa0',
  'bbbbbbb0bbbbbbb0',
  '9999999099999990',
  '0000000000000000',
  'aaa0aaaaaaa0aaaa',
  'bbb0bbbbbbb0bbbb',
  '9990999999909999',
  '0000000000000000',
];

/* Pipes: SMB's green pipes (same outline) with a steel band round the body and bolts on the rim. */
const band = (rows: Rows, at: readonly number[]): string[] =>
  rows.map((r, y) =>
    at.includes(y) ? [...r].map((c) => (c === '5' || c === '6' ? (y === at[0] ? '3' : '1') : c)).join('') : r,
  );
const bolts = (rows: Rows, xs: readonly number[]): string[] =>
  rows.map((r, y) => (y === 7 ? [...r].map((c, x) => (xs.includes(x) && c !== '0' ? '3' : c)).join('') : r));

export const pipeFrames = (base: Record<string, Rows>): Record<string, Rows> => ({
  'pipe-top-left': bolts(base['pipe-top-left'] as Rows, [4, 12]),
  'pipe-top-right': bolts(base['pipe-top-right'] as Rows, [3, 10]),
  'pipe-body-left': band(base['pipe-body-left'] as Rows, [6, 7]),
  'pipe-body-right': band(base['pipe-body-right'] as Rows, [6, 7]),
});

export const ninjaCityTileFrames: Record<string, Rows> = {
  ground: groundCity,
  hard: hardCity,
  used: usedCity,
  brick: brickCity,
};

/** The coin heaven's cloud blocks under the theme: the same puffs as dim night clouds. */
export const nightCloudBlock = (base: Rows): string[] =>
  base.map((r) => r.replace(/8/g, '1').replace(/a/g, '2'));

/* ---------- the decor (`decor-ninja-city`) ---------- */

/*
 * Roles: 0 black; 1-3 concrete greys (dark, mid, light); 4-5 the far city's indigo (body, lit
 * edge; also the night clouds); 6-8 red brick (dark, main, light); 9 a lit window; a a red sign.
 * The classic castle's brick slots (6-8) are the red brick, so the end castle is brick too.
 */
export const ninjaCityDecorPalette: string[] = [
  NES.black,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  '#180c50',
  '#2c1878',
  '#881400',
  NES.orangeBrown,
  NES.orange,
  NES.yellowLight,
  NES.red,
];

/* Brick wall fill for a facade: 8x4 bricks in offset courses, black mortar. */
const brickAt = (x: number, y: number): string => {
  const course = y >> 2;
  const bx = x + (course % 2 ? 4 : 0);
  if (y % 4 === 3 || bx % 8 === 7) return '0';
  return y % 4 === 0 ? '8' : y % 4 === 2 ? '6' : '7';
};

/* A red-brick shop front: a grey cornice, two dark upper windows, a lit shop window and a sign. */
const shopFront = draw(80, 48, (x, y) => {
  if (x === 0 || x === 79) return '0';
  // cornice
  if (y < 6) return y === 0 || y === 5 ? '0' : y === 1 ? '3' : y === 4 ? '1' : '2';
  // upper windows
  for (const wx of [12, 52])
    if (x >= wx && x < wx + 16 && y >= 10 && y < 22) {
      if (x === wx || x === wx + 15 || y === 10 || y === 21) return '2';
      if (x === wx + 8 || y === 15) return '1';
      return '0';
    }
  // the sign over the shop window
  if (x >= 10 && x < 70 && y >= 25 && y < 30) return y === 25 || y === 29 || x === 10 || x === 69 ? '0' : 'a';
  // the shop window and door
  if (x >= 10 && x < 70 && y >= 31) {
    if (y === 31 || x === 10 || x === 69 || x === 50 || x === 51) return '1';
    if (x > 51) return y > 33 ? '0' : '1';
    if (x === 30) return '1';
    return y > 44 ? '1' : (x + y) % 9 === 0 ? '3' : '9';
  }
  return brickAt(x, y);
});

/* A low brick wall with grey coping and a barred window. */
const lowWall = draw(48, 32, (x, y) => {
  if (x === 0 || x === 47) return '0';
  if (y < 4) return y === 0 || y === 3 ? '0' : y === 1 ? '3' : '2';
  if (x >= 16 && x < 32 && y >= 9 && y < 23) {
    if (x === 16 || x === 31 || y === 9 || y === 22) return '2';
    return x % 4 === 3 ? '1' : '0';
  }
  return brickAt(x, y);
});

/* A street railing: grey posts every 16 px, two rails. */
const railing = (w: number): string[] =>
  draw(w, 16, (x, y) => {
    const post = x % 16;
    if (post >= 2 && post < 5 && y >= 2) return post === 2 ? '3' : post === 4 ? '0' : '2';
    if (y === 3 || y === 9) return '3';
    if (y === 4 || y === 10) return '1';
    return '.';
  });

/* Thin indigo night clouds: a long streak and a lighter rim, flat underneath. */
const streak = (w: number): string[] =>
  draw(w, 16, (x, y) => {
    const t = (x + 0.5) / w;
    const top = 12 - Math.round(Math.sin(t * Math.PI) * 5 + (hash(x >> 3, 0, w) < 0.5 ? 0 : 1));
    if (y < top) return '.';
    if (y === top) return '5';
    return '4';
  });

/*
 * The far city: dark indigo towers of different heights against the night, their edges lit,
 * a scatter of lit windows in a grid. Tiles horizontally (each tower inside the frame).
 */
const TOWERS: readonly [number, number, number][] = [
  // [left, width, top]
  [0, 18, 40],
  [20, 24, 10],
  [46, 14, 52],
  [62, 22, 24],
  [86, 12, 60],
  [100, 26, 34],
];
const skyline = draw(128, 96, (x, y) => {
  for (const [l, w, top] of TOWERS) {
    if (x < l || x >= l + w || y < top) continue;
    if (y === top || x === l) return '5';
    // a roof ledge
    if (y === top + 1) return '4';
    const wx = x - l - 2;
    const wy = y - top - 4;
    if (wx >= 0 && wx < w - 4 && wy >= 0 && wx % 4 < 2 && wy % 6 < 3)
      return hash((x >> 2) + l, (y / 6) | 0, 11) < 0.18 ? '9' : '5';
    return '4';
  }
  return '.';
});

/* A street lamp: a lantern on a post, a red banner hanging from its arm. */
const lamp = draw(16, 64, (x, y) => {
  // lantern
  if (y < 8) {
    if (y === 0) return x >= 4 && x < 9 ? '0' : '.';
    if (x === 3 || x === 9) return '0';
    if (x > 3 && x < 9) return y === 7 ? '0' : '9';
    return '.';
  }
  // the arm to the banner
  if (y === 10 && x >= 6 && x < 15) return '2';
  // banner
  if (x >= 10 && x < 15 && y >= 11 && y < 30)
    return x === 10 || x === 14 || y === 29 ? '0' : y % 6 === 2 ? '3' : 'a';
  // post
  if (x >= 5 && x < 8) return x === 5 ? '3' : x === 7 ? '1' : '2';
  if (y >= 61 && x >= 3 && x < 10) return y === 61 ? '3' : '1';
  return '.';
});

export const ninjaCityDecorFrames: Record<string, Rows> = {
  'hill-big@ninja-city': shopFront,
  'hill-small@ninja-city': lowWall,
  'bush-1@ninja-city': railing(32),
  'bush-2@ninja-city': railing(48),
  'bush-3@ninja-city': railing(64),
  'cloud-1@ninja-city': streak(32),
  'cloud-2@ninja-city': streak(48),
  'cloud-3@ninja-city': streak(64),
  'ng-skyline': skyline,
  'ng-lamp': lamp,
};
