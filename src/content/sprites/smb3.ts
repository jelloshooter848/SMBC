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
 *   knocked away). `larry-climb-0/1` grip 4-2's anchor chain at their left edge (x 1-3), in turn. `smb3-flash` is the same sheet blanched for a hit flash.
 * - `wand-blast-0/1` alternate while a ring flies; `crystal-ball` sits on its stand.
 * - Cards are 16x24 with the picture on a white face; `card-back` is the face-down side.
 * - `slot-<picture>-top/mid/bot` are the three 32x16 thirds of one 32x48 picture on black, for
 *   the slot game's three stacked reels (top, middle, bottom); thirds of different pictures still
 *   meet cleanly, so a miss shows a jumbled picture.
 * - `item-*` icons keep a 1px clear margin (14x14 of art) so the cards can show them whole.
 * - Cabin decor (drawn in front of the airship's background logs): `porthole` is a framed dark
 *   window, `pillar` a thick upright post that tiles vertically, `ceiling-beam` a heavy beam that
 *   tiles sideways. Their wood matches the airship tiles' tan and red-brown.
 * - The airship deck (4-2-airship; its tiles are `<tile>@airship-deck`). `cannon-<dir>` is named for
 *   where the muzzle points: `r`/`l` and `ur`/`ul` stand on their bottom row, `dr`/`dl` hang from
 *   their top row under a deck; the muzzle ends at the frame's edge (r: right edge, rows 2-11) or
 *   corner (ur: the top-right corner). `cannonball` is a 13px ball centred in its 16x16.
 *   `rocky-hide` (shut lid), `rocky-0` (peek), `rocky-1` (up, wrench raised) face LEFT and stand on
 *   the deck (bottom row = the deck's top). `wrench-0/1` alternate as quarter turns.
 *   `propeller-0..2` turn in order; the shaft enters from the LEFT edge (the hull's side), so it
 *   points right/backward toward the stern; flip for the other way. `bolt` and `railing` are decor
 *   (railing tiles sideways, posts every 8px). `anchor` (32x32) has its chain ring at the top
 *   centre (x 14-17); `chain` tiles vertically and is centred on the vine line (x 7|8), so a vine
 *   drawn with it lines up with the anchor placed 8px left of the chain's tile.
 * - The World 4 crash: `map-airship-0/1` (32x16, bow LEFT, the stern screw turning),
 *   `map-airship-tilt` (bow 4px down), `map-wreck` (lying on its bottom row), `map-smoke-0..2`
 *   (puff, billow, wisps), `map-dust-0/1` (on the ground), `toad-map-0/1` (walking, facing the
 *   viewer), `toad-map-hammer-0/1` (mallet raised, mallet down; he faces RIGHT).
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
// Climbing 4-2's anchor chain (0.4.39): both hands out in front gripping the chain at his left
// edge (x 1-3), the wand tucked away, one leg drawn up; `-1` has the hands and legs the other way.
const LARRY_BODY_CLIMB = [
  ['..000.088881660.', '.09990g888156570', '..0990gaaa155570', '...000g888150570'],
  ['.....0088881660.', '..000.g888156570', '.09990gaaa155570', '..0990g888150570'],
];
const LARRY_ARM_LOW = [
  ['.099999088150570', '.0990090aa155770', '..000.0g8811770.'],
  ['...000g088150570', '.09999990a155770', '..00000g8811770.'],
];
const LARRY_LEGS_CLIMB = [
  ['....0aaa0.0990..', '....00000.0990..', '.........0aaaa0.', '.........000000.'],
  ['.....0990.0aaa0.', '.....0990.00000.', '...0aaaa0.......', '...000000.......'],
];
const larryClimb = (i: 0 | 1): string[] => [
  ...LARRY_HEAD,
  ...(LARRY_BODY_CLIMB[i] as string[]),
  ...(LARRY_ARM_LOW[i] as string[]),
  ...(LARRY_LEGS_CLIMB[i] as string[]),
];
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

/* A green pipe hanging from the cabin's ceiling (40x32): its body in the ceiling row, its rim
   one tile below with the opening facing down, the hero's way in. The pipe is 32 px wide and
   starts 8 px in, so on column 1 it is centred on column 2's middle, where a dropped-in hero
   falls. The same green and shading as the level's pipes (tiles.ts), rim upside down. */
const ceilingPipe = (() => {
  const pad = '........';
  const body = Array.from({ length: 16 }, () => pad + '..06655555665555' + '55556655550050..');
  const rimL = [
    '0000000000000000',
    '0666666666666666',
    ...Array.from({ length: 13 }, () => '0665555555665555'),
    '0000000000000000',
  ];
  const rimR = [
    '0000000000000000',
    '6666666666666660',
    ...Array.from({ length: 13 }, () => '5555665555550050'),
    '0000000000000000',
  ];
  const rim = rimL.map((l, y) => pad + l + rimR[y]).reverse();
  return [...body, ...rim];
})();

/* ------------------------------------------------------------------------------------------ */
/* The airship's deck: cannons, cannonball, Rocky Wrench, propeller, fittings, anchor, chain   */
/* ------------------------------------------------------------------------------------------ */

const mirrorX = (f: readonly string[]): string[] => f.map((r) => [...r].reverse().join(''));
const mirrorY = (f: readonly string[]): string[] => [...f].reverse();
/** A quarter turn clockwise. */
const turnCw = (f: readonly string[]): string[] =>
  [...(f[0] ?? '')].map((_, x) =>
    f
      .map((r) => r[x])
      .reverse()
      .join(''),
  );
/** A bar of half-width `hw` from (x0, y0) to (x1, y1), its ends squared off. */
const bar =
  (x0: number, y0: number, x1: number, y1: number, hw: number): Test =>
  (x, y) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const px = x + 0.5 - x0;
    const py = y + 0.5 - y0;
    const t = (px * dx + py * dy) / len;
    const n = (px * dy - py * dx) / len;
    return t >= 0 && t <= len && Math.abs(n) <= hw;
  };
/** Which side of the line from (x0, y0) to (x1, y1) a pixel is on (> 0: to its left, on screen). */
const side = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) =>
  (x + 0.5 - x0) * (y1 - y0) - (y + 0.5 - y0) * (x1 - x0);

/* Cannons (16x16): black iron barrels with a grey lit edge and a thicker muzzle band, on an iron
   mount. `cannon-r` lies on a carriage, `cannon-ur` angles up out of a squat dome; the others are
   these mirrored (left) or flipped upside down (the down cannons hang under a deck, mount on
   top). */
const cannonR = (() => {
  const g = grid(16, 16);
  blob(g, box(2, 12, 13, 15), '4', { light: [(_, y) => y === 13, '3'] });
  put(g, 4, 14, '2');
  put(g, 11, 14, '2');
  blob(g, or(ellipse(4.5, 6.5, 4.5, 4.6), box(4, 2, 14, 11)), '4', {
    light: [(_, y) => y === 3 || y === 4, '3'],
    shade: [(_, y) => y === 10, '0'],
  });
  blob(g, box(12, 1, 15, 12), '4', { light: [(x, y) => x === 13 && y > 1 && y < 11, '3'] });
  put(g, 5, 3, '2');
  put(g, 6, 3, '2');
  put(g, 1, 6, '3');
  return rows(g);
})();
const cannonUR = (() => {
  const g = grid(16, 16);
  // the barrel first, so the mount sits in front of its breech
  const toLine = side(4, 12.5, 14, 2.5);
  const n = (x: number, y: number) => toLine(x, y) / Math.hypot(10, 10);
  blob(g, bar(4, 12.5, 13.4, 3.1, 4), '4', { light: [(x, y) => n(x, y) > 1 && n(x, y) < 2.6, '3'] });
  blob(g, bar(10.6, 5.9, 16, 0.5, 4.8), '4', { light: [(x, y) => n(x, y) > 1.6 && n(x, y) < 3.4, '3'] });
  put(g, 14, 1, '0');
  put(g, 13, 2, '0');
  put(g, 15, 2, '0');
  put(g, 13, 0, '0');
  blob(g, and(ellipse(7, 16.5, 7, 6.5), box(0, 10, 15, 15)), '4', {
    light: [ellipse(5, 12.5, 2.4, 1.4), '3'],
  });
  put(g, 4, 12, '2');
  rect(g, 0, 15, 15, 1, '0');
  return rows(g);
})();

/* A cannonball: a black-iron sphere, lit up-left with a white glint. */
const cannonball = (() => {
  const g = grid(16, 16);
  blob(g, ellipse(8, 8, 6.5, 6.5), '4', {
    shade: [(x, y) => !ellipse(7, 7, 6.2, 6.2)(x, y), '0'],
    light: [ellipse(6, 6, 2, 1.6), '3'],
  });
  put(g, 5, 5, '1');
  put(g, 6, 5, '2');
  put(g, 5, 6, '2');
  return rows(g);
})();

/* The thrown wrench (8x8), spinning in quarter turns: an open jaw on a short handle. */
const wrench0 = (() => {
  const g = grid(8, 8);
  const shape: [number, number, string][] = [
    [5, 1, '2'],
    [7, 1, '2'],
    [5, 2, '2'],
    [6, 2, '2'],
    [7, 2, '3'],
    [4, 3, '2'],
    [5, 3, '3'],
    [3, 4, '2'],
    [4, 4, '3'],
    [2, 5, '2'],
    [3, 5, '3'],
    [1, 6, '2'],
    [2, 6, '3'],
  ];
  for (const [x, y, c] of shape) put(g, x, y, c);
  const solid = (x: number, y: number) => shape.some(([sx, sy]) => sx === x && sy === y);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)))
        put(g, x, y, '0');
  return rows(g);
})();

