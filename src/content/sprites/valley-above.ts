import type { MapNode } from '@game/map/types';
import { hash } from './paint';
import {
  type AboveGround,
  type AbovePiece,
  cliff as kitCliff,
  type CliffInk,
  FrameBook,
  lazySheet,
  type LazySheetDef,
  roadNames,
  roadSteps,
  shadow,
  type Sides,
  space,
  type SpaceInk,
  stairs as kitStairs,
  water as kitWater,
  type WaterInk,
} from './above-kit';

/*
 * VALLEY OF BOWSER (0.4.54, TD58's approved design; owner, Oct 13), the page after World 8: back in the
 * Mushroom Kingdom's world, at its darkest edge, drawn from above in a cavern-toned version of World
 * 1's 3/4 view (sprites/kingdom.ts). Modelled on the layout of Super Mario World's Valley of Bowser
 * (owner's reference, style guide only): a dark cavern of grey-blue rock in ledges and cliffs, pale
 * tan roads, green pipes, dark pools, a dim star pad, a lone tower, and at the top Bowser's castle
 * over its lava moat, a stair road climbing to its gate. Original art drawn from shapes; nothing
 * traced.
 *
 * Palette `valley-above` (index: role):
 *   0 outline   1-3 cavern floor (dark, mid, light)   4-6 the road (rim, body, light)
 *   7-9 cliff rock (dark, mid, light)   a-c the upper ledge (dark, mid, light)   d the low shelf
 *   e-g pools (dark, mid, light)   h-j castle stone (dark, mid, light)   k-m pipe green (dark, mid, light)
 *   n-o lit window (light, glow)   p-r lava (dark, mid, light)   s gold   t pink   u banner red
 *   v white   w-x iron (dark, light)   y star yellow   z black
 */
export const VALLEY_ABOVE_PALETTE: readonly string[] = [
  '#08080c', // 0 outline
  '#1a2232', // 1 floor dark
  '#2a3850', // 2 floor
  '#44567a', // 3 floor light
  '#8a7450', // 4 road rim
  '#d6be88', // 5 road
  '#f4e4b8', // 6 road light
  '#121824', // 7 rock dark
  '#283246', // 8 rock
  '#4a5c7c', // 9 rock light
  '#38486a', // a ledge dark
  '#54688e', // b ledge
  '#7a90b6', // c ledge light
  '#323e58', // d shelf
  '#060e2e', // e pool dark
  '#10265e', // f pool
  '#3a5ca8', // g pool light
  '#3a3438', // h castle stone dark
  '#6a6066', // i castle stone
  '#a2968e', // j castle stone light
  '#0c561a', // k pipe dark
  '#20a032', // l pipe
  '#7ce05c', // m pipe light
  '#ffe070', // n window lit
  '#f0a020', // o window glow
  '#7a0e00', // p lava dark
  '#e43a10', // q lava
  '#ffa030', // r lava light
  '#f8c830', // s gold
  '#f8a8c8', // t pink
  '#c02020', // u banner red
  '#f8f8f8', // v white
  '#34383f', // w iron dark
  '#7a808c', // x iron light
  '#ffe848', // y star yellow
  '#000000', // z black
];

const book = new FrameBook();
const F = book.frames;
const frame = book.frame.bind(book);

/* ---------------------------------------------------------------------------------------------- */
/* Ground                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Cavern rock ground in the Valley's manner: a flat colour scattered with little peaked rock tufts
 * (a light stroke up, a dark stroke down), `base` / `light` / `dark` the level's own colours.
 */
