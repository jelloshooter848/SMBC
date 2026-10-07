import type { SpriteDef } from '@engine/gfx/pixelart';
import { NES } from '@engine/gfx/palette';
import { tilesDef } from './tiles';

/**
 * Ryu's hideout under 6-2 and his mini game's Ninja Gaiden-style night: the karakuri trick wall,
 * the stuck shuriken that marks it, paper lanterns, the round moon window, shoji, spirit points,
 * the knife thrower, the attack dog, the hawk, the Masked Ninja (an original masked rival in dark
 * garb with a horned crimson demon mask and a white mane; not a recolour of Ryu) and the
 * letterboxed cutscene's moon, field, silhouettes and blade spark. Original 8-bit art drawn here in
 * the spirit of an NES ninja action game (black outlines, three-tone fills); nothing is traced.
 * The dojo's wood is `<tile>@dojo` frames on the tile sheet, the moonlit street `<tile>@ninja-night`.
 *
 * Conventions the game relies on:
 * - Creatures and the Masked Ninja face LEFT (flip for right). Standing things (knife thrower, dog,
 *   Masked Ninja 0/1/3/hurt) stand on their bottom row; `masked-ninja-2` (the leap) and the hawks
 *   are airborne and centred in their frame. `lantern-*` hang from their top row (the cord).
 * - The cutscene's `cut-ryu-*` face RIGHT (he leaps in from the left) and `cut-masked-*` face LEFT;
 *   frame 0 is the leap, frame 1 the strike. `cut-clash` is centred: draw it where the blades meet.
 *   `cut-field` tiles horizontally (its left and right columns join) and rests on its bottom row.
 * - `trick-wall-0` is `brick@underground` pixel for pixel, in indices 0-3, which are the same
 *   colours as tiles-underground's 0-3: drawn over a bonus room's brick it cannot be told apart.
 *   The spin is `trick-wall-0` → `-1` (turning, narrower) → `-2` (edge on) → `-3` (the wooden back
 *   turning) → `trick-wall-back` (the dojo side, flat). Every spin frame tiles vertically, so a
 *   panel 1-3 tiles tall is the same frame stacked. `trick-wall-cracked` is `trick-wall-0` with a
 *   faint crack in the mortar colour, for the marked tile; `shuriken-mark` (8x8) is drawn over it.
 * - `afterimage` is `masked-ninja-1` with every other row cleared; draw it (or any Masked Ninja
 *   frame) in palette `ninja-ghost` for his clone trail. `ninja-flash` is the hit flash.
 * - `ninja-star` spins by alternating with `ninja-star-1` (its light and shade swapped).
 */

/**
 * `ninja` index roles (the same in `ninja-flash` and `ninja-ghost`):
 *   0 black / outline   1 brick shadow      2 brick           3 brick light    4 white
 *   5 wood shadow       6 wood              7 wood light      8 paper          9 red (lantern)
 *   a dark red          b gold / glow       c moon yellow     d garb (dark)    e garb light / steel
 *   f steel light       g crimson (mask)    h spirit purple   i skin           j grass green
 *   k night blue        l brown (fur)       m indigo
 */
const ninjaBase = (): string[] => [
  NES.black,
  NES.blueDark,
  NES.blueUnderground,
  NES.lavender,
  NES.white,
  NES.brownDark,
  NES.orangeBrown,
  NES.brownLight,
  NES.tan,
  NES.redBright,
  NES.redDark,
  NES.yellow,
  NES.yellowLight,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.red,
  NES.purple,
  NES.skin,
  NES.greenDark,
  NES.blueMid,
  NES.brown,
  '#4428bc',
];

export const ninjaPalettes: Record<string, string[]> = {
  ninja: ninjaBase(),
  // Struck: every colour but the outline blanches for a frame or two (skipped with reduce flashing).
  'ninja-flash': ninjaBase().map((c, i) => (i === 0 ? c : i % 2 ? NES.white : NES.lightGray)),
  // The Masked Ninja's clone trail: indigo where the outline was, the rest in two purples.
  'ninja-ghost': ninjaBase().map((_, i) => (i === 0 ? '#4428bc' : i % 2 ? NES.purple : '#6844fc')),
};

/* ---------- composition helpers ---------- */

