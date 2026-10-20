import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';
import { MEGAMAN_PARTS as MM } from './megaman';

/**
 * Original art for Classic SMBC's Proto Man and Break Man
 * (bug-reports/2026-10-07-protoman-build-classic-character.md, PM-16, PM-17, PM-M2): our Mega Man's
 * build and frame set (megaman.ts, the same canvas and offsets, so the 12 x 22 box lines up) under
 * his own head, a helmet with a stripe over the crown and a dark visor across the eyes, and a scarf
 * knotted at the neck whose tail flies out behind him.
 *
 * Palette index roles (the same six as Mega Man's, so every weapon suit, charge and Star row
 * recolours him as it does Mega Man, PM-16; the scarf keeps its shape in all of them):
 *   0 outline and visor   1 helmet and body   2 gloves, shorts, boots and ear-piece   3 skin
 *   4 helmet stripe and visor glint   5 scarf (and the charge glow)
 */
export const protomanPalettes: Record<string, string[]> = {
  // Proto Man: red helmet and body, grey gloves and boots, a white stripe and a yellow scarf.
  protoman: [NES.black, NES.redBright, NES.gray, NES.skin, NES.white, NES.yellow],
  // Charging (PM-16): the body brightens toward gold as Mega Man's does.
  'protoman-charge-0': [NES.black, NES.redBright, NES.gray, NES.skin, NES.white, NES.cyan],
  'protoman-charge-1': [NES.black, NES.peach, NES.lightGray, NES.skin, NES.white, NES.yellow],
  'protoman-charge-2': [NES.black, NES.yellowLight, NES.yellow, NES.skin, NES.white, NES.white],
  // Break Man, his masked look: dark grey with deep red gloves and boots, the same scarf.
  breakman: [NES.black, NES.darkGray, NES.redDark, NES.skin, NES.lightGray, NES.yellow],
  'breakman-charge-0': [NES.black, NES.darkGray, NES.redDark, NES.skin, NES.lightGray, NES.cyan],
  'breakman-charge-1': [NES.black, NES.gray, NES.redDark, NES.skin, NES.white, NES.yellow],
  'breakman-charge-2': [NES.black, NES.yellowLight, NES.yellow, NES.skin, NES.white, NES.white],
};

/* ---------- composition helpers ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
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

/** `rows` with the palette roles in `map` swapped (in rows `y0..y1`, columns `x0..x1`). */
function recolour(
  rows: readonly string[],
  map: Readonly<Record<string, string>>,
  y0 = 0,
  y1 = rows.length - 1,
  x0 = 0,
  x1 = 99,
): string[] {
  return rows.map((r, y) =>
    y < y0 || y > y1 ? r : [...r].map((c, x) => (x >= x0 && x <= x1 ? (map[c] ?? c) : c)).join(''),
  );
}

/* ---------- parts (all facing right) ---------- */

// Helmet and face, 16 x 10 (rows 8..17 standing, where Mega Man's head is): the stripe along the
// crown, a grey ear-piece, the dark visor across the eyes with a glint, the face and neck below.
const head = [
  '.....000000.....',
  '....04444440....',
  '...0111111110...',
  '..011111111110..',
  '..011110000000..',
  '..012210000400..',
  '..012210000000..',
  '..011103333330..',
  '...0111033330...',
  '.....0000330....',
];

// The visor's glint off (his blink).
const headBlink = head.map((r, i) => (i === 5 ? '..012210000000..' : r));

// The scarf, from row 17 (x 0): knotted at the neck (row 18) with its tail flying out behind
// him, forked at the end; lifted as he moves, and streaming straight back in a jump or slide.
const scarf = ['', '.0000555555', '055555', '.05550', '0550..', '00....'];
const scarfLift = ['000', '05550555555', '.05550', '..000.'];
const scarfStream = ['', '000000555555', '5555550', '000000'];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

