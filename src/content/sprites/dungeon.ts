import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Link's top-down dungeon ("Escape the Shadow Keep"): the keep's tiles and HUD icons, an
 * overhead Link and the keep's monsters. Original 8-bit art drawn here in the spirit of an NES
 * overhead adventure (16x16 tiles, a few colours per sheet); nothing is traced.
 *
 * Orientation conventions the game relies on:
 * - `door-*`, `exit-*`, `wall-top` are drawn for the NORTH wall (the room's floor is below
 *   them); rotate them for the other walls. `wall-corner` is the north-west corner (floor to its
 *   bottom-right). `wall` is plain brick for wall cells that don't touch the floor.
 * - Floor objects (`statue`, `stairs`, `switch-*`, `torch-*`, `chest`) are full opaque tiles
 *   with the floor drawn under them. `block` is a full opaque tile (it slides, so it is drawn as
 *   an entity over the floor). Pickups and HUD icons are transparent around the shape.
 * - Overhead Link and the monsters face DOWN / UP / RIGHT (`side-*`); flip for left. The sword
 *   blades are separate: `sword-v` points up (flip vertically for down), `sword-h` points right.
 */

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
function paste(base: readonly string[], layer: readonly string[], dx = 0, dy = 0): string[] {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    const target = out[y + dy];
    if (!target) return;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string;
      const tx = x + dx;
      if (ch === '.' || tx < 0 || tx >= target.length) continue;
      target[tx] = ch;
    }
  });
  return out.map((r) => r.join(''));
}

/** A left-right symmetric frame from its left half. */
const sym = (half: readonly string[]): string[] => half.map((r) => r + [...r].reverse().join(''));

/** Replace palette chars. */
const recolor = (rows: readonly string[], map: Record<string, string>): string[] =>
  rows.map((r) => r.replace(/./g, (c) => map[c] ?? c));

/* ------------------------------------------------------------------------------------------ */
/* Palettes                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * `dungeon` index roles (the same in `dungeon-dark`):
 *   0 black / deep shadow   1 wall stone        2 wall highlight     3 floor / mortar shade
 *   4 floor highlight       5 pale glow          6 white              7 dark stone (blocks, statues)
 *   8 mid stone             9 light stone        a wood               b dark wood
 *   c flame orange          d gold / flame core  e heart red          f light gold / glow
 *   g heart shade
 */
const dungeonBase = (wall: string, wallHi: string, floor: string, floorHi: string): string[] => [
  NES.black,
  wall,
  wallHi,
  floor,
  floorHi,
  NES.skyLight,
  NES.white,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.brown,
  NES.brownDark,
  NES.orange,
  NES.yellow,
  NES.redBright,
  NES.yellowLight,
  NES.redDark,
];

export const dungeonPalettes: Record<string, string[]> = {
  // Teal stone walls over a deep blue tiled floor.
  dungeon: dungeonBase(NES.teal, NES.cyan, NES.blueDark, NES.blueUnderground),
  // The keeper's lair: violet stone over a near-black floor.
  'dungeon-dark': dungeonBase(NES.blueUnderground, NES.purple, NES.black, NES.darkGray),
};

/**
 * `link-td` index roles (as the platformer Link's, so the two read as one hero):
 *   0 outline   1 tunic   2 tunic shade / cap band   3 skin   4 hair   5 boots & belt
 *   6 glint     7 blade   8 grip / blade shade       9 hilt & shield trim   a shield   b shield shade
 */
const linkTd = (tunic: string, shade: string, skin: string, hair: string, shield: string): string[] => [
  NES.black,
  tunic,
  shade,
  skin,
  hair,
  NES.brownDark,
  NES.white,
  NES.lightGray,
  NES.gray,
  NES.yellow,
  shield,
  NES.blueDark,
];

export const linkTdPalettes: Record<string, string[]> = {
  'link-td': linkTd(NES.greenMid, NES.greenDark, NES.skin, NES.brown, NES.blueMid),
  // Hurt flash: alternated every few frames while Link is knocked back.
  'link-td-hurt-0': linkTd(NES.white, NES.lightGray, NES.white, NES.lightGray, NES.white),
  'link-td-hurt-1': linkTd(NES.redBright, NES.redDark, NES.tan, NES.redDark, NES.redBright),
  // Reduce flashing: one steady, paler tint held for the whole invulnerable time.
  'link-td-hurt-calm': linkTd(NES.greenLight, NES.green, NES.tan, NES.brownLight, NES.lavender),
};

