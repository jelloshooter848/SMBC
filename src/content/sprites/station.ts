import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * The space station above 3-1 (Mega Man's stage): its teleporter, robots, weapon capsule, boss
 * shutter and background decor. Original 8-bit art drawn here in the spirit of an NES robot
 * platformer (strong black outlines, three-tone metal, a few bright accent lights); nothing is
 * traced. The station's solid tiles are `<tile>@station` frames on the tile sheet (tiles.ts).
 *
 * Conventions the game relies on:
 * - Robots face LEFT (enemies walk left by default); flip for right. `hopper-0` is crouched on
 *   its springs, `hopper-1` stretched mid-hop; `turret-0` is shut (armoured), `turret-1` open with
 *   its eye and barrel out; `drone-*` are the two rotor frames.
 * - `pad-*` (16x8) sit on the floor, glow on top; `beam-*` (16x32) are the teleport streak, its
 *   landing splash and the last flash before a body appears, all anchored to the bottom row.
 * - `shutter` tiles vertically into a boss door. `window`, `console` and `girder` are background
 *   decor, drawn darker / bluer than the grey floor so they never read as solid.
 */

/* ------------------------------------------------------------------------------------------ */
/* Palettes                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * `station` index roles (the same in `station-flash`):
 *   0 black / outline / space     1 steel shadow     2 steel           3 steel light
 *   4 white                       5 deep blue        6 blue            7 light blue
 *   8 cyan glow                   9 pale glow        a yellow light    b pale yellow
 *   c red (eyes, warning)         d dark red         e land green      f land shade
 *   g orange                      h dark teal
 */
const stationBase = (): string[] => [
  NES.black,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.white,
  NES.blueDark,
  NES.blueMid,
  NES.blueLight,
  NES.cyan,
  NES.skyLight,
  NES.yellow,
  NES.yellowLight,
  NES.redBright,
  NES.redDark,
  NES.green,
  NES.greenDark,
  NES.orange,
  NES.teal,
];

export const stationPalettes: Record<string, string[]> = {
  station: stationBase(),
  // A robot struck by a shot: every colour but the outline flashes pale for a frame or two.
  'station-flash': stationBase().map((c, i) => (i === 0 ? c : i % 2 ? NES.white : NES.lightGray)),
};

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

type Grid = string[][];
const grid = (w: number, h: number, fill = '.'): Grid =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
const put = (g: Grid, x: number, y: number, c: string): void => {
  const row = g[y];
  if (row && x >= 0 && x < row.length) row[x] = c;
};
const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, c);
};
/** Paint `layer` (`.` transparent) at (x, y). */
const paint = (g: Grid, x: number, y: number, layer: readonly string[]): void =>
  layer.forEach((row, j) => [...row].forEach((c, i) => c !== '.' && put(g, x + i, y + j, c)));
const rows = (g: Grid): string[] => g.map((r) => r.join(''));
/** A left-right symmetric frame from its left half. */
const sym = (half: readonly string[]): string[] => half.map((r) => r + [...r].reverse().join(''));

/* ------------------------------------------------------------------------------------------ */
/* Teleporter                                                                                  */
/* ------------------------------------------------------------------------------------------ */

// A low emitter plate on a riveted base; the lens glows and sparks rise off it.
const pad0 = sym([
  '........',
  '..9.....',
  '.0777777',
  '03888888',
  '03333333',
  '022a2222',
  '01111111',
  '00000000',
]);
const pad1 = sym([
  '...4....',
  '..9...9.',
  '.0888888',
  '03444444',
  '03333333',
  '022b2222',
  '01111111',
  '00000000',
]);

// The beam: a white-hot core in cyan and blue, broken into dashes so it reads as speed.
const streak = (i: number): string =>
  i % 8 === 7 ? '................' : i % 8 === 6 ? '......7887......' : '.....784487.....';