function tufts(name: string, v: number, base: string, light: string, dark: string): string {
  return frame(`${name}-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, base);
    for (let i = 0; i < 3; i++) {
      if (hash(v, i, 5) < 0.25) continue;
      const x = Math.floor(hash(v, i, 1) * 11) + 2;
      const y = Math.floor(hash(v, i, 2) * 10) + 4;
      c.set(x, y, light);
      c.set(x + 1, y - 1, light);
      c.set(x + 2, y, dark);
      c.set(x + 3, y + 1, dark);
      c.set(x, y + 1, light);
    }
  });
}
/** The cavern floor ('#', and the shores): dark grey-blue. */
export const floor = (v: number): string => tufts('floor', v, '2', '3', '1');
/** The upper ledge (','): lighter grey-blue, where the castle stands. */
export const ledge = (v: number): string => tufts('ledge', v, 'b', 'c', 'a');
/** The low shelf (':'): the deepest, darkest ground along the bottom. */
export const shelf = (v: number): string => tufts('shelf', v, 'd', '2', '7');

const CLIFF = (top: 'ledge' | 'floor'): CliffInk => ({
  top: top === 'ledge' ? 'b' : '2',
  topLight: top === 'ledge' ? 'c' : '3',
  dark: '7',
  body: '8',
  light: '9',
  crack: '0',
  below: top === 'ledge' ? '2' : 'd',
  shade: '7',
  outline: '0',
});
/** A cliff face ('^') down from the ledge (or from the floor to the low shelf). */
export const cliff = (s: Sides, top: 'ledge' | 'floor'): string =>
  kitCliff(book, `cliff-${top}`, s, CLIFF(top));

/** The stair road up the ledge's cliff to the castle ('G'): pale stone steps. */
export const stairs = (): string =>
  kitStairs(book, 'stairs', cliff({ n: false, e: true, s: false, w: true }, 'ledge'), {
    dark: '4',
    body: '5',
    light: '6',
    outline: '0',
  });

/** Ground `g` below a higher side neighbour (`w`, `e`): a rock rim and its shadow along that side. */
export function dropEdge(g: string, w: boolean, e: boolean): string {
  if (!w && !e) return g;
  return frame(`${g}-drop-${w ? 'w' : '-'}${e ? 'e' : '-'}`, 16, 16, (c) => {
    c.paste(book.rows(g));
    for (let y = 0; y < 16; y++) {
      const j = hash(y, 81) < 0.4 ? 1 : 0;
      if (w) {
        c.set(0, y, '9');
        c.set(1, y, '8');
        c.set(2, y, j ? '8' : '7');
        c.set(3 + j, y, '7');
      }
      if (e) {
        c.set(15, y, '8');
        c.set(14, y, '7');
        c.set(13 - j, y, '7');
      }
    }
  });
}

/** The band under the header: the cavern's black roof with stalactites. */
export function band(x: number): string {
  const v = x % 3;
  return frame(`band-${v}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, 'z');
    for (let i = 0; i < 3; i++) {
      const cx = Math.floor(hash(v, i, 21) * 14) + 1;
      const len = 4 + Math.floor(hash(v, i, 22) * 8);
      for (let y = 0; y < len; y++) {
        const w = Math.max(0, Math.round(((len - y) / len) * 2));
        for (let dx = -w; dx <= w; dx++) c.set(cx + dx, y, dx < 0 ? '8' : '7');
      }
    }
    c.rect(0, 15, 16, 1, '7');
  });
}

const POOL: WaterInk = { deep: 'e', mid: 'f', light: 'g', land: '2', bankLight: '3', bank: '8', face: '7' };
/** A dark pool ('~'), banked with rock. */
export const pool = (s: Sides, corners: string, f: number): string =>
  kitWater(book, 'pool', s, corners, f, POOL);

/* ---------------------------------------------------------------------------------------------- */
/* Scenery                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

/** A stalagmite ('Y'), 16×32: a tapering spire of grey-blue rock. */
export function stalagmite(): string {
  return frame('stalagmite', 16, 32, (c) => {
    shadow(c, 8, 29, 6, 2, '1');
    c.each((x, y) => {
      if (y < 6 || y > 29) return null;
      const w = ((y - 6) / 23) * 5.5 + 0.5;
      const d = x + 0.5 - 8;
      if (Math.abs(d) > w) return null;
      return d < -w / 3 ? '9' : d < w / 3 ? '8' : '7';
    });
    c.outline('0', (_x, y) => y < 29);
  });
}

/** A boulder ('R'). */
export function boulder(): string {
  return frame('boulder', 16, 16, (c) => {
    shadow(c, 8, 12, 6, 2.5, '1');
    c.ellipse(8, 9, 6.5, 5, (x, y, d) => (d > 0.75 ? '7' : x + y < 14 ? '9' : '8'));
    c.outline('0');
  });
}

