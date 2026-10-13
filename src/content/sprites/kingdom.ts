import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, hash } from './paint';

/*
 * The Mushroom Kingdom from above (0.4.48, campaign play): World 1's map page drawn in the 3/4 view
 * of Kakariko Village (src/content/sprites/town.ts), brighter and rounder for Mario: soft grass,
 * sandy roads, a river with sandy banks, a stone bridge, Peach's Castle over a round plaza, Toad
 * houses with spotted caps, Mario's red-roofed house, round bushes, pines and little mushrooms, and
 * the page's node markers (board spaces, the warp spot's pipe mouth, Bowser's fort). Original art
 * drawn from shapes here; nothing traced.
 *
 * Format: the game's SpriteDef (rows of palette chars, '.' see-through), palette `kingdom`. Every
 * frame is painted once from code with the same Canvas Kakariko uses. The page's ground grid
 * (kingdomGround) is worked out once per page from its tiles, painting the river and hedge pieces
 * its neighbours ask for; the sheet holds exactly those plus every road join.
 *
 * Palette `kingdom` (index: role):
 *   0 outline     1-3 grass (dark, mid, light)    4-6 road dirt (dark, mid, light)
 *   7-9 stone (dark, mid, light)    a-c leaves (dark, mid, light)    d trunk
 *   e-g water (dark, mid, light; also the blue Toad cap)    h-j red (dark, mid, light)
 *   k-m green cap (dark, mid, light)    n-o cream plaster (light, shade)    p-r wood (dark, mid, light)
 *   s gold   t pink   u pink dark   v white   w-x iron (dark, mid: Bowser's fort)   y orange   z night
 */
export const KINGDOM_PALETTE: readonly string[] = [
  '#1c1410', // 0 outline
  '#2a7a30', // 1 grass dark
  '#4caa3c', // 2 grass
  '#8ad458', // 3 grass light
  '#a0703c', // 4 dirt dark
  '#d4a868', // 5 dirt
  '#f0d498', // 6 dirt light
  '#707a90', // 7 stone dark
  '#aab4c4', // 8 stone
  '#e0e6ee', // 9 stone light
  '#1a5226', // a leaves dark
  '#2e8c36', // b leaves
  '#62c44a', // c leaves light
  '#6a4218', // d trunk
  '#2a5cbc', // e water dark
  '#4a94ea', // f water
  '#a8dcfa', // g water light
  '#901c18', // h red dark
  '#dc3a28', // i red
  '#fa7c5c', // j red light
  '#14803a', // k green cap dark
  '#30b850', // l green cap
  '#8ce870', // m green cap light
  '#f6e8c8', // n plaster
  '#cdb088', // o plaster shade
  '#5a3212', // p wood dark
  '#9a5a22', // q wood
  '#d69a52', // r wood light
  '#f8c830', // s gold
  '#f8a8c8', // t pink
  '#c8608c', // u pink dark
  '#fcfcfc', // v white
  '#404650', // w iron dark
  '#68707c', // x iron
  '#f08830', // y orange
  '#141020', // z night (doorways)
];

export const kingdomPalettes: Record<string, string[]> = { kingdom: [...KINGDOM_PALETTE] };

/** The woods' dark leaves: the page's background colour (the map's sky), seen only in a slide. */
export const KINGDOM_CANOPY = KINGDOM_PALETTE[10] as string;

type Rows = string[];
const FRAMES: Record<string, Rows> = {};

/** Paints frame `name` once and returns its name (the town sheet's pattern). */
function frame(name: string, w: number, h: number, paint: (c: Canvas) => void): string {
  if (!FRAMES[name]) {
    const c = new Canvas(w, h);
    paint(c);
    FRAMES[name] = c.rows();
  }
  return name;
}

