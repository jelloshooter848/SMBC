import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';
import { anchored, type SmbcCanvas, type SmbcLayer } from './smbc-anchor';

/**
 * Classic SMBC Ryu at the original 3.1.21 sizes (R1 redraw; `ryu-classic`, his palettes: 0 outline,
 * 1 suit, 2 suit shade and mask, 3 skin, 4 wraps and scarf, 5 blade). New art drawn by hand to the
 * measured per-frame sizes and feet anchors (RyuMc, NES px): stand 17x32, run 20-22x31 (four poses), fall
 * 17x31, flip 20x16 / 16x22, slash 18x31 then 26x29 with the 14x7 sword layer, crouch 17x24,
 * crouch slash 18x23 then 25x23, throw 26x29, wall cling 15x31 (throw 21x31), jump slash 22x23 /
 * 24x25, hurt and die 16x22. Poses on the ground stand on the canvas's bottom edge.
 */

/** His canvas: room for the Sword Extension's wave ahead (47.5 px), origin at column 48. */
export const RYU_SMBC_CANVAS: SmbcCanvas = { w: 96, h: 34, cx: 48 };

/** Rows turned half a turn (upside down and back to front). */
const turn = (rows: readonly string[]): string[] => flipH([...rows].reverse());

// The hooded head, 11x10, facing right: the hood, the skin strip with one eye, the mask.
const head = [
  '...000000..',
  '..01111110.',
  '.0111111110',
  '.0121111110',
  '.0121033330',
  '.0121033030',
  '.0112222220',
  '..012222220',
  '...0122220.',
  '....02220..',
];
// Eye shut, head bowed (hurt, die).
const headHurt = head.map((r, i) => (i === 5 ? '.0121033330' : i === 4 ? '.0121000030' : r));

// The scarf: hanging from the knot, and streaming back.
const scarfDown = ['...44', '.444.', '44...'];
const scarfBack = ['....444', '444444.', '44.....'];
const hilt = ['55', '00'];

/* ---------- torsos (9 rows) ---------- */

const torso = [
  '....00000000000..',
  '...0211111111120.',
  '...0201111111020.',
  '...0201111111020.',
  '...0202111111020.',
  '...0402111111040.',
  '...0404444444040.',
  '...02202111110220',
  '....000211111000.',
];
// The front arm thrust forward at shoulder height, glove at the end (slash, throw).
const torsoReach = [
  '....00000000000000',
  '...021111111114422',
  '...020111111100000',
  '...0201111110.....',
  '...0202111110.....',
  '...0402111110.....',
  '...0404444440.....',
  '...0220211110.....',
  '....000211110.....',
];
// The front arm straight up (wind-up, cling).
const torsoUp = [
  '....0000000001100',
  '...02111111111100',
  '...0201111110....',
  '...0201111110....',
  '...0202111110....',
  '...0402111110....',
  '...0404444440....',
  '...0220211110....',
  '....000211110....',
];
const armUp = ['0220', '0220', '0440', '0440', '0110', '0110', '0110', '0110', '0110'];

/* ---------- legs ---------- */

