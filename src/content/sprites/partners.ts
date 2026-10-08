import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * The campaign's partners (docs/STORY.md 2.4-2.11, `partner x y who=<id>`): 1-1's villager, 1-2's
 * pipe keeper, the old man by 2-1's vine, the fairy in 2-1's clouds, Dr. Light, the bird statue, a
 * night-town local, Agent Irene and Lance, plus the cave doorway the old man stands in front of
 * (`decor x y kind=partners:cave`). Original 8-bit art
 * drawn here in the spirit of the NES games they come from (black outlines, flat colours); nothing
 * is traced.
 *
 * Conventions the game relies on:
 * - `<who>-0` is the idle frame and `<who>-1` the blink (for the statue: its eyes glowing
 *   brighter); the two differ only around the eyes. People are 16x32 and stand on their bottom
 *   row, seen from the front (the Mushroom Kingdom folk are Toad's 16x24); the seated statue is
 *   16x24, facing left. The fairy (16x16) floats; her `-1` is a wing beat.
 * - `cave` (32x40) is a small rock face with a dark doorway in the middle, standing on its bottom
 *   row.
 */

/**
 * `partners` index roles:
 *   0 black / outline  1 white           2 light grey      3 grey            4 dark grey
 *   5 skin             6 skin shade      7 robe red-brown  8 robe shade      9 bright red
 *   a light brown      b brown           c dark brown      d blue            e dark blue
 *   f glow yellow      g glow pale       h olive           i dark green      j pink
 *   k green            l pale blue
 */
export const partnersPalettes: Record<string, string[]> = {
  partners: [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.darkGray,
    NES.tan,
    NES.tanDark,
    NES.orangeBrown,
    NES.redDark,
    NES.redBright,
    NES.brownLight,
    NES.brown,
    NES.brownDark,
    NES.blueMid,
    NES.blueDark,
    NES.yellow,
    NES.yellowLight,
    NES.olive,
    NES.greenDark,
    NES.pink,
    NES.green,
    NES.blueLight,
  ],
};

type Rows = readonly string[];

/** `rows` with row `y` replaced (the blink frames). */
const swap = (rows: Rows, y: number, row: string): Rows => rows.map((r, i) => (i === y ? row : r));

/** The old man (2-1): bald, white brows and a long white beard, a red-brown robe, hands folded. */
const oldMan0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....05555550....',
  '...0555555550...',
  '...0511551150...',
  '...0505555050...',
  '..015555555510..',
  '..011656656110..',
  '..011111111110..',
  '.07011111111070.',
  '.07701111110770.',
  '0777701111077770',
  '0787770110777870',
  '0787777007777870',
  '0787777777777870',
  '0787706666077870',
  '0787705555077870',
  '0787770000777870',
  '0787777777777870',
  '0787777787777870',
  '0787777787777870',
  '0787777787777870',
  '0877777787777780',
  '0877777787777780',
  '0877777787777780',
  '0887777787777880',
  '0887777787777880',
  '0888888888888880',
  '0000000000000000',
];
const oldMan1 = swap(oldMan0, 8, '...0565555650...');

/** Dr. Light (3-1's pipe room): bald with white tufts, a white beard, a white lab coat. */
const drLight0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....05555550....',
  '...0555555550...',
  '..015555555510..',
  '..115055550511..',
  '..015555555510..',
  '...0116556110...',
  '...0111111110...',
  '....01111110....',
  '.001111dd111100.',
  '0111112dd2111110',
  '0121112dd2111210',
  '0121111221111210',
  '0121111311111210',
  '0121111311111210',
  '0121111311111210',
  '0121111311111210',
  '0121111311111210',
  '0561111311111650',
  '0561111311111650',
  '0121111311111210',
  '0122222322222210',
  '.00000000000000.',
  '...0eee00eee0...',
  '...0eee00eee0...',
  '...0eee00eee0...',
  '..0ccc0..0ccc0..',
  '..00000..00000..',
];
const drLight1 = swap(drLight0, 8, '..115655556511..');

/** The bird statue (4-1's pipe room): grey stone, seated on a plinth facing left, eyes aglow. */
const chozo0: Rows = [
  '................',
  '....0000........',
  '...022220.......',
  '..02222220......',
  '.0022f22220.....',
  '03322222220.....',
  '.0042222220.....',
  '...03222230.....',
  '...032222330....',
  '..03222222230...',
  '..032332222230..',
  '.0322332222230..',
  '.03222322222330.',
  '.03222232222330.',
  '.03222232222340.',
  '..0333333333340.',
  '..0444444444440.',
  '.000000000000000',
  '.022222222222220',
  '.032222222222230',
  '.033333333333330',
  '.034444444444430',
  '.044444444444440',
  '.000000000000000',
];
/** Glowing brighter: the eye pale, a halo of yellow round it. */
const chozo1 = swap(swap(swap(chozo0, 3, '..022f2220......'), 4, '.002fgf2220.....'), 5, '03322f22220.....');

