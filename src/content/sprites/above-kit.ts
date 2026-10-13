import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, hash } from './paint';

/*
 * Shared pieces for the map pages drawn from above (0.4.50, campaign play): World 1's kingdom sheet
 * worked out its roads, river and board spaces inline (sprites/kingdom.ts); Worlds 2 and 3
 * (hyrule-above.ts, megacity-above.ts) need the same pieces in their own colours, so they live
 * here, painted per sheet. Each sheet owns one `FrameBook`: a frame is painted once and named.
 *
 * Nothing is painted when a module loads: a sheet paints when the game first asks for it, the
 * first time its page shows (`lazySheet`), and a page's ground when its view is first built.
 *
 * Differences from kingdom.ts, on purpose:
 * - A road frame is see-through outside the road, so it lies on any ground (grass, sand, dirt,
 *   brick) and one set of 16 joins serves the whole page; the ground is drawn under it.
 * - A water bank facing south (land to the north) shows a short earth face before the waterline,
 *   the drop A Link to the Past shows on a north bank; banks take the land's own colours.
 */

type Rows = string[];

/** Sides joined to more of the same (roads, water, hedges), as 'nesw' with '-' for open. */
export interface Sides {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}
export const sideKey = (s: Sides): string =>
  `${s.n ? 'n' : '-'}${s.e ? 'e' : '-'}${s.s ? 's' : '-'}${s.w ? 'w' : '-'}`;

/** A sheet's frames, each painted once. */
export class FrameBook {
  readonly frames: Record<string, Rows> = {};

  /** Paints frame `name` once (w×h) and returns its name. */
  frame(name: string, w: number, h: number, paint: (c: Canvas) => void): string {
    if (!this.frames[name]) {
      const c = new Canvas(w, h);
      paint(c);
      this.frames[name] = c.rows();
    }
    return name;
  }

  rows(name: string): Rows {
    const f = this.frames[name];
    if (!f) throw new Error(`no frame ${name}`);
    return f;
  }

  /** Whether frame `name` is painted. */
  has(name: string): boolean {
    return !!this.frames[name];
  }

  /** Stores frame `name` as given (cut from a bigger painting) and returns its name. */
  put(name: string, rows: Rows): string {
    this.frames[name] = rows;
    return name;
  }

  /** How many frames are painted so far (none until the sheet or a page's ground is asked for). */
  get size(): number {
    return Object.keys(this.frames).length;
  }
}

/** A sheet painted on demand (lazySheet), in slices while the map idles or all at once. */
export interface LazySheetDef extends SpriteDef {
  /**
   * Paints more of the sheet for about `budgetMs` (at least one step: a frame, a group of frames or
   * a ground tile), resuming where it stopped; true once every frame is painted.
   */
  prepaint(budgetMs: number): boolean;
  /** Every frame is painted. */
  readonly ready: boolean;
}

/** Every lazy sheet by its id (its palette name). */
export const LAZY_SHEETS: ReadonlyMap<string, LazySheetDef> = new Map<string, LazySheetDef>();

/**
 * A sheet painted the first time its frames are read (the asset registry reads them when the game
 * first draws from it), or ahead of that a slice at a time (`prepaint`, while a map page idles),
 * then kept. `steps` lists the painting in small steps, run in order; `collect` returns every frame
 * once they are done. Registered by its palette name (the sheet's id) for prepaintSheet.
 */
export function lazySheet(
  palette: string,
  steps: () => readonly (() => void)[],
  collect: () => Record<string, readonly string[]>,
): LazySheetDef {
  let frames: Record<string, readonly string[]> | null = null;
  let queue: readonly (() => void)[] | null = null;
  let next = 0;
  const run = (over: () => boolean): void => {
    queue ??= steps();
    while (next < queue.length) {
      (queue[next++] as () => void)();
      if (over()) break;
    }
    if (next >= queue.length) frames = collect();
  };
  const def: LazySheetDef = {
    palette,
    get frames() {
      if (!frames) run(() => false);
      return frames as Record<string, readonly string[]>;
    },
    prepaint(budgetMs: number): boolean {
      if (frames) return true;
      const t0 = performance.now();
      run(() => performance.now() - t0 >= budgetMs);
      return frames !== null;
    },
    get ready() {
      return frames !== null;
    },
  };
  (LAZY_SHEETS as Map<string, LazySheetDef>).set(palette, def);
  return def;
}

