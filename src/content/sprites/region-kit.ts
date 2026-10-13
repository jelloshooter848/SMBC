import { hash } from './paint';
import {
  type AboveGround,
  type AbovePiece,
  type FrameBook,
  type Sides,
  roadNames,
  sideKey,
  star,
} from './above-kit';

/*
 * The map kit for pages drawn from above whose land has REGIONS (0.4.52, campaign play: World 4's
 * Planet Zebes, World 5's Transylvania; TD54's approved design). It adds to above-kit.ts what a
 * page of several grounds needs: the page's ground is painted as one 256×240 picture from its
 * tiles (the map legend, for walking) and its zones (WorldMapPage.zones, one region letter a
 * tile, for the look), then cut into 16×16 frames, identical tiles shared. Painting the page whole
 * lets the land have edges off the tile grid: soft seams between regions, ledges where a higher
 * region drops to a lower one, liquids with rounded banks, cliffs with a face and a lip.
 *
 * Nothing is painted when a module loads: a page's ground paints a tile at a time (`regionGround`
 * steps), the first time its page shows or ahead of that while a map idles (above-kit lazySheet).
 * Everything is drawn from shapes and seeded noise with the game's Canvas; nothing is traced.
 */

/* ---------------------------------------------------------------------------------------------- */
/* Noise                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in [0, 1): smooth blobs about `scale` px across. */
export function noise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** The two nearest points of a jittered grid (cells sx×sy px): a cell texture's skeleton. */
interface Cell {
  d1: number;
  d2: number;
  /** The nearest point's offset from the pixel. */
  dx: number;
  dy: number;
}

/** One cell result reused by every call (painting allocates nothing per pixel). */
const CELL: Cell = { d1: 0, d2: 0, dx: 0, dy: 0 };

function cell(x: number, y: number, sx: number, sy: number, seed: number, cheb: boolean): Cell {
  const cx = Math.floor(x / sx);
  const cy = Math.floor(y / sy);
  let d1 = 1e9;
  let d2 = 1e9;
  let bdx = 0;
  let bdy = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i;
      const gy = cy + j;
      const px = (gx + 0.15 + hash(gx, gy, seed) * 0.7) * sx;
      const py = (gy + 0.15 + hash(gx, gy, seed + 1) * 0.7) * sy;
      const dx = px - (x + 0.5);
      const dy = py - (y + 0.5);
      const d = cheb ? Math.max(Math.abs(dx) / sx, Math.abs(dy) / sy) * sx : Math.hypot(dx, dy * (sx / sy));
      if (d < d1) {
        d2 = d1;
        d1 = d;
        bdx = dx;
        bdy = dy;
      } else if (d < d2) d2 = d;
    }
  CELL.d1 = d1;
  CELL.d2 = d2;
  CELL.dx = bdx;
  CELL.dy = bdy;
  return CELL;
}

/** A stone texture's look (stones()). */
export interface StoneInk {
  /** Cell size, px. */
  sx: number;
  sy: number;
  seed: number;
  /** The cracks between stones, each stone's shade, body and light. */
  gap: string;
  dk: string;
  mid: string;
  lt: string;
  /** Angular stones (slabs) rather than round ones (bubble rock). */
  cheb?: boolean;
  /** How wide the cracks are (default 1.1). */
  crack?: number;
}

/**
 * A lumpy-stone texture from cells: each stone `mid`, lit along its top-left (`lt`), shaded along
 * its bottom-right (`dk`), with `gap` in the cracks. Rounded (bubble rock) or angular (`cheb`).
 */
export function stones(x: number, y: number, o: StoneInk): string {
  const c = cell(x, y, o.sx, o.sy, o.seed, o.cheb === true);
  const edge = c.d2 - c.d1;
  if (edge < (o.crack ?? 1.1)) return o.gap;
  const r = Math.min(o.sx, o.sy) * 0.5;
  // Light on the stone's upper left (the pixel is up-left of its centre), shade lower right.
  const lit = c.dx > 0 && c.dy > 0 && c.d1 > r * 0.25;
  const shade = c.dx < -0.5 && c.dy < -0.5 && c.d1 > r * 0.35;
  if (edge < 2.2 && c.dy < 0) return o.dk;
  if (lit) return o.lt;
  if (shade) return o.dk;
  return o.mid;
}