/** A townsperson of the cursed night town (5-4): an olive robe, a brown hood, a rope belt. */
const townsperson0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....0bbbbbb0....',
  '...0bbbbbbbb0...',
  '...0bb5555bb0...',
  '...0b505505b0...',
  '...0b555555b0...',
  '...0bb5665bb0...',
  '..0cbbb55bbbc0..',
  '..0cbbbbbbbbc0..',
  '.0ihhhhhhhhhhi0.',
  '.0ihhhhaahhhhi0.',
  '.0ihhhhaahhhhi0.',
  '.0ih55haah55hi0.',
  '.0ihhhhaahhhhi0.',
  '.0ihhhhhahhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '.0ihhhhhihhhhi0.',
  '0iihhhhhihhhhii0',
  '0iiiiiiiiiiiiii0',
  '.000000..000000.',
];
const townsperson1 = swap(townsperson0, 8, '...0b565565b0...');

/** Agent Irene (6-2): long brown hair, a tan trench coat over a white collar, dark boots. */
const irene0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....0bbbbbb0....',
  '...0bbbbbbbb0...',
  '...0bb5555bb0...',
  '...0b505505b0...',
  '...0b555555b0...',
  '...0b556655b0...',
  '...0bb5555bb0...',
  '..0bbb0550bbb0..',
  '..0bb0aaaa0bb0..',
  '.0aaaaa11aaaaa0.',
  '.0abaaa11aaaba0.',
  '.0abaaabbaaaba0.',
  '.0abaaaabaaaba0.',
  '.0abaaaabaaaba0.',
  '.0acccccccccca0.',
  '.05aaaaabaaaa50.',
  '.0baaaaabaaaab0.',
  '..0aaaaabaaaa0..',
  '..0aaaaabaaaa0..',
  '..0baaaabaaab0..',
  '..000000000000..',
  '...0440..0440...',
  '...0440..0440...',
  '...0440..0440...',
  '...0440..0440...',
  '..04440..04440..',
  '..00000..00000..',
];
const irene1 = swap(irene0, 8, '...0b565565b0...');

/** Lance (7-3): a red bandana with a tail, bare arms, a brown belt, blue fatigues, boots. */
const lance0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....04444440....',
  '...0999999990...',
  '...0555555550990',
  '...0505555050.9.',
  '...0555555550...',
  '...0555665550...',
  '....05555550....',
  '....00666600....',
  '.00555555555500.',
  '0555555555555550',
  '0556555555556550',
  '0556655555566550',
  '0556555665556550',
  '0556555665556550',
  '0556555555556550',
  '0550555555550550',
  '0550cccccccc0550',
  '.00.0eeeeee0.00.',
  '....0eeeeee0....',
  '...0eeee0eeee0..',
  '...0eee00eee0...',
  '...0eee00eee0...',
  '...0eee00eee0...',
  '...0eee00eee0...',
  '...0ccc00ccc0...',
  '..0cccc00cccc0..',
  '..000000000000..',
];
const lance1 = swap(swap(lance0, 7, '...0555555550.99'), 8, '...0565555650.9.');

/*
 * 0.4.23 (S2): the Mushroom Kingdom folk and the fairy. The villager and the pipe keeper are
 * Toad's height (16x24), front view, standing on their bottom row; the fairy (16x16) floats (the
 * partner draws her above her spot, bobbing) and her `-1` frame is a wing beat, not a blink.
 */

/** The villager (1-1): a white cap with blue spots, a brown vest, rubbing his head with one hand. */
const villager0: Rows = [
  '................',
  '.....000000.....',
  '...00111dd100...',
  '..0dd1111ddd10..',
  '.01ddd1111ddd10.',
  '.011d111111d110.',
  '0111111dd1111110',
  '01dd1dddddd1dd10',
  '.000000000005550',
  '...0555555550550',
  '...0505555050550',
  '...0505555050550',
  '...0555005550550',
  '....055555500110',
  '...0bb1111bb0110',
  '..01bb1111bbb10.',
  '.011bb1111bbb0..',
  '.011bb1111bb0...',
  '.055bb1111bb0...',
  '..00bbbbbbbb0...',
  '...0eeeeeeee0...',
  '...0eee00eee0...',
  '..0ccc0..0ccc0..',
  '..00000..00000..',
];
const villager1 = swap(swap(villager0, 10, '...0555555550550'), 11, '...0565555650550');

