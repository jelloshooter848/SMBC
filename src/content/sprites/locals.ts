import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * The world map's locals (docs/STORY.md 2.3b, the welcomes): one on the start node of each of
 * worlds 2-8, in the spirit of that world's hero's game: World 2's healer (a Zelda II townswoman
 * with a basket), World 3's lab robot (one antenna, a blinking light), World 4's scientist (lab
 * coat, goggles), World 5's hooded merchant with his sack, World 6's village elder (a grey hood,
 * a walking stick), World 7's sergeant (helmet, a radio on his back) and World 8's miner (a lamp
 * on his helmet, a pickaxe). Original 8-bit art drawn here as text rows; nothing is traced.
 *
 * Conventions the map (scenes/world-map.ts) relies on: `<who>-0` is the idle frame and `<who>-1`
 * the blink (the robot's light changes colour instead); every frame is 16x20, seen from the
 * front, standing on its bottom row.
 */

/**
 * `locals` index roles:
 *   0 black / outline  1 white         2 light grey     3 grey          4 dark grey
 *   5 skin             6 skin shade    7 brown          8 dark brown    9 light brown
 *   a army olive       c blue          d dark blue      e dress orange  f dark red
 *   g yellow           h pale yellow   i army green     j hood purple   k hood highlight
 *   m goggle cyan
 */
export const localsPalettes: Record<string, string[]> = {
  locals: [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.darkGray,
    NES.tan,
    NES.tanDark,
    NES.brown,
    NES.brownDark,
    NES.brownLight,
    NES.olive,
    NES.greenDark,
    NES.blueMid,
    NES.blueDark,
    NES.orangeBrown,
    NES.redDark,
    NES.yellow,
    NES.yellowLight,
    NES.greenDark,
    '#940084',
    NES.magenta,
    NES.purple,
    NES.cyan,
  ],
};

type Rows = readonly string[];

/** `rows` with row `y` replaced (the blink frames). */
const swap = (rows: Rows, y: number, row: string): Rows => rows.map((r, i) => (i === y ? row : r));

/** World 2 (Hyrule): a townswoman in a headscarf and long dress, a white apron, a basket. */
const healer0: Rows = [
  '................',
  '.....000000.....',
  '....0eeeeee0....',
  '...0eeeeeeee0...',
  '...0ee5555ee0...',
  '...0e505505e0...',
  '...0e555555e0...',
  '....0e5665e0....',
  '....00eeee00....',
  '...0ee1111ee0...',
  '..0eee1111eee0..',
  '..05ee1111ee50..',
  '..00ee1111e0000.',
  '...0ee1111e9790.',
  '...0eee11ee9990.',
  '..0eeeeeeeee00..',
  '..0eeeeeeeeee0..',
  '.0eeeeeeeeeeee0.',
  '.0ffffffffffff0.',
  '..000000000000..',
];
const healer1 = swap(healer0, 5, '...0e555555e0...');

/** World 3 (20XX): a small round helper robot, one antenna with a light, a screen face. */
const robot0: Rows = [
  '.......f........',
  '.......0........',
  '.......0........',
  '....00000000....',
  '...0cccccccc0...',
  '..0cc111111cc0..',
  '..0c11011011c0..',
  '..0c11111111c0..',
  '..0cc100001cc0..',
  '...0cccccccc0...',
  '....0dddddd0....',
  '...0c222222c0...',
  '..0cc2f22f2cc0..',
  '..0cc222222cc0..',
  '..0dcccccccccd0.',
  '...0dddddddd0...',
  '....0dd00dd0....',
  '....0dd00dd0....',
  '...0ddd00ddd0...',
  '...0000..0000...',
];
const robot1 = swap(robot0, 0, '.......g........');

/** World 4 (Zebes): a scientist in a white lab coat, goggles pushed up on his brown hair. */
const scientist0: Rows = [
  '................',
  '.....000000.....',
  '....08888880....',
  '...0888888880...',
  '...0mmm00mmm0...',
  '...0555555550...',
  '...0550550550...',
  '....05566550....',
  '.....000000.....',
  '...0111c11110...',
  '..011111c111110.',
  '..011111c111110.',
  '..051111c111150.',
  '..011112c211110.',
  '..011111111110..',
  '...0111111110...',
  '....0dd00dd0....',
  '....0dd00dd0....',
  '...0888008880...',
  '...0000..0000...',
];
const scientist1 = swap(scientist0, 6, '...0555555550...');

/** World 5 (Transylvania): a hooded merchant in a long robe, his face in shadow, a sack. */
const merchant0: Rows = [
  '................',
  '......0000......',
  '.....0jjjj0.....',
  '....0jjjjjj0....',
  '...0jjjjjjjj0...',
  '...0jj0000jj0...',
  '...0j555555j0...',
  '...0j505505j0...',
  '...0jj5665jj0...',
  '..0jjjj00jjjj0..',
  '.0jjjjjjjjjjj990',
  '.0jjkjjjjjjj9790',
  '.05jjjjjjjjj9990',
  '.0jjjjjjjjjj9990',
  '.0jjjjjjjjjjj00.',
  '.0jjjkjjjjjjj0..',
  '.0jjjjjjjjjjj0..',
  '..0jjjjjjjjjj0..',
  '...08800880.....',
  '...00000000.....',
];
const merchant1 = swap(merchant0, 7, '...0j555555j0...');

/** World 6 (the ninja village): the old elder in a grey hood and robe, leaning on his stick. */
const elder0: Rows = [
  '................',
  '.....000000.....',
  '....03333330....',
  '...0333333330...',
  '...0335555330...',
  '...0350550530...',
  '...0352222530...',
  '...0332222330...',
  '..70332222330...',
  '..703333333330..',
  '.0553333333330..',
  '..703333333330..',
  '..703334433330..',
  '..703333333330..',
  '..703333333330..',
  '..70333333330...',
  '..7.03300330....',
  '..7.03300330....',
  '..7.04400440....',
  '..7.00000000....',
];
const elder1 = swap(elder0, 5, '...0355555530...');

/** World 7 (the front): a sergeant in a green helmet and olive fatigues, a radio on his back. */
const sergeant0: Rows = [
  '................',
  '.....000000.....',
  '....0iiiiii0....',
  '...0iiiiiiii0...',
  '..0iiiiiiiiii0..',
  '...0555555550.0.',
  '...0550550550.0.',
  '...0555665550.0.',
  '....00555500..0.',
  '...0aaaaaaaa044.',
  '..0aaaaaaaaa044.',
  '..0a5aaaaa5a044.',
  '..0aa8888aaa044.',
  '..0aaaaaaaaa00..',
  '...0aaaaaaa0....',
  '...0aaa0aaa0....',
  '...0aaa0aaa0....',
  '...0aaa0aaa0....',
  '..08880.08880...',
  '..00000.00000...',
];
const sergeant1 = swap(sergeant0, 6, '...0555555550.0.');

/** World 8 (the Underworld): an old miner, a lamp on his yellow helmet, a grey beard, a pickaxe. */
const miner0: Rows = [
  '......0000......',
  '.....0hhhh0.....',
  '....0gg11gg0....',
  '...0gggggggg0...',
  '..0gggggggggg0..',
  '...0555555550...',
  '...0550550550...',
  '...0222222220...',
  '...0222662220...',
  '....00222200.333',
  '...0ffffffff0.7.',
  '..0ffffffffff57.',
  '..05ffffffff0.7.',
  '..0f8888888f0.7.',
  '...0888888880.7.',
  '...0888008880.7.',
  '...0888008880...',
  '...0888008880...',
  '..04440.04440...',
  '..00000.00000...',
];
const miner1 = swap(miner0, 6, '...0555555550...');

/** The local of each map page with a welcome (story/script.ts WELCOMES): its frames' base name. */
export const LOCAL_SPRITES: Readonly<Record<string, string>> = {
  'smb-2': 'healer',
  'smb-3': 'lab-robot',
  'smb-4': 'scientist',
  'smb-5': 'merchant',
  'smb-6': 'elder',
  'smb-7': 'sergeant',
  'smb-8': 'miner',
};

export const localsDef: SpriteDef = {
  palette: 'locals',
  frames: {
    'healer-0': healer0,
    'healer-1': healer1,
    'lab-robot-0': robot0,
    'lab-robot-1': robot1,
    'scientist-0': scientist0,
    'scientist-1': scientist1,
    'merchant-0': merchant0,
    'merchant-1': merchant1,
    'elder-0': elder0,
    'elder-1': elder1,
    'sergeant-0': sergeant0,
    'sergeant-1': sergeant1,
    'miner-0': miner0,
    'miner-1': miner1,
  },
};