/** Sides joined to more of the same (roads, water, hedges), as 'nesw' with '-' for open. */
export interface Sides {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}
export const sideKey = (s: Sides): string =>
  `${s.n ? 'n' : '-'}${s.e ? 'e' : '-'}${s.s ? 's' : '-'}${s.w ? 'w' : '-'}`;

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Grass in four variants: mid green, little dark blade pairs, a few light glints. */
export function grass(v: number): string {
  return frame(`grass-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, '2');
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(hash(v, i, 1) * 13) + 1;
      const y = Math.floor(hash(v, i, 2) * 13) + 2;
      c.set(x, y, '1');
      c.set(x + 2, y, '1');
      c.set(x + 1, y + 1, '1');
      c.set(x + 1, y - 1, '3');
    }
    for (let i = 0; i < 3; i++) c.set(Math.floor(hash(v, i, 3) * 16), Math.floor(hash(v, i, 4) * 16), '3');
  });
}

/** Little flowers in the grass: white, gold and pink four-petal blooms. */
export function flowers(v: number): string {
  return frame(`flowers-${v}`, 16, 16, (c) => {
    c.paste(FRAMES[grass(v)] as Rows);
    const spots: [number, number][] = [
      [3, 4],
      [10, 3],
      [6, 10],
      [12, 11],
    ];
    spots.forEach(([x, y], i) => {
      if (hash(v, i, 9) < 0.3) return;
      const petal = (['v', 's', 't'] as const)[Math.floor(hash(v, i, 7) * 3)] as string;
      c.set(x, y + 2, '1');
      c.set(x - 1, y, petal);
      c.set(x + 1, y, petal);
      c.set(x, y - 1, petal);
      c.set(x, y + 1, petal);
      c.set(x, y, petal === 's' ? 'y' : 's');
    });
  });
}

/**
 * A sandy road, about ten pixels wide down the middle of its tile and out through every joined
 * side: speckled dirt, a dark rim where it meets the grass, light grains along its top edge. The
 * map's roads are drawn with it as they open (a road nobody has opened is just grass).
 */
export function road(s: Sides): string {
  return frame(`road-${sideKey(s)}`, 16, 16, (c) => {
    const lo = 3;
    const hi = 12;
    const inside = (x: number, y: number): boolean => {
      const core = x >= lo && x <= hi && y >= lo && y <= hi;
      const ns = x >= lo && x <= hi && ((s.n && y < lo) || (s.s && y > hi));
      const ew = y >= lo && y <= hi && ((s.w && x < lo) || (s.e && x > hi));
      // Round the core's open corners off a little.
      const corner =
        (x === lo || x === hi) &&
        (y === lo || y === hi) &&
        !(y === lo ? s.n : s.s) &&
        !(x === lo ? s.w : s.e);
      return (core && !corner) || ns || ew;
    };
    c.each((x, y) => {
      if (!inside(x, y)) {
        const r = hash(x, y, 31);
        return r < 0.06 ? '1' : r > 0.96 ? '3' : '2';
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1);
      if (edge) return '4';
      if (!inside(x, y - 1)) return '6';
      const r = hash(x, y, 32);
      return r < 0.07 ? '4' : r > 0.92 ? '6' : '5';
    });
  });
}

/** Ripples on a water tile for animation frame `f` (two frames, out of step across tiles). */
function ripples(c: Canvas, f: number, seed: number): void {
  for (let i = 0; i < 3; i++) {
    const x = (Math.floor(hash(seed, i, 41) * 12) + f * 2) % 13;
    const y = Math.floor(hash(seed, i, 42) * 13) + 1;
    c.rect(x, y, 3, 1, 'g');
    c.set(x + 1, y + 1, 'e');
  }
}

/**
 * The river: blue water with drifting ripples; on every side that meets land a bank, grass, then
 * sand, then a dark waterline (inner corners get a rounded notch of the same bank).
 * `corners`: the diagonals that are land although both sides beside them are water ('a' NW, 'b'
 * NE, 'c' SE, 'd' SW).
 */
export function water(s: Sides, corners: string, f: number): string {
  return frame(`water-${sideKey(s)}-${corners}-${f}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'f');
    ripples(c, f, s.w ? 1 : 2);
    const bank = (d: number, along: number): string | null => {
      const lip = hash(along, 51) < 0.5 ? 0 : 1;
      if (d < 1 + lip) return '2';
      if (d < 3 + lip) return d === 1 + lip ? '6' : '5';
      if (d === 3 + lip) return 'e';
      return null;
    };
    const sides: [keyof Sides, (d: number, a: number) => [number, number]][] = [
      ['n', (d, a) => [a, d]],
      ['s', (d, a) => [a, 15 - d]],
      ['w', (d, a) => [d, a]],
      ['e', (d, a) => [15 - d, a]],
    ];
    for (const [k, at] of sides) {
      if (s[k]) continue;
      for (let d = 0; d < 5; d++)
        for (let a = 0; a < 16; a++) {
          const col = bank(d, a + (k === 'n' || k === 's' ? 0 : 100));
          const [x, y] = at(d, a);
          if (col) c.set(x, y, col);
        }
    }
    const at: Record<string, [number, number]> = { a: [0, 0], b: [15, 0], c: [15, 15], d: [0, 15] };
    for (const k of corners) {
      const [cx, cy] = at[k] as [number, number];
      c.each((x, y) => {
        const d = Math.floor(Math.hypot(x - cx, y - cy));
        return d < 5 ? bank(d, 7) : null;
      });
    }
  });
}