/* ---------------------------------------------------------------------------------------------- */
/* Roads and board spaces with a light edge (for dark ground)                                      */
/* ---------------------------------------------------------------------------------------------- */

/** A road's colours: a LIGHT outer edge (so it reads on dark ground), a dark kerb, the paving. */
export interface DeckInk {
  edge: string;
  kerb: string;
  dk: string;
  mid: string;
  lt: string;
  /** Paving: 'grit' speckles (a trail), 'slabs' (flagstones), 'plate' (a metal deck). */
  kind: 'grit' | 'slabs' | 'plate';
}

/**
 * A road join, see-through outside the road (above-kit road()'s shape): a 10 px band down the
 * middle of its tile and out through every joined side, a light edge, a dark kerb, the paving, its
 * far (north) side lit and its near side darker (3/4 view).
 */
function deckRoad(book: FrameBook, prefix: string, s: Sides, k: DeckInk): string {
  return book.frame(`${prefix}-${sideKey(s)}`, 16, 16, (c) => {
    const lo = 3;
    const hi = 12;
    const inside = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x > 15 || y > 15) {
        // Off the tile: the road goes on only through a joined side.
        if (x < 0) return s.w && y >= lo && y <= hi;
        if (x > 15) return s.e && y >= lo && y <= hi;
        if (y < 0) return s.n && x >= lo && x <= hi;
        return s.s && x >= lo && x <= hi;
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
    // How far in from the band's edge (0: the edge pixel), up to 3.
    const depth = (x: number, y: number): number => {
      for (let d = 0; d < 3; d++) {
        const r = d + 1;
        if (!inside(x - r, y) || !inside(x + r, y) || !inside(x, y - r) || !inside(x, y + r)) return d;
      }
      return 3;
    };
    c.each((x, y) => {
      if (!inside(x, y)) return null;
      const d = depth(x, y);
      if (d === 0) return k.edge;
      if (d === 1) return k.kerb;
      if (!inside(x, y - 3) && d === 2) return k.lt;
      if (!inside(x, y + 3) && d === 2) return k.dk;
      if (k.kind === 'slabs') {
        const row = Math.floor(y / 4);
        if (y % 4 === 3 || (x + (row % 2 ? 2 : 0)) % 5 === 0) return k.dk;
        return hash(x >> 2, row, 7) < 0.3 ? k.lt : k.mid;
      }
      if (k.kind === 'plate') {
        if (x % 8 === 7 || y % 8 === 7) return k.dk;
        if ((x % 8 === 1 && y % 8 === 1) || (x % 8 === 5 && y % 8 === 5)) return k.lt;
        return k.mid;
      }
      const r = hash(x, y, 32);
      return r < 0.08 ? k.dk : r > 0.9 ? k.lt : k.mid;
    });
  });
}

const maskSides = (m: number): Sides => ({ n: !!(m & 1), e: !!(m & 2), s: !!(m & 4), w: !!(m & 8) });

/** The 16 deck road joins by mask (above-kit roadNames: 1 n, 2 e, 4 s, 8 w), not painted. */
export const deckRoadNames = roadNames;

/** The 16 deck road joins as painting steps, one join each (a lazy sheet's steps). */
export function deckRoadSteps(book: FrameBook, prefix: string, ink: DeckInk): (() => void)[] {
  return Array.from({ length: 16 }, (_, m) => () => void deckRoad(book, prefix, maskSides(m), ink));
}

/** A board space's colours (ringSpace). */
export interface RingInk {
  /** The light outer ring, the dark sink under it, the outline. */
  ring: string;
  sink: string;
  out: string;
  /** The disc: its lit lip, shaded lip, body, highlight. */
  lip: string;
  dk: string;
  md: string;
  lt: string;
  /** The mark on it, and its colour. */
  mark: 'none' | 'star' | 'key' | 'dot';
  markCol: string;
}

