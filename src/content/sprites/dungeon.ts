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
 * - `wall-cracked` (a bombable wall) and `wall-hole` (the passage a bomb blows through it) are
 *   north-wall tiles too, drawn on `wall-top`.
 * - Floor objects (`statue`, `stairs`, `switch-*`, `torch-*`, `chest`, `chest-open`) are full opaque tiles
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
 *   g heart shade           h item blue (shield, bomb)                h..j are the same in both
 *   i item blue shade       j item blue highlight                     palettes: items keep colour
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
  NES.blueMid,
  NES.blueDark,
  NES.blueLight,
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
 *   c blast orange   d blast red   e bomb highlight (c..e are the same in every tint)
 * The boomerang is drawn in 4/5/9 (wood and gold), the bomb in a/b/e (the shield's blues).
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
  NES.orange,
  NES.redBright,
  NES.blueLight,
];

/** Link's tint with the blade recoloured: the sword beam's flicker (beam.ts). */
function beamTint(glint: string, blade: string, shade: string, hilt: string): string[] {
  const p = linkTd(NES.greenMid, NES.greenDark, NES.skin, NES.brown, NES.blueMid);
  p[6] = glint;
  p[7] = blade;
  p[8] = shade;
  p[9] = hilt;
  return p;
}

export const linkTdPalettes: Record<string, string[]> = {
  'link-td': linkTd(NES.greenMid, NES.greenDark, NES.skin, NES.brown, NES.blueMid),
  // Hurt flash: alternated every few frames while Link is knocked back.
  'link-td-hurt-0': linkTd(NES.white, NES.lightGray, NES.white, NES.lightGray, NES.white),
  'link-td-hurt-1': linkTd(NES.redBright, NES.redDark, NES.tan, NES.redDark, NES.redBright),
  // Reduce flashing: one steady, paler tint held for the whole invulnerable time.
  'link-td-hurt-calm': linkTd(NES.greenLight, NES.green, NES.tan, NES.brownLight, NES.lavender),
  // The sword beam (and its burst): the blade's colours flicker through four tints as it flies
  // (glint, blade, grip / blade shade, hilt), and hold the first with reduce flashing.
  'link-td-beam-0': beamTint(NES.white, NES.skyLight, NES.blueLight, NES.white),
  'link-td-beam-1': beamTint(NES.yellowLight, NES.peach, NES.redBright, NES.yellow),
  'link-td-beam-2': beamTint(NES.skyLight, NES.blueLight, NES.blueMid, NES.lavender),
  'link-td-beam-3': beamTint(NES.white, NES.greenLight, NES.green, NES.yellowLight),
  'link-td-beam-calm': beamTint(NES.white, NES.skyLight, NES.blueLight, NES.white),
  // Kakariko Village (0.4.41): his found tunic's blue and the sword beam's red, as his side-view
  // self wears them (characters/link).
  'link-td-blue': linkTd(NES.blueLight, NES.blueMid, NES.skin, NES.brown, NES.blueMid),
  'link-td-red': linkTd(NES.redBright, NES.redDark, NES.skin, NES.brown, NES.blueMid),
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

/* ---------- Shadow Keep v2: the bombable wall, the opened chest ---------- */

// A bombable wall: the north wall split by a jagged crack around a crumbled hollow, the bricks
// beside it chipped (lit edges) and the ledge broken, so it stands out in a run of plain wall.
const WALL_CRACKED = paste(WALL_TOP, [
  '.....00.........',
  '......02........',
  '......02........',
  '.......0........',
  '.20....002......',
  '..00...00...02..',
  '...20000000.0...',
  '.....0000.000...',
  '....0000000002..',
  '...00.0000..00..',
  '..00..00.00..0..',
  '.02...0...00....',
  '......0....02...',
  '...12......21...',
  '..1221....1221..',
  '................',
]);

// The blown-open wall: a ragged hole through the bricks down to the floor, rubble at its feet.
const WALL_HOLE = paste(WALL_TOP, [
  '................',
  '.....0.000......',
  '....00000002....',
  '...20000000000..',
  '..000000000000..',
  '..2000000000002.',
  '...00000000000..',
  '..000000000000..',
  '.2000000000000..',
  '..000000000000..',
  '..20000000000002',
  '...00000000000..',
  '..000000000000..',
  '.01200000000120.',
  '0122100000012210',
  '...0000000000...',
]);

// The chest after it is opened: lid tipped back, the dark inside showing over the gold rim.
const CHEST_OPEN = paste(FLOOR, [
  '..000000000000..',
  '.0aaaaaaaaaaaa0.',
  '.0abbbbbbbbbba0.',
  '.0aaaaaaaaaaaa0.',
  '.00000000000000.',
  '.0dddddddddddd0.',
  '.0d0000000000d0.',
  '.0d0000000000d0.',
  '.0dddddddddddd0.',
  '.0aaaaaaaaaaaa0.',
  '.0aaaaaaaaaaaa0.',
  '.0aaaaaaaaaaaa0.',
  '.0dddddddddddd0.',
  '.0bbbbbbbbbbbb0.',
  '..000000000000..',
]);

/* ---------- 0.4.16: Zelda's doors through a two-tile wall (32x32, north wall) ---------- */

/** The north wall band two tiles thick: a row of brick over the row with the ledge. */
const BAND = [...WALL, ...WALL_TOP].map((r) => r + r);

/** A 32x32 frame from a function of each pixel; '.' keeps the band. */
const over32 = (base: readonly string[], f: (x: number, y: number) => string): string[] =>
  base.map((row, y) => Array.from(row, (ch, x) => (f(x, y) === '.' ? ch : f(x, y))).join(''));

/**
 * Where a pixel sits in the doorway's arch: its distance out from the opening's middle (round at
 * the top, straight sides below). The opening (<= 8) is 16 px wide and runs down to the floor.
 */
const archD = (x: number, y: number): number => {
  const dx = Math.abs(x + 0.5 - 16);
  return y >= 12 ? dx : Math.hypot(dx, 12 - (y + 0.5));
};
const inArch = (x: number, y: number) => archD(x, y) <= 8;

/** The open doorway: a two-ring stone arch round a dark way through the wall. */
const DOOR_OPEN_THICK = over32(BAND, (x, y) => {
  const d = archD(x, y);
  if (d <= 8) return '0';
  if (d <= 9) return '8';
  if (d <= 10.5) return '9';
  if (d <= 11.5 && y < 12) return '0';
  return '.';
});

/** Locked: a plank door filling the arch, iron bands, and a gold lock plate with its keyhole. */
const DOOR_LOCKED_THICK = over32(DOOR_OPEN_THICK, (x, y) => {
  if (!inArch(x, y) || y < 4) return '.';
  const plate = x >= 12 && x <= 19 && y >= 15 && y <= 23;
  if (plate) {
    if (x === 12 || x === 19 || y === 15 || y === 23) return 'b';
    const hole = (x >= 15 && x <= 16 && y >= 17 && y <= 21) || (y === 18 && x >= 14 && x <= 17);
    return hole ? '0' : 'd';
  }
  if (y === 10 || y === 26) return '8'; // iron bands
  if (Math.abs(x + 0.5 - 16) >= 7.5) return 'b';
  return (x - 8) % 4 === 3 ? 'b' : 'a';
});

/** Shut: an iron grille dropped across the dark opening. */
const DOOR_SHUT_THICK = over32(DOOR_OPEN_THICK, (x, y) => {
  if (!inArch(x, y) || y < 5) return '.';
  if ((y - 6) % 7 === 0) return '9';
  if ((y - 6) % 7 === 1) return '8';
  if ((x - 9) % 4 === 0) return '9';
  if ((x - 9) % 4 === 1) return '8';
  return '.';
});

/** The way out: the arch brimming with light (two shimmer frames). */
const exitThick = (phase: number): string[] =>
  over32(DOOR_OPEN_THICK, (x, y) => {
    const d = archD(x, y);
    if (d > 8) return d <= 9 ? 'f' : '.';
    if (d > 7) return '5';
    const spark = (x * 7 + y * 3 + phase * 5) % 23 === 0;
    return spark ? 'f' : '6';
  });

/** A jagged crack down a column of the wall, from (x0, y0) to y1, drifting by `drift`. */
const crackPath = (x0: number, y0: number, y1: number, drift: readonly number[]) => {
  const px = new Set<string>();
  let x = x0;
  for (let y = y0; y <= y1; y++) {
    x += drift[(y - y0) % drift.length] as number;
    px.add(`${x},${y}`);
    px.add(`${x + 1},${y}`);
  }
  return px;
};
const CRACKS = [
  crackPath(15, 2, 30, [0, 1, 0, -1, -1, 0, 1, 0, 1, -1]),
  crackPath(9, 8, 26, [1, 0, -1, 0, 0, -1, 1]),
  crackPath(22, 6, 28, [0, -1, 1, 1, 0, -1, 0, 1]),
];
/** The bombable wall: three jagged cracks through the brick, chips lit along their edges. */
const WALL_CRACKED_THICK = over32(BAND, (x, y) => {
  if (CRACKS.some((c) => c.has(`${x},${y}`))) return '0';
  if (CRACKS.some((c) => c.has(`${x - 1},${y - 1}`))) return '2';
  // A crumbled hollow where the cracks meet.
  if (Math.hypot(x - 15.5, y - 16.5) < 3) return '0';
  return '.';
});

/** The blown-open wall: a ragged hole through both rows down to the floor, rubble at its feet. */
const WALL_HOLE_THICK = over32(BAND, (x, y) => {
  const rag = [0, 1, -1, 1, 0, -1, 0, 1][(y + x) % 8] as number;
  const d = archD(x, y) + rag * 0.6;
  if (y >= 29 && (x === 6 || x === 7 || x === 24 || x === 25)) return y === 29 ? '2' : '1';
  if (d <= 8.5) return '0';
  if (d <= 9.5) return '2';
  return '.';
});

/* ---------- 0.4.16: the map, the compass and the Triforce ---------- */

// The dungeon map: a rolled parchment with the rooms sketched on it.
const MAP = [
  '........',
  '.000000.',
  '0ffffff0',
  '0f5555d0',
  '0f5005d0',
  '0f5555d0',
  '0f5050d0',
  '0f5555d0',
  '0f0055d0',
  '0f5555d0',
  '0f5505d0',
  '0f5555d0',
  '0ffffff0',
  '0dddddd0',
  '.000000.',
  '........',
];

// The compass: a round gold case, its needle pointing north (red) and south.
const COMPASS = [
  '................',
  '.....000000.....',
  '...00dddddd00...',
  '..0ddffffffdd0..',
  '.0dff666666ffd0.',
  '.0df666ee666fd0.',
  '0df6666ee6666fd0',
  '0df666eeee666fd0',
  '0df66660066666d0',
  '0df666699666fdd0',
  '0df666699666fd0.',
  '.0df66699666fd0.',
  '.0ddff6666ffdd0.',
  '..00ddddddddd0..',
  '....000000000...',
  '................',
];

// A shard of the Triforce: a golden triangle, lit along its left face, shaded along its base.
const TRIFORCE = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    if (y < 1 || y > 14) return '.';
    const half = (y - 1) * 0.55 + 0.5; // the half-width at this row
    const dx = x + 0.5 - 8;
    if (Math.abs(dx) > half + 1) return '.';
    if (Math.abs(dx) > half || y === 14) return '0';
    if (y === 13) return 'c';
    if (dx < -half + 1.6) return 'f';
    if (dx > half - 1.4) return 'c';
    return 'd';
  }).join(''),
);

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

