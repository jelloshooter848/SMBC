import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';

/**
 * Original "blue robot boy" character for the arm-cannon ("megaman") role. Drawn here from scratch:
 * a round-helmeted android kid with chunky boots and a stubby blaster for a right hand.
 *
 * Palette index roles (identical across every variant):
 *   0 outline   1 light armour   2 dark armour (helmet, gloves, boots)   3 skin   4 white
 *   5 charge glow / muzzle flash
 */
/** NES $04 and $03, the master palette's dark purple and deep indigo (not shared NES constants). */
const SHADOW_PURPLE = '#940084';
const SHADOW_INDIGO = '#4428bc';

export const megamanPalettes: Record<string, string[]> = {
  megaman: [NES.black, NES.blueLight, NES.blueMid, NES.skin, NES.white, NES.yellow],
  // Colour cycle while a shot is charging: body brightens toward white and gold.
  'megaman-charge-0': [NES.black, NES.blueLight, NES.blueMid, NES.skin, NES.white, NES.cyan],
  'megaman-charge-1': [NES.black, NES.skyLight, NES.blueLight, NES.skin, NES.white, NES.yellow],
  'megaman-charge-2': [NES.black, NES.yellowLight, NES.yellow, NES.skin, NES.white, NES.white],
  // Invincibility flashes.
  'megaman-star-0': [NES.black, NES.yellow, NES.orange, NES.white, NES.white, NES.yellowLight],
  'megaman-star-1': [NES.black, NES.pink, NES.magenta, NES.skin, NES.white, NES.cyan],
  'megaman-star-2': [NES.black, NES.greenLight, NES.green, NES.yellowLight, NES.white, NES.white],
  'megaman-star-3': [NES.black, NES.white, NES.lightGray, NES.skin, NES.white, NES.yellow],
  // Weapon suits: armour recoloured per equipped weapon. 'plain' is the dull un-upgraded suit.
  'megaman-plain': [NES.black, NES.lavender, NES.gray, NES.skin, NES.white, NES.yellow],
  'megaman-saw': [NES.black, NES.lightGray, NES.darkGray, NES.skin, NES.white, NES.yellow],
  'megaman-leaf': [NES.black, NES.greenLight, NES.green, NES.skin, NES.white, NES.yellowLight],
  'megaman-flame': [NES.black, NES.orange, NES.redDark, NES.skin, NES.white, NES.yellow],
  'megaman-knuckle': [NES.black, NES.pink, NES.magenta, NES.skin, NES.white, NES.lavender],
  'megaman-bolt': [NES.black, NES.yellowLight, NES.peach, NES.skin, NES.white, NES.white],
  'megaman-rush': [NES.black, NES.redBright, NES.redDark, NES.skin, NES.white, NES.yellow],
  // Dark Mega Man, the station's brainwashed copy: dark purple armour with a deep indigo helmet,
  // gloves and boots, an ashen face, and red where the eye whites and the muzzle glint are, so
  // every frame glares.
  'megaman-dark': [NES.black, SHADOW_PURPLE, SHADOW_INDIGO, NES.lightGray, NES.redBright, NES.red],
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

// Helmet + face, 16 wide, 10 rows (rows 8..17 of the standing pose). Round helmet with a side
// ear-piece, light brow stripe and a big two-tone eye.
const head = [
  '.....000000.....',
  '....02222220....',
  '...0222222220...',
  '..022222222220..',
  '..000002111110..',
  '..001102334030..',
  '..001102330030..',
  '..020022333330..',
  '...0222033330...',
  '.....0000330....',
];

// Same head with the eye shut.
const headBlink = head.map((r, i) => (i === 5 ? '..001102333330..' : i === 6 ? '..001102300030..' : r));

// Torso with both arms hanging (rows 18..25 of the standing pose). 16 wide, 8 rows.
const torso = [
  '....01111110....',
  '...0111111110...',
  '..010111111010..',
  '..010111111010..',
  '..020111111020..',
  '..020111111020..',
  '..000222222000..',
  '....02222220....',
];

// Torso with the front arm raised and replaced by the cannon (cannon is a separate layer).
const torsoShoot = [
  '....01111110....',
  '...0111111110...',
  '..010111111110..',
  '..010111111100..',
  '..020111111000..',
  '..020111111000..',
  '..000222222000..',
  '....02222220....',
];

// Arm cannon: light upper arm, dark barrel, flared muzzle with a glint and a bore. 11 wide, 6 tall.
const cannon = ['........000', '00000000220', '01222222240', '01222222200', '00000000220', '........000'];

// Legs (rows 26..31 of the standing pose), 16 wide, 6 rows. Short thighs, big boots.
const legsStand = [
  '....01100110....',
  '...0220.02220...',
  '...0220.02220...',
  '..02220.022220..',
  '..02220.022220..',
  '..00000.000000..',
];

// Contact pose: legs apart.
const legsWalk0 = [
  '...0110..0110...',
  '..0220...02220..',
  '..0220...02220..',
  '.02220...022220.',
  '.02220...022220.',
  '.00000...000000.',
];

// Passing pose: legs together, 7 rows (body rides one pixel higher).
const legsWalk1 = [
  '....01100110....',
  '....02200220....',
  '....02200220....',
  '...02220.02220..',
  '...02220.02220..',
  '...02220.02220..',
  '...00000.00000..',
];

// Lead pose: front knee lifted, boot out in front.
const legsWalk2 = [
  '....011001110...',
  '....0220.022220.',
  '....0220.022220.',
  '...02220.000000.',
  '...02220........',
  '...00000........',
];

// Jump: back leg tucked, front leg reaching down.
const legsJump = [
  '...0110..0110...',
  '..0220...02220..',
  '.02220...02220..',
  '.00000..022220..',
  '........022220..',
  '........000000..',
];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

const standing = (legs: readonly string[], hd: readonly string[] = head): string[] =>
  compose(W, H, [hd, 0, 8], [torso, 0, 18], [legs, 0, 26]);

const shooting = (w: number, legs: readonly string[], dy = 0): string[] =>
  compose(w, H, [head, 0, 8 + dy], [torsoShoot, 0, 18 + dy], [legs, 0, 26 + dy], [cannon, 12, 18 + dy]);

const idle = standing(legsStand);
const idleBlink = standing(legsStand, headBlink);
const walk0 = standing(legsWalk0);
const walk1 = compose(W, H, [head, 0, 7], [torso, 0, 17], [legsWalk1, 0, 25]);
const walk2 = standing(legsWalk2);
const jump = standing(legsJump);

const shoot = shooting(24, legsStand);
const walkShoot0 = shooting(24, legsWalk0);
const walkShoot1 = shooting(24, legsWalk1, -1);
const walkShoot2 = shooting(24, legsWalk2);
const jumpShoot = shooting(24, legsJump);

// Sliding along the ground: head leading high in front, torso tucked under the chin, both boots
// side by side on the floor and the back arm trailing with its glove on the ground.
const slide = compose(
  W,
  H,
  [head, 2, 16],
  [
    [
      '.0111101111110..',
      '02211101111110..',
      '0220002222220220',
      '000.022220022220',
      '....022220022220',
      '....000000000000',
    ],
    0,
    26,
  ],
);

// Flinch: knocked back, arms thrown out, legs splayed.
const hurt = compose(
  W,
  H,
  [head, -1, 9],
  [
    [
      '...01111110.....',
      '..0111111110....',
      '.0101111110100..',
      '.0201111110200..',
      '.0001111110000..',
      '...0222222 0....',
      '...00222220.....',
    ].map((r) => r.replace(' ', '2')),
    0,
    19,
  ],
  [legsWalk0, 0, 26],
  [['.0.', '020', '020'], 1, 16],
  [['.0.', '020', '020'], 12, 16],
);

// Standing with the charge glow sparking around the cannon hand.
const charge0 = compose(
  W,
  H,
  [head, 0, 8],
  [torso, 0, 18],
  [legsStand, 0, 26],
  [['....5', '.....', '5....', '.....', '....5', '.....', '..5..'], 11, 18],
);

// 8x8 ring that the game scatters when the robot is destroyed.
const deathOrb = [
  '..0000..',
  '.011110.',
  '01144110',
  '01411410',
  '01411410',
  '01144110',
  '.011110.',
  '..0000..',
];

// Teleport beam: a bright column with a dark edge.
const teleport0 = blank(W, H).map(() => '.....014410.....');

// Climbing, seen from behind: both ear-pieces visible, one arm reaching up, the other low, one
// knee raised.
const climb0 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....02222220....',
  '...0222222220...',
  '..022222222220..',
  '..000222222000..',
  '02011222222110..',
  '02011222222110..',
  '01000222222000..',
  '0100222222220...',
  '010.00033000....',
  '010.01111110....',
  '0111111111110000',
  '..0011111110.010',
  '....01111110.010',
  '....01111110.010',
  '....02222220.020',
  '....02222220.020',
  '....01100110.000',
  '...02220.0110...',
  '...02220.0220...',
  '...00000.0220...',
  '........02220...',
  '........02220...',
  '........00000...',
];

const climb1 = flipH(climb0);

export const megamanDef: SpriteDef = {
  palette: 'megaman',
  frames: {
    idle,
    'idle-blink': idleBlink,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    jump,
    shoot,
    'walk-shoot-0': walkShoot0,
    'walk-shoot-1': walkShoot1,
    'walk-shoot-2': walkShoot2,
    'jump-shoot': jumpShoot,
    slide,
    hurt,
    'death-orb': deathOrb,
    'teleport-0': teleport0,
    'climb-0': climb0,
    'climb-1': climb1,
    'charge-0': charge0,
  },
};
