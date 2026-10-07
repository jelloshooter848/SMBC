import type { SpriteDef } from '@engine/gfx/pixelart';
import { NES } from '@engine/gfx/palette';
import { billDef } from './bill';
import { tilesDef } from './tiles';

/**
 * Bill's hidden jungle camp under 7-3 and his mini game in the style of an NES jungle run-and-gun:
 * the exploding bridge, explosions, the possessed soldiers and riflemen, rotating wall guns,
 * pop-up cannons, pillbox sensors, flying weapon capsules and the eagle badges they drop, the
 * shots, the defense wall with its cannons and sensor core, Red Falcon's heart, its larvae and
 * spitting pods, Bill's backward death flip, the life medal and the stage card's island map.
 * Original 8-bit art drawn here (black outlines, three-tone fills; many frames are computed from
 * shapes so they stay exact); nothing is traced. The jungle's tiles are `<tile>@contra-jungle`
 * frames on the tile sheet, the waterfall's `@contra-falls`, the lair's `@alien-lair`.
 *
 * Conventions the game relies on:
 * - Soldiers and riflemen face LEFT (flip for right) and stand on their bottom row (16x32, like a
 *   hero). `rifleman-bush` is a rifleman crouched in a bush: only his helmet and rifle show.
 * - `wall-gun-<k>` points k x 30 degrees clockwise from LEFT: 0 left, 3 up, 6 right, 9 down. Its
 *   pivot is the frame's centre (16, 16).
 * - `popup-cannon-0` is the closed hatch flush with the floor, `-1` half risen, `-2` up with its
 *   barrel to the LEFT; all stand on their bottom row.
 * - `pillbox-0` closed, `-1` half open, `-2` open (the sensor showing: shoot it while open).
 * - `capsule-0/1` flap their fins; `falcon-<letter>` is the eagle badge the capsule or pillbox
 *   drops (M machine gun, S spread, L laser, F fire, R rapid, B barrier).
 * - Shots are centred in their frames; `laser` points right (flip for left).
 * - `blast-bridge-0/1` is `bridge@contra-jungle` pixel for pixel in this sheet's same colours,
 *   with a red warning lamp lit (0) and dark (1) on its post. `boom-0..3` is centred: draw it over
 *   the segment's centre; 0 flash, 1 fireball, 2 billow, 3 smoke.
 * - The defense wall: `defense-wall` (32x32) tiles both ways; `defense-wall-top` (32x32) crowns
 *   it (the sniper's ledge is its top 8 rows); `defense-wall-door` (32x64) is the door frame with
 *   the core's recess, `core-*` (32x32) drawn over its rows 16-47; `defense-wall-broken` (32x32)
 *   is a wrecked plate for after the blast. `wall-cannon-0/1` (32x16) point LEFT, 1 firing.
 * - `falcon-heart-0..2` (64x64) beats 0 → 1 → 2 → 1, centred; `pod-0` closed, `-1` open
 *   (spitting); `larva-0` crawls LEFT, `-1` is its leap.
 * - `bill-death-0..3` (32x32, Bill centred on column 16, feet on the bottom row) is the backward
 *   flip: thrown back, upside down, over, then flat on his back. It uses Bill's own colours
 *   (indices 0-5 are the `bill` palette's).
 * - `medal` (8x16) is one life. `card-island` (96x64) is the stage card's map; `card-route`
 *   (4x4) is one dot of the route line.
 * - `contra-flash` is the hit flash; `alien` is the lair's light: the greens turn to flesh, the
 *   steel to bone and the flesh glows hotter (for the lair's things and the heart's beat).
 */

/**
 * `contra` index roles (the same in `contra-flash` and `alien`):
 *   0 black / outline   1 skin            2 hair, boots (dark)  3 trousers blue   4 red
 *   5 steel light       6 white           7 steel               8 steel dark      9 gold
 *   a gold light        b orange          c green dark          d green           e green light
 *   f olive             g khaki           h tan                 i dark red        j flesh
 *   k violet            l magenta         m laser blue          n cyan            o pale pink
 *   p dark flesh        q navy
 * Indices 0-5 are the `bill` palette's colours, so Bill's own frames draw here unchanged.
 */
const contraBase = (): string[] => [
  NES.black,
  NES.skin,
  NES.brownDark,
  NES.blueMid,
  NES.redBright,
  NES.lightGray,
  NES.white,
  NES.gray,
  NES.darkGray,
  NES.yellow,
  NES.yellowLight,
  NES.orange,
  NES.greenDark,
  NES.green,
  NES.greenPipe,
  NES.olive,
  NES.brown,
  NES.tan,
  NES.redDark,
  NES.red,
  '#6844fc',
  NES.magenta,
  NES.blueLight,
  NES.cyan,
  '#fcc4d8',
  '#580018',
  NES.blueDark,
];