/* Rocky Wrench (16x16, faces left, bottom row = the deck's surface): a mole in a manhole. Shut,
   only the round iron lid shows; then he peeks out (big eyes); then he rises with a wrench. */
const manhole = (g: Grid, lid: boolean): void => {
  if (lid) {
    blob(g, ellipse(8, 13.5, 7.5, 2.5), '3', { light: [(_, y) => y <= 12, '2'] });
    put(g, 5, 13, '4');
    put(g, 10, 13, '4');
    put(g, 7, 14, '4');
    put(g, 8, 14, '4');
  } else {
    blob(g, ellipse(8, 14, 7.5, 2), '0', { line: '' });
    for (let x = 1; x <= 14; x++) put(g, x, 15, '3');
    put(g, 0, 14, '3');
    put(g, 15, 14, '3');
  }
};
const rockyHead = (g: Grid, cx: number, cy: number): void => {
  // brown fur, a tan snout pointing left, big white eyes looking left
  blob(g, and(ellipse(cx, cy, 5.5, 5), box(0, 0, 15, 14)), 'h', {
    shade: [(x, y) => x >= cx + 2.5 || y >= cy + 3, 'i'],
  });
  blob(g, ellipse(cx - 4.5, cy + 1.5, 3.2, 2), '8', { shade: [(_, y) => y >= cy + 2, '9'] });
  put(g, Math.max(0, Math.round(cx - 7.5)), Math.round(cy + 1), 'k');
  for (const ex of [cx - 3.5, cx - 0.5]) {
    rect(g, ex, cy - 3, 2, 3, '1');
    put(g, ex, cy - 2, '0');
    put(g, ex, cy - 1, '0');
  }
};
const rockyHide = (() => {
  const g = grid(16, 16);
  manhole(g, true);
  return rows(g);
})();
const rocky0 = (() => {
  const g = grid(16, 16);
  rockyHead(g, 8.5, 10);
  manhole(g, false);
  return rows(g);
})();
const rocky1 = (() => {
  const g = grid(16, 16);
  // his body out of the hole, one arm raised behind him with the wrench
  blob(g, box(3, 10, 12, 14), 'h', { shade: [(x) => x >= 10, 'i'] });
  blob(g, ellipse(7, 11.5, 2.4, 2), '8', { line: '' });
  blob(g, bar(11, 11, 12.5, 5.5, 1.3), 'h', { shade: [(x) => x >= 12, 'i'] });
  rockyHead(g, 6.5, 7);
  paint(g, 9, -2, wrench0);
  blob(g, ellipse(11.5, 5.5, 1.4, 1.4), '8');
  manhole(g, false);
  return rows(g);
})();

