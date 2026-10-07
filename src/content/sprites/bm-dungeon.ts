import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, draw, type Rows } from './sophia-draw';

/**
 * The overhead dungeon of Sophia's mini game: tiles for the top-down kit (src/game/topdown/),
 * drawn to the same frame contract as Link's `dungeon` sheet, so a game points `TdSheets.tiles`
 * at `bm-dungeon` (and `tilesDark` at `bm-dungeon-dark` for the Plutonium Boss's lair) and every
 * room draws. Original art in the spirit of an NES tank game's overhead dungeons: blue-steel
 * walls of panels and conduits with red warning lamps, a floor of riveted grating, sealed blast
 * doors, toxic sludge pools, reactor pillars. Registered with `withSideFrames`, which turns the
 * north-edge walls and doors for the west and east edges and halves the two-cell doorways.
 *
 * Like `dungeon`: walls and doors are drawn for the NORTH edge (outside at the top, the floor at
 * the bottom); `wall-corner` is the north-west corner; `exit-0/1` is the open doorway brimming
 * with light; `block` is a pushable crate; `statue` a reactor pillar (solid); `torch-*` a lamp
 * post; `stairs` a hatch with a ladder down; `switch-up/down` a floor plate.
 */

/**
 * `bm-dungeon` index roles (the same in `bm-dungeon-dark`):
 *   0 black   1 wall dark   2 wall   3 wall light   4 floor dark   5 floor   6 floor light
 *   7 white   8 glow        9 glow light            a warning red  b gold
 *   c steel dark            d steel                 e sludge       f sludge light
 */
const bmBase = (wall: readonly string[], floor: readonly string[]): string[] => [
  NES.black,
  ...wall,
  ...floor,
  NES.white,
  NES.greenMid,
  NES.greenLight,
  NES.redBright,
  NES.yellow,
  NES.darkGray,
  NES.gray,
  '#007800',
  '#58d854',
];

export const bmDungeonPalettes: Record<string, string[]> = {
  // Blue steel walls over a dark slate grating.
  'bm-dungeon': bmBase(['#182c58', '#30589c', '#78a8e0'], ['#0c1420', '#24364c', '#3c5874']),
  // The boss's lair: plum flesh-metal over a near-black floor.
  'bm-dungeon-dark': bmBase(['#300818', '#6c1c40', '#b04c78'], ['#080008', '#200818', '#3c1830']),
};

/** Paint `layer`'s opaque pixels over a copy of `base`. */
const paste = (base: Rows, layer: Rows, dx = 0, dy = 0): string[] =>
  Canvas.from(base).paste(layer, dx, dy).rows();

// The wall's face: two courses of panels with a conduit between them, a lit top edge per course.
const PANEL_A = [
  '3333333033333330',
  '2222222022222220',
  '2212222022122220',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
];
const PANEL_B = [
  '3330333333303333',
  '2220222222202222',
  '2220221222202212',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
];
const WALL = [...PANEL_A, ...PANEL_B, ...PANEL_A.slice(0, 4)];

// The edge toward the floor: a conduit with warning lamps, a lit lip, then the wall's shadow.
const TRIM = [
  'cdcdcdcdcdcdcdcd',
  'dddadddddddadddd',
  '3333333333333333',
  '1111111111111111',
  '0404040404040404',
];
const WALL_TOP = [...PANEL_A, ...PANEL_B.slice(0, 5), ...TRIM];

/** North-west inner corner: panels, the two trims meeting in a mitre at the bottom right. */
const WALL_CORNER = WALL_TOP.map((row, y) =>
  Array.from(row, (_, x) => {
    if (x < 11 || y < 11) return (WALL[y] as string)[x] as string;
    const d = Math.min(x, y) - 11;
    return (TRIM[d] as string)[Math.max(x, y)] as string;
  }).join(''),
);