type Rows = readonly string[];

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
function paste(base: Rows, layer: Rows, dx: number, dy: number): string[] {
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

const compose = (w: number, h: number, ...layers: [Rows, number, number][]): string[] =>
  layers.reduce<string[]>((acc, [rows, dx, dy]) => paste(acc, rows, dx, dy), blank(w, h));

/** A frame from a pixel function. */
const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

/** A left half mirrored into a whole symmetric row. */
const sym = (halves: Rows): string[] => halves.map((h) => h + [...h].reverse().join(''));

const recolour = (rows: Rows, map: Record<string, string>): string[] =>
  rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));

/** Pixel (x, y) of a frame, '.' off its edges. */
const at = (rows: Rows, x: number, y: number): string => rows[y]?.[x] ?? '.';

/**
 * A silhouette drawn with '#': black, with a rim of `rim` along every top edge (where the moon
 * behind catches it); any other character is kept as drawn (eyes, a blade's glint).
 */
const silhouette = (sketch: Rows, rim: string): string[] => {
  // Bolden the sketch: every stroke grows a pixel right and down, so limbs read at 32x32.
  const rows = draw(sketch[0]?.length ?? 0, sketch.length, (x, y) => {
    const c = at(sketch, x, y);
    if (c !== '.') return c;
    return at(sketch, x - 1, y) === '#' || at(sketch, x, y - 1) === '#' ? '#' : '.';
  });
  return draw(rows[0]?.length ?? 0, rows.length, (x, y) => {
    const c = at(rows, x, y);
    if (c !== '#') return c;
    return at(rows, x, y - 1) === '.' ? rim : '0';
  });
};

/* ---------- the trick wall ---------- */

const BRICK = tilesDef.frames['brick@underground'] as Rows;

/* The panel's wooden back (the dojo side): two vertical boards with grain and a dark seam;
   repeats both ways. */
const trickBack = [
  '0766666506766665',
  '0766566506765665',
  '0766656506766565',
  '0766666506766665',
  '0765666506666665',
  '0766566506766665',
  '0766666506765665',
  '0766665506766665',
  '0766666506766565',
  '0766566506766665',
  '0766666506656665',
  '0766656506766665',
  '0765666506766665',
  '0766666506766565',
  '0766566506766665',
  '0766666506766665',
];

/** A face squeezed to `w` columns centred in the tile, a lit leading edge and a dark trailing one; the hole around it black. */
const squeeze = (face: Rows, w: number, lead: string, trail: string): string[] => {
  const left = (16 - w) >> 1;
  return draw(16, 16, (x, y) => {
    if (x < left || x >= left + w) return '0';
    if (x === left) return lead;
    if (x === left + w - 1) return trail;
    return at(face, Math.floor(((x - left) * 16) / w), y);
  });
};

const trickWall1 = squeeze(BRICK, 10, '3', '1');
/* Edge on: the panel's thickness, a plank turning on its pivot, black hole either side. */
const trickWall2 = draw(16, 16, (x, y) => {
  if (x === 6) return '7';
  if (x === 7 || x === 8) return y % 8 === 3 ? '5' : '6';
  if (x === 9) return '5';
  return '0';
});
const trickWall3 = squeeze(trickBack, 10, '7', '5');

/* The marked tile: the brick with a faint crack in the mortar colour. */
const trickCracked = paste(BRICK, ['1....', '.1...', '..11.', '....1', '...1.', '..1..', '..1..'], 4, 4);

/* A plus-shaped shuriken stuck flat in the wall, two hairline cracks running off it (8x8). */
const shurikenMark = [
  '1...f...',
  '.1..f...',
  '...efe..',
  'ffff0eee',
  '...efe..',
  '....e.1.',
  '....e..1',
  '........',
];

/* ---------- the dojo's furnishings ---------- */

/* A red paper lantern hanging from its cord (top row), ribbed, glowing gold inside. */
const lantern0 = sym([
  '.......0',
  '.......0',
  '.....000',
  '.....0dd',
  '.....000',
  '...00a99',
  '..0a9999',
  '..0aaaaa',
  '.0a999bb',
  '.0a99bcc',
  '.0aaaaaa',
  '.0a999bb',
  '..0a9999',
  '..0aaaaa',
  '...00ddd',
  '.....00d',
]);
const lantern1 = lantern0.map(
  (r, y) => (y >= 8 && y <= 11 ? recolour([r], { b: 'c', c: 'b' })[0] : r) as string,
);

/* The round moon window: a lacquered ring frame round a night sky, the full moon behind a pine
   branch and a few stars. Sits on its bottom row like other decor. */
