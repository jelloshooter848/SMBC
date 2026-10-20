/**
 * Classic SMBC Samus's poses (R1 redraw), new art drawn here at the original 3.1.21 sizes: a full
 * 33 px suit (the campaign's `samus` sheet is 16 x 28 and stays as it is). Sizes, anchors and frame
 * counts follow the original's SamusMc (ANIMATION_CATALOGUE: stand 22x33 with the cannon out,
 * walk 17x32 / 19x33 / 22x33, shooting walk 22 / 24 / 27 x 32, aiming up 16x39, jump 20x27, jump
 * shot 25x27, up-jump 20x34, somersault 21x17 / 16x25, crouch 23x25, ball 14x15, climb 18x33);
 * the pixels are our own, in the `samus` palettes' roles:
 *   0 outline   1 light armour   2 dark armour (shoulders, boots, cannon)   3 visor
 *   4 white / highlight   5 glow (cannon muzzle, morph ball core)
 *
 * Every frame faces right on a CELL_W-wide cell with Samus's centre (the original's origin) on
 * column ORIGIN and her feet on the bottom row, so a frame drawn at (body x - (ORIGIN - 6),
 * body y + body h - frame h) stands on the ground whatever its height.
 */

/** Cell width and the column of her centre (the body's centre x). */
export const SAMUS_CLASSIC_CELL_W = 28;
export const SAMUS_CLASSIC_ORIGIN = 14;

const W = SAMUS_CLASSIC_CELL_W;

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

/** A `h`-row cell with each layer pasted at its (x, y). */
const cell = (h: number, ...layers: [readonly string[], number, number][]): string[] =>
  layers.reduce<string[]>((acc, [rows, dx, dy]) => paste(acc, rows, dx, dy), blank(W, h));

/** A square block turned a quarter clockwise. */
const rotateCW = (rows: readonly string[]): string[] => {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
};

/* ---------- parts (facing right) ---------- */

// Helmet (12 x 10): a rounded dome with a ridge highlight, the visor band at the front, jaw plates.
const helmet = [
  '...000000...',
  '..01144110..',
  '.0111111140.',
  '011111111110',
  '011110000000',
  '011110433330',
  '011110333330',
  '011110000000',
  '.0221111120.',
  '..00222200..',
];

// Helmet tipped back to look up (12 x 10): the visor turned to the sky.
const helmetUp = [
  '....00000...',
  '...0333330..',
  '..03343330..',
  '.0111000010.',
  '011111111110',
  '011111111110',
  '011141111110',
  '011111111110',
  '.0221111120.',
  '..00222200..',
];

// Torso, cannon arm out level (16 x 10): the round back pad, the chest, the front pad the cannon
// comes out of, the belt and the narrow waist.
const torsoOut = [
  '.0000.01110.000.',
  '0222200111022220',
  '0222201111022220',
  '0222011111102220',
  '.000011111100000',
  '.01001111110....',
  '.01002222220....',
  '.02001111110....',
  '..0001111110....',
  '....00000000....',
];

// Torso, cannon arm hanging (16 x 10): the barrel down the front of the thigh.
const torsoDown = [
  '.0000.01110.000.',
  '0222200111022220',
  '0222201111022220',
  '0222011111102220',
  '.00001111110220.',
  '.01001111110220.',
  '.01002222220220.',
  '.02001111110250.',
  '..0001111110000.',
  '....00000000....',
];

// Torso, cannon raised (13 x 10): the front pad tucked in under the upright barrel.
const torsoUp = [
  '.0000.011100.',
  '0222200111020',
  '0222201111020',
  '0222011111100',
  '.00001111110.',
  '.01001111110.',
  '.01002222220.',
  '.02001111110.',
  '..0001111110.',
  '....00000000.',
];

// The cannon level (7 x 5), with the muzzle's ring and glow; with a shot just out (8 x 5).
const cannon = ['000000.', '2222240', '2222245', '2222240', '000000.'];
const cannonShot = ['0000000.', '22222440', '22222455', '22222440', '0000000.'];

// Legs (24 wide, placed at column 0): 13 rows standing, hips under the waist (columns 10-17).
const legsStand = [
  '.........0111001110.....',
  '.........0111001110.....',
  '.........0111001110.....',
  '.........0211002110.....',
  '.........0221002210.....',
  '.........0221002210.....',
  '.........0221002210.....',
  '.........0221002210.....',
  '.........02210022210....',
  '.........02210022210....',
  '........022210022221....',
  '........022220022222....',
  '........000000000000....',
];

// Walk 1 (the original's walk-1, 32 tall): legs close, the back knee bent (12 rows).
const legsWalk0 = [
  '.........0111001110.....',
  '.........0111001110.....',
  '........01110.01110.....',
  '........0211..02110.....',
  '........0221..02210.....',
  '.......0221...02210.....',
  '.......0221...02210.....',
  '.......0221...022210....',
  '......02221...022210....',
  '......02220..0222221....',
  '......00000..0222220....',
  '.............0000000....',
];

