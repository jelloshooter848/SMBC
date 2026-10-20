import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';

/**
 * Classic SMBC Link's own sheet (R1 redraw), new art drawn here at the original 3.1.21 sizes:
 * a 1x NES-scale adventurer, 15 x 16 standing (the campaign's `link` sheet is 16 x 28 on a 16 x 32
 * cell and stays as it is). Sizes, anchors and frame counts follow the original's LinkMc
 * (ANIMATION_CATALOGUE: stand 15x16, walk 14x15 / 15x16, stab 15x15 + a 16x7 sword, rolls 15x14 /
 * 14x15, thrusts 15x16 / 16x15 / 12x16 / 16x16, climb 12x16, death spin 15x16 / 14x15 / 12x16 and
 * the 10x10 / 16x16 sparkle); the pixels are our own, in the `link` palettes' roles:
 *   0 eye / dark   1 tunic   2 tunic shade   3 skin   4 hair   5 boots & belt
 *   6 glint        7 blade   8 grip          9 hilt & shield trim   a shield
 *
 * Every frame faces right with the feet on row FEET (the bottom of the 16 px body) and Link's
 * centre on column 8, so a frame drawn at (body x - 2, body y - `LINK_CLASSIC_TOP[frame]`) stands
 * on the ground. A blade below the feet (down stabs) or above the head (up stabs) makes the cell
 * taller; `LINK_CLASSIC_TOP` gives the rows above the body's top for those.
 */

/** The death's grey (the original's black-and-white palette row 4), in the `link` roles. */
export const linkClassicPalettes: Record<string, string[]> = {
  'link-classic-grey': [
    NES.black,
    NES.lightGray,
    NES.gray,
    NES.white,
    NES.gray,
    NES.darkGray,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.lightGray,
    NES.gray,
  ],
};

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

/** A block turned a quarter clockwise (square). */
const rotateCW = (rows: readonly string[]): string[] => {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
};

/* ---------- bodies (16 x 16, facing right, feet on the bottom row) ---------- */

// Standing (15 x 16): pointed cap with its tail down the back, fringe, a profile face with the
// ear behind, tunic with a belt, arms at the sides, brown boots.
const stand = [
  '.....1111111....',
  '...11111111111..',
  '..2111111111111.',
  '.221144444411...',
  '.22.4433330330..',
  '.2..34333333333.',
  '.2...433333333..',
  '.....55533333...',
  '...3111111113...',
  '..33111111113...',
  '..3311111111133.',
  '...355555555.33.',
  '...1111111111...',
  '...22221.2222...',
  '..5555...5555...',
  '.55555...55555..',
];

// Walk, contact (14 x 15): a pixel lower, legs apart.
const walkA = [
  '................',
  '.....1111111....',
  '...11111111111..',
  '..2111111111111.',
  '.22114444441....',
  '.2.44333303303..',
  '.2..43333333333.',
  '.....5533333....',
  '...31111111113..',
  '..331111111113..',
  '...3111111111...',
  '...355555555....',
  '..2111111111....',
  '.5522.....2255..',
  '.555........555.',
  '5555........555.',
];

// Walk, passing (15 x 16): upright, the back leg lifted.
const walkB = [
  '.....1111111....',
  '...11111111111..',
  '..2111111111111.',
  '.221144444411...',
  '.22.4433330330..',
  '.2..34333333333.',
  '.2...433333333..',
  '.....55533333...',
  '...3111111113...',
  '..33111111113...',
  '..3311111111133.',
  '...355555555.33.',
  '...1111111111...',
  '...2222.22221...',
  '..5555...5555...',
  '.........55555..',
];

// The stab (15 x 15): lunging forward, the sword arm straight out at chest height. The sword
// itself is a separate layer (`swordFwd`).
const stab = [
  '................',
  '....1111111.....',
  '..11111111111...',
  '.2111111111111..',
  '2211444444411...',
  '22.443333033033.',
  '2..34333333333..',
  '....45533333....',
  '..311111111333..',
  '.3311111111333..',
  '..331111111.....',
  '...55555555.....',
  '..1111111111....',
  '.5522....22255..',
  '5555......5555..',
  '5555......55555.',
];

