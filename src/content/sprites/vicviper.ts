import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Vic Viper, the Classic-only starfighter (bug-reports/2026-10-07-vicviper-build-classic-character.md,
 * VV-M19; approved draft from docs/classic/VIC_VIPER.md). Original art: a long white delta hull with
 * one needle nose, a bubble canopy set forward, a swept dorsal fin, a ventral fin and a square
 * nozzle at the tail (deliberately not the Konami two-prong shape).
 *
 * Palette index roles (the same in every palette, so recolours are index swaps):
 *   0 outline   1 hull light   2 hull shade   3 accent (fins, stripe: the power-state colour)
 *   4 canopy    5 canopy glint   6 nozzle   7 glow / flame core   8 flame outer
 *
 * Flight frames (`fly-<pose>-<flame>-<n>`) are the 32 x 16 ship cell with its jet flame baked in
 * on the left: 44 x 16, the ship's cell starting at x 12 (FLY_SHIP_X). Poses: `normal`, `up-1`,
 * `up-2`, `down-1`, `down-2` (nose tilted one or two rows); flames `slow` (jetFlame) and `fast`
 * (jetFlameSpeed, with Speed Up); n 0..3.
 */

function palette(accent: string, canopy: string): string[] {
  return [
    NES.black,
    NES.white,
    NES.lightGray,
    accent,
    canopy,
    NES.white,
    NES.gray,
    NES.yellowLight,
    NES.orange,
  ];
}

export const vicviperPalettes: Record<string, string[]> = {
  // Small: red accents.
  vicviper: palette(NES.redBright, NES.blueLight),
  // Mushroom (VV-M10): blue accents, so the extra hit shows.
  'vicviper-mushroom': palette(NES.blueMid, NES.cyan),
  // Fire Flower (VV-M3): gold accents, cosmetic.
  'vicviper-flower': palette(NES.yellow, NES.blueLight),
  // Star (PS-C19): the hull and accents cycle.
  'vicviper-star-0': palette(NES.yellow, NES.white).map((c, i) => (i === 2 ? NES.yellowLight : c)),
  'vicviper-star-1': palette(NES.cyan, NES.white).map((c, i) => (i === 2 ? NES.blueLight : c)),
  'vicviper-star-2': palette(NES.greenLight, NES.white).map((c, i) => (i === 2 ? NES.green : c)),
  'vicviper-star-3': palette(NES.pink, NES.white).map((c, i) => (i === 2 ? NES.magenta : c)),
};

/* ---------- helpers ---------- */

/** Pad every row to `w` and the frame to `h` rows (bottom-aligned), so hand-drawn rows may be ragged. */
const cell = (w: number, h: number, rows: readonly string[]): string[] => {
  const padded = rows.map((r) => r.padEnd(w, '.').slice(0, w));
  while (padded.length < h) padded.unshift('.'.repeat(w));
  return padded.slice(padded.length - h);
};

/**
 * Pitch the ship by shifting whole columns: columns at or right of `noseX` move `dy` rows, columns at
 * or left of `tailX` move `-dy` rows (keeps every outline connected).
 */
const pitch = (rows: readonly string[], dy: number, noseX: number, tailX: number): string[] => {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const out = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  for (let x = 0; x < w; x++) {
    const shift = x >= noseX ? dy : x <= tailX ? -dy : 0;
    for (let y = 0; y < h; y++) {
      const ty = y + shift;
      if (ty < 0 || ty >= h) continue;
      (out[ty] as string[])[x] = (rows[y] as string)[x] as string;
    }
  }
  return out.map((r) => r.join(''));
};

/** `top` drawn over `base` at (`dx`, `dy`); '.' in `top` is transparent. */
const overlay = (base: readonly string[], top: readonly string[], dx: number, dy: number): string[] =>
  base.map((row, y) =>
    [...row]
      .map((c, x) => {
        const t = top[y - dy]?.[x - dx];
        return t !== undefined && t !== '.' ? t : c;
      })
      .join(''),
  );

/** `rows` cropped to its drawn pixels. */
const trim = (rows: readonly string[]): string[] => {
  const ys = rows.map((r, y) => (/[^.]/.test(r) ? y : -1)).filter((y) => y >= 0);
  const xs = rows.flatMap((r) => [...r].map((c, x) => (c === '.' ? -1 : x)).filter((x) => x >= 0));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  return rows.slice(ys[0], (ys[ys.length - 1] as number) + 1).map((r) => r.slice(x0, x1 + 1));
};

