/**
 * A small pixel canvas for computed art (Sophia's batch): shapes are filled in palette chars on a
 * grid and read back as the text rows a SpriteDef stores. Nothing here is traced; it only saves
 * hand-placing every pixel of round wheels, domes and blasts.
 */

export type Rows = readonly string[];

export class Canvas {
  readonly px: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
    fill = '.',
  ) {
    this.px = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }

  static from(rows: Rows): Canvas {
    const c = new Canvas(rows[0]?.length ?? 0, rows.length);
    c.paste(rows, 0, 0);
    return c;
  }

  get(x: number, y: number): string {
    return this.px[y]?.[x] ?? '.';
  }

  set(x: number, y: number, c: string): this {
    const row = this.px[y];
    if (row && x >= 0 && x < this.w) row[x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: string): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: string): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
    return this;
  }

  /** A filled ellipse centred on (cx, cy) (pixel centres at +0.5). */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: string | ((x: number, y: number) => string),
  ): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof c === 'string' ? c : c(x, y));
      }
    return this;
  }

  disc(cx: number, cy: number, r: number, c: string | ((x: number, y: number) => string)): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  /** A filled polygon (even-odd, sampled at pixel centres). */
  poly(points: readonly (readonly [number, number])[], c: string): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i] as readonly [number, number];
          const [xj, yj] = points[j] as readonly [number, number];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    return this;
  }

  /** A line from (x0, y0) to (x1, y1), `t` pixels thick. */
  line(x0: number, y0: number, x1: number, y1: number, c: string, t = 1): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.rect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t, c);
    }
    return this;
  }

  /** Paint the opaque pixels of `rows` at (dx, dy); `flip` mirrors them first. */
  paste(rows: Rows, dx: number, dy: number, flip = false): this {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[flip ? row.length - 1 - x : x] as string;
        if (ch !== '.') this.set(dx + x, dy + y, ch);
      }
    });
    return this;
  }

  /** Recolour every pixel for which `pick` returns a char. */
  map(pick: (c: string, x: number, y: number) => string | undefined): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const n = pick(this.get(x, y), x, y);
        if (n !== undefined) this.set(x, y, n);
      }
    return this;
  }

  /** Ring every shape with `edge` in the transparent pixels beside it (4-neighbours). */
  outline(edge = '0'): this {
    const marks: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        const near = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        if (near.some((n) => n !== '.' && n !== edge)) marks.push([x, y]);
      }
    for (const [x, y] of marks) this.set(x, y, edge);
    return this;
  }

  rows(): string[] {
    return this.px.map((r) => r.join(''));
  }
}

/** A small deterministic hash in [0, 1). */
export const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

export const recolour = (rows: Rows, map: Record<string, string>): string[] =>
  rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));

export const flipX = (rows: Rows): string[] => rows.map((r) => [...r].reverse().join(''));
export const flipY = (rows: Rows): string[] => [...rows].reverse();

/** A quarter turn clockwise of a square (or any) frame: its top edge becomes its right edge. */
export const turnCw = (rows: Rows): string[] => {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  return Array.from({ length: w }, (_, y) =>
    Array.from({ length: h }, (_, x) => rows[h - 1 - x]?.[y] ?? '.').join(''),
  );
};

/**
 * Turn a frame by `deg` degrees clockwise about its centre, keeping its size. Each pixel takes
 * the commonest colour of 4x4 samples (when at least half of them land on the art), which keeps
 * thin lines whole far better than one nearest-pixel sample; the result is outlined again.
 * Used for the 45-degree corner frames between the floor, wall and ceiling poses.
 */
export const rotate = (rows: Rows, deg: number, edge = '0'): string[] => {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const a = (-deg * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const k = 4;
  const out = draw(w, h, (x, y) => {
    const votes = new Map<string, number>();
    let opaque = 0;
    for (let j = 0; j < k; j++)
      for (let i = 0; i < k; i++) {
        const dx = x + (i + 0.5) / k - cx;
        const dy = y + (j + 0.5) / k - cy;
        const sx = Math.floor(cx + dx * Math.cos(a) - dy * Math.sin(a));
        const sy = Math.floor(cy + dx * Math.sin(a) + dy * Math.cos(a));
        const ch = rows[sy]?.[sx] ?? '.';
        if (ch === '.') continue;
        opaque++;
        votes.set(ch, (votes.get(ch) ?? 0) + 1);
      }
    if (opaque * 2 < k * k) return '.';
    let best = '.';
    let n = 0;
    for (const [ch, v] of votes) if (v > n) [best, n] = [ch, v];
    return best;
  });
  return Canvas.from(out).outline(edge).rows();
};

/** 3x5 capital letters for capsules and icons. */
export const LETTERS: Record<string, Rows> = {
  G: ['111', '1..', '1.1', '1.1', '111'],
  P: ['11.', '1.1', '11.', '1..', '1..'],
  H: ['1.1', '1.1', '111', '1.1', '1.1'],
};

/**
 * Cells on a 16x16 torus: each pixel belongs to its nearest seed (wrapping), so the pattern tiles
 * both ways. Returns the cell id per pixel.
 */
export const cells = (seeds: readonly (readonly [number, number])[], squash = 1.3): number[][] =>
  Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      let best = 0;
      let bestD = Infinity;
      seeds.forEach(([sx, sy], i) => {
        const dx = Math.min(Math.abs(x - sx), 16 - Math.abs(x - sx));
        const dy = Math.min(Math.abs(y - sy), 16 - Math.abs(y - sy));
        const d = dx * dx + dy * dy * squash;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    }),
  );

/**
 * Shade a cell map like stones: a seam where the cell below or to the right differs, a lit edge
 * where the cell above or to the left differs, a shadow one pixel in from the seam, the main
 * colour elsewhere, and a fleck on a few pixels.
 */
export const stones = (
  map: number[][],
  [seam, dark, main, lit]: readonly [string, string, string, string],
  fleck?: readonly [string, number, number],
): string[] => {
  const id = (x: number, y: number) => map[(y + 16) % 16]?.[(x + 16) % 16] ?? 0;
  return draw(16, 16, (x, y) => {
    const c = id(x, y);
    if (id(x + 1, y) !== c || id(x, y + 1) !== c) return seam;
    if (id(x - 1, y) !== c || id(x, y - 1) !== c) return lit;
    if (id(x + 2, y) !== c || id(x, y + 2) !== c) return dark;
    if (fleck && hash(x, y, fleck[2]) < fleck[1]) return fleck[0];
    return main;
  });
};
