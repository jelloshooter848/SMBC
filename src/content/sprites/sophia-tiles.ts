import { NES } from '@engine/gfx/palette';
import { Canvas, cells, draw, hash, recolour, stones, type Rows } from './sophia-draw';

/**
 * Sophia's themes on the tile sheet (registered in tiles.ts) and the Underworld's scenery on the
 * decor sheet (registered in decor.ts). Original art in the spirit of an NES tank-and-dungeon game.
 *
 * - `@underworld`: the side-view cavern of Sophia's garage and the mini game's first section.
 *   Dark rust rock threaded with pale roots, rock blocks a cannon can break, bolted slabs,
 *   masonry stained with mutant slime, a plank-and-rope bridge, a root column (`tree-trunk`) and
 *   root-fringed ledges (`tree-top`), murky water.
 * - `@bm-dungeon`: the same tiles as a side view of the overhead dungeon's metal (steel floor
 *   plates, grille panels, riveted blocks, a catwalk, toxic sludge), so a level may use it too.
 *   The top-down kit's own tiles are the `bm-dungeon` sheet (bm-dungeon.ts).
 * Every frame keeps its tile's collision shape: solid blocks fill their 16x16, the bridge's deck
 * is on its top rows, the trunk and the backdrop are scenery. The palettes keep the shared 12
 * tile roles (tiles.ts), so `?` blocks, coins, pipes and the flagpole keep their colours.
 */

/* ---------- palettes (the 12 shared tile roles) ---------- */

export const sophiaTilePalettes: Record<string, string[]> = {
  /* The Underworld: dark rust rock, pale roots in the white slot, mutant-green slime in the green
     slots (pipes keep it), murky teal water. */
  'tiles-underworld': [
    NES.black,
    '#3c1c0c',
    '#743c18',
    '#b0703c',
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    '#e8c088',
    '#00587c',
    '#38a8b8',
    NES.lava,
  ],
  /* The dungeon's metal: blue-violet steel, toxic green sludge in the water slots. */
  'tiles-bm-dungeon': [
    NES.black,
    '#20204c',
    '#50508c',
    '#9c9cd8',
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    '#007800',
    '#58d854',
    NES.lava,
  ],
};

/** Stack `top` over the rows of `rest` below it (to 16 rows). */
const over = (top: Rows, rest: Rows): string[] => [...top, ...rest.slice(top.length)];

/** A pale root wandering across a tile (period 16, so it joins its neighbours): lit on top. */
const rootAcross = (rows: Rows, cy: number, amp: number, phase: number): string[] => {
  const c = Canvas.from(rows);
  for (let x = 0; x < 16; x++) {
    const y = Math.round(cy + amp * Math.sin(((x + phase) / 16) * 2 * Math.PI));
    c.set(x, y - 1, '0')
      .set(x, y, '8')
      .set(x, y + 1, '3')
      .set(x, y + 2, '0');
  }
  return c.rows();
};

/* ---------- the Underworld (`@underworld`) ---------- */

const UW_ROCK = cells([
  [3, 2],
  [11, 3],
  [7, 8],
  [14, 10],
  [2, 12],
  [9, 14],
]);

/** Rock with a short pale root threading through it (not across: tiled, it would stripe). */
const groundUw = (() => {
  const c = Canvas.from(stones(UW_ROCK, ['0', '1', '2', '3'], ['5', 0.03, 2]));
  for (let x = 2; x <= 12; x++) {
    const y = Math.round(12 - (x - 2) * 0.55 + Math.sin(x) * 0.6);
    c.set(x, y, '8').set(x, y + 1, '1');
  }
  c.set(13, 6, '3').set(1, 13, '3');
  return c.rows();
})();