/** The pipe keeper (1-2's warp zone): an old one, green-spotted cap, white brows and moustache, blue overalls, a wrench. */
const pipeKeeper0: Rows = [
  '................',
  '.....000000.....',
  '...0011kk1100...',
  '..01kkk11kkk10..',
  '.01kk111111kk10.',
  '.0111kk11kk1110.',
  '011kkkk11kkkk110',
  '0111kk1111kk1110',
  '.00000000000000.',
  '...0555555550...',
  '...0115555110...',
  '...0505555050...',
  '..011115511110..',
  '....01111110....',
  '...011dddd110...',
  '..011dddddd110..',
  '..01dfddddfd10..',
  '..05dddddddd53..',
  '...0dddddddd03..',
  '...0ddd00ddd03..',
  '...0ddd00ddd333.',
  '...0ddd00ddd3.3.',
  '..0ccc0..0ccc0..',
  '..00000..00000..',
];
const pipeKeeper1 = swap(pipeKeeper0, 11, '...0565555650...');

/** The fairy (2-1-sky): a pink glow with a golden head and pale blue wings, wings up. */
const fairy0: Rows = [
  '................',
  '.000........000.',
  '0lll0..00..0lll0',
  '0llll00ff00llll0',
  '.0llll0ff0llll0.',
  '..0lll0550lll0..',
  '...00l0550l00...',
  '.....0jjjj0.....',
  '....0jjggjj0....',
  '....0jggggj0....',
  '....0jjggjj0....',
  '.....0jjjj0.....',
  '......0jj0......',
  '.......00.......',
  '................',
  '.......gg.......',
];
/** Wings down. */
const fairy1: Rows = [
  '................',
  '................',
  '.......00.......',
  '......0ff0......',
  '......0ff0......',
  '.000..0550..000.',
  '0llll005500llll0',
  '.0lll0jjjj0lll0.',
  '..000jjggjj000..',
  ...fairy0.slice(9),
];

/**
 * The cave doorway at 2-1's start (32x40): a small mound of brown boulders with a dark arched
 * doorway in the middle (16 wide, as wide as the old man), standing on the ground.
 */
const draw = (w: number, h: number, px: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => px(x, y)).join(''));
const CAVE_W = 32;
const CAVE_H = 40;
/** The rock's top edge at column x: a lumpy mound, highest in the middle. */
const caveTop = (x: number): number => {
  const d = (x - 15.5) / 16;
  return Math.round(3 + d * d * 16 + [0, 1, 0, 2][Math.floor(x / 4) % 4]!);
};
const caveSolid = (x: number, y: number): boolean => x >= 0 && x < CAVE_W && y < CAVE_H && y >= caveTop(x);
/** The boulders' centres: each pixel of the rock belongs to the nearest one. */
const CAVE_ROCKS: readonly (readonly [number, number])[] = [
  [3, 24],
  [4, 36],
  [9, 14],
  [6, 30],
  [16, 6],
  [14, 13],
  [22, 10],
  [26, 20],
  [28, 30],
  [27, 38],
];
const boulder = (x: number, y: number): number => {
  let best = 0;
  let bestD = Infinity;
  CAVE_ROCKS.forEach(([sx, sy], i) => {
    const d = (x - sx) ** 2 + (y - sy) ** 2 * 1.5;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};
const cave: Rows = draw(CAVE_W, CAVE_H, (x, y) => {
  if (!caveSolid(x, y)) return '.';
  // The doorway: an arch 16 wide, its round top at row 17, dark all through.
  const dx = x - 15.5;
  if (Math.abs(dx) < 8 && (y >= 25 || dx * dx + (y - 25) ** 2 < 64)) return '0';
  if (!caveSolid(x - 1, y) || !caveSolid(x + 1, y) || !caveSolid(x, y - 1)) return '0';
  const b = boulder(x, y);
  if (boulder(x + 1, y) !== b || boulder(x, y + 1) !== b) return 'c';
  if (boulder(x - 1, y) !== b || boulder(x, y - 1) !== b) return 'a';
  return (x * 7 + y * 11) % 23 === 0 ? 'c' : 'b';
});

export const partnersDef: SpriteDef = {
  palette: 'partners',
  frames: {
    'old-man-0': oldMan0,
    'old-man-1': oldMan1,
    'dr-light-0': drLight0,
    'dr-light-1': drLight1,
    'chozo-0': chozo0,
    'chozo-1': chozo1,
    'townsperson-0': townsperson0,
    'townsperson-1': townsperson1,
    'irene-0': irene0,
    'irene-1': irene1,
    'lance-0': lance0,
    'lance-1': lance1,
    'villager-0': villager0,
    'villager-1': villager1,
    'pipe-keeper-0': pipeKeeper0,
    'pipe-keeper-1': pipeKeeper1,
    'fairy-0': fairy0,
    'fairy-1': fairy1,
    cave,
  },
};
