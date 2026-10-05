import { swapColors } from '@engine/gfx/pixelart';

/*
 * World map markers (original art), drawn with the items palette (see items.ts for the roles):
 * level dots (open yellow, cleared red, start blue, bonus green), the castle icon (a green flag on
 * top once cleared) and the small dot the paths are drawn with.
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
  'map-castle': [...castleFlag.map(() => '................'), ...castleBody],
  'map-castle-cleared': [...castleFlag, ...castleBody],
  'map-path-dot': pathDot,
};