/**
 * `dungeon-enemies` index roles:
 *   0 outline   1 bone / white   2 bone shade   3 armour   4 armour dark   5 eye red
 *   6 deep red  7 wing violet    8 shadow body  9 shadow rim   a shield wood   b wood dark
 *   c hide      d gold           e spell magenta   f spell pink   g rock   h rock light
 *   i shell     j shell rim
 */
export const dungeonEnemiesPalettes: Record<string, string[]> = {
  'dungeon-enemies': [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.darkGray,
    NES.redBright,
    NES.redDark,
    NES.purple,
    NES.blueDark,
    NES.lavender,
    NES.brown,
    NES.brownDark,
    NES.orange,
    NES.yellow,
    NES.magenta,
    NES.pink,
    NES.orangeBrown,
    NES.tanDark,
    NES.greenDark,
    NES.green,
  ],
};

/* ------------------------------------------------------------------------------------------ */
/* Keep tiles (16x16)                                                                          */
/* ------------------------------------------------------------------------------------------ */

// Staggered bricks: a lit top-left edge, a dark speck bottom-right, black mortar.
const BRICK_A = ['2222222022222220', '2111111021111110', '2111113021111130', '0000000000000000'];
const BRICK_B = ['2220222222202222', '1110211111102111', '1130211111302111', '0000000000000000'];
const WALL = [...BRICK_A, ...BRICK_B, ...BRICK_A, ...BRICK_B];

// The wall's inner edge facing the floor, from the brick down: a lit ledge, a studded band, then
// the shadow the wall casts. TRIM[d] is the row d pixels from the floor (d = 0 is the last row).
const TRIM_ROWS = [
  '2222222222222222',
  '1111111111111111',
  '1311131113111311',
  '1111111111111111',
  '3333333333333333',
  '0000000000000000',
  '0000000000000000',
  '3030303030303030',
];
const WALL_TOP = [...BRICK_A, ...BRICK_B, ...TRIM_ROWS];

/** North-west inner corner: brick, with the two trims meeting in a mitre at the bottom right. */
const WALL_CORNER = WALL_TOP.map((row, y) =>
  Array.from(row, (_, x) => {
    if (x < 8 || y < 8) return (WALL[y] as string)[x] as string;
    const d = Math.max(15 - x, 15 - y);
    const band = TRIM_ROWS[15 - d - 8] as string;
    // the studded band is plain in the mitre; the dotted shadow keeps its dither
    return d === 5 ? '1' : (band[x] as string);
  }).join(''),
);

// Floor: four bevelled slabs per tile.
const SLAB = ['44444443', '43333330', '43333330', '43333330', '43333330', '43333330', '43333330', '30000000'];
const FLOOR = [...SLAB, ...SLAB].map((r) => r + r);

// Alternate floor: one big slab with a sunken diamond stud.
const FLOOR_ALT = [
  '4444444444444443',
  '4333333333333330',
  '4333333333333330',
  '4333333333333330',
  '4333333333333330',
  '4333333443333330',
  '4333334334333330',
  '4333343333033330',
  '4333303333033330',
  '4333330330333330',
  '4333333003333330',
  '4333333333333330',
  '4333333333333330',
  '4333333333333330',
  '4333333333333330',
  '3000000000000000',
];

// Doorway arch (north wall): a stone ring around a dark opening that runs down to the floor.
const ARCH = [
  '................',
  '.....999999.....',
  '....98888889....',
  '...9880000889...',
  '..988000000889..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
  '..980000000089..',
];
const DOOR_OPEN = paste(WALL_TOP, ARCH);

// Locked: a plank door in the arch with a gold keyhole plate.
const LOCKED_FILL = [
  '................',
  '................',
  '................',
  '......abba......',
  '.....aabbaa.....',
  '....aabaabaa....',
  '....aabaabaa....',
  '....adddddda....',
  '....add00dda....',
  '....ad0000da....',
  '....add00dda....',
  '....add00dda....',
  '....adddddda....',
  '....aabaabaa....',
  '....aabaabaa....',
  '....bbbbbbbb....',
];
const DOOR_LOCKED = paste(DOOR_OPEN, LOCKED_FILL);