const legsStand = [
  '......0211110....',
  '......0211110....',
  '......0211110....',
  '......0210110....',
  '......0210110....',
  '......0210110....',
  '......0210110....',
  '......0440440....',
  '......0440440....',
  '......0440440....',
  '......0440440....',
  '......02202220...',
  '......00000000...',
];
// The run's three legs (12 rows): stride, passing, lead.
const legsRun0 = [
  '.......0211110......',
  '.......0211110......',
  '.......0211110......',
  '......02100110......',
  '.....0210..0110.....',
  '....0210....0110....',
  '...0210......0110...',
  '..0440........0440..',
  '..0440........0440..',
  '.0440..........0440.',
  '.0220..........02220',
  '.000...........00000',
];
const legsRun1 = [
  '.......0211110........',
  '.......0211110........',
  '.......02101110.......',
  '.......0210.01110.....',
  '.......0210...01110...',
  '.......0440.....0440..',
  '.......0440......0440.',
  '.......0440......0440.',
  '.......0440.....02220.',
  '.......0220.....00000.',
  '.......02220..........',
  '.......00000..........',
];
const legsRun2 = [
  '.......0211110......',
  '......021000110.....',
  '.....0210..0110.....',
  '....0210...0110.....',
  '...0210....0440.....',
  '..0440.....0440.....',
  '..0440.....0440.....',
  '.0440......0440.....',
  '.0440......02220....',
  '.0220......00000....',
  '.02220..............',
  '.00000..............',
];
// The run's last pose (walkEnd): passing again, the other knee coming through behind.
const legsRun3 = [
  '.......0211110........',
  '.......0211110........',
  '......021001110.......',
  '.....0210...0110......',
  '....01110...0110......',
  '...0440.....0440......',
  '..0440......0440......',
  '..0220......0440......',
  '..00........0440......',
  '............0440......',
  '............02220.....',
  '............00000.....',
];
// Falling: legs hanging apart (12 rows).
const legsFall = [
  '......0211110....',
  '.....021001110...',
  '.....0210..0110..',
  '....0210....0110.',
  '....0210....0110.',
  '....0440....0440.',
  '....0440....0440.',
  '....0440....0440.',
  '...0440.....0440.',
  '...0220.....02220',
  '...000......00000',
  '.................',
];
// The slash's lunge (11 rows).
const legsLunge = [
  '......0211110.....',
  '......0211110.....',
  '.....02100110.....',
  '....0210..0110....',
  '...0210....0110...',
  '..0440......0440..',
  '..0440......0440..',
  '.0440........0440.',
  '.0440........0440.',
  '.0220........02220',
  '.000.........00000',
];
// Wall cling: knees to the wall, toes braced on it (12 rows).
const legsCling = [
  '....0211110....',
  '....02111110...',
  '.....00011110..',
  '........01110..',
  '.........0440..',
  '.........0440..',
  '.........0440..',
  '.........0440..',
  '.........0440..',
  '.........0440..',
  '........02220..',
  '........00000..',
];

/* ---------- the sword ---------- */

// The sword layer (swordStg, 14x7): the blade out from the glove with the sweep's light trail.
const sword = [
  '...4444.......',
  '.......4444...',
  '...........44.',
  '55555555555555',
  '00000000000000',
  '...........44.',
  '.......4444...',
];
// The wind-up sword, held up and back over the hood (12 wide).
const swordBack = ['555555555555', '000000000000'];
// The Sword Extension's crescent (swordWaveStg, 32x16 ahead of the blade).
const wave = [
  '..........4444..................',
  '..............44445.............',
  '..................44455.........',
  '.....................44455......',
  '........................4455....',
  '..........................4455..',
  '...........................44455',
  '............................4455',
  '............................4455',
  '...........................44455',
  '..........................4455..',
  '........................4455....',
  '.....................44455......',
  '..................44455.........',
  '..............44445.............',
  '..........4444..................',
];
const waveAlt = wave.map((r) => r.replace(/[45]/g, (c) => (c === '4' ? '5' : '4')));

/* ---------- the tuck and the spin ---------- */

// The flip's tuck: on its side (20x16) and upright (16x22), the hood leading.
const tuckSide = [
  '.......000000.......',
  '.....0011111100.....',
  '....011111111110....',
  '...02111111111110...',
  '..0211111111112000..',
  '.0211111111112033330',
  '.0211111111112033030',
  '02111111111111222220',
  '02111111111111022220',
  '02111111111104444400',
  '0211111111104111110.',
  '02111111110444440...',
  '.0444444404404400...',
  '.0222222200220220...',
  '..0222220.0220220...',
  '...00000..0000000...',
].map((r) => r.replace(' ', '1'));
const tuckUp = [
  '.....000000.....',
  '....01111110....',
  '...0111111110...',
  '...0121033330...',
  '...0121033030...',
  '...0112222220...',
  '....01222220.44.',
  '..0000222200.44.',
  '.02111111110....',
  '0211111111110...',
  '021111111111000.',
  '0211111144444440',
  '0211111011111110',
  '0211110444444440',
  '0444440011111110',
  '.044444000444440',
  '.02222220.044440',
  '..0000000.044440',
  '..........022220',
  '..........022220',
  '..........022220',
  '..........000000',
];