// The stab pulling back (14 x 15): the sword arm bent at the side.
const stabBack = [
  '................',
  '.....1111111....',
  '...11111111111..',
  '..2111111111111.',
  '.22114444441....',
  '.2.44333303303..',
  '.2..43333333333.',
  '.....5533333....',
  '...31111111113..',
  '..331111111333..',
  '...3111111133...',
  '...355555555....',
  '..2111111111....',
  '..522.....225...',
  '.5555.....5555..',
  '.5555.....5555..',
];

// Up (16 x 16): looking up, both hands raising the sword over the cap (the blade above is
// `swordUp`).
const stabUp = [
  '.....33.33......',
  '.....1111111....',
  '...111111111111.',
  '..2111111111111.',
  '.221144444411...',
  '.22.4433330330..',
  '22..34333333333.',
  '2....433333333..',
  '...3355533333...',
  '..3311111111....',
  '...111111111....',
  '...355555555....',
  '...1111111111...',
  '...22221.2222...',
  '..5555...5555...',
  '.55555...55555..',
];

// Up, held (12 x 16): seen from the front, arms up.
const stabUpHold = [
  '...33....33.....',
  '...33.11.33.....',
  '...311111113....',
  '..31111111113...',
  '..31444444413...',
  '..34033330343...',
  '...433333334....',
  '...153333351....',
  '..1111111111....',
  '..2111111112....',
  '..2111111112....',
  '..2555555552....',
  '..1111111111....',
  '..2222..2222....',
  '..5555..5555....',
  '.55555..55555...',
];

// Down (16 x 15): bending over, both hands on the hilt below the belt (blade below: `swordDown`).
const stabDown = [
  '................',
  '......1111111...',
  '....11111111111.',
  '...2111111111111',
  '..22114444441...',
  '..2.44333303303.',
  '..2..43333333333',
  '......5533333...',
  '..1111111111....',
  '.21111111111....',
  '.2111111111.....',
  '..555555333.....',
  '..1111111333....',
  '.5522...2255....',
  '5555.....5555...',
  '5555.....55555..',
];

// Down, held (14 x 16): upright again, the hilt at the belt.
const stabDownHold = [
  '.....1111111....',
  '...11111111111..',
  '..2111111111111.',
  '.221144444411...',
  '.22.4433330330..',
  '.2..34333333333.',
  '.2...433333333..',
  '.....55533333...',
  '...3111111111...',
  '..31111111111...',
  '..311111111333..',
  '...35555555333..',
  '...1111111111...',
  '...22221.2222...',
  '..5555...5555...',
  '..5555...5555...',
];

// Air, upright (14 x 15): knees up, arms out for balance.
const air = [
  '................',
  '.....1111111....',
  '...11111111111..',
  '..2111111111111.',
  '.22114444441....',
  '.2.44333303303..',
  '.2..43333333333.',
  '.....5533333....',
  '..3311111111333.',
  '.33.11111111.33.',
  '....11111111....',
  '....55555555....',
  '...111111111....',
  '..55222..2255...',
  '.5555.....5555..',
  '.555.......555..',
];

// Curled up for the somersault (15 x 14 on its side, 14 x 15 upright): cap on top, the face
// tucked to the knees, the boots folded under.
const curl = [
  '................',
  '.....111111.....',
  '...1111111111...',
  '..211111111111..',
  '.2211444444411..',
  '.2.443333330330.',
  '...4333333333333',
  '...443333333333.',
  '..3311111113333.',
  '.33111111113333.',
  '.3111111155555..',
  '.21111115555555.',
  '..2111155555555.',
  '...2222.555555..',
  '....222.55555...',
  '................',
];

// Climbing, from behind (12 x 16): the cap, the back of the head, arms up the vine.
const climbA = [
  '..33............',
  '..33.1111111....',
  '..3311111111....',
  '..31111111111...',
  '..3144444441....',
  '..3444444444....',
  '...434444434....',
  '...111111111....',
  '..2111111111....',
  '..21111111113...',
  '..2111111111133.',
  '..255555555533..',
  '..1111111111....',
  '..2222..2222....',
  '..5555..5555....',
  '........5555....',
];
const climbB = flipH(climbA);

