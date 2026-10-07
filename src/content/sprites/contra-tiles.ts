import { NES } from '@engine/gfx/palette';

/**
 * Bill's themes on the tile sheet (registered in tiles.ts): `@contra-jungle` (the 7-3 reskin, the
 * camp under it and the mini game's ground), `@contra-falls` (the waterfall climb) and
 * `@alien-lair` (Red Falcon's lair). Original art in the spirit of an NES jungle run-and-gun; the
 * rock and flesh are computed (cells on a 16x16 torus, so every tile repeats seamlessly both
 * ways), the rest is drawn here. Every frame keeps its tile's collision shape: solid tiles fill
 * their 16x16, the bridge's deck is on its top rows, the backdrop and trunks are scenery.
 * The tile palettes keep the shared 12 roles (see tiles.ts), so `?` blocks, coins and the
 * flagpole keep their gold and green.
 */

type Rows = readonly string[];

/** A small deterministic hash in [0, 1). */
const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

const recolour = (rows: Rows, map: Record<string, string>): string[] =>
  rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));

/** Stack `top` over the rows of `rest` below it (to 16 rows). */
const over = (top: Rows, rest: Rows): string[] => [...top, ...rest.slice(top.length)];

/**
 * Cells on a 16x16 torus: each pixel belongs to its nearest seed (wrapping), so the pattern tiles
 * both ways. Returns the cell id per pixel.
 */
const cells = (seeds: readonly (readonly [number, number])[]): number[][] =>
  Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      let best = 0;
      let bestD = Infinity;
      seeds.forEach(([sx, sy], i) => {
        const dx = Math.min(Math.abs(x - sx), 16 - Math.abs(x - sx));
        const dy = Math.min(Math.abs(y - sy), 16 - Math.abs(y - sy));
        const d = dx * dx + dy * dy * 1.3;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    }),
  );

/**
 * Shade a cell map like stones: a seam (`seam`) where the cell below or to the right differs, a
 * lit edge (`lit`) where the cell above or to the left differs, a shadow (`dark`) one pixel in
 * from the seam, `main` elsewhere, and a fleck (`fleck`) on a few pixels.
 */
const stones = (
  map: number[][],
  [seam, dark, main, lit]: readonly [string, string, string, string],
  fleck?: readonly [string, number, number],
): string[] => {
  const id = (x: number, y: number) => map[(y + 16) % 16]?.[(x + 16) % 16] ?? 0;
  return draw(16, 16, (x, y) => {
    const c = id(x, y);
    if (id(x + 1, y) !== c || id(x, y + 1) !== c) return seam;
    if (id(x - 1, y) !== c || id(x, y - 1) !== c) return lit;
    if (id(x + 2, y) !== c || id(x, y + 2) !== c) return dark;
    if (fleck && hash(x, y, fleck[2]) < fleck[1]) return fleck[0];
    return main;
  });
};

/* ---------- palettes (the 12 shared tile roles) ---------- */

export const contraTilePalettes: Record<string, string[]> = {
  /* The jungle: earthy rock with moss-green shadows, jungle greens, a blue river; the bridge
     steel takes the white (light) and lava (mid grey) slots, which the jungle has no use for. */
  'tiles-contra-jungle': [
    NES.black,
    NES.greenDark,
    '#887000',
    NES.brownLight,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.lightGray,
    NES.blueMid,
    NES.blueLight,
    NES.gray,
  ],
  /* The waterfall: wet grey rock shaded brown, moss, white water; mist in the lava slot. */
  'tiles-contra-falls': [
    NES.black,
    NES.brownDark,
    NES.gray,
    NES.lightGray,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    '#0058f8',
    NES.blueLight,
    NES.skyLight,
  ],
  /* Red Falcon's lair: dark flesh, flesh and pale pink; bone in the white slot; acid slime in
     the green and water slots. */
  'tiles-alien-lair': [
    NES.black,
    '#580018',
    NES.redDark,
    '#f87898',
    NES.yellow,
    NES.teal,
    '#58f898',
    NES.yellowLight,
    NES.tan,
    '#00a844',
    NES.greenLight,
    NES.lava,
  ],
};

/* ---------- the jungle (`@contra-jungle`) ---------- */

const JUNGLE_ROCK = cells([
  [2, 2],
  [10, 1],
  [6, 7],
  [14, 7],
  [1, 11],
  [9, 13],
  [13, 13],
]);

/* Ground: rough jungle rock, moss in the cracks and a fleck or two of green on the faces. */
const groundJungle = stones(JUNGLE_ROCK, ['0', '1', '2', '3'], ['5', 0.04, 1]);

