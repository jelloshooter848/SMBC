import { NES } from '@engine/gfx/palette';

/**
 * Simon's restyle of 5-4 (0.4.12, campaign only): the `castlevania` theme, a gothic castle hall
 * in the spirit of an NES vampire-hunting game's first stage. Original art, nothing traced.
 *
 * Tiles (`<tile>@castlevania`, registered in tiles.ts) keep their collision shape: the castle's
 * bricks (`%`) become big bevelled orange stone blocks with dark seams, the hard blocks (`B`)
 * grey cut stone, the bridge a grey stone deck on iron brackets and its chain iron. `?` blocks,
 * coins and lava stay SMB's own so they read at a glance (the palette keeps their gold and red).
 *
 * Decor (`decor-castlevania` palette, registered in decor.ts):
 * - `cv-wall` (32x32): the hall's grey brick wall; tiles both ways.
 * - `cv-window` (32x48): a tall arched window, night blue behind iron bars.
 * - `cv-pillar` (32x32): a stone column's shaft; tiles vertically. `cv-pillar-cap` (32x16) its
 *   capital, for the shaft's top.
 * - `cv-candle` (16x32): a tall candle on a wall stand; place it on a floor (it stands on its
 *   bottom row) or anywhere on the wall.
 * The hall's wall, windows and pillars are painted behind the level by `drawThemeBackdrop`
 * (game/world/theme-backdrop.ts), so 5-4 needs no decor of its own for the look; candles are
 * the level's to place (`[campaign-decor]`).
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

/**
 * A bevelled stone block filling its 16x16 cell: a black seam on its right and bottom, rounded
 * corners, a lit top and left edge, a shaded bottom and right, and a few pits on its face.
 */
export const stoneBlock = (lit: string, main: string, dark: string, seed: number): string[] =>
  draw(16, 16, (x, y) => {
    if (x === 15 || y === 15) return '0';
    if ((x === 0 || x === 14) && (y === 0 || y === 14)) return '0';
    if (y === 0 || x === 0) return lit;
    if (y === 14 || x === 14) return dark;
    if ((y === 1 && x < 5) || (x === 1 && y < 5)) return lit;
    if ((y === 13 && x > 9) || (x === 13 && y > 9)) return dark;
    if (hash(x, y, seed) < 0.07) return dark;
    return main;
  });

/* ---------- the tile palette (the 12 shared roles, see tiles.ts) ---------- */

/*
 * The hall: the blocks' dark red-brown, orange and peach in the block slots; gold, the pipes'
 * greens and the lava's red as SMB's; the white and water slots hold the cut stone's light,
 * mid and dark greys (no water or clouds in a castle).
 */
export const castlevaniaTilePalette: string[] = [
  NES.black,
  '#881400',
  NES.orangeBrown,
  NES.peach,
  NES.yellow,
  NES.green,
  NES.greenPipe,
  NES.yellowLight,
  NES.lightGray,
  NES.gray,
  NES.darkGray,
  NES.lava,
];

/* ---------- the tiles (`@castlevania`) ---------- */

/* The castle's bricks (`%`): one big orange stone block a cell, as the hall's floors are built. */
const blockCv = stoneBlock('3', '2', '1', 5);

/* Hard blocks (`B`): grey cut stone. */
const hardCv = stoneBlock('8', '9', 'a', 9);

/* Spent block: the orange stone gone dark, four studs where the `?` was. */
const usedCv = stoneBlock('2', '1', '0', 13).map((r, y) =>
  y === 3 || y === 11 ? `${r.slice(0, 3)}3${r.slice(4, 11)}3${r.slice(12)}` : r,
);

/*
 * Breakable bricks: small dark bricks (the SMB brick's courses, same mortar) of the deep red
 * a castle's inner walls are laid in, each lit along its top.
 */
const brickCv = [
  '2222222022222220',
  '1111111011111110',
  '1111111011111110',
  '0000000000000000',
  '2220222222202222',
  '1110111111101111',
  '1110111111101111',
  '0000000000000000',
  '2222222022222220',
  '1111111011111110',
  '1111111011111110',
  '0000000000000000',
  '2220222222202222',
  '1110111111101111',
  '1110111111101111',
  '0000000000000000',
];

/* The bridge (`-`): a deck of grey stone slabs on iron brackets, open below (the lava shows). */
const bridgeCv = [
  '0000000000000000',
  '8888888088888880',
  '9999999099999990',
  '99a9999099a99990',
  'aaaaaaa0aaaaaaa0',
  '0000000000000000',
  '.0a0.......0a0..',
  '.0a0.......0a0..',
  '..0a0.....0a0...',
  '...0a00000a0....',
  '....0aaaaa0.....',
  '.....00000......',
  '................',
  '................',
  '................',
  '................',
];

/* The bridge's chain (`:`): iron links. */
const chainCv = [
  '......0880......',
  '.....08..90.....',
  '.....08..90.....',
  '.....08..90.....',
  '......0890......',
  '.......99.......',
  '......0890......',
  '......0890......',
  '......0890......',
  '.......99.......',
  '......0880......',
  '.....08..90.....',
  '.....08..90.....',
  '.....08..90.....',
  '......0890......',
  '.......99.......',
];