// Floor: four riveted grating plates per tile.
const PLATE = [
  '66666665',
  '65555554',
  '65454554',
  '65555554',
  '65545454',
  '65555554',
  '65555554',
  '54444444',
];
const FLOOR = [...PLATE, ...PLATE].map((r) => r + r);

// Alternate floor: a vent grille, slots across one big plate.
const FLOOR_ALT = draw(16, 16, (x, y) => {
  if (y === 15 || x === 15) return '4';
  if (y === 0 || x === 0) return '6';
  if (x >= 2 && x <= 13 && y >= 2 && y <= 13) return y % 3 === 1 ? '0' : y % 3 === 2 ? '4' : '5';
  return '5';
});

// The doorway: a steel frame round a dark passage running down to the floor.
const FRAME = draw(16, 16, (x, y) => {
  if (y < 1 || x < 2 || x > 13) return '.';
  if (y === 1) return x >= 4 && x <= 11 ? 'd' : '.';
  if (x === 2 || x === 13) return 'c';
  if (x === 3 || x === 12) return y === 4 ? 'a' : 'd';
  return y === 2 ? 'c' : '0';
});
const DOOR_OPEN = paste(WALL_TOP, FRAME);
// Sealed: a blast door with a gold lock plate.
const DOOR_LOCKED = paste(
  DOOR_OPEN,
  draw(16, 16, (x, y) => {
    if (x < 4 || x > 11 || y < 3) return '.';
    if (x >= 6 && x <= 9 && y >= 6 && y <= 10) return y === 8 && (x === 7 || x === 8) ? '0' : 'b';
    return y % 4 === 3 ? 'c' : 'd';
  }),
);
// Shut: a shutter of steel slats.
const DOOR_SHUT = paste(
  DOOR_OPEN,
  draw(16, 16, (x, y) => (x < 4 || x > 11 || y < 3 ? '.' : y % 2 ? 'c' : 'd')),
);

const glow = (k: 0 | 1): string[] =>
  draw(16, 16, (x, y) => {
    if (x < 4 || x > 11 || y < 3) return '.';
    const v = (x * 3 + y * 5 + k * 7) % 11;
    if (y === 15) return (x + k) % 2 ? '9' : '8';
    return v === 0 ? '7' : v < 4 ? '9' : '8';
  });

// A pushable crate: steel, bevelled, braced corner to corner.
const BLOCK = draw(16, 16, (x, y) => {
  if (x === 0 || y === 0 || x === 15 || y === 15) return '0';
  if (x === 1 || y === 1) return '7';
  if (x === 14 || y === 14) return 'c';
  if (Math.abs(x - y) < 1 || Math.abs(15 - x - y) < 1) return 'c';
  return 'd';
});

/** The floor with a round thing standing on it. */
const onFloor = (shape: (c: Canvas) => void): string[] => {
  const c = new Canvas(16, 16);
  shape(c);
  return paste(FLOOR, c.outline().rows());
};

// A reactor pillar seen from above: steel drum, a lit rim, a green core.
const STATUE = onFloor((c) =>
  c.disc(8, 8, 6.5, 'c').disc(8, 8, 5.5, 'd').disc(7.5, 7.5, 3, '8').disc(7, 7, 1.4, '9'),
);

// A hatch with a ladder going down.
const STAIRS = paste(
  FLOOR,
  draw(16, 16, (x, y) => {
    if (x < 2 || x > 13 || y < 2 || y > 13) return '.';
    if (x === 2 || x === 13 || y === 2 || y === 13) return 'c';
    if (x === 4 || x === 11) return 'd';
    return y % 3 === 0 ? 'd' : '0';
  }),
);

const SWITCH_UP = onFloor((c) =>
  c.rect(4, 4, 8, 8, 'd').hline(4, 11, 4, '7').vline(4, 4, 11, '7').rect(7, 7, 2, 2, 'a'),
);
const SWITCH_DOWN = onFloor((c) => c.rect(4, 5, 8, 7, 'c').rect(7, 8, 2, 2, '8'));

