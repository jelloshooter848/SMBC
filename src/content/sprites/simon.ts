import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Original "whip-wielding vampire hunter" character for the whip-and-subweapon ("simon") role.
 * Drawn here from scratch: a broad-shouldered hunter with a knotted headband and a swept-back
 * mane of hair, bare muscular arms, a short leather breastplate over the chest, trousers tucked
 * into heavy boots and a coiled whip hanging off the back hip. The whip strikes are drawn in
 * 48-wide frames so the lash can sit in the same frame as the body (body in columns 0-15, whip
 * running right from the fist).
 *
 * Palette index roles (identical across every variant so recolours are plain index swaps):
 *   0 outline   1 skin   2 hair / headband (dark)   3 tunic / armour (light brown)
 *   4 trousers & boots (dark brown)   5 whip, buckle and metal highlight (light)
 */
export const simonPalettes: Record<string, string[]> = {
  simon: [NES.black, NES.skin, NES.redDark, NES.brown, NES.brownDark, NES.lightGray],
  // Invincibility flashes.
  'simon-star-0': [NES.black, NES.yellow, NES.redBright, NES.white, NES.orange, NES.yellowLight],
  'simon-star-1': [NES.black, NES.cyan, NES.blueMid, NES.pink, NES.blueDark, NES.white],
  'simon-star-2': [NES.black, NES.pink, NES.magenta, NES.greenLight, NES.purple, NES.cyan],
  'simon-star-3': [NES.black, NES.white, NES.lightGray, NES.yellow, NES.gray, NES.white],
};

/* ---------- composition helpers ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
function paste(base: readonly string[], layer: readonly string[], dx: number, dy: number): string[] {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    const ty = y + dy;
    const target = out[ty];
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

const compose = (w: number, h: number, ...layers: [readonly string[], number, number][]): string[] =>
  layers.reduce<string[]>((acc, [rows, dx, dy]) => paste(acc, rows, dx, dy), blank(w, h));

/* ---------- parts (all facing right) ---------- */

// Head, 16 wide, 10 rows (rows 3..12 of the standing pose): a swept-back mane with a tail hanging
// behind the neck, a knotted headband across the brow, a square jaw with one eye and a small nose,
// and a thick neck.
const head = [
  '.....000000.....',
  '....02222220....',
  '...02222222220..',
  '..022200000000..',
  '..0220222222220.',
  '..0220111111110.',
  '...0011111101110',
  '....0111111110..',
  '.....01111110...',
  '......011110....',
];

// Torso at rest (rows 13..21): a flat shelf of shoulders in armour, bare arms hanging at both
// sides, the breastplate down to a black belt with a light buckle, and trousers starting at the hips.
const torsoIdle = [
  '.00000000000000.',
  '0333333333333330',
  '0111033333301110',
  '0111033333301110',
  '.01103333330110.',
  '.01103333330110.',
  '.01100055000110.',
  '.01104444440110.',
  '..000444444000..',
];

// Airborne torso: both arms held slightly out from the body, fists level with the hips.
const torsoArmsOut = [
  '.00000000000000.',
  '0333333333333330',
  '0111033333301110',
  '0111033333301110',
  '0110033333300110',
  '0110033333300110',
  '0110000550000110',
  '0000044444400000',
  '....04444440....',
];

// Striking torso (rows 13..21): the front arm thrust straight out at shoulder height so the fist
// ends on the frame edge at rows 14-15; the whip layers attach at column 16.
const torsoStrike = [
  '.000000000000000',
  '0333333333311111',
  '0111033333311111',
  '0111033333300000',
  '.01103333330....',
  '.01103333330....',
  '.01100055000....',
  '.01104444440....',
  '..0004444440....',
];

// Wind-up torso (rows 13..21): the front arm leaves the shoulder straight up (drawn by windupArm).
const torsoWindup = [
  '.000000000000110',
  '0333333333333110',
  '011103333330000.',
  '011103333330....',
  '.01103333330....',
  '.01103333330....',
  '.01100055000....',
  '.01104444440....',
  '..0004444440....',
];

// Raised front arm for the wind-up: fist at the top, running down the right edge into the shoulder.
// 4 wide, 12 rows (rows 2..13).
const windupArm = Array.from({ length: 12 }, () => '0110');

// Whip trailing back over the head during the wind-up: it leaves the fist, loops up and back, and
// the tip hangs down behind the hair. 16 wide, 3 rows (rows 0..2).
const windupLash = ['........0555550.', '.....0550000050.', '....050.........'];

