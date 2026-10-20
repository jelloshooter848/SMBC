import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipX, rotate } from './sophia-draw';
import { anchored, trimmed, type SmbcCanvas, type SmbcLayer } from './smbc-anchor';

/**
 * Classic SMBC Sophia III and Jason at the original 3.1.21 sizes (R1 redraw; `sophia-classic`,
 * the `sophia` palettes and roles: 0 outline, 1-3 hull, 4 white, 5-7 steel, 8-9 glass, a-c jets,
 * d-e suit, f skin). New art drawn by hand to the measured sizes (SophiaMc, NES px): the hull
 * 26x16 (SophiaBaseMc `horz`) over two 8x8 wheels 8 px either side of her centre, about 26x18 in
 * all; the turn 18x16, the cannon diagonal 25x24 and straight up 21x26, the hatch open 26x24.
 * Jason (JasonMc) has the original's only two poses: `stand` 10x17 and `walk` 10x16.
 *
 * The tank frames keep the campaign sheet's contract (sophia.ts): 32x32, facing right, the
 * frame's centre the centre of her 19x15.5 box, the wheels on row 23, so the world's turning and
 * the wall / ceiling rotations draw them the same way. Jason's frames are 16x18, feet on the
 * bottom row, his 8 px box at columns 4-11.
 */

/** The tank's frame: 32x32, her feet's centre at column 16, row 24 (the box's bottom). */
const TANK: SmbcCanvas = { w: 32, h: 32, cx: 16 };
const FEET = -8;
/** Jason's frame: 16x18, feet centre at column 8 on the bottom edge. */
export const JASON_SMBC_CANVAS: SmbcCanvas = { w: 16, h: 18, cx: 8 };

const tank = (...layers: SmbcLayer[]): string[] =>
  anchored(TANK, ...layers.map(([r, x, y]) => [r, x, y + FEET] as const));

// The hull (horz, 26x16), facing right: the short aerial at the back, the glass canopy, the
// cannon forward, the hull's wedge with its light stripe and headlight, the wheel wells below.
const hull = [
  '..0.......................',
  '.030......0000............',
  '.060....00999900..........',
  '.060...0998899990.........',
  '.060..099849999990000000..',
  '.0600099999999990555555500',
  '..033111111111111066666670',
  '..011111111111111100000000',
  '.0333311111111111133333330',
  '01111111111111111111111110',
  '011117171711111111111111a0',
  '0c100002222222222220000110',
  '.0222220222222222202222220',
  '..00000.0222222220.000000.',
  '.........02222220.........',
  '..........000000..........',
];
// The hull without its cannon (the barrel drawn by the aim frames), and with the hatch open.
const hullBody = hull.map((r, y) => (y >= 4 && y <= 7 ? r.slice(0, 18) : r));

// The turn (18x16): three-quarter, then head-on.
const hullThreeQuarter = [
  '..0...............',
  '.030...0000.......',
  '.060.00999900.....',
  '.060099889999000..',
  '.06009984999905550',
  '.0600999999990666 ',
  '..033111111111000.',
  '.0333311111113330.',
  '011111111111111110',
  '011171717111111a10',
  '0c1000222222200010',
  '.0222220222202220.',
  '..00000.02220000..',
  '........0220......',
  '.........00.......',
  '..................',
].map((r) => r.replace(' ', '0'));
const hullFront = [
  '........0.........',
  '....0000300000....',
  '...009999999900...',
  '..09988999988990..',
  '..09984999984990..',
  '..09999999999990..',
  '.0331111111111330.',
  '.0111111551111110.',
  '011111105501111110',
  '0a1717111111717 a0',
  '0c1000222222000c10',
  '.0222202222022220.',
  '..00000222200000..',
  '.......0220.......',
  '........00........',
  '..................',
].map((r) => r.replace(' ', '1'));

// The cannon raised: diagonal (diag 25x24) and straight up (up 21x26).
const barrelDiag = [
  '.......00',
  '......0550',
  '.....05560',
  '....055600',
  '...055600.',
  '..055600..',
  '.055600...',
  '05560 0...',
  '0560......',
].map((r) => r.replace(' ', '0'));
const barrelUp = ['0000', '0550', '0560', '0560', '0560', '0560', '0560', '0560', '0560', '0560'];

// The hatch thrown back (open, 26x24): Jason's helmet in the canopy.
const hatchOpen = [
  '.....0000.......',
  '....099990......',
  '...0998890......',
  '...0999990......',
  '....00990.......',
  '......090.......',
  '......0900000...',
  '.......04444440.',
  '......0444499990',
  '......0444498890',
];

