import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Larry Koopa's airship and the SMB3-flavoured extras around it: Larry himself, his wand blast
 * and crystal ball, the Toad House chests, the N-spade cards, the spade slot reels, the map's
 * wandering Hammer Bro, two map node icons and the item inventory's icons. Original 8-bit art
 * drawn here in the spirit of an NES-era sequel (black outlines, three-tone fills, big readable
 * shapes); nothing is traced. The airship's solid tiles are `<tile>@airship` frames on the tile
 * sheet (tiles.ts). Toad himself is the item sheet's `toad`.
 *
 * Conventions the game relies on:
 * - Larry faces LEFT (like every enemy; flip for right). All his frames are bottom-anchored:
 *   `larry-0` stands on its bottom row, `larry-1` is the hop (wand raised, feet tucked up off the
 *   floor), `larry-shell-0..3` spin in order, `larry-hurt` is the flinch after a stomp (wand
 *   knocked away). `smb3-flash` is the same sheet blanched for a hit flash.
 * - `wand-blast-0/1` alternate while a ring flies; `crystal-ball` sits on its stand.
 * - Cards are 16x24 with the picture on a white face; `card-back` is the face-down side.
 * - `slot-<picture>-top/mid/bot` are the three 32x16 thirds of one 32x48 picture on black, for
 *   the slot game's three stacked reels (top, middle, bottom); thirds of different pictures still
 *   meet cleanly, so a miss shows a jumbled picture.
 * - `item-*` icons keep a 1px clear margin (14x14 of art) so the cards can show them whole.
 * - Cabin decor (drawn in front of the airship's background logs): `porthole` is a framed dark
 *   window, `pillar` a thick upright post that tiles vertically, `ceiling-beam` a heavy beam that
 *   tiles sideways. Their wood matches the airship tiles' tan and red-brown.
 */

/* ------------------------------------------------------------------------------------------ */
/* Palette                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/**
 * `smb3` index roles (the same in `smb3-flash`):
 *   0 black / outline   1 white          2 light grey      3 grey            4 dark grey
 *   5 green             6 light green    7 dark green      8 cream (belly)   9 skin
 *   a skin shade        b sky blue       c deep blue       d red             e dark red
 *   f gold              g pale gold      h brown           i dark brown      j orange brown
 *   k pink (magic)      l magenta        m pale cyan       n lavender        o purple
 *   p navy              q orange         r light wood
 */
const smb3Base = (): string[] => [
  NES.black,
  NES.white,
  NES.lightGray,
  NES.gray,
  NES.darkGray,
  NES.green,
  NES.greenPipe,
  NES.greenDark,
  NES.tan,
  NES.tanDark,
  NES.peach,
  NES.blueLight,
  NES.blueMid,
  NES.redBright,
  NES.redDark,
  NES.yellow,
  NES.yellowLight,
  NES.brown,
  NES.brownDark,
  NES.orangeBrown,
  NES.pink,
  NES.magenta,
  NES.skyLight,
  NES.lavender,
  NES.purple,
  NES.blueDark,
  NES.orange,
  NES.brownLight,
];

export const smb3Palettes: Record<string, string[]> = {
  smb3: smb3Base(),
  // Larry struck: every colour but the outline flashes pale for a frame or two.
  'smb3-flash': smb3Base().map((c, i) => (i === 0 ? c : i % 2 ? NES.white : NES.lightGray)),
};

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                     */
/* ------------------------------------------------------------------------------------------ */

type Grid = string[][];
type Test = (x: number, y: number) => boolean;

const grid = (w: number, h: number, fill = '.'): Grid =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
const put = (g: Grid, x: number, y: number, c: string): void => {
  const row = g[y];
  if (row && x >= 0 && x < row.length) row[x] = c;
};
const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, c);
};
/** Paint `layer` (`.` transparent) at (x, y). */
const paint = (g: Grid, x: number, y: number, layer: readonly string[]): void =>
  layer.forEach((row, j) => [...row].forEach((c, i) => c !== '.' && put(g, x + i, y + j, c)));