/** Every frame that shows his head, Mega Man's poses (megaman.ts headFrames) with the scarf. */
function headFrames(hd: readonly string[], hdBlink: readonly string[]): Record<string, string[]> {
  const standing = (legs: readonly string[], sc: readonly string[] = scarf, h = hd): string[] =>
    compose(W, H, [h, 0, 8], [MM.torso, 0, 18], [legs, 0, 26], [sc, 0, 17]);
  const shooting = (legs: readonly string[], sc: readonly string[], dy = 0): string[] =>
    compose(
      24,
      H,
      [hd, 0, 8 + dy],
      [MM.torsoShoot, 0, 18 + dy],
      [legs, 0, 26 + dy],
      [MM.cannon, 12, 18 + dy],
      [sc, 0, 17 + dy],
    );
  return {
    idle: standing(MM.legsStand),
    'idle-blink': standing(MM.legsStand, scarf, hdBlink),
    'walk-0': standing(MM.legsWalk0, scarfLift),
    'walk-1': compose(W, H, [hd, 0, 7], [MM.torso, 0, 17], [MM.legsWalk1, 0, 25], [scarf, 0, 16]),
    'walk-2': standing(MM.legsWalk2, scarfLift),
    jump: standing(MM.legsJump, scarfStream),
    shoot: shooting(MM.legsStand, scarf),
    'walk-shoot-0': shooting(MM.legsWalk0, scarfLift),
    'walk-shoot-1': shooting(MM.legsWalk1, scarf, -1),
    'walk-shoot-2': shooting(MM.legsWalk2, scarfLift),
    'jump-shoot': shooting(MM.legsJump, scarfStream),
    'climb-shoot': shooting(MM.legsLadder, scarf),
    // Sliding: Mega Man's slide with the scarf streaming back level with the neck.
    slide: compose(
      W,
      H,
      [hd, 2, 16],
      [
        [
          '.0111101111110..',
          '02211101111110..',
          '0220002222220220',
          '000.022220022220',
          '....022220022220',
          '....000000000000',
        ],
        0,
        26,
      ],
      [scarfStream, 1, 24],
    ),
    // Flinch: knocked back, arms thrown out, the scarf flung up.
    hurt: compose(
      W,
      H,
      [hd, -1, 9],
      [
        [
          '...01111110.....',
          '..0111111110....',
          '.0101111110100..',
          '.0201111110200..',
          '.0001111110000..',
          '...02222220.....',
          '...00222220.....',
        ],
        0,
        19,
      ],
      [MM.legsWalk0, 0, 26],
      [['.0.', '020', '020'], 1, 16],
      [['.0.', '020', '020'], 12, 16],
      [scarfLift, 0, 16],
    ),
    // Standing with the charge glow sparking round the cannon hand.
    'charge-0': compose(
      W,
      H,
      [hd, 0, 8],
      [MM.torso, 0, 18],
      [MM.legsStand, 0, 26],
      [scarfLift, 0, 17],
      [['....5', '.....', '5....', '.....', '....5', '.....', '..5..'], 11, 18],
    ),
  };
}

// Climbing, from behind (Mega Man's pose): the helmet in his colour with the stripe down its
// middle, and the scarf knotted at the neck with its tail hanging down his back.
const climb0 = compose(
  W,
  H,
  [recolour(MM.climb0, { '2': '1' }, 8, 16, 2, 13), 0, 0],
  [['.44.', '.44.', '.44.', '.44.'], 6, 9],
  [
    ['00000000', '05555550', '00555500', '.0555 0.'.replace(' ', '5'), '.00550..', '..050...', '..00....'],
    4,
    16,
  ],
);
const climb1 = flipH(climb0);
const climbTop = compose(
  W,
  H,
  [recolour(MM.climbTop, { '2': '1' }, 17, 21, 2, 13), 0, 0],
  [['.44.', '.44.', '.44.'], 6, 18],
  // The scarf's knot at the nape, its tail over his back.
  [['00000000', '05555550', '.005500.', '..0550..', '...00...'], 4, 21],
);

export const protomanDef: SpriteDef = {
  palette: 'protoman',
  frames: {
    ...headFrames(head, headBlink),
    'death-orb': MM.deathOrb,
    'teleport-0': MM.teleport0,
    'climb-0': climb0,
    'climb-1': climb1,
    'climb-top': climbTop,
  },
};
