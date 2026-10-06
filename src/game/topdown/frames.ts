import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Turns a frame a quarter turn counter-clockwise: its top edge becomes its left edge. A wall or
 * door drawn for the north edge (outside at the top) becomes the west one (outside at the left).
 */
export function rotateCcw(rows: readonly string[]): string[] {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const out: string[] = [];
  for (let y = 0; y < w; y++) {
    let line = '';
    for (let x = 0; x < h; x++) line += rows[x]?.[w - 1 - y] ?? '.';
    out.push(line);
  }
  return out;
}

/** North-edge frames the top-down renderer also needs for the west edge (east is that, mirrored). */
export const SIDE_FRAMES = ['wall-top', 'door-open', 'door-locked', 'door-shut'] as const;

/**
 * The tile sheet with a `<frame>-side` for each of SIDE_FRAMES, rotated from the north frame,
 * unless the sheet already draws its own.
 */
export function withSideFrames(def: SpriteDef): SpriteDef {
  const frames: Record<string, readonly string[]> = { ...def.frames };
  for (const name of SIDE_FRAMES) {
    const north = def.frames[name];
    if (north && !frames[`${name}-side`]) frames[`${name}-side`] = rotateCcw(north);
  }
  return { ...def, frames };
}
