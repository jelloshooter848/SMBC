import type { MapNode } from '@game/map/types';
import type { Canvas } from './paint';
import { hash } from './paint';
import {
  type AboveGround,
  type AbovePiece,
  FrameBook,
  lazySheet,
  type LazySheetDef,
  roadNames,
  roadSteps,
  shadow,
  space,
  type Sides,
  sideKey,
  water as kitWater,
  type WaterInk,
} from './above-kit';

/*
 * World 2, HYRULE, drawn from above in campaign play (0.4.50, TD52's approved design), in the 3/4 view
 * World 1's Mushroom Kingdom took in 0.4.48 (sprites/kingdom.ts). Laid out like A Link to the
 * Past's light world: the Lost Woods top left, Death Mountain's brown plateau and cliffs across the
 * top, Kakariko Village on the left, Hyrule Castle in its moat in the middle, Link's red-roofed
 * house to its south, the desert and its palace bottom left, the Eastern Palace on its ledge to the
 * east, Lake Hylia bottom right. Original art drawn from shapes; nothing traced.
 *
 * Palette `hyrule-above` (index: role):
 *   0 outline   1-3 grass (dark, mid, light)   4-6 path dirt (dark, mid, light)
 *   7-9 stone (dark, mid, light)   a-c leaves (dark, mid, light)   d trunk
 *   e-g water (dark, mid, light)   h-j red roof (dark, mid, light)   k-m mountain rock (dark, mid, light)
 *   n-o plaster (light, shade)   p-r wood (dark, mid, light)   s gold   t-u sand (light, dark)
 *   v white   w-x blue roof (dark, mid)   y bush pale green   z night (doorways, caves)
 */
export const HYRULE_ABOVE_PALETTE: readonly string[] = [
  '#181410', // 0 outline
  '#2a6a30', // 1 grass dark
  '#48a048', // 2 grass
  '#84cc68', // 3 grass light
  '#745a2c', // 4 dirt dark (0.4.50: green enough to stay tan in the colour-blind modes)
  '#b48c50', // 5 dirt
  '#e4c48c', // 6 dirt light
  '#5c6474', // 7 stone dark
  '#9ca4b4', // 8 stone
  '#dce2ea', // 9 stone light
  '#18442a', // a leaves dark
  '#2a7034', // b leaves
  '#4c9e40', // c leaves light
  '#544220', // d trunk (0.4.50: green enough to stay brown in the colour-blind modes)
  '#24428e', // e water dark
  '#3a70cc', // f water
  '#8cc4f4', // g water light
  '#7a1c20', // h red dark
  '#c43a34', // i red
  '#ec7a5c', // j red light
  '#4a3a24', // k rock dark (green enough to stay brown in the colour-blind modes)
  '#826846', // l rock
  '#b89060', // m rock light
  '#f2e6c6', // n plaster
  '#c8ae84', // o plaster shade
  '#463a14', // p wood dark (green enough to stay brown in the colour-blind modes)
  '#84682c', // q wood
  '#c49c50', // r wood light
  '#f8c838', // s gold
  '#ecd496', // t sand
  '#c4a062', // u sand dark
  '#fcfcfc', // v white
  '#1c3478', // w blue roof dark
  '#3a5cbc', // x blue roof
  '#a8dc80', // y bush pale
  '#100c18', // z night
];

const book = new FrameBook();
const F = book.frames;
const frame = book.frame.bind(book);

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Grass: mid green, small dark blade pairs, light glints (v 0-3); v 4-5 the lighter meadow (','). */
export function grass(v: number): string {
  return frame(`grass-${v}`, 16, 16, (c) => {
    const light = v >= 4;
    c.rect(0, 0, 16, 16, light ? '3' : '2');
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(hash(v, i, 1) * 13) + 1;
      const y = Math.floor(hash(v, i, 2) * 13) + 2;
      c.set(x, y, light ? '2' : '1');
      c.set(x + 2, y, light ? '2' : '1');
      c.set(x + 1, y + 1, light ? '2' : '1');
      c.set(x + 1, y - 1, light ? 'y' : '3');
    }
    for (let i = 0; i < 3; i++)
      c.set(Math.floor(hash(v, i, 3) * 16), Math.floor(hash(v, i, 4) * 16), light ? 'y' : '3');
  });
}

/** Flowers in the grass: white, gold and red blooms (ALttP's meadow flowers). */
export function flowers(v: number): string {
  return frame(`flowers-${v}`, 16, 16, (c) => {
    c.paste(F[grass(v)] as string[]);
    const spots: [number, number][] = [
      [3, 4],
      [11, 3],
      [6, 10],
      [12, 12],
    ];
    spots.forEach(([x, y], i) => {
      if (hash(v, i, 9) < 0.25) return;
      const petal = (['v', 's', 'j'] as const)[Math.floor(hash(v, i, 7) * 3)] as string;
      c.set(x, y + 2, '1');
      c.set(x - 1, y, petal);
      c.set(x + 1, y, petal);
      c.set(x, y - 1, petal);
      c.set(x, y + 1, petal);
      c.set(x, y, petal === 's' ? 'i' : 's');
    });
  });
}