const beam0 = Array.from({ length: 32 }, (_, i) => streak(i));
// Landing: the streak shortens and splashes out across the floor.
const beam1 = [
  ...Array.from({ length: 10 }, () => '................'),
  ...Array.from({ length: 12 }, (_, i) => streak(i)),
  '.....784487.....',
  '....78444487....',
  '...7844444487...',
  '..784444444487..',
  '.78844444444887.',
  '..788888888887..',
  '...7777777777...',
  '.9....7..7....9.',
  '9..............9',
  '................',
];
// The last flash before a body forms: a bright capsule of light with rings at head and feet.
const beam2 = [
  ...Array.from({ length: 8 }, () => '................'),
  '.......99.......',
  '......7887......',
  '..9..788887..9..',
  '....78844887....',
  '...7884444887...',
  '...7844444487...',
  '..778444444877..',
  '.7..78444487..7.',
  '....78444487....',
  '....78444487....',
  '...7844444487...',
  '..784444444487..',
  '..784444444487..',
  '...7844444487...',
  '....78444487....',
  '....78444487....',
  '.7..78444487..7.',
  '..778444444877..',
  '...7884444887...',
  '..78888888888 7.'.replace(' ', '8'),
  '.7777777777777 .'.replace(' ', '7'),
  '9..............9',
  '.9............9.',
  '................',
];

/* ------------------------------------------------------------------------------------------ */
/* Robots (facing left)                                                                        */
/* ------------------------------------------------------------------------------------------ */

// Hopper: a blue dome with one big red-pupilled eye and a yellow antenna lamp, on two springs.
const hopperBody = [
  '.......0........',
  '......0b0.......',
  '....00000000....',
  '...0777777660...',
  '..077777776660..',
  '.07444477776660.',
  '.04cc4477766660.',
  '.04cc4477766660.',
  '.07444477666660.',
  '..066666666660..',
  '...0000000000...',
];
const hopper0 = [
  '................',
  '................',
  '................',
  ...hopperBody,
  '...0323003230...',
  '..011110011110..',
];
const hopper1 = [
  ...hopperBody,
  '....030..030....',
  '...030....030...',
  '....030..030....',
  '...0111..1110...',
  '...0000..0000...',
];

// Turret: a grey dome with a hazard band on a bolted base. Shut it shrugs off shots; open, it
// shows a red eye and pokes its barrel out to the left.
const turretBase = ['0000000000000000', '0322222222222210', '0212121212121210', '0000000000000000'];
const turret0 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '...0033333300...',
  '..033222222210..',
  '.03222222222210.',
  '.0a00aa00aa00a0.',
  '.01111111111110.',
  ...turretBase,
];
const turret1 = [
  '................',
  '................',
  '......000000....',
  '....0033333300..',
  '...033222222210.',
  '...0a00aa00aa00.',
  '....0000000000..',
  '....0114441110..',
  '000001c4c41110..',
  '033321cc441110..',
  '00000114441110..',
  '....0111111110..',
  ...turretBase,
];

// Drone: an orange rotor bot with a camera eye and two little grabbers.
const droneBody = [
  '.......00.......',
  '......0220......',
  '....00000000....',
  '...0bbaaaaag0...',
  '..0baaaaaaagg0..',
  '.0ba000aaaaagg0.',
  '.0a04c40aaaagg0.',
  '.0a0ccc0aaaggg0.',
  '.0ga000aaaaggg0.',
  '..0gggggggggg0..',
  '...0000000000...',
];
const drone0 = [
  '.33333333333333.',
  ...droneBody,
  '....010..010....',
  '...010....010...',
  '...00......00...',
  '................',
];
const drone1 = [
  '.....133331.....',
  ...droneBody.map((r, i) => (i === 6 ? '.0a0c440aaaagg0.' : r)),
  '....010..010....',
  '....010..010....',
  '....00....00....',
  '................',
];