// Walk 2 (19 wide): the stride opening, the back boot two columns further back.
const legsWalk1 = [
  '.........0111001110.....',
  '........01110..01110....',
  '........0111...01110....',
  '.......0211.....02110...',
  '.......0221.....02210...',
  '......0221......02210...',
  '......0221......02210...',
  '.....02210......02210...',
  '.....0221.......022210..',
  '....02221.......022210..',
  '...022220......0222221..',
  '...000000......0222222..',
  '...............0000000..',
];

// Walk 3 (22 wide): the full stride, the back boot right out behind.
const legsWalk2 = [
  '.........0111001110.....',
  '........011100.01110....',
  '.......01110....01110...',
  '......02110......02110..',
  '.....02210.......02210..',
  '....02210.........02210.',
  '....0221..........02210.',
  '...022210.........02210.',
  '..0222210.........022210',
  '..0222220.........022210',
  '..0000000........0222221',
  '.................0222222',
  '.................0000000',
];

// Knees up for the jump (9 rows): thighs forward, shins folded under, boots off the floor.
const legsTuck = [
  '.........01111111111110.',
  '.......0011111111111110.',
  '.....0022200000000000...',
  '....022221..............',
  '...0222221..............',
  '...0222210..............',
  '...022220...............',
  '...00000................',
  '........................',
];

// Kneeling (8 rows): the front knee up, the back shin flat behind.
const legsKneel = [
  '.........01111111110....',
  '........0111111111110...',
  '........0221.....02210..',
  '.......02221.....02210..',
  '......022221.....02210..',
  '.....0222221....022210..',
  '....02222220....022220..',
  '....00000000....000000..',
];

// Kneeling to shoot (8 rows): the back shin drawn in, braced on the toes.
const legsKneelShoot = [
  '.........01111111110....',
  '........0111111111110...',
  '........0221.....02210..',
  '.......02221.....02210..',
  '......022221.....02210..',
  '......022221....022210..',
  '......022220....022220..',
  '......000000....000000..',
];

// Climbing, from behind (18 x 33): the back of the helmet and suit, arms up, one knee raised.
const climbBack = [
  '.....00......00...',
  '....0220....0220..',
  '....0220....0220..',
  '....02200000220...',
  '....02011111020...',
  '....0011111110....',
  '....0111111111 0..',
  '....01111111110...',
  '....01111111110...',
  '....01111111110...',
  '....01111111110...',
  '.....022222220....',
  '..000002222200000.',
  '.02222011111022220',
  '.02222011111022220',
  '.02220111111102220',
  '..000011111110000.',
  '.....0111111110...',
  '.....0222222220...',
  '.....0111111110...',
  '.....0111111110...',
  '......00000000....',
  '.....0111001110...',
  '.....0111001110...',
  '.....0221001110...',
  '.....0221002210...',
  '.....0221002210...',
  '.....0221.02210...',
  '....02221.02210...',
  '....02221.02210...',
  '....00000.022210..',
  '..........022220..',
  '..........000000..',
].map((r) => r.replace(/ /g, '1'));

// The somersault on her side (21 x 17): the helmet leading, the pads and knees balled behind it.
const tuckSide = [
  '.....000000..........',
  '...0011111100........',
  '..011111111110.......',
  '.01111100000010......',
  '.01111043333010000...',
  '022222033333012220...',
  '022222000000022220...',
  '022220221111022220...',
  '.000011111111100000..',
  '...011111111111111100',
  '...011111111111111120',
  '...00000000002222220.',
  '.........0222222220..',
  '.........0222222220..',
  '..........02222220...',
  '...........000000....',
  '.....................',
];
// Upright in the turn (16 x 25): the helmet on top, the knees hugged to the chest, boots under.
const tuckUp = [
  '.....000000.....',
  '....01144110....',
  '...0111111140...',
  '..011111111110..',
  '..011110000000..',
  '..011110433330..',
  '..011110333330..',
  '..011110000000..',
  '..02211111120...',
  '.0000222222000..',
  '0222200111022220',
  '0222201111022220',
  '0222011111102220',
  '.000011111110000',
  '....0111111111110',
  '....0111111111110',
  '....0000000022210',
  '...........02210',
  '..........022210',
  '..........022210',
  '.........0222210',
  '.........0222210',
  '.........0222220',
  '.........0000000',
  '................',
];
/** Turned half round (upside down and back to front). */
const halfTurn = (rows: readonly string[]): string[] => {
  const w = Math.max(...rows.map((r) => r.length));
  return [...rows].reverse().map((r) => [...r.padEnd(w, '.')].reverse().join(''));
};

// The morph ball (14 x 15): a shell of plates round a glowing core; four turns.
const ball = [
  '.....0000.....',
  '...00222200...',
  '..0221111220..',
  '.022111111220.',
  '.021114411120.',
  '02111455411120',
  '02111455511120',
  '02111145511120',
  '02111114411120',
  '.021111111120.',
  '.022111111220.',
  '..0221111220..',
  '...00222200...',
  '.....0000.....',
  '..............',
];