// The white sword, waiting in the secret shrine: a long white blade with a pale glow along its
// edge, a wide gold guard and a dark grip (the shrine's prize, 0.4.22: the sword beam).
const WHITE_SWORD_ICON = [
  '.......00.......',
  '......0660......',
  '.....056650.....',
  '.....056650.....',
  '.....056650.....',
  '.....056650.....',
  '.....056650.....',
  '.....056650.....',
  '.....056650.....',
  '...0000660000...',
  '..0ddddddddddd0.',
  '...0000bb0000...',
  '......0bb0......',
  '......0bb0......',
  '......0dd0......',
  '.......00.......',
];

// A heart container: a big heart ringed in gold, with a white glint.
const HEART_CONTAINER = [
  '................',
  '..0000....0000..',
  '.0dddd0..0dddd0.',
  '0dee66d00deeeed0',
  '0de6eeedddeeeed0',
  '0de6eeeeeeeeegd0',
  '0deeeeeeeeeeegd0',
  '0deeeeeeeeeeegd0',
  '.0deeeeeeeeegd0.',
  '..0deeeeeeeggd0.',
  '...0deeeeeegd0..',
  '....0deeeegd0...',
  '.....0deegd0....',
  '......0dgd0.....',
  '.......0d0......',
  '........0.......',
];