// The robots' shot: a hot yellow pellet with a white core.
const pellet = [
  '..0000..',
  '.0abba0.',
  '0ab44ba0',
  '0b4444b0',
  '0b4444b0',
  '0ab44ba0',
  '.0abba0.',
  '..0000..',
];

/* ------------------------------------------------------------------------------------------ */
/* Weapon capsule                                                                              */
/* ------------------------------------------------------------------------------------------ */

// A glass capsule between two steel caps with a saw blade turning inside; the glass pulses.
const capsule = (saw: readonly string[], glass: string, lamp: string): string[] => {
  const g = grid(16, 16);
  paint(g, 0, 0, [
    '.....000000.....',
    '...0033333300...',
    '..032222222210..',
    '..011111111110..',
    '.00000000000000.',
  ]);
  for (let y = 5; y <= 10; y++) {
    paint(g, 1, y, [`0${'4'}${glass.repeat(10)}6` + '0']);
    paint(g, 5, y, [(saw[y - 5] as string).replace(/\./g, glass)]);
  }
  paint(g, 0, 11, [
    '.00000000000000.',
    `..032${lamp}2222${lamp}210..`,
    '..011111111110..',
    '...0000000000...',
  ]);
  return rows(g);
};
const sawDiag = ['1.11.1', '.1221.', '123321', '123321', '.1221.', '1.11.1'];
const sawCross = ['..11..', '.1221.', '123321', '123321', '.1221.', '..11..'];
const capsule0 = capsule(sawDiag, '7', 'a');
const capsule1 = capsule(sawCross, '9', 'b');

/* ------------------------------------------------------------------------------------------ */
/* Boss shutter and decor                                                                      */
/* ------------------------------------------------------------------------------------------ */

// Boss door: heavy horizontal slats between two bolted rails; tiles vertically.
const shutterSlat = ['0322222222222230', '0233333333333320', '0222222222222220', '0111111111111110'];
const shutter = [...shutterSlat, ...shutterSlat, ...shutterSlat, ...shutterSlat].map((r, i) =>
  i % 8 === 2 ? `0a${r.slice(2, 14)}a0` : r,
);

// A porthole on space: a riveted steel frame split by a mullion, stars, and the blue Earth.
const EARTH = [
  '.....777777.....',
  '...7766666677...',
  '..776eee66666...',
  '.7666eeee666665.',
  '.766eeeeee66665.',
  '76666eeef6666665',
  '766666eef6646665',
  '7666666f66eee665',
  '766666666eeeef65',
  '766446666eeef665',
  '.66666666eef665.',
  '.5666666666f655.',
  '..566666666655..',
  '...5566666555...',
  '.....555555.....',
  '................',
];
function windowFrame(): string[] {
  const W = 48;
  const H = 32;
  const g = grid(W, H, '0');
  // Frame bevel: light top/left, dark bottom/right, steel between.
  rect(g, 1, 1, W - 2, 3, '2');
  rect(g, 1, H - 4, W - 2, 3, '2');
  rect(g, 1, 1, 3, H - 2, '2');
  rect(g, W - 4, 1, 3, H - 2, '2');
  rect(g, 1, 1, W - 2, 1, '3');
  rect(g, 1, 1, 1, H - 2, '3');
  rect(g, 1, H - 2, W - 2, 1, '1');
  rect(g, W - 2, 1, 1, H - 2, '1');
  // Inner lip.
  rect(g, 4, 4, W - 8, 1, '1');
  rect(g, 4, 4, 1, H - 8, '1');
  // Mullion down the middle.
  rect(g, 23, 4, 2, H - 8, '2');
  put(g, 23, 4, '3');
  rect(g, 25, 4, 1, H - 8, '1');
  rect(g, 22, 4, 1, H - 8, '0');
  // Corner rivets.
  for (const [x, y] of [
    [2, 2],
    [W - 3, 2],
    [2, H - 3],
    [W - 3, H - 3],
    [23, 2],
    [23, H - 3],
  ] as const)
    put(g, x, y, '4');
  // Space: stars (white and pale), a distant blue one.
  for (const [x, y, c] of [
    [7, 7, '4'],
    [12, 11, '9'],
    [17, 6, '4'],
    [9, 17, '4'],
    [15, 22, '9'],
    [19, 15, '7'],
    [6, 24, '9'],
    [20, 25, '4'],
    [29, 6, '9'],
    [37, 7, '4'],
    [42, 11, '9'],
    [28, 24, '4'],
  ] as const)
    put(g, x, y, c);
  // A twinkle cross on one big star.
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const)
    put(g, 12 + dx, 11 + dy, '7');
  // The Earth, in the right pane, its lit side to the left.
  paint(g, 27, 12, EARTH.slice(0, 16));
  // Glass glint across the left pane.
  put(g, 6, 6, '9');
  put(g, 7, 5, '9');
  return rows(g);
}