const ALIEN: Record<number, string> = {
  // steel → bone
  5: NES.tan,
  7: NES.tanDark,
  8: NES.brown,
  // greens → flesh
  12: '#580018',
  13: NES.redDark,
  14: NES.red,
  // the flesh glows hotter
  19: '#f85898',
  24: NES.white,
  25: NES.redDark,
};

export const contraPalettes: Record<string, string[]> = {
  contra: contraBase(),
  // Struck: every colour but the outline blanches for a frame or two (skipped with reduce flashing).
  'contra-flash': contraBase().map((c, i) => (i === 0 ? c : i % 2 ? NES.white : NES.lightGray)),
  alien: contraBase().map((c, i) => ALIEN[i] ?? c),
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

const flipX = (rows: Rows): string[] => rows.map((r) => [...r].reverse().join(''));

/** Rotate a frame a quarter turn counter-clockwise (w x h becomes h x w). */
const rotateCCW = (rows: Rows): string[] => {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  return Array.from({ length: w }, (_, y) =>
    Array.from({ length: h }, (_, x) => at(rows, w - 1 - y, x)).join(''),
  );
};
const rotate180 = (rows: Rows): string[] => flipX([...rows].reverse());

/** Ring every opaque shape with a black outline in the transparent pixels around it. */
const outlined = (rows: Rows): string[] =>
  draw(rows[0]?.length ?? 0, rows.length, (x, y) => {
    const c = at(rows, x, y);
    if (c !== '.') return c;
    const near = [at(rows, x - 1, y), at(rows, x + 1, y), at(rows, x, y - 1), at(rows, x, y + 1)];
    return near.some((n) => n !== '.' && n !== '0') ? '0' : '.';
  });

/** A small deterministic hash in [0, 1) for speckles, rubble and ragged edges. */
const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/* ---------- the exploding bridge ---------- */

/** The jungle's steel girder in this sheet's colours (the tile sheet's steel is 8 light, b mid). */
const GIRDER = recolour(tilesDef.frames['bridge@contra-jungle'] as Rows, { '8': '5', b: '7', '1': '8' });

/* A warning lamp bolted to the truss's post: a red dome in a steel cage. */
const lamp = (lit: boolean): string[] => {
  const g = lit ? '4' : 'i';
  const s = lit ? 'a' : '4';
  return ['.000.', `0${s}${g}${g}0`, `0${g}${g}${g}0`, '05750', '.080.'];
};
const blastBridge0 = paste(GIRDER, lamp(true), 0, 5);
const blastBridge1 = paste(GIRDER, lamp(false), 0, 5);

/* ---------- explosions ---------- */

/** A fireball: lumpy edge, white-hot core through gold and orange to red, optional smoke holes. */
const fireball = (radius: number, seed: number, smoke: number, holes: number): string[] =>
  draw(32, 32, (x, y) => {
    const dx = x + 0.5 - 16;
    const dy = y + 0.5 - 16;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const edge = radius * (0.82 + 0.13 * Math.sin(a * 5 + seed) + 0.08 * Math.sin(a * 9 - seed * 2));
    if (r > edge) return '.';
    const t = r / edge;
    if (hash(x >> 1, y >> 1, seed) < holes && t > 0.35) return '.';
    if (hash(x >> 1, y >> 1, seed + 7) < smoke && t > 0.45) return t > 0.8 ? '8' : '7';
    if (t < 0.3) return '6';
    if (t < 0.5) return 'a';
    if (t < 0.7) return '9';
    if (t < 0.88) return 'b';
    return '4';
  });

/* A star-shaped flash: four long rays and four short ones round a white core. */
const boom0 = draw(32, 32, (x, y) => {
  const dx = x + 0.5 - 16;
  const dy = y + 0.5 - 16;
  const r = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  const ray = Math.abs(Math.cos(a * 4));
  const reach = 4 + 7 * Math.pow(ray, 6) + 2 * Math.pow(Math.abs(Math.cos(a * 4 + Math.PI / 4)), 8);
  if (r > reach) return '.';
  const t = r / reach;
  return t < 0.4 ? '6' : t < 0.7 ? 'a' : '9';
});
const boom1 = outlined(fireball(13, 1, 0, 0));
const boom2 = fireball(15, 3, 0.22, 0.08);
/* Smoke: grey puffs drifting apart with a few embers. */
const boom3 = draw(32, 32, (x, y) => {
  const puffs: [number, number, number][] = [
    [10, 11, 6],
    [21, 9, 5],
    [16, 19, 7],
    [7, 22, 4],
    [25, 21, 4.5],
  ];
  for (const [cx, cy, r] of puffs) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < r) {
      if (hash(x, y, 11) < 0.12) return '.';
      if (d < r * 0.35 && hash(x, y, 5) < 0.3) return '4';
      return y + 0.5 < cy - r * 0.3 ? '5' : d > r - 1.2 ? '8' : '7';
    }
  }
  return '.';
});

