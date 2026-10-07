import { NES } from '@engine/gfx/palette';

/**
 * Bill's jungle scenery on the decor sheet (registered in decor.ts), drawn in palette
 * `decor-jungle` (the decor sheet's roles: 1-3 greens, 4-5 the cloud slots, here distant
 * mountain blues, 6 dark brown, 7-8 the castle's brick, here concrete greys, 9-a wood, here palm
 * bark and sandbag canvas). Original art in the spirit of an NES jungle stage; the shapes are
 * computed from discs and curves.
 *
 * - `palm` (32x48): a leaning palm, its foot at the bottom centre.
 * - `canopy` (32x16): a clump of jungle crowns; `cloud-1/2/3@contra-jungle` are canopies 32, 48
 *   and 64 wide, so a level's clouds turn into canopy under the jungle theme.
 * - `mountain` (64x32): a distant ridge of two peaks.
 * - `sandbags` (32x16): a low wall of stacked bags.
 * - `searchlight` (32x48): a lamp on a tripod, its beam slanting up and to the left.
 * Each stands on its bottom row (decor is anchored bottom-left).
 */

export const jungleDecorPalette: string[] = [
  NES.black,
  '#004400',
  '#007800',
  NES.green,
  '#4c64a8',
  '#24306c',
  NES.brownDark,
  NES.gray,
  NES.lightGray,
  NES.brown,
  NES.tanDark,
];

type Rows = readonly string[];

const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

const at = (rows: Rows, x: number, y: number): string => rows[y]?.[x] ?? '.';

/** Ring every shape with `edge` in the transparent pixels round it. */
const edged = (rows: Rows, edge: string): string[] =>
  draw(rows[0]?.length ?? 0, rows.length, (x, y) => {
    const c = at(rows, x, y);
    if (c !== '.') return c;
    const near = [at(rows, x - 1, y), at(rows, x + 1, y), at(rows, x, y - 1), at(rows, x, y + 1)];
    return near.some((n) => n !== '.' && n !== edge) ? edge : '.';
  });

/** A clump of round crowns `w` wide: lit on top, shadowed underneath, leaf tips hanging. */
const canopyClump = (w: number, seed: number): string[] => {
  const n = Math.round(w / 11);
  const bumps = Array.from({ length: n }, (_, i) => {
    const cx = 6 + ((w - 12) * (i + 0.5)) / n + (hash(i, 0, seed) - 0.5) * 2;
    const cy = 7.5 + hash(i, 1, seed) * 1.5;
    const r = 6 + hash(i, 2, seed) * 1.2;
    return [cx, cy, r] as const;
  });
  const body = draw(w, 16, (x, y) => {
    let inside = false;
    let lit = false;
    for (const [cx, cy, r] of bumps) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1);
      if (d < r) {
        inside = true;
        if (y + 0.5 < cy - r * 0.35 && x + 0.5 < cx + r * 0.4) lit = true;
      }
    }
    // hanging tips under the clump
    if (!inside && y >= 11 && y <= 13 && x % 5 === 2 && x > 2 && x < w - 3) return '1';
    if (!inside) return '.';
    // dark, so the crowns stay behind the cliffs and girders
    if (lit) return hash(x, y, seed + 5) < 0.2 ? '3' : '2';
    if (y > 10) return '0';
    return hash(x, y, seed + 4) < 0.18 ? '2' : '1';
  });
  return edged(body, '0');
};

const canopy = canopyClump(32, 1);

/** Stamp filled discs along a quadratic curve from (x0,y0) via (cx,cy) to (x1,y1), tapering. */
function stroke(
  grid: string[][],
  [x0, y0]: readonly [number, number],
  [cx, cy]: readonly [number, number],
  [x1, y1]: readonly [number, number],
  width: number,
  colour: (t: number, side: number) => string,
): void {
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const r = width * (1 - t * 0.8);
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > r) continue;
        const row = grid[y];
        if (!row || x < 0 || x >= row.length) continue;
        row[x] = colour(t, y + 0.5 - py);
      }
  }
}

