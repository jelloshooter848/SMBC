import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Classic SMBC Simon's poses (R1 redraw), new art drawn here at the original 3.1.21 sizes (the
 * campaign's `simon` sheet stays as it is). Sizes, anchors and frame counts follow the original's
 * SimonMc and SimonWhipMc (ANIMATION_CATALOGUE: stand 16x30, walk 12x31 / 15x30 / 12x31 / 16x30,
 * whip and throw 24x30 arm back / 16x30 / 22x29 arm out, crouch 16x23 with 24x23 / 16x23 / 22x22,
 * tucked jump 16x23, hurt 16x29, climb 13x34, death 16x21 then 32x15; the lash hangs 8x24 behind,
 * waves 16x19 overhead, then strikes 23 px (leather, chain) or 44 px (the long whip)); the pixels
 * are our own, in the `simon` palettes' roles:
 *   0 outline   1 skin   2 hair / headband (dark)   3 tunic / armour (light brown)
 *   4 trousers & boots (dark brown)   5 whip, buckle and metal highlight (light)
 *
 * Every frame faces right, its feet on the bottom row, Simon's centre (the original's origin) on
 * column `SIMON_CLASSIC_ORIGIN[frame]`: drawn at (body x + 6 - origin, body y + body h - frame h)
 * he stands on the floor whatever the frame's size.
 */

/** Work canvas: wide enough for a lash 52 px ahead and a whip hanging 24 px behind. */
const CW = 96;
const O = 32;

type Layer = [readonly string[], number, number];

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

/** Layers at x relative to Simon's centre, y from the top of an `h`-row cell. */
const canvas = (h: number, layers: Layer[]): string[] =>
  layers.reduce<string[]>(
    (acc, [rows, dx, dy]) => paste(acc, rows, O + dx, dy),
    Array.from({ length: h }, () => '.'.repeat(CW)),
  );