/* ---------- soldiers (face LEFT, 16x32, feet on the bottom row) ---------- */

// Helmet with a dark brim, glowing red eyes under it (Red Falcon's grip), a pale face.
const soldierHead = [
  '.....000000.....',
  '....0gggggg0....',
  '...0hggggggf0...',
  '..0ffffffffff0..',
  '...04401111f0...',
  '...0111111f0....',
  '....011110f0....',
  '.....0000f0.....',
];

// Running torso: the front arm pumping forward, a strap across the chest, the belt.
const soldierTorso = [
  '....0ggggg0.....',
  '...0gghgggf0....',
  '..0ggghggggf0...',
  '.01gg0hgggff0...',
  '.00..0hg8gff0...',
  '.....0gg8gf0....',
  '.....0888880....',
  '.....0gggff0....',
];

// Legs, 10 rows each, three running strides and a tucked jump.
const soldierLegs0 = [
  '....0gggg0f0....',
  '...0gg0.0gf0....',
  '..0gf0...0gf0...',
  '..0gf0....0gf0..',
  '.0gf0.....0gf0..',
  '.0ff0......0ff0.',
  '.0220......0220.',
  '02220.......0220',
  '0000........0220',
  '............0000',
];
const soldierLegs1 = [
  '.....0ggggf0....',
  '.....0ggggf0....',
  '.....0gg0gf0....',
  '....0gf0.0gf0...',
  '....0gf0.0gf0...',
  '...0gf0..0ff0...',
  '...0ff0..0220...',
  '...0220..0220...',
  '..02220..02220..',
  '..00000..00000..',
];
const soldierLegs2 = [
  '.....0gggf0.....',
  '.....0gggf0.....',
  '......0gf0......',
  '......0gf0......',
  '.....0gff0......',
  '.....0ff0.......',
  '.....0220.......',
  '....02220.......',
  '....00000.......',
  '................',
];

const soldier = (legs: Rows, dy = 0): string[] =>
  compose(16, 32, [soldierHead, 0, 6 + dy], [soldierTorso, 0, 14 + dy], [legs, 0, 22 + dy]);

const soldierRun0 = soldier(soldierLegs0);
const soldierRun1 = soldier(soldierLegs1);
const soldierRun2 = paste(soldier(soldierLegs2), ['....0', '...0', '...0'], 7, 30);

// The jump: knees drawn up, arms thrown up, still facing left.
const soldierJump = compose(
  16,
  32,
  [soldierHead, 0, 4],
  [
    [
      '.00.0ggggg0.....',
      '.010gghgggf0....',
      '..01ghggggff0...',
      '...0ghgggfff0...',
      '...0ghg8ggff0...',
      '....0gg8ggf0....',
      '....08888880....',
      '...0gggggggf0...',
      '..0gggf0gggf0...',
      '..0ggf0.0ggf0...',
      '...0ff0.0ff0....',
      '...0220.0220....',
      '..02220.02220...',
      '..00000.00000...',
    ],
    0,
    12,
  ],
);

// Rifleman: standing square-on, rifle levelled to the LEFT at shoulder height.
const riflemanTorso = (firing: boolean): string[] => [
  '....0ggggg0.....',
  '...0gghgggf0....',
  firing ? 'a907777777000...' : '0077777777000...',
  firing ? '9a05555555110f0.' : '0555555555110f0.',
  '...00ghgg01ff0..',
  '.....0g8ggff0...',
  '.....0888880....',
  '.....0gggff0....',
];
const riflemanLegs = [
  '.....0gggff0....',
  '.....0gggff0....',
  '....0gg00gf0....',
  '....0gf00gf0....',
  '....0gf00gf0....',
  '....0gf00gf0....',
  '....0ff00ff0....',
  '....0220.0220...',
  '...02220.02220..',
  '...00000.00000..',
];
const rifleman = (firing: boolean): string[] =>
  compose(16, 32, [soldierHead, 0, 6], [riflemanTorso(firing), 0, 14], [riflemanLegs, 0, 22]);

