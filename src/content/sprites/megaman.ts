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

// Without the helmet (the campaign, after a hit: the helmet is his mushroom, 0.4.35): the same
// face and neck under short spiky hair, in the outline's black so it reads dark in every weapon
// palette; a skin-coloured ear where the helmet's ear-piece was. Same 16x10 box as `head`.
const bareHead = [
  '.......0.0......',
  '.....0000000....',
  '...000000000....',
  '..00000000000...',
  '..000000000000..',
  '..000033334030..',
  '..000333330030..',
  '..030333333330..',
  '...0003333330...',
  '.....0000330....',
];
const bareHeadBlink = bareHead.map((r, i) =>
  i === 5 ? '..000033333330..' : i === 6 ? '..000333300030..' : r,
);

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

// On a ladder, side-on to shoot (Mega Man 2): the cannon out, the back boot up on a rung.
const legsLadder = [
  '.....01100110...',
  '.....0220.0220..',
  '....02220.0220..',
  '....00000.02220.',
  '..........02220.',
  '..........00000.',
];

/** Every frame that shows his head, drawn with head `hd` (the helmet's, or the bare one). */
function headFrames(hd: readonly string[], hdBlink: readonly string[]): Record<string, string[]> {
  const standing = (legs: readonly string[], h: readonly string[] = hd): string[] =>
    compose(W, H, [h, 0, 8], [torso, 0, 18], [legs, 0, 26]);
  const shooting = (w: number, legs: readonly string[], dy = 0): string[] =>
    compose(w, H, [hd, 0, 8 + dy], [torsoShoot, 0, 18 + dy], [legs, 0, 26 + dy], [cannon, 12, 18 + dy]);
  return {
    idle: standing(legsStand),
    'idle-blink': standing(legsStand, hdBlink),
    'walk-0': standing(legsWalk0),
    'walk-1': compose(W, H, [hd, 0, 7], [torso, 0, 17], [legsWalk1, 0, 25]),
    'walk-2': standing(legsWalk2),
    jump: standing(legsJump),
    shoot: shooting(24, legsStand),
    'walk-shoot-0': shooting(24, legsWalk0),
    'walk-shoot-1': shooting(24, legsWalk1, -1),
    'walk-shoot-2': shooting(24, legsWalk2),
    'jump-shoot': shooting(24, legsJump),
    'climb-shoot': shooting(24, legsLadder),
    // Sliding along the ground: head leading high in front, torso tucked under the chin, both
    // boots side by side on the floor and the back arm trailing with its glove on the ground.
    slide: compose(
      W,
      H,
      [hd, 2, 16],
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
    ),
    // Flinch: knocked back, arms thrown out, legs splayed.
    hurt: compose(
      W,
      H,
      [hd, -1, 9],
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
    ),
    // Standing with the charge glow sparking around the cannon hand.
    'charge-0': compose(
      W,
      H,
      [hd, 0, 8],
      [torso, 0, 18],
      [legsStand, 0, 26],
      [['....5', '.....', '5....', '.....', '....5', '.....', '..5..'], 11, 18],
    ),
  };
}

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

// Climbing over a ladder's top, seen from behind: hunched, both hands on the floor above, knees
// bent under him.
const climbTop = [
  ...blank(W, 17),
  '.....000000.....',
  '....02222220....',
  '...0222222220...',
  '..022222222220..',
  '..002222222200..',
  '.00110222201100.',
  '.02110000001120.',
  '.02011111111020.',
  '.00011111111000.',
  '...0111111110...',
  '...0222222220...',
  '..022220022220..',
  '..022200002220..',
  '..022200002220..',
  '..000000000000..',
];

/**
 * A from-behind frame without the helmet: in rows `y0..y1`, columns `x0..x1`, the helmet's armour
 * turns to dark hair (the outline's black) and its ear-pieces to skin.
 */
function bareBack(rows: readonly string[], y0: number, y1: number, x0: number, x1: number): string[] {
  return rows.map((r, y) => {
    if (y < y0 || y > y1) return r;
    const out = r.split('');
    for (let x = x0; x <= x1; x++) {
      if (out[x] === '2') out[x] = '0';
      else if (out[x] === '1') out[x] = '3';
    }
    return out.join('');
  });
}

/**
 * The frames without the helmet, `bare-<frame>` (the campaign, 0.4.35): the same poses with the
 * bare head, so they take every suit's palette as the helmeted ones do.
 */
const bareFrames: Record<string, string[]> = Object.fromEntries(
  Object.entries({
    ...headFrames(bareHead, bareHeadBlink),
    'climb-0': bareBack(climb0, 8, 16, 2, 13),
    'climb-1': flipH(bareBack(climb0, 8, 16, 2, 13)),
  }).map(([k, v]) => [`bare-${k}`, v]),
);

export const megamanDef: SpriteDef = {
  palette: 'megaman',
  frames: {
    ...headFrames(head, headBlink),
    'death-orb': deathOrb,
    'teleport-0': teleport0,
    'climb-0': climb0,
    'climb-1': climb1,
    'climb-top': climbTop,
    ...bareFrames,
  },
};
