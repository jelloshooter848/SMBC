/*
 * The select screen's Random slot (Classic mode, FU-4; original art): a large question mark the
 * height of a small hero, drawn with the items palette (0 black outline, 5 yellow, 6 light
 * yellow shine, 7 orange shade). `select-random-1` is its blink frame (the shine moves).
 */

const random0 = [
  '................',
  '....00000000....',
  '...0666655550...',
  '..065555555570..',
  '..055500005570..',
  '..05570..05570..',
  '..00000..05570..',
  '........055570..',
  '.......055770...',
  '......055770....',
  '.....055770.....',
  '.....05570......',
  '.....05570......',
  '.....00000......',
  '................',
  '.....00000......',
  '.....06570......',
  '.....05570......',
  '.....00000......',
  '................',
];

const random1 = random0
  .map((row) => row.replaceAll('6', '5'))
  .map((row, y) => (y === 3 ? '..065566555570..' : row));

export const selectRandomFrames: Record<string, readonly string[]> = {
  'select-random-0': random0,
  'select-random-1': random1,
};