// The bush: a round leafy mound across the bottom rows, the rifleman's helmet, eyes and rifle
// peeking over its top.
const bush = draw(16, 14, (x, y) => {
  const bumps = [
    [3, 6, 4.5],
    [8, 4, 5],
    [13, 6, 4.5],
    [8, 9, 7.5],
  ] as const;
  let inside = false;
  let top = false;
  for (const [cx, cy, r] of bumps) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < r) {
      inside = true;
      if (y + 0.5 < cy - r * 0.45) top = true;
    }
  }
  if (!inside) return '.';
  if (top) return 'e';
  return hash(x, y, 3) < 0.25 ? 'c' : 'd';
});
const riflemanBush = outlined(
  compose(16, 32, [soldierHead.slice(0, 6), 0, 14], [['007777777770', '05555555551f'], 2, 19], [bush, 0, 18]),
);

/* ---------- guns ---------- */

/** A rotating wall gun at step k (k x 30 degrees clockwise from left). */
const wallGun = (k: number): string[] => {
  const a = (k * Math.PI) / 6;
  const dx = -Math.cos(a);
  const dy = -Math.sin(a);
  return draw(32, 32, (x, y) => {
    const px = x + 0.5 - 16;
    const py = y + 0.5 - 16;
    // the barrel
    const along = px * dx + py * dy;
    const across = Math.abs(-px * dy + py * dx);
    if (along > 5 && along < 15.6 && across < 2.7) {
      if (across > 1.7) return '0';
      if (along > 14.2) return '0';
      return across < 0.7 ? '5' : '7';
    }
    // the round turret with its red eye
    const r = Math.hypot(px, py);
    if (r < 3) return r < 1.3 ? '6' : '4';
    if (r < 4) return '0';
    if (r < 9.6) {
      if (r > 8.6) return '0';
      const lit = -px - py;
      return lit > 5 ? '5' : lit < -5 ? '8' : '7';
    }
    // the housing plate it is set in
    if (x < 2 || x > 29 || y < 2 || y > 29) return '.';
    if (x === 2 || y === 2 || x === 29 || y === 29) return '0';
    for (const [rx, ry] of [
      [5, 5],
      [26, 5],
      [5, 26],
      [26, 26],
    ] as const)
      if (Math.abs(x - rx) + Math.abs(y - ry) <= 1) return x === rx && y === ry ? '5' : '0';
    if (x === 3 || y === 3) return '7';
    if (x === 28 || y === 28) return '0';
    return '8';
  });
};

/** A pop-up cannon: a dome turret rising out of a hatch, barrel to the left. */
const popupCannon = (rise: number): string[] =>
  draw(32, 32, (x, y) => {
    const cy = 31 - rise;
    const px = x + 0.5 - 16;
    const py = y + 0.5 - cy;
    // the hatch frame in the floor
    if (y >= 29) {
      if (x < 3 || x > 28) return '.';
      if (y === 29) return x === 3 || x === 28 ? '0' : '7';
      return y === 31 ? '0' : x === 3 || x === 28 ? '0' : '8';
    }
    if (rise === 0) {
      // closed: two flush hatch leaves meeting in the middle
      if (y < 26 || x < 4 || x > 27) return '.';
      if (y === 26) return '0';
      if (x === 15 || x === 16) return '0';
      return y === 27 ? '5' : '7';
    }
    if (rise >= 12 && py > -6 && py < -1.5 && px < -6 && px > -17) {
      // the barrel, levelled left
      if (py < -5 || py > -2.5 || px < -16) return '0';
      return py < -4 ? '5' : '7';
    }
    const r = Math.hypot(px, py * 1.15);
    if (py > 0 || r > 11.5) return '.';
    if (r > 10.5) return '0';
    if (py > -5 && py < -2 && px > -6 && px < -1) return rise >= 12 ? '4' : '8';
    const lit = -px * 0.6 - py;
    return lit > 8 ? '5' : lit < 3 ? '8' : '7';
  });

/* ---------- pillbox sensors and capsules ---------- */

/** The red falcon emblem inside a sensor: a red disc with a gold bird. */
const sensorEmblem = draw(16, 16, (x, y) => {
  const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
  if (d > 7.6) return '.';
  if (d > 6.6) return '0';
  const half = [
    '........',
    '........',
    '........',
    '.9......',
    '.99....9',
    '..999.99',
    '...99999',
    '....9999',
    '.....999',
    '......99',
    '.......9',
    '........',
  ];
  const sx = x < 8 ? x : 15 - x;
  const c = half[y - 2]?.[sx];
  if (c === '9') return y < 7 ? 'a' : '9';
  return d < 3 ? '4' : 'i';
});

