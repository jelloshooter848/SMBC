import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Classic SMBC's hero shots in the original 3.1.21's colours and sizes (F2 fidelity pass; our own
 * pixels, drawn here from the measured numbers only):
 *
 * - Samus's beam: a 4 x 5 bolt (drawn in an 8 x 8 cell around a 4 x 5 body, see
 *   ProjectileSpec.drawOffset), red rim, orange, green core; its burst 7 x 8. Its frames go on the
 *   `items` sheet (smbcBeamItemFrames).
 * - The Wave Beam: an 8 x 8 ring with a black outline (`wave-*`), the same colours; with the
 *   Flower, the only state that has it, Varia turns the orange pink (`wave-varia-*`).
 * - A missile: 11 x 8 with cyan fins (the original's missile-mode colour), and the same turned up.
 * - Mario and Luigi's Fire Flower ball: 8 x 8, filling its cell, 4 spin frames, and a 16 x 16
 *   burst (`fireball-burst`, drawn by Flash 4 px up and left of the 8 x 8 ball).
 *
 * Stored pointing LEFT like every shot (Projectile.render mirrors one flying right).
 *
 * Palette roles: 0 outline   1 red rim   2 orange   3 green core   4 white   5 pink (Varia's
 * orange)   6 cyan (missile fins).
 */

/** The original's measured shot colours (SamusShot and MarioFireBall default rows). */
const RIM_RED = '#d82800';
const SHOT_ORANGE = '#fc9838';
const CORE_GREEN = '#009400';
const VARIA_PINK = '#fcc4d8';

export const smbcShotPalettes: Record<string, string[]> = {
  'smbc-shots': [NES.black, RIM_RED, SHOT_ORANGE, CORE_GREEN, NES.white, VARIA_PINK, NES.cyan],
};

const rotateCW = (rows: readonly string[]): string[] => {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
};
/** Varia: the orange becomes pink. */
const varia = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/2/g, '5'));
const transpose = (rows: readonly string[]): string[] =>
  Array.from({ length: (rows[0] as string).length }, (_, x) => rows.map((r) => r[x] as string).join(''));

// The beam: a 4 x 5 bolt in rows 1-5, columns 2-5 of the cell; the core pulses.
const beam0 = [
  '........',
  '...11...',
  '..1221..',
  '..1331..',
  '..1221..',
  '...11...',
  '........',
  '........',
];
const beam1 = [
  '........',
  '...11...',
  '..1231..',
  '..1331..',
  '..1321..',
  '...11...',
  '........',
  '........',
];
// Its burst where it ends: 7 x 8 sparks around the core.
const beamBurst = [
  '...1....',
  '.1.2.1..',
  '..232...',
  '1233321.',
  '..232...',
  '.1.2.1..',
  '...1....',
  '...1....',
];

// The Wave Beam: an 8 x 8 ring with a black outline; the two frames swap the inner colours.
const wave0 = [
  '..0000..',
  '.011110.',
  '01222210',
  '01233210',
  '01233210',
  '01222210',
  '.011110.',
  '..0000..',
];
const wave1 = [
  '..0000..',
  '.022220.',
  '02111120',
  '02133120',
  '02133120',
  '02111120',
  '.022220.',
  '..0000..',
];

// A missile, 11 x 8, nose left: a white and red tip, an orange body, cyan fins at the tail.
const missile = [
  '.......00..',
  '..00000660.',
  '.044222220.',
  '04422222220',
  '01122222220',
  '.011222220.',
  '..00000660.',
  '.......00..',
];

// The Fire Flower ball, 8 x 8, filling its cell: a white heart, orange, a red rim; the bright
// spot turns a quarter each frame.
const fireball0 = [
  '..1111..',
  '.144221.',
  '14442221',
  '12442221',
  '12224221',
  '12222221',
  '.122221.',
  '..1111..',
];
const fireball1 = rotateCW(fireball0);
const fireball2 = rotateCW(fireball1);
const fireball3 = rotateCW(fireball2);
// Its burst, 16 x 16 (the largest of the original's 8 -> 12 x 14 -> 16 x 16 frames).
const fireballBurst = [
  '.......11.......',
  '...1...22...1...',
  '....1..22..1....',
  '.....12442 1....',
  '......2442......',
  '..1..244442..1..',
  '...2244444422...',
  '1224444444444221',
  '1224444444444221',
  '...2244444422...',
  '..1..244442..1..',
  '......2442......',
  '.....12442 1....',
  '....1..22..1....',
  '...1...22...1...',
  '.......11.......',
].map((r) => r.replace(/ /g, '.'));

/** Our roles 1-3 (red rim, orange, green core) as the `items` sheet's red, orange and green. */
const toItems = (rows: readonly string[]): string[] =>
  rows.map((r) => r.replace(/[123]/g, (c) => ({ '1': '2', '2': '7', '3': '4' })[c] as string));

/**
 * The beam's frames for the `items` sheet (Classic Samus's beam specs keep that sheet; its
 * palette's nearest red, orange and green stand in for the original's).
 */
export const smbcBeamItemFrames: Record<string, string[]> = {
  'classic-beam-0': toItems(beam0),
  'classic-beam-1': toItems(beam1),
  'classic-beam-burst': toItems(beamBurst),
};

export const smbcShotsDef: SpriteDef = {
  palette: 'smbc-shots',
  frames: {
    'wave-0': wave0,
    'wave-1': wave1,
    'wave-burst': beamBurst,
    'wave-varia-0': varia(wave0),
    'wave-varia-1': varia(wave1),
    'wave-varia-burst': varia(beamBurst),
    missile,
    'missile-up': transpose(missile),
    // Its explosion (the Flash drawn 4 px up and left of the missile).
    'missile-burst': fireballBurst,
    'fireball-0': fireball0,
    'fireball-1': fireball1,
    'fireball-2': fireball2,
    'fireball-3': fireball3,
    'fireball-burst': fireballBurst,
  },
};
