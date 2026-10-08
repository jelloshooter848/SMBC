import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Original "jungle commando" character for the run-and-gun ("bill") role.
 * Drawn here from scratch: a broad-shouldered, shirtless soldier with short dark hair under a
 * red headband whose tails trail behind him, an ammo belt slung diagonally across the chest from
 * the front shoulder down to the back hip, a red waist belt, baggy blue trousers tucked into
 * dark boots and a long grey rifle with a dark stock carried in both hands. The rifle swings
 * level, straight up, diagonally up and diagonally down, and he can lie flat with it.
 *
 * Palette index roles (identical across every variant so recolours are plain index swaps):
 *   0 outline   1 skin   2 hair & boots (dark)   3 trousers (blue)
 *   4 headband, ammo belt & waist belt (red)   5 rifle & metal (grey)
 */
export const billPalettes: Record<string, string[]> = {
  bill: [NES.black, NES.skin, NES.brownDark, NES.blueMid, NES.redBright, NES.lightGray],
  // Invincibility flashes.
  'bill-star-0': [NES.black, NES.yellow, NES.orange, NES.white, NES.redBright, NES.yellowLight],
  'bill-star-1': [NES.black, NES.cyan, NES.blueLight, NES.pink, NES.white, NES.white],
  'bill-star-2': [NES.black, NES.pink, NES.magenta, NES.greenLight, NES.purple, NES.cyan],
  'bill-star-3': [NES.black, NES.white, NES.lightGray, NES.yellow, NES.gray, NES.white],
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

/** Rotate a square block a quarter turn clockwise. */
const rotateCW = (rows: readonly string[]): string[] => {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
};

/* ---------- parts (all facing right) ---------- */

// Head, 16 wide, 9 rows (rows 3..11 of the standing pose): a cap of short dark hair, the red
// headband across the brow with its two tails trailing back and down behind the head, a wide
// square face with one dark eye near the front, a strong jaw and a short neck.
const head = [
  '......000000....',
  '.....02222220...',
  '....0222222220..',
  '...04444444440..',
  '.4402111111110..',
  '44..0211110110..',
  '....0111111110..',
  '.....01111110...',
  '......011110....',
];

// Torso with the rifle held level (rows 12..21): broad bare shoulders, the ammo belt running
// from the front shoulder down to the back hip, the back arm hanging to the stock, the front
// arm reaching forward under the barrel, a narrow waist and the red waist belt. The rifle runs
// across the chest: dark stock poking out behind the back at columns 1-2, grey barrel to
// column 14 with a dark line under the muzzle end.
const torsoLevel = [
  '...0000000000...',
  '..011111111110..',
  '..0111111114110.',
  '.01101111141110.',
  '022555555555555.',
  '.02110114110110.',
  '...00014111000..',
  '.....0411110....',
  '.....0111110....',
  '.....0444440....',
];

// Muzzle flash at the barrel tip (column 15, rows 15..17): a bright burst with a red centre.
const flash = ['5', '4', '5'];

// Torso with both arms at the body (rows 12..21): the back arm hangs a little apart from the
// chest so a hand can rest on the stock, the front side of the chest is clear for a raised arm.
// Used under the aiming rifles.
const torsoArms = [
  '...0000000000...',
  '..011111111110..',
  '..011111111410..',
  '.0110111114110..',
  '.0110111141110..',
  '..00011141110...',
  '....01141110....',
  '.....0411110....',
  '.....0111110....',
  '.....0444440....',
];

// Rifle pointing straight up, 3 wide (columns 12..14 of the frame), rows 0..18: grey barrel
// from the top row down the front of the face, a dark edge on its right, the front hand and
// forearm on the barrel from chin to chest, the back hand at the trigger and the dark stock
// dropping to the waist.
const rifleUp = [
  '.50',
  '.50',
  '.50',
  '.50',
  '.50',
  '.50',
  '.50',
  '.50',
  '.50',
  '050',
  '150',
  '150',
  '150',
  '150',
  '150',
  '220',
  '220',
  '.20',
  '.00',
];

// Rifle at 45 degrees up and to the right (rows 8..18): the barrel climbs from the stock at
// the back hip past the face to the frame edge, a dark edge under it all the way; the front hand
// grips it over the front shoulder.
const rifleDiagUp = [
  '...............5',
  '..............50',
  '.............50.',
  '............50..',
  '...........5110.',
  '..........50....',
  '.........50.....',
  '........50......',
  '.....2250.......',
  '....0220........',
  '.....000........',
];

// Rifle at 45 degrees down and to the right (rows 12..22): the stock sits at the front shoulder
// and the barrel drops past the hip to the bottom right, a dark edge under it.
const rifleDiagDown = [
  '......00........',
  '.....0220.......',
  '.....0225.......',
  '......0005......',
  '.........05.....',
  '..........05....',
  '...........05...',
  '............05..',
  '.............05.',
  '..............05',
  '...............0',
];

// Knockback torso (rows 11..21): both arms thrown up in a V with the fists open at the top, the
// neck between them, a wide chest and the belts as usual.
const torsoHurt = [
  '.011........110.',
  '.011.011110.110.',
  '.01100000000110.',
  '.01111111111110.',
  '..000111411000..',
  '....01114110....',
  '....01141110....',
  '....01411110....',
  '.....0411110....',
  '.....0111110....',
  '.....0444440....',
];

// Rifle still clutched in the raised front hand when hurt: a short vertical barrel with a dark
// edge, 2 wide (columns 13..14), rows 4..10.
const rifleHurt = Array.from({ length: 7 }, () => '50');

// Legs (rows 22..31 of the standing pose), 16 wide, 10 rows: baggy blue trousers over two
// straight legs, dark boots with the toes pointing forward.
const legsStand = [
  '.....0333330....',
  '.....0333330....',
  '.....0330330....',
  '.....0330330....',
  '.....0330330....',
  '.....0330330....',
  '.....0220220....',
  '.....0220220....',
  '....022002220...',
  '....000000000...',
];

// Run, stride: both legs scissored wide, the back toe trailing off the floor.
const legsRun0 = [
  '.....0333330....',
  '....03300330....',
  '....0330.0330...',
  '...0330...0330..',
  '...0330...0330..',
  '..0330....0330..',
  '..0220....0220..',
  '.02200....0220..',
  '..00......02220.',
  '..........00000.',
];

// Run, passing: back leg planted under the body, front knee driving forward (11 rows, body a
// pixel higher).
const legsRun1 = [
  '.....0333330....',
  '.....0333330....',
  '.....03303330...',
  '.....0330.0330..',
  '.....0330.0330..',
  '.....0330.0330..',
  '.....0220.0220..',
  '.....0220.02220.',
  '.....0220.00000.',
  '.....02220......',
  '.....00000......',
];

// Run, lead: front thigh lifted level with the shin hanging, back leg stretched back pushing off
// the toe.
const legsRun2 = [
  '.....0333330....',
  '....0330033330..',
  '...0330.000330..',
  '..0330....0330..',
  '..0330....0330..',
  '.0330.....0330..',
  '.0220.....02220.',
  '.0220.....00000.',
  '.02220..........',
  '.00000..........',
];

// Airborne: knees tucked up to the chest, shins hanging side by side, boots off the floor.
const legsJump = [
  '.....0333330....',
  '.....033333330..',
  '......000333330.',
  '........0330330.',
  '........0330330.',
  '........0220220.',
  '........0000000.',
  '................',
  '................',
  '................',
];

// Prone (rows 24..31): flat on the ground, boots to the left and the head raised at the right.
// Hair and headband on top of the lifted head, the eye looking forward, the ammo belt crossing
// the chest, the trousers running back to the boots, and the rifle lying level in front with
// its stock under the chin and the barrel reaching the frame edge, both hands beneath it.
const proneBody = [
  '..........0000..',
  '.........022220.',
  '.........0444440',
  '.....00000211010',
  '....01141111110.',
  '.033334122555555',
  '02233301101100..',
  '0220000000000...',
];

// Fallen (rows 20..31): sat down hard with the head dropped forward onto the chest, the
// headband tails hanging, both arms slack at the sides, the legs stretched out in front and
// the rifle lying dropped behind on the ground.
const dieBody = [
  '.....00000......',
  '....0222220.....',
  '...044444440....',
  '..4402111110....',
  '.....0211100....',
  '...000011110....',
  '..011111114110..',
  '.0110111141110..',
  '.011011141110330',
  '.000011411433220',
  '5520033333333220',
  '0000000000000000',
];

// Tucked somersault, 16x16: head at the top, the chest rounded below it with the ammo belt
// crossing, the rifle hugged level across the middle of the tuck with a hand on each end, the
// knees drawn up under it and the boots folded underneath. Each spin frame turns it a quarter
// clockwise.
const spin0 = [
  '................',
  '.....000000.....',
  '....02222220....',
  '...0444444440...',
  '..021111110110..',
  '.02111111111110.',
  '.0111111111110..',
  '.0111114111110..',
  '.0111141111110..',
  '0225555555555550',
  '.011033333330110',
  '..0003333333000.',
  '....02200220....',
  '....00000000....',
  '................',
  '................',
];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

const standing = (legs: readonly string[], dy = 0): string[] =>
  compose(W, H, [head, 0, 3 + dy], [torsoLevel, 0, 12 + dy], [legs, 0, 22 + dy]);

// Run: the head leans a pixel forward over the level rifle.
const running = (legs: readonly string[], dy = 0): string[] =>
  compose(W, H, [head, 1, 3 + dy], [torsoLevel, 0, 12 + dy], [legs, 0, 22 + dy]);

const idle = standing(legsStand);
const shoot = paste(idle, flash, 15, 15);
const walk0 = running(legsRun0);
const walk1 = running(legsRun1, -1);
const walk2 = running(legsRun2);

// Aim up: the body steps a pixel back so the vertical rifle fits in front of the face.
const aimUp = compose(W, H, [head, -1, 3], [torsoArms, -1, 12], [legsStand, -1, 22], [rifleUp, 12, 0]);

const aimDiagUp = compose(W, H, [head, 0, 3], [torsoArms, 0, 12], [legsStand, 0, 22], [rifleDiagUp, 0, 8]);

// Aim down: airborne with the knees tucked, the rifle angled at the ground ahead.
const aimDiagDown = compose(
  W,
  H,
  [head, 0, 3],
  [torsoArms, 0, 12],
  [legsJump, 0, 22],
  [rifleDiagDown, 0, 12],
);

const prone = compose(W, H, [proneBody, 0, 24]);

// Knockback: head thrown back, arms up with the rifle still in the front fist, legs splayed.
const hurt = compose(W, H, [head, -1, 3], [torsoHurt, 0, 11], [rifleHurt, 13, 4], [legsRun0, 0, 22]);

const die = compose(W, H, [dieBody, 0, 20]);

const spin1 = rotateCW(spin0);
const spin2 = rotateCW(spin1);
const spin3 = rotateCW(spin2);
const spinFrame = (rows: readonly string[]): string[] => compose(W, H, [rows, 0, 16]);

// Swimming (0.4.25): the rifle held level over the water line with a kick below, Contra style.
// Legs scissored, then drawn together with the body a pixel higher; firing levels the rifle with a
// flash, or raises it straight up or at 45 degrees.
const legsSwimKick = [
  '.....0333330....',
  '....03300330....',
  '...0330..0330...',
  '..0330....0330..',
  '.0330......0330.',
  '0220........0220',
  '000..........000',
  '................',
  '................',
  '................',
];
const legsSwimTuck = [
  '.....0333330....',
  '.....0333330....',
  '.....0330330....',
  '....0330.0330...',
  '....0330.0330...',
  '...0220...0220..',
  '...000.....000..',
  '................',
  '................',
  '................',
];
const swim0 = compose(W, H, [head, 0, 3], [torsoLevel, 0, 12], [legsSwimKick, 0, 22]);
const swim1 = compose(W, H, [head, 0, 2], [torsoLevel, 0, 11], [legsSwimTuck, 0, 21]);
const swimShoot = paste(swim0, flash, 15, 15);
const swimAimUp = compose(W, H, [head, -1, 3], [torsoArms, -1, 12], [legsSwimKick, -1, 22], [rifleUp, 12, 0]);
const swimAimDiagUp = compose(
  W,
  H,
  [head, 0, 3],
  [torsoArms, 0, 12],
  [legsSwimKick, 0, 22],
  [rifleDiagUp, 0, 8],
);

export const billDef: SpriteDef = {
  palette: 'bill',
  frames: {
    idle,
    shoot,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    'aim-up': aimUp,
    'aim-diag-up': aimDiagUp,
    'aim-diag-down': aimDiagDown,
    prone,
    'spin-0': spinFrame(spin0),
    'spin-1': spinFrame(spin1),
    'spin-2': spinFrame(spin2),
    'spin-3': spinFrame(spin3),
    hurt,
    die,
    'swim-0': swim0,
    'swim-1': swim1,
    'swim-shoot': swimShoot,
    'swim-aim-up': swimAimUp,
    'swim-aim-diag-up': swimAimDiagUp,
  },
};