/* ---------- frames ---------- */

type Layer = [readonly string[], number, number];

/** Standing figure: helmet, torso and legs stacked (20 rows over the legs), `extra` from the helmet's top. */
function figure(
  torso: readonly string[],
  legs: readonly string[],
  extra: Layer[] = [],
  head = helmet,
  above = 0,
): string[] {
  const h = above + 20 + legs.length;
  const top = above;
  return cell(
    h,
    [legs, 0, top + 20],
    [torso, 6, top + 10],
    [head, 9, top],
    ...extra.map(([r, x, y]): Layer => [r, x, top + y]),
  );
}

// The muzzle 12.5 px ahead and 22 up (SamusShot.as, MUZZLE in classic-weapons.ts).
const out: Layer[] = [[cannon, 21, 9]];
const outShot: Layer[] = [[cannonShot, 21, 9]];
/** The barrel up the front of the helmet, `rise` rows above it (6 aiming, 4 with the shot's flash). */
const barrel = (rise: number, shot: boolean): Layer[] => [
  [[shot ? '.55.' : '0440', ...Array.from({ length: rise + 11 }, () => '0220')], 17, -rise],
];
/** Aiming up over `legs`: 39 rows standing (the original's upStand), 37 with the shot. */
const aiming = (legs: readonly string[], shot: boolean): string[] => {
  const rise = shot ? 4 : 6;
  return figure(torsoUp, legs, barrel(rise, shot), helmetUp, rise + (13 - legs.length));
};

const shift = (layers: Layer[], dy: number): Layer[] => layers.map(([r, x, y]): Layer => [r, x, y + dy]);

const frames: Record<string, string[]> = {
  idle: figure(torsoOut, legsStand, out),
  shoot: figure(torsoOut, legsStand, outShot),
  'walk-0': figure(torsoDown, legsWalk0),
  'walk-1': figure(torsoDown, legsWalk1),
  'walk-2': figure(torsoDown, legsWalk2),
  'walk-shoot-0': figure(torsoOut, legsWalk0, outShot),
  'walk-shoot-1': figure(torsoOut, legsWalk1, outShot),
  'walk-shoot-2': figure(torsoOut, legsWalk2, outShot),
  'aim-up': aiming(legsStand, false),
  'aim-up-shoot': aiming(legsStand, true),
  'up-walk-0': aiming(legsWalk0, false),
  'up-walk-1': aiming(legsWalk1, false),
  'up-walk-2': aiming(legsWalk2, false),
  'up-walk-shoot-0': aiming(legsWalk0, true),
  'up-walk-shoot-1': aiming(legsWalk1, true),
  'up-walk-shoot-2': aiming(legsWalk2, true),
  air: cell(27, [legsTuck, 0, 19], [torsoDown, 6, 8], [helmet, 9, 0]),
  'air-shoot': cell(27, [legsTuck, 0, 19], [torsoOut, 6, 8], [helmet, 9, 0], [cannonShot, 21, 10]),
  'up-air': cell(34, [legsTuck, 0, 26], [torsoUp, 6, 16], [helmetUp, 9, 8], ...shift(barrel(8, false), 8)),
  'up-air-shoot': cell(
    32,
    [legsTuck, 0, 24],
    [torsoUp, 6, 14],
    [helmetUp, 9, 6],
    ...shift(barrel(6, true), 6),
  ),
  crouch: cell(25, [legsKneel, 0, 17], [torsoOut, 6, 8], [helmet, 9, 0], [cannon, 21, 11]),
  'crouch-shoot': cell(25, [legsKneelShoot, 0, 17], [torsoOut, 6, 8], [helmet, 9, 0], [cannon, 21, 11]),
  'climb-0': cell(33, [climbBack, 5, 0]),
  'climb-1': cell(33, [climbBack.map((r) => [...r].reverse().join('')), 5, 0]),
};
// The somersault (flipStart, flip-2, flip-3, flipEnd): on her side, upside down, on her other
// side, upright; on a 26-row cell, the side poses 4 px off the feet line (the original's anchors).
frames['spin-0'] = cell(26, [tuckSide, 4, 5]);
frames['spin-1'] = cell(26, [halfTurn(tuckUp), 6, 1]);
frames['spin-2'] = cell(26, [halfTurn(tuckSide), 4, 5]);
frames['spin-3'] = cell(26, [tuckUp, 6, 0]);
for (let i = 0; i < 4; i++) {
  let b = ball;
  for (let k = 0; k < i; k++) b = rotateCW(b.slice(0, 14).map((r) => r)).concat(['..............']);
  frames[`ball-${i}`] = cell(15, [b, 7, 0]);
}
frames.hurt = frames.air as string[];
frames.die = frames.idle as string[];

/** Samus's Classic poses, by frame (the `samus-classic` sheet adds her death's pieces). */
export const SAMUS_CLASSIC_FRAMES: Readonly<Record<string, readonly string[]>> = frames;
