import { swapColors } from '@engine/gfx/pixelart';

/*
 * World map markers (original art), drawn with the items palette (see items.ts for the roles):
 * level dots (open yellow, cleared red, start blue, bonus green), the castle icon (a green flag on
 * top once cleared, with a white halo so it stands out on any page) and the small dot the paths
 * are drawn with.
 */

const nodeOpen = [
  '................',
  '................',
  '................',
  '................',
  '....00000000....',
  '..006666555500..',
  '.06665555555550.',
  '.06555555555590.',
  '.05555555555990.',
  '.05555555599990.',
  '..009999999900..',
  '....00000000....',
  '................',
  '................',
  '................',
  '................',
];

const castleBody = [
  '..000.0000.000..',
  '..0b0.0bb0.0b0..',
  '..0b000bb000b0..',
  '..0bbbbbbbbbb0..',
  '..0bb0bbbb0bb0..',
  '..0bbbbbbbbbb0..',
  '..0bbbb00bbbb0..',
  '..0bbb0000bbb0..',
  '..0bbb0000bbb0..',
  '..000000000000..',
  '................',
  '................',
];

const castleFlag = ['.......0444.....', '.......044......', '.......04.......', '.......0........'];

/**
 * A 1 px white halo around a frame's shape, so it reads on any page background (World 8's grey
 * castle walls included). Gaps one pixel wide between two parts of the shape (the battlements)
 * stay open.
 */
export function halo(rows: readonly string[], color = '1'): string[] {
  const at = (x: number, y: number) => rows[y]?.[x] ?? '.';
  const solid = (x: number, y: number) => at(x, y) !== '.';
  return rows.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch !== '.') return ch;
        if (solid(x - 1, y) && solid(x + 1, y)) return ch;
        const near = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
        return near ? color : ch;
      })
      .join(''),
  );
}

const pathDot = [
  '........',
  '........',
  '...00...',
  '..0330..',
  '..0330..',
  '...00...',
  '........',
  '........',
];

export const mapIconFrames: Record<string, readonly string[]> = {
  'map-node-open': nodeOpen,
  'map-node-cleared': swapColors(nodeOpen, { '5': '2', '6': 'd', '9': '8' }),
  'map-node-start': swapColors(nodeOpen, { '5': 'e', '6': 'a', '9': 'c' }),
  'map-node-bonus': swapColors(nodeOpen, { '5': '4', '6': '1', '9': '0' }),
  'map-castle': halo([...castleFlag.map(() => '................'), ...castleBody]),
  'map-castle-cleared': halo([...castleFlag, ...castleBody]),
  'map-path-dot': pathDot,
};