// A control desk: two screens (a sine trace, a radar blip), a slanted key bank, a vented cabinet.
function consoleFrame(): string[] {
  const g = grid(32, 16);
  // Screen housing.
  rect(g, 1, 0, 30, 7, '0');
  rect(g, 2, 1, 28, 5, '1');
  rect(g, 3, 1, 12, 5, '0');
  rect(g, 17, 1, 12, 5, '0');
  paint(g, 4, 1, ['.88......8..', '8..8....8.8.', '....8..8...8', '.....88.....']);
  rect(g, 4, 5, 10, 1, '5');
  paint(g, 18, 1, ['.....7....', '...7.7.7..', '..7.ccc.7.', '...7.7.7..', '.....7....']);
  // Slanted key bank.
  paint(g, 0, 7, [
    '00000000000000000000000000000000',
    '.03333333333333333333333333330.',
    '0322c2a2e22222222222222c2a2e2210',
  ]);
  rect(g, 0, 10, 32, 1, '0');
  // Cabinet with vents and a lamp.
  rect(g, 1, 11, 30, 4, '2');
  rect(g, 0, 11, 1, 5, '0');
  rect(g, 31, 11, 1, 5, '0');
  rect(g, 0, 15, 32, 1, '0');
  rect(g, 1, 11, 30, 1, '3');
  rect(g, 30, 11, 1, 4, '1');
  for (let x = 4; x < 16; x += 3) rect(g, x, 12, 2, 2, '1');
  for (let x = 4; x < 16; x += 3) put(g, x, 12, '0');
  rect(g, 22, 12, 6, 2, '5');
  put(g, 23, 12, '8');
  put(g, 25, 12, '8');
  put(g, 27, 13, '7');
  return rows(g);
}

// A background truss: chords top and bottom, an X brace between, in the station's blues. Tiles
// sideways into a long beam (the brace meets the next tile's at the edges).
const chord = ['0000000000000000', '6666666666666666', '5555555555555555', '0000000000000000'];
const girder = [
  ...chord,
  ...Array.from({ length: 8 }, (_, k) => {
    const r = Array.from({ length: 16 }, () => '.');
    for (const x of [2 * k, 15 - 2 * k]) r[x] = '6';
    for (const x of [2 * k + 1, 14 - 2 * k]) r[x] = '5';
    return r.join('');
  }),
  ...chord,
];

export const stationDef: SpriteDef = {
  palette: 'station',
  frames: {
    'pad-0': pad0,
    'pad-1': pad1,
    'beam-0': beam0,
    'beam-1': beam1,
    'beam-2': beam2,
    'hopper-0': hopper0,
    'hopper-1': hopper1,
    'turret-0': turret0,
    'turret-1': turret1,
    'drone-0': drone0,
    'drone-1': drone1,
    pellet,
    'capsule-0': capsule0,
    'capsule-1': capsule1,
    shutter,
    window: windowFrame(),
    console: consoleFrame(),
    girder,
  },
};