/** Death Mountain's plateau: brown earth, cracks and pebbles. */
export function rockGround(v: number): string {
  return frame(`mountain-${v}`, 16, 16, (c) => {
    c.each((x, y) => {
      const r = hash(x, y, v, 201);
      return r < 0.08 ? 'l' : r > 0.95 ? '6' : 'm';
    });
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash(v, i, 202) * 13) + 1;
      const y = Math.floor(hash(v, i, 203) * 13) + 1;
      c.rect(x, y, 2, 1, 'l');
      c.set(x, y + 1, 'k');
      c.set(x + 1, y - 1, '6');
    }
    // A crack.
    const cx = Math.floor(hash(v, 204) * 10) + 3;
    for (let k = 0; k < 4; k++) c.set(cx + (k % 2), 4 + k * 2, 'k');
  });
}

/** The desert: pale sand in wind ripples, a few dark grains. */
export function sand(v: number): string {
  return frame(`sand-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 't');
    for (let y = 2; y < 16; y += 5)
      for (let x = 0; x < 16; x++) {
        const yy = y + Math.round(Math.sin((x + v * 5) / 2.6) * 1.2);
        c.set(x, yy, 'u');
        if (hash(x, y, v) < 0.5) c.set(x, yy - 1, '6');
      }
    for (let i = 0; i < 4; i++)
      c.set(Math.floor(hash(v, i, 211) * 16), Math.floor(hash(v, i, 212) * 16), 'u');
  });
}

/**
 * The Lost Woods: big round treetops packed so close only their tops show, one a tile, set like
 * bricks (every other row half a tile over) so they join their neighbours. Light from the top
 * left, each crown in clumps of leaves, the gaps between them in deep shade. A woods edge to the
 * south shows the trunks under the last row; an edge to the north the grass behind the first.
 * `odd`: the tile's row is odd (its crowns sit half a tile over).
 */
export function woods(s: Sides, odd: boolean): string {
  return frame(`woods-${sideKey(s)}-${odd ? 1 : 0}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'a');
    const cy = s.s ? 8 : 6;
    if (!s.s) {
      c.rect(0, 10, 16, 6, '2');
      for (const x of odd ? [-1, 15] : [7]) {
        c.rect(x, 9, 3, 6, 'd');
        c.set(x, 9, 'p');
        c.rect(x - 1, 14, 5, 1, '1');
      }
    }
    if (!s.n) c.rect(0, 0, 16, 2, '2');
    const centres = (odd ? [0, 16] : [8]).map((x) => [x, cy] as [number, number]);
    c.each((x, y, now) => {
      let best = 9;
      let dx = 0;
      let dy = 0;
      for (const [px, py] of centres) {
        const ddx = (x + 0.5 - px) / 8.4;
        const ddy = (y + 0.5 - py) / (s.n ? 8.6 : 6.6);
        const d = ddx * ddx + ddy * ddy;
        if (d < best) [best, dx, dy] = [d, ddx, ddy];
      }
      if (best > 1) return now;
      if (best > 0.8) return dx + dy > -0.3 ? '0' : 'a';
      // Leaf clumps: a scallop ring, light on the upper left.
      const ring = best > 0.42 && best < 0.5 && hash(x, y, 225) < 0.7;
      if (dx + dy < -0.55 && best < 0.75) return ring ? 'b' : 'c';
      if (dx + dy > 0.7) return ring ? '0' : 'a';
      if (ring) return 'a';
      return hash(x, y, 226) < 0.1 ? 'c' : 'b';
    });
    if (!s.n) c.outline('0', (_x, y) => y < 3);
  });
}

/**
 * A cliff face (Death Mountain, '^'): rock in rounded columns, lit on their left, banded every few
 * pixels. Its top shows the plateau's lip when the tile above is no cliff, its foot a dark base and
 * the grass's shadow when the tile below is none; its ends round off.
 */