const rows = (g: Grid): string[] => g.map((r) => r.join(''));
const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Test =>
  (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const and =
  (...ts: Test[]): Test =>
  (x, y) =>
    ts.every((t) => t(x, y));
const or =
  (...ts: Test[]): Test =>
  (x, y) =>
    ts.some((t) => t(x, y));
const box =
  (x0: number, y0: number, x1: number, y1: number): Test =>
  (x, y) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1;
/** Point-in-polygon at the pixel centre. */
const poly =
  (pts: readonly (readonly [number, number])[]): Test =>
  (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i] as readonly [number, number];
      const [xj, yj] = pts[j] as readonly [number, number];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

/**
 * Fill a shape and outline it: pixels of the shape that touch a pixel outside it (4-way, or the
 * frame edge) become the outline colour. `shade` picks the pixels drawn in the shade colour.
 */
const blob = (
  g: Grid,
  inside: Test,
  fill: string,
  opts: { shade?: [Test, string]; light?: [Test, string]; line?: string } = {},
): void => {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const line = opts.line ?? '0';
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge =
        !inside(x - 1, y) ||
        !inside(x + 1, y) ||
        !inside(x, y - 1) ||
        !inside(x, y + 1) ||
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1;
      let c = fill;
      if (opts.shade?.[0](x, y)) c = opts.shade[1];
      if (opts.light?.[0](x, y)) c = opts.light[1];
      put(g, x, y, edge && line !== '' ? line : c);
    }
};

/* ------------------------------------------------------------------------------------------ */
/* Larry Koopa (16x24, faces left)                                                             */
/* ------------------------------------------------------------------------------------------ */

// A young Koopa with a blue mohawk: the head is shared by every upright frame, the body changes.
const LARRY_HEAD = [
  '........0.0.0...',
  '.......0b0b0b0..',
  '......0bbbbbbbb0',
  '.....0bbbbbbbbc0',
  '....00cbbbbbbcc0',
  '...09900ccccc000',
  '..0999119999990.',
  '.099990199999a0.',
  '090999019999aa0.',
  '0999999999999a0.',
  '.000000099999a0.',
  '..0aaaaa9999a0..',
  '...00000aaaa0...',
];
// Flinching: the mohawk ruffled, the eye squeezed shut, the mouth wide open.
const LARRY_HEAD_HURT = [
  '......0..0..0...',
  '......0b00b00b0.',
  ...LARRY_HEAD.slice(2, 6),
  '..0999999099990.',
  '.0999900099999a0',
  '090999990999aa0.',
  '0999999999999a0.',
  '.0dddd0099999a0.',
  '..00000a9999a0..',
  LARRY_HEAD[12] as string,
];
// The body: cream belly in front, the green shell on his back with its white rim, and the wand
// (a gold rod with a pink orb) held out in front.
const LARRY_BODY = [
  '.000.0088881660.',
  '01kk00g888156570',
  '0kkl00gaaa155570',
  '.000f0g888150570',
  '....099088150570',
  '....0990aa155770',
  '.....00g8811770.',
];
const LARRY_LEGS = ['.....0990.0990..', '.....0990.0990..', '...0aaaa00aaaa0.', '...000000000000.'];
// The hop: the wand raised and the feet tucked up off the floor.
const LARRY_BODY_HOP = [
  '.0kk00088881660.',
  '0kkl00g888156570',
  '.000f0gaaa155570',
  '....f0g888150570',
  '....099088150570',
  '....0990aa155770',
  '.....00g8811770.',
];
const LARRY_LEGS_HOP = ['....0aaa00aaaa0.', '....00000000000.', '................', '................'];
// The flinch: the wand knocked away, an arm thrown up, the legs kicked out.
const LARRY_BODY_HURT = [
  '.00..0088881660.',
  '0990.0g888156570',
  '.09990gaaa155570',
  '..0000g888150570',
  '.....0g888150570',
  '.....0gaaa155770',
  '.....00g8811770.',
];
const LARRY_LEGS_HURT = ['.0aaa00...00aaa0', '.0aaaa0...0aaaa0', '..0000.....0000.', '................'];
const larry0 = [...LARRY_HEAD, ...LARRY_BODY, ...LARRY_LEGS];
const larry1 = [...LARRY_HEAD, ...LARRY_BODY_HOP, ...LARRY_LEGS_HOP];
const larryHurt = [...LARRY_HEAD_HURT, ...LARRY_BODY_HURT, ...LARRY_LEGS_HURT];

