import { NES } from '@engine/gfx/palette';

/**
 * Bill's jungle scenery on the decor sheet (registered in decor.ts), drawn in palette
 * `decor-jungle` (the decor sheet's roles: 1-3 greens, 4-5 the cloud slots, here night blues for
 * mountains and clouds, 6 dark brown, 7-8 the castle's brick, here concrete greys, 9-a wood, here
 * olive drab and khaki for palm bark and sandbag canvas). Original art in the spirit of an NES
 * jungle stage; the shapes are computed from discs and curves.
 *
 * These frames are drawn for `decor-jungle` (themes `contra-jungle` and `contra-falls`) and only
 * look right there: in another theme's decor palette the same indices give daylight cloud
 * whites and castle bricks. Place them in jungle levels only.
 *
 * - `palm` (32x48): a palm, its foot at the bottom centre. Needs ground under it.
 * - `canopy` (32x16): a clump of jungle crowns (for a cliff top or a ledge, not open sky).
 * - `canopy-hang` (32x16): the foliage ceiling, its top row solid leaves, leaf tips and vines
 *   hanging down. Place it at row 0 (`canopy-hang x 0`: anchored bottom-left like all decor, so
 *   it covers the top tile row) every 2 columns: its left and right edges join into one ceiling.
 * - `mountain` (64x32): a distant ridge of snow-capped peaks. Needs ground (or the screen's
 *   bottom) under it.
 * - `jungle-band` (32x32) / `jungle-band-half` (its left 16 columns): palms and undergrowth along
 *   a cliff top or the ground; pieces side by side join up. Needs ground under it.
 * - `jungle-trunks` (32x32): a wall of dark trunks for behind the later tiers; tiles both ways.
 * - `sandbags` (32x16): a low wall of olive canvas bags, background only.
 * - `searchlight` (32x48): a lamp on a tripod, its beam slanting up and to the left.
 * - `cloud-1/2/3@contra-jungle` (32, 48, 64 x16): low dim night clouds; drawDecor uses them for a
 *   level's `cloud-*` under the jungle theme, so the sky keeps its clouds, darkened.
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
  // olive drab and khaki: canvas and bark, dim so they stay behind the rock and bricks
  '#4c5018',
  '#7c7c3c',
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

/* The foliage ceiling: a solid band of dark leaves, ragged tips and a few vines hanging from it.
   Periodic in x (32 px), so a row of them joins up. */
const canopyHang = ((): string[] => {
  const tip = (x: number) => 4 + Math.round(3 * Math.abs(Math.sin((x * Math.PI) / 8)) + hash(x, 0, 21) * 2);
  const vine = (x: number) => x === 5 || x === 19 || x === 27;
  return draw(32, 16, (x, y) => {
    const len = tip(x);
    if (vine(x) && y <= 14) return y % 3 === 1 ? '3' : '2';
    if (y > len) return '.';
    if (y === len) return '0';
    if (y === len - 1) return hash(x, y, 22) < 0.5 ? '2' : '1';
    return hash(x, y, 23) < 0.15 ? '2' : '1';
  });
})();

/* A low night cloud (`w` wide): dim navy with a lighter rim on top, a flat bottom, a star or two
   in the sky round it. */
const nightCloud = (w: number, seed: number): string[] => {
  const n = Math.max(2, Math.round(w / 12));
  const bumps = Array.from({ length: n }, (_, i) => {
    const cx = 6 + ((w - 12) * (i + 0.5)) / n + (hash(i, 0, seed) - 0.5) * 3;
    const r = 3.5 + hash(i, 2, seed) * 2.5;
    return [cx, 12 - r * 0.6, r] as const;
  });
  return draw(w, 16, (x, y) => {
    const inside = (xx: number, yy: number) =>
      yy <= 12 &&
      yy >= 0 &&
      (bumps.some(([cx, cy, r]) => Math.hypot(xx + 0.5 - cx, (yy + 0.5 - cy) * 1.3) < r) ||
        (yy >= 10 && xx >= 3 && xx < w - 3));
    if (inside(x, y)) return inside(x, y - 1) ? '5' : '4';
    if (y < 6 && hash(x, y, seed + 9) < 0.006) return '8';
    return '.';
  });
};

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