/** A ledge: a tangle of roots along the lip, then the rock. */
const treeTopUw = over(
  [
    draw(16, 1, (x) => (x % 5 === 4 ? '.' : x % 5 === 0 ? '3' : '8')).join(''),
    draw(16, 1, (x) => (x % 5 === 2 ? '3' : '8')).join(''),
    draw(16, 1, (x) => (x % 3 === 0 ? '3' : '0')).join(''),
  ],
  rootAcross(stones(UW_ROCK, ['0', '1', '2', '3']), 9, 1, 5),
);

/** A thick root hanging down (scenery): dark edges, a lit stripe, knots. */
const treeTrunkUw = draw(16, 16, (x, y) => {
  if (x < 4 || x > 11) return '.';
  if (x === 4 || x === 11) return '0';
  if (hash(x, y, 4) < 0.08) return '1';
  if (x === 6 || x === 7) return (y + x) % 7 === 0 ? '3' : '8';
  if (x === 10) return '1';
  return '3';
});

/** A rock block a shot can crack: bevelled, split from the middle. */
const brickUw = (() => {
  const c = new Canvas(16, 16).rect(0, 0, 16, 16, '2');
  c.hline(0, 15, 0, '3').vline(0, 0, 15, '3');
  c.hline(1, 15, 14, '1').vline(14, 1, 15, '1');
  c.hline(0, 15, 15, '0').vline(15, 0, 15, '0');
  c.line(8, 8, 3, 3, '1').line(8, 8, 12, 4, '1').line(8, 8, 10, 12, '1').set(8, 8, '0');
  c.set(3, 10, '3').set(11, 9, '3').set(5, 6, '3');
  return c.rows();
})();

/** A bolted slab: a bevel, an inset panel, four pale bolts. */
const hardUw = (() => {
  const c = new Canvas(16, 16).rect(0, 0, 16, 16, '2');
  c.hline(0, 15, 0, '3').vline(0, 0, 15, '3');
  c.hline(1, 15, 14, '1').vline(14, 1, 15, '1');
  c.hline(0, 15, 15, '0').vline(15, 0, 15, '0');
  c.rect(4, 4, 8, 8, '1').rect(5, 5, 6, 6, '2').hline(5, 10, 5, '3');
  for (const [x, y] of [
    [2, 2],
    [12, 2],
    [2, 12],
    [12, 12],
  ] as const)
    c.set(x, y, '8').set(x + 1, y + 1, '0');
  return c.rows();
})();

/** Masonry courses offset half a block, slime running down from the joints. */
const castleBrickUw = draw(16, 16, (x, y) => {
  const course = y >> 3;
  const xx = (x + (course % 2) * 8) % 16;
  const seamV = xx === 15;
  if (y % 8 === 7 || seamV) return '0';
  // a drip of slime down the face from the joint above
  if ((xx === 4 || xx === 5) && y % 8 < 5 - (xx - 4)) return y % 8 === 0 ? '6' : '5';
  if (y % 8 === 0 || xx === 0) return '3';
  if (y % 8 === 6 || xx === 14) return '1';
  return hash(x, y, 6) < 0.08 ? '1' : '2';
});

/** Planks lashed on a root rope: the deck spans the top rows, the rope sags below. */
const bridgeUw = draw(16, 16, (x, y) => {
  if (y === 0) return '8';
  if (y === 1 || y === 2) return x % 5 === 4 ? '0' : y === 1 ? '8' : '3';
  if (y === 3) return '0';
  const sag = 5 + Math.round(2.5 * Math.sin((x / 16) * Math.PI));
  if (y === sag) return '3';
  if (y === sag + 1) return '0';
  if ((x === 2 || x === 13) && y < sag) return '3';
  return '.';
});

const UW_BACK = cells(
  [
    [4, 4],
    [12, 2],
    [9, 10],
    [1, 13],
    [14, 13],
  ],
  1.6,
);

/** The cavern's back wall (scenery): dim rock, no highlight. */
const wallUw = stones(UW_BACK, ['0', '0', '1', '1'], ['2', 0.04, 8]);

