import type { MapActor, MapNode } from '@game/map/types';

/*
 * Helpers for authoring map pages: shores are generated from a sketch, paths from their corners.
 */

/** Chars that count as open water (or lava, clouds) beside land, for shore generation. */
export const SHORE_OPEN = new Set(['~', 'L', '=', 'I', '|', '{', '-', '}']);
const WATER = new Set(['~', 'L']);

/** Ground decorations that would leave a hard edge if placed right beside water. */
const INLAND = new Set([
  ...[',', '*', ':', 'o', 'T', 'Y', 'H', 'S', '^', 'R', 'P', 'X', '(', 'O', ')', '!', 'A'],
  // Hyrule (World 2): forest, the palace, ruins and graves.
  ...['5', '<', 'U', '>', 'Q', '@', 'y', 'Z', 'J'],
  // Mega City (World 3): city blocks, the lab, gearworks and Wily's fortress.
  ...['0', '&', '$', '"', '+', '?', '/', ';', '_', '`'],
]);

/** The round pond's tiles, row by row (4 wide, 3 tall); a sketch writes the whole block. */
export const POND_CHARS = 'abdfgilmprtv';
const POND_W = 4;

const at = (rows: readonly string[], x: number, y: number): string => {
  if (y < 0 || y >= rows.length || x < 0 || x >= 16) return '#'; // off the page: land goes on
  return (rows[y] as string)[x] as string;
};

/**
 * Turn every plain ground tile ('#') that touches water into the matching shore tile: edges
 * 8 2 4 6 (water to the north, south, west, east), outer corners 7 9 1 3, inner corners
 * q e z c (water only diagonally NW, NE, SW, SE) and bridge landings [ ] n u.
 */
export function autoShore(sketch: readonly string[]): string[] {
  return sketch.map((row, y) =>
    row
      .split('')
      .map((ch, x) => {
        if (ch !== '#') return ch;
        const open = (dx: number, dy: number) => SHORE_OPEN.has(at(sketch, x + dx, y + dy));
        const n = open(0, -1);
        const s = open(0, 1);
        const w = open(-1, 0);
        const e = open(1, 0);
        if (n && w) return '7';
        if (n && e) return '9';
        if (s && w) return '1';
        if (s && e) return '3';
        if (n) return at(sketch, x, y - 1) === 'I' ? 'n' : '8';
        if (s) return at(sketch, x, y + 1) === 'I' ? 'u' : '2';
        if (w) return at(sketch, x - 1, y) === '=' ? '[' : '4';
        if (e) return at(sketch, x + 1, y) === '=' ? ']' : '6';
        if (open(-1, -1)) return 'q';
        if (open(1, -1)) return 'e';
        if (open(-1, 1)) return 'z';
        if (open(1, 1)) return 'c';
        return '#';
      })
      .join(''),
  );
}

/** Problems a sketch would draw badly: land one tile thin between waters, decor on the waterline. */
export function sketchProblems(sketch: readonly string[]): string[] {
  const out: string[] = [];
  sketch.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string;
      const open = (dx: number, dy: number) => SHORE_OPEN.has(at(sketch, x + dx, y + dy));
      if (ch === '#' && ((open(0, -1) && open(0, 1)) || (open(-1, 0) && open(1, 0))))
        out.push(`land at ${x},${y} is one tile thin`);
      const pi = POND_CHARS.indexOf(ch);
      if (pi >= 0)
        for (let k = 0; k < POND_CHARS.length; k++) {
          const px = x - (pi % POND_W) + (k % POND_W);
          const py = y - Math.floor(pi / POND_W) + Math.floor(k / POND_W);
          if (sketch[py]?.[px] !== POND_CHARS[k]) out.push(`pond at ${x},${y} is not a whole block`);
        }
      if (INLAND.has(ch))
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (WATER.has(at(sketch, x + dx, y + dy))) out.push(`'${ch}' at ${x},${y} touches water`);
    }
  });
  return out;
}

/** Tile path through the given corners (each leg horizontal or vertical), both ends included. */
export function poly(...corners: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  corners.forEach(([x, y], i) => {
    if (i === 0) {
      out.push([x, y]);
      return;
    }
    const [px, py] = corners[i - 1] as [number, number];
    if (px !== x && py !== y) throw new Error(`poly: diagonal leg ${px},${py} -> ${x},${y}`);
    const n = Math.abs(x - px) + Math.abs(y - py);
    for (let k = 1; k <= n; k++) out.push([px + Math.sign(x - px) * k, py + Math.sign(y - py) * k]);
  });
  return out;
}

/** The standard node set of world `w`: start, W-1..W-3, the W-4 castle and the hidden bonus slot. */
export function worldNodes(
  w: number,
  start: [number, number],
  levels: [[number, number], [number, number], [number, number], [number, number]],
  bonus: [number, number],
): MapNode[] {
  return [
    { id: 'start', kind: 'start', x: start[0], y: start[1] },
    ...levels.map(([x, y], i): MapNode => ({
      id: `${w}-${i + 1}`,
      kind: i === 3 ? 'castle' : 'level',
      level: `${w}-${i + 1}`,
      x,
      y,
    })),
    { id: `bonus-${w}`, kind: 'bonus', x: bonus[0], y: bonus[1], unlock: `bonus-${w}` },
  ];
}

/** Shorthand for a decorative actor. */
export const actor = (type: string, x: number, y: number, props: MapActor['props'] = {}): MapActor => ({
  type,
  x,
  y,
  props,
});