const pillbox = (open: number): string[] => {
  const frame = draw(32, 32, (x, y) => {
    if (x < 1 || x > 30 || y < 4) return '.';
    if (x === 1 || x === 30 || y === 4 || y === 31) return '0';
    if (y === 5 || x === 2) return '5';
    if (x === 29 || y === 30) return '8';
    // the window
    const inWin = x >= 6 && x <= 25 && y >= 9 && y <= 26;
    if (!inWin) return hash(x, y, 9) < 0.04 ? '8' : '7';
    if (x === 6 || x === 25 || y === 9 || y === 26) return '0';
    return '8';
  });
  const withEmblem = open > 0 ? paste(frame, sensorEmblem, 8, 10) : frame;
  // the two shutters slide apart: closed (8 wide each), half (4), open (gone)
  const leaf = [10, 5, 0][open] ?? 0;
  if (leaf === 0) return withEmblem;
  return draw(32, 32, (x, y) => {
    const c = at(withEmblem, x, y);
    if (y < 10 || y > 25) return c;
    if (x >= 7 && x < 7 + leaf) return x === 6 + leaf ? '0' : y % 4 === 1 ? '8' : x === 7 ? '5' : '7';
    if (x <= 24 && x > 24 - leaf) return x === 25 - leaf ? '0' : y % 4 === 1 ? '8' : '7';
    return c;
  });
};

/* The flying capsule: a steel pod with a red band and two fins that flap. */
const capsuleBody = [
  '........................',
  '........................',
  '........................',
  '........................',
  '.......0000000000.......',
  '.....00557555577700.....',
  '....0555744444477780....',
  '...075574466664477880...',
  '...077774466664477880...',
  '....0777744444477880....',
  '.....00777777778800.....',
  '.......0000000000.......',
  '........................',
  '........................',
  '........................',
  '........................',
];
const finsUp = [
  '..00................00..',
  '.0550..............0780.',
  '..0570............0780..',
  '...0570..........0880...',
];
const finsDown = [
  '...0570..........0880...',
  '..0570............0780..',
  '.0550..............0780.',
  '..00................00..',
];
const capsule0 = paste(capsuleBody, finsUp, 0, 0);
const capsule1 = paste(capsuleBody, finsDown, 0, 12);

/* ---------- eagle badges ---------- */

// Half an eagle with spread wings (mirrored): gold feathers, dark tips, a crest over the badge.
const eagleHalf = [
  '..........00',
  '0........0a9',
  '00......0a99',
  '0a00...0a999',
  '0aa900.0a999',
  '.0aa9900a999',
  '.09aa9999999',
  '..099a999999',
  '..0999999999',
  '...09099b999',
  '...00.09b999',
  '.......00999',
  '.........0b9',
  '..........09',
  '..........0b',
  '...........0',
];
const EAGLE = sym(eagleHalf);
const BADGE = draw(24, 16, (x, y) => {
  const d = Math.hypot((x + 0.5 - 12) / 6.2, (y + 0.5 - 7.5) / 5.6);
  if (d > 1) return '.';
  return d > 0.82 ? '0' : '6';
});
const GLYPHS: Record<string, string[]> = {
  M: ['4....4', '44..44', '444444', '4.44.4', '4....4', '4....4', '4....4'],
  S: ['.4444.', '44..44', '44....', '.4444.', '....44', '44..44', '.4444.'],
  L: ['44....', '44....', '44....', '44....', '44....', '44....', '444444'],
  F: ['444444', '44....', '44....', '44444.', '44....', '44....', '44....'],
  R: ['44444.', '44..44', '44..44', '44444.', '44.44.', '44..44', '44..44'],
  B: ['44444.', '44..44', '44..44', '44444.', '44..44', '44..44', '44444.'],
};
const falcon = (letter: string): string[] =>
  compose(24, 16, [EAGLE, 0, 0], [BADGE, 0, 0], [GLYPHS[letter] as Rows, 9, 4]);

/* ---------- shots ---------- */

const bulletSmall = ['.66.', '6aa6', '6aa6', '.66.'];
const bulletBig = ['.6666.', '66aa66', '6a99a6', '6a99a6', '66aa66', '.6666.'];
const spreadBall = draw(8, 8, (x, y) => {
  const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
  if (d > 3.9) return '.';
  if (d < 1.2) return '6';
  if (x + y < 6 && d < 2.6) return 'a';
  return d < 2.8 ? 'b' : '4';
});
const laser = ['.mmmmmmmmmmmmmm.', 'mn66666666666nmm', 'mn66666666666nmm', '.mmmmmmmmmmmmmm.'];
const fireRing = draw(8, 8, (x, y) => {
  const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
  if (d > 3.9 || d < 1.5) return '.';
  if (d < 2.3) return 'a';
  return y < 4 ? '9' : d > 3.2 ? '4' : 'b';
});
const enemyBullet = ['.44.', '4664', '4664', '.44.'];

/* ---------- the defense wall ---------- */