/** An iron brazier ('X'), 16×32, burning: the stair road's foot is lit by a pair of them. */
export function brazier(): string {
  return frame('brazier', 16, 32, (c) => {
    c.ellipse(8, 28, 7, 3, (_x, _y, d) => (d < 0.6 ? '3' : null));
    c.rect(7, 14, 2, 15, 'w');
    c.rect(7, 14, 1, 15, 'x');
    c.rect(5, 27, 6, 2, 'w');
    c.rect(3, 10, 10, 4, 'w');
    c.rect(3, 10, 10, 1, 'x');
    c.ellipse(8, 7, 4, 4.5, (_x, y, d) => (d < 0.3 ? 'v' : d < 0.6 ? 'r' : y < 6 ? 'q' : 'o'));
    c.set(8, 1, 'r');
    c.outline('0', (_x, y) => y < 27);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Landmarks                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

/** A green pipe seen from above and the front, 32×32 (kingdom.ts pipe(), in the Valley's colours). */
export function pipe(): string {
  return frame('pipe', 32, 32, (c) => {
    shadow(c, 16, 28, 13, 3, '1');
    c.each((x, y) => {
      if (x < 5 || x > 26 || y < 13 || y > 28) return null;
      return x < 9 ? 'm' : x > 22 ? 'k' : x > 18 ? 'l' : x < 12 ? 'm' : 'l';
    });
    c.ellipse(16, 11, 14, 7, (x, _y, d) => (d > 0.8 ? 'k' : d > 0.55 ? (x < 14 ? 'm' : 'l') : 'z'));
    c.rect(2, 16, 28, 1, 'k');
    c.outline('0');
  });
}

/** A dim star pad, 32×32 (flat): a worn gold star set in a round stone pad. */
export function starPad(): string {
  return frame('star-pad', 32, 32, (c) => {
    c.ellipse(16, 17, 14, 10, (x, y, d) => (d > 0.85 ? '7' : x + y < 30 ? '3' : '2'));
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 4 : 9;
      pts.push([16 + Math.cos(a) * rr, 17 + Math.sin(a) * rr * 0.75]);
    }
    c.each((x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i] as [number, number];
        const [xj, yj] = pts[j] as [number, number];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside ? (x < 16 ? 'y' : 's') : null;
    });
  });
}

/** A lone stone tower on the floor, 32×48: round, a few lit slits, battlements, a dark door. */
export function tower(): string {
  return frame('tower', 32, 48, (c) => {
    shadow(c, 16, 45, 13, 2.5, '1');
    c.each((x, y) => {
      const d = Math.abs(x + 0.5 - 16);
      if (d > 11 || y < 8 || y > 45) return null;
      const row = Math.floor(y / 4);
      if (y % 4 === 3 || (x + (row % 2 ? 2 : 0)) % 5 === 0) return 'h';
      return d > 8 ? 'h' : x < 14 ? 'j' : 'i';
    });
    for (let x = 5; x < 28; x += 5) c.rect(x, 4, 3, 4, 'i');
    c.rect(5, 6, 22, 2, 'j');
    for (const [x, y] of [
      [12, 16],
      [19, 24],
    ] as [number, number][]) {
      c.rect(x, y, 2, 4, 'z');
      c.set(x, y + 2, 'n');
    }
    c.ellipse(16, 39, 4, 3, 'z');
    c.rect(12, 39, 8, 7, 'z');
    c.outline('0');
  });
}

/**
 * Bowser's castle, 112×72 (the page's landmark; its gate is the castle node, castleGate()): the
 * king's own, in the Mushroom world's style, grand and wide: dark stone in big blocks, a long
 * curtain wall with square battlements, four towers (two tall, under red cones) and a high keep,
 * rows of lava-lit windows, red banners with his horned mark, a lit marquee of bulbs over the gate
 * arch (lettered nowhere), and at its foot the lava moat glowing along the whole front.
 */
export function bowserCastle(): string {
  return frame('bowser-castle', 112, 72, (c) => {
    const block = (x: number, y: number, lit: boolean): string => {
      const row = Math.floor(y / 4);
      const bx = (x + (row % 2 ? 3 : 0)) % 6;
      if (y % 4 === 3 || bx === 0) return 'h';
      return lit ? 'j' : 'i';
    };
    const windows = (x0: number, x1: number, y: number): void => {
      for (let x = x0; x <= x1 - 3; x += 7) {
        c.rect(x, y, 3, 5, 'z');
        c.rect(x, y + 2, 3, 3, hash(x, y, 91) < 0.75 ? 'n' : 'o');
      }
    };
    const cone = (cx: number, top: number, h: number, hw: number): void => {
      for (let y = top; y <= top + h; y++) {
        const w = ((y - top) / h) * hw;
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++)
          c.set(x, y, (y - top) % 3 === 2 ? 'p' : x < cx - w * 0.3 ? 'q' : 'p');
      }
      c.rect(cx, top - 6, 1, 6, 'x');
      c.rect(cx + 1, top - 6, 4, 3, 'u');
    };
    const tower = (x0: number, x1: number, top: number, bottom: number, lit: boolean): void => {
      c.each((x, y) => (x >= x0 && x <= x1 && y >= top && y <= bottom ? block(x, y, lit) : null));
      for (let x = x0; x <= x1; x += 4) c.rect(x, top - 3, 2, 3, lit ? 'j' : 'i');
    };
    // The keep (back, centre), with its windows.
    tower(40, 71, 10, 50, false);
    windows(43, 70, 16);
    windows(43, 70, 28);
    // Tall towers either side of the keep, red cones.
    tower(28, 39, 16, 52, true);
    tower(72, 83, 16, 52, false);
    cone(34, 2, 13, 7.5);
    cone(78, 2, 13, 7.5);
    windows(31, 39, 24);
    windows(75, 83, 24);
    // The curtain wall across the front.
    c.each((x, y) => (x >= 8 && x <= 103 && y >= 40 && y <= 66 ? block(x, y, x < 40) : null));
    for (let x = 8; x <= 103; x += 4) c.rect(x, 37, 2, 3, x < 40 ? 'j' : 'i');
    windows(13, 40, 46);
    windows(72, 100, 46);
    // Corner towers.
    tower(0, 13, 30, 66, true);
    tower(98, 111, 30, 66, false);
    windows(4, 12, 38);
    windows(101, 110, 38);
    // Banners with the horned mark.
    for (const bx of [24, 84]) {
      c.rect(bx, 44, 6, 14, 'u');
      c.rect(bx + 5, 44, 1, 14, 'p');
      c.set(bx + 1, 47, 's');
      c.set(bx + 4, 47, 's');
      c.rect(bx + 1, 48, 4, 3, 'v');
      c.set(bx + 2, 58, 'u');
      c.set(bx + 3, 58, 'u');
    }
    // The marquee of lit bulbs over the gate arch, and the arch (the gate itself is the node).
    c.rect(41, 33, 30, 8, 'w');
    c.rect(42, 34, 28, 6, 'z');
    for (let x = 43; x < 70; x += 2) {
      c.set(x, 35, x % 4 === 1 ? 'n' : 'o');
      c.set(x + 1, 38, x % 4 === 1 ? 'o' : 'n');
    }
    c.ellipse(56, 52, 11, 9, 'h');
    c.rect(45, 52, 22, 15, 'h');
    // The lava moat along the foot.
    c.each((x, y) => {
      if (y < 66 || y > 71) return null;
      if (y === 66) return 'p';
      return hash(x, y, 92) < 0.15 ? 'r' : y === 67 ? 'q' : x % 7 === 3 ? 'r' : 'q';
    });
    c.outline('0', (_x, y) => y < 66);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Node markers                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

const INK = (body: string, dark: string, light: string, mark: string): SpaceInk => ({
  shadow: '1',
  dark,
  body,
  light,
  mark,
  outline: '0',
});
const RING = { dark: '8', light: '9' };

/**
 * The castle's gate (the BOWSER'S CASTLE node), 32×40 standing on its tile in front of the castle:
 * a stone gatehouse over the moat, a spiked portcullis down on red light, the stair road's top
 * step; cleared, the portcullis is up and the Mushroom Kingdom's pink flag flies over it.
 */
function castleGate(cleared: boolean): string {
  return frame(cleared ? 'castle-gate-cleared' : 'castle-gate', 32, 40, (c) => {
    // Gatehouse.
    c.each((x, y) => {
      if (x < 3 || x > 28 || y < 12 || y > 35) return null;
      const row = Math.floor(y / 4);
      if (y % 4 === 3 || (x + (row % 2 ? 3 : 0)) % 6 === 0) return 'h';
      return x < 10 ? 'j' : 'i';
    });
    for (let x = 3; x <= 27; x += 4) c.rect(x, 9, 2, 3, 'i');
    // Arch and portcullis.
    c.ellipse(16, 25, 7, 6, 'z');
    c.rect(9, 25, 14, 11, 'z');
    if (cleared) {
      for (const x of [10, 13, 16, 19, 22]) c.rect(x, 20, 1, 3, 'x');
      c.rect(10, 31, 12, 5, '5');
    } else {
      c.rect(10, 29, 12, 7, 'q');
      for (const x of [10, 13, 16, 19, 22]) {
        c.rect(x, 20, 1, 15, 'x');
        c.set(x, 35, 'v');
      }
      for (const y of [24, 29]) c.rect(9, y, 14, 1, 'w');
    }
    // Steps at its foot.
    c.rect(8, 36, 16, 2, '6');
    c.rect(8, 38, 16, 2, '5');
    // The flag.
    c.rect(15, 0, 1, 9, 'x');
    if (cleared) {
      c.rect(16, 0, 8, 5, 't');
      c.ellipse(20, 2.5, 1.5, 1.5, 'v');
    } else {
      c.rect(16, 0, 8, 5, 'u');
      c.set(18, 1, 's');
      c.set(21, 1, 's');
    }
    c.outline('0');
  });
}

export function nodeFrames(): Record<string, string> {
  return {
    open: space(book, 'node-open', INK('q', 'p', 'r', 'v'), 'none', RING),
    cleared: space(book, 'node-cleared', INK('f', 'e', 'g', 'v'), 'star', RING),
    start: space(book, 'node-start', INK('l', 'k', 'm', 'v'), 'none', RING),
    castle: castleGate(false),
    castleCleared: castleGate(true),
  };
}

/** The node marker on the VALLEY OF BOWSER page (above-render AboveLook.node). */
export function valleyNodeFrame(
  kind: MapNode['kind'],
  s: { cleared: boolean; secret: boolean },
): string | null {
  if (kind === 'castle') return s.cleared ? 'castle-gate-cleared' : 'castle-gate';
  if (kind === 'start') return 'node-start';
  if (kind !== 'level') return null;
  return s.cleared ? 'node-cleared' : 'node-open';
}

/* ---------------------------------------------------------------------------------------------- */
/* The page's ground                                                                               */
/* ---------------------------------------------------------------------------------------------- */

/** The open roads: pale tan, as the Valley's, a light halo on the dark rock. */
const ROAD_INK = { rim: '4', body: '5', light: '6', speck: '4', halo: '3' };

/** The road joins' names, by mask (1 n, 2 e, 4 s, 8 w); painted with the sheet. */
export const VALLEY_ROAD_FRAMES: readonly string[] = roadNames('road');

const WET = new Set(['~', '=']);

const grounds = new WeakMap<readonly string[], AboveGround>();

/**
 * The ground of the VALLEY OF BOWSER page (valley-of-bowser.ts's legend): the floor, the ledge, the
 * low shelf, the cliffs between them (a cliff under the ledge is the ledge's; under the floor, the
 * floor's), the stair road, the pools. A shore tile takes the ground most of its neighbours have.
 */
export function valleyGround(tiles: readonly string[]): AboveGround {
  const hit = grounds.get(tiles);
  if (hit) return hit;
  const b = groundBuilder(tiles);
  for (let i = 0; i < b.count; i++) b.tile(i);
  grounds.set(tiles, b.out);
  return b.out;
}

/** valleyGround's steps: one ground tile each (a lazy sheet's prepaint), then the cache. */
function groundSteps(tiles: readonly string[]): (() => void)[] {
  if (grounds.has(tiles)) return [];
  const b = groundBuilder(tiles);
  return [
    ...Array.from({ length: b.count }, (_, i) => () => b.tile(i)),
    () => void (grounds.has(tiles) || grounds.set(tiles, b.out)),
  ];
}

/** Works out the VALLEY OF BOWSER page's ground a tile at a time, in row order (`tile(i)`, i < count). */
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
  const SHORE = '82461397qezc[]nu';
  /** A shore tile's ground: the ledge if any ledge lies within two tiles, else the shelf, else the floor. */
  const baseAt = (x: number, y: number): string => {
    if (!SHORE.includes(ch(x, y))) {
      const n = [ch(x - 1, y), ch(x + 1, y), ch(x, y + 1), ch(x, y - 1)];
      for (const k of [',', ':']) if (n.filter((c) => c === k).length >= 2) return k;
      return '#';
    }
    for (const k of [',', ':'])
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (ch(x + dx, y + dy) === k) return k;
    return '#';
  };
  /** Each ground's level: the ledge high, the floor, the shelf low; a tile below a side neighbour shows the drop. */
  const LEVEL: Record<string, number> = { ',': 2, '#': 1, ':': 0 };
  const levelAt = (x: number, y: number): number => {
    if (x < 0 || x > 15 || y < 2) return -1;
    const c = ch(x, y);
    if (c === '^' || c === 'G' || WET.has(c)) return -1;
    return LEVEL[c === ',' || c === ':' ? c : baseAt(x, y)] ?? -1;
  };
  const plain = (c: string, v: number): string => (c === ',' ? ledge(v) : c === ':' ? shelf(v) : floor(v));
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
      const sides: Sides = { n: wetAt(x, y - 1), e: wetAt(x + 1, y), s: wetAt(x, y + 1), w: wetAt(x - 1, y) };
      let corners = '';
      if (sides.n && sides.w && !wetAt(x - 1, y - 1)) corners += 'a';
      if (sides.n && sides.e && !wetAt(x + 1, y - 1)) corners += 'b';
      if (sides.s && sides.e && !wetAt(x + 1, y + 1)) corners += 'c';
      if (sides.s && sides.w && !wetAt(x - 1, y + 1)) corners += 'd';
      f0.push(pool(sides, corners, 0));
      f1.push(pool(sides, corners, 1));
      return;
    }
    let g: string;
    if (y < 2) g = band(x);
    else if (c === '^' || c === 'G') {
      const cl = (k: string) => k === '^' || k === 'G';
      const top = baseAt(x, y - 1) === ',' || ch(x, y - 1) === ',' ? 'ledge' : 'floor';
      const s: Sides = { n: cl(ch(x, y - 1)), e: cl(ch(x + 1, y)), s: cl(ch(x, y + 1)), w: cl(ch(x - 1, y)) };
      g = c === 'G' ? stairs() : cliff(s, top);
    } else {
      g = plain(c === ',' || c === ':' ? c : baseAt(x, y), v);
      const me = levelAt(x, y);
      g = dropEdge(g, levelAt(x - 1, y) > me, levelAt(x + 1, y) > me);
    }
    f0.push(g);
    f1.push(g);
    const stand = (fr: string, dy = 0): void =>
      void scenery.push({ frame: fr, x: x * 16, y: y * 16 + dy, feet: y * 16 + 16 });
    if (c === 'Y') stand(stalagmite(), -16);
    else if (c === 'R') stand(boulder());
    else if (c === 'X') stand(brazier(), -16);
  };
  return { count: tiles.length * 16, tile, out: { frames: [f0, f1], wet, scenery } };
}