/* Jungle cliff top (`T`): a grass fringe over rock, blades poking above the top row. */
const grassTop = [
  '.6..6.6...6..6.6',
  '666666666666666.',
  '6656665666566656',
  '5555555555555555',
  '5155515551555155',
  '1101110111011101',
];
const treeTopJungle = over(grassTop, groundJungle);
// (the top row's blades are scenery over the solid tile; it starts with '.', see the test)

/* Cliff body (`t`, scenery): the rock in shade, vines hanging down it. */
const treeTrunkJungle = draw(16, 16, (x, y) => {
  if (x < 1 || x > 14) return '.';
  if (x === 1 || x === 14) return '0';
  if (x === 4 || x === 11) return y % 5 === 2 ? '6' : '5';
  const c = groundJungle[y]?.[x] ?? '2';
  return ({ '3': '2', '2': '1', '1': '0', '5': '1' } as Record<string, string>)[c] ?? c;
});

/* Breakable bricks: the SMB brick courses cut in the rock, moss on the top edge. */
const brickJungle = [
  '3353333033335330',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
  '3333333033333330',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
];

/* Hard block (`B`, the bridges' pylons): a riveted steel plate, lit top-left. */
const hardJungle = [
  '8888888888888880',
  '8bbbbbbbbbbbbb00',
  '8b8b0bbbbbb8b0b0',
  '8bb0bbbbbbbb0bb0',
  '8bbbbbbbbbbbbbb0',
  '8bbbb88888bbbbb0',
  '8bbbb8bbb0bbbbb0',
  '8bbbb8bbb0bbbbb0',
  '8bbbb8bbb0bbbbb0',
  '8bbbb8bbb0bbbbb0',
  '8bbbb00000bbbbb0',
  '8bbbbbbbbbbbbbb0',
  '8b8b0bbbbbb8b0b0',
  '8bb0bbbbbbbb0bb0',
  '8b00000000000000',
  '0000000000000000',
];

/* Spent block: the plate gone dull, rivets dark. */
const usedJungle = recolour(hardJungle, { '8': 'b', b: '2' });

/* `?` block: the SMB block with steel rivets in its corners (gold, the `?` and the rim kept). */
export const rivets = (rows: Rows): string[] =>
  rows.map((r, y) => (y === 2 || y === 13 ? `${r.slice(0, 2)}8${r.slice(3, 13)}8${r.slice(14)}` : r));

/* The girder bridge (`-`): a riveted deck on a steel truss, open between the members. */
const bridgeJungle = [
  '0000000000000000',
  '8888888888888888',
  'b8bbbbbbb8bbbbbb',
  'bbbbbbbbbbbbbbbb',
  '0000000000000000',
  'b0..........0b0.',
  'b80........08b0.',
  'b0b0......0b0b0.',
  'b0.b0....0b0.b0.',
  'b0..b0..0b0..b0.',
  'b0...b00b0...b0.',
  'b0...0bb0....b0.',
  'b0..0b00b0...b0.',
  'b8888888888888b0',
  '0000000000000000',
  '................',
];

/* The jungle backdrop (`H`, scenery): layered fronds, dark and close, black between. */
const wallJungle = draw(16, 16, (x, y) => {
  // fronds: rows of drooping leaves, each row offset half a leaf from the last
  const row = Math.floor(y / 4);
  const off = row % 2 ? 4 : 0;
  const lx = (x + off) % 8;
  const ly = y % 4;
  const leaf = Math.abs(lx - 3.5) < 3.6 - ly * 0.9;
  if (!leaf) return '0';
  if (ly === 0) return lx > 1 && lx < 5 ? '5' : '1';
  return '1';
});
/* The backdrop's top (`A`): leafy crowns against the sky over the fronds. */
const wallTopJungle = [
  '.....11.........',
  '...111511....1..',
  '..1155551...151.',
  '.115111151.15551',
  '1151111115115111',
  '1111110111111110',
  ...wallJungle.slice(6),
];

/* The river: dark blue with a pale foam crest and drifting ripples. */
const waterJungle = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const sx = (x + shift) % 16;
    if (y === 0) return sx % 8 < 3 ? '8' : 'a';
    if (y === 1) return 'a';
    if ((y === 5 && sx >= 2 && sx < 7) || (y === 10 && sx >= 9 && sx < 14)) return 'a';
    return '9';
  });

export const contraJungleFrames: Record<string, Rows> = {
  ground: groundJungle,
  hard: hardJungle,
  brick: brickJungle,
  used: usedJungle,
  'castle-brick': hardJungle,
  'tree-top': treeTopJungle,
  'tree-trunk': treeTrunkJungle,
  bridge: bridgeJungle,
  wall: wallJungle,
  'wall-top': wallTopJungle,
  'water-0': waterJungle(0),
  'water-1': waterJungle(4),
};

