import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Original "blue-clad ninja" character for the sword-and-ninpo ("ryu") role.
 * Drawn here from scratch: a lean figure in a dark-blue hooded suit, the hood folded over the
 * brow so only a strip of skin with one eye shows above a mask that covers the lower face, a
 * light scarf knotted at the neck and streaming behind, light wraps around the forearms and
 * shins, and a short straight sword. The sheathed sword shows as a short grey hilt over the
 * back shoulder; the slash frames are drawn 24 wide so the blade can sit in the same frame as
 * the body (body in columns 0-15, blade running right from the hand).
 *
 * Palette index roles (identical across every variant so recolours are plain index swaps):
 *   0 outline   1 suit (blue)   2 suit shade & mask (dark blue)   3 skin (eye / brow strip)
 *   4 wraps & scarf (light)   5 blade & metal (light grey)
 */
export const ryuPalettes: Record<string, string[]> = {
  ryu: [NES.black, NES.blueMid, NES.blueDark, NES.skin, NES.white, NES.lightGray],
  // Invincibility flashes.
  'ryu-star-0': [NES.black, NES.yellow, NES.orange, NES.white, NES.redBright, NES.yellowLight],
  'ryu-star-1': [NES.black, NES.cyan, NES.blueLight, NES.pink, NES.white, NES.white],
  'ryu-star-2': [NES.black, NES.pink, NES.magenta, NES.greenLight, NES.purple, NES.cyan],
  'ryu-star-3': [NES.black, NES.white, NES.lightGray, NES.yellow, NES.gray, NES.white],
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

// Hooded head, 16 wide, 10 rows (rows 3..12 of the standing pose): a rounded hood with a dark
// fold down the back, a strip of skin with one eye under the brow, the mask over the lower face
// and a short dark neck.
const head = [
  '......000000....',
  '.....01111110...',
  '....0111111110..',
  '....0121111110..',
  '....0121033330..',
  '....0121033030..',
  '....0112222220..',
  '.....012222220..',
  '......0122220...',
  '.......02220....',
];

// Scarf hanging down and back from the neck knot (rows 9..11, pasted under the head).
const scarfDown = ['...44', '.444.', '44...'];

// Scarf streaming straight back from the neck for the run (rows 9..10).
const scarfBack = ['...44', '44444'];

// Sheathed sword slung across the small of the back: the grey hilt pokes out behind the back
// forearm with a dark edge under it (rows 18..19).
const hilt = ['55', '00'];

// Torso at rest (rows 13..21): narrow shoulders, both arms hanging with light forearm wraps and
// dark gloves, a dark shade down the back and a light sash around the waist.
const torsoIdle = [
  '...0000000000...',
  '..021111111120..',
  '..020111111020..',
  '..020111111020..',
  '..020211111020..',
  '..040211111040..',
  '..040444444040..',
  '..0220211110220.',
  '...00021111000..',
];

// Airborne torso: arms angled out from the body, gloves level with the sash.
const torsoJump = [
  '...0000000000...',
  '..021111111120..',
  '.02001111110020.',
  '040.01111110.040',
  '040.02111110.040',
  '020.02111110.020',
  '000.04444440.000',
  '.....0211110....',
  '.....0211110....',
];

// Front arm flung straight forward at shoulder height (rows 13..21): wraps then the glove ending
// on the frame edge at rows 14; used when throwing a sub-weapon.
const torsoThrow = [
  '...0000000000000',
  '..02111111114422',
  '..02011111100000',
  '..0201111110....',
  '..0202111110....',
  '..0402111110....',
  '..0404444440....',
  '..0220211110....',
  '...000211110....',
];

// Slashing torso (rows 12..21): the shoulder line one row higher and the front arm thrust
// forward so the glove sits on the frame edge at row 13; the blade layer attaches at column 16.
const torsoSlash = [
  '...0000000000000',
  '..02111111114422',
  '..02011111100000',
  '..0201111110....',
  '..0201111110....',
  '..0202111110....',
  '..0402111110....',
  '..0404444440....',
  '..0220211110....',
  '...000211110....',
];

// Wind-up / cling torso (rows 13..21): the front arm leaves the shoulder straight up (drawn by armUp).
const torsoArmUp = [
  '...000000000110.',
  '..021111111110..',
  '..0201111110....',
  '..0201111110....',
  '..0202111110....',
  '..0402111110....',
  '..0404444440....',
  '..0220211110....',
  '...000211110....',
];

// Raised front arm: glove at the top, wraps, then the sleeve running down into the shoulder.
// 4 wide, 12 rows (rows 1..12).
const armUp = ['0220', '0220', '0440', '0440', ...Array.from({ length: 8 }, () => '0110')];

// Sword raised behind the head during the wind-up: the blade leaves the glove and steps up and
// back over the hood. 8 wide, 3 rows (rows 0..2, pasted at column 5).
const swordBack = ['55555...', '00005555', '....0000'];

// Knockback torso (rows 11..21): both arms thrown up in a V, gloves open at the top.
const torsoHurt = [
  '.022........220.',
  '.044........440.',
  '.04400000000440.',
  '.02111111111120.',
  '..000111111000..',
  '....01111110....',
  '....02111110....',
  '....02111110....',
  '....04444440....',
  '.....0211110....',
  '.....0211110....',
];

// Legs (rows 22..31 of the standing pose), 16 wide, 10 rows: narrow hips, two slim legs with
// light shin wraps and dark split-toe boots, toes pointing forward.
const legsStand = [
  '.....0211110....',
  '.....0211110....',
  '.....0210110....',
  '.....0210110....',
  '.....0210110....',
  '.....0440440....',
  '.....0440440....',
  '.....0440440....',
  '.....02202220...',
  '.....00000000...',
];

// Run, stride: both legs scissored wide, the back toe trailing off the floor.
const legsRun0 = [
  '.....0211110....',
  '....02100110....',
  '....0210.0110...',
  '...0210...0110..',
  '...0210...0110..',
  '..0440....0440..',
  '..0440....0440..',
  '.02200....0440..',
  '..00......02220.',
  '..........00000.',
];

// Run, passing: back leg planted under the body, front knee driving forward (11 rows, body a
// pixel higher).
const legsRun1 = [
  '.....0211110....',
  '.....0211110....',
  '.....02101110...',
  '.....0210.0110..',
  '.....0210.0110..',
  '.....0440.0440..',
  '.....0440.0440..',
  '.....0440.02220.',
  '.....0220.00000.',
  '.....02220......',
  '.....00000......',
];

// Run, lead: front thigh lifted level with the shin hanging, back leg stretched back pushing off
// the toe.
const legsRun2 = [
  '.....0211110....',
  '....0210011110..',
  '...0210.000110..',
  '..0210....0110..',
  '..0440....0440..',
  '.0440.....0440..',
  '.0440.....02220.',
  '.0220.....00000.',
  '.02220..........',
  '.00000..........',
];

// Jump: knees tucked up to the chest, shins hanging side by side, boots off the floor.
const legsJump = [
  '.....0211110....',
  '.....021111110..',
  '......000111110.',
  '........0440440.',
  '........0440440.',
  '........0220220.',
  '........0000000.',
  '................',
  '................',
  '................',
];

// Wall cling legs (rows 22..31): thighs pushed forward to the wall, shins running down it, toes
// braced against the right edge.
const legsCling = [
  '.......0211110..',
  '.......021111110',
  '........00001110',
  '............0440',
  '............0440',
  '............0440',
  '............0440',
  '............0440',
  '...........02220',
  '...........00000',
];

// Folded legs for the crouch (rows 30..31): both legs flat, boot, shin wrap and thigh each.
const legsCrouch = ['.0224410224410..', '.0000000000000..'];

/* ---------- frames ---------- */

const W = 16;
const WW = 24;
const H = 32;

const standing = (legs: readonly string[], dy = 0): string[] =>
  compose(
    W,
    H,
    [scarfDown, 0, 9 + dy],
    [head, 0, 3 + dy],
    [torsoIdle, 0, 13 + dy],
    [hilt, 0, 18 + dy],
    [legs, 0, 22 + dy],
  );

// Run: the whole upper body leans a pixel forward and the scarf trails straight back.
const running = (legs: readonly string[], dy = 0): string[] =>
  compose(
    W,
    H,
    [scarfBack, 0, 9 + dy],
    [head, 1, 3 + dy],
    [torsoIdle, 0, 13 + dy],
    [hilt, 0, 18 + dy],
    [legs, 0, 22 + dy],
  );

const idle = standing(legsStand);
const walk0 = running(legsRun0);
const walk1 = running(legsRun1, -1);
const walk2 = running(legsRun2);

const jump = compose(W, H, [scarfBack, 0, 9], [head, 0, 3], [torsoJump, 0, 13], [legsJump, 0, 22]);

// Wall cling: the figure pressed against the right edge, front arm up gripping the wall.
const cling = compose(
  W,
  H,
  [scarfDown, -1, 9],
  [head, 0, 3],
  [armUp, 13, 1],
  [torsoArmUp, 2, 13],
  [hilt, 2, 18],
  [legsCling, 0, 22],
);

// Tossing a sub-weapon: head leaning forward, front arm flung straight out.
const throwFrame = compose(
  W,
  H,
  [scarfBack, 0, 9],
  [head, 1, 3],
  [torsoThrow, 0, 13],
  [hilt, 0, 18],
  [legsStand, 0, 22],
);

// Knockback: head thrown back, arms up, legs splayed.
const hurt = compose(W, H, [scarfDown, -1, 9], [head, -1, 3], [torsoHurt, 0, 11], [legsRun0, 0, 22]);

// Crouch: the figure folds into the lower half, head on the shoulders and legs flat.
const crouchBody = ['...0000000000...', '..021111111120..', '..040211111040..', '..040444444040..'];
const crouch = compose(
  W,
  H,
  [scarfDown, 0, 22],
  [head, 0, 16],
  [crouchBody, 0, 26],
  [hilt, 0, 28],
  [legsCrouch, 0, 30],
);

// Crouching slash body (rows 16..31): head low over the shoulders, the front arm thrust forward
// at mask height so the glove ends on the frame edge at row 22, back arm tucked.
const crouchSlashBody = [
  '....000000......',
  '...01111110.....',
  '..0111111110....',
  '..0121111110....',
  '..0121033330....',
  '..0121033030....',
  '..01122222204422',
  '...0122222011000',
  '....022200110...',
  '..00000000110...',
  '.021111111110...',
  '.02111111110....',
  '.02111111110....',
  '.04444444440....',
  '.0224410224410..',
  '.0000000000000..',
];

// Collapsed on both knees in the lower half: hood bowed forward over the chest, back rounded,
// front arm dropped to the floor, boots folded flat behind.
const die = compose(W, H, [
  [
    '......000000....',
    '.....01111110...',
    '....0111111110..',
    '....0121111110..',
    '.0000121122220..',
    '0211101122220...',
    '0211110022220...',
    '0211111010......',
    '0211111040......',
    '0444441020......',
    '0222201111000...',
    '0000000000000...',
  ],
  0,
  20,
]);

// Sword blade (short, straight): a light grey edge over a dark underside, 8 px from the glove to
// the tip at column 23.
const blade = ['55555555', '00000000'];

// Wind-up: sword raised straight up and back over the hood; nothing reaches past column 15.
const slash0 = compose(
  WW,
  H,
  [scarfDown, -1, 9],
  [head, -1, 3],
  [armUp, 12, 1],
  [swordBack, 5, 0],
  [torsoArmUp, 0, 13],
  [legsStand, 0, 22],
);

// Horizontal slash: arm out at row 13, blade to column 23, a thin light arc tracing the sweep
// from above the hood down to the tip.
const slashArc = [
  '........................',
  '........................',
  '............444.........',
  '...............44.......',
  '.................44.....',
  '...................4....',
  '....................4...',
  '.....................4..',
  '.....................4..',
  '......................4.',
  '......................4.',
  '.......................4',
  '.......................4',
];
const slash1 = compose(
  WW,
  H,
  [scarfBack, 0, 8],
  [head, 1, 2],
  [torsoSlash, 0, 12],
  [legsRun0, 0, 22],
  [blade, 16, 13],
  [slashArc, 0, 0],
);

// Crouching slash: blade at row 22.
const crouchSlash = compose(WW, H, [crouchSlashBody, 0, 16], [blade, 16, 22]);

// Tucked somersault, 16x16: hood top right, back rounded on the left, arms wrapped around the
// knees with the sword held out to the right, boots folded underneath. Each spin frame turns it
// a quarter clockwise.
const spin0 = [
  '................',
  '.....000000.....',
  '....02111110....',
  '...0211111110...',
  '..021112033330..',
  '..021112033030..',
  '.02111122222220.',
  '.02111102222220.',
  '.021111044442255',
  '.021111011111000',
  '.0211101111110..',
  '..0211044044440.',
  '...02022022220..',
  '....000000000...',
  '................',
  '................',
];
const spin1 = rotateCW(spin0);
const spin2 = rotateCW(spin1);
const spin3 = rotateCW(spin2);
const spinFrame = (rows: readonly string[]): string[] => compose(W, H, [rows, 0, 16]);

export const ryuDef: SpriteDef = {
  palette: 'ryu',
  frames: {
    idle,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    jump,
    cling,
    crouch,
    throw: throwFrame,
    hurt,
    die,
    'slash-0': slash0,
    'slash-1': slash1,
    'crouch-slash': crouchSlash,
    'spin-0': spinFrame(spin0),
    'spin-1': spinFrame(spin1),
    'spin-2': spinFrame(spin2),
    'spin-3': spinFrame(spin3),
  },
};
