import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Original art for Classic SMBC's Pit and Dark Pit (bug-reports/2026-10-07-pit-build-classic-character.md,
 * PI-20, PI-21, PI-M: art): a young winged angel drawn here from scratch on Classic Samus's 16 x 32
 * canvas and offsets (characters/samus/classic.ts), so the 12 x 24 standing and 12 x 15 crouched
 * boxes line up: brown hair under a gold laurel wreath, a white tunic with a belt, gold armlets,
 * sandals with straps up the shin, a pair of feathered wings on his back and a gold bow in his
 * front hand (raised and drawn for a shot, held overhead to aim up).
 *
 * Every frame Classic Samus's sprite function can ask of Pit is here: `idle`, `walk-0..2`, `shoot`,
 * `walk-shoot-0..2`, `jump`, `aim-up`, `hurt`, `die`, `spin-0..3` (a somersault wrapped in his
 * wings), `crouch` and `crouch-shoot` (the body in the bottom 15 rows). He never curls into the
 * morph ball (PI-17), so the `ball-*` frames are his somersault's. Plus `pit-shots`, his arrows.
 *
 * Palette index roles (the same six as Samus's, so her Star and Screw Attack flashes recolour him):
 *   0 outline   1 tunic and wings   2 hair, belt and sandals   3 skin   4 feather and string shade
 *   5 gold (laurel, armlets, bow)
 */
export const pitPalettes: Record<string, string[]> = {
  // Pit in white with dark brown hair and gold; golden with the Flower (PI-20).
  pit: [NES.black, NES.white, NES.brownDark, NES.skin, NES.lightGray, NES.yellow],
  'pit-varia': [NES.black, NES.yellowLight, NES.brownDark, NES.skin, NES.white, NES.yellow],
  // Dark Pit: black wings and tunic, dark hair, a red bow and wreath.
  darkpit: [NES.black, NES.darkGray, NES.black, NES.skin, NES.gray, NES.redBright],
  'darkpit-varia': [NES.black, NES.gray, NES.black, NES.skin, NES.lightGray, NES.red],
};

/* ---------- composition helpers ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
function paste(base: readonly string[], layer: readonly string[], dx: number, dy: number): string[] {
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

// Head, 16 x 10 (rows 6..15 standing): brown hair swept back, the gold wreath across it with its
// leaves at the back, the face with one eye, and the neck.
const head = [
  '.....000000.....',
  '....02222220....',
  '...0222222220...',
  '..055222222220..',
  '..0555555555550.',
  '..022223333030..',
  '..022233333330..',
  '...0223333330...',
  '....00333330....',
  '......0330......',
];

// The near wing, 7 x 14 (rows 8..21 standing, x 0): folded on his back, its tip swept up behind
// the head and its feathers fanning down over the tunic to the hem.
const wings = [
  '0......',
  '00.....',
  '010....',
  '0410...',
  '01410..',
  '014410.',
  '0141110',
  '0114110',
  '.014110',
  '.011410',
  '..01410',
  '..01410',
  '...0140',
  '....00.',
];

// The wing spread up for a jump: raised and open behind him, 8 x 12 (rows 8..19, x 0).
const wingsUp = [
  '0.......',
  '00......',
  '040.....',
  '0410....',
  '01410...',
  '014410..',
  '0141110.',
  '01141110',
  '.0141110',
  '..014110',
  '...01410',
  '....000.',
];

// Tunic with both arms down (rows 16..24 standing): gold armlets, a brown belt and a short skirt.
const torso = [
  '.....01111110...',
  '....0311111130..',
  '...033111111330.',
  '...055111111550.',
  '...033122221330.',
  '...033111111330.',
  '...00111111100..',
  '....0111111110..',
  '....0000000000..',
];

// The same with the front arm raised and taken out (the bow pose adds its own arm).
const torsoBow = [
  '.....01111110...',
  '....031111110...',
  '...0331111110...',
  '...0551111110...',
  '...0331222210...',
  '...0331111110...',
  '...00111111100..',
  '....0111111110..',
  '....0000000000..',
];

// The bow held down in the front hand, 3 x 13 (rows 14..26 standing, x 13).
const bowDown = ['00.', '050', '405', '405', '405', '405', '.05', '.05', '405', '405', '405', '050', '00.'];

// The bow raised and drawn: the front arm level from the shoulder, the bow upright at its end and
// the string pulled back to the chest; 7 x 13 (rows 12..24 standing).
const bowShoot = [
  '....00.',
  '....050',
  '...0405',
  '..04.05',
  '.04..05',
  '0333305',
  '0555305',
  '.04..05',
  '..04.05',
  '...0405',
  '....050',
  '....00.',
];

// The bow held overhead to aim up: level above the head with an arrow nocked, the front arm
// straight up in front of the face; 7 x 17 (rows 0..16, x 9).
const bowUp = [
  '...0...',
  '..050..',
  '0005000',
  '0554550',
  '.0.4.0.',
  '...4...',
  '..030..',
  '..030..',
  '..030..',
  '..050..',
  '..030..',
  '..030..',
  '..030..',
  '..030..',
  '..030..',
  '..030..',
  '...0...',
];

// Legs (rows 25..31 standing): bare legs, straps up the shin and sandals.
const legsStand = [
  '.....0330330....',
  '.....0330330....',
  '.....0230230....',
  '.....0330330....',
  '.....0220220....',
  '....0222022220..',
  '....0000000000..',
];

// Contact pose: legs apart.
const legsWalk0 = [
  '....0330.0330...',
  '...0330...0330..',
  '...0230...0230..',
  '..0330.....0330.',
  '..0220.....0220.',
  '.02220.....02220',
  '.00000.....00000',
];

// Passing pose: legs together, 8 rows (body a pixel higher).
const legsWalk1 = [
  '.....0330330....',
  '.....0330330....',
  '.....0330330....',
  '.....0230230....',
  '.....0330330....',
  '.....0220220....',
  '....0222022220..',
  '....0000000000..',
];

// Lead pose: the front knee lifted with the sandal out in front.
const legsWalk2 = [
  '.....0330.0330..',
  '.....0330.03330.',
  '.....0230.02220.',
  '.....0330.00000.',
  '.....0220.......',
  '....02220.......',
  '....00000.......',
];

// Jump: knees drawn up, sandals off the floor.
const legsJump = [
  '.....0330330....',
  '....03300330....',
  '....0230.0230...',
  '...0220...0220..',
  '..02220...02220.',
  '..00000...00000.',
  '................',
];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

const standing = (legs: readonly string[], dy = 0): string[] =>
  compose(
    W,
    H,
    [legs, 0, 25 + dy],
    [torso, 0, 16 + dy],
    [wings, 0, 8 + dy],
    [head, 0, 6 + dy],
    [bowDown, 13, 14 + dy],
  );

// Shooting poses sit one pixel to the left so the drawn bow fits in the frame.
const shooting = (legs: readonly string[], dy = 0): string[] =>
  compose(
    W,
    H,
    [legs, -1, 25 + dy],
    [torsoBow, -1, 16 + dy],
    [wings, -1, 8 + dy],
    [head, -1, 6 + dy],
    [bowShoot, 9, 12 + dy],
  );

const idle = standing(legsStand);
const walk0 = standing(legsWalk0);
const walk1 = standing(legsWalk1, -1);
const walk2 = standing(legsWalk2);

const shoot = shooting(legsStand);
const walkShoot0 = shooting(legsWalk0);
const walkShoot1 = shooting(legsWalk1, -1);
const walkShoot2 = shooting(legsWalk2);
// In the air the wings spread and the bow is up, ready.
const jump = compose(
  W,
  H,
  [legsJump, -1, 25],
  [torsoBow, -1, 16],
  [wingsUp, -1, 8],
  [head, -1, 6],
  [bowShoot, 9, 12],
);

// Aiming up: the bow level over his head, the arm straight up.
const aimUp = compose(
  W,
  H,
  [legsStand, -1, 25],
  [torsoBow, -1, 16],
  [wings, -1, 8],
  [head, -1, 6],
  [bowUp, 9, 0],
);

// Crouch (PI-21: one frame for the crouch, crouch-walk and air crouch), body in the bottom 15
// rows: head low, wings folded over the back, knees bent; `crouch-shoot` holds the bow drawn.
const legsCrouch = [
  '...033111111330.',
  '...0011111111 0.'.replace(' ', '1'),
  '..03300000003300',
  '.022203330.02220',
  '.000000000.00000',
];
const crouch = compose(
  W,
  H,
  [legsCrouch, 0, 27],
  [torso.slice(0, 4), 0, 23],
  [wings.slice(3), 0, 20],
  [head, 0, 17],
  [bowDown.slice(4), 13, 20],
);
const crouchShoot = compose(
  W,
  H,
  [legsCrouch, -1, 27],
  [torsoBow.slice(0, 4), -1, 23],
  [wings.slice(3), -1, 20],
  [head, -1, 17],
  [bowShoot.slice(0, 11), 9, 18],
);

// Knockback: head thrown back, wings flung open, legs splayed, the bow out to the side.
const hurt = compose(
  W,
  H,
  [legsWalk0, 0, 25],
  [torsoBow, 0, 16],
  [wingsUp, -1, 9],
  [head, -1, 7],
  [bowDown, 13, 12],
);

// Fallen to his knees in the lower half: head bowed, wings drooped over his back, the bow on the
// floor in front.
const die = compose(W, H, [
  [
    '................',
    '...0............',
    '..0140..........',
    '.014410000000...',
    '.01441022222200.',
    '014410222222220.',
    '0141055555555550',
    '01410222333030..',
    '.0410113333330..',
    '..00111133330...',
    '.0011122200.000.',
    '03311111110055500',
    '0000000000000000',
  ].map((r) => r.slice(0, 16)),
  0,
  19,
]);

// Somersault, 16 x 16: curled up with the wings wrapped round him, head at the top right, knees to
// the chest, the bow hugged across the front. Each spin frame turns it a quarter.
const spin0 = [
  '......000000....',
  '.....02222220...',
  '...00222222220..',
  '..0155555555550.',
  '.01402222333030.',
  '.01410223333330.',
  '.0141100333330..',
  '.0141111100000..',
  '.01411111155550.',
  '.01411111113330.',
  '.0141111111000..',
  '..01403300330...',
  '..01402220222 0.'.replace(' ', '0'),
  '...0140000000...',
  '....00..........',
  '................',
];
const spin1 = rotateCW(spin0);
const spin2 = rotateCW(spin1);
const spin3 = rotateCW(spin2);
const spinFrame = (rows: readonly string[]): string[] => compose(W, H, [rows, 0, 16]);

/* ---------- arrows (`pit-shots`, the items sheet's beam and missile boxes) ---------- */

/**
 * Pit's shots drawn as arrows (PI-21: the original's Pit draws beams as arrows), on the boxes of
 * Samus's beams (8 x 8) and missiles (16 x 8, 8 x 16 up); the specs keep every number. Facing right
 * as the items sheet's shots do. Index roles: 0 outline, 1 shaft, 2 fletching, 3 head, 4 glow,
 * 5 flash.
 */
export const pitShotPalettes: Record<string, string[]> = {
  'pit-shots': [NES.black, NES.yellowLight, NES.white, NES.yellow, NES.skyLight, NES.white],
  // Dark Pit's: a grey shaft, purple fletching and glow, a red head.
  'darkpit-shots': [NES.black, NES.lightGray, NES.purple, NES.redBright, NES.purple, NES.white],
};

const arrow0 = [
  '........',
  '........',
  '......0.',
  '22111130',
  '22111133',
  '......0.',
  '........',
  '........',
];
const arrow1 = [
  '........',
  '........',
  '......0.',
  '.2111130',
  '2.111133',
  '......0.',
  '........',
  '........',
];
// The light arrow (the Flower's wave shot): a glowing streak with a sparkle head.
const lightArrow0 = [
  '........',
  '.....4..',
  '44.4.454',
  '.4411455',
  '.4411455',
  '44.4.454',
  '.....4..',
  '........',
];
const lightArrow1 = [
  '........',
  '......4.',
  '4.4..454',
  '4411.455',
  '.411.455',
  '4.4..454',
  '......4.',
  '........',
];
// The ice arrow: a pale head.
const iceArrow0 = arrow0.map((r) => r.replace(/3/g, '4'));
const iceArrow1 = arrow1.map((r) => r.replace(/3/g, '4'));
// The heavy arrow (a missile's box), 16 x 8: a long shaft, broad fletching and a big head.
const heavyArrow = [
  '................',
  '............00..',
  '22.........0330.',
  '.2211111111133330',
  '.2211111111133330',
  '22.........0330.',
  '............00..',
  '................',
].map((r) => r.slice(0, 16));
// Turned to point up (8 x 16): the side view padded square and turned three quarters clockwise.
const heavyArrowUp = rotateCW(rotateCW(rotateCW([...blank(16, 4), ...heavyArrow, ...blank(16, 4)]))).map(
  (r) => r.slice(4, 12),
);
// A shot's end: a small burst of light.
const burst = [
  '........',
  '.5...5..',
  '..5.5...',
  '...4....',
  '..5.5...',
  '.5...5..',
  '........',
  '........',
];

export const pitShotsDef: SpriteDef = {
  palette: 'pit-shots',
  frames: {
    'arrow-0': arrow0,
    'arrow-1': arrow1,
    'ice-arrow-0': iceArrow0,
    'ice-arrow-1': iceArrow1,
    'light-arrow-0': lightArrow0,
    'light-arrow-1': lightArrow1,
    'heavy-arrow': heavyArrow,
    'heavy-arrow-up': heavyArrowUp,
    burst,
  },
};

/** Dark Pit's arrows: the same frames in his colours. */
export const darkpitShotsDef: SpriteDef = { ...pitShotsDef, palette: 'darkpit-shots' };

export const pitDef: SpriteDef = {
  palette: 'pit',
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
    // No morph ball (PI-17): the somersault stands in should anything ask.
    'ball-0': spinFrame(spin0),
    'ball-1': spinFrame(spin1),
    'ball-2': spinFrame(spin2),
    'ball-3': spinFrame(spin3),
    crouch,
    'crouch-shoot': crouchShoot,
  },
};