export function cliff(s: Sides, below: 'grass' | 'rock'): string {
  // `below`: the ground round its ends and under its foot (the plateau's earth, or grass).
  return frame(`cliff-${sideKey(s)}-${below}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, below === 'grass' ? '2' : 'm');
    const top = s.n ? 0 : 2;
    const foot = s.s ? 16 : 14;
    const inFace = (x: number, y: number): boolean => {
      if (y < top || y >= foot) return false;
      // Rounded ends.
      if (!s.w && x < 3 && (y - top < 3 - x || foot - 1 - y < 2 - x)) return false;
      if (!s.e && x > 12 && (y - top < x - 12 || foot - 1 - y < x - 13)) return false;
      return true;
    };
    // Boulders packed in the face: each pixel belongs to its nearest seed (the seeds repeat every
    // 16 px, so faces join their neighbours); a crack where two meet, lit on each rock's upper left.
    // Every seed with its copies a tile to each side, flat (the hot loop: 0.4.50 painted it ~4×
    // faster by comparing squared distances and taking roots only of the two nearest).
    const sxs: number[] = [];
    const sys: number[] = [];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) {
        const px = i * 5.3 + 1 + hash(i, j, 232) * 3.5;
        const py = j * 5.3 + 1 + hash(i, j, 233) * 3.5;
        for (const ox of [-16, 0, 16])
          for (const oy of [-16, 0, 16]) {
            sxs.push(px + ox);
            sys.push(py + oy);
          }
      }
    c.each((x, y) => {
      if (!inFace(x, y)) return null;
      let q1 = 99 * 99;
      let q2 = 99 * 99;
      let sx = 0;
      let sy = 0;
      for (let k = 0; k < sxs.length; k++) {
        const ax = (x + 0.5 - (sxs[k] as number)) * 0.8;
        const ay = y + 0.5 - (sys[k] as number);
        const q = ax * ax + ay * ay;
        if (q < q1) {
          q2 = q1;
          q1 = q;
          sx = sxs[k] as number;
          sy = sys[k] as number;
        } else if (q < q2) q2 = q;
      }
      const d1 = Math.sqrt(q1);
      const d2 = Math.sqrt(q2);
      if (d2 - d1 < 1.1) return 'k';
      const lx = x + 0.5 - sx;
      const ly = y + 0.5 - sy;
      if (lx + ly < -2.2) return d1 < 2.6 ? '6' : 'm';
      if (lx + ly > 2.2) return 'k';
      return hash(x, y, 231) < 0.08 ? 'k' : 'l';
    });
    if (!s.n)
      for (let x = 0; x < 16; x++) {
        if (!inFace(x, top)) continue;
        c.set(x, top - 1, 'm');
        c.set(x, top - 2, '6');
        c.set(x, top, 'k');
      }
    if (!s.s) {
      for (let x = 0; x < 16; x++) if (inFace(x, foot - 1)) c.set(x, foot - 1, 'k');
      for (let x = 0; x < 16; x++) if (inFace(x, foot - 1) && below === 'grass') c.set(x, foot, '1');
    }
    c.outline('0', (x, y) => y >= top && y < foot && !inFace(x, y));
  });
}

/**
 * A ledge ('h', ALttP's grass ledges): a grass lip, then a short earth wall in curved strata, its
 * foot in shadow; it rounds off where it ends.
 */
export function ledge(s: Sides, below: 'grass' | 'sand' = 'grass'): string {
  return frame(`ledge-${sideKey(s)}-${below}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, '2');
    if (below === 'sand') c.rect(0, 12, 16, 4, 't');
    const inWall = (x: number, y: number): boolean => {
      if (y < 4 || y > 13) return false;
      if (!s.w && x < 3 && y - 4 < 3 - x) return false;
      if (!s.e && x > 12 && y - 4 < x - 12) return false;
      if (!s.w && x < 2 && y > 11) return false;
      if (!s.e && x > 13 && y > 11) return false;
      return true;
    };
    c.each((x, y) => {
      if (!inWall(x, y)) return null;
      const band = Math.floor((y - 4 + Math.round(Math.sin(x / 2.5) * 1)) / 3);
      if ((y - 4 + Math.round(Math.sin(x / 2.5))) % 3 === 0) return '4';
      return band % 2 ? 'l' : '5';
    });
    // The grass lip over the wall, light along its edge.
    for (let x = 0; x < 16; x++) {
      if (!inWall(x, 5)) continue;
      c.set(x, 3, '3');
      c.set(x, 4, hash(x, 241) < 0.3 ? '3' : '1');
    }
    for (let x = 0; x < 16; x++) if (inWall(x, 13)) c.set(x, 14, below === 'sand' ? 'u' : '1');
    c.outline('0', (_x, y) => y >= 4 && y <= 14);
  });
}

/** Stone stairs cut through a cliff or a ledge, its rock on either side. */
export function stairs(kind: 'cliff' | 'ledge'): string {
  return frame(`stairs-${kind}`, 16, 16, (c) => {
    c.paste(
      F[
        kind === 'cliff'
          ? cliff({ n: false, e: true, s: false, w: true }, 'grass')
          : ledge({ n: false, e: true, s: false, w: true })
      ] as string[],
    );
    const top = kind === 'cliff' ? 1 : 3;
    c.rect(3, top, 10, 15 - top, '7');
    for (let y = top; y < 15; y += 3) {
      c.rect(4, y, 8, 2, '9');
      c.rect(4, y + 2, 8, 1, '8');
    }
    c.rect(3, top, 1, 15 - top, '0');
    c.rect(12, top, 1, 15 - top, '0');
  });
}