// Facing the screen (15 x 16): the death spin's front pose and the death flash.
const front = [
  '....11111111....',
  '...1111111111...',
  '..111111111111..',
  '.21144444444112.',
  '.2443333333344..',
  '..403333330340..',
  '...4333333334...',
  '....53333335....',
  '..311111111113..',
  '.33111111111133.',
  '.33111111111133.',
  '..355555555553..',
  '...1111111111...',
  '...2222..2222...',
  '..5555....5555..',
  '..5555....5555..',
];

// Seen from behind (12 x 16): the death spin's back pose.
const back = [
  '.....111111.....',
  '....11111111....',
  '...1111111111...',
  '...2444444442...',
  '...4444444444...',
  '...4444444444...',
  '....34444443....',
  '....55555555....',
  '...3111111113...',
  '..331111111133..',
  '..331111111133..',
  '...3555555553...',
  '...1111111111...',
  '...2222..2222...',
  '..5555....5555..',
  '..5555....5555..',
];

// Arms raised (14 x 16): both hands up over the cap (holding a prize at a castle).
const raise = [
  '33..........33..',
  '.33..1111..33...',
  '..3111111113....',
  '..3111111111....',
  '.231444444413...',
  '.234033330343...',
  '.2.433333334....',
  '...153333351....',
  '..1111111111....',
  '..2111111112....',
  '..2111111112....',
  '..2555555552....',
  '..1111111111....',
  '..2222..2222....',
  '..5555..5555....',
  '.55555..55555...',
];

// The death sparkle: a small star (10 x 10), then a big one (16 x 16).
const sparkSmall = [
  '................',
  '................',
  '.......6........',
  '...6...6...6....',
  '....6..6..6.....',
  '.....6.7.6......',
  '...66677766.....',
  '.....6.7.6......',
  '....6..6..6.....',
  '...6...6...6....',
  '.......6........',
  '...............',
  '................',
  '................',
  '................',
  '................',
];
const sparkBig = [
  '.......6........',
  '.6.....6.....6..',
  '..6....6....6...',
  '...6...6...6....',
  '....6..7..6.....',
  '.....6.7.6......',
  '......777.......',
  '6666677a7766666.',
  '......777.......',
  '.....6.7.6......',
  '....6..7..6.....',
  '...6...6...6....',
  '..6....6....6...',
  '.6.....6.....6..',
  '.......6........',
  '................',
];

/* ---------- weapons ---------- */

// The sword level (16 x 7 in the original, a 16 x 3 blade here with its guard): grip in the
// hand, guard, blade, a bright tip.
const swordFwd = ['.9..............', '8997777777777776', '.9..............'];
// Pointing up and down (3 x 12).
const swordUp = ['.6.', '.7.', '.7.', '.7.', '.7.', '.7.', '.7.', '.7.', '.7.', '999', '.8.', '.8.'];
const swordDown = [...swordUp].reverse();

// The shield (big Link only, the original's `LinkShieldMc` side 8 x 10): held in front.
const shieldSide = ['.0000.', '09aa90', '0aaaa0', '0a99a0', '0aaaa0', '0aaaa0', '09aa90', '.0000.'];

/* ---------- frames ---------- */

const W = 16;
const H = 16;
/** Stab frames: room for the sword out in front (its tip at x 8 + 18.5, the original's reach). */
const STAB_W = 28;
/** A blade above the head / below the feet. */
const UP_ROWS = 11;
const DOWN_ROWS = 10;

const body = (rows: readonly string[]): string[] => compose(W, H, [rows, 0, 0]);
const withSword = (rows: readonly string[], dx: number, dy: number): string[] =>
  compose(STAB_W, H, [swordFwd, dx, dy], [rows, 0, 0]);
const above = (rows: readonly string[], swordX: number): string[] =>
  compose(W, H + UP_ROWS, [swordUp, swordX, 0], [rows, 0, UP_ROWS]);
