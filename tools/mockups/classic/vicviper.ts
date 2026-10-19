import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * DESIGN MOCKUP ONLY (docs/classic/VIC_VIPER.md). Not registered in the game: nothing under src/ imports
 * this file. It feeds the storyboard renderer (tools/mockups/classic/render.mjs) so the owner can approve
 * the look before the hero is built.
 *
 * Original "arrowhead starfighter" for the cut Gradius-prototype role. Drawn here from scratch: a long
 * white delta hull with a single needle nose, a bubble canopy set well forward, a swept dorsal fin and a
 * ventral fin, and a square twin nozzle at the tail. It is deliberately not the Konami two-prong shape.
 *
 * Palette index roles (identical across every variant so recolours are plain index swaps):
 *   0 outline   1 hull light   2 hull shade   3 accent (fins, stripe: the power-state colour)
 *   4 canopy    5 canopy glint   6 nozzle   7 glow / flame core   8 flame outer
 */
export const vicPalettes: Record<string, string[]> = {
  // Small: red accents.
  vicviper: [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.redBright,
    NES.blueLight,
    NES.white,
    NES.gray,
    NES.yellowLight,
    NES.orange,
  ],
  // Mushroom (VV-M10): the accents turn blue so the extra hit is visible.
  'vicviper-mushroom': [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.blueMid,
    NES.cyan,
    NES.white,
    NES.gray,
    NES.yellowLight,
    NES.orange,
  ],
  // Fire Flower (VV-M3 recommendation): gold accents, cosmetic only.
  'vicviper-flower': [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.yellow,
    NES.blueLight,
    NES.white,
    NES.gray,
    NES.yellowLight,
    NES.orange,
  ],
};

/* ---------- helpers ---------- */

/** Pad every row to `w` and the frame to `h` rows (bottom-aligned), so hand-drawn rows may be ragged. */
const cell = (w: number, h: number, rows: readonly string[]): string[] => {
  const padded = rows.map((r) => r.padEnd(w, '.').slice(0, w));
  while (padded.length < h) padded.unshift('.'.repeat(w));
  return padded.slice(padded.length - h);
};

/**
 * Pitch the ship by shifting whole columns: columns at or right of `noseX` move `dy` rows, columns at or
 * left of `tailX` move `-dy` rows. A column shift keeps every outline connected, which is enough for a
 * draft tilt (VV art: `up` / `down`).
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
// Second neutral frame: the nozzle glow pulses.
const ship1 = ship0.map((r) => r.replace(/7/g, '6').replace(/^06/, '07'));

/* Jet flame behind the nozzle (VV art: `jetFlame`, `jetFlameSpeed`), 8x5, drawn left of the ship. */
const flame = [
  ['........', '.....888', '...88777', '.....888', '........'],
  ['........', '......88', '....8877', '......88', '........'],
  ['........', '....8888', '..887777', '....8888', '........'],
  ['........', '......88', '.....877', '......88', '........'],
].map((rows) => cell(8, 5, rows));
const flameSpeed = [
  ['............', '.......88888', '...888877777', '.......88888', '............'],
  ['............', '.........888', '.....8887777', '.........888', '............'],
  ['............', '.....8888888', '.88888777777', '.....8888888', '............'],
  ['............', '........8888', '...888887777', '........8888', '............'],
].map((rows) => cell(12, 5, rows));

/* ---------- shots ---------- */

// Bullet, 10x7 box (VV-14); the visible pellet is 8x3 in the middle.
const bullet = cell(10, 7, [
  '..........',
  '..........',
  '.08777770.',
  '.87777778.',
  '.08777770.',
  '..........',
  '..........',
]);
const bulletBack = bullet.map((r) => r.split('').reverse().join(''));
// Laser bolt, 16x6 (VV-M7).
const laser = cell(16, 6, [
  '................',
  '0444444444444440',
  '4555555555555554',
  '4555555555555554',
  '0444444444444440',
  '................',
]);
// Ground missile, 10x10 (VV-M5): flying down-forward, then running along the floor.
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

/* ---------- Option orb, 12x8 (VV-M8) ---------- */

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

/* ---------- Shield pieces, 13x13 (VV-M9) ---------- */

// Each piece is a round energy cell: a bright core inside a blue rim, flattened on the side facing the ship.
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
const shieldTopHurt = shieldTop.map((r, y) =>
  r.replace(/[15]/g, (_c, x: number) => ((x + y) % 2 ? '.' : '4')),
);
const shieldBotHurt = [...shieldTopHurt].reverse();

/* ---------- Power capsule, 16x16 (VV-M3) ---------- */

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

/* ---------- Death explosion, 24x24, 4 frames (generated rings) ---------- */

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

/* ---------- Portrait 16x16 (HUD / select screen) ---------- */

const portrait = cell(16, 16, [
  '0000000000000000',
  '0..............0',
  '0..00..........0',
  '0..030.........0',
  '0...0330000....0',
  '0.0022211110...0',
  '0662111455110..0',
  '0762333333311100',
  '0662222222222000',
  '0.0022333000...0',
  '0...0330.......0',
  '0...000........0',
  '0..............0',
  '0..............0',
  '0..............0',
  '0000000000000000',
]);

export const vicDef: SpriteDef = {
  palette: 'vicviper',
  frames: {
    'normal-0': ship0,
    'normal-1': ship1,
    'up-0': pitch(ship0, -1, 22, 7),
    'up-1': pitch(pitch(ship0, -1, 22, 7), -1, 27, 3),
    'down-0': pitch(ship0, 1, 22, 7),
    'down-1': pitch(pitch(ship0, 1, 22, 7), 1, 27, 3),
    'flame-0': flame[0] as string[],
    'flame-1': flame[1] as string[],
    'flame-2': flame[2] as string[],
    'flame-3': flame[3] as string[],
    'flame-speed-0': flameSpeed[0] as string[],
    'flame-speed-1': flameSpeed[1] as string[],
    'flame-speed-2': flameSpeed[2] as string[],
    'flame-speed-3': flameSpeed[3] as string[],
    bullet,
    'bullet-back': bulletBack,
    laser,
    'missile-down': missileDown,
    'missile-run': missileRun,
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
    portrait,
  },
};

/** Power-bar slot labels (VV-20): two-letter cells drawn with the HUD font, full name beside the bar. */
export const VIC_BAR = [
  { cell: 'SP', name: 'SPEED UP' },
  { cell: 'MS', name: 'MISSILE' },
  { cell: 'DB', name: 'DOUBLE' },
  { cell: 'LS', name: 'LASER' },
  { cell: 'OP', name: 'OPTION' },
  { cell: '?', name: 'SHIELD' },
] as const;