/* A propeller under the hull (16x16): its shaft comes out of the hull on the left, the blades
   spin round it seen from the side (long, turning, edge-on). */
const propeller = (f: number): string[] => {
  const g = grid(16, 16);
  blob(g, box(0, 6, 9, 9), '3', { light: [(_, y) => y === 7, '2'], shade: [(_, y) => y === 8, '4'] });
  const blades = [ellipse(10, 8, 2.6, 8), ellipse(10, 8, 3.8, 5.6), ellipse(10, 8, 1.7, 3.6)][f] as Test;
  blob(g, blades, '2', { shade: [(x, y) => (f === 1 ? y >= 8 : x >= 10), '3'] });
  blob(g, ellipse(13.5, 8, 2.5, 2.2), '3', { light: [(_, y) => y <= 7, '2'] });
  blob(g, ellipse(10, 8, 2, 2), '4');
  return rows(g);
};

/* A round bolt head (8x8): lit up-left, a dark slot across it. */
const bolt = (() => {
  const g = grid(8, 8);
  blob(g, ellipse(4, 4, 3.7, 3.7), '3', { light: [ellipse(3, 3, 2, 1.6), '2'] });
  for (const [x, y] of [
    [2, 5],
    [3, 4],
    [4, 3],
    [5, 2],
  ] as const)
    put(g, x, y, '4');
  return rows(g);
})();

