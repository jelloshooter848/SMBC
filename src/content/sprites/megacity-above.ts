import type { SpriteDef } from '@engine/gfx/pixelart';
import type { MapNode } from '@game/map/types';
import type { Canvas } from './paint';
import { hash } from './paint';
import {
  type AboveGround,
  type AbovePiece,
  FrameBook,
  lazySheet,
  roadFrames,
  roadNames,
  shadow,
  sideKey,
  space,
  type Sides,
  water as kitWater,
  type WaterInk,
} from './above-kit';

/*
 * World 3, MEGA CITY, drawn from above in campaign play (0.4.50, TD52's approved design), in World 1's
 * 3/4 view (sprites/kingdom.ts). Mega Man has no overworld, so the page is one city of calm grey
 * pavement with robot-master districts set in it, each told by its buildings and props in the
 * colours of one of Mega Man 1's stages (the owner's references), not by flooding its floor:
 * Dr. Light's lab at the start, Cut Man's green brick ruins with red ladders, Fire Man's pink-white
 * works round a magma pool and furnace, Bomb Man's park of round orange trees on a lawn, Elec Man's
 * orange brick tower with its generators, Dr. Wily's skull fortress over the castle node; Guts
 * Man's quarry is a small accent in the bottom-left corner, and the harbour's quay and cyan sea
 * close the page below. The roads are white steel walkways (Bomb Man's) with a dark rim.
 * Original art drawn from shapes; nothing traced.
 *
 * A page names each tile's district in `zones` (world3-megacity.ts ZONES_3_MEGACITY):
 *   L lab   C Cut Man   F Fire Man   W Wily   B Bomb Man   E Elec Man   G Guts Man   N plain city
 * '#' is the pavement everywhere; the sketch's other chars take their district's look: ',' its
 * accent tile, '0' its block (a ruin, a works, a crag, a machine, a hedge, a tree), 'T' its tree,
 * 'R' a boulder, 'P' a fire pillar, 'X' a generator.
 *
 * Palette `megacity-above` (index: role):
 *   0 outline   1-3 concrete (dark, mid, light)   4-6 orange rock/brick (dark, mid, light)
 *   7-9 Cut Man's green brick (dark, mid, light)   a-c Fire Man's pink brick (dark, mid, white)
 *   d-f magma (dark, mid, light)   g-i ice (dark, mid, light)   j-k sea (mid, dark)
 *   l-m steel (white, blue)   n-o Bomb Man's trees (orange, dark)   p-r green panels (light, mid, dark)
 *   s yellow   t red   u blue   v white   w-y crag (dark, mid, light)   z black
 */
export const MEGACITY_ABOVE_PALETTE: readonly string[] = [
  '#101018', // 0 outline
  '#545a6c', // 1 concrete dark
  '#8a92a4', // 2 concrete
  '#c4cad6', // 3 concrete light
  '#94400e', // 4 orange dark
  '#d87028', // 5 orange
  '#f8b070', // 6 orange light
  '#2a6436', // 7 green brick dark
  '#58a052', // 8 green brick
  '#a4d48c', // 9 green brick light
  '#a05468', // a pink brick dark
  '#e2a2aa', // b pink brick
  '#fae4e2', // c pink white
  '#9c1808', // d magma dark
  '#ee5418', // e magma
  '#f8c840', // f magma light
  '#3a86cc', // g ice dark
  '#8ed6f6', // h ice
  '#dcf8f8', // i ice light
  '#1ab0c4', // j sea
  '#0c6a84', // k sea dark
  '#eef2f8', // l steel white
  '#7a92c2', // m steel blue
  '#c46a2c', // n tree orange
  '#743812', // o tree dark
  '#5cc464', // p panel light
  '#2c9848', // q panel
  '#185e30', // r panel dark
  '#f8d830', // s yellow
  '#d82828', // t red
  '#2860d8', // u blue
  '#fcfcfc', // v white
  '#2a2636', // w crag dark
  '#4a4460', // x crag
  '#7a7092', // y crag light
  '#08080c', // z black
];

const book = new FrameBook();
const F = book.frames;
const frame = book.frame.bind(book);

export type Zone = 'L' | 'C' | 'F' | 'W' | 'G' | 'B' | 'E' | 'I' | 'N';

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/** Bricks in rows `bh` tall and `bw` wide, mortar `m`, faces `b`, a lit top row `l`. */
function bricks(c: Canvas, bw: number, bh: number, m: string, b: string, l: string, seed: number): void {
  c.each((x, y) => {
    const row = Math.floor(y / bh);
    const bx = (x + (row % 2 ? bw / 2 : 0)) % bw;
    if (y % bh === bh - 1 || bx === 0) return m;
    if (y % bh === 0) return l;
    return hash(x, y, seed) < 0.06 ? m : b;
  });
}

/**
 * The city's one ground: calm mid-grey pavement in big slabs, each a little bevelled (a light top
 * and left edge, a dark joint right and below), a few specks. Every district stands on it; its
 * colour comes from its buildings and props and from the odd accent tile (`accent`).
 */