/** The band under the header: the woods' canopy (x < 4) or Death Mountain's far peaks, snow on top. */
export function band(x: number, y: number): string {
  if (x < 4) return woods({ n: true, e: true, s: true, w: true }, y % 2 === 1);
  const v = x % 3;
  return frame(`peaks-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'm');
    const peaks: [number, number][] = [
      [3 + v, 3],
      [11 - v, 6],
    ];
    for (const [px, py] of peaks)
      c.each((x, y) => {
        const h = py + Math.abs(x - px) * 1.4;
        if (y < h) return null;
        if (y < h + 2 && y < 9) return 'v';
        return x < px ? 'l' : 'k';
      });
    c.rect(0, 13, 16, 3, 'm');
    for (let x = 0; x < 16; x++) if (hash(x, v, 251) < 0.3) c.set(x, 13, 'l');
  });
}

const HY_WATER: WaterInk = {
  deep: 'e',
  mid: 'f',
  light: 'g',
  land: '2',
  bankLight: '3',
  bank: '1',
  face: '4',
};
export const water = (s: Sides, corners: string, f: number): string =>
  kitWater(book, 'water', s, corners, f, HY_WATER);

/* ---------------------------------------------------------------------------------------------- */
/* Small scenery                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

/** An ALttP round tree, 16×24: a lumpy dark crown on a short trunk (it overhangs the tile above). */
export function tree(): string {
  return frame('tree', 16, 24, (c) => {
    shadow(c, 8, 21, 6, 2.5, '1');
    c.rect(6, 15, 4, 7, 'd');
    c.set(6, 15, 'p');
    c.rect(6, 21, 1, 1, 'p');
    c.ellipse(8, 9, 7.5, 7.5, (x, y, d) => {
      if (d > 0.8) return 'a';
      if (x + y < 12 && d < 0.5) return 'c';
      return hash(x, y, 261) < 0.15 ? 'a' : 'b';
    });
    // Leaf clumps.
    for (const [x, y] of [
      [5, 6],
      [10, 5],
      [8, 11],
    ] as [number, number][])
      c.set(x, y, 'c');
    c.outline('0', (_x, y) => y < 17);
  });
}

/** A light green bush, the kind ALttP lifts: a lumpy pale ball, a few white glints. */
export function bush(v = 0): string {
  return frame(`bush-${v}`, 16, 16, (c) => {
    shadow(c, 8, 12, 7, 3, '1');
    c.ellipse(8, 8.5, 7, 6, (x, y, d) => {
      if (d > 0.8) return 'b';
      if (x + y < 12 && d < 0.5) return 'y';
      return hash(x, y, v, 271) < 0.15 ? 'b' : 'c';
    });
    for (const [x, y] of [
      [4, 5],
      [9, 4],
      [11, 9],
      [6, 10],
    ] as [number, number][])
      c.set(x, y, v === 1 ? 'j' : 'y');
    c.outline('0', (_x, y) => y > 3);
  });
}

/** A boulder: grey on grass, brown on the mountain. */
export function rock(on: 'grass' | 'rock'): string {
  const [dk, md, lt] = on === 'grass' ? ['7', '8', '9'] : ['k', 'l', 'm'];
  return frame(`rock-${on}`, 16, 16, (c) => {
    shadow(c, 8, 12, 6, 2.5, on === 'grass' ? '1' : 'k');
    c.ellipse(8, 9, 6.5, 5.5, (x, y, d) => (d > 0.75 ? dk : x + y < 14 ? lt : md));
    c.set(9, 9, dk);
    c.set(10, 10, dk);
    c.set(6, 7, 'v');
    c.outline('0');
  });
}

/** Wooden stakes in a row (ALttP's pegs), joined to their neighbours. */
export function stakes(s: Sides): string {
  return frame(`stakes-${sideKey(s)}`, 16, 16, (c) => {
    if (s.w || s.e) c.rect(s.w ? 0 : 3, 9, (s.e ? 16 : 13) - (s.w ? 0 : 3), 2, 'q');
    for (const x of [2, 10]) {
      shadow(c, x + 2, 13, 2.5, 1.5, '1');
      c.rect(x, 4, 4, 9, 'r');
      c.rect(x + 3, 4, 1, 9, 'q');
      c.ellipse(x + 2, 4, 2, 1.2, 'q');
      c.set(x + 1, 4, 'r');
    }
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/** Stone wall bricks in rows, light at (x,y) when `lit`. */
function stone(x: number, y: number, lit: boolean, oy = 0): string {
  const row = Math.floor((y + oy) / 4);
  const bx = (x + (row % 2 ? 4 : 0)) % 8;
  if ((y + oy) % 4 === 3 || bx === 0) return '8';
  return lit ? '9' : 'n';
}

/** A blue cone roof with its tip at (cx, top), `h` tall and `hw` half-wide at its base. */
function cone(c: Canvas, cx: number, top: number, h: number, hw: number, flag: string | null): void {
  for (let y = top; y <= top + h; y++) {
    const t = (y - top) / h;
    const w = Math.max(0.5, hw * t);
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) {
      const bandRow = (y - top) % 3 === 2;
      c.set(x, y, y === top + h ? 'w' : bandRow ? 'w' : x < cx - w * 0.3 ? 'g' : 'x');
    }
  }
  if (flag) {
    c.rect(cx, top - 5, 1, 5, '7');
    c.rect(cx + 1, top - 5, 4, 2, flag);
  }
}

/**
 * Hyrule Castle, 64×64, over its moat island: a pale stone curtain wall with battlements and an
 * arched gate (the moat's bridge below it), two round front towers and the tall keep behind under
 * blue roofs, a red banner either side of the gate, gold flags on the roofs.
 */
export function hyruleCastle(): string {
  return frame('hyrule-castle', 64, 64, (c) => {
    shadow(c, 32, 60, 30, 3, '1');
    // The keep behind: a tall block under a hipped blue roof, two turrets.
    c.each((x, y) => (x >= 16 && x <= 47 && y >= 18 && y <= 40 ? stone(x, y, x < 32) : null));
    c.each((x, y) => {
      // Hipped roof: a trapezoid narrowing upward.
      if (y < 8 || y > 18) return null;
      const inset = Math.round((18 - y) * 0.9);
      if (x < 14 + inset || x > 49 - inset) return null;
      if (y === 18) return 'w';
      if ((y - 8) % 3 === 2) return 'w';
      return x < 32 ? 'g' : 'x';
    });
    for (const tx of [19, 44]) {
      c.each((x, y) => (Math.abs(x + 0.5 - tx) <= 3.5 && y >= 10 && y <= 22 ? (x < tx ? '9' : '8') : null));
      cone(c, tx, 2, 9, 4.5, 's');
    }
    for (const wx of [22, 30, 38]) {
      c.rect(wx, 25, 3, 5, 'z');
      c.ellipse(wx + 1.5, 25, 1.5, 1, 'z');
      c.rect(wx, 30, 3, 1, '8');
    }
    // The curtain wall in front, battlements on top.
    c.each((x, y) => (x >= 6 && x <= 57 && y >= 36 && y <= 59 ? stone(x, y, x < 32, 1) : null));
    for (let x = 6; x <= 57; x += 4) c.rect(x, 33, 2, 3, x < 32 ? '9' : 'n');
    c.rect(6, 59, 52, 1, '7');
    // The gate: an arch, a raised portcullis, the dark passage.
    c.ellipse(32, 49, 6, 5, '7');
    c.rect(26, 49, 12, 11, '7');
    c.ellipse(32, 49, 4.5, 4, 'z');
    c.rect(28, 49, 8, 11, 'z');
    for (const x of [29, 32, 35]) c.rect(x, 45, 1, 4, '8');
    c.rect(28, 48, 8, 1, '8');
    // Banners.
    for (const bx of [16, 44]) {
      c.rect(bx, 40, 5, 11, 'i');
      c.rect(bx + 4, 40, 1, 11, 'h');
      c.rect(bx, 40, 5, 1, 's');
      c.set(bx + 2, 51, 'i');
      c.ellipse(bx + 2.5, 45, 1.5, 1.5, 's');
    }
    // Round front towers.
    for (const tx of [7, 56]) {
      c.each((x, y) => {
        if (Math.abs(x + 0.5 - tx) > 6.5 || y < 24 || y > 60) return null;
        return Math.abs(x + 0.5 - tx) > 5 ? '8' : x < tx ? '9' : 'n';
      });
      c.rect(tx - 1, 34, 3, 5, 'z');
      cone(c, tx, 10, 14, 7.5, 's');
    }
    c.outline('0', (_x, y) => y > 0);
  });
}

/** The castle's bridge over the moat (flat, north-south): a stone deck between low curbs. */
export function castleBridge(): string {
  return frame('castle-bridge', 16, 16, (c) => {
    c.each((x, y) => {
      if (x < 2 || x > 13) return null;
      if (x === 2 || x === 13) return '0';
      if (x === 3 || x === 12) return y % 4 === 0 ? '9' : '7';
      return y % 4 === 3 ? '8' : '9';
    });
  });
}

/** A wooden plank bridge, 32×22, east-west over a one-tile river: planks between two rails. */
export function bridge(): string {
  return frame('bridge', 32, 22, (c) => {
    c.each((x, y) => {
      if (y < 5 || y > 17) return null;
      if (y === 17) return 'p';
      return x % 4 === 3 ? 'q' : y === 5 ? 'r' : x % 4 === 0 ? 'r' : 'q';
    });
    for (const ry of [2, 15]) {
      c.rect(0, ry, 32, 2, 'r');
      c.rect(0, ry + 2, 32, 1, 'p');
      for (const px of [0, 15, 29]) {
        c.rect(px, ry - 2, 3, 6, 'q');
        c.rect(px, ry - 2, 3, 1, 'r');
      }
    }
    c.outline('0');
  });
}

/**
 * A house of Kakariko or Link's own, 32×32 (the owner's ALttP close-up: a big roof over a short
 * plaster front): a hipped roof of tiles in `roof` colours with a lighter rim, a dark arched door
 * on its stone step, a small latticed window either side.
 */
export function house(name: string, roof: 'red' | 'blue'): string {
  const [dk, md, lt] = roof === 'red' ? ['h', 'i', 'j'] : ['w', 'x', 'g'];
  return frame(name, 32, 32, (c) => {
    shadow(c, 16, 29, 15, 2.5, '1');
    // The front wall.
    c.each((x, y) =>
      x >= 3 && x <= 28 && y >= 19 && y <= 29 ? (y === 29 ? 'o' : x > 24 ? 'o' : 'n') : null,
    );
    // The door: a dark arch on a step.
    c.ellipse(16, 23, 4, 3, '7');
    c.rect(12, 23, 8, 7, '7');
    c.ellipse(16, 23, 3, 2.2, 'z');
    c.rect(13, 23, 6, 7, 'z');
    c.rect(11, 29, 10, 2, '8');
    c.rect(11, 29, 10, 1, '9');
    // Windows with a lattice.
    for (const wx of [5, 22]) {
      c.rect(wx, 22, 5, 4, 'q');
      c.rect(wx + 1, 23, 3, 2, 'z');
      c.set(wx + 2, 23, 'q');
      c.set(wx + 2, 24, 'q');
    }
    // The roof: hipped, rows of tiles, a light rim, darker to the right and at the eaves.
    c.each((x, y) => {
      if (y < 2 || y > 19) return null;
      const inset = y < 6 ? 6 - y : 0;
      if (x < 1 + inset || x > 30 - inset) return null;
      if (y === 19) return dk;
      if (x === 1 + inset || x === 30 - inset || y === 2) return lt;
      if ((y - 2) % 3 === 2) return dk;
      if ((x + (Math.floor((y - 2) / 3) % 2) * 2) % 4 === 0) return dk;
      return x > 22 ? dk : md;
    });
    // The roof's ridge cap and a round vent (ALttP's houses wear one).
    c.rect(9, 6, 14, 2, lt);
    c.ellipse(16, 11, 2.5, 2, 'o');
    c.set(16, 11, 'p');
    c.outline('0');
  });
}

/** A wooden signpost, 16×16: a board on a post. */
export function sign(): string {
  return frame('sign', 16, 16, (c) => {
    shadow(c, 8, 13, 4, 1.5, '1');
    c.rect(7, 8, 2, 6, 'q');
    c.rect(2, 2, 12, 7, 'r');
    c.rect(2, 8, 12, 1, 'q');
    for (const y of [4, 6]) c.rect(4, y, 8, 1, 'q');
    c.outline('0');
  });
}

/** Kakariko's well, 16×16: a round stone rim, dark water, a little roof on two posts. */
export function well(): string {
  return frame('well', 16, 16, (c) => {
    shadow(c, 8, 13, 6.5, 2, '1');
    c.ellipse(8, 11, 6.5, 3.5, (_x, y, d) => (d > 0.6 ? (y < 11 ? '9' : '8') : 'z'));
    c.rect(2, 3, 1, 9, 'q');
    c.rect(13, 3, 1, 9, 'q');
    c.rect(1, 1, 14, 3, 'i');
    c.rect(1, 3, 14, 1, 'h');
    c.rect(1, 1, 14, 1, 'j');
    c.outline('0');
  });
}

/**
 * The Desert Palace, 48×32: a sandstone front of three bays under a stepped cornice, square
 * columns, a dark doorway at the top of its steps, the desert's own stone.
 */
export function desertPalace(): string {
  return frame('desert-palace', 48, 32, (c) => {
    shadow(c, 24, 29, 22, 2.5, 'u');
    c.each((x, y) =>
      x >= 3 && x <= 44 && y >= 10 && y <= 27
        ? x > 38
          ? 'u'
          : (y + (x % 6 === 0 ? 0 : 1)) % 5 === 0
            ? 'u'
            : '6'
        : null,
    );
    // Stepped cornice.
    for (let k = 0; k < 3; k++) c.rect(3 + k * 4, 8 - k * 3, 42 - k * 8, 3, k % 2 ? 'u' : 't');
    c.rect(19, 0, 10, 3, 'u');
    // Columns.
    for (const x of [6, 14, 31, 39]) {
      c.rect(x, 11, 3, 15, 't');
      c.rect(x + 2, 11, 1, 15, 'u');
      c.rect(x - 1, 10, 5, 1, 'u');
    }
    // The doorway and its steps.
    c.rect(19, 13, 10, 13, 'z');
    c.ellipse(24, 13, 5, 3, 'z');
    for (let k = 0; k < 3; k++) c.rect(17 - k, 26 + k, 14 + k * 2, 1, k % 2 ? 'u' : '6');
    c.outline('0');
  });
}

/**
 * The Eastern Palace, 48×48, on its ledge: pale stone walls round a court, a squat domed hall
 * behind, steps up to a dark arched door, two stone pillars at the foot of the steps.
 */
export function easternPalace(): string {
  return frame('eastern-palace', 48, 48, (c) => {
    shadow(c, 24, 45, 22, 2.5, '1');
    // The hall behind and its dome.
    c.each((x, y) => (x >= 10 && x <= 37 && y >= 12 && y <= 28 ? stone(x, y, x < 24) : null));
    c.ellipse(24, 12, 12, 9, (x, y, d) => (y > 12 ? null : d > 0.8 ? '7' : x < 20 && y < 8 ? '9' : '8'));
    c.rect(23, 1, 2, 3, 's');
    // The court wall in front, its coping light.
    c.each((x, y) => (x >= 2 && x <= 45 && y >= 26 && y <= 43 ? stone(x, y, x < 24, 2) : null));
    c.rect(2, 25, 44, 2, '9');
    c.rect(2, 27, 44, 1, '7');
    // Arched door and steps.
    c.ellipse(24, 33, 5, 4, '7');
    c.rect(19, 33, 10, 11, '7');
    c.ellipse(24, 33, 3.5, 3, 'z');
    c.rect(20, 33, 8, 11, 'z');
    for (let k = 0; k < 3; k++) c.rect(17 - k * 2, 41 + k * 2, 14 + k * 4, 2, k % 2 ? '8' : '9');
    // Pillars.
    for (const x of [8, 37]) {
      c.rect(x, 30, 4, 14, '9');
      c.rect(x + 3, 30, 1, 14, '8');
      c.rect(x - 1, 29, 6, 2, '8');
    }
    c.outline('0');
  });
}

/** Three brown standing stones on the mountain, 32×24 (a rock formation, ALttP has one). */
export function standingStones(): string {
  return frame('standing-stones', 32, 24, (c) => {
    for (const [x, h] of [
      [5, 14],
      [16, 18],
      [26, 12],
    ] as [number, number][]) {
      shadow(c, x, 21, 4.5, 1.8, 'l');
      c.each((px, py) => {
        const dx = Math.abs(px + 0.5 - x);
        if (py > 21 || py < 22 - h || dx > 4 - (py < 25 - h ? 1 : 0)) return null;
        return dx < 1 && px < x ? '6' : px < x ? 'm' : px > x + 2 ? 'k' : 'l';
      });
    }
    c.outline('0');
  });
}

/** A cave mouth in a cliff face, 16×16: a dark arch with a rock rim. */
export function caveMouth(): string {
  return frame('cave-mouth', 16, 16, (c) => {
    c.ellipse(8, 9, 6, 6.5, (_x, _y, d) => (d > 0.65 ? 'k' : 'z'));
    c.rect(2, 9, 12, 7, 'k');
    c.rect(4, 9, 8, 7, 'z');
    c.rect(2, 15, 12, 1, '0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

/**
 * The page's node markers: board spaces with a stone collar (they sit on grass as green as the
 * start's own colour), the Top Secret Area's spot a cave mouth in a mound, and 2-4's palace: a
 * stone tower on Death Mountain, a red banner over its door until cleared, then a gold one.
 */
export function nodeFrames(): Record<string, string> {
  const collar = { dark: '7', light: '9' };
  const ink = (dark: string, body: string, light: string, mark = 'v') => ({
    shadow: '1',
    dark,
    body,
    light,
    mark,
    outline: '0',
  });
  return {
    open: space(book, 'node-open', ink('h', 'i', 'j'), 'none', collar),
    cleared: space(book, 'node-cleared', ink('e', 'f', 'g'), 'star', collar),
    start: space(book, 'node-start', ink('a', 'c', 'y'), 'none', collar),
    secret: space(book, 'node-secret', ink('h', 'j', 'n', 'z'), 'key', collar),
    secretCleared: space(book, 'node-secret-cleared', ink('o', 'n', 'v', 'z'), 'key', collar),
    bonus: secretCave(false),
    bonusCleared: secretCave(true),
    castle: palace(false),
    castleCleared: palace(true),
  };
}

/** The Top Secret Area's spot: a dark cave mouth in a grassy mound; a sparkle until it is found. */
function secretCave(found: boolean): string {
  return frame(found ? 'bonus-cleared' : 'bonus', 16, 16, (c) => {
    c.ellipse(8.5, 10, 7.5, 5, '1');
    c.ellipse(8, 8.5, 7.5, 6, (x, y, d) => (d > 0.8 ? 'b' : x + y < 11 ? '3' : '2'));
    c.ellipse(8, 11, 3.5, 3.5, 'z');
    c.rect(4, 11, 8, 3, 'z');
    c.rect(3, 13, 10, 1, '4');
    if (!found) {
      c.set(13, 2, 'v');
      c.set(12, 3, 's');
      c.set(14, 3, 's');
      c.set(13, 4, 's');
    }
    c.outline('0', (_x, y) => y > 1);
  });
}

/** 2-4's palace, 32×40: a two-tier stone tower on a stepped base, a banner over its door. */
function palace(cleared: boolean): string {
  return frame(cleared ? 'palace-cleared' : 'palace', 32, 40, (c) => {
    shadow(c, 16, 37, 14, 2.5, 'k');
    // Base.
    c.each((x, y) => (x >= 3 && x <= 28 && y >= 24 && y <= 37 ? stone(x, y, x < 16) : null));
    for (let x = 3; x <= 27; x += 4) c.rect(x, 21, 2, 3, x < 16 ? '9' : 'n');
    // Upper tier.
    c.each((x, y) => (x >= 8 && x <= 23 && y >= 10 && y <= 23 ? stone(x, y, x < 16, 2) : null));
    for (let x = 8; x <= 22; x += 3) c.rect(x, 7, 2, 3, x < 16 ? '9' : 'n');
    c.rect(11, 13, 3, 4, 'z');
    c.rect(18, 13, 3, 4, 'z');
    // Flag on top.
    c.rect(15, 0, 1, 8, '7');
    c.rect(16, 0, 7, 4, cleared ? 's' : 'h');
    c.rect(16, 3, 7, 1, cleared ? 'r' : 'z');
    // Door and banner.
    c.ellipse(16, 31, 4, 3.5, 'z');
    c.rect(12, 31, 8, 7, 'z');
    c.rect(13, 25, 6, 3, cleared ? 's' : 'h');
    c.set(16, 26, cleared ? 'v' : 's');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground, worked out once                                                                */
/* ---------------------------------------------------------------------------------------------- */

/** The road's colours: a sandy path, as in World 1. */
const ROAD_INK = { rim: '4', body: '5', light: '6', speck: '4' };

/** The road joins' names, by mask (1 n, 2 e, 4 s, 8 w); painted with the sheet. */
export const HYRULE_ROAD_FRAMES: readonly string[] = roadNames('road');

const WET = new Set(['~', '=', 'I']);
const grounds = new WeakMap<readonly string[], AboveGround>();

/**
 * The ground of a Hyrule page from its tiles (legend, world2-hyrule.ts): grass, meadow, flowers,
 * the mountain's earth ('o'), sand (':'), the woods ('5'), cliffs ('^'), ledges ('h'), stairs
 * ('G'), water ('~', and '=' 'I' under bridges), and the standing scenery on the ground its
 * neighbours have. Cached per tiles.
 */
export function hyruleGround(tiles: readonly string[]): AboveGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const b = groundBuilder(tiles);
  for (let i = 0; i < b.count; i++) b.tile(i);
  grounds.set(tiles, b.out);
  return b.out;
}

/** hyruleGround's steps: one ground tile each (a lazy sheet's prepaint), then the cache. */
function groundSteps(tiles: readonly string[]): (() => void)[] {
  if (grounds.has(tiles)) return [];
  const b = groundBuilder(tiles);
  return [
    ...Array.from({ length: b.count }, (_, i) => () => b.tile(i)),
    () => void (grounds.has(tiles) || grounds.set(tiles, b.out)),
  ];
}

/** Works out a Hyrule page's ground a tile at a time, in row order (`tile(i)`, i < count). */
function groundBuilder(tiles: readonly string[]): {
  count: number;
  tile: (i: number) => void;
  out: AboveGround;
} {
  const ch = (x: number, y: number): string => {
    const yy = Math.max(2, Math.min(tiles.length - 1, y));
    const xx = Math.max(0, Math.min(15, x));
    return tiles[yy]?.[xx] ?? '#';
  };
  const wetAt = (x: number, y: number): boolean => WET.has(ch(x, y));
  /** The ground a scenery tile stands on: the mountain's or the desert's beside them, else grass. */
  const baseAt = (x: number, y: number): 'grass' | 'rock' | 'sand' => {
    const n = [ch(x - 1, y), ch(x + 1, y), ch(x, y - 1), ch(x, y + 1)];
    const grassy = n.filter(
      (c) => c === '#' || c === ',' || c === '*' || '82461397qezc[]nu'.includes(c),
    ).length;
    const count = (k: string) => n.filter((c) => c === k).length;
    if (count('o') > grassy) return 'rock';
    if (count(':') > grassy) return 'sand';
    return 'grass';
  };
  const f0: string[] = [];
  const f1: string[] = [];
  const wet: boolean[] = [];
  const scenery: AbovePiece[] = [];
  const tile = (i: number): void => {
    const x = i & 15;
    const y = i >> 4;
    const c = tiles[y]?.[x] ?? '#';
    const v = Math.floor(hash(x, y, 7) * 4);
    const w = y >= 2 && WET.has(c);
    wet.push(w);
    if (w) {
      const sides: Sides = {
        n: wetAt(x, y - 1),
        e: wetAt(x + 1, y),
        s: wetAt(x, y + 1),
        w: wetAt(x - 1, y),
      };
      let corners = '';
      if (sides.n && sides.w && !wetAt(x - 1, y - 1)) corners += 'a';
      if (sides.n && sides.e && !wetAt(x + 1, y - 1)) corners += 'b';
      if (sides.s && sides.e && !wetAt(x + 1, y + 1)) corners += 'c';
      if (sides.s && sides.w && !wetAt(x - 1, y + 1)) corners += 'd';
      f0.push(water(sides, corners, 0));
      f1.push(water(sides, corners, 1));
      return;
    }
    const same = (k: string) => ({
      n: ch(x, y - 1) === k || (k === '^' && ch(x, y - 1) === 'G'),
      e: ch(x + 1, y) === k || ch(x + 1, y) === 'G',
      s: ch(x, y + 1) === k,
      w: ch(x - 1, y) === k || ch(x - 1, y) === 'G',
    });
    let g: string;
    if (y < 2) g = band(x, y);
    else if (c === '*') g = flowers(v);
    else if (c === ',') g = grass(4 + (v % 2));
    else if (c === 'o') g = rockGround(v);
    else if (c === ':') g = sand(v);
    else if (c === '5')
      g = woods(
        {
          n: ch(x, y - 1) === '5' || y === 2,
          e: ch(x + 1, y) === '5' || x === 15,
          s: ch(x, y + 1) === '5',
          w: ch(x - 1, y) === '5' || x === 0,
        },
        y % 2 === 1,
      );
    else if (c === '^')
      g = cliff(same('^'), [ch(x, y + 1), ch(x - 1, y), ch(x + 1, y)].includes('o') ? 'rock' : 'grass');
    else if (c === 'h') g = ledge(same('h'), ch(x, y + 1) === ':' ? 'sand' : 'grass');
    else if (c === 'G') g = stairs(ch(x - 1, y) === 'h' || ch(x + 1, y) === 'h' ? 'ledge' : 'cliff');
    else {
      const base = 'TRHSC'.includes(c) ? baseAt(x, y) : 'grass';
      g = base === 'rock' ? rockGround(v) : base === 'sand' ? sand(v) : grass(v);
    }
    f0.push(g);
    f1.push(g);
    const stand = (fr: string, dy = 0): void =>
      void scenery.push({ frame: fr, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
    if (c === 'T') stand(tree(), -8);
    else if (c === 'H') stand(bush(0));
    else if (c === 'S') stand(bush(1));
    else if (c === 'R') stand(rock(baseAt(x, y) === 'rock' ? 'rock' : 'grass'));
    else if (c === 'C')
      stand(stakes({ n: false, s: false, w: ch(x - 1, y) === 'C', e: ch(x + 1, y) === 'C' }));
  };
  return { count: tiles.length * 16, tile, out: { frames: [f0, f1], wet, scenery } };
}

/** The node marker for a node on a Hyrule page (kingdom-render.ts kingdomNodeFrame's twin). */
export function hyruleNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean; start?: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'palace-cleared' : 'palace';
  if (kind === 'bonus') return s.cleared ? 'bonus-cleared' : 'bonus';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/**
 * Every frame of the sheet, with the grounds of the pages given, as small painting steps: a frame
 * or a few small ones, a road join, a ground tile (a landmark is one step: it paints as a whole).
 */
function paintSteps(pages: readonly (readonly string[])[]): (() => void)[] {
  const steps: (() => void)[] = [];
  const add = (f: () => unknown): void => void steps.push(() => void f());
  for (let v = 0; v < 6; v++) add(() => grass(v));
  for (let v = 0; v < 4; v++) {
    add(() => flowers(v));
    add(() => rockGround(v));
    add(() => sand(v));
  }
  add(tree);
  add(() => bush(0));
  add(() => bush(1));
  add(() => rock('grass'));
  add(() => rock('rock'));
  add(hyruleCastle);
  add(castleBridge);
  add(bridge);
  add(() => house('link-house', 'red'));
  add(() => house('house-blue', 'blue'));
  add(() => house('house-red', 'red'));
  add(well);
  add(sign);
  add(desertPalace);
  add(easternPalace);
  add(standingStones);
  add(caveMouth);
  add(nodeFrames);
  steps.push(...roadSteps(book, 'road', ROAD_INK));
  for (const tiles of pages) steps.push(...groundSteps(tiles));
  return steps;
}

/**
 * The `hyrule-above` sheet: every frame, with the grounds of the pages given (after autoShore),
 * painted the first time the game draws from it, or ahead of that in slices while a map idles
 * (lazySheet), never when the game loads.
 */
export function hyruleAboveSheet(pages: readonly (readonly string[])[]): LazySheetDef {
  return lazySheet(
    'hyrule-above',
    () => paintSteps(pages),
    () => F,
  );
}

/** How many of the sheet's frames are painted so far (0 until World 2 first shows). */
export const hyrulePainted = (): number => book.size;