/** A round bomb in an 8x16 cell: cap and fuse on top, the ball filling the bottom. */
const bombIcon = (rim: string): string[] =>
  paste(
    Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => {
        const dx = x + 0.5 - 4;
        const dy = y + 0.5 - 11.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 4.1) return '.';
        if (r > 3.2) return '0';
        if (Math.hypot(dx + 1.3, dy + 1.3) < 0.9) return '6';
        if (r > 2.4 && dx + dy < -1.5) return rim;
        return dx + dy > 2 ? 'i' : 'h';
      }).join(''),
    ),
    ['.....00.', '....0bb0', '...0b00.', '..0000..', '..0980..', '..0000..'],
    0,
    2,
  );
const BOMB_ICON = bombIcon('h');
// The dropped refill: the same bomb with a bright rim, so it pops off the blue floor.
const BOMB_PICKUP = bombIcon('j');

// The boomerang: a curved wooden "<" with a gold-lit leading edge.
const BOOMERANG_ICON = [
  '........',
  '........',
  '.....00.',
  '....0ff0',
  '...0fa0.',
  '..0fa0..',
  '.0fa0...',
  '0fab0...',
  '0aab0...',
  '.0ab0...',
  '..0ab0..',
  '...0ab0.',
  '....0bb0',
  '.....00.',
  '........',
  '........',
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
    'wall-cracked': WALL_CRACKED,
    'wall-hole': WALL_HOLE,
    'chest-open': CHEST_OPEN,
    'white-sword-icon': WHITE_SWORD_ICON,
    'heart-container': HEART_CONTAINER,
    'bomb-pickup': BOMB_PICKUP,
    'boomerang-icon': BOOMERANG_ICON,
    'bomb-icon': BOMB_ICON,
    'door-open-thick': DOOR_OPEN_THICK,
    'door-locked-thick': DOOR_LOCKED_THICK,
    'door-shut-thick': DOOR_SHUT_THICK,
    'wall-cracked-thick': WALL_CRACKED_THICK,
    'wall-hole-thick': WALL_HOLE_THICK,
    'exit-0-thick': exitThick(0),
    'exit-1-thick': exitThick(1),
    map: MAP,
    compass: COMPASS,
    triforce: TRIFORCE,
  },
};