// The Jump Slash (22x23 and 24x25): the tuck with the sword swept out around him.
const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));
const paint = (base: readonly string[], rows: readonly string[], dx: number, dy: number): string[] =>
  base.map((r, y) => {
    const l = rows[y - dy];
    if (l === undefined) return r;
    return [...r]
      .map((c, x) => (l[x - dx] !== undefined && l[x - dx] !== '.' ? (l[x - dx] as string) : c))
      .join('');
  });
const swordUp = [
  '......55',
  '.....550',
  '....550.',
  '...550..',
  '..550...',
  '.550....',
  '0220....',
  '000.....',
];
const swordOut = [
  '...444..',
  '......4.',
  '.......4',
  '.......4',
  '.......4',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '.....444',
  '........',
  '22555555',
  '00000000',
];
const jslashA = paint(paint(blank(22, 23), tuckSide, 0, 7), swordUp, 14, 0);
const jslashB = paint(paint(blank(24, 25), tuckUp, 0, 3), swordOut, 16, 0);

/* ---------- crouch, hurt ---------- */

const crouchBody = [
  '....00000000000..',
  '...0211111111120.',
  '...0402111111040.',
  '...0404444444040.',
  '...0211111111120.',
  '...0211111111120.',
  '...0211111111120.',
  '...0211111111120.',
];
const crouchReach = [
  '....00000000000000',
  '...021111111114422',
  '...040211111100000',
  '...0404444440.....',
  '...0211111111.....',
  '...02111111120....',
  '...02111111120....',
  '...02111111120....',
];
const crouchUp = [
  '....0000000001100',
  '...02111111111100',
  '...0402111110....',
  '...0404444440....',
  '...0211111111....',
  '...02111111120...',
  '...02111111120...',
  '...02111111120...',
];
const legsCrouch = [
  '...021111111110..',
  '..0211111111110..',
  '..02222211111110.',
  '.022444411444420.',
  '.0224444104444220',
  '.0000000000000000',
];

// Knocked back (16x22, the original's takeDamage and die): hood thrown back, knees bent.
const hurtBody = [
  '.022..........22',
  '.044..........44',
  '.044.00000000.44',
  '.0211111111111 1',
  '..0021111111100.',
  '....0211111110..',
  '....0404444440..',
  '....0211111110..',
  '...02110001110..',
  '..0210.....0110.',
  '.0440.......0440',
  '.0220.......0220',
].map((r) => r.replace(' ', '2'));

/* ---------- the sheet ---------- */

const C = RYU_SMBC_CANVAS;
const at = (...layers: SmbcLayer[]): string[] => anchored(C, ...layers);

/** A pose's layers placed with its top-left at (x, y) from the feet (catalogue numbers). */
const pose = (x: number, y: number, ...layers: SmbcLayer[]): SmbcLayer[] =>
  layers.map(([rows, dx, dy]) => [rows, x + dx, y + dy] as const);

// Standing, 17x32 (standStart..standEnd); the breath frame lifts the scarf.
const standing = (scarf: readonly string[]): string[] =>
  at(...pose(-8.5, -32, [scarf, 0, 9], [head, 4, 0], [torso, 0, 10], [hilt, 1, 14], [legsStand, 0, 19]));
// Running, 20-22x31 (walkStart..walkEnd), the scarf streaming back.
const running = (legs: readonly string[], w: number): string[] =>
  at(
    ...pose(
      -12.5,
      -31,
      [scarfBack, 0, 8],
      [head, w - 13, 0],
      [torso, w - 17, 10],
      [hilt, w - 16, 14],
      [legs, 0, 19],
    ),
  );
const slash1 = pose(-8.5, -29, [scarfBack, 0, 8], [head, 5, 0], [torsoReach, 0, 9], [legsLunge, 0, 18]);
const crouchSlash = pose(
  -8.5,
  -23,
  [scarfDown, 0, 8],
  [head, 6, 0],
  [crouchReach, 0, 9],
  [legsCrouch, 0, 17],
);

