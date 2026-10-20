import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Classic SMBC's hero shots in the original 3.1.21's colours and sizes (F2 fidelity pass; our own
 * pixels, drawn here from the measured numbers only):
 *
 * - Samus's beam: a 4 x 5 bolt (drawn in an 8 x 8 cell around a 4 x 5 body, see
 *   ProjectileSpec.drawOffset), red rim, orange, green core, a white glint at its head; its burst
 *   7 x 8. Its frames go on the `items` sheet (smbcBeamItemFrames), whose palette's nearest red,
 *   orange and green stand in for the original's.
 * - The Wave Beam: an 8 x 8 ring with a black outline, the same colours; with the Flower, the
 *   only state that has it, Varia turns the orange pink (`wave-varia-*`).
 * - A missile: 11 x 8, a white and red nose, an orange body, cyan fins (the original's
 *   missile-mode colour), and the same turned up.
 * - Mario and Luigi's Fire Flower ball: 8 x 8, filling its cell, 4 spin frames, and a 16 x 16
 *   burst (`fireball-burst`, drawn by Flash 4 px up and left of the 8 x 8 ball).
 *
 * Stored pointing LEFT like every shot (Projectile.render mirrors one flying right).
 *
 * Palette roles (laid out like the `items` sheet's where they share a use): 0 outline   1 white
 * 2 red   3 green core   5 pink (Varia's orange)   6 cyan (missile fins)   7 orange.
 */

/** The original's measured shot colours (SamusShot and MarioFireBall default palette rows). */
const RIM_RED = '#d82800';
const SHOT_ORANGE = '#fc9838';
const CORE_GREEN = '#009400';
const VARIA_PINK = '#fcc4d8';

export const smbcShotPalettes: Record<string, string[]> = {
  'smbc-shots': [NES.black, NES.white, RIM_RED, CORE_GREEN, NES.black, VARIA_PINK, NES.cyan, SHOT_ORANGE],
};

const rotateCW = (rows: readonly string[]): string[] => {
  const n = rows.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => (rows[n - 1 - x] as string)[y] as string).join(''),
  );
};
/** Varia: the orange becomes pink. */
const varia = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/7/g, '5'));
const transpose = (rows: readonly string[]): string[] =>
  Array.from({ length: (rows[0] as string).length }, (_, x) => rows.map((r) => r[x] as string).join(''));

// The beam in the `items` sheet's roles (2 red, 7 orange, 4 green, 1 white, 5 gold): a 4 x 5 bolt
// in rows 1-5, columns 2-5 of the cell, a white glint at the head (left) and a gold one behind.
const beam0 = [
  '........',
  '...22...',
  '..1772..',
  '..1442..',
  '..2775..',
  '...22...',
  '........',
  '........',
];
const beam1 = [
  '........',
  '...22...',
  '..1742..',
  '..1442..',
  '..2475..',
  '...22...',
  '........',
  '........',
];
// Its burst where it ends: 7 x 8 sparks around the core (items roles).
const beamBurstItems = [
  '...2....',
  '.2.7.2..',
  '..747...',
  '2744472.',
  '..747...',
  '.2.7.2..',
  '...2....',
  '...2....',
];

/** Classic Samus's beam frames for the `items` sheet. */
export const smbcBeamItemFrames: Record<string, string[]> = {
  'classic-beam-0': beam0,
  'classic-beam-1': beam1,
  'classic-beam-burst': beamBurstItems,
};

// The Wave Beam's burst (this sheet's roles).
const burst = [
  '...2....',
  '.2.7.2..',
  '..737...',
  '2733372.',
  '..737...',
  '.2.7.2..',
  '...2....',
  '...2....',
];

// The Wave Beam: an 8 x 8 ring with a black outline; the two frames swap the inner colours.
const wave0 = [
  '..0000..',
  '.022220.',
  '02777720',
  '02733720',
  '02733720',
  '02777720',
  '.022220.',
  '..0000..',
];
const wave1 = [
  '..0000..',
  '.077770.',
  '07222270',
  '07233270',
  '07233270',
  '07222270',
  '.077770.',
  '..0000..',
];

// A missile, 11 x 8, nose left: a white and red tip, an orange body, cyan fins at the tail.
const missile = [
  '.......00..',
  '..00000660.',
  '.012777770.',
  '01227777770',
  '02227777770',
  '.022777770.',
  '..00000660.',
  '.......00..',
];

// The Fire Flower ball, 8 x 8, filling its cell: a white heart, orange, a red rim; the bright
// spot turns a quarter each frame.
const fireball0 = [
  '..2222..',
  '.211772.',
  '21117772',
  '27117772',
  '27771772',
  '27777772',
  '.277772.',
  '..2222..',
];
const fireball1 = rotateCW(fireball0);
const fireball2 = rotateCW(fireball1);
const fireball3 = rotateCW(fireball2);
// Its burst, 16 x 16 (the largest of the original's 8 -> 12 x 14 -> 16 x 16 frames).
const fireballBurst = [
  '.......22.......',
  '...2...77...2...',
  '....2..77..2....',
  '.....27117.2....',
  '......7117......',
  '..2..711117..2..',
  '...7711111177...',
  '2771111111111772',
  '2771111111111772',
  '...7711111177...',
  '..2..711117..2..',
  '......7117......',
  '.....27117.2....',
  '....2..77..2....',
  '...2...77...2...',
  '.......22.......',
];

export const smbcShotsDef: SpriteDef = {
  palette: 'smbc-shots',
  frames: {
    'wave-0': wave0,
    'wave-1': wave1,
    'wave-burst': burst,
    'wave-varia-0': varia(wave0),
    'wave-varia-1': varia(wave1),
    'wave-varia-burst': varia(burst),
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
