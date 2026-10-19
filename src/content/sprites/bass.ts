import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';

/**
 * Original art for Classic SMBC's Bass (bug-reports/2026-10-07-bass-build-classic-character.md,
 * BA-32..BA-34): the "rival robot" of the arm-cannon role, drawn here from scratch on the same 16 x 32
 * canvas (24 x 32 when the cannon is out) and offsets as our Mega Man, so the 12 x 22 hitbox lines
 * up: a dark suit with orange trim, a helmet with two swept-back fins and a chest gem, and the aim
 * poses of his 7-way buster (up, up at an angle, down at an angle; standing and jumping) plus an
 * upright dash that keeps his full height.
 *
 * Palette index roles (the same six as Mega Man's, megaman.ts):
 *   0 outline   1 light armour (suit)   2 dark armour (helmet, gloves, boots)   3 skin   4 white
 *   5 fins, gem and muzzle glow
 */
export const bassPalettes: Record<string, string[]> = {
  bass: [NES.black, NES.darkGray, NES.orange, NES.skin, NES.white, NES.yellow],
  // The Water Shield suit, worn while he holds the Flower (BA-33).
  'bass-water': [NES.black, NES.skyLight, NES.blueMid, NES.skin, NES.white, NES.white],
  // The full kit's Magma Bazooka charge (dev only): the suit brightens toward gold.
  'bass-charge-0': [NES.black, NES.darkGray, NES.orange, NES.skin, NES.white, NES.cyan],
  'bass-charge-1': [NES.black, NES.gray, NES.yellow, NES.skin, NES.white, NES.white],
  'bass-charge-2': [NES.black, NES.yellowLight, NES.yellow, NES.skin, NES.white, NES.white],
  // Star power (BA-33): the same cycle as Mega Man's rows.
  'bass-star-0': [NES.black, NES.yellow, NES.orange, NES.white, NES.white, NES.yellowLight],
  'bass-star-1': [NES.black, NES.pink, NES.magenta, NES.skin, NES.white, NES.cyan],
  'bass-star-2': [NES.black, NES.greenLight, NES.green, NES.yellowLight, NES.white, NES.white],
  'bass-star-3': [NES.black, NES.white, NES.lightGray, NES.skin, NES.white, NES.yellow],
};

/* ---------- composition ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

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

/** Rows upside down (the down-angled arm from the up-angled one). */
const flipV = (rows: readonly string[]): string[] => [...rows].reverse();

/* ---------- parts (facing right) ---------- */

// Helmet with two fins swept back over it, a visor brim and the face; 16 x 13. Drawn at y = 5 in a
// standing pose, so the face sits where Mega Man's does.
const head = [
  '..0......0......',
  '.050....050.....',
  '.0550..0550.....',
  '..05500055000...',
  '...0552222220...',
  '...0222222220...',
  '..022222222220..',
  '..000002555220..',
  '..002202334030..',
  '..002202330030..',
  '..020022333330..',
  '...0222033330...',
  '.....0000330....',
];
const headBlink = head.map((r, i) => (i === 8 ? '..002202333330..' : i === 9 ? '..002202300030..' : r));
const HEAD_Y = 5;

// Suit with both arms down and the chest gem; 16 x 8 (rows 18..25 standing).
const torso = [
  '....01111110....',
  '...0111551110...',
  '..010115511010..',
  '..020111111020..',
  '..020111111020..',
  '..022111111220..',
  '..000222222000..',
  '....02222220....',
];
// The front arm away (the cannon is its own layer).
const torsoShoot = [
  '....01111110....',
  '...0111551110...',
  '..010115511110..',
  '..020111111100..',
  '..020111111000..',
  '..022111111000..',
  '..000222222000..',
  '....02222220....',
];

// The buster arm forward: suit sleeve, orange barrel with a fin ridge, flared glowing muzzle. 11 x 6.
const cannon = ['.......0000', '00000002250', '01111222250', '01111222200', '00000002250', '.......0000'];
// Straight up, muzzle on top; 6 x 16, the sleeve reaching down to the shoulder.
const cannonUp = [
  '.0000.',
  '055550',
  '002200',
  '.0220.',
  '.0220.',
  '.0220.',
  '.0220.',
  '.0220.',
  '.0120.',
  '.0110.',
  '.0110.',
  '.0110.',
  '.0110.',
  '.0110.',
  '.0110.',
  '.0000.',
];
// Up and forward; 9 x 9, shoulder at the bottom left.
const cannonDiag = [
  '.....0000',
  '....05550',
  '...022250',
  '..022200.',
  '.011200..',
  '01110....',
  '0110.....',
  '010......',
  '00.......',
];