/* Distant mountains: pale snow-capped peaks (the snow down their upper slopes in a ragged line),
   blue-grey rock below, lit on their left flanks, ridges in shadow. */
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
    // the snow: down the upper slopes to a ragged line, lit white-grey, shadowed grey
    const snow = 32 - height(x) + 6 + Math.round(hash(x >> 1, 3, 11) * 4) + Math.max(0, 6 - height(x) / 3);
    if (y + 0.5 < snow && 32 - height(x) < 22) return climbing ? '8' : '7';
    // gullies: a few dark streaks running down from the crags
    if (hash(x, 7, 2) < 0.12 && y > top + 2) return '5';
    if (climbing) return hash(x, y, 9) < 0.08 ? '5' : '4';
    return hash(x, y, 10) < 0.06 ? '4' : '5';
  });
})();

/* The jungle band (32x32, repeating along a cliff top): a row of palms, their fronds fanning
   out over trunks that reach down into a dense undergrowth. Periodic in x: pieces join up. */
const jungleBand = ((): string[] => {
  const W = 32;
  const wrap = (dx: number) => {
    const a = ((dx % W) + W) % W;
    return a > W / 2 ? a - W : a;
  };
  const crowns: [number, number, number][] = [
    [7, 7, 10],
    [22, 5, 11],
  ];
  const body = draw(W, 32, (x, y) => {
    // the undergrowth along the foot: overlapping round bushes
    for (let i = 0; i < 5; i++) {
      const cx = i * 8 + 3;
      const cy = 27 + hash(i, 0, 31) * 2;
      const d = Math.hypot(wrap(x + 0.5 - cx), (y + 0.5 - cy) * 1.2);
      if (d < 5.5) return y + 0.5 < cy - 2 && hash(x, y, 32) < 0.5 ? '3' : hash(x, y, 33) < 0.25 ? '1' : '2';
    }
    // the fronds: long leaves fanning out and drooping from each crown
    for (const [cx, cy, r] of crowns) {
      const dx = wrap(x + 0.5 - cx);
      const dy = y + 0.5 - cy;
      const a = Math.atan2(dy - Math.abs(dx) * 0.25, dx);
      const reach = r * (0.55 + 0.45 * Math.abs(Math.cos(a * 3.5)));
      if (Math.hypot(dx, dy * 1.6) < reach && dy < 6) {
        if (dy < -1 && dx < 2) return hash(x, y, 34) < 0.3 ? '2' : '3';
        return dy > 2 ? '1' : '2';
      }
    }
    // the trunks: ringed, lit on one side
    for (const [cx] of crowns) {
      const dx = wrap(x + 0.5 - cx);
      if (y > 8 && Math.abs(dx) < 1.6) return y % 3 === 0 ? '0' : dx < 0 ? 'a' : '9';
    }
    return '.';
  });
  return edged(body, '0');
})();

/* A wall of dark jungle trunks (32x32) for behind the later tiers: trunks of a few widths, lit
   faintly on one edge, black between them. Tiles both ways. */
const jungleTrunks = draw(32, 32, (x) => {
  const trunks: [number, number][] = [
    [1, 5],
    [9, 3],
    [15, 6],
    [24, 4],
  ];
  for (const [l, w] of trunks) if (x >= l && x < l + w) return x === l ? '9' : x === l + w - 1 ? '0' : '6';
  return '0';
});

/* Sandbags: three courses of plump olive canvas bags, staggered, dark seams between. */
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
  if (d > 1) return course === 0 ? '.' : '0';
  if (d > 0.82) return '0';
  if (by === 1 && bx > 1 && bx < 6) return 'a';
  return by >= 3 ? '1' : '9';
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
  'canopy-hang': canopyHang,
  mountain,
  'jungle-band': jungleBand,
  'jungle-band-half': jungleBand.map((r) => r.slice(0, 16)),
  'jungle-trunks': jungleTrunks,
  sandbags,
  searchlight,
  'cloud-1@contra-jungle': nightCloud(32, 1),
  'cloud-2@contra-jungle': nightCloud(48, 2),
  'cloud-3@contra-jungle': nightCloud(64, 3),
};