/**
 * Paints more of lazy sheet `id` for about `budgetMs` (LazySheetDef.prepaint); true when it is
 * done, or is no lazy sheet.
 */
export function prepaintSheet(id: string, budgetMs: number): boolean {
  return LAZY_SHEETS.get(id)?.prepaint(budgetMs) ?? true;
}

/** A piece of standing scenery on a page: its frame's top-left, and the row under its feet. */
export interface AbovePiece {
  frame: string;
  x: number;
  y: number;
  feet: number;
}

/** What a page drawn from above works out its ground to (kingdom.ts KingdomGround's shape). */
export interface AboveGround {
  /** The ground frame of every tile (row-major, 16 a row), for each of the water's two frames. */
  frames: readonly [readonly string[], readonly string[]];
  /** Tiles a road never draws on (water; a bridge carries the road over it). */
  wet: readonly boolean[];
  /** The scenery standing on the tiles, by its feet. */
  scenery: readonly AbovePiece[];
}

/** A soft drop shadow on the ground under a thing (colour `c`), offset down and right. */
export function shadow(c: Canvas, cx: number, cy: number, rx: number, ry: number, col: string): void {
  c.ellipse(cx + 2, cy + 1, rx, ry, col);
}

/** A five-pointed star of colour `col`, outer radius `r`, centred at (cx, cy). */
export function star(c: Canvas, cx: number, cy: number, r: number, col: string): void {
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

/** Road colours: its rim (the outline against the ground), body, top-edge light and specks. */
export interface RoadInk {
  rim: string;
  body: string;
  light: string;
  speck: string;
  /** Optional seams across the road every few pixels (walkway panels), else none. */
  seam?: string;
  /** An outer outline one pixel outside the rim (dark worlds, or light ground), else none. */
  halo?: string;
}

/**
 * A road join (kingdom.ts road(), see-through outside the road): about ten pixels wide down the
 * middle of its tile and out through every joined side, rimmed, lit along its top edge.
 */
export function road(book: FrameBook, prefix: string, s: Sides, ink: RoadInk): string {
  return book.frame(`${prefix}-${sideKey(s)}`, 16, 16, (c) => {
    const lo = 3;
    const hi = 12;
    const inside = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x > 15 || y > 15) {
        // Off the tile: carries on only through a joined side.
        if (y < 0) return s.n && x >= lo && x <= hi;
        if (y > 15) return s.s && x >= lo && x <= hi;
        if (x < 0) return s.w && y >= lo && y <= hi;
        return s.e && y >= lo && y <= hi;
      }
      const core = x >= lo && x <= hi && y >= lo && y <= hi;
      const ns = x >= lo && x <= hi && ((s.n && y < lo) || (s.s && y > hi));
      const ew = y >= lo && y <= hi && ((s.w && x < lo) || (s.e && x > hi));
      const corner =
        (x === lo || x === hi) &&
        (y === lo || y === hi) &&
        !(y === lo ? s.n : s.s) &&
        !(x === lo ? s.w : s.e);
      return (core && !corner) || ns || ew;
    };
    c.each((x, y) => {
      if (!inside(x, y)) {
        if (!ink.halo) return null;
        const near = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
        return near ? ink.halo : null;
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1);
      if (edge) return ink.rim;
      if (!inside(x, y - 1)) return ink.light;
      if (ink.seam) {
        const vertical = (s.n || s.s) && !(s.e || s.w);
        if ((vertical ? y : x) % 5 === 2) return ink.seam;
      }
      const r = hash(x, y, 32);
      return r < 0.07 ? ink.speck : r > 0.93 ? ink.light : ink.body;
    });
  });
}

const maskSides = (m: number): Sides => ({ n: !!(m & 1), e: !!(m & 2), s: !!(m & 4), w: !!(m & 8) });