// Shut: iron bars drop across the dark opening.
const BARS = [
  '................',
  '................',
  '................',
  '................',
  '.....98..98.....',
  '....098009800...',
  '....098009800...',
  '....99999999....',
  '....88888888....',
  '....098009800...',
  '....098009800...',
  '....098009800...',
  '....99999999....',
  '....88888888....',
  '....098009800...',
  '....098009800...',
].map((r) => r.slice(0, 16));
const DOOR_SHUT = paste(DOOR_OPEN, BARS);

// The way out: the arch brimming with light, two shimmer frames.
const GLOW_0 = [
  '................',
  '................',
  '................',
  '......5665......',
  '.....566665.....',
  '....56666665....',
  '....5666f665....',
  '....566fff65....',
  '....5666f665....',
  '....56666665....',
  '....56f66665....',
  '....5fff6665....',
  '....56f66665....',
  '....56666665....',
  '....55555555....',
  '....5f5f5f5f....',
];
const GLOW_1 = [
  '................',
  '................',
  '................',
  '......5f65......',
  '.....566665.....',
  '....56666665....',
  '....56666665....',
  '....5f666665....',
  '....56666f65....',
  '....5666fff5....',
  '....56666f65....',
  '....56666665....',
  '....566f6665....',
  '....56666665....',
  '....55555555....',
  '....f5f5f5f5....',
];
const exitFrame = (glow: readonly string[]) =>
  paste(paste(DOOR_OPEN, glow), ['................', '.....ffffff.....', '....f......f....'], 0, 0);

// Pushable block: grey stone, bevelled, with a four-way "move" arrow cut into its face.
const BLOCK = [
  '0000000000000000',
  '0999999999999970',
  '0999999999999770',
  '0998888888887770',
  '0998888778887770',
  '0998887777887770',
  '0998878778787770',
  '0998777777777770',
  '0998777777777770',
  '0998878778787770',
  '0998887777887770',
  '0998888778887770',
  '0998888888887770',
  '0977777777777770',
  '0777777777777770',
  '0000000000000000',
];

// Gargoyle statue on a plinth (drawn over the floor).
const STATUE_SHAPE = sym([
  '..00....',
  '.0980...',
  '.09980..',
  '.099800.',
  '..099999',
  '..099999',
  '..090099',
  '..09e099',
  '.0899999',
  '.0890000',
  '.0889999',
  '..088888',
  '.0000000',
  '.0999999',
  '.0888888',
  '.0777777',
]);
const STATUE = paste(FLOOR, STATUE_SHAPE);

// Stairs going down into the dark.
const STAIRS = [
  '0000000000000000',
  '0999999999999990',
  '0988888888888870',
  '0800000000000070',
  '0899999999999970',
  '0788888888888870',
  '0700000000000070',
  '0799999999999970',
  '0777777777777770',
  '0700000000000070',
  '0788888888888870',
  '0777777777777770',
  '0700000000000070',
  '0777777777777770',
  '0000000000000000',
  '0000000000000000',
];

// Floor switch: a raised gold plate, and the same plate pressed flush.
const SWITCH_UP = paste(FLOOR, [
  '................',
  '................',
  '...0000000000...',
  '..0ffffffffff0..',
  '..0fddddddddd0..',
  '..0fdd0000ddd0..',
  '..0fd0dddd0dd0..',
  '..0fd0dddd0dd0..',
  '..0fd0dddd0dd0..',
  '..0fdd0000ddd0..',
  '..0fddddddddd0..',
  '..0ddddddddddb..',
  '..0bbbbbbbbbbb..',
  '...00000000000..',
]);
const SWITCH_DOWN = paste(FLOOR, [
  '................',
  '................',
  '................',
  '................',
  '...0000000000...',
  '..0bbbbbbbbbb0..',
  '..0bdddddddda0..',
  '..0bdd0000dda0..',
  '..0bd0dddd0da0..',
  '..0bdd0000dda0..',
  '..0bdddddddda0..',
  '..0aaaaaaaaaa0..',
  '...0000000000...',
]);