const torch = (bulb: string, rim: string): string[] =>
  onFloor((c) => c.disc(8, 10, 4, 'c').disc(8, 9, 2.8, 'd').disc(8, 6, 3, rim).disc(8, 6, 1.6, bulb));

// A supply case: steel with a gold latch; open, dark inside.
const CHEST = onFloor((c) =>
  c.rect(2, 4, 12, 9, 'd').hline(2, 13, 4, '7').hline(2, 13, 8, 'c').rect(7, 7, 2, 3, 'b'),
);
const CHEST_OPEN = onFloor((c) => c.rect(2, 2, 12, 3, 'd').rect(2, 6, 12, 7, 'd').rect(3, 7, 10, 5, '0'));

// Toxic sludge with bubbles.
const WATER = draw(16, 16, (x, y) => {
  const b = (x - 4) ** 2 + (y - 5) ** 2 < 3 || (x - 11) ** 2 + (y - 11) ** 2 < 2;
  if (b) return (x + y) % 3 ? 'f' : 'e';
  return (x * 7 + y * 3) % 23 === 0 ? 'f' : 'e';
});

// A cracked wall (bombable) and the hole a blast leaves.
const WALL_CRACKED = paste(
  WALL_TOP,
  draw(16, 16, (x, y) => {
    const crack = [
      [7, 1],
      [7, 2],
      [6, 3],
      [6, 4],
      [7, 5],
      [8, 6],
      [8, 7],
      [9, 8],
      [8, 9],
      [7, 10],
      [5, 6],
      [4, 7],
      [10, 4],
      [11, 3],
    ];
    return crack.some(([cx, cy]) => cx === x && cy === y) ? '0' : '.';
  }),
);
const WALL_HOLE = paste(
  WALL_TOP,
  new Canvas(16, 16).ellipse(8, 10, 5.5, 7, '0').set(3, 9, 'c').set(12, 6, 'c').set(4, 14, 'd').rows(),
);

/* ---------- pickups and HUD (the kit's item frames, as a tank game's gear) ---------- */

// Life: an energy cell (8x8, 7x7 drawn) in place of a heart: full, half, spent.
const CELL = ['.00000..', '0a77aa0.', '0aaaaa0.', '0aaaaa0.', '0aaaaa0.', '0aaaaa0.', '.00000..', '........'];
const CELL_HALF = CELL.map((r) => r.slice(0, 4) + r.slice(4).replace(/[a7]/g, 'c'));
const CELL_EMPTY = CELL.map((r) => r.replace(/[a7]/g, 'c'));
// A dropped cell: the same with a glow ring so it pops off the floor.
const CELL_PICKUP = [
  '.09990..',
  '0a77aa0.',
  '9aaaaa9.',
  '9aaaaa9.',
  '9aaaaa9.',
  '0aaaaa0.',
  '.09990..',
  '........',
];

// A keycard (8x16): a gold card with a dark strip and a clip.
const KEY = [
  '..000...',
  '..0d0...',
  '00000000',
  '0bbbbbb0',
  '0b7bbbb0',
  '0bbbbbb0',
  '00000000',
  '0bbbbbb0',
  '0bbbbbb0',
  '0bb00bb0',
  '0bb00bb0',
  '0bbbbbb0',
  '0bbbbbb0',
  '0bbbbbb0',
  '00000000',
  '........',
];

// A blaster (8x16, the sword's slot): a grip and a barrel pointing up.
const GUN_ICON = [
  '...00...',
  '..0770..',
  '..0dd0..',
  '..0dd0..',
  '..0dd0..',
  '..0dd0..',
  '.00dd00.',
  '0cddddc0',
  '0cdaadc0',
  '0cddddc0',
  '.00cc00.',
  '..0cc0..',
  '..0cc0..',
  '..0cc0..',
  '..0000..',
  '........',
];