/** The 16 road joins' names by mask (1 n, 2 e, 4 s, 8 w), as kingdom.ts ROAD_FRAMES (not painted). */
export function roadNames(prefix: string): string[] {
  return Array.from({ length: 16 }, (_, m) => `${prefix}-${sideKey(maskSides(m))}`);
}

/** Paints the 16 road joins by mask, returning their names (roadNames). */
export function roadFrames(book: FrameBook, prefix: string, ink: RoadInk): string[] {
  return Array.from({ length: 16 }, (_, m) => road(book, prefix, maskSides(m), ink));
}

/** The 16 road joins as painting steps, one join each (a lazy sheet's steps). */
export function roadSteps(book: FrameBook, prefix: string, ink: RoadInk): (() => void)[] {
  return Array.from({ length: 16 }, (_, m) => () => void road(book, prefix, maskSides(m), ink));
}

/** Water colours, and the land colours of its banks. */
export interface WaterInk {
  deep: string;
  mid: string;
  light: string;
  /** The land's top colour at the very edge. */
  land: string;
  /** The bank: a lit lip, then its body (sand, quay stone). */
  bankLight: string;
  bank: string;
  /** The earth face of a bank seen from the south (water to the south of land). */
  face: string;
}

function ripples(c: Canvas, f: number, seed: number, ink: WaterInk): void {
  for (let i = 0; i < 3; i++) {
    const x = (Math.floor(hash(seed, i, 41) * 12) + f * 2) % 13;
    const y = Math.floor(hash(seed, i, 42) * 13) + 1;
    c.rect(x, y, 3, 1, ink.light);
    c.set(x + 1, y + 1, ink.deep);
  }
}

/**
 * Open water (kingdom.ts water()): ripples drifting in two frames; on every side that meets land a
 * bank. A north bank (land above) shows the land's lip, an earth face and a light waterline; the
 * other banks a lip of bank colour and a dark waterline. `corners`: land diagonals ('a' NW, 'b' NE,
 * 'c' SE, 'd' SW) with water on both sides beside them.
 */