// Torch: a stone brazier with a two-frame flame (and one burnt out).
const BRAZIER = [
  '..000000000000..',
  '.09999999999990.',
  '.08888888888880.',
  '..088888888880..',
  '...0777777770...',
  '....00877000....',
  '.....087700.....',
  '....08888770....',
  '...0000000000...',
];
const FLAME_0 = [
  '.......e........',
  '......ee........',
  '......ece..e....',
  '.....eccce.e....',
  '....eccdcceee...',
  '....ecddddcce...',
  '...ecddffdddce..',
];
const FLAME_1 = [
  '........e.......',
  '....e...ee......',
  '....e..ecce.....',
  '....eeeccdce....',
  '...eccdddcce....',
  '...ecddfdddce...',
  '..ecddfffddce...',
];
const SMOKE = [
  '................',
  '........7.......',
  '.......7........',
  '........7.......',
  '.......7........',
  '................',
  '...0000000000...',
];
const torch = (top: readonly string[]) => paste(paste(FLOOR, top, 0, 0), BRAZIER, 0, 7);
const TORCH_0 = torch(FLAME_0);
const TORCH_1 = torch(FLAME_1);
const TORCH_OFF = torch(SMOKE);

// Treasure chest.
const CHEST = paste(FLOOR, [
  '................',
  '................',
  '..000000000000..',
  '.0aaaaaaaaaaaa0.',
  '.0abbbbbbbbbba0.',
  '.0aaaaaaaaaaaa0.',
  '.0dddddddddddd0.',
  '.0bbbbbddbbbbb0.',
  '.0aaaad00daaaa0.',
  '.0aaaaddddaaaa0.',
  '.0aaaaaaaaaaaa0.',
  '.0aaaaaaaaaaaa0.',
  '.0dddddddddddd0.',
  '.0bbbbbbbbbbbb0.',
  '..000000000000..',
]);

// Water: dark rippling pool.
const WATER = [
  '3333333333333333',
  '3333333333333333',
  '3344443333333333',
  '3433334333333333',
  '3333333333334443',
  '3333333333343334',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '3333333444433333',
  '3333334333343333',
  '3333333333333333',
  '3443333333333333',
  '4334333333333344',
  '3333333333333433',
  '3333333333333333',
];

/* ---------- HUD icons and pickups ---------- */

const KEY = [
  '..0000..',
  '.0dddd0.',
  '0dd00dd0',
  '0d0..0d0',
  '0dd00dd0',
  '.0dddd0.',
  '..0dd0..',
  '..0dd0..',
  '..0dd0..',
  '..0dd0..',
  '..0dd00.',
  '..0dddd0',
  '..0dd00.',
  '..0ddd0.',
  '..0dd00.',
  '...00...',
];

const HEART = [
  '.00.00..',
  '0ee0ee0.',
  '0e6eee0.',
  '0eeeee0.',
  '.0eee0..',
  '..0e0...',
  '...0....',
  '........',
];
const HEART_HALF = [
  '.00.00..',
  '0ee0gg0.',
  '0e6ggg0.',
  '0eeggg0.',
  '.0egg0..',
  '..0g0...',
  '...0....',
  '........',
];
const HEART_EMPTY = [
  '.00.00..',
  '0gg0gg0.',
  '0ggggg0.',
  '0ggggg0.',
  '.0ggg0..',
  '..0g0...',
  '...0....',
  '........',
];
const HEART_PICKUP = [
  '.00.00..',
  '0ee0ee0.',
  '0e66ee0.',
  '0e6eee0.',
  '0eeeee0.',
  '.0eee0..',
  '..0e0...',
  '...0....',
];

const SWORD_ICON = [
  '...00...',
  '..0660..',
  '..0690..',
  '..0690..',
  '..0690..',
  '..0690..',
  '..0690..',
  '..0690..',
  '..0690..',
  '0000000.',
  '0dddddd0',
  '0000000.',
  '..0aa0..',
  '..0aa0..',
  '..0dd0..',
  '...00...',
];

export const dungeonDef: SpriteDef = {
  palette: 'dungeon',
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
    'torch-0': TORCH_0,
    'torch-1': TORCH_1,
    'torch-off': TORCH_OFF,
    chest: CHEST,
    'exit-0': exitFrame(GLOW_0),
    'exit-1': exitFrame(GLOW_1),
    water: WATER,
    key: KEY,
    heart: HEART,
    'heart-half': HEART_HALF,
    'heart-empty': HEART_EMPTY,
    'heart-pickup': HEART_PICKUP,
    'sword-icon': SWORD_ICON,
  },
};