/** The back wall's top: a ragged rim, roots dangling over it. */
const wallTopUw = draw(16, 16, (x, y) => {
  const rim = 2 + Math.round(1.5 * Math.sin((x / 16) * 4 * Math.PI) + hash(x, 0, 2));
  if (y < rim) return (x === 5 || x === 12) && y >= 0 ? '3' : '.';
  if (y === rim) return '0';
  return wallUw[y]?.[x] ?? '0';
});

/** Murky water: a pale crest, then dark water with ripples (the second frame 8 px on). */
const waterUw = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const xx = (x + shift) % 16;
    if (y === 0) return xx % 8 < 3 ? '8' : 'a';
    if (y === 1) return xx % 8 < 5 ? 'a' : '9';
    return hash(xx, y, 3) < 0.06 ? 'a' : '9';
  });

/** A spent block: the slab gone dull and dark, its panel and bolts worn flat. */
const usedUw = (() => {
  const c = new Canvas(16, 16).rect(0, 0, 16, 16, '1');
  c.hline(0, 15, 0, '2').vline(0, 0, 15, '2');
  c.hline(0, 15, 15, '0').vline(15, 0, 15, '0');
  for (const [x, y] of [
    [2, 2],
    [12, 2],
    [2, 12],
    [12, 12],
  ] as const)
    c.set(x, y, '0');
  return c.rows();
})();

export const underworldFrames: Record<string, Rows> = {
  ground: groundUw,
  hard: hardUw,
  brick: brickUw,
  used: usedUw,
  'castle-brick': castleBrickUw,
  'tree-top': treeTopUw,
  'tree-trunk': treeTrunkUw,
  bridge: bridgeUw,
  wall: wallUw,
  'wall-top': wallTopUw,
  'water-0': waterUw(0),
  'water-1': waterUw(8),
};

/* ---------- the dungeon's metal (`@bm-dungeon`) ---------- */

/** A steel plate: lit top and left, dark bottom and right, `inner` drawn inside. */
const plate = (inner: (x: number, y: number) => string | undefined): string[] =>
  draw(16, 16, (x, y) => {
    if (x === 15 || y === 15) return '0';
    if (x === 0 || y === 0) return '3';
    if (x === 14 || y === 14) return '1';
    return inner(x, y) ?? '2';
  });

const groundDg = plate((x, y) => ((x + y) % 4 === 0 && x > 1 && y > 1 && x < 13 && y < 13 ? '1' : undefined));
const hardDg = plate((x, y) =>
  (x === 2 || x === 12) && (y === 2 || y === 12)
    ? '8'
    : x >= 5 && x <= 10 && y >= 5 && y <= 10
      ? x === 5 || y === 5
        ? '1'
        : '3'
      : undefined,
);
const brickDg = plate((x, y) => (y >= 3 && y <= 11 && y % 2 === 1 && x >= 3 && x <= 11 ? '0' : undefined));
const castleBrickDg = draw(16, 16, (x, y) => {
  if (y === 7 || y === 15) return '0';
  if (x === 7 && y < 7) return '0';
  if (x === 15 && y > 7) return '0';
  if (y === 0 || y === 8) return '3';
  if ((x === 3 || x === 11) && y % 8 > 1 && y % 8 < 6) return '5';
  return y % 8 === 6 ? '1' : '2';
});
const catwalk = draw(16, 4, (x, y) => (y === 3 ? '0' : y === 0 ? '3' : x % 3 === 0 ? '0' : '2'));
const treeTopDg = over(catwalk, groundDg);
const treeTrunkDg = draw(16, 16, (x, y) => {
  if (x < 5 || x > 10) return '.';
  if (x === 5 || x === 10) return '0';
  if (y % 8 === 3) return '1';
  return x === 6 ? '3' : x === 9 ? '1' : '2';
});
const bridgeDg = draw(16, 16, (x, y) => {
  if (y < 4) return catwalk[y]?.[x] ?? '0';
  // the truss under the deck: a zig-zag strut
  const z = y - 4;
  const along = x % 12;
  if (Math.abs(along - z) < 1 || Math.abs(12 - along - z) < 1) return '1';
  if (y === 15) return '0';
  return '.';
});
const wallDg = draw(16, 16, (x, y) => {
  if (y % 8 === 7 || x === 15) return '0';
  if ((x === 4 || x === 5) && y % 8 < 7) return '0';
  return y % 8 === 0 ? '2' : '1';
});
const wallTopDg = over(
  draw(16, 8, (x, y) => (y < 3 ? (x % 4 === 1 ? '1' : '.') : y === 3 ? '0' : y === 4 ? '2' : '1')),
  wallDg,
);
const sludge = (shift: number): string[] =>
  draw(16, 16, (x, y) => {
    const xx = (x + shift) % 16;
    if (y === 0) return xx % 6 < 2 ? 'a' : '9';
    return hash(xx, y, 12) < 0.08 ? 'a' : '9';
  });

