import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Original "armoured bounty hunter" character for the arm-cannon-and-morph-ball ("samus") role.
 * Drawn here from scratch: a stocky figure in a rounded helmet with a wide visor band, broad
 * two-tone shoulder pads, a thick barrel cannon in place of the right forearm and heavy boots.
 * The hunter also curls into a tucked somersault and rolls up into a glowing morph ball.
 *
 * Palette index roles (identical across every variant so recolours are plain index swaps):
 *   0 outline   1 light armour   2 dark armour (shoulders, boots, cannon)   3 visor
 *   4 white / highlight   5 glow (cannon muzzle, morph ball core)
 */
export const samusPalettes: Record<string, string[]> = {
  samus: [NES.black, NES.orange, NES.redDark, NES.greenLight, NES.white, NES.yellow],
  // Heavier suit: warmer, pinker light armour over orange plates.
  'samus-varia': [NES.black, NES.peach, NES.orange, NES.greenLight, NES.white, NES.yellow],
  // Invincibility flashes.
  'samus-star-0': [NES.black, NES.yellow, NES.redBright, NES.white, NES.white, NES.yellowLight],
  'samus-star-1': [NES.black, NES.cyan, NES.blueMid, NES.pink, NES.white, NES.white],
  'samus-star-2': [NES.black, NES.pink, NES.magenta, NES.greenLight, NES.white, NES.cyan],
  'samus-star-3': [NES.black, NES.white, NES.lightGray, NES.greenLight, NES.white, NES.yellow],
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

// Helmet, 16 wide, 10 rows (rows 4..13 of the standing pose): rounded dome with a white ridge, a wide
// visor band across the front with a glint, dark jaw plates and a short neck.
const head = [
  '.....000000.....',
  '....01144110....',
  '...0111111110...',
  '..011111111110..',
  '..011100000000..',
  '..011104333330..',
  '..011103333330..',
  '..011100000000..',
  '..02211111120...',
  '.....022220.....',
];

// Torso at rest (rows 14..24): broad dark shoulder pads, light chest with a dark belt, back arm
// hanging (light upper arm, dark glove) and the cannon arm hanging muzzle-down at the hip.
const torso = [
  '.00000111100000.',
  '0222201111022220',
  '0222201111022220',
  '0222011111102220',
  '.01001111110220.',
  '.01001111110220.',
  '.01002222220220.',
  '.02001111110220.',
  '.02001111110250.',
  '..000111111000..',
  '....00000000....',
];

// Torso turned toward the target with the cannon arm removed: the back pad foreshortens by a pixel
// and shoot/aim frames add the cannon as its own layer.
const torsoShoot = [
  '..0000111100000.',
  '.022201111022220',
  '.022201111022220',
  '.022011111102220',
  '.01001111110....',
  '.01001111110....',
  '.01002222220....',
  '.02001111110....',
  '.02001111110....',
  '..0001111110....',
  '....00000000....',
];

// Cannon held level: a thick dark barrel coming off the shoulder pad with a white ring and a glowing
// bore at the muzzle. 5 wide, 5 tall; its left column is left open where it meets the pad.
const cannonFwd = ['.0000', '22240', '22245', '22240', '00000'];

// Cannon raised straight up beside the helmet: ring and glow at the top, barrel running down into the
// shoulder pad. 4 wide, 11 tall.
const cannonUp = ['.55.', '0440', '0220', '0220', '0220', '0220', '0220', '0220', '0220', '0220', '.220'];

// Legs (rows 25..31 of the standing pose), 16 wide, 7 rows: short light thighs, tall dark boots with a
// light shin stripe and a toe that juts forward.
const legsStand = [
  '....01100110....',
  '....01100110....',
  '...02210.02210..',
  '...02210.02210..',
  '..022210.022210.',
  '..022220.022220.',
  '..000000.000000.',
];

// Contact pose: legs scissored wide.
const legsWalk0 = [
  '...0110..0110...',
  '..0110....0110..',
  '.02210....02210.',
  '.02210....02210.',
  '022210....022210',
  '022220....022220',
  '000000....000000',
];

// Passing pose: legs together, body a pixel higher (8 rows).
const legsWalk1 = [
  '....01100110....',
  '....01100110....',
  '....01100110....',
  '...02210.02210..',
  '...02210.02210..',
  '..022210.022210.',
  '..022220.022220.',
  '..000000.000000.',
];

// Lead pose: front knee lifted with the boot out in front, back leg planted.
const legsWalk2 = [
  '....0110.0110...',
  '....0110.022210.',
  '...02210.022220.',
  '...02210.000000.',
  '..022210........',
  '..022220........',
  '..000000........',
];

// Jump: knees drawn up together, boots off the floor.
const legsJump = [
  '....01100110....',
  '....01100110....',
  '...02210.02210..',
  '...02210.02210..',
  '..022210.022210.',
  '..000000.000000.',
  '................',
];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

const standing = (legs: readonly string[], dy = 0): string[] =>
  compose(W, H, [head, 0, 4 + dy], [torso, 0, 14 + dy], [legs, 0, 25 + dy]);

// Shooting poses sit one pixel to the left so the level cannon has room to reach the frame edge.
const shooting = (legs: readonly string[], dy = 0): string[] =>
  compose(W, H, [head, -1, 4 + dy], [torsoShoot, -1, 14 + dy], [legs, -1, 25 + dy], [cannonFwd, 11, 17 + dy]);

const idle = standing(legsStand);
const walk0 = standing(legsWalk0);
const walk1 = standing(legsWalk1, -1);
const walk2 = standing(legsWalk2);

const shoot = shooting(legsStand);
const walkShoot0 = shooting(legsWalk0);
const walkShoot1 = shooting(legsWalk1, -1);
const walkShoot2 = shooting(legsWalk2);
const jump = shooting(legsJump);

// Standing with the cannon pointing straight up past the helmet.
const aimUp = compose(W, H, [head, -1, 4], [torsoShoot, -1, 14], [legsStand, -1, 25], [cannonUp, 12, 4]);

// Knockback: head thrown back, cannon arm flung up and out, legs splayed.
const hurt = compose(
  W,
  H,
  [head, -1, 5],
  [torsoShoot.slice(0, 10), 0, 15],
  [legsWalk0, 0, 25],
  [['.0000', '22240', '22245', '00000'], 11, 13],
);

// Collapsed on both knees in the lower half: helmet bowed forward over the chest, shoulder pad
// hunched up behind it, cannon arm dropped to the floor in front and the boots folded back.
const die = compose(W, H, [
  [
    '......000000....',
    '.....01144110...',
    '....0111111110..',
    '.000011111111110',
    '0222011100000000',
    '0222011104333330',
    '0022011100000000',
    '.0100221111120..',
    '.0100211111110..',
    '.020021111102240',
    '0220022222202245',
    '0000000000000000',
  ],
  0,
  20,
]);

// Tucked somersault, 16x16: helmet top-right, shoulder pad at the back, knees pulled up to the chest,
// boots at the bottom and the cannon hugged across the front. Each spin frame turns it a quarter.
const spin0 = [
  '......000000....',
  '.....01144110...',
  '....0111111110..',
  '...00111000000..',
  '..0221104333330.',
  '.022211000000000',
  '.0222011111110..',
  '.0201111111100..',
  '.01022222220220.',
  '.01011111110225.',
  '.0001111111000..',
  '..02210.02210...',
  '..02210.02210...',
  '.022210.022210..',
  '.022220.022220..',
  '.000000.000000..',
];
const spin1 = rotateCW(spin0);
const spin2 = rotateCW(spin1);
const spin3 = rotateCW(spin2);

// Morph ball, 12x12: light shell with a dark hatch ring around a glowing core and a white highlight
// that walks around the rim as the ball rolls (one quarter turn per frame).
const ball0 = [
  '....0000....',
  '..00441100..',
  '.0141111110.',
  '.0411111110.',
  '011122221110',
  '011125521110',
  '011125521110',
  '011122221110',
  '.0111111110.',
  '.0111111110.',
  '..00111100..',
  '....0000....',
];
const lowerHalf = (rows: readonly string[]): string[] => compose(W, H, [rows, 2, 20]);
const spinFrame = (rows: readonly string[]): string[] => compose(W, H, [rows, 0, 16]);
const ball1 = rotateCW(ball0);
const ball2 = rotateCW(ball1);
const ball3 = rotateCW(ball2);

export const samusDef: SpriteDef = {
  palette: 'samus',
  frames: {
    idle,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    shoot,
    'walk-shoot-0': walkShoot0,
    'walk-shoot-1': walkShoot1,
    'walk-shoot-2': walkShoot2,
    jump,
    'aim-up': aimUp,
    hurt,
    die,
    'spin-0': spinFrame(spin0),
    'spin-1': spinFrame(spin1),
    'spin-2': spinFrame(spin2),
    'spin-3': spinFrame(spin3),
    'ball-0': lowerHalf(ball0),
    'ball-1': lowerHalf(ball1),
    'ball-2': lowerHalf(ball2),
    'ball-3': lowerHalf(ball3),
  },
};