/* Larry tucked into his shell (16x16): a dome on the floor whose plates scroll as it spins, his
   mohawk tuft poking out of the front and back in turn. */
const larryShell = (i: number): string[] => {
  const g = grid(16, 16);
  const dome = and(ellipse(8, 11, 7.6, 8.4), box(0, 0, 15, 14));
  blob(g, dome, '5', { shade: [(_, y) => y >= 11, '7'], light: [ellipse(5.5 + i, 6, 2, 1.5), '6'] });
  // plates: dark seams every 5 px, slid along with the spin
  for (let x = 0; x < 16; x++) {
    if ((x + i * 2) % 5 !== 0) continue;
    for (let y = 4; y <= 12; y++) if (dome(x, y) && dome(x - 1, y) && dome(x + 1, y)) put(g, x, y, '7');
  }
  // white rim along the bottom and the floor line
  for (let x = 1; x <= 14; x++) put(g, x, 13, '1');
  for (let x = 1; x <= 14; x++) put(g, x, 14, '0');
  rect(g, 2, 15, 12, 1, '0');
  // the tuft of blue hair, swinging round with the spin
  const tufts: [number, number][] = [
    [7, 0],
    [12, 2],
    [8, 0],
    [3, 2],
  ];
  const [tx, ty] = tufts[i] as [number, number];
  paint(g, tx - 1, ty, ['.0.', '0b0', '0c0']);
  return rows(g);
};

/* ------------------------------------------------------------------------------------------ */
/* Wand blast, crystal ball                                                                    */
/* ------------------------------------------------------------------------------------------ */

const ring = (r: number, k: number, spark: boolean): string[] => {
  const g = grid(16, 16);
  const outer = ellipse(8, 8, r, r);
  const inner = ellipse(8, 8, r - k, r - k);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!outer(x, y) || inner(x, y)) continue;
      const rim = !outer(x - 1, y) || !outer(x + 1, y) || !outer(x, y - 1) || !outer(x, y + 1);
      const hole = inner(x - 1, y) || inner(x + 1, y) || inner(x, y - 1) || inner(x, y + 1);
      put(g, x, y, rim ? 'l' : hole ? 'k' : '1');
    }
  if (spark)
    for (const [x, y] of [
      [8, 0],
      [0, 8],
      [15, 8],
      [8, 15],
    ] as const)
      put(g, x, y, '1');
  return rows(g);
};
const wandBlast0 = ring(7, 3, false);
const wandBlast1 = ring(6, 3, true);

const crystalBall = (() => {
  const g = grid(16, 16);
  // the stand: a squat gold cup
  blob(g, or(box(4, 12, 11, 14), box(3, 14, 12, 15)), 'f', { shade: [box(0, 14, 15, 15), 'h'] });
  blob(g, ellipse(8, 7, 6.5, 6.5), 'n', {
    shade: [(x, y) => ellipse(9.5, 9, 6, 5.5)(x, y) && !ellipse(7, 6, 5, 5)(x, y), 'o'],
    light: [ellipse(6, 5, 2.6, 2.6), 'm'],
  });
  put(g, 5, 3, '1');
  put(g, 4, 4, '1');
  put(g, 5, 4, '1');
  // a faint swirl of mist inside
  for (const [x, y] of [
    [8, 8],
    [9, 8],
    [10, 7],
    [7, 9],
  ] as const)
    put(g, x, y, 'm');
  return rows(g);
})();

/* ------------------------------------------------------------------------------------------ */
/* Toad House chests                                                                           */
/* ------------------------------------------------------------------------------------------ */