/* ------------------------------------------------------------------------------------------ */
/* Overhead Link (16x16)                                                                        */
/* ------------------------------------------------------------------------------------------ */

// He carries the shield on his right arm and the sword in his left hand, so facing down the
// shield is on the viewer's left and the sword hand on the right (mirrored facing up).

// Facing down: rounded cap, fringe, pointed ears, two eyes.
const HEAD_DOWN = [
  '......0000......',
  '....00111100....',
  '...0111111110...',
  '..011111111210..',
  '..012222222210..',
  '.00444444444400.',
  '0334330330334330',
  '.00433333333400.',
  '...0033333300...',
];
const BODY_DOWN = [
  '..022111111220..',
  '.02211111111220.',
  '.03211111111230.',
  '..005559955500..',
  '...0211111120...',
];
const LEGS_A = ['...0550..0000...', '...0000.........'];
const LEGS_B = ['...0000..0550...', '.........0000...'];
// Shield held across the front: blue face, gold cross.
const SHIELD_FRONT = ['.000.', '0aaa0', '0a9a0', '09990', '0a9a0', '0aab0', '.000.'];

const linkDown = (legs: readonly string[]) =>
  paste([...HEAD_DOWN, ...BODY_DOWN, ...legs], SHIELD_FRONT, 0, 9);

// Facing up: the back of the cap with its tail hanging down, hair, the shield's rim on the arm.
const HEAD_UP = [
  '......0000......',
  '....00111100....',
  '...0111111110...',
  '..011111111210..',
  '..011111111210..',
  '.00111111111200.',
  '0334111111124330',
  '.00444444444400.',
  '...0044444400...',
];
const BODY_UP = [
  '..022111111220..',
  '.02211111111220.',
  '.03211111111230.',
  '..005555555500..',
  '...0211111120...',
];
const CAP_TAIL = ['0120', '0120', '.00.'];
const SHIELD_EDGE = ['000', '0a0', '0b0', '0a0', '0b0', '000'];
const upBody = (legs: readonly string[]) =>
  paste(paste([...HEAD_UP, ...BODY_UP, ...legs], CAP_TAIL, 8, 7), SHIELD_EDGE, 13, 9);

// Facing right: cap peak and tail streaming back, pointed ear, eye, nose; shield held in front.
const HEAD_SIDE = [
  '......00000.....',
  '....00111110....',
  '...0111111110...',
  '..011111111110..',
  '.0112222222220..',
  '0110444433333 0..',
  '..0433433303330.',
  '..044343333330..',
  '...0044333300...',
].map((r) => r.replace(' ', ''));
const BODY_SIDE = [
  '...0221111120...',
  '...0211111110...',
  '...0211111110...',
  '...0555555550...',
  '...0211111120...',
];
const LEGS_SIDE_A = ['..0550..0550....', '..0000..0000....'];
const LEGS_SIDE_B = ['....0550550.....', '....0000000.....'];
const SHIELD_SIDE = ['000.', '0aa0', '0a90', '0990', '0a90', '0aa0', '0bb0', '000.'];
const linkSide = (legs: readonly string[]) =>
  paste([...HEAD_SIDE, ...BODY_SIDE, ...legs], SHIELD_SIDE, 12, 8);

// Attacks: the sword arm thrust to the tile edge, where the blade sprite's grip overlaps the hand
// (see LINK_SWORD_GRIP below).
const ATTACK_DOWN = paste(
  [
    ...HEAD_DOWN,
    '..022111111220..',
    '.02211111111220.',
    '.03211111111120.',
    '..005559955110..',
    '...02111110330..',
    '...0550..0330...',
    '...0000...00....',
  ],
  SHIELD_FRONT,
  0,
  9,
);
const ATTACK_UP = paste(
  paste(
    paste(['.'.repeat(16), ...HEAD_UP, ...BODY_UP, '...0000..0000...'], CAP_TAIL, 8, 8),
    SHIELD_EDGE,
    13,
    10,
  ),
  ['.00.', '0330', '0330', '0110', '0110', '0110', '0120', '0120', '0220'],
  2,
  0,
);
const ATTACK_SIDE = paste(
  [
    ...HEAD_SIDE,
    '...0221111120...',
    '...0211111110000',
    '...0211111111333',
    '...0555555550000',
    '...0211111120...',
    '..0550....0550..',
    '..0000....0000..',
  ],
  ['000', '0a0', '090', '0a0', '000'],
  1,
  9,
);