/** The page's top edge: the woods' canopy (the 8 px under the header), dark lumpy leaves. */
export function canopy(v: number): string {
  return frame(`canopy-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'a');
    for (let i = 0; i < 3; i++) {
      const cx = Math.floor(hash(v, i, 61) * 16);
      c.ellipse(cx, 9 + hash(v, i, 62) * 3, 5, 4, (_x, y, d) => (d > 0.7 ? 'a' : y < 9 ? 'c' : 'b'));
    }
    for (let x = 0; x < 16; x++) c.set(x, 15, hash(x, v, 63) < 0.5 ? '0' : 'a');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Small scenery (one tile, standing on the tile; tall ones overhang the tile above)               */
/* ---------------------------------------------------------------------------------------------- */

/** A soft drop shadow on the ground under a thing: dark grass, offset down and right. */
function shadow(c: Canvas, cx: number, cy: number, rx: number, ry: number): void {
  c.ellipse(cx + 2, cy + 1, rx, ry, '1');
}

/** A round bush: a lumpy leaf ball, light from the top left, on its shadow. */
export function bush(v = 0): string {
  return frame(`bush-${v}`, 16, 16, (c) => {
    shadow(c, 8, 12, 7, 3);
    c.ellipse(8, 8.5, 7, 6.5, (x, y, d) => {
      const tl = x + y < 13;
      if (d > 0.78) return 'a';
      if (tl && d < 0.4) return 'c';
      return hash(x, y, v, 71) < 0.12 ? 'a' : 'b';
    });
    c.outline('0', (_x, y) => y > 4);
    if (v === 1)
      for (const [x, y] of [
        [5, 6],
        [10, 8],
        [7, 11],
      ] as [number, number][])
        c.set(x, y, 'v');
  });
}

/** A pine: a stack of three leaf tiers on a short trunk, 16×32 (it overhangs the tile above). */
export function pine(): string {
  return frame('pine', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2.5);
    c.rect(7, 25, 3, 5, 'd');
    c.set(7, 25, 'p');
    const tiers: [number, number, number][] = [
      [8, 23, 7],
      [8, 16, 6],
      [8, 9, 4.5],
    ];
    for (const [cx, by, hw] of tiers)
      for (let y = by - 8; y <= by; y++) {
        const t = (y - (by - 8)) / 8;
        const w = Math.max(1, Math.round(hw * t + 1));
        for (let x = cx - w; x <= cx + w - 1; x++) {
          const edge = x === cx - w || x === cx + w - 1 || y === by;
          c.set(x, y, edge ? 'a' : x < cx - 1 ? 'c' : hash(x, y, 81) < 0.15 ? 'a' : 'b');
        }
      }
    c.set(8, 1, 'c');
    c.outline('0', (_x, y) => y > 2);
  });
}

/** A big round tree, 32×32: a lumpy canopy, light from the top left, its trunk below. */
export function tree(): string {
  return frame('tree', 32, 32, (c) => {
    shadow(c, 16, 28, 11, 3);
    c.rect(14, 22, 5, 7, 'd');
    c.rect(14, 22, 1, 7, 'q');
    const blobs: [number, number, number][] = [
      [16, 12, 11],
      [8, 13, 7],
      [24, 13, 7],
      [16, 6, 8],
      [11, 18, 6],
      [21, 18, 6],
    ];
    c.each((x, y) => {
      const d = Math.min(...blobs.map(([bx, by, r]) => Math.hypot(x + 0.5 - bx, y + 0.5 - by) / r));
      if (d > 1) return null;
      if (d > 0.85) return 'a';
      if (x + y < 26 && d < 0.55) return hash(x, y, 91) < 0.2 ? 'b' : 'c';
      return hash(x, y, 92) < 0.14 ? 'a' : 'b';
    });
    c.outline('0', (_x, y) => y < 23);
  });
}

/** A little mushroom in the grass (red, green or blue cap with white spots). */
export function shroom(cap: 'red' | 'green' | 'blue'): string {
  const [dk, md, lt] = CAPS[cap];
  return frame(`shroom-${cap}`, 16, 16, (c) => {
    shadow(c, 8, 13, 5, 2);
    c.rect(6, 9, 5, 5, 'n');
    c.rect(9, 9, 2, 5, 'o');
    c.ellipse(8.5, 7.5, 6, 4.5, (x, y, d) => (d > 0.75 ? dk : y < 6 && x < 9 ? lt : md));
    for (const [x, y] of [
      [5, 6],
      [10, 5],
      [8, 9],
    ] as [number, number][])
      c.set(x, y, 'v');
    c.set(6, 6, 'v');
    c.outline('0');
  });
}

/** A grey boulder. */
export function rock(): string {
  return frame('rock', 16, 16, (c) => {
    shadow(c, 8, 12, 6, 2.5);
    c.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? '7' : x + y < 14 ? '9' : '8'));
    c.set(9, 9, '7');
    c.set(10, 9, '7');
    c.outline('0');
  });
}

/** A wooden fence (east-west), a post at each end. */
export function fence(): string {
  return frame('fence', 16, 16, (c) => {
    c.rect(0, 13, 16, 1, '1');
    c.rect(0, 6, 16, 2, 'r');
    c.rect(0, 10, 16, 2, 'q');
    c.rect(0, 8, 16, 1, 'p');
    for (const x of [1, 8]) {
      c.rect(x, 3, 3, 10, 'r');
      c.rect(x + 2, 3, 1, 10, 'q');
      c.set(x + 1, 3, 'p');
    }
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks (several tiles; each stands on the bottom edge of the box it is placed in)            */
/* ---------------------------------------------------------------------------------------------- */

const CAPS: Readonly<Record<'red' | 'green' | 'blue', [string, string, string]>> = {
  red: ['h', 'i', 'j'],
  green: ['k', 'l', 'm'],
  blue: ['e', 'f', 'g'],
};

/** A Toad house, 32×32: a cream stem house with a round door, under a big spotted cap. */
export function toadHouse(cap: 'red' | 'green' | 'blue'): string {
  const [dk, md, lt] = CAPS[cap];
  return frame(`toad-house-${cap}`, 32, 32, (c) => {
    shadow(c, 16, 28, 13, 3);
    // The stem house.
    c.rect(7, 16, 18, 13, 'n');
    c.rect(21, 16, 4, 13, 'o');
    c.rect(7, 28, 18, 1, 'o');
    // A round-topped door and a little window.
    c.rect(13, 21, 6, 8, 'q');
    c.rect(14, 20, 4, 1, 'q');
    c.rect(13, 21, 1, 8, 'p');
    c.set(17, 25, 's');
    c.rect(8, 20, 3, 3, 'e');
    c.set(8, 20, 'g');
    // The cap: wide, domed, rim shaded.
    c.ellipse(16, 12, 15.5, 10, (x, y, d) => {
      if (y > 17) return null;
      if (d > 0.82 || y === 17) return dk;
      if (x + y * 1.5 < 22 && d < 0.6) return lt;
      return md;
    });
    const spots: [number, number, number][] = [
      [16, 6, 3],
      [7, 11, 2.5],
      [25, 11, 2.5],
      [12, 14, 1.5],
      [21, 15, 1.5],
    ];
    for (const [x, y, r] of spots) c.ellipse(x, y, r, r * 0.8, (px, py) => (px + py < x + y - 1 ? 'v' : 'v'));
    c.outline('0');
  });
}

/**
 * Mario's house, 48×48: a rounded red tile roof with a chimney over a white brick front, a wooden
 * door on the left (the page's start stands in front of it) and a round window on the right.
 */
export function marioHouse(): string {
  return frame('mario-house', 48, 48, (c) => {
    shadow(c, 24, 44, 22, 3);
    // Front wall: white bricks, a stone footing.
    c.each((x, y) => {
      if (x < 3 || x > 44 || y < 27 || y > 44) return null;
      if (y >= 42) return y === 42 ? '7' : '8';
      const row = Math.floor((y - 27) / 3);
      const bx = (x + (row % 2 ? 3 : 0)) % 6;
      if ((y - 27) % 3 === 2 || bx === 0) return '8';
      return x > 38 ? '9' : 'v';
    });
    // The door (left) with its step, a brass knob.
    c.rect(5, 30, 10, 14, 'q');
    c.rect(6, 29, 8, 1, 'q');
    c.rect(5, 30, 1, 14, 'p');
    c.rect(10, 30, 1, 14, 'p');
    c.rect(7, 32, 2, 2, 'r');
    c.rect(12, 32, 2, 2, 'r');
    c.set(13, 37, 's');
    c.rect(4, 44, 12, 2, '8');
    // A round window (right), blue panes, a white cross.
    c.ellipse(32, 35, 5, 5, (_x, _y, d) => (d > 0.6 ? 'o' : 'f'));
    c.rect(31, 31, 2, 9, 'v');
    c.rect(28, 34, 9, 2, 'v');
    c.set(30, 33, 'g');
    // Flower box under it.
    c.rect(27, 40, 11, 2, 'q');
    for (const x of [28, 31, 34, 36]) c.set(x, 39, x % 2 ? 't' : 's');
    // The chimney, then the roof over it.
    c.rect(34, 1, 6, 10, '8');
    c.rect(34, 1, 6, 2, '7');
    c.rect(38, 3, 2, 8, '7');
    c.each((x, y) => {
      // A rounded roof: rows of red tiles, darker at its eaves and to the right.
      const cx = 24;
      const dy = (x - cx) / 23;
      const top = 6 + Math.round(dy * dy * 9);
      if (y < top || y > 27 || x < 1 || x > 46) return null;
      if (y >= 26) return 'h';
      const row = Math.floor((y - top) / 3);
      const tx = (x + (row % 2 ? 2 : 0)) % 4;
      if ((y - top) % 3 === 2) return 'h';
      if (tx === 0) return 'h';
      if (y - top < 2 && x < 30) return 'j';
      return x > 36 ? 'h' : 'i';
    });
    // A small dormer M sign: a white circle with a red M-ish mark would be a logo; keep a vent.
    c.rect(22, 13, 5, 4, 'n');
    c.rect(23, 14, 3, 2, 'z');
    c.outline('0');
  });
}

/**
 * Peach's Castle, 80×56: a white stone curtain wall with battlements and an arched wooden gate,
 * two round corner towers and a tall central keep under red cone roofs, a pink banner, a
 * rose window over the gate and gold flags on the roofs. Seen from the south, a little above.
 */
export function peachCastle(): string {
  return frame('peach-castle', 80, 56, (c) => {
    shadow(c, 40, 52, 38, 4);
    const brick = (x: number, y: number, light = false): string => {
      const row = Math.floor(y / 4);
      const bx = (x + (row % 2 ? 4 : 0)) % 8;
      if (y % 4 === 3 || bx === 0) return '8';
      return light ? 'v' : '9';
    };
    // Central keep (behind), its cone roof.
    c.each((x, y) => (x >= 28 && x <= 51 && y >= 14 && y <= 34 ? brick(x, y, x < 40) : null));
    cone(c, 40, 1, 15, 15);
    // Keep windows.
    for (const wx of [33, 44]) {
      c.rect(wx, 20, 4, 6, 'e');
      c.rect(wx, 20, 4, 1, '7');
      c.set(wx + 1, 21, 'g');
    }
    // Curtain wall.
    c.each((x, y) => (x >= 10 && x <= 69 && y >= 30 && y <= 51 ? brick(x, y, x < 40) : null));
    for (let x = 10; x <= 69; x += 4) c.rect(x, 27, 2, 3, x < 40 ? 'v' : '9');
    c.rect(10, 51, 60, 1, '7');
    // Rose window: pink glass, a gold rim.
    c.ellipse(40, 33, 4, 3.5, (x, y, d) => (d > 0.6 ? 's' : (x + y) % 2 ? 't' : 'u'));
    // Arched gate.
    c.ellipse(40, 43, 6, 5, 'p');
    c.rect(34, 43, 12, 9, 'p');
    c.ellipse(40, 43, 5, 4, 'q');
    c.rect(35, 43, 10, 9, 'q');
    for (const x of [37, 40, 43]) c.rect(x, 40, 1, 12, 'p');
    c.rect(33, 52, 14, 2, '8');
    // Corner towers.
    for (const tx of [10, 69]) {
      c.each((x, y) => {
        if (Math.abs(x + 0.5 - tx) > 7 || y < 22 || y > 52) return null;
        return Math.abs(x + 0.5 - tx) > 5.5 ? '8' : x < tx ? 'v' : '9';
      });
      cone(c, tx, 9, 14, 8.5);
      c.rect(tx - 1, 32, 3, 5, 'e');
      c.set(tx, 33, 'g');
    }
    // Pink banners on the wall.
    for (const bx of [22, 56]) {
      c.rect(bx, 34, 5, 10, 't');
      c.rect(bx + 4, 34, 1, 10, 'u');
      c.set(bx + 2, 44, 't');
      c.ellipse(bx + 2.5, 38, 1.5, 1.5, 's');
    }
    c.outline('0', (_x, y) => y > 0);
  });
}

/** A red cone roof with its tip at (cx, top), `h` tall and `hw` half-wide at its base, a gold flag. */
function cone(c: Canvas, cx: number, top: number, h: number, hw: number): void {
  for (let y = top; y <= top + h; y++) {
    const t = (y - top) / h;
    const w = hw * t;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) {
      const band = (y - top) % 3 === 2;
      c.set(x, y, y === top + h ? 'h' : band ? 'h' : x < cx - w * 0.4 ? 'j' : x > cx + w * 0.4 ? 'h' : 'i');
    }
  }
  c.rect(cx, top - 5, 1, 5, '7');
  c.rect(cx + 1, top - 5, 4, 2, 's');
  c.set(cx + 1, top - 4, 'y');
}

/** The plaza, 80×72: a round court of pale paving in rings, a darker kerb, a gold star inlaid. */
export function plaza(): string {
  return frame('plaza', 80, 72, (c) => {
    const cx = 40;
    const cy = 36;
    c.each((x, y) => {
      const dx = (x + 0.5 - cx) / 39;
      const dy = (y + 0.5 - cy) / 35;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) return null;
      if (d > 0.95) return '7';
      if (d > 0.9) return '8';
      // Concentric rings of slabs, joints every few degrees.
      const ring = Math.floor(d * 7);
      const ang = Math.atan2(dy, dx);
      const seg = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * (8 + ring * 6) + ring * 0.5);
      const ringEdge = Math.floor(d * 7 + 0.07) !== ring;
      const segEdge =
        Math.floor(
          (((ang + 0.03 + Math.PI) / (2 * Math.PI)) * (8 + ring * 6) + ring * 0.5) % (8 + ring * 6),
        ) !==
        seg % (8 + ring * 6);
      if (ringEdge || segEdge) return '8';
      return ring % 2 ? '9' : hash(seg, ring, 101) < 0.5 ? 'v' : '9';
    });
    // A gold star inlaid in the middle (under the fountain's rim, its points showing).
    star(c, cx, cy, 15, 's');
  });
}

/** The castle's walk, 16×20: pale slabs from its gate down to the plaza's kerb. */
export function castleWalk(): string {
  return frame('castle-walk', 16, 20, (c) => {
    c.each((x, y) => {
      if (x === 0 || x === 15) return '7';
      if (y % 5 === 4 || x === 8) return '8';
      return y % 10 < 5 === x < 8 ? 'v' : '9';
    });
  });
}

/** A five-pointed star of colour `col`, outer radius `r`, centred at (cx, cy). */
function star(c: Canvas, cx: number, cy: number, r: number, col: string): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]);
  }
  c.each((x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i] as [number, number];
      const [xj, yj] = pts[j] as [number, number];
      if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside ? col : null;
  });
}

/** The fountain, 32×32: a round stone basin, rippling water, a spout splashing in the middle. */
export function fountain(f: number): string {
  return frame(`fountain-${f}`, 32, 32, (c) => {
    shadow(c, 16, 25, 14, 4);
    c.ellipse(16, 21, 15, 8.5, (_x, y, d) => (d > 0.85 ? '7' : d > 0.7 ? (y < 21 ? '9' : '8') : 'f'));
    c.ellipse(16, 21, 10, 5, (_x, _y, d) => (d > 0.8 ? 'e' : null));
    ripples(c, f, 5);
    // Basin front.
    c.each((x, y) =>
      y > 21 &&
      y < 27 &&
      Math.abs(x + 0.5 - 16) < 15 - (y - 21) * 0.3 &&
      y > 21 + 8.5 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 16) / 15) ** 2)) - 3
        ? y === 26
          ? '7'
          : '8'
        : null,
    );
    // Column and spout.
    c.rect(14, 9, 4, 12, '8');
    c.rect(14, 9, 1, 12, '9');
    c.ellipse(16, 9, 4, 2, '9');
    const h = f ? 1 : 0;
    c.rect(15, 2 + h, 2, 6, 'g');
    c.set(13, 4 + h, 'g');
    c.set(18, 5 - h, 'g');
    c.set(12, 7, 'v');
    c.set(19, 7, 'v');
    c.set(16, 1 + h, 'v');
    c.outline('0', (_x, y) => y > 10);
  });
}

/**
 * The stone bridge, 48×32, east-west over the two-tile river: a pale deck between low parapets,
 * a stone post at each corner, the arch's dark mouth over the water on its south face.
 */
export function bridge(): string {
  return frame('bridge', 48, 32, (c) => {
    // South face with the arch.
    c.each((x, y) => {
      if (y < 20 || y > 29 || x < 4 || x > 43) return null;
      const dx = (x + 0.5 - 24) / 13;
      const dy = (y + 0.5 - 30) / 8;
      if (dx * dx + dy * dy < 1) return y < 23 ? '7' : null;
      const row = Math.floor(y / 3);
      return (x + (row % 2 ? 2 : 0)) % 5 === 0 || y % 3 === 2 ? '7' : '8';
    });
    // The deck.
    c.each((x, y) => {
      if (y < 9 || y > 19 || x < 2 || x > 45) return null;
      return x % 6 === 0 ? '8' : y === 9 ? 'v' : '9';
    });
    // Parapets.
    for (const py of [5, 17]) {
      c.rect(2, py, 44, 4, '8');
      c.rect(2, py, 44, 1, 'v');
      c.rect(2, py + 3, 44, 1, '7');
    }
    // Posts with round caps.
    for (const [px, py] of [
      [1, 2],
      [41, 2],
      [1, 14],
      [41, 14],
    ] as [number, number][]) {
      c.rect(px, py + 3, 6, 6, '8');
      c.rect(px + 5, py + 3, 1, 6, '7');
      c.ellipse(px + 3, py + 3, 3.5, 2.5, (_x, y) => (y < py + 3 ? '9' : '8'));
    }
    c.outline('0');
  });
}

/** A green pipe from above and the front, 32×32: its rim's dark mouth over a short body. */
export function pipe(): string {
  return frame('pipe', 32, 32, (c) => {
    shadow(c, 16, 28, 13, 3);
    c.each((x, y) => {
      if (x < 5 || x > 26 || y < 13 || y > 28) return null;
      return x < 9 ? 'm' : x > 22 ? 'k' : x > 18 ? 'l' : x < 12 ? 'm' : 'l';
    });
    c.ellipse(16, 11, 14, 7, (x, _y, d) => (d > 0.8 ? 'k' : d > 0.55 ? (x < 14 ? 'm' : 'l') : 'z'));
    c.ellipse(16, 12, 7, 3, (_x, y) => (y > 12 ? 'a' : null));
    c.rect(2, 16, 28, 1, 'k');
    c.outline('0');
  });
}

/** A giant mushroom from above (1-3's high treetop land): a broad spotted cap on its pale stem. */
export function giantShroom(cap: 'red' | 'green' | 'blue'): string {
  const [dk, md, lt] = CAPS[cap];
  return frame(`giant-shroom-${cap}`, 32, 32, (c) => {
    shadow(c, 17, 27, 9, 3);
    c.rect(12, 18, 8, 10, 'n');
    c.rect(17, 18, 3, 10, 'o');
    c.ellipse(16, 12, 15.5, 11, (x, y, d) => (d > 0.85 ? dk : x + y < 18 && d < 0.65 ? lt : md));
    for (const [x, y, r] of [
      [16, 11, 4],
      [6, 10, 2.5],
      [26, 10, 2.5],
      [11, 4, 2],
      [21, 4, 2],
      [10, 17, 2],
      [22, 17, 2],
    ] as [number, number, number][])
      c.ellipse(x, y, r, r * 0.85, 'v');
    c.outline('0');
  });
}

/** A hedge garden's wall piece (east-west): a clipped box of leaves on a dark base. */
export function hedge(s: Sides): string {
  return frame(`hedge-${sideKey(s)}`, 16, 16, (c) => {
    const l = s.w ? 0 : 1;
    const r = s.e ? 15 : 14;
    c.rect(l, 3, r - l + 1, 9, 'b');
    c.rect(l, 3, r - l + 1, 2, 'c');
    c.rect(l, 12, r - l + 1, 3, 'a');
    for (let x = l; x <= r; x++) if (hash(x, 111) < 0.3) c.set(x, 6 + Math.floor(hash(x, 112) * 5), 'a');
    for (let x = l; x <= r; x++) if (hash(x, 113) < 0.25) c.set(x, 4, 'v');
    c.outline('0', (_x, y) => y > 1);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers for this page (drawn by the map engine in place of the round level dots)           */
/* ---------------------------------------------------------------------------------------------- */

/**
 * A round board space, like a party board's: a coloured disc with a light rim and a dark lip,
 * sunk in the ground. Open levels are red, cleared ones blue with a white star, the start (1-0,
 * Mario's front step) green, a level with a secret exit pink with a keyhole.
 */
function space(name: string, dk: string, md: string, lt: string, mark: 'none' | 'star' | 'key'): string {
  return frame(name, 16, 16, (c) => {
    c.ellipse(8, 9.5, 7.5, 5.5, '1');
    c.ellipse(8, 8.5, 7, 5, (_x, y, d) => (d > 0.75 ? (y > 9 ? dk : lt) : md));
    if (mark === 'star') star(c, 8, 8.5, 4, 'v');
    if (mark === 'key') {
      c.rect(7, 6, 2, 2, 'z');
      c.rect(7, 8, 2, 3, 'z');
      c.set(6, 10, 'z');
      c.set(9, 10, 'z');
    }
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: space('node-open', 'h', 'i', 'j', 'none'),
    cleared: space('node-cleared', 'e', 'f', 'g', 'star'),
    start: space('node-start', 'k', 'l', 'm', 'none'),
    secret: space('node-secret', 'u', 't', 'v', 'key'),
    secretCleared: space('node-secret-cleared', 'u', 'v', 'v', 'key'),
    warp: warpPipe(false),
    warpLocked: warpPipe(true),
    fort: fort(false),
    fortCleared: fort(true),
  };
}

/** The warp spot: a small green pipe mouth in the ground (locked: a lid on it). */
function warpPipe(locked: boolean): string {
  return frame(locked ? 'warp-locked' : 'warp', 16, 16, (c) => {
    c.ellipse(8.5, 10, 7.5, 5, '1');
    c.ellipse(8, 9, 7, 5, (x, _y, d) =>
      d > 0.78 ? 'k' : d > 0.5 ? (x < 8 ? 'm' : 'l') : locked ? '8' : 'z',
    );
    if (locked) c.rect(7, 8, 2, 2, '7');
    c.outline('0');
  });
}

/**
 * Bowser's fort (the 1-4 node), 32×40 standing on its tile and overhanging round it: a dark iron
 * keep with battlements, a black arch, a spiked Bowser banner; cleared, the banner comes down and
 * a pink Mushroom Kingdom flag flies.
 */
function fort(cleared: boolean): string {
  return frame(cleared ? 'fort-cleared' : 'fort', 32, 40, (c) => {
    shadow(c, 16, 37, 14, 3);
    c.each((x, y) => {
      if (x < 3 || x > 28 || y < 14 || y > 37) return null;
      const row = Math.floor(y / 4);
      const bx = (x + (row % 2 ? 3 : 0)) % 6;
      if (y % 4 === 3 || bx === 0) return 'w';
      return x > 22 ? 'w' : 'x';
    });
    for (let x = 3; x <= 27; x += 5) c.rect(x, 10, 3, 4, 'x');
    c.ellipse(16, 30, 5, 4, 'z');
    c.rect(11, 30, 10, 8, 'z');
    // Lava glow in the doorway.
    c.rect(13, 35, 6, 2, 'y');
    // Flag pole and flag.
    c.rect(15, 0, 1, 11, '7');
    if (cleared) {
      c.rect(16, 0, 9, 6, 't');
      c.ellipse(20, 3, 2, 2, 'v');
    } else {
      c.rect(16, 0, 9, 6, 'h');
      for (const x of [17, 20, 23]) c.set(x, 2, 'v');
      c.rect(17, 4, 7, 1, 'v');
    }
    // A banner on the front.
    c.rect(6, 17, 4, 8, cleared ? 't' : 'h');
    c.rect(22, 17, 4, 8, cleared ? 't' : 'h');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground, worked out once                                                                */
/* ---------------------------------------------------------------------------------------------- */

/** Every road join, by its 4-bit mask (1 n, 2 e, 4 s, 8 w): `road-<nesw>`. */
export const ROAD_FRAMES: readonly string[] = Array.from({ length: 16 }, (_, m) =>
  road({ n: !!(m & 1), e: !!(m & 2), s: !!(m & 4), w: !!(m & 8) }),
);

/** A piece of standing scenery on a page: its frame's top-left, and the row under its feet. */
export interface KingdomPiece {
  frame: string;
  x: number;
  y: number;
  feet: number;
}

/** What kingdomGround works out for a page. */
export interface KingdomGround {
  /** The ground frame of every tile (row-major, 16 a row), for each of the river's two frames. */
  frames: readonly [readonly string[], readonly string[]];
  /** Tiles a road never draws on (the river; the bridge carries the road over it). */
  wet: readonly boolean[];
  /** The scenery standing on the tiles (pines, bushes, rocks, mushrooms, hedges). */
  scenery: readonly KingdomPiece[];
}

const WET = new Set(['~', '=']);
const grounds = new WeakMap<readonly string[], KingdomGround>();

/**
 * The ground of a page in the map legend (world1-kingdom.ts): grass by position, flowers, the
 * river with its banks worked out from its neighbours (the rows under the header count as more of
 * the row below them, so the river runs on up under the woods), the woods' canopy in the rows under
 * the header, and the scenery chars as grass with their piece standing on it. Cached per tiles.
 */
export function kingdomGround(tiles: readonly string[]): KingdomGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const ch = (x: number, y: number): string => {
    const yy = Math.max(2, Math.min(tiles.length - 1, y));
    const xx = Math.max(0, Math.min(15, x));
    return tiles[yy]?.[xx] ?? '#';
  };
  const wetAt = (x: number, y: number): boolean => WET.has(ch(x, y));
  const f0: string[] = [];
  const f1: string[] = [];
  const wet: boolean[] = [];
  const scenery: KingdomPiece[] = [];
  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < 16; x++) {
      const c = tiles[y]?.[x] ?? '#';
      const v = Math.floor(hash(x, y, 7) * 4);
      const w = y < 2 ? false : WET.has(c);
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
        continue;
      }
      const g = y < 2 ? canopy(x % 4) : c === '*' ? flowers(v) : c === ',' ? grass(4 + (v % 2)) : grass(v);
      f0.push(g);
      f1.push(g);
      const stand = (frame: string, dy = 0): void =>
        void scenery.push({ frame, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
      if (c === 'T') stand(pine(), -16);
      else if (c === 'H') stand(bush(0));
      else if (c === 'S') stand(bush(1));
      else if (c === 'R') stand(rock());
      else if (c === 'o') stand(shroom('red'));
      else if (c === 'C')
        stand(hedge({ n: false, s: false, w: ch(x - 1, y) === 'C', e: ch(x + 1, y) === 'C' }));
    }
  const out: KingdomGround = { frames: [f0, f1], wet, scenery };
  grounds.set(tiles, out);
  return out;
}

/** Paints every frame the page's markers and landmarks use, and the grounds of the pages given. */
function paintSheet(pages: readonly (readonly string[])[]): Record<string, readonly string[]> {
  for (let v = 0; v < 6; v++) grass(v);
  for (let v = 0; v < 4; v++) {
    flowers(v);
    canopy(v);
  }
  bush(0);
  bush(1);
  pine();
  tree();
  rock();
  fence();
  for (const cap of ['red', 'green', 'blue'] as const) {
    shroom(cap);
    toadHouse(cap);
    giantShroom(cap);
  }
  marioHouse();
  peachCastle();
  castleWalk();
  plaza();
  fountain(0);
  fountain(1);
  bridge();
  pipe();
  nodeFrames();
  for (const tiles of pages) kingdomGround(tiles);
  return FRAMES;
}

/**
 * The `kingdom` sheet: every frame of the top-down Mushroom Kingdom, with the grounds of the pages
 * given (their tiles after autoShore). Registered by sprites/index.ts with World 1's campaign page.
 */
export function kingdomSheet(pages: readonly (readonly string[])[]): SpriteDef {
  return { palette: 'kingdom', frames: paintSheet(pages) };
}