/* The stern railing (16x16, tiles sideways): a capping rail on turned balusters every 8px, in the
   deck's wood (tan lit edge, light wood, orange-brown shade). */
const railing = Array.from({ length: 16 }, (_, y) => {
  if (y === 0 || y === 4) return '0'.repeat(16);
  if (y < 4) return ['8', 'r', 'j'][y - 1]?.repeat(16) ?? '';
  const bulge = y === 9 || y === 10;
  const post = bulge ? '08rrj0' : y === 15 ? '0jjjj0' : '.08rj0';
  return `.${post}..${post}.`.slice(0, 16).padEnd(16, '.');
});

/* The anchor (32x32): an iron ring at the top centre (the chain hooks on there), a stock across
   the shank, and two curved arms ending in flukes, resting on the ground. */
const anchor = (() => {
  const g = grid(32, 32);
  const lit: [Test, string] = [(x) => x <= 14, '2'];
  const dark: [Test, string] = [(x) => x >= 18, '4'];
  // the arms: a thick arc from fluke to fluke
  const arc = and(
    ellipse(16, 18, 13.5, 13.6),
    (x, y) => !ellipse(16, 18, 10, 10.2)(x, y),
    box(0, 19, 31, 31),
  );
  const flukes = or(
    poly([
      [1, 22],
      [2.5, 14],
      [8, 21],
    ]),
    poly([
      [31, 22],
      [29.5, 14],
      [24, 21],
    ]),
  );
  blob(g, or(arc, flukes), '3', {
    light: [(x, y) => ellipse(16, 18, 11.2, 11.3)(x, y) || (flukes(x, y) && y <= 17), '2'],
    shade: [(x, y) => !ellipse(16, 18, 12.4, 12.5)(x, y) && y >= 24, '4'],
  });
  // the shank down to the crown, and the stock with round ends
  blob(g, box(14, 6, 17, 29), '3', { light: [(x) => x === 15, '2'], shade: [(x) => x === 17, '4'] });
  blob(g, or(box(7, 9, 24, 11), ellipse(7, 10, 2, 2), ellipse(25, 10, 2, 2)), '3', {
    light: [(_, y) => y <= 9, '2'],
    shade: [(_, y) => y >= 11, '4'],
  });
  // the ring
  blob(
    g,
    and(ellipse(16, 3.5, 4, 3.5), (x, y) => !ellipse(16, 3.5, 1.6, 1.4)(x, y)),
    '3',
    {
      light: lit,
      shade: dark,
    },
  );
  return rows(g);
})();

/* The anchor's chain (16x16, tiles vertically): a face-on link threaded on an edge-on one, down the
   middle of the tile (the vine's centre line, columns 7 and 8). */
const chain = (() => {
  const g = grid(16, 16);
  // the edge-on link, wrapping round the tile edge into the next tile's ring
  for (const y of [11, 12, 13, 14, 15, 0, 1, 2, 3]) {
    put(g, 6, y, '0');
    put(g, 7, y, '2');
    put(g, 8, y, '3');
    put(g, 9, y, '0');
  }
  put(g, 7, 3, '0');
  put(g, 8, 3, '0');
  const ring = and(ellipse(8, 6, 5, 6), (x, y) => !ellipse(8, 6, 1.6, 2.8)(x, y));
  blob(g, ring, '3', { light: [(x, y) => x <= 6 && y <= 8, '2'], shade: [(x, y) => y >= 9 || x >= 10, '4'] });
  // threaded: the edge-on link passes in front of the ring's lower rim
  for (let y = 9; y <= 11; y++) {
    put(g, 7, y, '2');
    put(g, 8, y, '3');
  }
  return rows(g);
})();

