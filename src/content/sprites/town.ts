import type { SpriteDef } from '@engine/gfx/pixelart';
import {
  INDOOR,
  INDOOR_IDS,
  OUTDOOR,
  SCREEN_AT,
  SCREENS,
  type IndoorId,
  type ScreenId,
} from '@content/town/kakariko';
import { Canvas, hash, mirror } from './paint';

/*
 * Kakariko Village's tiles (0.4.41): original art in the spirit of A Link to the Past's towns,
 * soft greens, sandy paths, light paving, red, blue and thatched roofs, round hedges, pink
 * blossom trees; nothing traced. Every cell of the village (src/content/town/kakariko.ts) gets its
 * pictures from its map character and its neighbours (`townArt`): the pieces that join up (paths,
 * paving, hedges, fences, roofs, the pond's banks) are painted for each pattern of neighbours
 * they meet, the rest (trees, the well, the weathervane, benches, the rooms' furniture) are drawn
 * once. The sheet holds exactly the frames the village uses, plus the shut and boarded doors.
 *
 * Palette `town` (index: role):
 *   0 outline    1-3 grass (dark, mid, light)   4-6 path (dark, mid, light)  7-9 paving (mid, light, dark)
 *   a-c leaves (dark, mid, light)   d trunk     e-g water (dark, mid, light)
 *   h-j red roof (dark, mid, light) k-m blue roof (dark, mid, light)  n-o plaster (light, shade)
 *   p-r wood (dark, mid, light)     s-u stone (mid, light, dark)     v-w blossom (light, dark)
 *   x yellow   y red   z white
 * `town-dark` is the same, dimmed (the inn's back room).
 */

export const TOWN_PALETTE: readonly string[] = [
  '#201810', // 0 outline
  '#287838', // 1 grass dark
  '#48a040', // 2 grass
  '#80c858', // 3 grass light
  '#987040', // 4 path dark
  '#c8a060', // 5 path
  '#e8c888', // 6 path light
  '#98a888', // 7 paving
  '#c8d8b8', // 8 paving light
  '#687860', // 9 paving dark
  '#185020', // a leaves dark
  '#2c7a30', // b leaves
  '#58a840', // c leaves light
  '#6c4418', // d trunk
  '#1c4890', // e water dark
  '#3070c8', // f water
  '#80b8f0', // g water light
  '#702020', // h red roof dark
  '#b03830', // i red roof
  '#e06850', // j red roof light
  '#203070', // k blue roof dark
  '#3858b0', // l blue roof
  '#7090e0', // m blue roof light
  '#f0e0b8', // n plaster
  '#c0a070', // o plaster shade
  '#583010', // p wood dark
  '#985820', // q wood
  '#d09048', // r wood light
  '#808080', // s stone
  '#c0c0c0', // t stone light
  '#484848', // u stone dark
  '#f8a8c8', // v blossom
  '#c86890', // w blossom dark
  '#f8e048', // x yellow
  '#e03838', // y red
  '#f8f8f8', // z white
];

/** Every colour at `k` of its brightness (the back room's lamp-lit dimness). */
function dim(p: readonly string[], k: number): string[] {
  return p.map((c) => {
    const n = parseInt(c.slice(1), 16);
    const ch = (s: number) =>
      Math.round(((n >> s) & 255) * k)
        .toString(16)
        .padStart(2, '0');
    return `#${ch(16)}${ch(8)}${ch(0)}`;
  });
}

export const townPalettes: Record<string, string[]> = {
  town: [...TOWN_PALETTE],
  'town-dark': dim(TOWN_PALETTE, 0.62),
};

type Rows = string[];
const FRAMES: Record<string, Rows> = {};

/** Paints frame `name` once (on first use) and returns its name. */
function frame(name: string, paint: (c: Canvas) => void, w = 16, h = 16): string {
  if (!FRAMES[name]) {
    const c = new Canvas(w, h);
    paint(c);
    FRAMES[name] = c.rows();
  }
  return name;
}

/** Four sides joined to the same kind (n, e, s, w), as a 4-letter key ('ne-w'). */
interface Sides {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}
const sideKey = (s: Sides) => `${s.n ? 'n' : '-'}${s.e ? 'e' : '-'}${s.s ? 's' : '-'}${s.w ? 'w' : '-'}`;

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Grass: the mid green with a few dark tufts and light glints, in four variants. */
function grass(v: number, dark = false): string {
  return frame(`grass${dark ? '-dark' : ''}-${v}`, (c) => {
    c.rect(0, 0, 16, 16, dark ? '1' : '2');
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(hash(v, i, 1) * 13) + 1;
      const y = Math.floor(hash(v, i, 2) * 13) + 1;
      const t = dark ? 'a' : '1';
      c.set(x, y, t);
      c.set(x + 2, y, t);
      c.set(x + 1, y + 1, t);
    }
    for (let i = 0; i < 3; i++)
      c.set(Math.floor(hash(v, i, 3) * 16), Math.floor(hash(v, i, 4) * 16), dark ? '2' : '3');
  });
}