/* ------------------------------------------------------------------------------------------ */
/* Overhead Link (16x16)                                                                        */
/* ------------------------------------------------------------------------------------------ */

// He holds the sword in his left hand, so facing down the sword hand is on the viewer's right
// (mirrored facing up). No shield in the Shadow Keep (0.4.22): one set of poses.

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
const linkDown = (legs: readonly string[]) => [...HEAD_DOWN, ...BODY_DOWN, ...legs];

// Facing up: the back of the cap with its tail hanging down, hair.
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
const upBody = (legs: readonly string[]) => paste([...HEAD_UP, ...BODY_UP, ...legs], CAP_TAIL, 8, 7);

// Facing right: cap peak and tail streaming back, pointed ear, eye, nose.
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
const linkSide = (legs: readonly string[]) => [...HEAD_SIDE, ...BODY_SIDE, ...legs];

// Attacks: the sword arm thrust to the tile edge, where the blade sprite's grip overlaps the hand
// (see LINK_SWORD_GRIP below).
const ATTACK_DOWN = [
  ...HEAD_DOWN,
  '..022111111220..',
  '.02211111111220.',
  '.03211111111120.',
  '..005559955110..',
  '...02111110330..',
  '...0550..0330...',
  '...0000...00....',
];
const UP_ARM_RAISED = ['.00.', '0330', '0330', '0110', '0110', '0110', '0120', '0120', '0220'];
const ATTACK_UP = paste(
  paste(['.'.repeat(16), ...HEAD_UP, ...BODY_UP, '...0000..0000...'], CAP_TAIL, 8, 8),
  UP_ARM_RAISED,
  2,
  0,
);
const ATTACK_SIDE = [
  ...HEAD_SIDE,
  '...0221111120...',
  '...0211111110000',
  '...0211111111333',
  '...0555555550000',
  '...0211111120...',
  '..0550....0550..',
  '..0000....0000..',
];