// Sword blade pointing up: white edge, grey spine, gold guard, brown grip, gold pommel.
const SWORD_V = [
  '...00...',
  '..0660..',
  '..0670..',
  '..0670..',
  '..0670..',
  '..0670..',
  '..0670..',
  '..0670..',
  '..0670..',
  '..0670..',
  '00000000',
  '09999990',
  '00044000',
  '..0440..',
  '..0990..',
  '...00...',
];
/** The vertical blade turned a quarter clockwise, so it points right. */
const SWORD_H = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 16 }, (_, j) => (SWORD_V[15 - j] as string)[i]).join(''),
);

export const linkTdDef: SpriteDef = {
  palette: 'link-td',
  frames: {
    'down-0': linkDown(LEGS_A),
    'down-1': linkDown(LEGS_B),
    'up-0': upBody(LEGS_B),
    'up-1': upBody(LEGS_A),
    'side-0': linkSide(LEGS_SIDE_A),
    'side-1': linkSide(LEGS_SIDE_B),
    'attack-down': ATTACK_DOWN,
    'attack-up': ATTACK_UP,
    'attack-side': ATTACK_SIDE,
    'sword-v': SWORD_V,
    'sword-h': SWORD_H,
  },
};

/* ------------------------------------------------------------------------------------------ */
/* Monsters                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Four-way symmetric frame from its top-left quadrant. */
const sym4 = (quarter: readonly string[]): string[] => {
  const top = sym(quarter);
  return [...top, ...[...top].reverse()];
};

// Cave bat: dark body, pricked ears, red eyes; wings up, then wings down.
const BAT_0 = sym([
  '........',
  '.00.....',
  '0770....',
  '07770...',
  '077770..',
  '0777770.',
  '07777700',
  '.0777700',
  '..077704',
  '...07705',
  '....0004',
  '.......0',
  '........',
  '........',
  '........',
  '........',
]);
const BAT_1 = sym([
  '........',
  '........',
  '........',
  '........',
  '......00',
  '.......0',
  '.......0',
  '.....004',
  '...00705',
  '.0077704',
  '0777770.',
  '077770..',
  '07700...',
  '0770....',
  '.00.....',
  '........',
]);

// Skeleton knight: iron helmet, skull with red pinpoint eyes, ribs, a round wooden shield with a
// gold boss and a short blade.
const KNIGHT_HELM = ['....00000000....', '...0233333340...', '...0233333340...', '...0444444440...'];
const KNIGHT_SKULL = [
  '...0111111110...',
  '...0100110010...',
  '...0150110510...',
  '....01100110....',
  '.....0101010....',
];
const KNIGHT_TORSO = [
  '..011100001110..',
  '.01201222210210.',
  '.01200111100210.',
  '.01201222210210.',
  '.0110.0110.0110.',
];
const KNIGHT_LEGS_A = ['....010..010....', '...0110...00....'];
const KNIGHT_LEGS_B = ['....010..010....', '....00...0110...'];
const KNIGHT_SHIELD = ['.0000.', '0aaaa0', '0adda0', '0adda0', '0aaab0', '.0bb0.', '..00..'];
const KNIGHT_BLADE = ['.0.', '010', '010', '020', '020', '333', '040'];
const knightDown = (legs: readonly string[]) =>
  paste(
    paste([...KNIGHT_HELM, ...KNIGHT_SKULL, ...KNIGHT_TORSO, ...legs], KNIGHT_SHIELD, 0, 8),
    KNIGHT_BLADE,
    13,
    6,
  );

const KNIGHT_HELM_BACK = [
  ...KNIGHT_HELM.slice(0, 3),
  '...0333333330...',
  '...0333333330...',
  '...0433333340...',
  '....04444440....',
  '.....011110.....',
  '......0000......',
];
const KNIGHT_BACK = [
  '..011100001110..',
  '.01200211200210.',
  '.01202111120210.',
  '.01200211200210.',
  '.0110.0110.0110.',
];
const KNIGHT_SHIELD_EDGE = ['000', '0a0', '0d0', '0a0', '0b0', '000'];
const knightUp = (legs: readonly string[]) =>
  paste([...KNIGHT_HELM_BACK, ...KNIGHT_BACK, ...legs], KNIGHT_SHIELD_EDGE, 13, 9);