export function pavement(v: number): string {
  return frame(`pavement-${v}`, 16, 16, (c) => {
    c.each((x, y) => {
      if (x === 15 || y === 15) return '1';
      if (x === 0 || y === 0) return hash(x, y, 300) < 0.5 ? '3' : '2';
      return hash(x, y, v, 301) < 0.04 ? '1' : '2';
    });
    if (v === 2) c.rect(5, 8, 4, 1, '1');
  });
}

/**
 * A district's accent tile (',' in the sketch), laid sparingly round its buildings: the lab's and
 * Bomb Man's lawn, Cut Man's green brick, Fire Man's pink brick, Wily's crag, Elec Man's plates,
 * Guts Man's quarry dirt, Ice Man's snow.
 */
export function accent(zone: Zone, v: number, joined: Sides): string {
  const alt = zone === 'L' || zone === 'B';
  return frame(`accent-${zone}-${v}-${sideKey(joined)}`, 16, 16, (c) => {
    switch (zone) {
      case 'L': // the lab's concrete court in big slabs, a lawn for ','
        if (alt) {
          c.each((x, y) => (hash(x, y, v, 301) < 0.1 ? 'q' : hash(x, y, v, 302) < 0.05 ? 'p' : 'q'));
          for (let i = 0; i < 4; i++)
            c.set(Math.floor(hash(v, i, 303) * 16), Math.floor(hash(v, i, 304) * 16), 'p');
          c.each((x, y, now) => ((x + y + v) % 7 === 0 && hash(x, y, 305) < 0.4 ? 'r' : now));
        } else
          c.each((x, y) => {
            if (x % 8 === 7 || y % 8 === 7) return '2';
            if (x % 8 === 0 || y % 8 === 0) return 'l';
            return hash(x, y, v, 306) < 0.05 ? '2' : '3';
          });
        break;
      case 'C': // Cut Man's green brick paving, a worn grey patch now and then
        bricks(c, 8, 4, '7', '8', '9', 310 + v);
        if (v === 1)
          c.each((x, y, now) =>
            (x - 9) ** 2 + (y - 9) ** 2 < 14 ? (hash(x, y, 311) < 0.2 ? '1' : '2') : now,
          );
        break;
      case 'F': // Fire Man's pink-white brick floor
        bricks(c, 8, 4, 'a', 'b', 'c', 320 + v);
        if (v === 2) for (let x = 2; x < 14; x++) c.set(x, 9, x % 2 ? 'a' : 'd');
        break;
      case 'W': // the crag Wily built on: dark rock, cracks, cold glints
        c.each((x, y) => {
          const r = hash(x, y, v, 330);
          return r < 0.1 ? 'w' : r > 0.95 ? 'y' : 'x';
        });
        for (let k = 0; k < 5; k++) c.set(3 + v * 3 + (k % 2), 2 + k * 3, 'w');
        break;
      case 'G': // Guts Man's quarry: orange dirt strewn with pebbles
        c.each((x, y) => (hash(x, y, v, 340) < 0.07 ? '4' : hash(x, y, v, 341) < 0.04 ? '6' : '5'));
        for (let i = 0; i < 5; i++) {
          const x = Math.floor(hash(v, i, 342) * 14) + 1;
          const y = Math.floor(hash(v, i, 343) * 14) + 1;
          c.rect(x, y, 2, 1, '6');
          c.rect(x, y + 1, 2, 1, '4');
          c.set(x + 2, y + 1, '4');
        }
        break;
      case 'B': // Bomb Man's park: green panels in a grid, a lawn for ','
        if (alt) c.each((x, y) => (hash(x, y, v, 350) < 0.12 ? 'q' : 'p'));
        else
          c.each((x, y) => {
            if (x % 8 === 7 || y % 8 === 7) return 'r';
            if (x % 8 === 0 || y % 8 === 0) return 'p';
            return 'q';
          });
        break;
      case 'E': // Elec Man's works: dark steel plates, rivets, a hazard stripe at the joins
        c.each((x, y) => {
          if (x === 15 || y === 15) return '1';
          if (x === 0 || y === 0) return '3';
          return hash(x, y, v, 360) < 0.06 ? '1' : '2';
        });
        for (const [x, y] of [
          [2, 2],
          [13, 2],
          [2, 13],
          [13, 13],
        ] as [number, number][])
          c.set(x, y, 'l');
        if (v === 3) for (let x = 1; x < 15; x++) c.set(x, 14, Math.floor(x / 2) % 2 ? 's' : 'z');
        break;
      case 'I': // Ice Man's shore: packed snow, ice streaks
        c.each((x, y) => {
          const r = hash(x, y, v, 370);
          return r < 0.06 ? 'h' : r > 0.97 ? 'v' : 'i';
        });
        for (let k = 0; k < 2; k++) {
          const y = 3 + Math.floor(hash(v, k, 371) * 10);
          const x = Math.floor(hash(v, k, 372) * 8);
          c.rect(x, y, 6, 1, 'h');
          c.set(x + 6, y + 1, 'h');
        }
        break;
    }
    // Set in the pavement: a dark seam and a light kerb on every open side, the corners rounded.
    const open = { n: !joined.n, e: !joined.e, s: !joined.s, w: !joined.w };
    c.each((x, y, now) => {
      const d = Math.min(open.w ? x : 9, open.e ? 15 - x : 9, open.n ? y : 9, open.s ? 15 - y : 9);
      const corner =
        ((open.n && y < 2) || (open.s && y > 13)) &&
        ((open.w && x < 2) || (open.e && x > 13)) &&
        (x % 15) + (y % 15) !== 2;
      if (corner && (x === 0 || x === 15) && (y === 0 || y === 15)) return '2';
      if (d === 0) return '1';
      if (d === 1) return '3';
      return now;
    });
  });
}