/* ---------- the ship, 32x16 cell, nose to the right ---------- */

const SHIP_W = 32;
const SHIP_H = 16;

const ship0 = cell(SHIP_W, SHIP_H, [
  '................................',
  '................................',
  '...000..........................',
  '...0330.........................',
  '....03300.......................',
  '....033330000...................',
  '.000022222111100000.............',
  '06622221111111111111000.........',
  '07622111114455111111111000......',
  '06622111144444411111111111000...',
  '0762233333333333333311111111100.',
  '0662222222222222222222222200....',
  '.000022233333000000000000.......',
  '....03333300....................',
  '....033300......................',
  '....0000........................',
]);

/** The ship's poses (VV art `normal`, `up`, `down`): the nose tilted one or two rows. */
const POSES: Record<string, { rows: readonly string[]; tail: number }> = {
  normal: { rows: ship0, tail: 0 },
  'up-1': { rows: pitch(ship0, -1, 22, 7), tail: 1 },
  'up-2': { rows: pitch(pitch(ship0, -1, 22, 7), -1, 27, 3), tail: 2 },
  'down-1': { rows: pitch(ship0, 1, 22, 7), tail: -1 },
  'down-2': { rows: pitch(pitch(ship0, 1, 22, 7), 1, 27, 3), tail: -2 },
};

/* Jet flame behind the nozzle (VV art `jetFlame`, `jetFlameSpeed`), 12 x 5, drawn left of the ship. */
const flameSlow = [
  ['........', '.....888', '...88777', '.....888', '........'],
  ['........', '......88', '....8877', '......88', '........'],
  ['........', '....8888', '..887777', '....8888', '........'],
  ['........', '......88', '.....877', '......88', '........'],
].map((rows) => cell(12, 5, rows.map((r) => r.padStart(12, '.'))));
const flameFast = [
  ['............', '.......88888', '...888877777', '.......88888', '............'],
  ['............', '.........888', '.....8887777', '.........888', '............'],
  ['............', '.....8888888', '.88888777777', '.....8888888', '............'],
  ['............', '........8888', '...888887777', '........8888', '............'],
].map((rows) => cell(12, 5, rows));

/** Where the ship's 32 x 16 cell starts in a flight frame. */
export const FLY_SHIP_X = 12;
const FLY_W = FLY_SHIP_X + SHIP_W;

function flyFrames(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [pose, { rows, tail }] of Object.entries(POSES)) {
    for (const [kind, flames] of [
      ['slow', flameSlow],
      ['fast', flameFast],
    ] as const) {
      flames.forEach((flame, n) => {
        // The glow pulses with the flame.
        const ship = n % 2 ? rows.map((r) => r.replace(/7/g, '6')) : [...rows];
        const blank = Array.from({ length: SHIP_H }, () => '.'.repeat(FLY_W));
        const withShip = overlay(blank, ship, FLY_SHIP_X, 0);
        // The nozzle's rows are 7..11; the flame's core row (2) meets the nozzle's middle (9).
        out[`fly-${pose}-${kind}-${n}`] = overlay(withShip, flame, 0, 7 + tail);
      });
    }
  }
  return out;
}

/* ---------- shots ---------- */

// Bullet, 10 x 7 box (VV-14); the visible pellet is 8 x 3 in the middle.
const bullet = cell(10, 7, [
  '..........',
  '..........',
  '.08777770.',
  '.87777778.',
  '.08777770.',
  '..........',
  '..........',
]);
// Laser bolt, 16 x 6 (VV-M7); level 2's is 32 x 6.
const laser = cell(16, 6, [
  '................',
  '0444444444444440',
  '4555555555555554',
  '4555555555555554',
  '0444444444444440',
  '................',
]);
const laserLong = laser.map((r) => (r[0] as string) + r.slice(1, 15).repeat(2) + r.slice(1, 3) + (r[15] as string));
// Ground missile, 10 x 10 (VV-M5): flying down-forward, then running along the floor.
const missileDown = cell(10, 10, [
  '..........',
  '.80.......',
  '.8810.....',
  '..81110...',
  '...011120.',
  '....01220.',
  '.....0220.',
  '......00..',
  '..........',
  '..........',
]);
const missileRun = cell(10, 10, [
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
  '..00000...',
  '8801111200',
  '8701112220',
  '..00000...',
  '..........',
]);
// A shot ending on a wall (VV art `shotHitWall`), 8 x 8.
const shotHit = cell(8, 8, [
  '...8....',
  '.8.7..8.',
  '..777...',
  '87717778',
  '..777...',
  '.8.7.8..',
  '...8....',
  '........',
]);