const chestBody = (g: Grid): void => {
  blob(g, box(1, 8, 14, 15), 'h', { shade: [box(0, 13, 15, 15), 'i'] });
  // gold bands and corner caps
  for (let y = 9; y <= 14; y++) {
    put(g, 3, y, 'f');
    put(g, 12, y, 'f');
  }
  for (let x = 2; x <= 13; x++) put(g, x, 9, 'g');
};
const chestClosed = (() => {
  const g = grid(16, 16);
  blob(g, and(ellipse(8, 9, 7.6, 6), box(0, 3, 15, 8)), 'j', {
    shade: [(x) => x >= 11, 'h'],
    light: [ellipse(6, 5, 3, 1.3), 'q'],
  });
  for (let y = 4; y <= 8; y++) {
    put(g, 3, y, 'f');
    put(g, 12, y, 'f');
  }
  chestBody(g);
  rect(g, 0, 8, 16, 1, '0');
  // the lock plate
  paint(g, 6, 7, ['0000', '0gf0', '0f00', '0ff0', '0000']);
  return rows(g);
})();
const chestOpen = (() => {
  const g = grid(16, 16);
  // the lid tipped back: its inside shows, dark
  blob(g, box(2, 1, 13, 6), 'i', { light: [box(3, 2, 12, 2), 'h'] });
  put(g, 3, 4, 'f');
  put(g, 12, 4, 'f');
  // the mouth of the chest, a glow rising out of it
  blob(g, box(1, 6, 14, 9), '0');
  rect(g, 2, 7, 12, 2, 'i');
  for (const [x, y] of [
    [5, 7],
    [8, 6],
    [10, 7],
  ] as const)
    put(g, x, y, 'g');
  chestBody(g);
  rect(g, 0, 9, 16, 1, '0');
  rect(g, 1, 9, 14, 1, '0');
  paint(g, 6, 10, ['0000', '0ff0', '0000']);
  return rows(g);
})();

/* ------------------------------------------------------------------------------------------ */
/* Inventory icons (16x16, 1px clear margin)                                                   */
/* ------------------------------------------------------------------------------------------ */

/** A mushroom in a cap colour (main, shade): spotted cap, cream stem with two eyes. */
const mushroom = (cap: string, capShade: string): string[] => {
  const g = grid(16, 16);
  blob(g, or(box(4, 9, 11, 14), ellipse(8, 13.5, 4, 1.6)), '8', { shade: [box(10, 0, 15, 15), 'g'] });
  put(g, 6, 10, '0');
  put(g, 6, 11, '0');
  put(g, 9, 10, '0');
  put(g, 9, 11, '0');
  blob(g, and(ellipse(8, 8.5, 7, 7.5), box(0, 0, 15, 9)), cap, {
    shade: [(x, y) => y >= 8 || x >= 12, capShade],
  });
  blob(g, ellipse(8, 4.5, 2.2, 2), '1', { line: '' });
  blob(g, ellipse(3.6, 6.6, 1.4, 1.8), '1', { line: '' });
  blob(g, ellipse(12.4, 6.6, 1.4, 1.8), '1', { line: '' });
  rect(g, 1, 9, 14, 1, '0');
  return rows(g);
};
const itemMushroom = mushroom('d', 'e');
const item1up = mushroom('5', '7');

const itemFlower = (() => {
  const g = grid(16, 16);
  // the blossom: red petals, an orange ring, a pale heart with eyes
  blob(g, ellipse(8, 5.5, 7, 4.6), 'd', { shade: [(_, y) => y >= 8, 'e'] });
  blob(g, ellipse(8, 5.5, 5, 3), 'q', { line: '' });
  blob(g, ellipse(8, 5.5, 3.2, 1.8), 'g', { line: '' });
  put(g, 6, 5, '0');
  put(g, 9, 5, '0');
  // the stem and two leaves curling up from it
  paint(g, 0, 10, [
    '.00...0570...00.',
    '.0660.0570.0660.',
    '..066605706660..',
    '...0665577660...',
    '....00000000....',
  ]);
  return rows(g);
})();

const STAR_POINTS = (cx: number, cy: number, R: number, r: number, sy = 1): [number, number][] =>
  Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 ? r : R;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a) * sy];
  });

/* A chunky five-pointed star with two eyes. */
const itemStar = [
  '................',
  '.......00.......',
  '......0gf0......',
  '......0gf0......',
  '.....0ggff0.....',
  '.00000gfff00000.',
  '.0gggggffffffh0.',
  '..0gff0ff0fff0..',
  '...0ff0ff0ff0...',
  '....0ffffff0....',
  '....0fffffh0....',
  '...0ffffffhh0...',
  '...0fff00fhh0...',
  '..0ffh0..0fhh0..',
  '..000......000..',
  '................',
];