// Throwing the boomerang or setting down a bomb: the free hand flung out, open, short of the
// sword's reach (no grip to hold), the other arm as in the walk.
const THROW_DOWN = [
  ...HEAD_DOWN,
  '..022111111220..',
  '.02211111111220.',
  '.03211111111120.',
  '..005559955110..',
  '...0211111330...',
  '...0550...00....',
  '...0000.........',
];
const UP_ARM_THROW = ['.00.', '0330', '0330', '0110', '0120', '0220'];
const THROW_UP = paste(paste([...HEAD_UP, ...BODY_UP, ...LEGS_A], CAP_TAIL, 8, 7), UP_ARM_THROW, 2, 3);
const THROW_SIDE = [
  ...HEAD_SIDE,
  '...0221111120...',
  '...021111111000.',
  '...0211111111330',
  '...055555555000.',
  '...0211111120...',
  '..0550....0550..',
  '..0000....0000..',
];

// Holding a prize up (the item-get pose): facing the viewer, both arms straight up beside the
// head, hands open at the top where the prize rests.
const ARM_UP = ['.0.', '030', '030', '010', '010', '010', '010', '020', '020', '020', '0.0'];
const HOLD = paste(
  paste(
    [
      ...HEAD_DOWN,
      '...0211111120...',
      '...0211111120...',
      '...0211111120...',
      '...0555995550...',
      '...0211111120...',
      '...0550..0550...',
      '...0000..0000...',
    ],
    ARM_UP,
    1,
    0,
  ),
  ARM_UP,
  12,
  0,
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

// A piece of a burst sword beam (8x8): a short blade shard pointing up-left, the way the
// top-left piece flies; flipped for the other three.
const BEAM_SHARD = [
  '00......',
  '0660....',
  '06770...',
  '.07780..',
  '..07880.',
  '...0880.',
  '....00..',
  '........',
];

/** A frame turned a quarter clockwise (square frames). */
const turnCw = (rows: readonly string[]): string[] =>
  rows.map((_, y) => rows.map((_, x) => (rows[rows.length - 1 - x] as string)[y]).join(''));

// The boomerang in flight (8x8): an L of wood with a gold elbow, spun a quarter turn per frame.
const BOOMERANG = [
  '.000000.',
  '09944450',
  '09455550',
  '0450000.',
  '0450....',
  '0450....',
  '0550....',
  '.00.....',
];
const BOOMERANG_SPIN = [BOOMERANG];
for (let i = 1; i < 4; i++) BOOMERANG_SPIN.push(turnCw(BOOMERANG_SPIN[i - 1] as string[]));

// A lit bomb (16x16): the blue ball with a glint, an iron cap and a fuse whose spark flickers.
const BOMB_BALL = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    const dx = x + 0.5 - 8;
    const dy = y + 0.5 - 10.5;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 5.6) return '.';
    if (r > 4.6) return '0';
    if (Math.hypot(dx + 1.8, dy + 1.8) < 1.1) return '6';
    if (r > 3.5 && dx + dy < -2.5) return 'e';
    return dx + dy > 2.5 ? 'b' : 'a';
  }).join(''),
);
const BOMB_TOP = ['.......0000.....', '......087700....', '......0000......'];
const FUSE = ['.........55.....', '........5.......'];
const bomb = (spark: readonly string[]) => paste(paste(paste(BOMB_BALL, BOMB_TOP, 0, 3), FUSE, 0, 1), spark);
const BOMB_0 = bomb(['..........6.....', '.........969....', '..........9.....']);
const BOMB_1 = bomb(['.........c.c....', '..........6.....', '.........c.c....']);