export const bmDungeonTileFrames: Record<string, Rows> = {
  ground: groundDg,
  hard: hardDg,
  brick: brickDg,
  used: recolour(hardDg, { '8': '1', '3': '2' }),
  'castle-brick': castleBrickDg,
  'tree-top': treeTopDg,
  'tree-trunk': treeTrunkDg,
  bridge: bridgeDg,
  wall: wallDg,
  'wall-top': wallTopDg,
  'water-0': sludge(0),
  'water-1': sludge(8),
};

/* ---------- Underworld scenery on the decor sheet ---------- */

/**
 * `decor-underworld` (the decor sheet's roles): 1-3 slime greens (the hills and bushes become
 * slimy mounds), 4-5 the cloud slots as a dim cave mist, 6-8 the castle's brick as the cavern's
 * rock, 9-a wood as roots.
 *
 * - `gateway` (32x32): a stone arch round a dark doorway 12 px wide and 20 tall (Jason's way
 *   through, the tank's dead end), slime dripping from the keystone. Stands on its bottom row.
 * - `roots` (32x16): roots hanging from the cavern roof. Place it at row 0 (`roots x 0`): it
 *   covers the top tile row; its left and right edges join when placed every 2 columns.
 * - `hill-*`, `bush-*`, `cloud-*@underworld`: a level's classic scenery under this theme, at the
 *   same sizes: heaps of rock, stalagmite clusters, a dim drifting mist.
 * These frames are drawn for `decor-underworld` and only look right there.
 */
export const underworldDecorPalette: string[] = [
  NES.black,
  '#004400',
  NES.green,
  NES.greenPipe,
  '#4c3450',
  '#281828',
  '#3c1c0c',
  '#743c18',
  '#b0703c',
  '#6c4420',
  '#e8c088',
];

const gateway = (() => {
  const c = new Canvas(32, 32);
  // The arch: a round-topped block of masonry.
  c.ellipse(16, 12, 14, 11, '7').rect(2, 12, 28, 20, '7');
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (c.get(x, y) !== '7') continue;
      const course = Math.floor((y - 1) / 5);
      if ((y - 1) % 5 === 4 || (x + course * 3) % 7 === 0) c.set(x, y, '6');
      else if ((y - 1) % 5 === 0) c.set(x, y, '8');
    }
  // The doorway, round-topped and black.
  c.ellipse(16, 18, 6, 6, '0').rect(10, 18, 12, 14, '0');
  // The keystone and the slime running from it and down the jambs.
  c.rect(14, 1, 4, 5, '8').rect(15, 2, 2, 3, '7');
  c.ellipse(16, 7, 5, 2, '2').hline(13, 18, 6, '3');
  for (const [x, len] of [
    [12, 6],
    [15, 4],
    [19, 7],
    [9, 12],
    [23, 10],
  ] as const) {
    c.vline(x, 8, 8 + len, '2');
    c.set(x, 8 + len, '1');
  }
  c.vline(10, 24, 31, '1').vline(21, 22, 31, '1');
  c.outline();
  return c.rows();
})();