/* The palm: a curving ringed trunk under a crown of drooping fronds and a few coconuts. */
const palm = ((): string[] => {
  const grid = Array.from({ length: 48 }, () => Array.from({ length: 32 }, () => '.'));
  // the trunk, bending gently as it rises
  for (let y = 14; y < 48; y++) {
    const t = (47 - y) / 33;
    const cx = 14 + 3 * t - 1.5 * Math.sin(t * Math.PI);
    for (let x = Math.round(cx - 2); x <= Math.round(cx + 1); x++) {
      const row = grid[y] as string[];
      const k = x - Math.round(cx - 2);
      row[x] = y % 3 === 0 ? '6' : k === 0 ? 'a' : k === 3 ? '6' : '9';
    }
  }
  const crown: [number, number] = [16, 12];
  const fronds: [readonly [number, number], readonly [number, number]][] = [
    [
      [6, 3],
      [1, 17],
    ],
    [
      [11, 1],
      [4, 4],
    ],
    [
      [21, 1],
      [28, 4],
    ],
    [
      [26, 3],
      [31, 17],
    ],
    [
      [9, 9],
      [6, 22],
    ],
    [
      [23, 9],
      [26, 22],
    ],
  ];
  for (const [ctrl, tip] of fronds)
    stroke(grid, crown, ctrl, tip, 2.6, (t, side) =>
      side < -0.3 ? '3' : t > 0.85 ? '1' : side > 0.8 ? '1' : '2',
    );
  // coconuts
  for (const [x, y] of [
    [15, 15],
    [17, 15],
    [16, 16],
  ] as const) {
    const row = grid[y] as string[];
    row[x] = '6';
  }
  const rows = grid.map((r) => r.join(''));
  // the fronds' saw-tooth leaflets: notch the lower edge
  return edged(
    rows.map((r, y) =>
      [...r].map((c, x) => (c === '1' && at(rows, x, y + 1) === '.' && (x + y) % 3 === 0 ? '.' : c)).join(''),
    ),
    '0',
  );
})();

/* Distant mountains: a high peak and a lower one, lit on their left flanks, ridges in shadow. */
const mountain = ((): string[] => {
  const peaks: [number, number, number][] = [
    [12, 20, 1.3],
    [27, 30, 1.15],
    [41, 22, 1.2],
    [55, 15, 1.1],
  ];
  // a ragged skyline: the peaks plus crags, stepped two pixels at a time
  const height = (x: number): number =>
    Math.max(2, ...peaks.map(([px, h, s]) => h - Math.abs(x + 0.5 - px) * s)) +
    (hash(x >> 1, 0, 3) - 0.5) * 2.5 +
    (hash(x >> 2, 1, 5) - 0.5) * 3;
  return draw(64, 32, (x, y) => {
    const top = 32 - height(x);
    if (y + 0.5 < top) return '.';
    if (y + 0.5 < top + 1) return '0';
    // lit where the skyline climbs to the right (the face turned to the upper left)
    const climbing = height(x + 2) > height(x - 2);
    // gullies: a few dark streaks running down from the crags
    if (hash(x, 7, 2) < 0.12 && y > top + 2) return '5';
    if (climbing) return hash(x, y, 9) < 0.08 ? '5' : '4';
    return hash(x, y, 10) < 0.06 ? '4' : '5';
  });
})();

/* Sandbags: three courses of plump bags, staggered. */
const sandbags = draw(32, 16, (x, y) => {
  const course = y < 6 ? 0 : y < 11 ? 1 : 2;
  const top = [1, 6, 11][course] as number;
  const off = course === 1 ? 4 : 0;
  const inset = course === 0 ? 4 : 0;
  if (x < inset || x >= 32 - inset) return '.';
  const bx = (x + off) % 8;
  const by = y - top;
  if (by < 0 || by >= 5) return '.';
  // a plump bag: an ellipse in its 8x5 cell, lit on top, a dark seam where bags meet
  const d = Math.hypot((bx + 0.5 - 4) / 4.1, (by + 0.5 - 2.5) / 2.7);
  if (d > 1) return course === 0 ? '.' : '6';
  if (d > 0.82) return '0';
  if (by === 1 && bx > 1 && bx < 6) return 'a';
  return by >= 3 && bx > 3 ? '6' : '9';
});

/* The searchlight: a tripod, a lamp drum tilted up-left, a dotted beam slanting into the sky. */
const searchlight = draw(32, 48, (x, y) => {
  // the tripod (legs and a centre post)
  if (y >= 36) {
    const legs = [x === 22 - Math.floor((y - 36) / 2), x === 22 + Math.floor((y - 36) / 2), x === 22];
    if (legs.some(Boolean)) return y === 47 ? '0' : '7';
    return '.';
  }
  // the lamp drum, an ellipse tilted to face up-left
  const px = x + 0.5 - 22;
  const py = y + 0.5 - 32;
  const u = (px + py) / Math.SQRT2;
  const v = (py - px) / Math.SQRT2;
  if (Math.abs(u) < 3.2 && Math.abs(v) < 5) {
    if (Math.abs(u) > 2.4 || Math.abs(v) > 4.2) return '0';
    if (u < -1.4) return '8'; // the lens
    return v < 0 ? '7' : '6';
  }
  // the beam: a widening wedge along the up-left diagonal, every other pixel lit
  const along = -(px + py) / Math.SQRT2;
  const across = Math.abs(py - px) / Math.SQRT2;
  if (along > 3 && across < 2 + along * 0.22 && (x + y) % 2 === 0) return along < 14 ? '8' : '4';
  return '.';
});

export const jungleDecorFrames: Record<string, Rows> = {
  palm,
  canopy,
  mountain,
  sandbags,
  searchlight,
  'cloud-1@contra-jungle': canopy,
  'cloud-2@contra-jungle': canopyClump(48, 2),
  'cloud-3@contra-jungle': canopyClump(64, 3),
};