/** Armoured plate (32x32), riveted, two panels; tiles both ways. */
const plate = (x: number, y: number): string => {
  const py = y % 16;
  if (py === 15) return '0';
  if (py === 0) return '5';
  if (x === 31) return '0';
  if (x === 0) return '7';
  if ((x === 3 || x === 28) && (py === 3 || py === 12)) return '5';
  if ((x === 4 || x === 29) && (py === 4 || py === 13)) return '0';
  if (py === 14) return '0';
  if (py >= 6 && py <= 9 && x >= 8 && x <= 23) return py === 6 ? '0' : py === 9 ? '7' : '8';
  return py < 3 ? '7' : 'q';
};
const defenseWall = draw(32, 32, plate);
/* The crown: a railed ledge for the sniper, warning stripes under it, then plate. */
const defenseWallTop = draw(32, 32, (x, y) => {
  if (y === 0) return x % 8 === 0 ? '0' : '.';
  if (y < 4) return x % 8 === 0 ? '7' : '.';
  if (y === 4) return '0';
  if (y === 5) return '5';
  if (y === 6) return '7';
  if (y === 7) return '0';
  if (y < 11) return (x + y) % 8 < 4 ? '9' : '0';
  if (y === 11) return '0';
  return plate(x, y - 12 + 16);
});
/* The door: a thick frame of lit steel round a dark recess where the sensor core sits. */
const defenseWallDoor = draw(32, 64, (x, y) => {
  if (y < 4) return plate(x, y + 28);
  if (y < 8) return (x + y) % 8 < 4 ? '9' : '0';
  if (x < 3 || x > 28) return x === 0 ? '7' : x === 31 ? '0' : x === 1 ? '5' : '7';
  if (y === 8 || x === 3 || x === 28) return '0';
  if (y === 9 || x === 4) return '5';
  if (x === 27) return '8';
  // the recess
  if (y < 60) return x > 6 && x < 25 && y > 12 && y < 56 ? (y % 6 === 0 ? 'q' : '0') : '8';
  return y === 63 ? '0' : '7';
});
/* Wrecked: holes punched through, edges scorched and bent. */
const defenseWallBroken = draw(32, 32, (x, y) => {
  const holes: [number, number, number][] = [
    [9, 10, 6],
    [22, 20, 7],
    [6, 26, 4],
  ];
  for (const [cx, cy, r] of holes) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (hash(x, y, 21) - 0.5) * 2.5;
    if (d < r) return '.';
    if (d < r + 1.2) return '0';
    if (d < r + 2.4) return '8';
  }
  return plate(x, y);
});

/* A wall cannon: a fat barrel jutting left from its mount, firing in frame 1. */
const wallCannon = (firing: boolean): string[] =>
  draw(32, 16, (x, y) => {
    const recoil = firing ? 2 : 0;
    // the mount
    if (x >= 22) {
      if (y < 2 || y > 13) return '.';
      if (x === 22 || y === 2 || y === 13 || x === 31) return '0';
      return y < 5 ? '5' : y > 10 ? '8' : '7';
    }
    // muzzle flash
    if (firing && x < 6) {
      const d = Math.hypot((x + 0.5 - 4) * 0.9, y + 0.5 - 8);
      if (d < 2) return '6';
      if (d < 3.4) return 'a';
      if (d < 4.6 && hash(x, y, 2) < 0.8) return '9';
      return '.';
    }
    const bx = x - recoil;
    if (bx < 4) return '.';
    if (y < 5 || y > 10) {
      // the muzzle collar
      if (bx < 8 && y >= 4 && y <= 11) return y === 4 || y === 11 || bx === 4 ? '0' : y === 5 ? '5' : '7';
      return '.';
    }
    if (bx === 4) return '0';
    if (y === 5 || y === 10) return '0';
    if (bx < 8) return y === 6 ? '5' : y === 9 ? '8' : '7';
    return y === 6 ? '5' : y === 9 ? '8' : y === 7 ? '7' : '7';
  });

/** The sensor core: a glowing eye in a steel ring; brightness 0 (dim) to 2 (blazing). */
const core = (glow: number): string[] =>
  draw(32, 32, (x, y) => {
    const px = x + 0.5 - 16;
    const py = y + 0.5 - 16;
    const d = Math.hypot(px, py);
    if (d > 15.5) return '.';
    if (d > 14.5) return '0';
    if (d > 11.5) {
      const lit = -px - py;
      if (Math.abs(px) < 1 || Math.abs(py) < 1) return '8';
      return lit > 6 ? '5' : lit < -6 ? '8' : '7';
    }
    if (d > 10.5) return '0';
    const tones = [
      ['p', 'i', 'i', '4'],
      ['i', '4', 'b', '9'],
      ['4', 'b', 'a', '6'],
    ][glow] as string[];
    if (Math.hypot(px + 3.5, py + 3.5) < 1.8) return glow === 0 ? '4' : '6';
    const t = d / 10.5;
    return t > 0.8
      ? (tones[0] as string)
      : t > 0.55
        ? (tones[1] as string)
        : t > 0.3
          ? (tones[2] as string)
          : (tones[3] as string);
  });