const moonWindow = draw(48, 48, (x, y) => {
  const dx = x - 23.5;
  const dy = y - 23.5;
  const r = Math.hypot(dx, dy);
  if (r > 24) return '.';
  if (r > 23) return '0';
  if (r > 20.5) return dx + dy < -6 ? '7' : dx + dy > 6 ? '5' : '6';
  if (r > 19.5) return '0';
  // a pine branch across the lower left, needles in tufts
  const branch = Math.abs(y - (34 - (x - 4) * 0.35)) < 1 && x < 30;
  const tuft =
    x < 30 &&
    ((x % 6 < 4 && Math.abs(y - (31 - (x - 4) * 0.35)) < 1.6) ||
      (x % 6 === 1 && Math.abs(y - (36 - (x - 4) * 0.35)) < 1.3));
  if (branch || tuft) return '0';
  const mr = Math.hypot(x - 29, y - 17);
  if (mr <= 8) {
    if (Math.hypot(x - 26, y - 15) < 2 || Math.hypot(x - 31, y - 20) < 1.5 || Math.hypot(x - 32, y - 13) < 1)
      return 'b';
    return mr > 7 && dx > 0 ? 'b' : 'c';
  }
  // a thin cloud across the moon
  if (y === 22 && x > 18 && x < 40) return 'm';
  if (y === 23 && x > 22 && x < 36) return 'm';
  if ((x * 7 + y * 13) % 53 === 0 && mr > 10) return '4';
  return '1';
});

/* A shoji screen: a wooden frame, a lattice of thin bars over glowing paper, a kick panel at the
   foot. Rests on its bottom row; two side by side join seamlessly. */
const shoji = draw(32, 32, (x, y) => {
  if (x === 0 || x === 31 || y === 0 || y === 31) return '0';
  if (x === 1 || y === 1) return '7';
  if (x === 30 || y === 30) return '5';
  if (y >= 24) return y === 24 ? '0' : y === 25 ? '7' : x % 10 === 5 ? '5' : '6';
  if (x === 8 || x === 16 || x === 23 || y === 8 || y === 16) return '5';
  return y > 18 && (x + y) % 2 === 0 ? 'b' : '8';
});

/* A spirit point: a small violet flame with a white core (8x8, rests on its bottom row). */
const itemNinpo = [
  '...0....',
  '..0h0...',
  '..0hh0..',
  '.0h4hh0.',
  '0h44hhm0',
  '0hhhhmm0',
  '.0hmmm0.',
  '..0000..',
];

/* ---------- the stage's enemies (all face LEFT) ---------- */

/* The knife thrower: a street brawler in a red headband, brown vest over an indigo shirt. */
const thugHead = [
  '.....00000......',
  '....0555550.....',
  '...055555550....',
  '...09999999900..',
  '...0iii0ii5509a.',
  '...0iiiiii550.0.',
  '...0iiiiii550...',
  '....0ii0ii50....',
  '....0iiiii0.....',
  '.....00000......',
];
const thugLegs = [
  '....0mmmmmm0....',
  '....0mmmmmm0....',
  '....0mm00mm0....',
  '....0mm0.0mm0...',
  '....0mm0.0mm0...',
  '...0mm0...0mm0..',
  '...0mm0...0mm0..',
  '...0550...0550..',
  '..05550...05550.',
  '..00000...00000.',
];
const thugTorso = [
  '.....0iiii0.....',
  '...00llmmll00...',
  '..0lllmmmmlll0..',
  '..0l0lmmmml0l0..',
  '..0l0lmmmml0l0..',
  '..0i0lmmmml0i0..',
  '..000lmmmml000..',
  '....0aaaaaa0....',
];
// Winding up: the throwing arm (his back one) cocked behind his head, the knife above it.
const thugTorsoWind = [
  '.....0iiii0.0i0.',
  '...00llmmll0li0.',
  '..0lllmmmmll0l0.',
  '..0l0lmmmmll00..',
  '..0l0lmmmml0....',
  '..0i0lmmmml0....',
  '..000lmmmml0....',
  '....0aaaaaa0....',
];
// The throw: the arm flung out level to the left, hand open on the frame edge.
const thugTorsoThrow = [
  '.....0iiii0.....',
  '000000lmmll00...',
  '0iillllmmmlll0..',
  '000000mmmml0l0..',
  '.....0mmmml0l0..',
  '.....0mmmml0i0..',
  '.....0mmmml000..',
  '....0aaaaaa0....',
];
const knifeUp = ['0f0', '0f0', '0e0', '0a0'];
const knifeThrower0 = compose(16, 32, [thugHead, 0, 4], [thugTorso, 0, 14], [thugLegs, 0, 22]);
const knifeThrower1 = compose(
  16,
  32,
  [thugHead, 0, 4],
  [thugTorsoWind, 0, 14],
  [knifeUp, 12, 10],
  [thugLegs, 0, 22],
);
const knifeThrower2 = compose(16, 32, [thugHead, 0, 4], [thugTorsoThrow, 0, 14], [thugLegs, 0, 22]);