/** Little flowers over grass (yellow, white or red, in three arrangements). */
function flowers(v: number): string {
  return frame(`flowers-${v}`, (c) => {
    const spots = [
      [3, 3],
      [10, 6],
      [5, 11],
      [12, 12],
    ];
    spots.forEach(([x, y], i) => {
      if (hash(v, i, 9) < 0.25) return;
      const petal = (['x', 'z', 'y'] as const)[Math.floor(hash(v, i, 7) * 3)] as string;
      const px = (x as number) + Math.floor(hash(v, i, 5) * 2);
      const py = (y as number) + Math.floor(hash(v, i, 6) * 2);
      c.set(px, py + 2, '1');
      c.set(px - 1, py, petal);
      c.set(px + 1, py, petal);
      c.set(px, py - 1, petal);
      c.set(px, py + 1, petal);
      c.set(px, py, petal === 'x' ? 'r' : 'x');
    });
  });
}

/**
 * A sandy path: speckled sand, its edge toward the grass a ragged rim with grass growing over
 * it (`s`: the sides joined to more path).
 */
function path(s: Sides): string {
  return frame(`path-${sideKey(s)}`, (c) => {
    c.each((x, y) => {
      const r = hash(x, y, 11);
      return r < 0.08 ? '4' : r > 0.93 ? '6' : '5';
    });
    edges(c, s, (d, along, side) => {
      const lip = 1 + (hash(along, side, 12) < 0.5 ? 1 : 0);
      if (d < lip) return hash(along, d, side, 13) < 0.15 ? '3' : '2';
      if (d === lip) return '4';
      return null;
    });
  });
}

/** Light paving stones, staggered, with dark grout; a darker border where it meets grass. */
function paving(s: Sides): string {
  return frame(`paving-${sideKey(s)}`, (c) => {
    c.each((x, y) => {
      const row = Math.floor(y / 8);
      const sx = (x + (row % 2 ? 4 : 0)) % 8;
      const sy = y % 8;
      if (sx === 0 || sy === 0) return '9';
      if (sx === 7 || sy === 7) return '7';
      if (sx === 1 && sy === 1) return 'z';
      return '8';
    });
    edges(c, s, (d) => (d === 0 ? '1' : d === 1 ? '9' : null));
  });
}

/**
 * Calls `fn(depth, along, side)` for every pixel within 3 px of each side that is NOT joined
 * (depth 0 at the edge); a returned colour is painted.
 */
function edges(c: Canvas, s: Sides, fn: (d: number, along: number, side: number) => string | null): void {
  const open: [keyof Sides, number][] = [
    ['n', 0],
    ['e', 1],
    ['s', 2],
    ['w', 3],
  ];
  for (const [k, side] of open) {
    if (s[k]) continue;
    for (let d = 0; d < 4; d++)
      for (let a = 0; a < 16; a++) {
        const [x, y] = k === 'n' ? [a, d] : k === 's' ? [a, 15 - d] : k === 'w' ? [d, a] : [15 - d, a];
        const col = fn(d, a, side);
        if (col) c.set(x, y, col);
      }
  }
}

/** The pond: rippling water, a grassy bank and a muddy lip on every side that meets land. */
function water(s: Sides, corners: string, v: number): string {
  return frame(`water-${sideKey(s)}-${corners}-${v}`, (c) => {
    c.rect(0, 0, 16, 16, 'f');
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(v, i, 21) * 12) + 1;
      const y = Math.floor(hash(v, i, 22) * 14) + 1;
      c.rect(x, y, 3, 1, 'g');
      c.set(x + 1, y + 1, 'e');
    }
    const bank = (d: number) => (d === 0 ? '2' : d === 1 ? '1' : d === 2 ? '4' : d === 3 ? 'e' : null);
    edges(c, s, (d) => bank(d));
    // Inner corners: land only diagonally (both sides water), a rounded notch of bank.
    const at: Record<string, [number, number]> = { a: [0, 0], b: [15, 0], c: [15, 15], d: [0, 15] };
    for (const k of corners) {
      const [cx, cy] = at[k] as [number, number];
      c.each((x, y) => {
        const dist = Math.floor(Math.hypot(x - cx, y - cy));
        return dist <= 3 ? bank(dist) : null;
      });
    }
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Trees, hedges, fences, the ledge                                                                */
/* ---------------------------------------------------------------------------------------------- */

/** A big round tree, 32×32 (four cells): a lumpy canopy, shaded below right, its trunk and roots. */
function bigTree(c: Canvas, leaf: [string, string, string], trunk = true): void {
  const [dk, md, lt] = leaf;
  if (trunk) {
    c.ellipse(16, 29.5, 11, 2.5, '1');
    c.rect(13, 22, 6, 8, 'd');
    c.rect(13, 22, 1, 8, 'q');
    c.set(12, 29, 'd');
    c.set(19, 29, 'd');
    c.set(11, 30, 'd');
    c.set(20, 30, 'd');
  }
  const blobs: [number, number, number][] = [
    [16, 12, 12],
    [7.5, 10, 7],
    [24.5, 10, 7],
    [16, 5, 8],
    [9, 17, 7],
    [23, 17, 7],
  ];
  const inCanopy = (x: number, y: number) =>
    blobs.some(([bx, by, r]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= r * r);
  const can = new Canvas(32, 32);
  can.each((x, y) => {
    if (!inCanopy(x, y)) return null;
    // Light from the upper left: lit, mid, shaded bands, with leafy clusters breaking them up.
    const t = (x - 16) * 0.55 + (y - 12) * 0.85 + (hash(x >> 1, y >> 1, 31) - 0.5) * 5;
    if (t > 7) return dk;
    if (t < -8) return lt;
    return md;
  });
  // Leaf clusters: small arcs of light over the mid tone, dark notches in the shade.
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 41) * 28) + 2;
    const y = Math.floor(hash(i, 42) * 22) + 2;
    if (!inCanopy(x, y) || !inCanopy(x + 2, y + 1)) continue;
    const shade = (x - 16) * 0.55 + (y - 12) * 0.85 > 3;
    can.set(x, y, shade ? dk : lt);
    can.set(x + 1, y - 1, shade ? dk : lt);
    can.set(x + 2, y, shade ? dk : lt);
  }
  can.outline('0');
  c.paste(can.rows());
}