/* ---------- the waterfall (`@contra-falls`) ---------- */

const FALLS_ROCK = cells([
  [3, 3],
  [11, 2],
  [7, 9],
  [15, 10],
  [2, 13],
  [11, 14],
]);

/* Rock ledges: big wet grey stones, brown in the shadows, moss flecks. */
const groundFalls = stones(FALLS_ROCK, ['0', '1', '2', '3'], ['5', 0.05, 4]);

/* A ledge (`T`): moss over the rock, a drip of water from its lip. */
const treeTopFalls = over(
  ['.5..55....5..5..', '5655566555565556', '5555555555555555', '1501150115011501'],
  groundFalls,
);
/* The ledge's footing (`t`, scenery): rock in deep shade. */
const treeTrunkFalls = draw(16, 16, (x, y) => {
  if (x < 2 || x > 13) return '.';
  if (x === 2 || x === 13) return '0';
  const c = groundFalls[y]?.[x] ?? '2';
  return ({ '3': '2', '2': '1', '5': '1' } as Record<string, string>)[c] ?? c;
});
/* Breakable: a cracked boulder. */
const brickFalls = [
  '0333333333333330',
  '3322222222222213',
  '3222222202222211',
  '3222222022222221',
  '3222220222222221',
  '3222222002222221',
  '3222222220222221',
  '3200022222022221',
  '3222200022202221',
  '3222222220002221',
  '3222222222220221',
  '3222222222222021',
  '3222222222222221',
  '3122222222222211',
  '1111111111111111',
  '0111111111111110',
];
/* Hard block: a squared stone, chiselled edge. */
const hardFalls = [
  '3333333333333330',
  '3222222222222210',
  '3233333333333110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3232222222221110',
  '3231111111111110',
  '3211111111111110',
  '3111111111111110',
  '0000000000000000',
];
const usedFalls = recolour(hardFalls, { '3': '2', '2': '1', '1': '0' });
/* A log bridge (`-`): two lashed logs. */
const bridgeFalls = [
  '0000000000000000',
  '3333333333333333',
  '2222122222221222',
  '1111111111111111',
  '0000000000000000',
  '.08.......08....',
  '.08.......08....',
  '.00.......00....',
  ...Array.from({ length: 8 }, () => '................'),
];
/* The cliff behind (`H`, scenery): dark wet rock with trickles. */
const wallFalls = draw(16, 16, (x, y) => {
  const c = groundFalls[y]?.[x] ?? '2';
  if (x === 5 && y % 6 < 4) return '9';
  if (x === 12 && (y + 3) % 7 < 3) return '9';
  return ({ '3': '1', '2': '0', '1': '0', '5': '1' } as Record<string, string>)[c] ?? '0';
});
/* Spray over the backdrop (`A`): white mist drifting off the falls. */
const wallTopFalls = draw(16, 16, (x, y) => {
  if (y < 6) {
    const puff = Math.hypot(((x + 3) % 8) - 4, y - 4) < 3.5 + hash(x, y, 2);
    return puff ? (y < 3 ? '8' : 'b') : '.';
  }
  return y < 8 && hash(x, y, 3) < 0.5 ? 'b' : ((wallFalls[y] as string)[x] as string);
});
/* Falling water (`w`): streaks of blue and white sliding down; frame 1 is frame 0 moved 8 down. */
const fall = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const yy = (y + 16 - shift) % 16;
    const streak = [0, 3, 6, 9, 13].includes(x);
    if (streak) return (yy + x * 3) % 16 < 6 ? '8' : 'a';
    return (yy + x * 5) % 11 === 0 ? 'a' : '9';
  });

export const contraFallsFrames: Record<string, Rows> = {
  ground: groundFalls,
  hard: hardFalls,
  brick: brickFalls,
  used: usedFalls,
  'castle-brick': groundFalls,
  'tree-top': treeTopFalls,
  'tree-trunk': treeTrunkFalls,
  bridge: bridgeFalls,
  wall: wallFalls,
  'wall-top': wallTopFalls,
  'water-0': fall(0),
  'water-1': fall(8),
};

/* ---------- Red Falcon's lair (`@alien-lair`) ---------- */

const LAIR_CELLS = cells([
  [4, 3],
  [12, 4],
  [8, 10],
  [1, 11],
  [14, 13],
]);