/* ---------- Red Falcon ---------- */

/** The alien heart at `scale` (1 = full beat): veined flesh with two great vessels on top. */
const heart = (scale: number): string[] => {
  const body = draw(64, 64, (x, y) => {
    const u = (x + 0.5 - 32) / (22 * scale);
    const v = -(y + 0.5 - 36) / (22 * scale);
    const f = Math.pow(u * u + v * v - 1, 3) - u * u * v * v * v;
    // the vessels: two thick tubes rising out of the top
    const tube = (cx: number, w: number) => Math.abs(x + 0.5 - cx) < w && y >= 4 && y < 36 - 14 * scale;
    if (f > 0) {
      if (tube(25, 4.5) || tube(39, 3.5)) {
        const left = x + 0.5 < (tube(25, 4.5) ? 25 : 39);
        return y < 7 ? 'o' : left ? 'j' : 'i';
      }
      return '.';
    }
    // shading: a glistening highlight to the upper left, lumpy muscle, veins winding across
    const lump = 0.12 * Math.sin(u * 11 + 1) * Math.sin(v * 9 - 2);
    const dh = Math.hypot(u + 0.38, v - 0.42) + lump;
    const vein = Math.abs(Math.sin(u * 7 + Math.sin(v * 6) * 1.8)) < 0.1 && dh > 0.3;
    const vein2 = Math.abs(Math.sin(v * 6 - u * 2.5 + 0.5)) < 0.08 && u > -0.3 && dh > 0.5;
    if (vein || vein2) return dh < 0.9 ? 'i' : 'p';
    if (dh < 0.22) return '6';
    if (dh < 0.42) return 'o';
    if (dh < 0.85) return 'j';
    if (dh < 1.3) return 'i';
    return 'p';
  });
  return outlined(body);
};