/** Tree pieces (`tree-0-0` top-left ... `tree-1-1`), blossom trees (`blossom-...`) and bushes. */
const TREE_FRAMES = ((): void => {
  const t = new Canvas(32, 32);
  bigTree(t, ['a', 'b', 'c']);
  const b = new Canvas(32, 32);
  bigTree(b, ['w', 'v', 'z']);
  // The blossom: a few green leaves peeking out under the flowers.
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(hash(i, 51) * 24) + 4;
    const y = Math.floor(hash(i, 52) * 16) + 6;
    if (b.get(x, y) === 'v') b.set(x, y, 'c');
  }
  for (const [ix, iy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    FRAMES[`tree-${ix}-${iy}`] = t.crop(ix * 16, iy * 16);
    FRAMES[`blossom-${ix}-${iy}`] = b.crop(ix * 16, iy * 16);
  }
})();
void TREE_FRAMES;

/** A small round tree that fills one cell (where a big one does not fit). */
function bush(kind: 'tree' | 'blossom'): string {
  return frame(`${kind}-bush`, (c) => {
    const [dk, md, lt] = kind === 'tree' ? ['a', 'b', 'c'] : ['w', 'v', 'z'];
    c.ellipse(8, 14.5, 6, 1.5, '1');
    c.rect(7, 11, 2, 4, 'd');
    const can = new Canvas(16, 16);
    can.ellipse(8, 7, 7, 6.5, (x, y) => {
      const t = (x - 8) * 0.6 + (y - 7) * 0.9 + (hash(x, y, 61) - 0.5) * 3;
      return t > 3 ? dk : t < -4 ? lt : md;
    });
    can.outline('0');
    c.paste(can.rows());
  });
}

/**
 * A hedge cell: a clipped box of leaves, light on top and darker on its front face; rounded where
 * it ends, open where it joins the next.
 */
function hedge(s: Sides): string {
  return frame(`hedge-${sideKey(s)}`, (c) => {
    const x0 = s.w ? 0 : 1;
    const x1 = s.e ? 15 : 14;
    const y0 = s.n ? 0 : 1;
    const y1 = s.s ? 15 : 13;
    const body = new Canvas();
    body.each((x, y) => {
      if (x < x0 || x > x1 || y < y0 || y > y1) return null;
      // Round the free corners.
      const corner = (cx: number, cy: number, open: boolean) => !open && Math.hypot(x - cx, y - cy) > 3;
      if (!s.n && !s.w && x < x0 + 3 && y < y0 + 3 && corner(x0 + 3, y0 + 3, false)) return null;
      if (!s.n && !s.e && x > x1 - 3 && y < y0 + 3 && corner(x1 - 3, y0 + 3, false)) return null;
      if (!s.s && !s.w && x < x0 + 3 && y > y1 - 3 && corner(x0 + 3, y1 - 3, false)) return null;
      if (!s.s && !s.e && x > x1 - 3 && y > y1 - 3 && corner(x1 - 3, y1 - 3, false)) return null;
      // Front face (the last 4 px when the hedge ends to the south).
      if (!s.s && y > y1 - 4) return (x + y) % 4 === 0 ? 'a' : 'b';
      const leaf = hash(x >> 1, y >> 1, 71);
      return leaf < 0.2 ? 'b' : leaf > 0.85 ? '3' : 'c';
    });
    body.outline('0', (x, y) => x >= 0 && y >= 0);
    if (!s.s) c.ellipse(8, 15, 7, 1.5, '1');
    c.paste(body.rows());
  });
}

/** A wooden fence: rails along the way it runs, a post in the middle. */
function fence(s: Sides): string {
  return frame(`fence-${sideKey(s)}`, (c) => {
    const horiz = s.e || s.w || (!s.n && !s.s);
    if (horiz) {
      const x0 = s.w ? 0 : 6;
      const x1 = s.e ? 15 : 9;
      for (const y of [5, 10]) {
        c.rect(x0, y, x1 - x0 + 1, 1, 'r');
        c.rect(x0, y + 1, x1 - x0 + 1, 1, 'q');
        c.rect(x0, y + 2, x1 - x0 + 1, 1, '1');
      }
    }
    if (s.n || s.s) {
      const y0 = s.n ? 0 : 6;
      const y1 = s.s ? 15 : 9;
      c.rect(7, y0, 1, y1 - y0 + 1, 'r');
      c.rect(8, y0, 1, y1 - y0 + 1, 'q');
      c.rect(9, y0, 1, y1 - y0 + 1, '1');
    }
    // The post.
    c.rect(6, 3, 4, 11, 'q');
    c.rect(6, 3, 1, 11, 'r');
    c.rect(9, 3, 1, 11, 'p');
    c.rect(6, 2, 4, 1, 'r');
    c.rect(6, 14, 4, 1, '1');
    c.set(5, 3, '0');
    c.set(10, 3, '0');
    c.rect(6, 1, 4, 1, '0');
  });
}