/* Floor: swollen cells of flesh, dark creases between, a glistening highlight on each. */
const groundLair = draw(16, 16, (x, y) => {
  const id = (xx: number, yy: number) => LAIR_CELLS[(yy + 16) % 16]?.[(xx + 16) % 16] ?? 0;
  const c = id(x, y);
  if (id(x + 1, y) !== c || id(x, y + 1) !== c) return '1';
  if (id(x - 1, y) !== c || id(x, y - 1) !== c) return '2';
  if (id(x - 2, y) !== c && id(x, y - 2) !== c) return '3';
  return hash(x, y, 6) < 0.06 ? '1' : '2';
});
/* Organic wall (`%`): ribs of bone in flesh. */
const castleBrickLair = draw(16, 16, (x, y) => {
  const rib = (y + Math.round(Math.sin(x / 2.5) * 1.5) + 16) % 8;
  if (rib === 0) return '0';
  if (rib === 1) return '8';
  if (rib === 2) return '8';
  if (rib === 3) return '1';
  return hash(x, y, 7) < 0.08 ? '3' : '2';
});
/* Hard block: a plate of bone, cracked. */
const hardLair = [
  '8888888888888880',
  '8888888888888810',
  '8888818888888110',
  '8888881888881110',
  '8888881188811810',
  '8888888818888810',
  '8888888881888810',
  '8888888881888810',
  '8888888818888810',
  '8888888888888810',
  '8888888888888810',
  '8888888888888810',
  '8888888888888810',
  '8811111111111110',
  '8111111111111110',
  '0000000000000000',
];
/* Breakable: a clutch of eggs. */
const brickLair = draw(16, 16, (x, y) => {
  const eggs: [number, number][] = [
    [4, 4],
    [12, 4],
    [8, 11],
    [0, 12],
    [16, 12],
  ];
  for (const [cx, cy] of eggs) {
    const d = Math.hypot((x + 0.5 - cx) / 4, (y + 0.5 - cy) / 4.5);
    if (d < 1) return d > 0.85 ? '0' : x + 0.5 < cx - 1 && y + 0.5 < cy - 1 ? '3' : d > 0.6 ? '2' : '3';
  }
  return '1';
});
const usedLair = recolour(hardLair, { '8': '2', '1': '0' });
/* A ledge (`T`): a shelf of bone over flesh. */
const treeTopLair = over(
  ['8888888888888888', '8818888818888818', '1111111111111111', '0000000000000000'],
  groundLair,
);
/* Sinew (`t`, scenery): taut strands of muscle. */
const treeTrunkLair = draw(16, 16, (x) => {
  if (x < 3 || x > 12) return '.';
  if (x === 3 || x === 12) return '0';
  return x % 3 === 0 ? '1' : x % 3 === 1 ? '2' : '3';
});
/* A spine bridge (`-`): vertebrae on a cord. */
const bridgeLair = [
  '0000000000000000',
  '0880888808880888',
  '8888888888888888',
  '1881188118811881',
  '0110011001100110',
  '.00..00..00..00.',
  ...Array.from({ length: 10 }, () => '................'),
];
/* The lair's backdrop (`H`, scenery): dark flesh veined in red. */
const wallLair = draw(16, 16, (x, y) => {
  const v1 = Math.abs(x - 4 - Math.round(Math.sin(y / 2.5) * 2)) < 1;
  const v2 = Math.abs(y - 9 - Math.round(Math.sin(x / 2) * 1.5)) < 1 && x > 5;
  if (v1 || v2) return '2';
  return hash(x, y, 13) < 0.05 ? '2' : '1';
});
/* Dripping fringe (`A`). */
const wallTopLair = draw(16, 16, (x, y) => {
  const drip = [3, 6, 2, 5, 7, 3, 4, 6][x % 8] as number;
  if (y > drip) return (wallLair[y] as string)[x] as string;
  if (y === drip) return '2';
  return y < 2 ? '2' : x % 4 === 1 ? '3' : '2';
});
/* Acid slime (`w`). */
const slime = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const sx = (x + shift) % 16;
    if (y === 0) return sx % 6 < 2 ? 'a' : '.';
    if (y === 1) return 'a';
    if ((y === 6 && sx % 9 < 2) || (y === 11 && (sx + 4) % 9 < 2)) return 'a';
    return '9';
  });

export const alienLairFrames: Record<string, Rows> = {
  ground: groundLair,
  hard: hardLair,
  brick: brickLair,
  used: usedLair,
  'castle-brick': castleBrickLair,
  'tree-top': treeTopLair,
  'tree-trunk': treeTrunkLair,
  bridge: bridgeLair,
  wall: wallLair,
  'wall-top': wallTopLair,
  'water-0': slime(0),
  'water-1': slime(3),
};