/** The drawn columns of a canvas, and where its centre column lands. */
function crop(rows: readonly string[]): { rows: string[]; origin: number } {
  let x0 = CW;
  let x1 = -1;
  for (const r of rows)
    for (let x = 0; x < r.length; x++)
      if (r[x] !== '.') {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  // At least his body's half width behind the centre (the original's -8 for a 16 px body).
  x0 = Math.min(x0, O - 8);
  return { rows: rows.map((r) => r.slice(x0, x1 + 1)), origin: O - x0 };
}

/* ---------- parts (facing right; x from his centre) ---------- */

// Head (12 x 9, at x -6): the mane swept back with a tail behind the neck, the headband, a
// square jaw, one eye.
const head = [
  '..0222222...',
  '.022222222..',
  '0225555552..',
  '0222111111..',
  '02221101100.',
  '0222111111..',
  '.022111000..',
  '..02211111..',
  '....01111...',
];

// Torsos (16 x 9, at x -8): armour over the chest, the belt and buckle, bare arms.
const torsoRest = [
  '...0333333330...',
  '..033333333330..',
  '.01033333333010.',
  '.01103333330110.',
  '.01103333330110.',
  '.01100005000110.',
  '.01104444440110.',
  '.00104444440100.',
  '...04444444400..',
];
// The front arm swung back past his shoulder (24 wide at x -16): the fist behind his head.
const torsoBack = [
  '...........0333333330...',
  '..........033333333330..',
  '00000....01033333333000.',
  '01111000011033333333110.',
  '.0001111111103333330110.',
  '.....00000003333330110..',
  '..........0000005000110.',
  '..........0104444440110.',
  '...........04444444400..',
];
// The front arm raised over his head (16 x 9, the arm itself in `armUp`).
const torsoUpArm = [
  '...0333333330...',
  '..033333333330..',
  '.01033333333300.',
  '.01103333333300.',
  '.01103333330...',
  '.01100005000....',
  '.01104444440....',
  '.00104444440....',
  '...04444444400..',
];
const armUp = ['.00.', '0110', '0110', '0110', '0110', '0110', '0110', '0110', '0110', '0110'];
// The front arm thrust out level (22 wide at x -8): the fist 13 px ahead of his centre.
const torsoOut = [
  '...0333333330.........',
  '..0333333333300000000.',
  '.010333333333111111110',
  '.011033333333000000110',
  '.01103333330.......00.',
  '.01100005000..........',
  '.01104444440..........',
  '.00104444440..........',
  '...04444444400........',
];

// Legs (16 wide at x -8): 12 rows standing.
const legsStand = [
  '....04444440....',
  '....04444440....',
  '....04400440....',
  '....04400440....',
  '....04400440....',
  '....04400440....',
  '....04400440....',
  '....00000000....',
  '....04400440....',
  '....04400440....',
  '....044400444 0.',
  '....00000.000000',
].map((r) => r.replace(' ', '4'));
// Walk: legs passing (12 wide, 13 rows: the figure a pixel taller), the stride, the other passing
// leg, and planted (16 wide, the standing legs with the back heel up).
const legsPassA = [
  '....04444440....',
  '....04444440....',
  '....04400440....',
  '.....0440440....',
  '.....0440440....',
  '.....0440440....',
  '.....0440440....',
  '.....0000000....',
  '.....0440440....',
  '.....0440440....',
  '....0444044440..',
  '....0444000000..',
  '....00000.......',
];
const legsStride = [
  '....04444440....',
  '...044444444....',
  '...0440..0440...',
  '..0440....0440..',
  '..0440....0440..',
  '.0440......0440.',
  '.0440......0440.',
  '.0000......0000.',
  '.0440......0440.',
  '0440.......04440',
  '0440.......044440',
  '0000.......000000',
];
const legsPassB = [
  '....04444440....',
  '....04444440....',
  '....04400440....',
  '....0440.0440...',
  '....0440.0440...',
  '....0440.0440...',
  '....0440..0440..',
  '....0000..0000..',
  '....0440..0440..',
  '....04440.0440..',
  '....044440.0440.',
  '....000000.0000.',
  '...........0000.',
];
// The tucked jump (7 rows): knees up level with the hips, boots folded under.
const legsTuck = [
  '....044444444440',
  '....044444444440',
  '....000000044400',
  '..........04440.',
  '.........044440.',
  '.........044440.',
  '.........000000.',
];
// Crouched (5 rows): thighs flat, the boots side by side.
const legsCrouch = [
  '...0444444444400',
  '..04444444444440',
  '..04440000044440',
  '.044440...044440',
  '.000000...000000',
];

// The whip: hanging behind from the fist (8 x 24), waving overhead (16 x 19).
const whipHang = [
  '0550....',
  '.0550...',
  '..0550..',
  '...050..',
  '...050..',
  '..050...',
  '..050...',
  '.050....',
  '.050....',
  '.050....',
  '..050...',
  '..050...',
  '...050..',
  '...050..',
  '...050..',
  '..050...',
  '..050...',
  '.050....',
  '.050....',
  '.050....',
  '..050...',
  '..050...',
  '...05...',
  '....0...',
];
const whipWave = [
  '..........00000.',
  '.......0005555500',
  '.....005550000.',
  '....0550.......',
  '...050.........',
  '..050..........',
  '..050..........',
  '.050...........',
  '.050...........',
  '.050...........',
  '050............',
  '050............',
  '050............',
  '050............',
  '.050...........',
  '.050...........',
  '..050..........',
  '..050..........',
  '...0...........',
];
/** A straight lash `n` px long (2 rows and an edge), its knots every `knot` px (0: none). */
function lash(n: number, knot: number, tip: readonly string[]): string[] {
  const knots = Array.from({ length: n }, (_, x) => (knot && x % knot === knot - 1 ? '5' : '.')).join('');
  return [knots, '5'.repeat(n), '0'.repeat(n)].map((r, y) => r + (tip[y] ?? ''));
}
// Leather (23 x 8 in the original: the lash with a frayed tip), chain (23 x 6, linked).
const lashLeather = [
  '......................0.',
  ...lash(22, 0, ['55', '505', '0.0']).slice(1),
  '.....................0.0',
];
const lashChain = lash(23, 3, ['', '', '']);
// The long whip (44 px), flames along it (the Flame Whip, SI-C10).
const FLAME = 44;
const dots = (ch: string, from: number, step: number, last = FLAME): string =>
  Array.from({ length: FLAME }, (_, x) => (x >= from && x < last && (x - from) % step === 0 ? ch : '.')).join(
    '',
  );
const lashFlame = [
  dots('2', 3, 6, FLAME - 2),
  dots('2', 1, 3, FLAME - 1),
  '5'.repeat(FLAME - 3) + '252',
  '0'.repeat(FLAME - 4) + '.222',
  dots('2', 2, 4, FLAME - 1),
];

// Climbing, from behind (13 x 34): the mane and its tail, arms up the vine, one knee raised.
const climbBack = [
  '.00.......00.',
  '0110.....0110',
  '0110.....0110',
  '0110.....0110',
  '0110.....0110',
  '0110022220110',
  '.01022222201.',
  '..0222222220.',
  '..0255555520.',
  '..0222222220.',
  '..0222222220.',
  '...02222220..',
  '...00222200..',
  '..0333333330.',
  '.033333333330',
  '.033333333330',
  '.033333333330',
  '.033333333330',
  '.000005500000',
  '..0444444440.',
  '..0444444440.',
  '..0440..0440.',
  '..0440..0440.',
  '..0440..0440.',
  '..0440..0440.',
  '..0000..0440.',
  '..0440..0440.',
  '..0440..0000.',
  '.04440..0440.',
  '.04440..0440.',
  '.00000.04440.',
  '.......04440.',
  '.......00000.',
  '.............',
];

// Knocked back (16 x 29): leaning back, arms flung out, legs apart.
const hurtBody = [
  '..0222222.......',
  '.022222222......',
  '0225555552......',
  '0222111111......',
  '02221101100.....',
  '0222111111......',
  '.022111000......',
  '..02211111......',
  '00..01111...00..',
  '0110333333330110',
  '.01033333333010.',
  '..003333333300..',
  '...0333333330...',
  '...0333333330...',
  '...0000050000...',
  '...0444444440...',
  '...0444444440...',
  '..0440....0440..',
  '..0440....0440..',
  '.0440......0440.',
  '.0440......0440.',
  '.0000......0000.',
  '.0440......0440.',
  '.0440......0440.',
  '04440......04440',
  '04440......04440',
  '00000......00000',
];

// Death: down on his knees (16 x 21), then lying flat (32 x 15).
const kneel = [
  '..0222222.......',
  '.022222222......',
  '0225555552......',
  '0222111111......',
  '02221101100.....',
  '0222111111......',
  '.022111000......',
  '..02211111......',
  '...0333333330...',
  '..033333333330..',
  '.01033333333010.',
  '.01103333330110.',
  '.01103333330110.',
  '.01100005000110.',
  '.0010444444010..',
  '...0444444444400',
  '..04444444444440',
  '..04440000044440',
  '.044440...044440',
  '.000000...000000',
  '................',
];
const lying = [
  '................................',
  '................................',
  '..........000...................',
  '.........0110...................',
  '.....0000110..00000000..........',
  '...00222201100333333330.........',
  '..0222222211103333333330000000..',
  '.022555552211033333333044444440.',
  '.02211111121003333333304444444400',
  '.0221101101.0000050000044444444440',
  '.022111111...0110....0444000004440',
  '..0221111....0110....0000.....0000',
  '...0000......000................',
  '................................',
  '................................',
];

/* ---------- frames ---------- */

const T = 9; // torso top below the head
const L = 18; // legs top (standing)

/** A standing figure 30 rows tall over `legs` (12 rows; 13 make it 31), its torso and extras. */
function stand(
  torso: readonly string[],
  torsoX: number,
  legs: readonly string[],
  extra: Layer[] = [],
): string[] {
  const dy = legs.length - 12;
  return canvas(30 + dy, [
    [legs, -8, L + dy],
    [torso, torsoX, T + dy],
    [head, -6, dy],
    ...extra.map(([r, x, y]): Layer => [r, x, y + dy]),
  ]);
}
/** Crouched, 23 rows: the head and torso 7 rows lower, the legs folded. */
function crouched(torso: readonly string[], torsoX: number, extra: Layer[] = [], drop = 0): string[] {
  return canvas(23, [
    [legsCrouch, -8, 18],
    [torso, torsoX, 9 + drop],
    [head, -6, drop],
    ...extra.map(([r, x, y]): Layer => [r, x, y + drop]),
  ]);
}

const raw: Record<string, string[]> = {
  idle: stand(torsoRest, -8, legsStand),
  'walk-0': stand(torsoRest, -8, legsPassA),
  'walk-1': stand(torsoRest, -8, legsStride),
  'walk-2': stand(torsoRest, -8, legsPassB),
  'walk-3': stand(torsoRest, -8, legsStand),
  // The whip: arm back with the lash hanging behind, arm up with it waving overhead, then out.
  'whip-0': stand(torsoBack, -16, legsStand, [[whipHang, -23, 11]]),
  'whip-1': stand(torsoUpArm, -8, legsStand, [
    [armUp, 4, 0],
    [whipWave, -13, 0],
  ]),
  'whip-leather': canvas(29, [
    [legsStand, -8, 17],
    [torsoOut, -8, 8],
    [head, -6, 0],
    [lashLeather, 14, 5],
  ]),
  'whip-chain': canvas(29, [
    [legsStand, -8, 17],
    [torsoOut, -8, 8],
    [head, -6, 0],
    [lashChain, 13, 8],
  ]),
  'whip-flame': canvas(29, [
    [legsStand, -8, 17],
    [torsoOut, -8, 8],
    [head, -6, 0],
    [lashFlame, 8, 7],
  ]),
  'throw-0': stand(torsoBack, -16, legsStand),
  'throw-1': stand(torsoUpArm, -8, legsStand, [[armUp, 4, 0]]),
  'throw-2': canvas(29, [
    [legsStand, -8, 17],
    [torsoOut, -8, 8],
    [head, -6, 0],
  ]),
  crouch: crouched(torsoRest, -8),
  'crouch-whip-0': crouched(torsoBack, -16, [[whipHang, -23, 11]]),
  'crouch-whip-1': crouched(
    torsoUpArm,
    -8,
    [
      [armUp.slice(0, 8), 4, 2],
      [whipWave.slice(0, 14), -13, 2],
    ],
    0,
  ),
  'crouch-whip-leather': crouched(torsoOut, -8, [[lashLeather, 14, 4]], 0),
  'crouch-whip-chain': crouched(torsoOut, -8, [[lashChain, 13, 7]], 0),
  'crouch-whip-flame': crouched(torsoOut, -8, [[lashFlame, 8, 6]], 0),
  'crouch-throw-0': crouched(torsoBack, -16),
  'crouch-throw-1': crouched(torsoUpArm, -8, [[armUp.slice(0, 8), 4, 2]]),
  'crouch-throw-2': crouched(torsoOut, -8),
  'jump-tuck': canvas(23, [
    [legsTuck, -8, 16],
    [torsoRest, -8, 8],
    [head, -6, 0],
  ]),
  hurt: canvas(29, [[hurtBody, -8, 2]]),
  'climb-0': canvas(34, [[climbBack, -6, 0]]),
  'climb-1': canvas(34, [[climbBack.map((r) => [...r].reverse().join('')), -7, 0]]),
  'die-0': canvas(21, [[kneel, -8, 0]]),
  'die-1': canvas(15, [[lying, -16, 0]]),
};

/** Frames whose lash or sub-weapon arm is not part of the body (the tests measure bodies). */
const WHIP_LAYERS: Record<string, string> = {
  'whip-0': 'throw-0',
  'whip-1': 'throw-1',
  'whip-leather': 'throw-2',
  'whip-chain': 'throw-2',
  'whip-flame': 'throw-2',
  'crouch-whip-0': 'crouch-throw-0',
  'crouch-whip-1': 'crouch-throw-1',
  'crouch-whip-leather': 'crouch-throw-2',
  'crouch-whip-chain': 'crouch-throw-2',
  'crouch-whip-flame': 'crouch-throw-2',
};
export const SIMON_CLASSIC_BODY_OF: Readonly<Record<string, string>> = WHIP_LAYERS;

const cropped = Object.entries(raw).map(([n, rows]) => [n, crop(rows)] as const);
/** Each frame's column of Simon's centre. */
export const SIMON_CLASSIC_ORIGIN: Readonly<Record<string, number>> = Object.fromEntries(
  cropped.map(([n, c]) => [n, c.origin]),
);
export const SIMON_CLASSIC_FRAMES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  cropped.map(([n, c]) => [n, c.rows]),
);

/** Classic SMBC Simon's sheet (`simon-classic`, his palettes). */
export const simonClassicDef: SpriteDef = { palette: 'simon', frames: { ...SIMON_CLASSIC_FRAMES } };