const below = (rows: readonly string[], swordX: number): string[] =>
  compose(W, H + DOWN_ROWS, [rows, 0, 0], [swordDown, swordX, H - 2]);

/** The bodies alone (the sizes the tests check against the original's), by frame. */
export const LINK_CLASSIC_BODIES: Record<string, readonly string[]> = {
  idle: stand,
  'walk-0': walkA,
  'walk-1': walkB,
  'attack-0': stab,
  'attack-1': stabBack,
  'attack-2': stand,
  'attack-air': air,
  'stab-up-0': stabUp,
  'stab-up-1': stabUpHold,
  'stab-down-0': stabDown,
  'stab-down-1': stabDownHold,
  'up-thrust-0': stabUpHold,
  'up-thrust-1': stabUp,
  'down-thrust-0': stabDownHold,
  'down-thrust-1': stabDown,
  throw: stab,
  jump: air,
  'roll-0': curl,
  'roll-1': rotateCW(curl),
  'roll-2': rotateCW(rotateCW(curl)),
  'climb-0': climbA,
  'climb-1': climbB,
  'raise-arms': raise,
  'die-front': front,
  'die-right': walkA,
  'die-back': back,
  'die-left': flipH(walkA),
  'die-spark-0': sparkSmall,
  'die-spark-1': sparkBig,
};

const frames: Record<string, string[]> = {
  idle: body(stand),
  'walk-0': body(walkA),
  'walk-1': body(walkB),
  // The stab's three poses (attackStart 9 f, attack-2, attackEndGround), the sword's grip in the
  // hand: out at full reach, then pulled back to the hand.
  'attack-0': withSword(stab, 11, 8),
  'attack-1': withSword(stabBack, 5, 8),
  'attack-2': withSword(stand, 1, 8),
  'attack-air': withSword(air, 1, 8),
  'stab-up-0': above(stabUp, 4),
  'stab-up-1': above(stabUpHold, 4),
  'stab-down-0': below(stabDown, 9),
  'stab-down-1': below(stabDownHold, 11),
  'up-thrust-0': above(stabUpHold, 4),
  'up-thrust-1': above(stabUp, 4),
  'down-thrust-0': below(stabDownHold, 11),
  'down-thrust-1': below(stabDown, 9),
  throw: body(stab),
  jump: body(air),
  'roll-0': body(LINK_CLASSIC_BODIES['roll-0'] as string[]),
  'roll-1': body(LINK_CLASSIC_BODIES['roll-1'] as string[]),
  'roll-2': body(LINK_CLASSIC_BODIES['roll-2'] as string[]),
  'climb-0': body(climbA),
  'climb-1': body(climbB),
  'raise-arms': body(raise),
  'die-front': body(front),
  'die-right': body(walkA),
  'die-back': body(back),
  'die-left': body(flipH(walkA)),
  'die-spark-0': body(sparkSmall),
  'die-spark-1': body(sparkBig),
};

/** Frames that show the shield when Link has one (the Mushroom and Flower states), and where. */
const SHIELD_AT: Record<string, [number, number]> = {
  idle: [10, 7],
  'walk-0': [10, 8],
  'walk-1': [10, 7],
  jump: [10, 8],
  'attack-1': [9, 8],
  'attack-2': [10, 7],
  'attack-air': [10, 8],
};
for (const [name, [x, y]] of Object.entries(SHIELD_AT)) {
  const f = frames[name] as string[];
  frames[`${name}-shield`] = paste(f, shieldSide, x, y);
}

/** Rows of a frame above the body's top (a blade over the head), else 0. */
export const LINK_CLASSIC_TOP: Record<string, number> = {
  'stab-up-0': UP_ROWS,
  'stab-up-1': UP_ROWS,
  'up-thrust-0': UP_ROWS,
  'up-thrust-1': UP_ROWS,
};
export const LINK_CLASSIC_SHIELD = new Set(Object.keys(SHIELD_AT));
export const LINK_CLASSIC_DOWN_ROWS = DOWN_ROWS;

export const linkClassicDef: SpriteDef = { palette: 'link', frames };