export const ryuSmbcDef: SpriteDef = {
  palette: 'ryu',
  frames: {
    idle: standing(scarfDown),
    'idle-1': standing(['....44', '.4444.', '44....']),
    'walk-0': running(legsRun0, 20),
    'walk-1': running(legsRun1, 22),
    'walk-2': running(legsRun2, 20),
    'walk-3': running(legsRun3, 20),
    fall: at(...pose(-9.5, -31, [scarfBack, 0, 7], [head, 4, 0], [torso, 0, 10], [legsFall, 0, 19])),
    // The flip (flipStart..flipEnd): side, up, side turned over, up turned over, up.
    jump: at([tuckSide, -9.5, -19]),
    'spin-1': at([tuckUp, -7.5, -22]),
    'spin-2': at([turn(tuckSide), -9.5, -19]),
    'spin-3': at([turn(tuckUp), -7.5, -22]),
    'spin-0': at([tuckUp, -7.5, -22]),
    'jslash-0': at([jslashA, -9.5, -23]),
    'jslash-1': at([jslashB, -15.5, -25]),
    'jslash-2': at([turn(jslashA), -11.5, -24]),
    'jslash-3': at([turn(jslashB), -7.5, -25]),
    // attackStart: the sword up and back over the hood (18x31).
    'slash-0': at(
      ...pose(
        -8.5,
        -31,
        [swordBack, 2, 0],
        [scarfDown, 0, 10],
        [head, 3, 1],
        [armUp, 12, 1],
        [torsoUp, 0, 10],
        [legsStand, 0, 18],
      ),
    ),
    // attack-2: the lunge, the sword layer along the hit box (ARect 7.8, -24.75, 24 x 6.5; the blade from the glove).
    'slash-1': at(...slash1, [sword, 8.5, -25]),
    'slash-wave-0': at(...slash1, [sword, 8.5, -25], [wave, 13, -25]),
    'slash-wave-1': at(...slash1, [sword, 8.5, -25], [waveAlt, 13, -25]),
    crouch: at(...pose(-8.5, -24, [scarfDown, 0, 9], [head, 4, 0], [crouchBody, 0, 10], [legsCrouch, 0, 18])),
    'crouch-slash-0': at(
      ...pose(
        -8.5,
        -23,
        [swordBack, 0, 0],
        [head, 3, 0],
        [armUp.slice(4), 12, 2],
        [crouchUp, 0, 9],
        [legsCrouch, 0, 17],
      ),
    ),
    // crouchAttack-2 (25x23), the sword layer along its box (ARect 7.8, -18.5, 24 x 7.5).
    'crouch-slash': at(...crouchSlash, [sword, 8.5, -18.5]),
    'crouch-slash-wave-0': at(...crouchSlash, [sword, 8.5, -18.5], [wave, 15.5, -19]),
    'crouch-slash-wave-1': at(...crouchSlash, [sword, 8.5, -18.5], [waveAlt, 15.5, -19]),
    // throw-2 (26x29): the arm flung out, the star leaving the glove.
    throw: at(...pose(-8.5, -29, [scarfBack, 0, 8], [head, 5, 0], [torsoReach, 0, 9], [legsLunge, 0, 18]), [
      ['000000000', '444442220', '000000000'],
      8.5,
      -20,
    ]),
    // Wall cling (climbStop, 15x31) and its throw (climbThrow, 21x31).
    cling: at(
      ...pose(
        -7.5,
        -31,
        [scarfDown, 0, 9],
        [head, 2, 0],
        [armUp, 11, 0],
        [torsoUp, -2, 10],
        [legsCling, 0, 19],
      ),
    ),
    'cling-throw': at(
      ...pose(-7.5, -31, [scarfDown, 0, 9], [head, 2, 0], [torsoReach, -2, 10], [legsCling, 0, 19]),
      [['000000', '444220', '000000'], 7.5, -21],
    ),
    hurt: at([hurtBody, -7.5, -12], [headHurt, -5.5, -22]),
    die: at([hurtBody, -7.5, -12], [headHurt, -5.5, -22]),
  },
};