/*
 * The blast (32x32): a white-hot flash, a billowing fireball (white core, gold, orange, a red
 * rim, lumpy edge), then rings of grey smoke breaking apart.
 */
const blast = (paint: (r: number, a: number, x: number, y: number) => string): string[] =>
  Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => {
      const dx = x + 0.5 - 16;
      const dy = y + 0.5 - 16;
      return paint(Math.sqrt(dx * dx + dy * dy), Math.atan2(dy, dx), x, y);
    }).join(''),
  );
const BLAST_0 = blast((r, a) => {
  const edge = 7 + 2.5 * Math.max(0, Math.cos(4 * a)) ** 3;
  if (r > edge) return '.';
  if (r > edge - 1) return '0';
  if (r < 3) return '6';
  if (r < 5) return '9';
  return 'c';
});
const BLAST_1 = blast((r, a, x, y) => {
  const edge = 13.2 + 1.6 * Math.sin(7 * a) + 0.8 * Math.sin(3 * a + 1);
  if (r > edge) return '.';
  if (r > edge - 1.2) return '0';
  const t = r / edge;
  const dither = (x + y) % 2 === 0;
  if (t < 0.25 || (t < 0.32 && dither)) return '6';
  if (t < 0.5 || (t < 0.57 && dither)) return '9';
  if (t < 0.75 || (t < 0.82 && dither)) return 'c';
  return 'd';
});
// Smoke breaking up: a lumpy ring of soft white puffs (grey rims, grey undersides) with a few
// stray wisps, open in the middle where the fire was.
const PUFFS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + (i % 3) * 0.12;
  const d = i % 2 ? 11.5 : 9.8;
  return { x: 16 + d * Math.cos(a), y: 16 + d * Math.sin(a), r: i % 2 ? 3.3 : 4.4 };
});
const WISPS = [
  [3, 4],
  [28, 6],
  [2, 25],
  [29, 27],
  [16, 1],
] as const;
const BLAST_2 = blast((_r, _a, x, y) => {
  if (WISPS.some(([wx, wy]) => wx === x && wy === y)) return '7';
  for (const p of PUFFS) {
    const dx = x + 0.5 - p.x;
    const dy = y + 0.5 - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > p.r) continue;
    if (d > p.r - 1) return '8';
    return dx + dy < 0.5 ? '6' : '7';
  }
  return '.';
});

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
    'beam-shard': BEAM_SHARD,
    'boomerang-0': BOOMERANG_SPIN[0] as string[],
    'boomerang-1': BOOMERANG_SPIN[1] as string[],
    'boomerang-2': BOOMERANG_SPIN[2] as string[],
    'boomerang-3': BOOMERANG_SPIN[3] as string[],
    'bomb-0': BOMB_0,
    'bomb-1': BOMB_1,
    'blast-0': BLAST_0,
    'blast-1': BLAST_1,
    'blast-2': BLAST_2,
    'throw-down': THROW_DOWN,
    'throw-up': THROW_UP,
    'throw-side': THROW_SIDE,
    hold: HOLD,
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