/* ------------------------------------------------------------------------------------------ */
/* Cards (16x24)                                                                               */
/* ------------------------------------------------------------------------------------------ */

const cardBlank = (face: string, edge: string): Grid => {
  const g = grid(16, 24);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 16; x++) {
      const corner = (x === 0 || x === 15) && (y === 0 || y === 23);
      if (corner) continue;
      const rim = x === 0 || x === 15 || y === 0 || y === 23;
      const cut = (x === 1 || x === 14) && (y === 1 || y === 22);
      put(g, x, y, rim || cut ? '0' : x === 1 || x === 14 || y === 1 || y === 22 ? edge : face);
    }
  return g;
};

const cardBack = (() => {
  const g = cardBlank('p', '1');
  // a lattice of small diamonds on navy, and a gold diamond seal with a white spade in the middle
  for (let y = 2; y <= 21; y++)
    for (let x = 2; x <= 13; x++) if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) put(g, x, y, 'c');
  blob(g, (x, y) => Math.abs(x - 7.5) / 5.5 + Math.abs(y - 11.5) / 7.5 <= 1, 'f', {
    light: [(x, y) => x + y <= 18, 'g'],
    shade: [(x, y) => x + y >= 22, 'h'],
  });
  paint(g, 5, 9, ['..1..', '.111.', '11111', '11111', '..1..', '.111.']);
  return rows(g);
})();

const cardFace = (icon: readonly string[]): string[] => {
  const g = cardBlank('1', '2');
  // the icon's 14x14 art (inside its clear margin) sits in the middle of the face
  paint(g, 0, 4, icon);
  return rows(g);
};

/* 3x5 digits for the coin cards. */
const DIGITS: Record<string, string[]> = {
  '0': ['000', '0.0', '0.0', '0.0', '000'],
  '1': ['.0.', '00.', '.0.', '.0.', '000'],
  '2': ['000', '..0', '000', '0..', '000'],
};
const coinCard = (n: string): string[] => {
  const g = cardBlank('1', '2');
  // a big gold coin with a slot and a shine
  blob(g, ellipse(8, 9, 5, 6.5), 'f', { shade: [(x) => x >= 10, 'h'], light: [box(5, 5, 6, 11), 'g'] });
  rect(g, 8, 6, 1, 6, 'h');
  rect(g, 7, 6, 1, 6, '0');
  [...n].forEach((d, k) => paint(g, 4 + k * 5, 17, DIGITS[d] ?? []));
  return rows(g);
};

/* ------------------------------------------------------------------------------------------ */
/* Slot reels: 32x48 pictures on black, cut into thirds                                        */
/* ------------------------------------------------------------------------------------------ */

const slotMushroom = (() => {
  const g = grid(32, 48, '0');
  blob(g, or(box(8, 26, 23, 43), ellipse(16, 42, 8.5, 4.5)), '8', {
    shade: [(x) => x >= 20, 'g'],
  });
  rect(g, 11, 30, 2, 6, '0');
  rect(g, 19, 30, 2, 6, '0');
  blob(g, and(ellipse(16, 24, 15.6, 21), box(0, 0, 31, 26)), 'd', {
    shade: [(x, y) => y >= 23 || x >= 25, 'e'],
  });
  blob(g, ellipse(16, 10, 5, 4.5), '1', { line: '' });
  blob(g, ellipse(5, 17, 3, 4.5), '1', { line: '' });
  blob(g, ellipse(27, 17, 3, 4.5), '1', { line: '' });
  rect(g, 1, 26, 30, 1, '0');
  return g;
})();

const slotFlower = (() => {
  const g = grid(32, 48, '0');
  blob(g, box(14, 26, 17, 47), '5', { shade: [box(17, 0, 17, 47), '7'] });
  blob(g, and(ellipse(8, 39, 7.5, 3.6), box(0, 0, 15, 47)), '6', { shade: [box(0, 39, 31, 47), '5'] });
  blob(g, and(ellipse(24, 39, 7.5, 3.6), box(16, 0, 31, 47)), '6', { shade: [box(0, 39, 31, 47), '5'] });
  rect(g, 14, 30, 4, 18, '5');
  rect(g, 17, 30, 1, 18, '7');
  blob(g, ellipse(16, 15, 15.2, 12), 'd', { shade: [(_, y) => y >= 21, 'e'] });
  blob(g, ellipse(16, 15, 11, 8), 'q', { line: '' });
  blob(g, ellipse(16, 15, 7, 4.6), 'g', { line: '' });
  rect(g, 12, 13, 2, 4, '0');
  rect(g, 18, 13, 2, 4, '0');
  return g;
})();