/* ---------- Option orb, 12 x 8 (VV-M8) ---------- */

const option0 = cell(12, 8, [
  '...000000...',
  '..08888880..',
  '.0887777880.',
  '.0877117780.',
  '.0877117780.',
  '.0887777880.',
  '..08888880..',
  '...000000...',
]);
const option1 = cell(12, 8, [
  '....0000....',
  '..00888800..',
  '.0887777880.',
  '088771177880',
  '088771177880',
  '.0887777880.',
  '..00888800..',
  '....0000....',
]);

/* ---------- Shield pieces, 13 x 13 (VV-M9) ---------- */

// A round energy cell: a bright core inside a blue rim, flattened on the side facing the ship.
const shieldTop = Array.from({ length: 13 }, (_, y) =>
  Array.from({ length: 13 }, (_, x) => {
    const d = Math.hypot(x - 6, (y - 6) * 1.15);
    if (d > 6.2 || x < 2) return '.';
    if (d > 5) return '0';
    if (d > 3.2) return '4';
    return d > 1.5 ? '5' : '1';
  }).join(''),
);
const shieldBot = [...shieldTop].reverse();
const shieldTopHurt = shieldTop.map((r, y) => r.replace(/[15]/g, (_c, x: number) => ((x + y) % 2 ? '.' : '4')));
const shieldBotHurt = [...shieldTopHurt].reverse();

/* ---------- Power capsule, 16 x 16 (VV-M3) ---------- */

const capsule0 = cell(16, 16, [
  '................',
  '................',
  '....00000000....',
  '...0333333330...',
  '..033111133330..',
  '..031133333330..',
  '.03333377333330.',
  '.03333777733330.',
  '.03333777733330.',
  '.03333377333330.',
  '..033333333330..',
  '..033333333330..',
  '...0333333330...',
  '....00000000....',
  '................',
  '................',
]);
const capsule1 = capsule0.map((r) => r.replace(/7/g, '1'));

/* ---------- Death explosion, 24 x 24, 4 frames ---------- */

const ring = (r0: number, r1: number, core: number): string[] =>
  Array.from({ length: 24 }, (_, y) =>
    Array.from({ length: 24 }, (_, x) => {
      const d = Math.hypot(x - 11.5, y - 11.5);
      const jag = ((x * 7 + y * 13) % 5) * 0.35;
      if (d < core) return '1';
      if (d < r0 - jag) return '7';
      if (d < r1 - jag) return '8';
      return '.';
    }).join(''),
  );
const boom = [
  ring(4, 6, 2),
  ring(7, 9, 3),
  ring(9, 12, 1),
  ring(10, 12.5, 0).map((r, y) => (y % 2 ? r : r.replace(/7/g, '.'))),
];

export const vicviperDef: SpriteDef = {
  palette: 'vicviper',
  frames: {
    ...flyFrames(),
    // The select screen and the intro card stand the ship on a floor line: cropped to its pixels.
    portrait: trim(ship0),
    bullet,
    laser,
    'laser-long': laserLong,
    'missile-down': missileDown,
    'missile-run': missileRun,
    'shot-hit': shotHit,
    'option-0': option0,
    'option-1': option1,
    'shield-top': shieldTop,
    'shield-bot': shieldBot,
    'shield-top-hurt': shieldTopHurt,
    'shield-bot-hurt': shieldBotHurt,
    'capsule-0': capsule0,
    'capsule-1': capsule1,
    'boom-0': boom[0] as string[],
    'boom-1': boom[1] as string[],
    'boom-2': boom[2] as string[],
    'boom-3': boom[3] as string[],
    // After the burst: nothing drawn.
    none: ['.'],
  },
};