const KNIGHT_SIDE_HEAD = [
  '....00000000....',
  '...0423333320...',
  '...0423333320...',
  '...0444444440...',
  '....041111110...',
  '....041110010...',
  '....041110510...',
  '....04111110....',
  '.....0101010....',
];
const KNIGHT_SIDE_TORSO = [
  '.....0110010....',
  '....01222210....',
  '....01111110....',
  '....01222210....',
  '.....011010.....',
];
const KNIGHT_SIDE_LEGS_A = ['....010..010....', '...0110...0110..'];
const KNIGHT_SIDE_LEGS_B = ['.....010010.....', '.....0110110....'];
const KNIGHT_SHIELD_SIDE = ['.00.', '0aa0', '0da0', '0dd0', '0da0', '0ab0', '.00.'];
const knightSide = (legs: readonly string[]) =>
  paste(
    paste([...KNIGHT_SIDE_HEAD, ...KNIGHT_SIDE_TORSO, ...legs], KNIGHT_SHIELD_SIDE, 11, 7),
    ['0', '1', '1', '2', '3', '4'],
    3,
    8,
  );

// Rock spitter: a round, warty hide-toad with goggle eyes and a stone-spitting snout.
const SPITTER_DOWN_0 = sym([
  '........',
  '..000...',
  '.01110..',
  '.0101000',
  '.01110cc',
  '0c000ccc',
  '0ccccccc',
  '0cbccccc',
  '0ccccccc',
  '0ccccc00',
  '0cccc044',
  '.0ccc040',
  '..0cc044',
  '.0bb0000',
  '.0bb0...',
  '..00....',
]);
const SPITTER_DOWN_1 = sym([
  '........',
  '........',
  '..000...',
  '.01110..',
  '.0101000',
  '.01110cc',
  '0c000ccc',
  '0cbccccc',
  '0ccccccc',
  '0ccccc00',
  '0cccc044',
  '.0ccc040',
  '..0cc044',
  '..0b0000',
  '..0bb0..',
  '...00...',
]);
const SPITTER_SIDE_0 = [
  '................',
  '......0000......',
  '.....011110.....',
  '...00011010.....',
  '..0cc011110000..',
  '.0cccc0000ccc0..',
  '0ccbccccccccc0..',
  '0cccccccccccc000',
  '0cccbccccccc0440',
  '0ccccccccccc0400',
  '0cbccccccccc0440',
  '.0cccbccccc00000',
  '..0ccccccc0.....',
  '..0bb000bb0.....',
  '..0bb0.0bb0.....',
  '...00...00......',
].map((r) => r.replace(' ', ''));
const SPITTER_SIDE_1 = [
  '................',
  '................',
  '......0000......',
  '.....011110.....',
  '...00011010.....',
  '..0cc011110000..',
  '.0cccc0000ccc000',
  '0ccbccccccccc044',
  '0cccccccccccc040',
  '0cccbcccccccc044',
  '0ccccccccccc0000',
  '.0cbcccccccc0...',
  '..0cccbcccc0....',
  '...0bb00bb0.....',
  '...0bb00bb0.....',
  '....00..00......',
];

const ROCK = ['..0000..', '.0hhgg0.', '0hhgggb0', '0hgggbb0', '0ggggbb0', '0gggbbb0', '.0bbbb0.', '..0000..'];

/*
 * The keeper: the spell's warden, a hooded shadow with a horned crown, burning eyes and a fanged
 * maw, its back armoured by a great spiked shell; it floats on a ragged hem of smoke (32x32).
 * Drawn as layers on the left half and mirrored: the shell and its spikes behind, the hooded body
 * in front.
 */