const roots = draw(32, 16, (x, y) => {
  if (y === 0) return 'a';
  if (y === 1) return x % 4 === 0 ? '9' : 'a';
  // strands of varied length swaying a little, every few columns
  for (const [sx, len] of [
    [2, 9],
    [6, 14],
    [11, 6],
    [15, 12],
    [20, 8],
    [24, 15],
    [29, 10],
  ] as const) {
    const sway = Math.round(Math.sin(y / 3 + sx) * 1);
    if (y <= len && x === sx + sway) return y === len ? '9' : 'a';
    if (y <= len - 2 && x === sx + sway + 1) return '9';
  }
  return '.';
});

/**
 * A heap of cavern rock `w` x `h` (the Underworld's hills): a lumpy dome of rust stone, lit on
 * its upper left, cracks and a root wandering across it.
 */
const mound = (w: number, h: number, seed: number): string[] => {
  const c = new Canvas(w, h);
  const cx = w / 2;
  const rx = w / 2 - 1;
  const ry = h - 1;
  c.ellipse(cx, h, rx, ry, (x, y) => {
    const n = hash(x, y, seed);
    // lit along the rim on the upper left, a band a few pixels deep
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - h) / ry) ** 2;
    const lit = d > 0.68 && x + 0.5 < cx + rx * 0.15 && y < h * 0.8;
    if (n < 0.05) return '6';
    return lit ? (n < 0.15 ? '7' : '8') : n < 0.3 ? '6' : '7';
  });
  for (const k of [0.3, 0.65]) c.line(w * k, h * 0.45, w * k + 3, h - 2, '6');
  for (let x = Math.round(w * 0.2); x < w * 0.8; x++) {
    const y = Math.round(h * 0.55 + Math.sin(x / 3 + seed) * 1.5);
    if (c.get(x, y) !== '.') c.set(x, y, 'a');
  }
  return c.outline('6').rows();
};

/** A cluster of stalagmites `w` wide on the floor (the Underworld's bushes), 16 tall. */
const spikes = (w: number, seed: number): string[] => {
  const c = new Canvas(w, 16);
  const n = Math.round(w / 7);
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * w) / n + (hash(i, 0, seed) - 0.5) * 3;
    const tall = 7 + Math.round(hash(i, 1, seed) * 8);
    const half = 2.5 + hash(i, 2, seed) * 1.5;
    c.poly(
      [
        [x - half, 16],
        [x, 16 - tall],
        [x + half, 16],
      ],
      '7',
    );
    c.line(x - half * 0.4, 16 - tall * 0.55, x, 16 - tall + 1, '8');
  }
  return c.outline('6').rows();
};

/** A drift of dim cave mist `w` wide (the Underworld's clouds), 24 tall like a cloud. */
const mist = (w: number, seed: number): string[] =>
  draw(w, 24, (x, y) => {
    const band = Math.sin(x / 5 + seed) * 2 + Math.sin(x / 11 + seed * 2) * 2;
    const d = Math.abs(y - 14 - band);
    const edge = Math.min(x, w - 1 - x);
    if (d > 4 || edge < 2 - d / 2) return '.';
    if (d > 3) return hash(x, y, seed) < 0.5 ? '5' : '.';
    return d < 1.5 && hash(x, y, seed + 1) < 0.25 ? '.' : '4';
  });

export const underworldDecorFrames: Record<string, Rows> = {
  gateway,
  roots,
  // The classic scenery redrawn for the cavern (drawDecor looks up `<frame>@<theme>` first):
  // hills become heaps of rock, bushes stalagmites, clouds a dim drifting mist.
  'hill-big@underworld': mound(80, 48, 1),
  'hill-small@underworld': mound(48, 32, 2),
  'bush-1@underworld': spikes(32, 3),
  'bush-2@underworld': spikes(48, 4),
  'bush-3@underworld': spikes(64, 5),
  'cloud-1@underworld': mist(32, 6),
  'cloud-2@underworld': mist(48, 7),
  'cloud-3@underworld': mist(64, 8),
};