// A wheel (8x8) in four roll steps: the tread mark goes round a quarter a step.
const WHEEL = [
  '..0000..',
  '.066660.',
  '06777760',
  '06755760',
  '06755760',
  '06777760',
  '.066660.',
  '..0000..',
];
const MARKS = [
  [3, 1],
  [6, 3],
  [4, 6],
  [1, 4],
] as const;
const wheel = (k: number): string[] =>
  WHEEL.map((r, y) =>
    [...r].map((c, x) => (MARKS[k & 3]?.[0] === x && MARKS[k & 3]?.[1] === y ? '4' : c)).join(''),
  );

// The hover jets under the wheels: big and small.
const jetBig = ['abba', 'abba', '.cc.', '.cc.', '..c.'];
const jetSmall = ['abba', '.cc.', '..c.'];

/** The tank on the ground: the hull `bob` px up, the wheels rolled to step `k`, dropped `drop`. */
const tankPose = (
  o: { k?: number; bob?: number; drop?: number; body?: readonly string[]; jets?: readonly string[] } = {},
): string[] => {
  const k = o.k ?? 0;
  const drop = o.drop ?? 0;
  return tank(
    [o.body ?? hull, -13, -18 - (o.bob ?? 0)],
    [wheel(k + 1), -12, -8 + drop],
    [wheel(k), 4, -8 + drop],
    ...(o.jets
      ? ([
          [o.jets, -10, drop],
          [o.jets, 6, drop],
        ] as SmbcLayer[])
      : []),
  );
};

const idle = tankPose();

/* ---------- Jason ---------- */

const jasonTop = [
  '..000000..',
  '.04444440.',
  '0444444440',
  '0444499990',
  '0444498890',
  '0444499990',
  '.04444440.',
  '..000000..',
  '.0dddddd0.',
  '0dddddddd0',
  '0ededdede0',
  '0f0dddd0f0',
  '.00eeee00.',
];
const jasonStand = [...jasonTop, '..0dd0dd0.', '..0dd0dd0.', '.0770.0770', '.0000.0000'];
const jasonWalk = [...jasonTop, '.0dd0.0dd0', '0770..0770', '0000..0000'];
const J = JASON_SMBC_CANVAS;
const stand = anchored(J, [jasonStand, -5, -17]);
const walk = anchored(J, [jasonWalk, -5, -16]);

export const sophiaSmbcDef: SpriteDef = {
  palette: 'sophia',
  frames: {
    idle,
    // The select screen's and the intro card's portrait: the tank, cropped.
    portrait: trimmed(idle),
    'drive-0': idle,
    'drive-1': tankPose({ k: 1, bob: 1 }),
    'drive-2': tankPose({ k: 2 }),
    'drive-3': tankPose({ k: 3, bob: 1 }),
    jump: tankPose({ drop: 4 }),
    'hover-0': tankPose({ drop: 2, jets: jetBig }),
    'hover-1': tankPose({ drop: 2, jets: jetSmall }),
    open: tank([hullBody, -13, -18], [hatchOpen, -10, -24], [wheel(1), -12, -8], [wheel(0), 4, -8]),
    'aim-diag': tank([hullBody, -13, -18], [barrelDiag, 3, -24], [wheel(1), -12, -8], [wheel(0), 4, -8]),
    // Up: the hull lifted on its struts, the barrel straight up.
    'aim-up': tank(
      [hullBody, -13, -22],
      [barrelUp, 1, -24],
      [['.0.', '060', '060', '060'], -9, -8],
      [['.0.', '060', '060', '060'], 7, -8],
      [wheel(1), -12, -8],
      [wheel(0), 4, -8],
    ),
    'turn-0': tank([hullThreeQuarter, -7, -18], [wheel(1), -9, -8], [wheel(0), 1, -8]),
    'turn-1': tank([hullFront, -9, -18], [wheel(0), -4, -8]),
    'turn-2': flipX(tank([hullThreeQuarter, -7, -18], [wheel(1), -9, -8], [wheel(0), 1, -8])),
    'tilt-up': rotate(idle, -45),
    'tilt-down': rotate(idle, 45),
    // Jason: the original's two frames serve every pose (he has no jump or climb frames).
    'jason-stand': stand,
    'jason-walk-0': walk,
    'jason-walk-1': stand,
    'jason-walk-2': walk,
    'jason-jump': walk,
    'jason-climb-0': stand,
    'jason-climb-1': flipX(stand),
    'jason-hurt': walk,
    'jason-die': walk,
  },
};