/** The band under the header: Mega City's skyline against a pale sky. */
export function band(x: number): string {
  const v = x % 4;
  return frame(`skyline-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'h');
    const towers: [number, number, number][] = [
      [0, 5, 6 + v],
      [5, 4, 3 + ((v * 3) % 5)],
      [9, 7, 8 - v],
    ];
    for (const [tx, tw, top] of towers)
      c.each((px, py) => {
        if (px < tx || px >= tx + tw || py < top) return null;
        if (px === tx + tw - 1) return '1';
        return (py - top) % 3 === 1 && (px - tx) % 2 === 1 ? 's' : 'm';
      });
    c.rect(0, 14, 16, 2, '1');
  });
}

const SEA: WaterInk = { deep: 'k', mid: 'j', light: 'i', land: '2', bankLight: '3', bank: '1', face: '1' };
const MAGMA: WaterInk = { deep: 'd', mid: 'e', light: 'f', land: 'b', bankLight: 'c', bank: 'a', face: 'a' };
export const sea = (s: Sides, corners: string, f: number): string =>
  kitWater(book, 'sea', s, corners, f, SEA);
export const magma = (s: Sides, corners: string, f: number): string =>
  kitWater(book, 'magma', s, corners, f, MAGMA);

/* ---------------------------------------------------------------------------------------------- */
/* Small scenery: each district's block, trees, fire pillars, generators                         */
/* ---------------------------------------------------------------------------------------------- */

/** A box seen from above and the front (3/4): its top face, its front face below, an outline. */
function box(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  top: number,
  front: number,
  topCol: (x: number, y: number) => string,
  frontCol: (x: number, y: number) => string,
): void {
  c.each((px, py) => {
    if (px < x || px >= x + w) return null;
    if (py >= y && py < y + top) return topCol(px - x, py - y);
    if (py >= y + top && py < y + top + front) return frontCol(px - x, py - y - top);
    return null;
  });
}

/** A district's block, 16×16 (on its tile): v picks among a few looks. */
export function block(zone: Zone, v: number): string {
  return frame(`block-${zone}-${v}`, 16, 16, (c) => {
    switch (zone) {
      case 'C': {
        // A ruin of grey concrete over green brick, a red ladder on some.
        shadow(c, 8, 14, 7, 1.5, '7');
        box(
          c,
          1,
          1,
          14,
          6,
          8,
          (x, y) => (hash(x, y, v, 401) < 0.12 ? '2' : y === 0 ? 'l' : '3'),
          (x, y) => {
            const row = Math.floor(y / 3);
            return y % 3 === 2 || (x + (row % 2 ? 2 : 0)) % 5 === 0 ? '7' : y === 0 ? '9' : '8';
          },
        );
        if (v % 2 === 0) {
          c.rect(10, 2, 1, 13, 't');
          c.rect(13, 2, 1, 13, 't');
          for (let y = 3; y < 15; y += 3) c.rect(10, y, 4, 1, 't');
        } else c.rect(4, 9, 4, 3, '1');
        break;
      }
      case 'F': {
        // A works of pink-white brick, a dark vent glowing orange.
        shadow(c, 8, 14, 7, 1.5, 'a');
        box(
          c,
          1,
          1,
          14,
          5,
          9,
          (x, y) => (y === 0 ? 'c' : x % 4 === 0 ? 'b' : 'c'),
          (x, y) => {
            const row = Math.floor(y / 3);
            return y % 3 === 2 || (x + (row % 2 ? 2 : 0)) % 6 === 0 ? 'a' : 'b';
          },
        );
        c.rect(5, 9, 6, 4, 'z');
        c.rect(6, 11, 4, 2, v % 2 ? 'e' : 'f');
        break;
      }
      case 'G': {
        // An orange boulder of the quarry, in lumps.
        shadow(c, 8, 13, 7, 2, '4');
        c.ellipse(8, 8.5, 7, 6, (x, y, d) => {
          if (d > 0.8) return '4';
          const lump = (Math.floor((x + v) / 4) + Math.floor(y / 4)) % 2;
          if (x + y < 12 && d < 0.6) return '6';
          return lump ? '5' : hash(x, y, 410) < 0.3 ? '6' : '5';
        });
        break;
      }
      case 'W': {
        // A dark crag spur.
        shadow(c, 8, 14, 6, 1.5, 'w');
        c.each((x, y) => {
          const h = 2 + Math.abs(x - 7.5) * 1.3 + (v % 2) * 2;
          if (y < h || y > 14 || x < 1 || x > 14) return null;
          return x < 7 ? 'y' : x < 11 ? 'x' : 'w';
        });
        break;
      }
      case 'E': {
        // A machine: a dark cabinet, dials and lights, a yellow warning plate.
        shadow(c, 8, 14, 7, 1.5, '1');
        box(
          c,
          1,
          1,
          14,
          5,
          9,
          (x, y) => (y === 0 ? '2' : x % 3 === 0 ? '1' : 'x'),
          (_x, y) => (y === 0 ? 'x' : 'w'),
        );
        c.rect(3, 8, 3, 3, 's');
        c.set(4, 9, 'z');
        c.set(9, 8, v % 2 ? 't' : 'p');
        c.set(11, 8, v % 2 ? 'p' : 't');
        c.rect(8, 11, 5, 1, 'm');
        break;
      }
      case 'L': {
        // A clipped hedge box by the lab.
        shadow(c, 8, 14, 7, 1.5, 'r');
        box(
          c,
          1,
          3,
          14,
          5,
          6,
          (x, y) => (y === 0 ? 'p' : hash(x, y, 420) < 0.2 ? 'p' : 'q'),
          (_x, y) => (y === 0 ? 'q' : 'r'),
        );
        break;
      }
      case 'I': {
        // An ice block: a clear cube, light top, streaks of shine.
        shadow(c, 8, 14, 7, 1.5, 'h');
        box(
          c,
          2,
          2,
          12,
          5,
          8,
          (x, y) => (y === 0 || x === 0 ? 'v' : 'i'),
          (x, y) => (x + y === 4 || x + y === 9 ? 'v' : x > 9 ? 'g' : 'h'),
        );
        break;
      }
    }
    c.outline('0');
  });
}

/** A district's tree, 16×32 (it overhangs the tile above): Bomb Man's round orange tree on its thin
 * trunk; a round green one by the lab. */
export function tree(zone: Zone): string {
  const [lt, md, dk] = zone === 'B' ? ['6', 'n', 'o'] : ['p', 'q', 'r'];
  return frame(`tree-${zone}`, 16, 32, (c) => {
    shadow(c, 8, 29, 4, 1.5, zone === 'B' ? 'r' : 'r');
    c.rect(7, 15, 2, 15, 'o');
    c.set(7, 15, '4');
    c.ellipse(8, 9, 7.5, 7.5, (x, y, d) => {
      if (d > 0.8) return dk;
      // Bomb Man's trees are lined like a ball of bark.
      if (zone === 'B' && (y % 4 === 1 || (x + Math.floor(y / 4)) % 5 === 0)) return dk;
      if (x + y < 12 && d < 0.55) return lt;
      return md;
    });
    c.outline('0', (_x, y) => y < 17 || y > 28);
  });
}

/** A fire pillar of Fire Man's works, 16×24: a brick stump, a flame standing on it. */
export function firePillar(): string {
  return frame('fire-pillar', 16, 24, (c) => {
    shadow(c, 8, 22, 5, 1.5, 'a');
    box(
      c,
      3,
      13,
      10,
      3,
      7,
      (_x, y) => (y === 0 ? 'c' : 'b'),
      (x, y) => (y % 3 === 2 || x % 4 === 0 ? 'a' : 'b'),
    );
    c.each((x, y) => {
      const w = Math.max(0, 4.5 - Math.abs(y - 9) * 0.45) * (y < 9 ? 0.9 : 1);
      const cx = 8 + Math.sin(y / 2) * 0.8;
      if (y > 13 || Math.abs(x + 0.5 - cx) > w) return null;
      return Math.abs(x + 0.5 - cx) < w * 0.4 && y > 5 ? 'f' : y < 5 ? 'e' : 'e';
    });
    c.outline('0', (_x, y) => y > 11);
  });
}

/** A generator of Elec Man's works, 16×24: a coil on a cabinet, a spark between its horns. */
export function generator(): string {
  return frame('generator', 16, 24, (c) => {
    shadow(c, 8, 22, 6, 1.5, '1');
    box(
      c,
      2,
      13,
      12,
      3,
      7,
      (x) => (x % 3 === 0 ? '1' : '2'),
      (_x, y) => (y === 0 ? 'x' : 'w'),
    );
    c.rect(4, 17, 3, 2, 's');
    for (let y = 4; y < 13; y++) c.rect(6, y, 4, 1, y % 2 ? '5' : '4');
    c.rect(3, 3, 2, 6, 'm');
    c.rect(11, 3, 2, 6, 'm');
    for (const [x, y] of [
      [5, 2],
      [6, 3],
      [7, 2],
      [8, 3],
      [9, 2],
      [10, 3],
    ] as [number, number][])
      c.set(x, y, 's');
    c.outline('0');
  });
}

/** Grey rubble, for a rock outside the quarry. */
export function rubble(): string {
  return frame('rubble', 16, 16, (c) => {
    shadow(c, 8, 13, 6, 2, '1');
    c.ellipse(6, 10, 4.5, 3.5, (x, y) => (x + y < 13 ? '3' : '2'));
    c.ellipse(11, 9, 3.5, 3, (x, y) => (x + y < 17 ? '3' : '1'));
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Dr. Light's lab, 48×32: a white two-storey block with a blue band, a sliding door on its left
 * (the start stands before it), a row of windows, a blue observatory dome on its right with an
 * antenna and a red beacon.
 */
export function lightLab(): string {
  return frame('light-lab', 48, 32, (c) => {
    shadow(c, 24, 29, 22, 2, '2');
    box(
      c,
      1,
      8,
      46,
      6,
      16,
      (x, y) => (y === 0 ? 'v' : x > 40 ? '3' : 'l'),
      (x, y) => {
        if (y === 4 || y === 5) return 'u';
        return x > 40 ? '3' : 'l';
      },
    );
    // The dome.
    c.ellipse(36, 10, 9, 8, (x, y, d) =>
      y > 10 ? null : d > 0.8 ? 'u' : x < 33 && y < 7 ? 'h' : y % 3 === 0 ? 'u' : 'g',
    );
    c.rect(29, 9, 15, 2, '3');
    c.rect(36, 0, 1, 4, '1');
    c.set(36, 0, 't');
    c.set(35, 1, 't');
    // Windows.
    for (const x of [18, 24, 30, 36, 42]) {
      c.rect(x, 20, 4, 3, 'k');
      c.set(x, 20, 'h');
    }
    // The sliding door, its frame and a light over it.
    c.rect(3, 17, 12, 13, 'm');
    c.rect(4, 18, 10, 12, '1');
    c.rect(8, 18, 1, 12, 'z');
    c.rect(4, 18, 4, 12, '2');
    c.rect(9, 18, 5, 12, '2');
    c.rect(7, 15, 4, 2, 's');
    c.outline('0');
  });
}

/**
 * Dr. Wily's fortress, 64×56, on its crag: dark walls and buttresses, two towers with red lamps,
 * a great skull dome over the middle, eye sockets glowing, a jaw of bars.
 */
export function wilyFortress(): string {
  return frame('wily-fortress', 64, 56, (c) => {
    shadow(c, 32, 53, 30, 2.5, 'w');
    // Walls.
    box(
      c,
      4,
      26,
      56,
      4,
      24,
      (x) => (x % 6 === 0 ? 'x' : 'y'),
      (x, y) => {
        const row = Math.floor(y / 4);
        return y % 4 === 3 || (x + (row % 2 ? 3 : 0)) % 7 === 0 ? 'w' : x > 46 ? 'w' : 'x';
      },
    );
    for (let x = 4; x < 60; x += 6) c.rect(x, 22, 3, 4, 'x');
    // Towers.
    for (const tx of [6, 50]) {
      box(
        c,
        tx,
        6,
        9,
        3,
        44,
        () => 'y',
        (x, y) => (y % 5 === 4 ? 'w' : x > 6 ? 'w' : 'x'),
      );
      c.rect(tx + 3, 2, 3, 4, 'x');
      c.rect(tx + 3, 0, 3, 2, 't');
      c.rect(tx + 2, 16, 5, 3, 'z');
      c.rect(tx + 3, 17, 3, 1, 't');
    }
    // The skull dome.
    c.ellipse(32, 20, 15, 14, (x, y, d) => {
      if (y > 30) return null;
      if (d > 0.85) return '2';
      if (x + y < 42 && d < 0.6) return 'v';
      return x > 38 ? '2' : '3';
    });
    for (const ex of [26, 38]) {
      c.ellipse(ex, 21, 4, 3.5, 'z');
      c.rect(ex - 1, 21, 2, 2, 't');
    }
    c.ellipse(32, 26, 1.5, 1.2, 'z');
    // Jaw: bars over a dark mouth, on the wall's top.
    c.rect(22, 30, 20, 8, 'z');
    for (let x = 23; x < 42; x += 3) c.rect(x, 30, 2, 8, '3');
    c.rect(22, 30, 20, 1, '2');
    c.outline('0');
  });
}

/**
 * Elec Man's tower, 32×64: orange brick rising in three stages, dark machinery bands, lit windows,
 * a lightning rod on top with yellow arcs crackling between its horns.
 */
export function elecTower(): string {
  return frame('elec-tower', 32, 64, (c) => {
    shadow(c, 16, 61, 14, 2, '1');
    const stage = (x: number, y: number, w: number, h: number) =>
      box(
        c,
        x,
        y,
        w,
        3,
        h,
        (px) => (px % 4 === 0 ? '5' : '6'),
        (px, py) => {
          const row = Math.floor(py / 3);
          if (py % 9 === 8) return 'w';
          return py % 3 === 2 || (px + (row % 2 ? 2 : 0)) % 5 === 0 ? '4' : px > w - 4 ? '4' : '5';
        },
      );
    stage(3, 34, 26, 27);
    stage(6, 18, 20, 19);
    stage(9, 6, 14, 15);
    // Windows.
    for (const [x, y] of [
      [8, 44],
      [20, 44],
      [11, 26],
      [18, 26],
      [14, 12],
    ] as [number, number][]) {
      c.rect(x, y, 3, 4, 'z');
      c.rect(x, y + 1, 3, 1, 's');
    }
    // A door at its foot.
    c.rect(13, 52, 6, 9, 'z');
    c.rect(13, 52, 6, 1, 'm');
    // The rod and its arcs.
    c.rect(15, 0, 2, 7, 'm');
    c.rect(11, 2, 2, 4, 'm');
    c.rect(19, 2, 2, 4, 'm');
    for (const [x, y] of [
      [13, 1],
      [14, 2],
      [17, 1],
      [18, 2],
      [8, 4],
      [9, 3],
      [22, 4],
      [23, 3],
    ] as [number, number][])
      c.set(x, y, 's');
    c.outline('0');
  });
}

/**
 * Guts Man's quarry face, 48×40: an orange rock mesa with a mine's timbered mouth and a cart
 * of ore on its rails coming out.
 */
export function quarry(): string {
  return frame('quarry', 48, 40, (c) => {
    shadow(c, 24, 37, 22, 2, '4');
    // The mesa: a lumpy lit top, then a face of orange boulders (each pixel to its nearest seed,
    // a dark crack where two meet, each lit on its upper left), darker to the right.
    const top = (x: number) => 3 + Math.round(Math.abs(Math.sin(x / 6)) * 3 + Math.sin(x / 2.3));
    const brow = 13;
    const seeds: [number, number][] = [];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 8; i++)
        seeds.push([i * 6.2 + hash(i, j, 441) * 4, brow + j * 5.6 + hash(i, j, 442) * 3]);
    c.each((x, y) => {
      if (x < 1 || x > 46 || y < top(x) || y > 37) return null;
      if (y < brow) return x + y < 18 ? '6' : hash(x, y, 440) < 0.18 ? '5' : x > 36 ? '5' : '6';
      if (y === brow) return '4';
      let d1 = 99;
      let d2 = 99;
      let sx = 0;
      let sy = 0;
      for (const [px, py] of seeds) {
        const d = Math.hypot((x + 0.5 - px) * 0.8, y + 0.5 - py);
        if (d < d1) [d2, d1, sx, sy] = [d1, d, px, py];
        else if (d < d2) d2 = d;
      }
      if (d2 - d1 < 1.1) return '4';
      const l = x + 0.5 - sx + (y + 0.5 - sy);
      if (l < -2) return '6';
      if (l > 2.5 || x > 40) return '4';
      return '5';
    });
    // The mine's mouth: timbers round a dark hole.
    c.rect(14, 22, 16, 16, 'z');
    c.rect(13, 20, 18, 3, 'n');
    c.rect(13, 20, 18, 1, '6');
    c.rect(13, 23, 3, 15, 'n');
    c.rect(28, 23, 3, 15, 'n');
    c.rect(15, 23, 1, 15, 'o');
    c.rect(30, 23, 1, 15, 'o');
    // Rails out of it, a cart of ore.
    for (let x = 16; x < 28; x++) c.set(x, 36, x % 3 ? '3' : '1');
    box(
      c,
      17,
      28,
      10,
      3,
      6,
      () => '2',
      (_x, y) => (y === 0 ? '3' : '1'),
    );
    c.rect(18, 26, 8, 3, '6');
    c.set(20, 26, '4');
    c.set(23, 27, '4');
    // A warning lamp over the mouth.
    c.rect(21, 17, 2, 3, 't');
    c.outline('0');
  });
}

/** A steel girder span of Guts Man's quarry, 48×16 (flat): a lattice between two rails. */
export function girder(): string {
  return frame('girder', 48, 16, (c) => {
    for (const y of [3, 11]) {
      c.rect(0, y, 48, 2, 'm');
      c.rect(0, y, 48, 1, 'l');
    }
    for (let x = 0; x < 48; x += 6) {
      for (let k = 0; k < 6; k++) {
        c.set(x + k, 5 + Math.floor(k * 1.0), 'm');
        c.set(x + 5 - k, 5 + Math.floor(k * 1.0), '1');
      }
    }
    c.outline('0');
  });
}

/** Fire Man's furnace, 32×32: a brick kiln with a mouth of fire and a chimney. */
export function furnace(): string {
  return frame('furnace', 32, 32, (c) => {
    shadow(c, 16, 29, 14, 2, 'a');
    box(
      c,
      2,
      10,
      28,
      5,
      15,
      (x) => (x % 4 === 0 ? 'b' : 'c'),
      (x, y) => {
        const row = Math.floor(y / 3);
        return y % 3 === 2 || (x + (row % 2 ? 2 : 0)) % 6 === 0 ? 'a' : 'b';
      },
    );
    c.ellipse(16, 21, 6, 4, 'z');
    c.rect(10, 21, 12, 7, 'z');
    c.rect(11, 23, 10, 5, 'e');
    c.rect(13, 24, 6, 4, 'f');
    // Chimney with sparks.
    box(
      c,
      21,
      1,
      6,
      2,
      9,
      () => 'c',
      (x, y) => (y % 3 === 2 || x === 5 ? 'a' : 'b'),
    );
    c.set(23, 0, 'f');
    c.set(25, 0, 'e');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Board spaces with a steel collar (teleport pads: a hard rim the white walkways never blur into),
 * the bonus spot a round hatch in the street, the castle node Wily's skull gate (its lamps out and
 * a blue flag once cleared).
 */
export function nodeFrames(): Record<string, string> {
  const collar = { dark: 'm', light: 'l' };
  const ink = (dark: string, body: string, light: string, mark = 'v') => ({
    shadow: '1',
    dark,
    body,
    light,
    mark,
    outline: '0',
  });
  return {
    open: space(book, 'node-open', ink('d', 't', 'e'), 'none', collar),
    cleared: space(book, 'node-cleared', ink('k', 'u', 'h'), 'star', collar),
    start: space(book, 'node-start', ink('r', 'q', 'p'), 'none', collar),
    secret: space(book, 'node-secret', ink('a', 'b', 'c', 'z'), 'key', collar),
    secretCleared: space(book, 'node-secret-cleared', ink('b', 'c', 'v', 'z'), 'key', collar),
    bonus: hatch(false),
    bonusCleared: hatch(true),
    castle: wilyGate(false),
    castleCleared: wilyGate(true),
  };
}

/** The bonus spot: a round steel hatch in the street, yellow-black ringed; open, a dark shaft. */
function hatch(used: boolean): string {
  return frame(used ? 'bonus-cleared' : 'bonus', 16, 16, (c) => {
    c.ellipse(8.5, 9.5, 7.5, 5.5, '1');
    c.ellipse(8, 8.5, 7.5, 5.5, (x) => (Math.floor(x / 2) % 2 ? 's' : 'z'));
    c.ellipse(8, 8.5, 5.5, 3.8, (_x, y, d) =>
      used ? (d > 0.7 ? '1' : '2') : d > 0.7 ? 'm' : y < 8 ? 'l' : '3',
    );
    if (!used) {
      c.rect(5, 8, 7, 1, '1');
      c.rect(8, 6, 1, 5, '1');
    }
    c.outline('0');
  });
}

/**
 * 3-4's node: the fortress's gatehouse, 32×40, under the skull: dark walls, a steel shutter, two
 * red lamps either side like eyes; once cleared the lamps go out and a blue flag flies.
 */
function wilyGate(cleared: boolean): string {
  return frame(cleared ? 'wily-gate-cleared' : 'wily-gate', 32, 40, (c) => {
    shadow(c, 16, 37, 14, 2, 'w');
    box(
      c,
      2,
      14,
      28,
      3,
      21,
      (x) => (x % 4 === 0 ? 'x' : 'y'),
      (x, y) => {
        const row = Math.floor(y / 4);
        return y % 4 === 3 || (x + (row % 2 ? 2 : 0)) % 6 === 0 ? 'w' : x > 22 ? 'w' : 'x';
      },
    );
    for (let x = 2; x < 30; x += 5) c.rect(x, 11, 3, 3, 'x');
    // The shutter in a steel frame, hazard stripes over it.
    c.rect(7, 21, 18, 15, 'm');
    c.rect(9, 23, 14, 13, 'w');
    for (let y = 24; y < 36; y += 2) c.rect(9, y, 14, 1, '1');
    for (let x = 7; x < 25; x++) c.set(x, 20, Math.floor(x / 2) % 2 ? 's' : 'z');
    // Lamps.
    for (const x of [3, 26]) {
      c.rect(x, 22, 3, 4, 'z');
      c.rect(x + 1, 23, 1, 2, cleared ? '1' : 't');
    }
    c.rect(16, 0, 1, 11, '1');
    c.rect(17, 0, 8, 5, cleared ? 'u' : 't');
    c.rect(17, 2, 8, 1, cleared ? 'v' : 'w');
    c.outline('0');
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground, worked out once                                                                */
/* ---------------------------------------------------------------------------------------------- */

/** The road joins' names by mask: white steel walkways, panel seams, a dark rim (painted with the sheet). */
export const MEGACITY_ROAD_FRAMES: readonly string[] = roadNames('walk');

/** The walkways' colours. */
const WALK_INK = { rim: '0', body: 'l', light: 'v', speck: '3', seam: 'm' };

const WET = new Set(['~', '=', 'L']);
const grounds = new WeakMap<readonly string[], AboveGround>();

/**
 * The ground of a Mega City page from its tiles and districts (`zones`, 15 rows of 16 zone
 * letters): the pavement, each district's accent tiles (','), the sea ('~'), magma ('L'), and
 * each district's standing pieces. Cached per tiles.
 */
export function megacityGround(tiles: readonly string[], zones: readonly string[]): AboveGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const ch = (x: number, y: number): string =>
    tiles[Math.max(2, Math.min(14, y))]?.[Math.max(0, Math.min(15, x))] ?? '#';
  const zoneAt = (x: number, y: number): Zone =>
    (zones[Math.max(2, Math.min(14, y))]?.[Math.max(0, Math.min(15, x))] ?? 'L') as Zone;
  const f0: string[] = [];
  const f1: string[] = [];
  const wet: boolean[] = [];
  const scenery: AbovePiece[] = [];
  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < 16; x++) {
      const c = tiles[y]?.[x] ?? '#';
      const z = zoneAt(x, y);
      const v = Math.floor(hash(x, y, 7) * 4);
      const w = y >= 2 && WET.has(c);
      wet.push(w);
      if (w) {
        const kind = c === 'L' ? 'L' : '~';
        const same = (dx: number, dy: number) => {
          const o = ch(x + dx, y + dy);
          return kind === 'L' ? o === 'L' : o === '~' || o === '=';
        };
        const sides: Sides = { n: same(0, -1), e: same(1, 0), s: same(0, 1), w: same(-1, 0) };
        let corners = '';
        if (sides.n && sides.w && !same(-1, -1)) corners += 'a';
        if (sides.n && sides.e && !same(1, -1)) corners += 'b';
        if (sides.s && sides.e && !same(1, 1)) corners += 'c';
        if (sides.s && sides.w && !same(-1, 1)) corners += 'd';
        const paint = kind === 'L' ? magma : sea;
        f0.push(paint(sides, corners, 0));
        f1.push(paint(sides, corners, 1));
        continue;
      }
      const joined = (dx: number, dy: number) => ch(x + dx, y + dy) === ',' && zoneAt(x + dx, y + dy) === z;
      const g =
        y < 2
          ? band(x)
          : c === ','
            ? accent(z, v, { n: joined(0, -1), e: joined(1, 0), s: joined(0, 1), w: joined(-1, 0) })
            : pavement(v);
      f0.push(g);
      f1.push(g);
      const stand = (fr: string, dy = 0): void =>
        void scenery.push({ frame: fr, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
      if (c === '0')
        stand(z === 'B' ? tree('B') : block(z, Math.floor(hash(x, y, 5) * 4)), z === 'B' ? -16 : 0);
      else if (c === 'T') stand(tree(z === 'B' ? 'B' : 'L'), -16);
      else if (c === 'H') stand(block('L', 0));
      else if (c === 'R') stand(z === 'G' ? block('G', Math.floor(hash(x, y, 8) * 3)) : rubble());
      else if (c === 'P') stand(firePillar(), -8);
      else if (c === 'X') stand(generator(), -8);
    }
  const out: AboveGround = { frames: [f0, f1], wet, scenery };
  grounds.set(tiles, out);
  return out;
}

/** The node marker for a node on a Mega City page. */
export function megacityNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'wily-gate-cleared' : 'wily-gate';
  if (kind === 'bonus') return s.cleared ? 'bonus-cleared' : 'bonus';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  if (s.secret) return s.cleared ? 'node-secret-cleared' : 'node-secret';
  return s.cleared ? 'node-cleared' : 'node-open';
}

/** Paints every frame of the sheet, with the grounds of the pages given ([tiles, zones]). */
function paintSheet(
  pages: readonly (readonly [readonly string[], readonly string[]])[],
): Record<string, readonly string[]> {
  const zones: Zone[] = ['L', 'C', 'F', 'W', 'G', 'B', 'E'];
  tree('B');
  tree('L');
  for (const z of zones) if (z !== 'B') for (let v = 0; v < 4; v++) block(z, v);
  firePillar();
  generator();
  rubble();
  lightLab();
  wilyFortress();
  elecTower();
  quarry();
  girder();
  furnace();
  nodeFrames();
  roadFrames(book, 'walk', WALK_INK);
  for (const [tiles, z] of pages) megacityGround(tiles, z);
  return F;
}

/**
 * The `megacity-above` sheet: every frame, with the grounds of the pages given ([tiles, zones]),
 * painted the first time the game draws from it (lazySheet), never when the game loads.
 */
export function megacityAboveSheet(
  pages: readonly (readonly [readonly string[], readonly string[]])[],
): SpriteDef {
  return lazySheet('megacity-above', () => paintSheet(pages));
}

/** How many of the sheet's frames are painted so far (0 until World 3 first shows). */
export const megacityPainted = (): number => book.size;