const legsStand = [
  '....01100110....',
  '...0220.02220...',
  '...0220.02220...',
  '..02220.022220..',
  '..02220.022220..',
  '..00000.000000..',
];
const legsWalk0 = [
  '...0110..0110...',
  '..0220...02220..',
  '..0220...02220..',
  '.02220...022220.',
  '.02220...022220.',
  '.00000...000000.',
];
const legsWalk1 = [
  '....01100110....',
  '....02200220....',
  '....02200220....',
  '...02220.02220..',
  '...02220.02220..',
  '...02220.02220..',
  '...00000.00000..',
];
const legsWalk2 = [
  '....011001110...',
  '....0220.022220.',
  '....0220.022220.',
  '...02220.000000.',
  '...02220........',
  '...00000........',
];
const legsJump = [
  '...0110..0110...',
  '..0220...02220..',
  '.02220...02220..',
  '.00000..022220..',
  '........022220..',
  '........000000..',
];
// The small first step (BA-7): feet a little apart.
const legsStep = [
  '....01100110....',
  '...0220..02220..',
  '...0220..02220..',
  '..02220..022220.',
  '..02220..022220.',
  '..00000..000000.',
];
// The dash (BA-32): a long low stride, back boot trailing; 20 x 7 (rows 25..31).
const legsDash = [
  '.....01100110.......',
  '....0220...02220....',
  '...0220.....02220...',
  '..0220.......02220..',
  '.02220........02220.',
  '.02220........00000.',
  '.00000..............',
];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

const standing = (legs: readonly string[], hd: readonly string[] = head, ly = 26): string[] =>
  compose(W, H, [hd, 0, HEAD_Y], [torso, 0, 18], [legs, 0, ly]);
/** The cannon forward (24 wide). */
const shooting = (legs: readonly string[], dy = 0): string[] =>
  compose(24, H, [head, 0, HEAD_Y + dy], [torsoShoot, 0, 18 + dy], [legs, 0, 26 + dy], [cannon, 12, 18 + dy]);
/** Straight up (16 wide, arm over the head). */
const shootingUp = (legs: readonly string[]): string[] =>
  compose(W, H, [head, 0, HEAD_Y], [torsoShoot, 0, 18], [legs, 0, 26], [cannonUp, 10, 2]);
/** Up or down at an angle (24 wide). */
const shootingDiag = (legs: readonly string[], down: boolean): string[] =>
  compose(
    24,
    H,
    [head, 0, HEAD_Y],
    [torsoShoot, 0, 18],
    [legs, 0, 26],
    down ? [flipV(cannonDiag), 11, 18] : [cannonDiag, 11, 11],
  );

// Climbing, from behind: both fins and both ear-pieces, one arm up, one knee raised.
const climb0 = [
  ...blank(W, 5),
  '...0......0.....',
  '..050....050....',
  '..0550..0550....',
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
  '0111111551110000',
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

const deathOrb = [
  '..0000..',
  '.055550.',
  '05544550',
  '05400450',
  '05400450',
  '05544550',
  '.055550.',
  '..0000..',
];

// His shot (BA-33): a bright 8 x 8 diamond, no animation.
const busterShot = [
  '...00...',
  '..0550..',
  '.054450.',
  '05444450',
  '05444450',
  '.054450.',
  '..0550..',
  '...00...',
];

export const bassDef: SpriteDef = {
  palette: 'bass',
  frames: {
    idle: standing(legsStand),
    'idle-blink': standing(legsStand, headBlink),
    step: standing(legsStep),
    'walk-0': standing(legsWalk0),
    'walk-1': compose(W, H, [head, 0, HEAD_Y - 1], [torso, 0, 17], [legsWalk1, 0, 25]),
    'walk-2': standing(legsWalk2),
    jump: standing(legsJump),
    shoot: shooting(legsStand),
    'shoot-up': shootingUp(legsStand),
    'shoot-diag-up': shootingDiag(legsStand, false),
    'shoot-diag-down': shootingDiag(legsStand, true),
    'walk-shoot-0': shooting(legsWalk0),
    'walk-shoot-1': shooting(legsWalk1, -1),
    'walk-shoot-2': shooting(legsWalk2),
    'jump-shoot': shooting(legsJump),
    'jump-shoot-up': shootingUp(legsJump),
    'jump-shoot-diag-up': shootingDiag(legsJump, false),
    'jump-shoot-diag-down': shootingDiag(legsJump, true),
    // Upright and leaning into the dash, filling the 22 px hitbox (BA-3, BA-32).
    dash: compose(
      24,
      H,
      [head, 5, HEAD_Y + 1],
      [torso, 3, 18],
      [legsDash, 1, 25],
      [['000', '...', '00.'], 0, 20],
    ),
    hurt: compose(
      W,
      H,
      [head, -1, HEAD_Y + 1],
      [
        [
          '...01111110.....',
          '..0111551110....',
          '.0101155110100..',
          '.0201111110200..',
          '.0001111110000..',
          '...02222220.....',
          '...00222220.....',
        ],
        0,
        19,
      ],
      [legsWalk0, 0, 26],
      [['.0.', '020', '020'], 1, 16],
      [['.0.', '020', '020'], 12, 16],
    ),
    'climb-0': climb0,
    'climb-1': flipH(climb0),
    'death-orb': deathOrb,
    'bass-buster': busterShot,
  },
};
