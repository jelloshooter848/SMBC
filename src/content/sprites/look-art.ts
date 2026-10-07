/**
 * Small pixel-art helpers for the campaign looks' tile and decor frames (zelda2-look.ts,
 * megaman-look.ts, brinstar-look.ts): frames computed from a pixel function, a deterministic
 * hash for speckle and texture, and row edits.
 */

export type Rows = readonly string[];

/** A small deterministic hash in [0, 1). */
export const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** A w x h frame from a pixel function (`.` is transparent). */
export const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));

/** The pixel at (x, y), transparent off the frame. */
export const at = (rows: Rows, x: number, y: number): string => rows[y]?.[x] ?? '.';

/** Every pixel through a colour map (unmapped colours stay). */
export const recolour = (rows: Rows, map: Record<string, string>): string[] =>
  rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));

/** `top`'s rows over the rest of `rest` (to `rest`'s height). */
export const over = (top: Rows, rest: Rows): string[] => [...top, ...rest.slice(top.length)];

/** Frames under their `<frame>@<theme>` names. */
export const themed = (frames: Record<string, Rows>, theme: string): Record<string, Rows> =>
  Object.fromEntries(Object.entries(frames).map(([name, rows]) => [`${name}@${theme}`, rows]));