/**
 * A round board space (World 1's node markers) with a LIGHT outer ring for dark ground: a disc sunk
 * in the ground, `mark` on it: a star (cleared), a keyhole (a secret exit), a dot (a start), none.
 */
export function ringSpace(book: FrameBook, name: string, o: RingInk): string {
  return book.frame(name, 16, 16, (c) => {
    c.ellipse(8, 9.5, 7.5, 5.5, o.sink);
    c.ellipse(8, 8.5, 7.5, 5.5, o.ring);
    c.ellipse(8, 8.5, 6.5, 4.5, (_x, y, d) => (d > 0.72 ? (y > 9 ? o.dk : o.lip) : o.md));
    c.ellipse(6.5, 7.2, 2.2, 1.2, (_x, _y, d) => (d < 1 ? o.lt : null));
    if (o.mark === 'star') star(c, 8, 8.6, 3.6, o.markCol);
    if (o.mark === 'dot') c.ellipse(8, 8.6, 1.6, 1.3, o.markCol);
    if (o.mark === 'key') {
      c.rect(7, 6, 2, 2, o.markCol);
      c.rect(7, 8, 2, 3, o.markCol);
      c.set(6, 10, o.markCol);
      c.set(9, 10, o.markCol);
    }
    c.outline(o.out);
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* A page's ground, painted whole                                                                  */
/* ---------------------------------------------------------------------------------------------- */

/** How a page's ground looks: each zone's colours, its liquids, cliffs and special tiles. */
export interface GroundLook {
  /** Frame-name prefix ('z4' → 'z4-g12' for ground, 'z4-w3' for a tile with liquid). */
  prefix: string;
  /** Legend chars drawn as liquid (lava, water; a bridge over them too). */
  wet: ReadonlySet<string>;
  /** Legend chars drawn as a cliff face (the ground drops to the zone below). */
  cliff: ReadonlySet<string>;
  /** Zone `z`'s ground at page pixel (x, y). */
  tex(z: string, x: number, y: number): string;
  /** Zone height (seams: the higher side gets the lit rim and casts a little ledge face). */
  rank(z: string): number;
  /** A zone's seam colours: its rim line, its lit lip, its ledge face. */
  seam(z: string): { line: string; lip: string; face: string };
  /**
   * A liquid pixel: `d` px from the nearest land (wobbled), animation frame `f`, the zone the
   * liquid lies in. Null: still the land's own ground (the bank's outer rim).
   */
  liquid(ch: string, z: string, x: number, y: number, d: number, f: number): string | null;
  /** A cliff pixel of zone `z` (the zone on top), tile-local (lx, ly), `ends` open at w/e. */
  cliffFace(
    z: string,
    x: number,
    y: number,
    lx: number,
    ly: number,
    ends: { w: boolean; e: boolean },
  ): string | null;
  /** A special walkable tile's pixel (an elevator, stairs), or null for plain ground. */
  special?(ch: string, z: string, x: number, y: number, lx: number, ly: number): string | null;
  /** The band under the header (rows 0-1). */
  band(x: number, y: number): string;
}

/** The standing pieces a tile's char puts on it (its scenery), zone `z`. */
export type Pieces = (ch: string, x: number, y: number, z: string) => AbovePiece[];

const W = 256;
const H = 240;

/** A page's ground being painted a tile at a time (regionGroundBuilder). */
export interface GroundBuilder {
  /** The painting steps still to run, in order. */
  readonly steps: readonly (() => void)[];
  /** Runs every step not run yet. */
  finish(): AboveGround;
  /** Every step has run. */
  readonly done: boolean;
}

/**
 * Paints a page's ground in steps: first which zone owns each pixel (a step a tile row: the zone
 * grid with its borders wobbled off the tile grid), then each tile's frame for the liquids' two
 * frames (a step a tile; identical tiles shared), then the standing scenery. The result has
 * above-kit AboveGround's shape: the tiles a road never draws on are the liquid ones (a bridge
 * carries the road over them).
 */
export function regionGroundBuilder(
  book: FrameBook,
  look: GroundLook,
  tiles: readonly string[],
  zones: readonly string[],
  pieces: Pieces,
): GroundBuilder {
  const chAt = (tx: number, ty: number): string =>
    tiles[Math.max(2, Math.min(14, ty))]?.[Math.max(0, Math.min(15, tx))] ?? '#';
  const zoneAt = (tx: number, ty: number): string =>
    zones[Math.max(2, Math.min(14, ty))]?.[Math.max(0, Math.min(15, tx))] ?? '?';
  const isWet = (tx: number, ty: number): boolean => look.wet.has(chAt(tx, ty));
  const isCliff = (tx: number, ty: number): boolean => look.cliff.has(chAt(tx, ty));
  const own = new Array<string>(W * H);
  const owner = (x: number, y: number): string =>
    own[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))] as string;

  /** A land pixel: its zone's texture, or a seam, a lit lip, a ledge face where zones meet. */
  const ground = (x: number, y: number): string => {
    const a = owner(x, y);
    const ra = look.rank(a);
    // Under a higher zone to the north: its ledge face, then this zone's rim line.
    for (let k = 1; k <= 3; k++) {
      const up = owner(x, y - k);
      if (up !== a && look.rank(up) > ra && owner(x, y - k + 1) === a)
        return k === 3 ? look.seam(a).line : look.seam(up).face;
    }
    if (owner(x + 1, y) !== a || owner(x - 1, y) !== a || owner(x, y + 1) !== a || owner(x, y - 1) !== a)
      return look.seam(a).line;
    for (const [dx, dy] of NEAR2) {
      const b = owner(x + dx, y + dy);
      if (b !== a) return ra >= look.rank(b) ? look.seam(a).lip : look.tex(a, x, y);
    }
    return look.tex(a, x, y);
  };

  /** A liquid tile's pixel distance to the nearest land, its pool's outer corners rounded off. */
  const landDistance = (x: number, y: number, tx: number, ty: number): number => {
    const lx = x & 15;
    const ly = y & 15;
    let d = 99;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        if ((!i && !j) || isWet(tx + i, ty + j)) continue;
        const qx = Math.max((tx + i) * 16, Math.min((tx + i) * 16 + 16, x + 0.5));
        const qy = Math.max((ty + j) * 16, Math.min((ty + j) * 16 + 16, y + 0.5));
        d = Math.min(d, Math.hypot(x + 0.5 - qx, y + 0.5 - qy));
      }
    const dn = isWet(tx, ty - 1) ? 99 : ly + 0.5;
    const ds = isWet(tx, ty + 1) ? 99 : 15.5 - ly;
    const dw = isWet(tx - 1, ty) ? 99 : lx + 0.5;
    const de = isWet(tx + 1, ty) ? 99 : 15.5 - lx;
    const R = 10;
    for (const [a, b] of [
      [dn, dw],
      [dn, de],
      [ds, dw],
      [ds, de],
    ] as const)
      if (a < R && b < R) d = Math.min(d, R - Math.hypot(R - a, R - b));
    return d + (noise(x, y, 6, 21) - 0.5) * 4.5;
  };

  /** A pixel of the picture for animation frame `f` (only liquids differ between the two). */
  const pixel = (x: number, y: number, f: number): string => {
    const tx = x >> 4;
    const ty = y >> 4;
    const lx = x & 15;
    const ly = y & 15;
    if (ty < 2) return look.band(x, y);
    const ch = chAt(tx, ty);
    const z = zoneAt(tx, ty);
    if (look.wet.has(ch)) return look.liquid(ch, z, x, y, landDistance(x, y, tx, ty), f) ?? ground(x, y);
    if (look.cliff.has(ch))
      return (
        look.cliffFace(z, x, y, lx, ly, { w: !isCliff(tx - 1, ty), e: !isCliff(tx + 1, ty) }) ?? ground(x, y)
      );
    return look.special?.(ch, z, x, y, lx, ly) ?? ground(x, y);
  };

  const byContent = new Map<string, string>();
  let count = 0;
  const f0: string[] = [];
  const f1: string[] = [];
  const wet: boolean[] = [];
  const scenery: AbovePiece[] = [];
  /** A tile's frame from its rows: an identical tile's name, or a new one. */
  const name = (rows: string[], liquid: boolean): string => {
    const key = rows.join('');
    let n = byContent.get(key);
    if (!n) {
      n = `${look.prefix}-${liquid ? 'w' : 'g'}${count++}`;
      byContent.set(key, n);
      book.put(n, rows);
    }
    return n;
  };
  const steps: (() => void)[] = [];
  // Which zone owns each pixel, a tile row at a time.
  for (let ty = 0; ty < 15; ty++)
    steps.push(() => {
      for (let y = ty * 16; y < ty * 16 + 16; y++)
        for (let x = 0; x < W; x++) {
          const wx = (noise(x, y, 9, 11) - 0.5) * 9;
          const wy = (noise(x, y, 9, 12) - 0.5) * 9;
          own[y * W + x] = zoneAt(Math.floor((x + wx) / 16), Math.floor((y + wy) / 16));
        }
    });
  // Each tile's frames.
  for (let i = 0; i < 240; i++)
    steps.push(() => {
      const tx = i & 15;
      const ty = i >> 4;
      const liquid = ty >= 2 && look.wet.has(chAt(tx, ty));
      const rows0: string[] = [];
      const rows1: string[] = [];
      for (let j = 0; j < 16; j++) {
        let r0 = '';
        let r1 = '';
        for (let k = 0; k < 16; k++) {
          const x = tx * 16 + k;
          const y = ty * 16 + j;
          const p = pixel(x, y, 0);
          r0 += p;
          r1 += liquid ? pixel(x, y, 1) : p;
        }
        rows0.push(r0);
        rows1.push(r1);
      }
      const a = name(rows0, liquid);
      f0.push(a);
      f1.push(liquid ? name(rows1, true) : a);
      wet.push(liquid);
      if (ty >= 2) scenery.push(...pieces(tiles[ty]?.[tx] ?? '#', tx, ty, zoneAt(tx, ty)));
    });
  let next = 0;
  const out: AboveGround = { frames: [f0, f1], wet, scenery };
  const b: GroundBuilder = {
    steps: steps.map((s, k) => () => {
      if (k !== next) return;
      s();
      next++;
    }),
    finish() {
      while (next < steps.length) (steps[next++] as () => void)();
      return out;
    },
    get done() {
      return next >= steps.length;
    },
  };
  return b;
}