// Arm swung up and forward (rows 7..21): the front arm climbs diagonally from the shoulder to an
// open hand at the top right corner; used for the mid-swing and for throwing a sub-weapon.
const torsoArmUp = [
  '..............00',
  '.............011',
  '.............011',
  '............0110',
  '............0110',
  '...........0110.',
  '.00000000000110.',
  '0333333333333330',
  '011103333330000.',
  '011103333330....',
  '.01103333330....',
  '.01103333330....',
  '.01100055000....',
  '.01104444440....',
  '..0004444440....',
];

// Knockback torso (rows 7..21): both arms flung straight up beside the head, open hands at the top.
const torsoHurt = [
  '0110.........011',
  '0110.........011',
  '0110.........011',
  '0110.........011',
  '0110.........011',
  '0110.........011',
  '0110000000000011',
  '0110333333333011',
  '.000033333300000',
  '....03333330....',
  '....03333330....',
  '....00055000....',
  '....04444440....',
  '....04444440....',
  '....04444440....',
];

// Coiled whip hanging off the back hip: a light ring with a dark hole. 4x4.
const coil = ['0550', '5005', '5005', '0550'];

// Legs (rows 22..31 of the standing pose), 16 wide, 10 rows: hips, straight legs with a black cuff
// where the trousers meet the boots, and toes jutting forward.
const legsStand = [
  '....04444440....',
  '....04444440....',
  '....04400440....',
  '....04400440....',
  '....04400440....',
  '....00000000....',
  '....04400440....',
  '....04400440....',
  '....044404440...',
  '....000000000...',
];

// Contact pose: legs scissored wide.
const legsWalk0 = [
  '....04444440....',
  '...044404440....',
  '..0440...0440...',
  '..0440...0440...',
  '.0440.....0440..',
  '.0000.....0000..',
  '.0440.....0440..',
  '.0440.....0440..',
  '.04440....04440.',
  '.00000....00000.',
];

// Passing pose: legs together, body a pixel higher (11 rows).
const legsWalk1 = [
  '....04444440....',
  '....04444440....',
  '....04444440....',
  '....04400440....',
  '....04400440....',
  '....04400440....',
  '....00000000....',
  '....04400440....',
  '....04400440....',
  '....044404440...',
  '....000000000...',
];

// Lead pose: front knee lifted with the boot out in front, back leg planted.
const legsWalk2 = [
  '....04444440....',
  '....044404440...',
  '....0440.04440..',
  '....0440..0440..',
  '....0440..0000..',
  '....0000..0440..',
  '....0440..04440.',
  '....0440..00000.',
  '....04440.......',
  '....00000.......',
];

// Jump: knees drawn up to the front, boots tucked under and off the floor.
const legsJump = [
  '....04444440....',
  '....0444444440..',
  '.....0004444440.',
  '.......0444440..',
  '......00000000..',
  '......04404440..',
  '.....044404440..',
  '.....000000000..',
  '................',
  '................',
];

// Folded legs for the crouch (rows 30..31): both thighs flat with the boots side by side.
const legsCrouch = ['.00444400444400.', '..000000000000..'];

/* ---------- whips (all start at column 0 = the pixel right of the fist) ---------- */

// Leather whip, 16 px: a light lash over a dark edge, tapering at the tip.
const lashLeather = ['................', '5555555555555555', '000000000000000.'];

// Chain whip, 24 px: the same lash with a knot standing up every six pixels.
const lashChain = ['..55....55....55....55..', '555555555555555555555555', '000000000000000000000000'];

// Morning-star whip, 32 px: the lash ends in a spiked ball (a 5x5 diamond with a dark core).
const lashStar = [
  '.............................5..',
  '............................555.',
  '55555555555555555555555555555055',
  '000000000000000000000000000.555.',
  '.............................5..',
];

/* ---------- frames ---------- */

const W = 16;
const WW = 48;
const H = 32;

const standing = (legs: readonly string[], dy = 0): string[] =>
  compose(W, H, [head, 0, 3 + dy], [torsoIdle, 0, 13 + dy], [legs, 0, 22 + dy], [coil, 1, 21 + dy]);

const idle = standing(legsStand);
const walk0 = standing(legsWalk0);
const walk1 = standing(legsWalk1, -1);
const walk2 = standing(legsWalk2);

const jump = compose(W, H, [head, 0, 3], [torsoArmsOut, 0, 13], [legsJump, 0, 22], [coil, 1, 21]);

// Tossing a sub-weapon: head ducked back a touch, front arm reaching up and forward.
const throwFrame = compose(W, H, [torsoArmUp, 0, 7], [head, -2, 3], [legsStand, 0, 22], [coil, 1, 21]);

// Knockback: arms up, head thrown back between them, legs splayed.
const hurt = compose(W, H, [head, -2, 4], [torsoHurt, 0, 7], [legsWalk0, 0, 22], [coil, 1, 21]);

