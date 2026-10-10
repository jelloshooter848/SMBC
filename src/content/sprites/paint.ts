/*
 * A tiny pixel painter for art drawn from shapes (Kakariko Village's tiles, folk and heroes,
 * 0.4.41): a grid of palette characters ('.' is transparent) with rectangles, ellipses, pasted
 * pieces and a seeded hash for texture, so pieces that join up (paths, hedges, roofs, the pond)
 * can be drawn for every neighbour pattern without hand-drawing each one.
 */

export class Canvas {
  readonly g: string[][];

  constructor(
    readonly w = 16,
    readonly h = 16,
    fill = '.',
  ) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill(fill));
  }

  static from(rows: readonly string[]): Canvas {
    const c = new Canvas(rows[0]?.length ?? 0, rows.length);
    rows.forEach((r, y) => [...r].forEach((ch, x) => c.set(x, y, ch)));
    return c;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): string {
    return this.inside(x, y) ? (this.g[y]?.[x] as string) : '.';
  }

  set(x: number, y: number, c: string): void {
    if (this.inside(x, y) && c !== '') (this.g[y] as string[])[x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  /** Each pixel `fn` returns a colour for (null: leave it). */
  each(fn: (x: number, y: number, now: string) => string | null): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = fn(x, y, this.get(x, y));
        if (c !== null) this.set(x, y, c);
      }
  }

  /** Pixels inside the ellipse at (cx, cy) with radii (rx, ry), pixel centres measured. */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: string | ((x: number, y: number, d: number) => string | null),
  ): void {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const col = typeof c === 'string' ? c : c(x, y, d);
        if (col !== null) this.set(x, y, col);
      }
  }

  /** Draws `rows` with its top-left at (x, y) ('.' stays see-through). */
  paste(rows: readonly string[], x = 0, y = 0): void {
    rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && this.set(x + i, y + j, ch)));
  }

  /** Outlines the drawn shape: every see-through pixel touching a drawn one (4 ways) gets `c`. */
  outline(c: string, keep: (x: number, y: number) => boolean = () => true): void {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => this.get(x + (dx as number), y + (dy as number)) !== '.');
        if (near && keep(x, y)) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
  }

  /** A `w`×`h` piece of it starting at (x, y). */
  crop(x: number, y: number, w = 16, h = 16): string[] {
    return Array.from({ length: h }, (_, j) =>
      Array.from({ length: w }, (_, i) => this.get(x + i, y + j)).join(''),
    );
  }

  rows(): string[] {
    return this.g.map((r) => r.join(''));
  }
}

/** A seeded hash in [0, 1): the same numbers for the same arguments. */
export function hash(...n: number[]): number {
  let h = 0x2545f491;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x9e3779b1);
    h ^= h >>> 15;
  }
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 2 ** 32;
}

/** Mirrors rows left to right. */
export function mirror(rows: readonly string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

/** Swaps palette characters. */
export function recolor(rows: readonly string[], map: Readonly<Record<string, string>>): string[] {
  return rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));
}
