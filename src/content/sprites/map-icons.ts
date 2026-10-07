import { swapColors } from '@engine/gfx/pixelart';

/*
 * World map markers (original art), drawn with the items palette (see items.ts for the roles):
 * level dots (open yellow, cleared red, start blue, bonus green; secret exits pink, then pale pink,
 * with a keyhole and a white ring), warp pads (open, locked), the castle icon (a green flag on top
 * once cleared, with a white halo so it stands out on any page; pink with a keyhole door for a
 * castle with a secret exit) and the small dot the paths are drawn with.
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

/**
 * Secret-exit level dot (0.4.1; Super Mario World marks such levels in another colour): the
 * dot with a keyhole cut in its middle and a white ring around it, so it reads without colour
 * too. Open it is pink, cleared pale pink (never the plain yellow and red, even once found).
 */
const keyhole = new Set(['7,6', '8,6', '6,7', '7,7', '8,7', '9,7', '7,8', '8,8', '6,9', '7,9', '8,9', '9,9']);
const nodeSecret = halo(
  nodeOpen.map((row, y) => [...row].map((ch, x) => (keyhole.has(`${x},${y}`) ? '0' : ch)).join('')),
);

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

/** A secret-exit castle (Lost B-4): pink walls, and a keyhole for a door. */
const castleSecret = swapColors(
  castleBody.map((row, y) =>
    y === 5 || y === 7 ? '..0bbbb00bbbb0..' : y === 6 || y === 8 ? '..0bbb0000bbb0..' : row,
  ),
  { b: 'd' },
);

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

/**
 * Warp pad (0.4.0): a ringed purple and blue pad seen from above, a white sparkle over it. The
 * locked pad is dimmed to grey with a dark centre and no sparkle.
 */
const warpPad = [
  '......010.......',
  '.....01110......',
  '......010.......',
  '....00000000....',
  '..00cccccccc00..',
  '.0ccaaaaaaaacc0.',
  '0ccaa111111aacc0',
  '0cca11eeee11acc0',
  '0cca11eeee11acc0',
  '0ccaa111111aacc0',
  '.0ccaaaaaaaacc0.',
  '..00cccccccc00..',
  '....00000000....',
  '................',
  '................',
  '................',
];

const warpPadLocked = swapColors(
  warpPad.map((row, y) => (y < 3 ? '................' : row)),
  { c: 'b', a: 'b', '1': '3', e: '0' },
);

/*
 * Mini Game Arena pads (0.4.7): an emblem standing on a low round pad, outlined in black so it
 * reads on the checkered pitch. A gold trophy on a red pad for a mini game, a signpost on a
 * blue pad for a tutorial, a dim grey question mark on a dark pad for a game not found yet.
 * The arena's Return pad is the hub's warp pad (`map-warp`).
 */
const arenaPad = (ring: string, rim: string, middle: string): string[] =>
  [
    '...0000000000...',
    '.00RRRRRRRRRR00.',
    '0RRrrrMMMMrrrRR0',
    '0RRrrrMMMMrrrRR0',
    '.00RRRRRRRRRR00.',
    '...0000000000...',
  ].map((row) => [...row].map((c) => ({ R: ring, r: rim, M: middle })[c] ?? c).join(''));

/** A 10-row emblem, outlined in black, standing on a 6-row pad. */
const onPad = (emblem: readonly string[], pad: readonly string[]): string[] => [...halo(emblem, '0'), ...pad];

/** A gold cup with two handles on a brown base. */
const TROPHY = [
  '................',
  '...6555555559...',
  '.66.65555559.99.',
  '.6..65555559..9.',
  '..666555555999..',
  '.....655559.....',
  '......6559......',
  '.......59.......',
  '.......59.......',
  '.....999999.....',
];

/** A cream signboard pointing right, scribbled with brown text, on a brown post. */
const SIGNPOST = [
  '................',
  '..3333333333....',
  '..39993999333...',
  '..333333333333..',
  '..39399939933...',
  '..3333333333....',
  '.......99.......',
  '.......99.......',
  '.......99.......',
  '.......99.......',
];

/** A grey question mark. */
const QUESTION = [
  '................',
  '.....bbbbbb.....',
  '....bb....bb....',
  '..........bb....',
  '.........bb.....',
  '.......bbb......',
  '.......bb.......',
  '................',
  '.......bb.......',
  '................',
];

export const mapIconFrames: Record<string, readonly string[]> = {
  'map-node-open': nodeOpen,
  'map-node-cleared': swapColors(nodeOpen, { '5': '2', '6': 'd', '9': '8' }),
  'map-node-start': swapColors(nodeOpen, { '5': 'e', '6': 'a', '9': 'c' }),
  'map-node-bonus': swapColors(nodeOpen, { '5': '4', '6': '1', '9': '0' }),
  'map-node-secret': swapColors(nodeSecret, { '5': 'd', '6': '1', '9': 'c' }),
  'map-node-secret-cleared': swapColors(nodeSecret, { '5': '3', '6': '1', '9': 'd' }),
  'map-castle': halo([...castleFlag.map(() => '................'), ...castleBody]),
  'map-castle-cleared': halo([...castleFlag, ...castleBody]),
  'map-castle-secret': halo([...castleFlag.map(() => '................'), ...castleSecret]),
  'map-castle-secret-cleared': halo([...castleFlag, ...castleSecret]),
  'map-warp': warpPad,
  'map-warp-locked': warpPadLocked,
  'map-path-dot': pathDot,
  'map-arena-game': onPad(TROPHY, arenaPad('2', '8', '5')),
  'map-arena-tutorial': onPad(SIGNPOST, arenaPad('e', 'a', '1')),
  'map-arena-locked': onPad(QUESTION, arenaPad('b', '0', '0')),
};