/** The pixels two away (a zone's lit lip inside its seam). */
const NEAR2: readonly (readonly [number, number])[] = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
];

/**
 * A page's ground for a sheet (cached per tiles), and its steps for the sheet's lazy painting: the
 * sheet's `grounds` keeps one builder a page, so painting ahead and a first draw share the work.
 */
export class RegionGrounds {
  private readonly builders = new WeakMap<readonly string[], GroundBuilder>();

  constructor(
    private readonly book: FrameBook,
    private readonly look: GroundLook,
    private readonly pieces: Pieces,
  ) {}

  private builder(tiles: readonly string[], zones: readonly string[]): GroundBuilder {
    let b = this.builders.get(tiles);
    if (!b)
      this.builders.set(tiles, (b = regionGroundBuilder(this.book, this.look, tiles, zones, this.pieces)));
    return b;
  }

  /** The page's ground, painted now if it is not yet. */
  ground(tiles: readonly string[], zones: readonly string[]): AboveGround {
    return this.builder(tiles, zones).finish();
  }

  /** The page's ground as painting steps (a lazy sheet's), none once painted. */
  steps(tiles: readonly string[], zones: readonly string[]): (() => void)[] {
    const b = this.builder(tiles, zones);
    return b.done ? [] : [...b.steps];
  }
}