// A grenade (8x16; the bomb's slots): a steel egg with a pin, its dropped twin rimmed in glow.
const grenade = (rim: string): string[] => [
  '........',
  '...00...',
  '..0bb0..',
  '...00...',
  '..0000..',
  `.0dddd${rim}.`,
  `0dd7ddd${rim}`,
  `0d7dddd${rim}`,
  `0ddddcd${rim}`,
  `0dddccd${rim}`,
  `0ddcccd${rim}`,
  `.0dccc${rim}.`,
  '..0000..',
  '........',
  '........',
  '........',
];

// A homing round (8x16; the boomerang's slot): a dart pointing up with a glowing tail.
const HOMING_ICON = [
  '...00...',
  '..0770..',
  '..0dd0..',
  '.0dddd0.',
  '.0dddd0.',
  '.0dddd0.',
  '.0dddd0.',
  '0cddddc0',
  '0c0dd0c0',
  '00.99.00',
  '...99...',
  '...88...',
  '....8...',
  '........',
  '........',
  '........',
];

/** A 16x16 pickup on a dark disc so it reads on the floor. */
const onPad = (shape: (c: Canvas) => void): string[] => {
  const c = new Canvas(16, 16);
  shape(c);
  return c.outline().rows();
};

// Armour plating (the shield's slot), a big cell (a life more), and a refill of four cells.
const ARMOUR = onPad((c) => {
  c.poly(
    [
      [2, 2],
      [14, 2],
      [14, 9],
      [8, 15],
      [2, 9],
    ],
    'd',
  );
  c.hline(3, 13, 3, '7').vline(8, 4, 12, 'c').rect(6, 6, 5, 2, 'b');
});
const BIG_CELL = onPad((c) => {
  c.rect(2, 3, 12, 11, 'a').rect(5, 1, 6, 2, 'b');
  c.hline(3, 12, 4, '7').rect(7, 6, 2, 6, '7').rect(5, 8, 6, 2, '7');
});
const REFILL = onPad((c) => {
  for (const [x, y] of [
    [1, 1],
    [9, 1],
    [1, 9],
    [9, 9],
  ] as const)
    c.rect(x, y, 6, 6, 'a').set(x + 1, y + 1, '7');
});

export const bmDungeonDef: SpriteDef = {
  palette: 'bm-dungeon',
  frames: {
    floor: FLOOR,
    'floor-alt': FLOOR_ALT,
    wall: WALL,
    'wall-top': WALL_TOP,
    'wall-corner': WALL_CORNER,
    'door-open': DOOR_OPEN,
    'door-locked': DOOR_LOCKED,
    'door-shut': DOOR_SHUT,
    block: BLOCK,
    statue: STATUE,
    stairs: STAIRS,
    'switch-up': SWITCH_UP,
    'switch-down': SWITCH_DOWN,
    'torch-0': torch('9', '8'),
    'torch-1': torch('7', '9'),
    'torch-off': torch('c', '4'),
    chest: CHEST,
    'chest-open': CHEST_OPEN,
    'exit-0': paste(DOOR_OPEN, glow(0)),
    'exit-1': paste(DOOR_OPEN, glow(1)),
    water: WATER,
    'wall-cracked': WALL_CRACKED,
    'wall-hole': WALL_HOLE,
    // The kit's pickups and HUD frames, at Link's sizes: energy cells for hearts, a keycard, a
    // blaster, grenades, a homing round, armour plating, a big cell and a refill.
    heart: CELL,
    'heart-half': CELL_HALF,
    'heart-empty': CELL_EMPTY,
    'heart-pickup': CELL_PICKUP,
    'heart-container': BIG_CELL,
    'refill-icon': REFILL,
    key: KEY,
    'sword-icon': GUN_ICON,
    'shield-pickup': ARMOUR,
    'bomb-icon': grenade('0'),
    'bomb-pickup': grenade('9'),
    'boomerang-icon': HOMING_ICON,
  },
};