const slotStar = (() => {
  const g = grid(32, 48, '0');
  blob(g, poly(STAR_POINTS(16, 25.5, 18, 8.6, 1.45)), 'f', {
    light: [(x, y) => x + y * 0.66 <= 22, 'g'],
    shade: [(x, y) => y >= 34 || x + y >= 52, 'h'],
  });
  rect(g, 12, 20, 2, 8, '0');
  rect(g, 18, 20, 2, 8, '0');
  return g;
})();

const third = (g: Grid, k: number): string[] => rows(g.slice(k * 16, k * 16 + 16));

/* ------------------------------------------------------------------------------------------ */
/* World map: the wandering Hammer Bro, and two node icons                                     */
/* ------------------------------------------------------------------------------------------ */

const hammerBro = (f: number): string[] => {
  const g = grid(16, 16);
  // feet, alternating step
  blob(g, box(3, 13 - (f ? 1 : 0), 6, 15 - (f ? 1 : 0)), 'a');
  blob(g, box(9, 13 - (f ? 0 : 1), 12, 15 - (f ? 0 : 1)), 'a');
  // shell body and cream belly
  blob(g, ellipse(8, 10.5, 5.6, 3.8), '5', { shade: [(x) => x >= 11, '7'] });
  blob(g, ellipse(8, 11, 3, 2.8), '8', { line: '' });
  // head and helmet
  blob(g, ellipse(8, 5.5, 4.4, 3.6), '9', { shade: [(_, y) => y >= 8, 'a'] });
  blob(g, and(ellipse(8, 4.5, 5, 4), box(0, 0, 15, 4)), '5', {
    light: [ellipse(6.5, 2.5, 1.5, 1), '6'],
  });
  rect(g, 3, 4, 10, 1, '0');
  put(g, 6, 6, '0');
  put(g, 9, 6, '0');
  put(g, 6, 5, '1');
  put(g, 9, 5, '1');
  // the hammer: raised high in one frame, swung down in the other
  if (f === 0) {
    for (let y = 3; y <= 8; y++) put(g, 13, y, 'h');
    paint(g, 11, 0, ['00000', '02230', '03330', '00000']);
    blob(g, ellipse(13, 9, 1.4, 1.4), '9');
  } else {
    for (let x = 1; x <= 4; x++) put(g, x, 8, 'h');
    paint(g, 0, 5, ['000', '020', '030', '030', '000']);
    blob(g, ellipse(4.5, 8.5, 1.4, 1.4), '9');
  }
  return rows(g);
};

const nodeToadHouse = (() => {
  const g = grid(16, 16);
  blob(g, box(3, 8, 12, 15), '8', { shade: [box(10, 0, 15, 15), 'g'] });
  blob(g, or(box(6, 11, 9, 15)), 'i');
  put(g, 8, 13, 'f');
  blob(g, and(ellipse(8, 9, 7.6, 8), box(0, 0, 15, 9)), 'd', {
    shade: [(x, y) => y >= 8 || x >= 12, 'e'],
  });
  blob(g, ellipse(8, 4, 2, 1.8), '1', { line: '' });
  blob(g, ellipse(3.5, 6.5, 1.3, 1.6), '1', { line: '' });
  blob(g, ellipse(12.5, 6.5, 1.3, 1.6), '1', { line: '' });
  rect(g, 0, 9, 16, 1, '0');
  return rows(g);
})();

const SPADE = [
  '....1....',
  '...111...',
  '..11111..',
  '.1111111.',
  '111111111',
  '111111111',
  '.11.1.11.',
  '....1....',
  '...111...',
];
const nodeSpade = (() => {
  const g = grid(16, 16);
  blob(
    g,
    and(box(0, 0, 15, 15), (x, y) => !((x === 0 || x === 15) && (y === 0 || y === 15))),
    'p',
    {
      light: [(x, y) => x === 1 || y === 1, 'f'],
      shade: [(x, y) => x === 14 || y === 14, 'h'],
    },
  );
  paint(g, 3, 3, SPADE);
  return rows(g);
})();