/* A larva: a segmented pink grub crawling left, mandibles first. */
const larva0 = outlined([
  '................',
  '................',
  '................',
  '................',
  '................',
  '......jjjjj.....',
  '....jjoojjjjj...',
  '...joojjjjjjjj..',
  '..4jjjjpjjjpjjj.',
  '.i4jjjjpjjjpjjj.',
  '.iijjjjpjjjpjjp.',
  '..jjjjjpjjjpjpp.',
  '..pppppppppppp..',
  '..p..p..p..p..p.',
  '.p..p..p..p..p..',
  '................',
]);
const larva1 = outlined([
  '................',
  '................',
  '.......jjjj.....',
  '.....jjoojjjj...',
  '...jjoojjjjjjj..',
  '..4jjjjpjjjpjjj.',
  '.i4jjjjpjjjpjjjp',
  '.iijjjjpjjjpjjpp',
  '..jjjjjpjjjpjpp.',
  '...ppppppppppp..',
  '...p.p.p.p.p....',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

/** A spitting pod: a fleshy mound with lips; open, it bares teeth round a glowing throat. */
const pod = (open: boolean): string[] => {
  const body = draw(32, 32, (x, y) => {
    const px = x + 0.5 - 16;
    const py = y + 0.5 - 20;
    const d = Math.hypot(px / 14, py / 11.5);
    if (d > 1 || y > 31) return '.';
    // the mouth
    const m = Math.hypot(px / 7, (py + 1) / (open ? 5 : 1.4));
    if (m < 1) {
      if (!open) return '0';
      if (m > 0.78 && Math.abs(px) < 6 && x % 3 === 0) return '6';
      return m < 0.5 ? 'e' : m < 0.75 ? 'd' : '0';
    }
    if (m < 1.3) return py < -1 ? 'o' : 'j';
    const lit = -px * 0.05 - py * 0.12;
    if (Math.abs(Math.sin(px * 0.7 + py * 0.25)) < 0.1) return 'p';
    return lit > 0.8 ? 'o' : lit > -0.3 ? 'j' : lit > -1 ? 'i' : 'p';
  });
  return outlined(body);
};

/* ---------- Bill's death flip (his own colours; 32x32, feet on the bottom row) ---------- */

const BILL = billDef.frames as Record<string, Rows>;
const hurtBill = BILL.hurt as Rows;
// Flat on his back: standing Bill without his rifle, turned a quarter (head left, chest up),
// the rifle dropped on the ground beyond his head.
const unarmed = (BILL.idle as Rows).map((r) => r.replace(/5/g, '.'));
const lying = rotateCCW(unarmed);
const billDeath0 = compose(32, 32, [hurtBill, 8, 0]);
const billDeath1 = compose(32, 32, [rotateCCW(hurtBill), 0, 6]);
const billDeath2 = compose(32, 32, [rotate180(hurtBill), 8, 0]);
const billDeath3 = compose(32, 32, [lying, 0, 16], [['2255555555'], 0, 31]);

/* ---------- the HUD and the stage card ---------- */

/* A life medal: a red-and-blue ribbon, a gold disc with a star. */
const medal = [
  '0000000.',
  '0q440q0.',
  '0q440q0.',
  '0q440q0.',
  '.0q440..',
  '.0q440..',
  '..000...',
  '.00000..',
  '0aa9990.',
  '0a9a990.',
  '0a6a6a0.',
  '09a6a90.',
  '0999990.',
  '.09990..',
  '..000...',
  '........',
];

/* The island: a jungle-green land with beaches and a ridge of mountains in a navy sea. */
const cardIsland = draw(96, 64, (x, y) => {
  const px = (x + 0.5 - 48) / 40;
  const py = (y + 0.5 - 33) / 24;
  const a = Math.atan2(py, px);
  const r = Math.hypot(px, py);
  const coast = 0.78 + 0.1 * Math.sin(a * 3 + 1) + 0.07 * Math.sin(a * 7 - 2) + 0.04 * Math.sin(a * 13);
  if (r > coast + 0.08) {
    // the sea, with a few wave dashes
    return (x + y * 3) % 23 === 0 && y % 4 === 1 ? 'm' : 'q';
  }
  if (r > coast) return 'h'; // beach
  if (r > coast - 0.04) return 'g';
  // a mountain ridge along the north-east
  const ridge = Math.abs(py + 0.25 - px * 0.35) < 0.18 && px > -0.3;
  if (ridge) return hash(x >> 1, y >> 1, 4) < 0.5 ? '7' : '5';
  // a river winding south
  if (Math.abs(px - 0.12 * Math.sin(py * 5) + 0.35) < 0.035 && py > -0.1) return 'm';
  return hash(x >> 1, y >> 1, 8) < 0.3 ? 'c' : hash(x, y, 2) < 0.2 ? 'e' : 'd';
});
const cardRoute = ['.44.', '4a94', '4994', '.44.'];

export const contraDef: SpriteDef = {
  palette: 'contra',
  frames: {
    'blast-bridge-0': blastBridge0,
    'blast-bridge-1': blastBridge1,
    'boom-0': boom0,
    'boom-1': boom1,
    'boom-2': boom2,
    'boom-3': boom3,
    'soldier-run-0': soldierRun0,
    'soldier-run-1': soldierRun1,
    'soldier-run-2': soldierRun2,
    'soldier-jump': soldierJump,
    'rifleman-0': rifleman(false),
    'rifleman-1': rifleman(true),
    'rifleman-bush': riflemanBush,
    ...Object.fromEntries(Array.from({ length: 12 }, (_, k) => [`wall-gun-${k}`, wallGun(k)])),
    'popup-cannon-0': popupCannon(0),
    'popup-cannon-1': popupCannon(7),
    'popup-cannon-2': popupCannon(14),
    'pillbox-0': pillbox(0),
    'pillbox-1': pillbox(1),
    'pillbox-2': pillbox(2),
    'capsule-0': capsule0,
    'capsule-1': capsule1,
    'falcon-M': falcon('M'),
    'falcon-S': falcon('S'),
    'falcon-L': falcon('L'),
    'falcon-F': falcon('F'),
    'falcon-R': falcon('R'),
    'falcon-B': falcon('B'),
    'bullet-small': bulletSmall,
    'bullet-big': bulletBig,
    'spread-ball': spreadBall,
    laser,
    'fire-ring': fireRing,
    'enemy-bullet': enemyBullet,
    'defense-wall': defenseWall,
    'defense-wall-top': defenseWallTop,
    'defense-wall-door': defenseWallDoor,
    'defense-wall-broken': defenseWallBroken,
    'wall-cannon-0': wallCannon(false),
    'wall-cannon-1': wallCannon(true),
    'core-0': core(0),
    'core-1': core(1),
    'core-2': core(2),
    'falcon-heart-0': heart(0.8),
    'falcon-heart-1': heart(0.9),
    'falcon-heart-2': heart(1),
    'larva-0': larva0,
    'larva-1': larva1,
    'pod-0': pod(false),
    'pod-1': pod(true),
    'bill-death-0': billDeath0,
    'bill-death-1': billDeath1,
    'bill-death-2': billDeath2,
    'bill-death-3': billDeath3,
    medal,
    'card-island': cardIsland,
    'card-route': cardRoute,
  },
};
