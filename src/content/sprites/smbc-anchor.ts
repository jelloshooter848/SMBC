/**
 * Feet-anchored frames for the Classic SMBC heroes drawn at the original 3.1.21 sizes (R1 redraw).
 *
 * The original places every pose by its registration point, the centre of the feet ("origin"),
 * and each pose's art by its top-left from there (ANIMATION_CATALOGUE numbers, NES px). Here every
 * pose of a hero is painted into one fixed canvas whose origin sits at column `cx` (the line
 * between pixels cx-1 and cx) on the canvas's bottom edge, so a hero's poses all stand on the
 * same ground line and turn around the same centre. The hero's sprite() then draws the canvas
 * with `canvasOffsets` (the origin under the centre of the hitbox's bottom edge).
 *
 * The art itself is drawn here by hand, as text rows in each hero's own palette roles.
 */

/** A hero's frame canvas: `w` x `h` px, origin at column `cx` on the bottom edge. */
export interface SmbcCanvas {
  readonly w: number;
  readonly h: number;
  readonly cx: number;
}

/** One layer: rows of art with its top-left at (x, y) from the origin (y < 0 is up). */
export type SmbcLayer = readonly [rows: readonly string[], x: number, y: number];

/** The layers painted in order (later on top) into canvas `c`. Rows may be ragged. */
export function anchored(c: SmbcCanvas, ...layers: SmbcLayer[]): string[] {
  const out = Array.from({ length: c.h }, () => Array.from({ length: c.w }, () => '.'));
  for (const [rows, x, y] of layers) {
    const left = c.cx + Math.round(x);
    const top = c.h + Math.round(y);
    rows.forEach((row, dy) => {
      const line = out[top + dy];
      if (!line) return;
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx] as string;
        const tx = left + dx;
        if (ch !== '.' && tx >= 0 && tx < c.w) line[tx] = ch;
      }
    });
  }
  return out.map((r) => r.join(''));
}

/**
 * The draw offsets (SpriteSpec.offsetX / offsetY) that put canvas `c`'s origin under the centre
 * of a `bodyW` x `bodyH` px hitbox's bottom edge. Turning (flip) mirrors about the same line.
 */
export function canvasOffsets(
  c: SmbcCanvas,
  bodyW: number,
  bodyH: number,
): { offsetX: number; offsetY: number } {
  return { offsetX: c.cx - bodyW / 2, offsetY: c.h - bodyH };
}

/** The drawn box of `rows` (no transparent border): x, y, w, h in the frame. */
export function drawnBox(rows: readonly string[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (r[x] === '.') continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  });
  if (x1 < 0) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