/** The ledge's earthen face under a lip of grass (`left`/`right`: where it ends). */
function ledge(left: boolean, right: boolean): string {
  return frame(`ledge-${left ? 'l' : '-'}${right ? 'r' : '-'}`, (c) => {
    c.rect(0, 0, 16, 2, '2');
    c.rect(0, 2, 16, 1, '3');
    c.rect(0, 3, 16, 1, '0');
    c.each((x, y) => {
      if (y < 4 || y > 13) return null;
      const crack = hash(x, 81) < 0.18 && y > 5;
      if (crack) return '4';
      return y === 4 ? '6' : y > 11 ? '4' : '5';
    });
    c.rect(0, 14, 16, 1, '0');
    c.rect(0, 15, 16, 1, '1');
    if (left) {
      c.rect(0, 3, 1, 12, '0');
      c.rect(1, 4, 1, 10, '4');
    }
    if (right) {
      c.rect(15, 3, 1, 12, '0');
      c.rect(14, 4, 1, 10, '4');
    }
  });
}

/** Stone steps up the ledge. */
function stairs(): string {
  return frame('stairs', (c) => {
    c.each((_x, y) => (y % 4 === 3 ? 'u' : y % 4 === 0 ? 'z' : 't'));
    c.rect(0, 0, 1, 16, 'u');
    c.rect(15, 0, 1, 16, 'u');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Buildings                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

const ROOF_COLOURS: Record<string, [string, string, string]> = {
  R: ['h', 'i', 'j'],
  B: ['k', 'l', 'm'],
  Y: ['4', '5', '6'],
};

/** A roof cell: tiles (or thatch) in rows, outlined and lit along its top edge, shaded at the eaves. */
function roof(kind: string, s: Sides): string {
  return frame(`roof-${kind}-${sideKey(s)}`, (c) => {
    const [dk, md, lt] = ROOF_COLOURS[kind] as [string, string, string];
    if (kind === 'Y') {
      c.each((x, y) => {
        const r = hash(x, y >> 2, 91);
        return r < 0.25 ? dk : r > 0.8 ? lt : md;
      });
      for (let y = 3; y < 16; y += 5) c.rect(0, y, 16, 1, dk);
    } else
      c.each((x, y) => {
        const band = Math.floor(y / 4);
        if (y % 4 === 3) return dk;
        if ((x + band * 3) % 6 === 0) return dk;
        return y % 4 === 0 ? lt : md;
      });
    if (!s.n) {
      c.rect(0, 0, 16, 1, '0');
      c.rect(0, 1, 16, 2, lt);
    }
    if (!s.s) {
      c.rect(0, 13, 16, 2, dk);
      c.rect(0, 15, 16, 1, '0');
    }
    if (!s.w) {
      c.rect(0, 0, 1, 16, '0');
      c.rect(1, s.n ? 0 : 1, 1, 15, lt);
    }
    if (!s.e) {
      c.rect(15, 0, 1, 16, '0');
      c.rect(14, s.n ? 0 : 1, 1, 14, dk);
    }
  });
}

/** The front wall under a roof: plaster between timbers, a stone footing. */
function wallBase(c: Canvas, left: boolean, right: boolean): void {
  c.rect(0, 0, 16, 16, 'n');
  c.rect(0, 0, 16, 2, 'p');
  c.rect(0, 2, 16, 1, 'o');
  c.rect(0, 12, 16, 1, 'o');
  c.rect(0, 13, 16, 2, 's');
  c.rect(0, 15, 16, 1, 'u');
  for (let x = 2; x < 16; x += 5) c.set(x, 14, 'u');
  if (left) {
    c.rect(0, 0, 1, 16, '0');
    c.rect(1, 2, 2, 11, 'q');
    c.rect(1, 2, 1, 11, 'r');
  }
  if (right) {
    c.rect(15, 0, 1, 16, '0');
    c.rect(13, 2, 2, 11, 'q');
    c.rect(14, 2, 1, 11, 'p');
  }
}

function wall(left: boolean, right: boolean): string {
  return frame(`wall-${left ? 'l' : '-'}${right ? 'r' : '-'}`, (c) => wallBase(c, left, right));
}

function windowTile(): string {
  return frame('window', (c) => {
    wallBase(c, false, false);
    c.rect(3, 4, 10, 7, 'q');
    c.rect(4, 5, 8, 5, 'e');
    c.rect(4, 5, 3, 2, 'g');
    c.rect(7, 5, 1, 5, 'q');
    c.rect(4, 7, 8, 1, 'q');
    c.rect(3, 11, 10, 1, 'p');
    // A flower box under it.
    c.rect(4, 12, 8, 1, 'y');
    c.set(5, 12, 'x');
    c.set(9, 12, 'z');
  });
}

/** The doorway: a wooden frame round a dark opening, a stone step. */
function doorway(c: Canvas): void {
  wallBase(c, false, false);
  c.rect(3, 2, 10, 14, 'q');
  c.rect(4, 2, 8, 1, 'r');
  c.rect(4, 3, 8, 13, '0');
  c.rect(5, 3, 6, 1, 'p');
  c.rect(2, 15, 12, 1, 't');
}

function door(): string {
  return frame('door', doorway);
}

/** The shop's door, shut until it opens: planks and a latch. */
function doorClosed(): string {
  return frame('door-closed', (c) => {
    doorway(c);
    c.rect(4, 3, 8, 12, 'q');
    for (let x = 5; x < 12; x += 2) c.rect(x, 3, 1, 12, 'r');
    c.rect(4, 7, 8, 1, 'p');
    c.rect(4, 11, 8, 1, 'p');
    c.set(10, 9, 'x');
  });
}

/** A locked door (a later secret): the opening boarded up. */
function doorBoarded(): string {
  return frame('door-boarded', (c) => {
    doorway(c);
    for (let i = 0; i < 9; i++) {
      c.rect(4 + i, 5 + i, 2, 1, 'r');
      c.rect(11 - i, 5 + i, 2, 1, 'q');
    }
    c.rect(3, 9, 10, 2, 'r');
    c.set(4, 9, 'u');
    c.set(11, 9, 'u');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Things                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

function well(): string {
  return frame('well', (c) => {
    c.ellipse(8, 9, 7, 6.5, '1');
    c.ellipse(8, 8, 7, 6.5, (x, y) => ((x + (y >> 1)) % 4 === 0 ? 'u' : y < 6 ? 't' : 's'));
    c.ellipse(8, 8, 4, 3.5, '0');
    c.ellipse(8, 8.5, 3, 2.5, 'e');
    c.set(7, 8, 'g');
    // The crossbar and its rope.
    c.rect(1, 3, 14, 1, 'q');
    c.rect(1, 2, 14, 1, 'r');
    c.rect(8, 4, 1, 4, 'r');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

/** The weathervane (2×2): a stone plinth marked W, E and S (the N fell off), a vane and a hen on top. */
const VANE = ((): void => {
  const c = new Canvas(32, 32);
  c.ellipse(16, 28, 13, 3.5, '1');
  // The plinth.
  c.rect(5, 17, 22, 12, 's');
  c.rect(5, 17, 22, 3, 't');
  c.rect(5, 28, 22, 1, 'u');
  c.rect(4, 17, 1, 12, '0');
  c.rect(27, 17, 1, 12, '0');
  c.rect(4, 16, 24, 1, '0');
  c.rect(4, 29, 24, 1, '0');
  // W ... E ... S on its front (3×5 letters, pale).
  const letter: Record<string, string[]> = {
    W: ['z.z', 'z.z', 'z.z', 'zzz', 'z.z'],
    E: ['zzz', 'z..', 'zz.', 'z..', 'zzz'],
    S: ['.zz', 'z..', '.z.', '..z', 'zz.'],
  };
  c.paste(letter.W as string[], 7, 21);
  c.paste(letter.S as string[], 14, 21);
  c.paste(letter.E as string[], 22, 21);
  // The pole, the arrow, the hen.
  c.rect(15, 4, 2, 13, 'u');
  c.rect(15, 4, 1, 13, 's');
  c.rect(6, 9, 20, 1, 'u');
  c.paste(['u..', 'uu.', 'uuu', 'uu.', 'u..'], 26, 7);
  c.paste(['..u', '.uu', 'uuu'], 4, 8);
  c.paste(['.yy.....', '.uuu..u.', 'uuuuuuu.', '.uuuuu..', '..u.u...'], 12, 0);
  for (const [ix, iy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const)
    FRAMES[`vane-${ix}-${iy}`] = c.crop(ix * 16, iy * 16);
})();
void VANE;

function bench(): string {
  return frame('bench', (c) => {
    c.ellipse(8, 13.5, 7, 1.5, '1');
    c.rect(1, 5, 14, 6, 'r');
    c.rect(1, 7, 14, 1, 'q');
    c.rect(1, 9, 14, 1, 'q');
    c.rect(1, 10, 14, 1, 'p');
    c.rect(2, 11, 2, 2, 'p');
    c.rect(12, 11, 2, 2, 'p');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function sign(): string {
  return frame('sign', (c) => {
    c.ellipse(8, 14.5, 4, 1, '1');
    c.rect(7, 9, 2, 6, 'q');
    c.rect(2, 2, 12, 8, 'r');
    c.rect(2, 9, 12, 1, 'q');
    c.rect(4, 4, 7, 1, 'p');
    c.rect(4, 6, 5, 1, 'p');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function pot(): string {
  return frame('pot', (c) => {
    c.ellipse(8, 14, 5, 1.5, '1');
    c.ellipse(8, 10.5, 5, 4, (x) => (x < 6 ? 'r' : 'q'));
    c.rect(4, 6, 8, 2, 'r');
    c.rect(4, 7, 8, 1, 'p');
    c.paste(['..b.c..', '.cbbbc.', 'bcbcbcb', '.bbcbb.'], 4, 2);
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function barrel(): string {
  return frame('barrel', (c) => {
    c.ellipse(8, 9, 6.5, 6.5, (x, y, d) =>
      d > 0.72 && d < 0.9 ? 'u' : d < 0.25 ? 'r' : (x + y) % 3 === 0 ? 'q' : 'r',
    );
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

const LOG = ((): void => {
  const c = new Canvas(32, 16);
  c.ellipse(16, 14, 14, 1.5, '1');
  c.rect(4, 4, 24, 9, 'q');
  for (let x = 5; x < 28; x += 3) c.set(x, 6 + (x % 2), 'p');
  for (let x = 6; x < 27; x += 4) c.set(x, 10, 'p');
  c.rect(4, 4, 24, 1, 'r');
  c.ellipse(4, 8.5, 3, 4.5, (_x, _y, d) => (d < 0.3 ? 'q' : d < 0.6 ? 'r' : 'q'));
  c.ellipse(28, 8.5, 2, 4.5, 'p');
  const o = Canvas.from(c.rows());
  o.outline('0');
  c.paste(o.rows());
  FRAMES['log-0'] = c.crop(0, 0);
  FRAMES['log-1'] = c.crop(16, 0);
})();
void LOG;

function soil(): string {
  return frame('soil', (c) => c.each((x, y) => (y % 4 === 3 ? '4' : hash(x, y, 101) < 0.1 ? '6' : '5')));
}

function cabbage(): string {
  return frame('cabbage', (c) => {
    c.ellipse(8, 9, 5.5, 4.5, (x, y) => {
      const t = x - 8 + (y - 9) * 1.2;
      return t > 3 ? 'a' : t < -3 ? '3' : 'c';
    });
    c.rect(8, 6, 1, 6, 'b');
    c.set(6, 8, 'b');
    c.set(10, 8, 'b');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function gatePost(): string {
  return frame('gate-post', (c) => {
    c.rect(2, 3, 12, 13, 's');
    c.rect(2, 3, 12, 1, 't');
    for (let y = 7; y < 16; y += 4) c.rect(2, y, 12, 1, 'u');
    for (let y = 4; y < 16; y += 4) c.set(7 + ((y >> 2) % 2) * 3, y, 'u');
    c.rect(1, 0, 14, 3, 't');
    c.rect(1, 2, 14, 1, 's');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Indoors                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

function floor(): string {
  return frame('floor', (c) =>
    c.each((x, y) => {
      if (y % 4 === 3) return 'q';
      const seam = (x + Math.floor(y / 4) * 5) % 16 === 0;
      return seam ? 'q' : hash(x, y, 111) < 0.06 ? 'p' : 'r';
    }),
  );
}

function rug(s: Sides): string {
  return frame(`rug-${sideKey(s)}`, (c) => {
    c.each((x, y) => ((x + y) % 6 === 0 || (x - y + 18) % 6 === 0 ? 'h' : 'y'));
    edges(c, s, (d, a) => (d === 0 ? 'p' : d === 1 ? (a % 2 ? 'x' : 'y') : null));
  });
}

/** The room's walls: the back wall's face (papered, a wainscot), the side and front walls' tops. */
function innerWall(part: string): string {
  return frame(`iwall-${part}`, (c) => {
    const top = () => {
      c.rect(0, 0, 16, 2, '0');
      c.rect(0, 2, 16, 1, 'p');
      c.each((x, y) => (y >= 3 && y < 11 ? (x % 4 === 0 ? 'o' : 'n') : null));
      c.rect(0, 11, 16, 1, 'p');
      c.rect(0, 12, 16, 3, 'q');
      for (let x = 1; x < 16; x += 4) c.rect(x, 12, 1, 3, 'r');
      c.rect(0, 15, 16, 1, 'p');
    };
    const side = (right: boolean) => {
      c.each((x, y) => ((x + y * 3) % 7 === 0 ? 'q' : 'p'));
      c.rect(right ? 3 : 12, 0, 1, 16, '0');
      c.rect(right ? 0 : 13, 0, 3, 16, 'u');
    };
    const bottom = () => {
      c.each((x, y) => ((x * 3 + y) % 7 === 0 ? 'q' : 'p'));
      c.rect(0, 3, 16, 1, '0');
      c.rect(0, 0, 16, 3, 'u');
    };
    switch (part) {
      case 'top':
        top();
        return;
      case 'left':
        side(false);
        return;
      case 'right':
        side(true);
        return;
      case 'bottom':
        bottom();
        return;
      case 'tl':
      case 'tr':
        c.rect(0, 0, 16, 16, 'p');
        c.rect(0, 0, 16, 2, '0');
        c.rect(part === 'tl' ? 12 : 3, 2, 1, 14, '0');
        return;
      case 'bl':
      case 'br':
        c.rect(0, 0, 16, 16, 'p');
        c.rect(part === 'bl' ? 12 : 3, 0, 1, 4, '0');
        c.rect(part === 'bl' ? 13 : 0, 0, 3, 3, 'u');
        c.rect(part === 'bl' ? 12 : 0, 3, 4, 1, '0');
        return;
      default:
        c.rect(0, 0, 16, 16, 'p');
    }
  });
}

/** The way out: a gap in the front wall, a mat on the floor. */
function innerExit(): string {
  return frame('iexit', (c) => {
    c.paste(FRAMES[floor()] as Rows);
    c.rect(0, 0, 2, 16, 'p');
    c.rect(14, 0, 2, 16, 'p');
    c.rect(2, 0, 1, 16, '0');
    c.rect(13, 0, 1, 16, '0');
    c.rect(4, 2, 8, 7, 'y');
    c.rect(5, 3, 6, 5, 'h');
  });
}

function counter(left: boolean, right: boolean): string {
  return frame(`counter-${left ? 'l' : '-'}${right ? 'r' : '-'}`, (c) => {
    c.rect(0, 1, 16, 8, 'r');
    c.rect(0, 1, 16, 1, 'z');
    c.rect(0, 9, 16, 1, 'p');
    c.rect(0, 10, 16, 5, 'q');
    for (let x = 3; x < 16; x += 6) c.rect(x, 10, 1, 5, 'p');
    c.rect(0, 15, 16, 1, '0');
    c.rect(0, 0, 16, 1, '0');
    if (left) c.rect(0, 0, 1, 16, '0');
    if (right) c.rect(15, 0, 1, 16, '0');
  });
}

function table(): string {
  return frame('table', (c) => {
    c.ellipse(8, 11, 6, 3, 'p');
    c.ellipse(8, 8, 6.5, 5, (_x, _y, d) => (d > 0.7 ? 'q' : 'r'));
    c.rect(9, 5, 2, 3, 'z');
    c.set(9, 5, 't');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function stool(): string {
  return frame('stool', (c) => {
    c.ellipse(8, 10.5, 3.5, 2, 'p');
    c.ellipse(8, 9, 3.5, 2.5, 'r');
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

const FIRE = ((): void => {
  const c = new Canvas(32, 16);
  c.each((x, y) => ((x + (y >> 2) * 3) % 6 === 0 || y % 4 === 3 ? 'u' : y < 2 ? 't' : 's'));
  c.rect(6, 4, 20, 12, '0');
  c.rect(8, 12, 16, 2, 'p');
  c.paste(['....y.....y..', '...yxy...yxy.', '..yxzxy.yxzxy', '.yxxzxxyxxzxy', 'yyxxxxxxxxxxy'], 10, 6);
  c.rect(0, 0, 32, 1, '0');
  FRAMES['fire-0'] = c.crop(0, 0);
  FRAMES['fire-1'] = c.crop(16, 0);
})();
void FIRE;

function shelf(): string {
  return frame('shelf', (c) => {
    c.rect(1, 0, 14, 15, 'q');
    c.rect(2, 1, 12, 5, 'p');
    c.rect(2, 8, 12, 5, 'p');
    c.rect(1, 6, 14, 2, 'r');
    c.rect(1, 13, 14, 2, 'r');
    const jars = ['g', 'x', 'y', 'v', 'z', 'c'];
    for (let i = 0; i < 4; i++) {
      c.rect(3 + i * 3, 3, 2, 3, jars[i] as string);
      c.rect(3 + i * 3, 10, 2, 3, jars[(i + 2) % jars.length] as string);
      c.set(3 + i * 3, 2, 't');
      c.set(3 + i * 3, 9, 't');
    }
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function bed(part: 'top' | 'bottom'): string {
  return frame(`bed-${part}`, (c) => {
    if (part === 'top') {
      c.rect(1, 0, 14, 4, 'q');
      c.rect(1, 0, 14, 1, 'r');
      c.rect(2, 4, 12, 12, 'z');
      c.rect(3, 5, 10, 5, 't');
      c.rect(4, 6, 8, 3, 'z');
      c.rect(2, 11, 12, 5, 'l');
      c.rect(2, 11, 12, 1, 'm');
      c.rect(1, 4, 1, 12, 'q');
      c.rect(14, 4, 1, 12, 'q');
    } else {
      c.rect(2, 0, 12, 13, 'l');
      for (let y = 3; y < 13; y += 4) c.rect(2, y, 12, 1, 'k');
      c.rect(2, 0, 1, 13, 'm');
      c.rect(1, 0, 1, 13, 'q');
      c.rect(14, 0, 1, 13, 'q');
      c.rect(1, 13, 14, 2, 'q');
      c.rect(1, 13, 14, 1, 'r');
    }
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

function plant(): string {
  return frame('plant', (c) => {
    c.ellipse(8, 12.5, 4, 3, (x) => (x < 7 ? 'r' : 'q'));
    c.paste(['...c..c...', '.cbc.cbc..', 'cbbbcbbbc.', '.cbbbbbc..', '..cbbbc...', '...bbb....'], 3, 2);
    const o = Canvas.from(c.rows());
    o.outline('0');
    c.paste(o.rows());
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* The village, cell by cell                                                                       */
/* ---------------------------------------------------------------------------------------------- */

const COLS = 48;
const ROWS = 22;

/** The whole village's outdoor map as one 48×22 grid (outside it: the nearest cell, so edges run on). */
function outdoorAt(col: number, row: number): string {
  const c = Math.max(0, Math.min(COLS - 1, col));
  const r = Math.max(0, Math.min(ROWS - 1, row));
  const screen = SCREENS.find(
    (s) => SCREEN_AT[s][0] === Math.floor(c / 16) && SCREEN_AT[s][1] === Math.floor(r / 11),
  ) as ScreenId;
  return (OUTDOOR[screen][r % 11] as string)[c % 16] as string;
}

const WALKWAY = new Set([',', ':', 'D', '=']);
const WALLISH = new Set(['W', 'w', 'D']);

function sidesWhere(
  at: (c: number, r: number) => string,
  col: number,
  row: number,
  ok: (ch: string) => boolean,
): Sides {
  return {
    n: ok(at(col, row - 1)),
    e: ok(at(col + 1, row)),
    s: ok(at(col, row + 1)),
    w: ok(at(col - 1, row)),
  };
}

/** Which of a 2×2 thing's quarters a cell is, by its neighbours of the same kind. */
function quarter(
  at: (c: number, r: number) => string,
  col: number,
  row: number,
  ch: string,
): [number, number] {
  return [at(col - 1, row) === ch ? 1 : 0, at(col, row - 1) === ch ? 1 : 0];
}

/** One outdoor cell's pictures (global village coordinates). */
function outdoorCell(col: number, row: number): string[] {
  const at = outdoorAt;
  const ch = at(col, row);
  const v = Math.floor(hash(col, row, 7) * 4);
  const ground = grass(v);
  switch (ch) {
    case '*':
      return [ground, flowers(Math.floor(hash(col, row, 8) * 3))];
    case ',':
      return [path(sidesWhere(at, col, row, (c) => WALKWAY.has(c)))];
    case ':':
      return [paving(sidesWhere(at, col, row, (c) => c === ':' || c === '='))];
    case '=':
      return [stairs()];
    case 'T': {
      // Forest in 2×2 trees on the village's even grid; a cell that can't join one is a bush.
      const ax = col - (col % 2);
      const ay = row - (row % 2);
      const whole = [0, 1].every((dx) => [0, 1].every((dy) => at(ax + dx, ay + dy) === 'T'));
      return [grass(v, true), whole ? `tree-${col - ax}-${row - ay}` : bush('tree')];
    }
    case 'P': {
      const ax = col - (col % 2);
      const ay = row - (row % 2);
      const whole = [0, 1].every((dx) => [0, 1].every((dy) => at(ax + dx, ay + dy) === 'P'));
      return [ground, whole ? `blossom-${col - ax}-${row - ay}` : bush('blossom')];
    }
    case 'h':
      return [ground, hedge(sidesWhere(at, col, row, (c) => c === 'h'))];
    case 'f':
      return [ground, fence(sidesWhere(at, col, row, (c) => c === 'f'))];
    case '^':
      return [ledge(at(col - 1, row) !== '^', at(col + 1, row) !== '^')];
    case '~': {
      const wet = (c: string) => c === '~';
      const s = sidesWhere(at, col, row, wet);
      let corners = '';
      if (s.n && s.w && !wet(at(col - 1, row - 1))) corners += 'a';
      if (s.n && s.e && !wet(at(col + 1, row - 1))) corners += 'b';
      if (s.s && s.e && !wet(at(col + 1, row + 1))) corners += 'c';
      if (s.s && s.w && !wet(at(col - 1, row + 1))) corners += 'd';
      return [water(s, corners, Math.floor(hash(col, row, 9) * 3))];
    }
    case 'R':
    case 'B':
    case 'Y':
      return [
        roof(
          ch,
          sidesWhere(at, col, row, (c) => c === ch),
        ),
      ];
    case 'W':
      return [wall(!WALLISH.has(at(col - 1, row)), !WALLISH.has(at(col + 1, row)))];
    case 'w':
      return [windowTile()];
    case 'D':
      return [door()];
    case 'o':
      return [ground, well()];
    case 'V': {
      const [qx, qy] = quarter(at, col, row, 'V');
      return [ground, `vane-${qx}-${qy}`];
    }
    case 'b':
      return [ground, bench()];
    case 's':
      return [ground, sign()];
    case 'l':
      return [ground, `log-${at(col - 1, row) === 'l' ? 1 : 0}`];
    case 'p':
      return [ground, pot()];
    case 'v':
      return [soil(), cabbage()];
    case 'g':
      return [ground, gatePost()];
    case 'k':
      return [ground, barrel()];
    default:
      return [ground];
  }
}

/** One indoor cell's pictures. */
function indoorCell(map: readonly string[], col: number, row: number): string[] {
  const at = (c: number, r: number) => (map[r] as string | undefined)?.[c] ?? '#';
  const ch = at(col, row);
  const last = map.length - 1;
  const right = (map[0]?.length ?? 16) - 1;
  if (row === 0) return [innerWall(col === 0 ? 'tl' : col === right ? 'tr' : 'top')];
  if (row === last) {
    if (ch === 'D') return [innerExit()];
    return [innerWall(col === 0 ? 'bl' : col === right ? 'br' : 'bottom')];
  }
  if (col === 0) return [innerWall('left')];
  if (col === right) return [innerWall('right')];
  const f = floor();
  switch (ch) {
    case ':':
      return [rug(sidesWhere(at, col, row, (c) => c === ':'))];
    case 'b':
      return [f, stool()];
    case 't':
      return [f, table()];
    case '=':
      return [f, counter(at(col - 1, row) !== '=', at(col + 1, row) !== '=')];
    case 'F':
      return [f, `fire-${at(col - 1, row) === 'F' ? 1 : 0}`];
    case 'j':
      return [f, shelf()];
    case 'z':
      return [f, bed(at(col, row - 1) === 'z' ? 'bottom' : 'top')];
    case 'k':
      return [f, barrel()];
    case 'y':
      return [f, plant()];
    case '#':
      return [innerWall('block')];
    default:
      return [f];
  }
}

/** Every room's art, reading order. */
const ART: Record<string, string[][]> = {};
for (const s of SCREENS) {
  const [gx, gy] = SCREEN_AT[s];
  const cells: string[][] = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 16; c++) cells.push(outdoorCell(gx * 16 + c, gy * 11 + r));
  ART[s] = cells;
}
for (const id of INDOOR_IDS) {
  const map = INDOOR[id as IndoorId];
  const cells: string[][] = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 16; c++) cells.push(indoorCell(map, c, r));
  ART[id] = cells;
}
doorClosed();
doorBoarded();

/** The art layer for a village room (src/game/town/village.ts). */
export function townArt(room: string): readonly (readonly string[] | null)[] | undefined {
  return ART[room];
}

/** The village's tile sheet: exactly the frames its rooms use, and the shut doors. */
export const townDef: SpriteDef = { palette: 'town', frames: FRAMES };

/** (For the art test: every frame a room uses is on the sheet.) */
export const TOWN_MIRROR = mirror;