/* ------------------------------------------------------------------------------------------ */
/* The crash on the World 4 map: the airship, its wreck, smoke, dust, Toad the builder          */
/* ------------------------------------------------------------------------------------------ */

/* The airship at map scale (32x16, bow on the LEFT like the deck level): a wooden hull with a row
   of portholes, a red-flagged mast, a cannon on the bow, and a propeller under the stern that
   turns between the two frames. */
const mapAirship = (f: number): string[] => {
  const g = grid(32, 16);
  // mast and flag
  rect(g, 19, 0, 1, 6, 'i');
  paint(g, 20, 0, ['0000.', 'ddde0', 'dde0.', '000..']);
  // bow cannon
  blob(g, bar(6, 5, 9.5, 1.6, 1.4), '4');
  // hull
  const hull = poly([
    [0, 3],
    [3, 5],
    [31, 5],
    [31, 8],
    [28, 11],
    [8, 11],
    [2, 7],
  ]);
  blob(g, hull, 'r', { light: [(_, y) => y === 6, '8'], shade: [(_, y) => y >= 9, 'j'] });
  for (const x of [11, 16, 21, 26]) put(g, x, 8, '0');
  rect(g, 3, 5, 28, 1, '0');
  // the propeller under the stern
  rect(g, 25, 11, 1, 2, '0');
  rect(g, 24, 13, 4, 1, '3');
  if (f === 0) {
    paint(g, 27, 10, ['020', '020', '000', '020', '030', '000']);
  } else {
    paint(g, 26, 12, ['00000', '22023', '00000']);
  }
  return rows(g);
};
/* Nose-down: the flying frame sheared so the bow drops 4px while the stern stays put. */
const mapAirshipTilt = (() => {
  const src = mapAirship(0);
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => src[y - Math.round(((31 - x) * 4) / 31)]?.[x] ?? '.').join(''),
  );
})();
/* The wreck: the hull broken in two on the ground, loose planks, the mast down, the screw bent. */
const mapWreck = (() => {
  const g = grid(32, 16);
  const shade: [Test, string] = [(_, y) => y >= 13, 'j'];
  blob(
    g,
    poly([
      [0, 11],
      [3, 9],
      [12, 9],
      [14, 11],
      [12, 12],
      [14, 14],
      [11, 16],
      [3, 16],
    ]),
    'r',
    { light: [(_, y) => y === 10, '8'], shade },
  );
  blob(
    g,
    poly([
      [17, 10],
      [20, 8],
      [31, 9],
      [31, 16],
      [19, 16],
      [21, 13],
    ]),
    'r',
    { light: [(_, y) => y === 9, '8'], shade },
  );
  put(g, 6, 13, '0');
  put(g, 25, 12, '0');
  put(g, 28, 12, '0');
  // planks and the fallen mast
  rect(g, 13, 14, 5, 1, 'j');
  rect(g, 12, 15, 6, 1, '0');
  rect(g, 15, 6, 1, 4, 'i');
  rect(g, 16, 5, 1, 2, 'i');
  paint(g, 17, 4, ['dd0', 'd0.']);
  // the bent screw sticking up
  paint(g, 29, 5, ['020', '.02', '.20', '030']);
  return rows(g);
})();

/* Smoke (16x16): a small puff, a billowing cluster, then wisps breaking up. */
const mapSmoke = (f: number): string[] => {
  const g = grid(16, 16);
  const puffs: [number, number, number][][] = [
    [[8, 10, 3.6]],
    [
      [5.5, 10.5, 4],
      [10.5, 10.5, 4],
      [8, 6.5, 4],
    ],
    [
      [3.5, 12, 2.2],
      [12, 10.5, 2.6],
      [7, 3.5, 2.4],
      [9, 13.5, 1.5],
    ],
  ];
  // one billowing outline, white, each puff shaded grey on its lower right; the last frame thins
  // to grey wisps
  const ps = puffs[f] ?? [];
  const lit = or(...ps.map(([x, y, r]) => ellipse(x - r * 0.25, y - r * 0.25, r * 0.8, r * 0.8)));
  blob(g, or(...ps.map(([x, y, r]) => ellipse(x, y, r, r))), f === 2 ? '2' : '1', {
    shade: [(x, y) => !lit(x, y), f === 2 ? '3' : '2'],
    line: f === 2 ? '3' : '0',
  });
  return rows(g);
};
/* Landing dust (16x16, on the ground): two puffs kicked out, then spread wider and thinning. */
const mapDust = (f: number): string[] => {
  const g = grid(16, 16);
  const ps: [number, number, number][] =
    f === 0
      ? [
          [4, 13, 2.6],
          [12, 13, 2.6],
        ]
      : [
          [2.5, 12, 2.2],
          [13.5, 12, 2.2],
          [6, 14, 1.4],
          [10, 14, 1.4],
        ];
  blob(g, or(...ps.map(([x, y, r]) => ellipse(x, y, r, r))), '8', {
    shade: [(_, y) => y >= 13, '9'],
    line: f === 0 ? '0' : 'a',
  });
  return rows(g);
};