const KEEPER_SHELL = Array.from({ length: 32 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    const dx = (x + 0.5 - 16) / 13;
    const dy = (y + 0.5 - 16) / 11;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) return '.';
    if (r > 0.9) return '0';
    if (r > 0.8) return 'j';
    if (r > 0.6 && r < 0.68) return '0';
    return (x + y) % 5 === 0 ? 'j' : 'i';
  }).join(''),
);
const SPIKE_LEFT = ['..00', '.012', '0122', '.022', '..00'];
const SPIKE_UP_LEFT = ['00...', '0110.', '.0122', '.0222', '..22.'];
const KEEPER_BODY_0 = [
  '................',
  '................',
  '......00........',
  '......010.......',
  '......0120......',
  '.......0120.....',
  '.......01220....',
  '........01220...',
  '.........0122000',
  '..........007777',
  '.........0777788',
  '........07778888',
  '........07888888',
  '.......078888888',
  '.......078000888',
  '.......0780dd508',
  '.......078055008',
  '.......078888888',
  '......0780101010',
  '......0788000000',
  '.....07888888888',
  '...0078888888888',
  '..07778888888888',
  '.077078888888888',
  '0717.07888888888',
  '01010.0788888888',
  '.0.0..0788787888',
  '.......078878788',
  '.......0787.0787',
  '........070..078',
  '........0.....07',
  '...............0',
];
const KEEPER_BODY_1 = [
  ...KEEPER_BODY_0.slice(0, 20),
  '...0078888888888',
  '.0077788888888 88',
  '07777078888888 88',
  '0717.07888888888',
  '01010.0788888888',
  '.0.0...078787888',
  '.......078878878',
  '........0787078 8',
  '........0780.078',
  '.........00...07',
  '..............0.',
  '................',
].map((r) => r.replace(/ /g, ''));
const keeper = (body: readonly string[]) =>
  sym(paste(paste(paste(KEEPER_SHELL, SPIKE_LEFT, 0, 13), SPIKE_UP_LEFT, 2, 5), body));
const KEEPER_0 = keeper(KEEPER_BODY_0);
const KEEPER_1 = keeper(KEEPER_BODY_1);
// Struck: the shadow blanches and the eyes go white.
const KEEPER_HIT = recolor(KEEPER_0, { '8': '9', '7': '1', i: '2', j: '1', '5': '1', d: '1' });

const SPELL_0 = [
  '..0000..',
  '.0eeee0.',
  '0eeffee0',
  '0ef11fe0',
  '0ef11fe0',
  '0eeffee0',
  '.0eeee0.',
  '..0000..',
];
const SPELL_1 = [
  '...00...',
  '..0ee0..',
  '.0effe0.',
  '0ef11fe0',
  '0ef11fe0',
  '.0effe0.',
  '..0ee0..',
  '...00...',
];

// A puff of smoke: a tight burst, a billow, then scattering wisps.
const POOF_0 = sym4([
  '........',
  '........',
  '........',
  '........',
  '.....2..',
  '....212.',
  '.....211',
  '....2111',
]);
const POOF_1 = sym4([
  '........',
  '....222.',
  '...21112',
  '..211111',
  '.2111121',
  '.2111211',
  '..211111',
  '.2111111',
]);
const POOF_2 = sym4([
  '..2.....',
  '.212....',
  '..2...2.',
  '......2.',
  '....2...',
  '2.......',
  '........',
  '...2....',
]);

export const dungeonEnemiesDef: SpriteDef = {
  palette: 'dungeon-enemies',
  frames: {
    'bat-0': BAT_0,
    'bat-1': BAT_1,
    'knight-down-0': knightDown(KNIGHT_LEGS_A),
    'knight-down-1': knightDown(KNIGHT_LEGS_B),
    'knight-up-0': knightUp(KNIGHT_LEGS_B),
    'knight-up-1': knightUp(KNIGHT_LEGS_A),
    'knight-side-0': knightSide(KNIGHT_SIDE_LEGS_A),
    'knight-side-1': knightSide(KNIGHT_SIDE_LEGS_B),
    'spitter-down-0': SPITTER_DOWN_0,
    'spitter-down-1': SPITTER_DOWN_1,
    'spitter-side-0': SPITTER_SIDE_0,
    'spitter-side-1': SPITTER_SIDE_1,
    rock: ROCK,
    'keeper-0': KEEPER_0,
    'keeper-1': KEEPER_1,
    'keeper-hit': KEEPER_HIT,
    'spell-0': SPELL_0,
    'spell-1': SPELL_1,
    'poof-0': POOF_0,
    'poof-1': POOF_1,
    'poof-2': POOF_2,
  },
};