/* The hall's floor elsewhere (`#`): the same stone blocks. */
const groundCv = stoneBlock('3', '2', '1', 21);

export const castlevaniaTileFrames: Record<string, Rows> = {
  'castle-brick': blockCv,
  ground: groundCv,
  hard: hardCv,
  used: usedCv,
  brick: brickCv,
  bridge: bridgeCv,
  chain: chainCv,
};

/* ---------- the decor (`decor-castlevania`) ---------- */

/*
 * Roles: 0 black; 1-3 the wall and pillars' greys (dark, mid, light); 4-5 the windows' night
 * blue and moonlight; 6-7 the candle stand's brass (dark, light); 8 candle wax; 9-a the flame
 * (red outside, yellow at its heart).
 */
export const castlevaniaDecorPalette: string[] = [
  NES.black,
  '#282828',
  '#585858',
  NES.gray,
  NES.blueDark,
  '#0058f8',
  NES.brownDark,
  NES.brown,
  NES.white,
  NES.lava,
  NES.yellow,
];

/*
 * The hall's wall: grey bricks 16x8 in offset courses, black mortar, a lit top edge on a few,
 * kept dim so the level reads in front of it. Tiles both ways.
 */
const cvWall = draw(32, 32, (x, y) => {
  const course = y >> 3;
  const bx = (x + (course % 2 ? 8 : 0)) % 32;
  if (y % 8 === 7 || bx % 16 === 15) return '0';
  const brick = (bx >> 4) + course * 2;
  if (y % 8 === 0 && hash(brick, 0, 3) < 0.6) return '2';
  if (hash(x, y, 7) < 0.05) return '0';
  return '1';
});

/* A tall arched window: a stone surround, night blue panes behind two iron bars, a moonlit sill. */
const cvWindow = draw(32, 48, (x, y) => {
  const cx = 15.5;
  const dx = Math.abs(x - cx);
  // the arch: a half disc of radius 14 on a 28-wide shaft, the surround 2 px outside the panes
  const archY = 16;
  const inside = (r: number) => (y < archY ? Math.hypot(dx, archY - y) <= r : dx <= r);
  if (y >= 44) return y === 44 ? '3' : y === 47 ? '0' : '2';
  if (!inside(14)) return '.';
  if (!inside(12)) return y < archY ? (x < cx ? '3' : '2') : x < cx ? '3' : '2';
  if (!inside(11)) return '0';
  if (Math.abs(x - 10.5) < 1 || Math.abs(x - 20.5) < 1) return '0';
  if (y === 28) return '0';
  if (x > cx + 1 && x < cx + 4 && y > 8 && y < 40) return '5';
  return '4';
});

/* A stone column's shaft: lit left, shaded right, a black band every 16 px. Tiles vertically. */
const cvPillar = draw(32, 32, (x, y) => {
  if (x < 2 || x > 29) return '.';
  if (x === 2 || x === 29) return '0';
  if (y % 16 === 15) return '0';
  if (y % 16 === 0) return '3';
  if (x < 8) return '3';
  if (x > 23) return '1';
  if (x % 6 === 2) return '1';
  return '2';
});

/* The column's capital: a wider stepped block over the shaft. */
const cvPillarCap = [
  '00000000000000000000000000000000',
  '03333333333333333333333333333320',
  '02222222222222222222222222222210',
  '01111111111111111111111111111110',
  '00000000000000000000000000000000',
  '..0333333333333333333333333220..',
  '..0222222222222222222222222210..',
  '..0111111111111111111111111110..',
  '..0000000000000000000000000000..',
  '..0333332222222222222222221110..',
  '..0333332222222222222222221110..',
  '..0333332212222221222222121110..',
  '..0333332212222221222222121110..',
  '..0333332212222221222222121110..',
  '..0333332222222222222222221110..',
  '..0000000000000000000000000000..',
];

/* A tall candle on a brass stand, its flame flickering left. */
const cvCandle = [
  '.......9........',
  '......99........',
  '......9a9.......',
  '.....9aa9.......',
  '.....9aa9.......',
  '......99........',
  '.......0........',
  '......080.......',
  '......880.......',
  '......880.......',
  '......880.......',
  '......880.......',
  '......880.......',
  '......880.......',
  '......880.......',
  '....07777770....',
  '....06666660....',
  '......0770......',
  '.......76.......',
  '.......76.......',
  '.......76.......',
  '......0770......',
  '.......76.......',
  '.......76.......',
  '.......76.......',
  '.......76.......',
  '......0770......',
  '.....077776.....',
  '....07777766....',
  '...0777777666...',
  '...0666666666...',
  '....000000000...',
];

export const castlevaniaDecorFrames: Record<string, Rows> = {
  'cv-wall': cvWall,
  'cv-window': cvWindow,
  'cv-pillar': cvPillar,
  'cv-pillar-cap': cvPillarCap,
  'cv-candle': cvCandle,
};