// Crouch: the figure folds into the lower half, head on the shoulders and legs flat.
const crouchBody = ['.00000000000000.', '0333333333333330', '0111033333301110', '.01100055000110.'];
const crouch = compose(W, H, [head, 0, 16], [crouchBody, 0, 26], [legsCrouch, 0, 30]);

// Crouching strike body (rows 16..31): head leaning back, the front arm raised to chin height and
// thrust forward so the fist ends on the frame edge at rows 22-23.
const crouchStrikeBody = [
  '...000000.......',
  '..02222220......',
  '.02222222220....',
  '022200000000....',
  '0220222222220...',
  '0220111111110000',
  '.001111110111011',
  '..01111111101111',
  '...01111110.0110',
  '....011110..0110',
  '.000000000000110',
  '0333333333333110',
  '0111033333330...',
  '.01100055000....',
  '.00444400444400.',
  '..000000000000..',
];

// Collapsed on both knees in the lower half: head bowed into the chest, shoulders slumped forward,
// arms limp at the sides and the boots folded flat behind.
const die = compose(W, H, [
  [
    '.....000000.....',
    '....02222220....',
    '...02222222220..',
    '..022200000000..',
    '..0220222222220.',
    '.00000111111110.',
    '03333001111110..',
    '0333333011110110',
    '0111033333300110',
    '0111000550000110',
    '0004444444044440',
    '0000000000000000',
  ],
  0,
  20,
]);

// Whip wind-up: head leaning back, arm straight up in front of the jaw, lash trailing back over the hair.
const whip0 = compose(
  WW,
  H,
  [head, -2, 3],
  [windupArm, 12, 2],
  [torsoWindup, 0, 13],
  [legsStand, 0, 22],
  [windupLash, 0, 0],
);

// Mid-swing: arm forward and up, the lash arcing overhead and coming down toward column 28.
const swingLash = [
  '.....555......',
  '...550005.....',
  '..500....05...',
  '550......05...',
  '00.........05.',
  '...........05.',
  '...........050',
  '............0.',
];
const whip1 = compose(WW, H, [torsoArmUp, 0, 7], [head, -2, 3], [legsWalk0, 0, 22], [swingLash, 16, 4]);

// Standing strike: lash level with the shoulder at row 14.
const strike = (lash: readonly string[]): string[] =>
  compose(WW, H, [head, 0, 3], [torsoStrike, 0, 13], [legsWalk0, 0, 22], [lash, 16, 14 - lashRow(lash)]);

// Crouching strike: lash at row 22.
const crouchStrike = (lash: readonly string[]): string[] =>
  compose(WW, H, [crouchStrikeBody, 0, 16], [lash, 16, 22 - lashRow(lash)]);

/** Row of the lash line inside a whip layer (the row that starts with a 5). */
function lashRow(lash: readonly string[]): number {
  return lash.findIndex((r) => r.startsWith('5'));
}

// Swimming (0.4.25): a flutter kick. Arms out with the legs scissored, then the arms pulled in
// and the legs drawn back together, the body bobbing a pixel between the two.
const legsFlutter0 = [
  '....04444440....',
  '....04444440....',
  '....0440.0440...',
  '...0440..0440...',
  '...0440...0440..',
  '...0000...0000..',
  '..0440.....0440.',
  '..0440.....0440.',
  '.04440.....04440',
  '.00000.....00000',
];
const legsFlutter1 = [
  '....04444440....',
  '....04444440....',
  '....04400440....',
  '....04400440....',
  '....04400440....',
  '....00000000....',
  '...0440..0440...',
  '..0440....0440..',
  '.04440....04440.',
  '.00000....00000.',
];
const swim0 = compose(W, H, [head, 0, 3], [torsoArmsOut, 0, 13], [legsFlutter0, 0, 22], [coil, 1, 21]);
const swim1 = compose(W, H, [head, 0, 2], [torsoIdle, 0, 12], [legsFlutter1, 0, 21], [coil, 1, 20]);

export const simonDef: SpriteDef = {
  palette: 'simon',
  frames: {
    idle,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    jump,
    crouch,
    throw: throwFrame,
    hurt,
    die,
    'swim-0': swim0,
    'swim-1': swim1,
    'whip-0': whip0,
    'whip-1': whip1,
    'whip-leather': strike(lashLeather),
    'whip-chain': strike(lashChain),
    'whip-star': strike(lashStar),
    'crouch-whip-leather': crouchStrike(lashLeather),
    'crouch-whip-chain': crouchStrike(lashChain),
    'crouch-whip-star': crouchStrike(lashStar),
  },
};