/**
 * Every frame of the sheet, with the grounds of the pages given, as small painting steps: a frame
 * or a few small ones, a road join, a ground tile (a landmark is one step: it paints as a whole).
 */
function paintSteps(pages: readonly (readonly string[])[]): (() => void)[] {
  const steps: (() => void)[] = [];
  const add = (f: () => unknown): void => void steps.push(() => void f());
  for (let v = 0; v < 4; v++) {
    add(() => floor(v));
    add(() => ledge(v));
    add(() => shelf(v));
  }
  add(stalagmite);
  add(boulder);
  add(brazier);
  add(pipe);
  add(starPad);
  add(tower);
  add(bowserCastle);
  add(nodeFrames);
  steps.push(...roadSteps(book, 'road', ROAD_INK));
  for (const tiles of pages) steps.push(...groundSteps(tiles));
  return steps;
}

/**
 * The `valley-above` sheet: every frame, with the grounds of the pages given (after autoShore),
 * painted the first time the game draws from it, or ahead of that in slices while a map idles
 * (lazySheet), never when the game loads.
 */
export function valleyAboveSheet(pages: readonly (readonly string[])[]): LazySheetDef {
  return lazySheet(
    'valley-above',
    () => paintSteps(pages),
    () => F,
  );
}

/** How many of the sheet's frames are painted so far (0 until the Valley first shows). */
export const valleyPainted = (): number => book.size;
