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
  // Pit and Dark Pit's palettes live with their own sheet (pit.ts).
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

// Crouch (Classic SMBC, SA-C4), the body in the bottom 15 rows: helmet, shoulder pads and knees
// folded under; `crouch-shoot` holds the cannon level at helmet height (the crouched muzzle).
const legsCrouch = [
  '..0222111122220.',
  '.02221100112220.',
  '.0222100.022210.',
  '022222000222220.',
  '0000000.0000000.',
];
const crouch = compose(W, H, [head, 0, 17], [torso.slice(0, 4), 0, 24], [legsCrouch, 0, 27]);
const crouchShoot = compose(
  W,
  H,
  [head, -2, 17],
  [torsoShoot.slice(0, 4), -2, 24],
  [legsCrouch, -1, 27],
  [cannonFwd, 11, 18],
);

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

/*
 * The morph ball's bomb (0.4.52, her sighting in 4-2: story/sightings.ts; owner-approved art):
 * `bomb-0` / `bomb-1` (8x8), its core lit and dark, blinking every 4 frames (held on `bomb-0`
 * with reduce flashing), and `bomb-burst` (16x16), its ring as it goes off. Index roles as above
 * (0 outline, 4 white, 5 glow), so the brainwashed fx turns them purple with the rest of her.
 */
const bomb0 = [
  '..0000..',
  '.055550.',
  '05544550',
  '05444450',
  '05444450',
  '05544550',
  '.055550.',
  '..0000..',
];
const bomb1 = [
  '..0000..',
  '.044440.',
  '04455440',
  '04555540',
  '04555540',
  '04455440',
  '.044440.',
  '..0000..',
];
const bombBurst = [
  '................',
  '.....555555.....',
  '...5555445555...',
  '..555444444555..',
  '..554......455..',
  '.554........455.',
  '.554........455.',
  '.544........445.',
  '.544........445.',
  '.554........455.',
  '.554........455.',
  '..554......455..',
  '..555444444555..',
  '...5555445555...',
  '.....555555.....',
  '................',
];

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
    'bomb-0': bomb0,
    'bomb-1': bomb1,
    'bomb-burst': bombBurst,
  },
};

/*
 * Classic SMBC Samus's death (SA-C32, SamusGuts.as): the suit bursts into six 8x8 pieces, each
 * drawn here from the parts above: the helmet's two halves (top), the shoulder pads (middle; the
 * right one keeps a stub of the cannon) and the boots (bottom). Pieces 1-3 fly right, 4-6 left.
 * Each tumbles through two frames: as drawn, then a quarter turn.
 */
const helmetRight = [
  '00000...',
  '1441100.',
  '11111110',
  '00000110',
  '33333010',
  '33333010',
  '00000110',
  '1112220.',
];
const helmetLeft = [
  '...00000',
  '.0011411',
  '01111111',
  '01110000',
  '01110433',
  '01110333',
  '01110000',
  '.0221111',
];
const padRight = [
  '.000000.',
  '02222000',
  '02222224',
  '02222225',
  '02222224',
  '.0222000',
  '.0110...',
  '..00....',
];
const padLeft = [
  '.000000.',
  '02222220',
  '02222220',
  '02222220',
  '.0222220',
  '..022220',
  '...0110.',
  '....00..',
];
const bootRight = [
  '..0110..',
  '..0110..',
  '.02210..',
  '.02210..',
  '022210..',
  '022220..',
  '000000..',
  '........',
];
const bootLeft = bootRight.map((r) => r.split('').reverse().join(''));
const GUTS = [helmetRight, padRight, bootRight, helmetLeft, padLeft, bootLeft];

/* ---------- Classic SMBC's air and aim poses (F2) ---------- */

// Knees pulled up in front for the jump, shins folded under, boots off the floor (6 rows).
const legsTuck = [
  '....011111110...',
  '....0111111110..',
  '....0000002210..',
  '.........02210..',
  '........022210..',
  '........000000..',
];
/** The whole figure 2 px lower than standing, over the tucked legs. */
const airBody = (shoot: boolean): string[] =>
  shoot
    ? compose(W, H, [head, -1, 6], [torsoShoot, -1, 16], [legsTuck, -1, 26], [cannonFwd, 11, 19])
    : compose(W, H, [head, 0, 6], [torso, 0, 16], [legsTuck, 0, 26]);
/** Aiming up over `legs` placed at row `ly` (head and torso `dy` from standing). */
const aimingUp = (legs: readonly string[], ly: number, dy = 0): string[] =>
  compose(W, H, [head, -1, 4 + dy], [torsoShoot, -1, 14 + dy], [legs, -1, ly], [cannonUp, 12, 4 + dy]);

/**
 * Classic SMBC Samus's extra frames (SA-C4: `crouch`, `crouch-shoot`; SA-C32: `guts-<1..6>-<0|1>`),
 * a sheet of their own (`samus-classic`, the same palettes) so the Current sheet keeps its
 * documented frame set.
 */
export const samusClassicDef: SpriteDef = {
  palette: 'samus',
  frames: {
    crouch,
    'crouch-shoot': crouchShoot,
    // F2: the original's `jump` (knees up), `jumpShoot`, `upJump` and `upWalk-1..3`, drawn at
    // today's scale.
    air: airBody(false),
    'air-shoot': airBody(true),
    'up-air': aimingUp(legsTuck, 26, 2),
    'up-walk-0': aimingUp(legsWalk0, 25),
    'up-walk-1': aimingUp(legsWalk1, 24, -1),
    'up-walk-2': aimingUp(legsWalk2, 25),
    ...Object.fromEntries(
      GUTS.flatMap((g, i) => [
        [`guts-${i + 1}-0`, g],
        [`guts-${i + 1}-1`, rotateCW(g)],
      ]),
    ),
  },
};