/* ------------------------------------------------------------------------------------------ */
/* The sheet                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------------------------ */
/* Cabin decor: porthole, pillar, ceiling beam                                                 */
/* ------------------------------------------------------------------------------------------ */

/* A small square window in a wooden frame: lit top and left, shadowed bottom and right, the night
   outside near-black with a navy sheen and a faint glint on the glass. */
const porthole = (() => {
  const g = grid(16, 16);
  blob(
    g,
    (x, y) => x >= 0 && x <= 15 && y >= 0 && y <= 15 && !((x === 0 || x === 15) && (y === 0 || y === 15)),
    'j',
    {
      light: [(x, y) => (x <= 1 || y <= 1) && x + y < 26, 'r'],
      shade: [(x, y) => (x >= 14 || y >= 14) && x + y > 4, 'i'],
    },
  );
  // the night through the glass: near-black, a navy sheen in the upper corner, a faint glint
  rect(g, 3, 3, 10, 10, '0');
  for (let y = 4; y <= 8; y++) for (let x = 12 - (8 - y); x <= 12; x++) put(g, x, y, 'p');
  put(g, 10, 6, 'c');
  put(g, 11, 5, 'c');
  return rows(g);
})();

/* A thick upright post, full width, with vertical grain and a couple of knots; tiles vertically. */
const pillar = Array.from({ length: 16 }, (_, y) => {
  const r = [...'0jrrjrrrrjrrjji0'];
  if (y === 3 || y === 4) r[7] = 'i';
  if (y === 11) r[10] = 'i';
  return r.join('');
});

/* A heavy ceiling beam, horizontal grain, lit top and shadowed underside; tiles sideways. */
const ceilingBeam = [
  '0000000000000000',
  'rrrrrrrrrrrrrrrr',
  'jjjjjjjjjjjjjjjj',
  'iiiijjjjjjjjjjjj',
  'jjjjjjjjjjjiiiii',
  'jjjjjjjjjjjjjjjj',
  'jjjjjjiijjjjjjjj',
  'jjjjjjjjjjjjjjjj',
  'iiiiiiijjjjjjjji',
  'jjjjjjjjjjjjjjjj',
  'jjjjjjjjjjjjjjjj',
  'iiiiiiiiiiiiiiii',
  'iiiiiiiiiiiiiiii',
  'iiiiiiiiiiiiiiii',
  '0000000000000000',
  '0000000000000000',
];

const slotFrames: Record<string, string[]> = {};
for (const [name, pic] of [
  ['mushroom', slotMushroom],
  ['flower', slotFlower],
  ['star', slotStar],
] as const)
  ['top', 'mid', 'bot'].forEach((part, k) => (slotFrames[`slot-${name}-${part}`] = third(pic, k)));

export const smb3Def: SpriteDef = {
  palette: 'smb3',
  frames: {
    'larry-0': larry0,
    'larry-1': larry1,
    'larry-shell-0': larryShell(0),
    'larry-shell-1': larryShell(1),
    'larry-shell-2': larryShell(2),
    'larry-shell-3': larryShell(3),
    'larry-hurt': larryHurt,
    'wand-blast-0': wandBlast0,
    'wand-blast-1': wandBlast1,
    'crystal-ball': crystalBall,
    'chest-closed': chestClosed,
    'chest-open': chestOpen,
    'card-back': cardBack,
    'card-mushroom': cardFace(itemMushroom),
    'card-flower': cardFace(itemFlower),
    'card-star': cardFace(itemStar),
    'card-1up': cardFace(item1up),
    'card-coin10': coinCard('10'),
    'card-coin20': coinCard('20'),
    ...slotFrames,
    'hammer-bro-map-0': hammerBro(0),
    'hammer-bro-map-1': hammerBro(1),
    'node-toad-house': nodeToadHouse,
    'node-spade': nodeSpade,
    'item-mushroom': itemMushroom,
    'item-flower': itemFlower,
    'item-star': itemStar,
    'item-1up': item1up,
    porthole,
    pillar,
    'ceiling-beam': ceilingBeam,
  },
};