/* Toad on the map (16x16, Hammer Bro scale): a white cap with red spots, a tan face, a blue vest,
   brown shoes. Walking he faces the viewer and steps; hammering he faces RIGHT (flip for left)
   with a builder's mallet raised high, then brought down. */
const toadMap = (step: number, hammer: number): string[] => {
  const g = grid(16, 16);
  const f = step;
  blob(g, box(3, 13 - (f ? 1 : 0), 6, 15 - (f ? 1 : 0)), 'i');
  blob(g, box(9, 13 - (f ? 0 : 1), 12, 15 - (f ? 0 : 1)), 'i');
  blob(g, ellipse(8, 11, 4.4, 2.8), 'c', { shade: [(x) => x >= 11, 'p'] });
  blob(g, ellipse(8, 11.2, 1.6, 2), '1', { line: '' });
  blob(g, ellipse(8, 8, 3.6, 2.6), '8', { shade: [(_, y) => y >= 9, '9'] });
  const lookRight = hammer >= 0;
  put(g, lookRight ? 8 : 6, 8, '0');
  put(g, lookRight ? 10 : 9, 8, '0');
  blob(g, and(ellipse(8, 6, 7.6, 5.6), box(0, 0, 15, 6)), '1', {
    shade: [(_, y) => y >= 6, '2'],
  });
  blob(g, ellipse(8, 2.6, 2, 1.6), 'd', { line: '' });
  blob(g, ellipse(2.8, 4.8, 1.2, 1.5), 'd', { line: '' });
  blob(g, ellipse(13.2, 4.8, 1.2, 1.5), 'd', { line: '' });
  if (hammer === 0) {
    // mallet raised over his shoulder
    for (let y = 3; y <= 9; y++) put(g, 13, y, 'h');
    paint(g, 11, 0, ['00000', '0rrj0', '00000']);
    blob(g, ellipse(13, 10, 1.3, 1.3), '8');
  } else if (hammer === 1) {
    // mallet swung down onto the ground in front of him
    for (let x = 11; x <= 13; x++) put(g, x, 11, 'h');
    paint(g, 13, 10, ['000', '0r0', '0r0', '0j0', '000']);
    blob(g, ellipse(11, 11, 1.3, 1.3), '8');
  }
  return rows(g);
};

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
    'larry-climb-0': larryClimb(0),
    'larry-climb-1': larryClimb(1),
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
    'ceiling-pipe': ceilingPipe,
    'cannon-r': cannonR,
    'cannon-l': mirrorX(cannonR),
    'cannon-ur': cannonUR,
    'cannon-ul': mirrorX(cannonUR),
    'cannon-dr': mirrorY(cannonUR),
    'cannon-dl': mirrorY(mirrorX(cannonUR)),
    cannonball,
    'rocky-hide': rockyHide,
    'rocky-0': rocky0,
    'rocky-1': rocky1,
    'wrench-0': wrench0,
    'wrench-1': turnCw(wrench0),
    'propeller-0': propeller(0),
    'propeller-1': propeller(1),
    'propeller-2': propeller(2),
    bolt,
    railing,
    anchor,
    chain,
    'map-airship-0': mapAirship(0),
    'map-airship-1': mapAirship(1),
    'map-airship-tilt': mapAirshipTilt,
    'map-wreck': mapWreck,
    'map-smoke-0': mapSmoke(0),
    'map-smoke-1': mapSmoke(1),
    'map-smoke-2': mapSmoke(2),
    'toad-map-0': toadMap(0, -1),
    'toad-map-1': toadMap(1, -1),
    'toad-map-hammer-0': toadMap(0, 0),
    'toad-map-hammer-1': toadMap(0, 1),
    'map-dust-0': mapDust(0),
    'map-dust-1': mapDust(1),
  },
};