/* A thrown knife flying left: steel blade, black guard, wrapped grip. */
const knife = [
  '........',
  '........',
  '.0000...',
  '04fff0aa',
  '0eeee0aa',
  '.0000...',
  '........',
  '........',
];

/* The attack dog: a lean dark hound, red eye, white fangs. 0 stretched out, 1 gathered. */
const dogTop = [
  '..0.............',
  '.0e0............',
  '0ddd0...........',
  '0d9dd00000000.0.',
  '0ddddeeeeeeee0e0',
  '040dddddddddde0.',
  '.0.0dddddddddd0.',
];
const dog0 = compose(
  16,
  16,
  [dogTop, 0, 4],
  [
    ['...0dd0000ddd0..', '..0dd0....0dd0..', '.0dd0......0dd0.', '0dd0........0dd0', '000..........000'],
    0,
    11,
  ],
);
const dog1 = compose(
  16,
  16,
  [dogTop, 0, 4],
  [
    ['...0ddd00dddd0..', '....0dd0dd0d0...', '....0d0d0dd0....', '...0d0.0dd0.....', '...00..000......'],
    0,
    11,
  ],
);

/* The hawk, side on, gliding left: brown back, pale belly, gold beak. 0 wings up, 1 wings down. */
const hawk0 = [
  '.........000....',
  '........0ll50...',
  '.......0ll5550..',
  '......0ll55550..',
  '.....0ll55550...',
  '.00.0ll5550.....',
  '0770ll5550......',
  'b0777lll5000....',
  '.0007777lll5550.',
  '...0077777ll0000',
  '.....00000000...',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const hawk1 = [
  '................',
  '................',
  '................',
  '................',
  '.00.............',
  '0770............',
  'b0777000000000..',
  '.0007777lll5550.',
  '...0077lll550000',
  '....0lll5550....',
  '....0ll5550.....',
  '...0ll550.......',
  '...0l550........',
  '...0000.........',
  '................',
  '................',
];

/* ---------- the Masked Ninja (faces LEFT) ---------- */

// Head: bone horns, a crimson demon mask with slanted gold eyes and white fangs, a white mane
// streaming back.
const maskHead = [
  '....0......0....',
  '...0f0....0f0...',
  '...0f40..04f0...',
  '....0g0000g0.44.',
  '...0gggggggg0444',
  '..0gbb0ggg0bg044',
  '..0gg0bbgb0bg044',
  '..0gggggggggg044',
  '..04040404ggg044',
  '...0g4g4ggg04444',
  '....0ggggg0.444.',
  '.....00000...44.',
];
// Standing torso: dark garb with grey trim, arms down, a dark red sash, the sword's hilt jutting
// forward from the hip.
const maskTorso = [
  '.....0ddddd0....',
  '....0deeeeed0...',
  '...0deddddded0..',
  '..0dd0ddddd0dd0.',
  '..0d0eddddde0d0.',
  '..0d0eddddde0d0.',
  '0000aaaaaaaa0e0.',
  '0ffe0ddddddd0d0.',
  '0000.0dddddd000.',
];
const maskLegs = [
  '.....0ddd0ddd0..',
  '.....0dd0.0dd0..',
  '.....0dd0.0dd0..',
  '.....0ee0.0ee0..',
  '.....0ee0.0ee0..',
  '....0dd0...0dd0.',
  '...0ddd0...0ddd0',
  '...00000...00000',
];
const maskRunLegs = [
  '....0dddd0ddd0..',
  '...0ddd0..0dd0..',
  '..0dd0.....0dd0.',
  '.0ee0.......0ee0',
  '0ee0.........0e0',
  '0dd0.........0d0',
  '0ddd0.......0dd0',
  '00000.......0000',
];
const maskRunTorso = [
  '.....0ddddd0....',
  '....0deeeeed0...',
  '...0dddddddd0...',
  '..0ee0ddddd0d0..',
  '.0ee0eddddd0dd0.',
  '.000.edddddd0d0.',
  '0000aaaaaaaa00..',
  '0ffe0ddddddd0...',
  '0000.0dddddd0...',
];
// The slash: the blade swept down in front of him, both hands on the hilt at his chest.
const maskSlashTorso = [
  '.....0ddddd0....',
  '.4..0deeeeed0...',
  '0f40ddddddddd0..',
  '.0fe0dddddddd0..',
  '..0fe00ddddd0d0.',
  '...0fd0dddd0dd0.',
  '....0ddaaaaa0d0.',
  '.....0dddddd0d0.',
  '.....0dddddd000.',
];
// The leap: knees tucked, the mane flying up behind.
const maskLeap = compose(
  16,
  32,
  [maskHead, 0, 3],
  [
    [
      '.....0ddddd0....',
      '....0deeeeed0...',
      '...0ddddddddd0..',
      '..0ee0ddddd0ee0.',
      '.0ee0ddddddd0ee0',
      '.000aaaaaaaa0000',
      '0ffe0dddddddd0..',
      '0000.0ddddddd0..',
      '....0ddd0dddd0..',
      '...0ee0dddddd0..',
      '...0ee00dddddd0.',
      '...0dd0..0eeeed0',
      '....00....00000.',
    ],
    0,
    15,
  ],
);
const maskHurt = compose(
  16,
  32,
  [maskHead, 2, 5],
  [
    [
      '.......0ddddd0..',
      '......0deeeeed0.',
      '.....0ddddddddd0',
      '....0dd0dddddd0.',
      '...0ee0eddddde0.',
      '..0ee0.edddddd0.',
      '..000.0aaaaaaa0.',
      '......0dddddd0..',
      '......0dddddd0..',
    ],
    0,
    17,
  ],
  [maskLegs, 1, 24],
);
const masked0 = compose(16, 32, [maskHead, 0, 3], [maskTorso, 0, 15], [maskLegs, 0, 24]);
const masked1 = compose(16, 32, [maskHead, 0, 3], [maskRunTorso, 0, 15], [maskRunLegs, 0, 24]);
const masked3 = compose(16, 32, [maskHead, 0, 3], [maskSlashTorso, 0, 15], [maskLegs, 0, 24]);
const afterimage = masked1.map((r, y) => (y % 2 ? '.'.repeat(16) : r));

/* His shuriken: a four-point star round a red core; alternate with -1 to spin it. */
const ninjaStar = [
  '...f....',
  '...fe...',
  '..0fe0..',
  'fff99ee0',
  '0fe99eee',
  '..0fe0..',
  '...fe...',
  '....e...',
];

/* ---------- the cutscene ---------- */

/* The huge moon behind the duel: a full disc, gold at its shadowed edge, a few soft craters. */
const cutMoon = draw(64, 64, (x, y) => {
  const dx = x - 31.5;
  const dy = y - 31.5;
  const r = Math.hypot(dx, dy);
  if (r > 31.5) return '.';
  const crater = [
    [22, 20, 5],
    [40, 26, 4],
    [30, 42, 6],
    [44, 44, 3],
    [18, 36, 3],
  ].some(([cx, cy, cr]) => Math.hypot(x - (cx as number), y - (cy as number)) < (cr as number));
  if (r > 29.5 && dx + dy > 0) return 'b';
  if (r > 30.5) return 'b';
  if (crater) return (x + y) % 2 ? 'b' : 'c';
  if (r > 26 && dx + dy > 12) return (x + y) % 2 ? 'b' : 'c';
  return 'c';
});

/* The field: tall grass in silhouette, its tips lit green by the moon. Columns repeat every 256
   pixels (the left and right edges join) and the bottom rows are solid. */
const grassHeight = (x: number): number => {
  const t = (x / 256) * Math.PI * 2;
  const roll = 22 + 5 * Math.sin(t * 2) + 3 * Math.sin(t * 5 + 1);
  const hash = (x * 2654435761) >>> 0;
  const blade = x % 3 === 0 ? (hash % 9) + 2 : x % 3 === 1 ? hash % 4 : 0;
  return Math.round(roll + blade);
};
const cutField = draw(256, 48, (x, y) => {
  const top = 48 - grassHeight(x);
  if (y < top) return '.';
  return y < top + 2 ? 'j' : '0';
});

/* Ryu in silhouette leaping right, sword raised behind him, scarf streaming (frame 0); the strike,
   sword thrust ahead (frame 1). A blue rim where the moon catches him. */
const cutRyu0 = silhouette(
  [
    '................................',
    '................................',
    '..4.............................',
    '...#............................',
    '....#...........................',
    '.....#..............###.........',
    '......#............#####........',
    '.......#...........######.......',
    '........#..........#####........',
    '##.......#.........####.........',
    '.###......##......####..........',
    '...####....###...#####..........',
    '......####..#########...........',
    '.........###########............',
    '...........#########............',
    '...........##########...........',
    '..........############..........',
    '.........######..#######........',
    '........######....#######.......',
    '.......#####.........####.......',
    '......####............####......',
    '.....####...............##......',
    '....###..................#......',
    '...##...........................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  'k',
);
const cutRyu1 = silhouette(
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............###..............',
    '..............#####.............',
    '..............######............',
    '..............#####.............',
    '#.............####..............',
    '.##..........#####..............',
    '..###.......########............',
    '....###....###########..........',
    '......#######...#######.........',
    '.......######.......#####4######',
    '........#####...........##......',
    '.......######...................',
    '......########..................',
    '.....####..####.................',
    '....####.....####...............',
    '...####........####.............',
    '..###............###............',
    '..##...............#............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  'k',
);
/* The Masked Ninja in silhouette, horned, his mane flying and his eyes burning gold; leaping left
   with his blade drawn back (0), then slashing down ahead of him (1). A crimson rim. */
const cutMasked0 = silhouette(
  [
    '................................',
    '................................',
    '............................4...',
    '...........#.#.............#....',
    '..........#####...........#.....',
    '..........#bb###.........#......',
    '..........######........#.......',
    '..........#####.###....#........',
    '...........####...#####.........',
    '..........#######...###.........',
    '.........##########.##..........',
    '.........#############..........',
    '..........############..........',
    '...........###########..........',
    '............##########..........',
    '...........#####..######........',
    '..........#####.....#####.......',
    '.........####.........####......',
    '........####............###.....',
    '........###...............##....',
    '........##.......................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  'g',
);
const cutMasked1 = silhouette(
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '.................#.#............',
    '................#####...........',
    '................#bb####.........',
    '................#######.........',
    '................#####.####......',
    '................####......##....',
    '..............#######...........',
    '............##########..........',
    '..........####.#########........',
    '........###4...##########.......',
    '......###.......#########.......',
    '....###.........########........',
    '..###..........#####.####.......',
    '.4.............####....###......',
    '..............####......###.....',
    '.............####.........##....',
    '.............###............#...',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  'g',
);

/* The clash: eight rays of light where two blades meet, white at the heart. Centred. */
const cutClash = draw(32, 32, (x, y) => {
  const dx = x - 15.5;
  const dy = y - 15.5;
  const r = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  const ray = Math.abs(Math.sin(a * 4));
  const long = Math.abs(Math.sin(a * 2)) < 0.3; // the four axis rays reach further
  const reach = (long ? 15.5 : 10) * Math.max(0, 1 - ray * 1.8);
  if (r < 3) return '4';
  if (r < 5) return 'c';
  if (r > reach || r > 15.5) return '.';
  return r < reach * 0.4 ? '4' : r < reach * 0.7 ? 'c' : r < reach * 0.9 ? 'b' : '9';
});

export const ninjaDef: SpriteDef = {
  palette: 'ninja',
  frames: {
    'trick-wall-0': BRICK,
    'trick-wall-1': trickWall1,
    'trick-wall-2': trickWall2,
    'trick-wall-3': trickWall3,
    'trick-wall-back': trickBack,
    'trick-wall-cracked': trickCracked,
    'shuriken-mark': shurikenMark,
    'lantern-0': lantern0,
    'lantern-1': lantern1,
    'moon-window': moonWindow,
    shoji,
    'item-ninpo': itemNinpo,
    'knife-thrower-0': knifeThrower0,
    'knife-thrower-1': knifeThrower1,
    'knife-thrower-2': knifeThrower2,
    knife,
    'dog-0': dog0,
    'dog-1': dog1,
    'hawk-0': hawk0,
    'hawk-1': hawk1,
    'masked-ninja-0': masked0,
    'masked-ninja-1': masked1,
    'masked-ninja-2': maskLeap,
    'masked-ninja-3': masked3,
    'masked-ninja-hurt': maskHurt,
    afterimage,
    'ninja-star': ninjaStar,
    'ninja-star-1': recolour(ninjaStar, { f: 'e', e: 'f' }),
    'cut-moon': cutMoon,
    'cut-field': cutField,
    'cut-ryu-0': cutRyu0,
    'cut-ryu-1': cutRyu1,
    'cut-masked-0': cutMasked0,
    'cut-masked-1': cutMasked1,
    'cut-clash': cutClash,
  },
};