export function water(
  book: FrameBook,
  prefix: string,
  s: Sides,
  corners: string,
  f: number,
  ink: WaterInk,
): string {
  return book.frame(`${prefix}-${sideKey(s)}-${corners}-${f}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, ink.mid);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) if (hash(x, y, 43) < 0.04) c.set(x, y, ink.deep);
    ripples(c, f, s.w ? 1 : 2, ink);
    const bank = (k: keyof Sides, d: number, along: number): string | null => {
      const lip = hash(along, 51) < 0.5 ? 0 : 1;
      if (k === 'n') {
        if (d < 1 + lip) return ink.land;
        if (d < 4 + lip) return d === 1 + lip ? ink.bankLight : ink.face;
        if (d === 4 + lip) return ink.light;
        return null;
      }
      if (d < 1 + lip) return ink.land;
      if (d < 3 + lip) return d === 1 + lip ? ink.bankLight : ink.bank;
      if (d === 3 + lip) return ink.deep;
      return null;
    };
    const sides: [keyof Sides, (d: number, a: number) => [number, number]][] = [
      ['n', (d, a) => [a, d]],
      ['s', (d, a) => [a, 15 - d]],
      ['w', (d, a) => [d, a]],
      ['e', (d, a) => [15 - d, a]],
    ];
    // South and side banks first, the north bank (with its face) over them.
    for (const [k, at] of [...sides.slice(1), sides[0] as (typeof sides)[number]]) {
      if (s[k]) continue;
      for (let d = 0; d < 6; d++)
        for (let a = 0; a < 16; a++) {
          const col = bank(k, d, a + (k === 'n' || k === 's' ? 0 : 100));
          const [x, y] = at(d, a);
          if (col) c.set(x, y, col);
        }
    }
    const at: Record<string, [number, number]> = { a: [0, 0], b: [15, 0], c: [15, 15], d: [0, 15] };
    for (const k of corners) {
      const [cx, cy] = at[k] as [number, number];
      c.each((x, y) => {
        const d = Math.floor(Math.hypot(x - cx, y - cy));
        return d < 5 ? bank(k === 'a' || k === 'b' ? 'n' : 's', d, 7) : null;
      });
    }
  });
}

/** Marker colours for a board space: its shadow, dark lip, body, light rim and the mark. */
export interface SpaceInk {
  shadow: string;
  dark: string;
  body: string;
  light: string;
  mark: string;
  outline: string;
}

/**
 * A round board space (kingdom.ts space()): a coloured disc with a light rim and a dark lip, sunk in
 * the ground, an optional star or keyhole. `ring`, when given, is a second rim colour outside the
 * disc (a stone or steel collar), for pages whose ground is close to the disc's colours.
 */
export function space(
  book: FrameBook,
  name: string,
  ink: SpaceInk,
  mark: 'none' | 'star' | 'key',
  ring?: { dark: string; light: string },
): string {
  return book.frame(name, 16, 16, (c) => {
    c.ellipse(8, 9.5, 7.5, 5.5, ink.shadow);
    if (ring) {
      c.ellipse(8, 8.5, 7.5, 5.5, (_x, y) => (y > 9 ? ring.dark : ring.light));
      c.ellipse(8, 8.5, 5.5, 3.8, (_x, y, d) => (d > 0.7 ? (y > 9 ? ink.dark : ink.light) : ink.body));
    } else c.ellipse(8, 8.5, 7, 5, (_x, y, d) => (d > 0.75 ? (y > 9 ? ink.dark : ink.light) : ink.body));
    if (mark === 'star') star(c, 8, 8.5, ring ? 3.5 : 4, ink.mark);
    if (mark === 'key') {
      c.rect(7, 6, 2, 2, ink.mark);
      c.rect(7, 8, 2, 3, ink.mark);
      c.set(6, 10, ink.mark);
      c.set(9, 10, ink.mark);
    }
    c.outline(ink.outline);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Cliffs, stairs, textured ground, roofs (0.4.53: Worlds 6 and 7; TD58's design)                 */
/* ---------------------------------------------------------------------------------------------- */

/** Cliff colours: the ground on top (its lip), the rock face, cracks, and the ground at its foot. */
export interface CliffInk {
  /** The plateau's ground at the lip, and its lit edge. */
  top: string;
  topLight: string;
  /** Rock face: shade, body, lit faces, cracks. */
  dark: string;
  body: string;
  light: string;
  crack: string;
  /** The ground round its ends and under its foot, and the shadow it casts there. */
  below: string;
  shade: string;
  outline: string;
}

/**
 * A cliff face ('^'), the drop between two levels seen from the south: packed boulders lit on their
 * upper left, a lip of the upper ground along its top when the tile above is no cliff, a dark foot
 * and a shadow when the tile below is none; its ends round off. The rocks repeat every 16 px, so
 * faces join their neighbours. (hyrule-above.ts cliff(), with the colours a parameter.)
 */
export function cliff(book: FrameBook, prefix: string, s: Sides, ink: CliffInk): string {
  return book.frame(`${prefix}-${sideKey(s)}`, 16, 16, (c) => {
    c.rect(0, 0, 16, 16, ink.below);
    const top = s.n ? 0 : 3;
    const foot = s.s ? 16 : 14;
    const inFace = (x: number, y: number): boolean => {
      if (y < top || y >= foot) return false;
      if (!s.w && x < 3 && (y - top < 3 - x || foot - 1 - y < 2 - x)) return false;
      if (!s.e && x > 12 && (y - top < x - 12 || foot - 1 - y < x - 13)) return false;
      return true;
    };
    const seeds: [number, number][] = [];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++)
        seeds.push([i * 5.3 + 1 + hash(i, j, 232) * 3.5, j * 5.3 + 1 + hash(i, j, 233) * 3.5]);
    c.each((x, y) => {
      if (!inFace(x, y)) return null;
      let d1 = 99;
      let d2 = 99;
      let sx = 0;
      let sy = 0;
      for (const [px, py] of seeds)
        for (const ox of [-16, 0, 16])
          for (const oy of [-16, 0, 16]) {
            const d = Math.hypot((x + 0.5 - px - ox) * 0.8, y + 0.5 - py - oy);
            if (d < d1) {
              d2 = d1;
              d1 = d;
              sx = px + ox;
              sy = py + oy;
            } else if (d < d2) d2 = d;
          }
      if (d2 - d1 < 1.1) return ink.crack;
      const l = x + 0.5 - sx + (y + 0.5 - sy);
      if (l < -2.2) return d1 < 2.6 ? ink.light : ink.body;
      if (l > 2.2) return ink.dark;
      return hash(x, y, 231) < 0.08 ? ink.dark : ink.body;
    });
    if (!s.n)
      for (let x = 0; x < 16; x++) {
        if (!inFace(x, top)) continue;
        c.set(x, top - 1, ink.top);
        c.set(x, top - 2, ink.topLight);
        c.set(x, top - 3, ink.top);
        c.set(x, top, ink.dark);
      }
    if (!s.s)
      for (let x = 0; x < 16; x++) {
        if (!inFace(x, foot - 1)) continue;
        c.set(x, foot - 1, ink.dark);
        c.set(x, foot, ink.shade);
        if (hash(x, 234) < 0.5) c.set(x, foot + 1, ink.shade);
      }
    c.outline(ink.outline, (x, y) => y >= top && y < foot && !inFace(x, y));
  });
}

/** Stairs cut down through a cliff tile (`face`: the cliff frame they cut), steps lit on top. */
export function stairs(
  book: FrameBook,
  name: string,
  face: string,
  ink: { dark: string; body: string; light: string; outline: string },
): string {
  return book.frame(name, 16, 16, (c) => {
    c.paste(book.rows(face));
    c.rect(3, 0, 10, 16, ink.dark);
    for (let y = 0; y < 16; y += 3) {
      c.rect(4, y, 8, 2, ink.light);
      c.rect(4, y + 2, 8, 1, ink.body);
    }
    c.rect(3, 0, 1, 16, ink.outline);
    c.rect(12, 0, 1, 16, ink.outline);
  });
}

/**
 * A plain ground tile: `base` with seeded specks of `dark` and `light` (density in [0, 1]) and,
 * when `joint` is given, a slab grid of that colour every `step` px (offset each row: paving).
 */
export function speckle(
  book: FrameBook,
  name: string,
  v: number,
  ink: { base: string; dark: string; light: string; dense?: number; joint?: string; step?: number },
): string {
  return book.frame(name, 16, 16, (c) => {
    const dense = ink.dense ?? 0.08;
    c.each((x, y) => {
      if (ink.joint) {
        const step = ink.step ?? 8;
        const row = Math.floor(y / step);
        if (y % step === step - 1 || (x + (row % 2 ? step / 2 : 0) + v * 3) % step === 0) return ink.joint;
      }
      const r = hash(x, y, v, 301);
      return r < dense ? ink.dark : r > 1 - dense * 0.7 ? ink.light : ink.base;
    });
  });
}

/**
 * A pitched or hipped roof seen from above and the south, filling the box (x0..x1, y0..y1): rows of
 * tiles, its ridge at `ridge` (a row inside the box), lit on its north slope, shaded on its south,
 * hips sloping in at the ends when `hip`; returns nothing (paints `c`).
 */
export function roof(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ink: { dark: string; body: string; light: string; ridge: string },
  hip = true,
): void {
  const ridge = y0 + Math.round((y1 - y0) * 0.38);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const inset = hip ? Math.max(0, Math.round((y < ridge ? ridge - y : 0) * 0.9)) : 0;
      if (x < x0 + inset || x > x1 - inset) continue;
      if (y === ridge) {
        c.set(x, y, ink.ridge);
        continue;
      }
      const north = y < ridge;
      const row = north ? ridge - y : y - ridge;
      const tile = (x + (row % 2 ? 2 : 0)) % 4 === 0 || row % 3 === 0;
      const edge = y === y1 || x === x0 + inset || x === x1 - inset;
      c.set(x, y, edge ? ink.dark : tile ? (north ? ink.body : ink.dark) : north ? ink.light : ink.body);
    }
}
