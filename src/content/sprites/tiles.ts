import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { swapColors } from '@engine/gfx/pixelart';

/** NES $0C and $11, the master palette's deep teal and azure: the cavern's rock (also its decor). */
export const DEEP_TEAL = '#004058';
export const ROCK_BLUE = '#0078f8';

/**
 * Tile palettes. Every theme palette has the same 12 entries with the same roles, so one
 * frame recolours correctly in every theme:
 *
 *   0  outline (black)
 *   1  block dark      - shadow side of ground/brick/stone, coin & question-block rim
 *   2  block main      - ground/brick/stone fill
 *   3  block highlight - lit side of ground/brick/stone, mushroom stem shade
 *   4  gold main       - question block, coin, lava mid tone
 *   5  green main      - pipes, tree canopy, flagpole
 *   6  green light     - pipe highlight, canopy bumps
 *   7  gold light      - coin shine, question shimmer, lava crests
 *   8  white           - cloud block, mushroom spots & stem, water foam
 *   9  water main
 *   a  water light
 *   b  lava main (red)
 */
export const tilePalettes: Record<string, string[]> = {
  'tiles-overworld': [
    NES.black,
    NES.brownDark,
    NES.orangeBrown,
    NES.tanDark,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.lava,
  ],
  'tiles-underground': [
    NES.black,
    NES.blueDark,
    NES.blueUnderground,
    NES.lavender,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.lava,
  ],
  'tiles-castle': [
    NES.black,
    NES.darkGray,
    NES.gray,
    NES.lightGray,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.lava,
  ],
  'tiles-night': [
    NES.black,
    NES.brownDark,
    NES.redDark,
    NES.orangeBrown,
    NES.yellow,
    NES.greenDark,
    NES.green,
    NES.yellowLight,
    NES.white,
    NES.blueDark,
    NES.blueMid,
    NES.lava,
  ],
  'tiles-water': [
    NES.black,
    NES.teal,
    NES.blueLight,
    NES.skyLight,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueDark,
    NES.blueLight,
    NES.lava,
  ],
  'tiles-snow': [
    NES.black,
    NES.blueLight,
    NES.skyLight,
    NES.white,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.lava,
  ],
  /* Lost Levels giant-mushroom land: warmer ground, orange mushroom caps (the lava role). */
  'tiles-mushroom': [
    NES.black,
    NES.brownDark,
    NES.orangeBrown,
    NES.peach,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.orange,
  ],
  /* Lost Levels sky levels: cloud banks and cloud ledges in white and pale blue. */
  'tiles-clouds': [
    NES.black,
    NES.blueLight,
    NES.skyLight,
    NES.white,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.lava,
  ],
  /* Flooded overworld (Lost Levels World 9): overworld blocks, pale waves on the daylight sky. */
  'tiles-overworld-water': [
    NES.black,
    NES.brownDark,
    NES.orangeBrown,
    NES.tanDark,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.sky,
    NES.skyLight,
    NES.lava,
  ],
  /* The same flooded overworld in gray stone (9-4). */
  'tiles-water-gray': [
    NES.black,
    NES.darkGray,
    NES.gray,
    NES.lightGray,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.sky,
    NES.skyLight,
    NES.lava,
  ],
  /* The space station above 3-1: grey steel plating with blue light strips, teal-and-cyan
     conduits where other themes have pipes, amber lamps where they have gold. */
  'tiles-station': [
    NES.black,
    NES.darkGray,
    NES.gray,
    NES.lightGray,
    NES.yellow,
    NES.teal,
    NES.cyan,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.blueLight,
    NES.lava,
  ],
  /* Samus's cavern below 4-2: azure bubble rock shaded into a deep teal, pale-blue highlights,
     green pipes and gold coins kept so Mario's things still read. */
  'tiles-cavern': [
    NES.black,
    DEEP_TEAL,
    ROCK_BLUE,
    NES.blueLight,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueMid,
    NES.skyLight,
    NES.lava,
  ],
  /* Larry Koopa's airship (4-2): a log cabin in warm wood (tan post faces, red-brown logs) with
     grey iron plates and bolts. The airship has no water, so the water slots hold the iron's grey
     and its light edge. */
  'tiles-airship': [
    NES.black,
    NES.brownDark,
    NES.orangeBrown,
    NES.brownLight,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.gray,
    NES.lightGray,
    NES.lava,
  ],
  /* The airship's open decks (4-2-airship): SMB3-style daylight planks, a step lighter than the
     cabin's (orange-brown shade, light-wood main, tan lit edge), the same grey iron in the water
     slots, and the deep brown of the hull's shadowed back in the lava slot (there is no lava
     aboard). Green pipes and gold blocks stay as they are. */
  'tiles-airship-deck': [
    NES.black,
    NES.orangeBrown,
    NES.brownLight,
    NES.tan,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.gray,
    NES.lightGray,
    NES.brownDark,
  ],
  /* Simon's crypt under 5-4: grey stone with brown in its shadows; the water slots hold the
     night-blue backdrop bricks (9 main, a lit edge). Pipes, gold and lava stay as they are. */
  'tiles-crypt': [
    NES.black,
    NES.brownDark,
    NES.gray,
    NES.lightGray,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.blueDark,
    '#4428bc',
    NES.lava,
  ],
  /* Ryu's hideout under 6-2: dark lacquered wood (deep red-brown, brown shadow, orange-brown lit
     edge); the water slots hold the shoji paper glowing in lantern light (9 main, a lit). */
  'tiles-dojo': [
    NES.black,
    NES.brownDark,
    '#881400',
    NES.orangeBrown,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    NES.brownLight,
    NES.tan,
    NES.lava,
  ],
  /* Ryu's mini game outdoors: grey stone with indigo moonlit shadows; the water slots hold the
     night city's distant walls (9 main, a lit edge), their lit windows in the gold-light slot. */
  'tiles-ninja-night': [
    NES.black,
    '#4428bc',
    NES.gray,
    NES.lightGray,
    NES.yellow,
    NES.green,
    NES.greenPipe,
    NES.yellowLight,
    NES.white,
    '#180c50',
    '#2c1878',
    NES.lava,
  ],
};

/* Two courses of rounded 7x7 cobbles with a 1px seam. Tiles seamlessly in both directions. */
const ground = [
  '0333330003333300',
  '3222221032222210',
  '3222221032222210',
  '3232221032322210',
  '3222221032222210',
  '3222221032222210',
  '0111110001111100',
  '0000000000000000',
  '3300033333000333',
  '2210322222103222',
  '2210323222103222',
  '2210322222103222',
  '2210322222103222',
  '2210322222103222',
  '1100011111000111',
  '0000000000000000',
];

/* Flat slab with a bevel and brick seams: the "cut stone" underground look. */
const groundUnderground = [
  '3333333333333333',
  '3222222222222222',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3111111111111111',
  '0000000000000000',
  '3333333103333333',
  '2222222103222222',
  '2222222103222222',
  '2222222103222222',
  '2222222103222222',
  '2222222103222222',
  '1111111101111111',
  '0000000000000000',
];

/* Rough 8x8 flagstones with chipped corners. */
const groundCastle = [
  '0333333003333330',
  '3222222132222221',
  '3222222132222221',
  '3222322132222221',
  '3222222132223221',
  '3222222132222221',
  '1222222112222221',
  '0111111001111110',
  '0333333003333330',
  '3222222132222221',
  '3222222132222221',
  '3222222132223221',
  '3222322132222221',
  '3222222132222221',
  '1222222112222221',
  '0111111001111110',
];

/* Four courses of 3px bricks, half-offset, black mortar. */
const brick = [
  '3333333033333330',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
  '3333333033333330',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '3330333333303333',
  '2220222222202222',
  '1110111111101111',
  '0000000000000000',
];

/* Underground bricks: wider mortar in the dark tone instead of black. */
const brickUnderground = [
  '3333333133333331',
  '2222222122222221',
  '2222222122222221',
  '1111111111111111',
  '3331333333313333',
  '2221222222212222',
  '2221222222212222',
  '1111111111111111',
  '3333333133333331',
  '2222222122222221',
  '2222222122222221',
  '1111111111111111',
  '3331333333313333',
  '2221222222212222',
  '2221222222212222',
  '1111111111111111',
];

const question0 = [
  '0000000000000000',
  '0777777777777710',
  '0714444444444110',
  '0744477777444410',
  '0744771441744410',
  '0744114441144410',
  '0744444471144410',
  '0744444711444410',
  '0744444114444410',
  '0744444114444410',
  '0744444444444410',
  '0744444711444410',
  '0744444114444410',
  '0714444444444110',
  '0711111111111110',
  '0000000000000000',
];

const used = [
  '0000000000000000',
  '0333333333333310',
  '0312222222222110',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0322222222222210',
  '0312222222222110',
  '0311111111111110',
  '0000000000000000',
];

/* Bullet Bill blaster: a barrel with a pale skull badge and muzzles both sides, on a stand. */
const blasterTop = [
  '0000000000000000',
  '0111111111111110',
  '0222222222222210',
  '0222333333332210',
  '0223888888883210',
  '0223880880883210',
  '0223888888883210',
  '0223808888083210',
  '0222388888832210',
  '0222233333322210',
  '0222222222222210',
  '0222222222222210',
  '0111111111111110',
  '0000000000000000',
  '0012222222222100',
  '0012222222222100',
];
const blasterBase = [
  '0012222222222100',
  '0012332222222100',
  '0012332222222100',
  '0012222222222100',
  '0012222222222100',
  '0012222222322100',
  '0012222222222100',
  '0012222222222100',
  '0012332222222100',
  '0012332222222100',
  '0012222222222100',
  '0012222222222100',
  '0012222222322100',
  '0012222222222100',
  '0011111111111100',
  '0000000000000000',
];

/* Background castle wall: the brick pattern, and a crenellated top course. */
const wallTop = [
  '0000....0000....',
  '0220....0220....',
  '0220....0220....',
  '0110....0110....',
  ...brick.slice(4),
];

const hard = [
  '3333333333333330',
  '3333333333333310',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3322222222221110',
  '3311111111111110',
  '3111111111111110',
  '0000000000000000',
];

/* Vertical pipe: the two top tiles form a 32px rim, the body is inset 2px each side. */
const pipeTopLeft = [
  '0000000000000000',
  '0666666666666666',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0665555555665555',
  '0000000000000000',
];
const pipeTopRight = [
  '0000000000000000',
  '6666666666666660',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '5555665555550050',
  '0000000000000000',
];
/* A pipe hanging from the ceiling opens downward: the same rim upside down. */
const pipeBottomLeft = [...pipeTopLeft].reverse();
const pipeBottomRight = [...pipeTopRight].reverse();
const pipeBodyLeft = Array.from({ length: 16 }, () => '..06655555665555');
const pipeBodyRight = Array.from({ length: 16 }, () => '55556655550050..');

/* Horizontal pipe pointing left: the *-left tiles are the 16x32 mouth, the *-right tiles the shaft. */
const pipeHTopLeft = [
  '0000000000000000',
  '0666666666666660',
  '0666666666666660',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0666666666666660',
  '0666666666666660',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
];
const pipeHBottomLeft = [
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0666666666666660',
  '0666666666666660',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0555555555555550',
  '0000000000000000',
  '0000000000000000',
  '0555555555555550',
  '0000000000000000',
];
const pipeHTopRight = [
  '................',
  '................',
  '0000000000000000',
  '6666666666666666',
  '6666666666666666',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '6666666666666666',
  '6666666666666666',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
];
const pipeHBottomRight = [
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '6666666666666666',
  '6666666666666666',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '0000000000000000',
  '0000000000000000',
  '5555555555555555',
  '0000000000000000',
  '................',
  '................',
];

/* Spinning coin: wide face, narrow, edge-on, narrow. */
const coin0 = [
  '................',
  '.....111111.....',
  '....17744441....',
  '...1774444441...',
  '...1744111441...',
  '...1741444141...',
  '...1741444141...',
  '...1741444141...',
  '...1741444141...',
  '...1741444141...',
  '...1741444141...',
  '...1744111441...',
  '...1444444441...',
  '....14444441....',
  '.....111111.....',
  '................',
];
const coin1 = [
  '................',
  '......1111......',
  '.....174441.....',
  '....17444441....',
  '....17411441....',
  '....17414141....',
  '....17414141....',
  '....17414141....',
  '....17414141....',
  '....17414141....',
  '....17414141....',
  '....17411441....',
  '....14444441....',
  '.....144441.....',
  '......1111......',
  '................',
];
const coin2 = [
  '................',
  '.......11.......',
  '......1771......',
  '......1771......',
  '......1741......',
  '......1741......',
  '......1741......',
  '......1741......',
  '......1741......',
  '......1741......',
  '......1741......',
  '......1741......',
  '......1441......',
  '......1441......',
  '.......11.......',
  '................',
];
/* Back face of the spin: same shape, no shine. */
const coin3 = swapColors(coin1, { '7': '4' });

const flagShaft = Array.from({ length: 16 }, () => '.......65.......');
const flagBall = [
  '......0000......',
  '.....066660.....',
  '....06666650....',
  '....06665550....',
  '....06555550....',
  '.....055550.....',
  '......0000......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
  '.......65.......',
];

/* Treetop platform canopy (tiles horizontally) and its trunk. */
const treeTop = [
  '.666..666..666..',
  '6666666666666666',
  '6666666666666666',
  '6566666566666566',
  '5556665556665556',
  '5555555555555555',
  '5555555555555555',
  '5505555055550555',
  '5555555555555555',
  '5555555555555555',
  '5550055500555005',
  '5555555555555555',
  '5555555555555555',
  '5555555555555555',
  '0555055505550555',
  '0000000000000000',
];
const treeTrunk = Array.from({ length: 16 }, (_, i) =>
  i % 4 === 2 ? '..03322221221110' : '..03322222221110',
);

/* Giant mushroom platform (tiles horizontally) and its stem. */
const mushroomTop = [
  '0000000000000000',
  'bbbbbbbbbbbbbbbb',
  'bbb88bbbbbbbbbbb',
  'bb8888bbbbb88bbb',
  'bbb88bbbbb8888bb',
  'bbbbbbbbbbb88bbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbb88bbbbbbbb',
  'bbbbb8888bbbbbbb',
  'bbbbbb88bbbb88bb',
  'bb88bbbbbbb8888b',
  'b8888bbbbbbb88bb',
  'bb88bbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  '1111111111111111',
  '0000000000000000',
];
const mushroomStem = Array.from({ length: 16 }, () => '....0888883330..');

const lava0 = [
  '....77.....77...',
  '..7744777.7447..',
  '7744444477444477',
  '4444444444444444',
  'bb44bbbbbb44bbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbb4bbbbbbbbbb',
  'bbbb474bbbbb4bbb',
  'bbbbb4bbbbb474bb',
  'bbbbbbbbbbbb4bbb',
  'bbbbbbbbbbbbbbbb',
  'bb4bbbbbbbbbbbbb',
  'b474bbbbbbb4bbbb',
  'bb4bbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
];
const lava1 = [
  '.....77.....77..',
  '.7.7447..7.7447.',
  '7447444477474447',
  '4444444444444444',
  'bbbb44bbbbb44bbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbb4bbbbbbbbbb',
  'bbbb474bbbbb4bbb',
  'bbbbb4bbbbb474bb',
  'bbbbbbbbbbbb4bbb',
  'bbbbbbbbbbbbbbbb',
  'bb4bbbbbbbbbbbbb',
  'b474bbbbbbb4bbbb',
  'bb4bbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
];

const water0 = [
  '..aa......aa....',
  '.a88a....a88a...',
  'aa99aaaaaa99aaaa',
  '9999999999999999',
  '9999999999999999',
  '99a99999999a9999',
  '9999999999999999',
  '9999999a99999999',
  '9999999999999999',
  '9999999999999999',
  '99999a9999999999',
  '9999999999999a99',
  '9999999999999999',
  '9999999999999999',
  '999a999999999999',
  '9999999999999999',
];
const water1 = [
  '......aa......aa',
  '.....a88a....a88',
  'aaaaaa99aaaaaa99',
  '9999999999999999',
  '9999999999999999',
  '999999a99999999a',
  '9999999999999999',
  '99a9999999999999',
  '9999999999999999',
  '9999999999999999',
  '999999999a999999',
  '9a99999999999999',
  '9999999999999999',
  '9999999999999999',
  '99999999999a9999',
  '9999999999999999',
];

/* Castle bridge: plank deck in the upper half, open underneath so the lava shows. */
const bridge = [
  '0000000000000000',
  '3333333333333333',
  '2222222022222220',
  '2222222022222220',
  '2222222022222220',
  '1111111011111110',
  '0000000000000000',
  '.11........11...',
  '.11........11...',
  '.00........00...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const chain = [
  '......0330......',
  '.....03..30.....',
  '.....03..30.....',
  '.....03..30.....',
  '......0330......',
  '.......33.......',
  '......0330......',
  '......0330......',
  '......0330......',
  '.......33.......',
  '......0330......',
  '.....03..30.....',
  '.....03..30.....',
  '.....03..30.....',
  '......0330......',
  '.......33.......',
];

const castleBrick = [
  '3333333333333331',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '1111111111111111',
  '3333333133333333',
  '2222222132222222',
  '2222222132222222',
  '2222222132222222',
  '2222222132222222',
  '2222222132222222',
  '2222222132222222',
  '1111111111111111',
];

const cloudBlock = [
  '....aaaa.aaaa...',
  '..aa8888a8888aa.',
  '.a88888888888888',
  'a888888888888888',
  'a888888888888888',
  'a888888888888888',
  '.a88888888888888',
  '.a8888888888888a',
  'a888888888888888',
  'a888888888888888',
  'a888888888888888',
  'a888888888888888',
  'a88888888888888a',
  '.a8888888888888a',
  '..aa88888888aaa.',
  '....aaaaaaaa....',
];

/*
 * Cloud ledge: the sky levels' platform top in place of a tree canopy (tiles horizontally,
 * two puffs per tile), and the wisp of vapour that replaces its trunk.
 */
const cloudLedge = [
  '..aaaa....aaaa..',
  '.a8888a..a8888a.',
  'a888888aa888888a',
  '8888888888888888',
  '8888888888888888',
  '88a8888888a88888',
  '8888888888888888',
  '8888888888888888',
  '8888888888888888',
  '88888a8888888a88',
  '8888888888888888',
  '8888888888888888',
  'a888888aa888888a',
  '.a8888a..a8888a.',
  '..aaaa....aaaa..',
  '................',
];
const cloudWisp = Array.from({ length: 16 }, (_, i) => (i % 8 < 4 ? '......a88a......' : '.....a88a.......'));

/* Cloud bank: the sky levels' ground, quilted puffs in two half-offset courses. */
const cloudPuff = [
  '22a88a22',
  '2a8888a2',
  'a888888a',
  '88888888',
  '88888888',
  'a888888a',
  '1a8888a1',
  '11aaaa11',
];
const groundClouds = [
  ...cloudPuff.map((r) => r + r),
  ...cloudPuff.map((r) => r.slice(4) + r + r.slice(0, 4)),
];

/* ---------- the space station (`@station`) ---------- */

/* Floor plating: a riveted steel plate with a recessed blue light strip; tiles both ways. */
const groundStation = [
  '3333333333333331',
  '3222222222222221',
  '3282222222222821',
  '3222222222222221',
  '3200000000000021',
  '320aaaaaaaaaa021',
  '3209999999999021',
  '3233333333333321',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3222222222222221',
  '3282222222222821',
  '3222222222222221',
  '1111111111111111',
];

/* Wall plating: the same plate, plain. */
const plateStation = groundStation.map((r, i) => (i >= 4 && i <= 7 ? '3222222222222221' : r));

/* Hard block: a heavy plate with a sunken blue glass port. */
const portGlass = [
  'aa999999',
  'a9999999',
  '99999999',
  '99999a99',
  '9999a999',
  '999a9999',
  '99999999',
  '99999999',
];
const hardStation = [
  '3333333333333331',
  '3222222222222221',
  '3282222222222821',
  '3220000000003221',
  ...portGlass.map((g) => `3220${g}3221`),
  '3220333333333221',
  '3282222222222821',
  '3222222222222221',
  '1111111111111111',
];

/* Breakable panels: half-offset vented plates. */
const ventPlate = [
  '33333331',
  '32222221',
  '32000021',
  '32333321',
  '32000021',
  '32333321',
  '32222221',
  '11111111',
];
const brickStation = [
  ...ventPlate.map((r) => r + r),
  ...ventPlate.map((r) => r.slice(4) + r + r.slice(0, 4)),
];

/* A spent block: a dark, bolted plate with a lit rim so it still reads on the bulkhead. */
const usedStation = [
  '0000000000000000',
  '0222222222222220',
  '0232111111112310',
  ...Array.from({ length: 10 }, () => '0211111111111110'),
  '0232111111112310',
  '0211111111111110',
  '0000000000000000',
];

/* An X brace between two chords, in a tile's colours (light, dark). */
const xBrace = (light: string, dark: string): string[] =>
  Array.from({ length: 8 }, (_, k) => {
    const r = Array.from({ length: 16 }, () => '.');
    for (const x of [2 * k, 15 - 2 * k]) r[x] = light;
    for (const x of [2 * k + 1, 14 - 2 * k]) r[x] = dark;
    return r.join('');
  });

/* Catwalk ledge (the platforms' top): a hazard-striped deck over an open truss. */
const catwalkStation = [
  '0000000000000000',
  '3333333333333333',
  '4400440044004400',
  '0440044004400440',
  '0044004400440044',
  '1111111111111111',
  '0000000000000000',
  ...xBrace('2', '1'),
  '0000000000000000',
];

/* The ledge's support (scenery): a ladder-like strut. */
const strutStation = Array.from({ length: 16 }, (_, i) =>
  i % 4 === 0 ? '....03333331....' : '....031..031....',
);

/* A grated catwalk on two hangers (the boss bridge). */
const bridgeStation = [
  '0000000000000000',
  '3333333333333333',
  '2020202020202020',
  '2121212121212121',
  '1111111111111111',
  '0000000000000000',
  '.12........12...',
  '.12........12...',
  '.00........00...',
  ...Array.from({ length: 7 }, () => '................'),
];

/* Background bulkhead (scenery): big dark bevelled panels with corner rivets and a dim lamp. */
const wallStation = [
  '2222222222222220',
  '2111111111111110',
  '2121111111111210',
  ...Array.from({ length: 4 }, () => '2111111111111110'),
  '2111111111110010',
  '2111111111109010',
  ...Array.from({ length: 4 }, () => '2111111111111110'),
  '2121111111111210',
  '2111111111111110',
  '0000000000000000',
];
const wallTopStation = [
  '0000000000000000',
  '6666666666666666',
  '5555555555555555',
  '0000000000000000',
  ...wallStation.slice(4),
];

/* ---------- Samus's cavern (`@cavern`) ---------- */

/* Floor rock: a heap of round bubbles, lit from the top left, packed so the tile repeats both ways. */
const groundCavern = [
  '0223311000233210',
  '2833322102832221',
  '2333222102322221',
  '3332222111222211',
  '3322221111222111',
  '1222211100121110',
  '1222111112221102',
  '2111113223332123',
  '2101112283322212',
  '1222111333222221',
  '2833222332222211',
  '2332221322222111',
  '2322221122221110',
  '1222211112211110',
  '1222111011111100',
  '0111110000002000',
];

/* Hard block: a bevelled rock block with one big bubble boss sunk in a groove. */
const hardCavern = [
  '3333333333333331',
  '3222222222222221',
  '3222221111222221',
  '3222122221112221',
  '3221223332111221',
  '3222283322211221',
  '3212333222221121',
  '3212332222211121',
  '3212322222111121',
  '3211222221111121',
  '3221122211111221',
  '3221112111111221',
  '3222111111112221',
  '3222221111222221',
  '3222222222222221',
  '1111111111111111',
];

/* Bomb-able rock: the same bevelled block split by black cracks into loose chunks. */
const brickCavern = [
  '0000000000000000',
  '0333333310333310',
  '0322222101222210',
  '0322222100111100',
  '0322221031000010',
  '0321111032333310',
  '0110000122222210',
  '0003331012221110',
  '0332222101110000',
  '0322222210003310',
  '0321122103332210',
  '0110011103222210',
  '0003100032222210',
  '0332231012222210',
  '0111111101111110',
  '0000000000000000',
];

/* A spent block: the hard block's bevel around a bubble gone dark. */
const usedCavern = [
  '3333333333333331',
  '3222222222222221',
  '3222221111222221',
  '3222111110012221',
  '3221112221001221',
  '3221132211100221',
  '3211222111110121',
  '3211221111100121',
  '3211211111000121',
  '3210111110000121',
  '3220011100000221',
  '3221001000001221',
  '3222100000012221',
  '3222221111222221',
  '3222222222222221',
  '1111111111111111',
];

/* Cut stone: rough rock blocks in running courses (castle bricks in a cavern). */
const castleBrickCavern = [
  '3333331033333310',
  '3222221032222210',
  '3222221032222210',
  '3222221032222210',
  '3222221032222210',
  '3222221032222210',
  '1111111011111110',
  '0000000000000000',
  '3310333333103310',
  '3210322222103210',
  '3210322222103210',
  '3210322222103210',
  '3210322222103210',
  '3210322222103210',
  '1110111111101110',
  '0000000000000000',
];

/* Rock ledge (the platforms' top): bubbly rock with drips hanging under it; repeats sideways. */
const ledgeCavern = [
  '1221102221122331',
  '1832213332228322',
  '3322228322233222',
  '3222213222212222',
  '2222132222112221',
  '1221112221111211',
  '0111322211132110',
  '0002222111222100',
  '0001221100122100',
  '0000111000111100',
  '..010...01110...',
  '...0.....111....',
  '.........010....',
  '..........0.....',
  '................',
  '................',
];

/* The ledge's support (scenery): a column of stacked bubbles; repeats downwards. */
const pillarCavern = [
  '...0112221210...',
  '...0132211110...',
  '...0222111110...',
  '...0221111100...',
  '...0211111000...',
  '...0111110000...',
  '...0011100000...',
  '...0201000000...',
  '...0112221000...',
  '...0132211100...',
  '...0222111110...',
  '...0221111100...',
  '...0211111000...',
  '...0111110000...',
  '...0011100000...',
  '...0001000020...',
];

/* Background rock (scenery): the bubble heap in the dark teal of the cave's depths. */
const wallCavern = [
  '1111110110111000',
  '1211111001111101',
  '1111111112111110',
  '1111111011111111',
  '1111110011111110',
  '1111100011111100',
  '0111000001111000',
  '0010001111110000',
  '1000011111100011',
  '1101121111110111',
  '1111111111110121',
  '1111111111100111',
  '1100111111001111',
  '1000111110000111',
  '0000011100000011',
  '0011101110000000',
];

/* The background rock's lumpy top edge. */
const wallTopCavern = [
  '................',
  '................',
  '..00....000.....',
  '.0110..01110....',
  '0111100011110.00',
  '1111100011111000',
  '0111000001111000',
  '0010001111110000',
  '1000011111100011',
  '1101121111110111',
  '1111111111110121',
  '1111111111100111',
  '1100111111001111',
  '1000111110000111',
  '0000011100000011',
  '0011101110000000',
];

/* A thin rock span with drips (the bridge). */
const bridgeCavern = [
  '0023310000233100',
  '0283221002832210',
  '2232221322322213',
  '2222213222222132',
  '2112112221121122',
  '1101101211011012',
  '.010...0..0110..',
  '..0........10...',
  '...........0....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/* ---------- Larry Koopa's airship (`@airship`) ---------- */

/*
 * The cabin floor is a row of upright log posts, one to a tile: a black edge, a lit left side, two
 * grain lines running down and a shadowed right side. `ground` is the top of the row (a rounded
 * cap, dark gaps either side of it); `castle-brick` is a post carrying on down, so a floor or a
 * raised step is `ground` on top of `castle-brick`.
 */
const POST_CAP = ['1100000000000011', '1033333333332201', '0333333333332210'];
/** Post body rows; `knots` darken one grain line on the given rows. */
const postBody = (length: number, knots: readonly (readonly [x: number, y: number])[]): string[] =>
  Array.from({ length }, (_, y) => {
    const r = [...'0333233332332210'];
    for (const [x, ky] of knots) if (ky === y) r[x] = '1';
    return r.join('');
  });

/* Floor: the rounded top of a log post. */
const groundAirship = [
  ...POST_CAP,
  ...postBody(13, [
    [4, 5],
    [4, 6],
    [9, 10],
  ]),
];

/* Floor below the top, and raised steps: the post carrying straight on down. */
const hullAirship = postBody(16, [
  [9, 2],
  [9, 3],
  [4, 11],
]);

/* An iron strap riveted across a plank face (the ledges' cap). */
const strapAirship = ['0000000000000000', 'aaaaaaaaaaaaaaaa', '9989999999989999', '9909999999909999'];

/* Hard block: a bevelled iron plate with a bolt in each corner and a sunken panel. */
const hardAirship = [
  '8aaaaaaaaaaaaaa9',
  ...[
    '99999999999999',
    '98a999999998a9',
    '9a099999999a09',
    '99999999999999',
    '99000000000a99',
    '99099999999a99',
    '99099999999a99',
    '99099999999a99',
    '990aaaaaaaaa99',
    '99999999999999',
    '98a999999998a9',
    '9a099999999a09',
    '99999999999999',
    '99999999999999',
  ].map((mid) => `a${mid}0`),
  '9000000000000000',
];

/* Breakable wooden block: a bevelled block with a sunken inner square, like turned hardwood. */
const brickAirship = [
  '3333333333333331',
  '3222222222222210',
  '3222222222222210',
  '3221111111113210',
  '3221222222223210',
  '3221222122223210',
  '3221221212223210',
  '3221222122223210',
  '3221222222223210',
  '3221222222223210',
  '3221222222223210',
  '3221333333333210',
  '3222222222222210',
  '3222222222222210',
  '3111111111111110',
  '1000000000000000',
];

/* A spent block: dark scorched planks in an iron frame, nailed shut. */
const usedAirship = [
  '0000000000000000',
  ...[
    'aaaaaaaaaaaa',
    '111111111111',
    '181111111181',
    '101111111101',
    '111111111111',
    '111111111111',
    '000000000000',
    '111111111111',
    '111111111111',
    '111111111111',
    '181111111181',
    '101111111101',
    '111111111111',
  ].map((mid) => `0a${mid}90`),
  '0999999999999990',
  '0000000000000000',
];

/* Platform ledge: an iron-capped deck plank on two wooden brackets. */
const ledgeAirship = [
  ...strapAirship,
  '0000000000000000',
  '3333333333333333',
  '2222122222222122',
  '2222222221222222',
  '1111111111111111',
  '0000000000000000',
  '.0310......0310.',
  '..030......030..',
  '..0310....0310..',
  '...030....030...',
  '...0310..0310...',
  '....00....00....',
];

/* The ledge's support (scenery): a stout wooden mast with iron hoops. */
const mastAirship = Array.from({ length: 16 }, (_, i) =>
  i % 8 === 3 || i % 8 === 5 ? '....00000000....' : i % 8 === 4 ? '....0aaaa990....' : '.....032210.....',
);

/* A gangplank on rope hangers (the boss bridge). */
const bridgeAirship = [
  '0000000000000000',
  '3333333333333333',
  '2222222a22222220',
  '2212222022122220',
  '2222222222222220',
  '1111111111111110',
  '0000000000000000',
  '.33........33...',
  '.03........03...',
  '.33........33...',
  '.00........00...',
  ...Array.from({ length: 5 }, () => '................'),
];

/* Background (scenery): the cabin's back wall, one round horizontal log to a tile between black
   seams: a thin lit band along its crown over dark grained wood. Drawn in the dark wood tones only,
   so it sits well back behind the tan posts and never reads as solid. */
const wallAirship = [
  '0000000000000000',
  '1111111111111111',
  '2222222222222222',
  '1212222221222212',
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
  '1111111111122211',
  '1111111111111111',
  '1111111111111111',
  '1112221111111111',
  '1111111111111111',
  '1111111111111111',
  '1111111111111111',
  '0000000000000000',
  '0000000000000000',
];
/* The top of the bulwark: a capping rail on stubby iron posts over the inboard planks. */
const wallTopAirship = [
  '0000000000000000',
  '3333333333333333',
  '2222222222222222',
  '0000000000000000',
  '.0a0.......0a0..',
  '.090.......090..',
  '.090.......090..',
  ...wallAirship.slice(7),
];

/* ---------- The airship's open decks (`@airship-deck`) ---------- */

/*
 * SMB3-style planking under a daylight sky. Every solid tile is built from 8px horizontal planks:
 * a black seam, a tan lit edge, light wood with a little grain, an orange-brown shadow and iron
 * rivets; the upper plank has a butt joint, the lower one runs on (so a deck reads as long boards,
 * not bricks). Which tile is which on the deck:
 *   `#` ground       deck and hull planking; tiles both ways (a deck, a hull, the stepped prow)
 *   `%` castle-brick the same planking with a round iron-rimmed porthole (the stern's portholes)
 *   `B` hard         a bolted wooden block (posts and crates: stack it for a tall post)
 *   `=` brick        a breakable crate with a cross brace
 *   `u` used         a spent block: a dark plank square with corner rivets
 *   `-` bridge       a thin plank on air (the overhang's ceiling, narrow catwalks)
 *   `T` tree-top     an iron-strapped ledge on two hangers
 *   `t` tree-trunk   (scenery) an iron lattice strut, e.g. holding up a ledge
 *   `H` wall         (scenery) the hull's shadowed back, in dark wood
 *   `A` wall-top     (scenery) the bulwark's capping rail over that dark hull
 *   `^` `|`          Bullet Bill blasters in black iron
 */
const groundDeck = [
  '0000000000000000',
  '3333333333303333',
  '2222222222202222',
  '222222222a90a922',
  '2222222229009022',
  '2221112222202222',
  '2222212222202122',
  '1111111111101111',
  '0000000000000000',
  '3333333333333333',
  '2222222222222222',
  '2a92222111122222',
  '2902222222222222',
  '2222222222222222',
  '2222222222211122',
  '1111111111111111',
];

/* A round porthole let into the planking: an iron rim (lit up-left, shadowed down-right) round
   dark glass with a white glint. */
const portholeDeck = groundDeck.map((r, y) =>
  [...r]
    .map((c, x) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 3.4) return (x === 6 && y === 5) || (x === 5 && y === 6) ? '8' : '0';
      if (d < 5) return x + y < 15 ? 'a' : '9';
      return d < 5.9 ? '0' : c;
    })
    .join(''),
);

/* Hard block: a bolted wooden block of three upright boards in a black frame. */
const hardDeck = [
  '0000000000000000',
  '0333333333333310',
  '03a921222212a910',
  '0390212222129010',
  '0322212222122210',
  '0322212222122210',
  '0322212212122210',
  '0322212222122210',
  '0322212222122210',
  '0322212222121210',
  '0322212222122210',
  '0322212222122210',
  '03a921222212a910',
  '0390212222129010',
  '0311111111111110',
  '0000000000000000',
];

/* Breakable crate: a two-tone board frame round a lit cross brace. */
const brickDeck = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '0';
    if (x === 14 || y === 14) return '1';
    if (x === 1 || y === 1) return '3';
    if (x === 2 || y === 2 || x === 13 || y === 13) return '0';
    const a = x - y;
    const b = x + y - 15;
    if (a === 0 || b === 0) return '3';
    if (a === 1 || b === 1) return '1';
    return (x * 7 + y * 3) % 11 === 0 ? '1' : '2';
  }).join(''),
);

/* Spent block: a dark two-plank square, lit on its top and left, rivets in its corners. */
const usedDeck = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return '0';
    const rivet = (x === 3 || x === 12) && (y === 3 || y === 12);
    if (rivet) return 'a';
    if ((x === 4 || x === 13) && (y === 4 || y === 13)) return '0';
    if (x === 1 || y === 1) return '1';
    if (x === 14 || y === 14) return '0';
    return y === 8 ? '0' : 'b';
  }).join(''),
);

/* A thin plank on air, riveted at both ends. */
const bridgeDeck = [
  '0000000000000000',
  '3333333333333333',
  '22a92222222a9222',
  '2290222122290222',
  '2222222222222222',
  '1111111111111111',
  '0000000000000000',
  ...Array.from({ length: 9 }, () => '................'),
];

/* Ledge: an iron strap across a plank, hung from two iron hangers. */
const ledgeDeck = [
  '0000000000000000',
  'aaaaaaaaaaaaaaaa',
  '9999999999999999',
  '0000000000000000',
  '3333333333333333',
  '2222122222221222',
  '1111111111111111',
  '0000000000000000',
  '..0a0......0a0..',
  '..090......090..',
  '..090......090..',
  '..000......000..',
  ...Array.from({ length: 4 }, () => '................'),
];

/* Scenery: a narrow iron lattice strut with a zigzag brace between its two rails. */
const strutDeck = Array.from({ length: 16 }, (_, y) => {
  const k = y % 8;
  const brace = k < 4 ? k : 7 - k;
  const inner = [...'....'];
  inner[brace] = '9';
  return `....0a${inner.join('')}90....`;
});

/* Scenery: the hull's shadowed back, the planking in the deep browns with dim rivets. */
const wallDeck = swapColors(groundDeck, { '3': '1', '2': 'b', '1': 'b', a: '9', '9': '0' });
const wallTopDeck = [
  '0000000000000000',
  '3333333333333333',
  '2222222222222222',
  '1111111111111111',
  '0000000000000000',
  ...wallDeck.slice(5),
];

/* Bullet Bill blasters in black iron with grey highlights, not wood. */
const IRON = { '1': '0', '2': '9', '3': 'a' };

/* ---------- Simon's crypt under 5-4 (`@crypt`) ---------- */

/* Floor: a bevelled grey block, brown in its shadows, a chip or two (repeats both ways). */
const groundCrypt = [
  '3333333333333310',
  '3322222222222210',
  '3222222222222210',
  '3222222222212210',
  '3222222222122210',
  '3222222222222210',
  '3221222222222210',
  '3222122222222210',
  '3222212222222210',
  '3222222222222210',
  '3222222222232210',
  '3222222222322210',
  '3222222222222210',
  '3222222222222110',
  '1111111111111110',
  '0000000000000000',
];
/* Masonry: big stones in running courses. */
const castleBrickCrypt = [
  '3333333333333330',
  '3222222222222210',
  '3222222222222210',
  '3222212222222210',
  '3222222222222210',
  '3222222222222110',
  '1111111111111110',
  '0000000000000000',
  '3333333033333333',
  '2222221032222222',
  '2222221032222222',
  '2212221032222122',
  '2222221032222222',
  '2222211032222222',
  '1111111031111111',
  '0000000000000000',
];
/* Breakable: small bricks with brown mortar, plainly smaller than the masonry. */
const brickCrypt = [
  '3333333033333330',
  '2222222122222221',
  '2222222122222221',
  '0111111011111110',
  '3330333333303333',
  '2221222222212222',
  '2221222222212222',
  '1110111111101111',
  '3333333033333330',
  '2222222122222221',
  '2222222122222221',
  '0111111011111110',
  '3330333333303333',
  '2221222222212222',
  '2221222222212222',
  '1110111111101111',
];
/* Hard block: a stone carved with a skull. */
const hardCrypt = [
  '3333333333333330',
  '3222222222222210',
  '3222223333222210',
  '3222233333322210',
  '3222333333332210',
  '3222300330032210',
  '3222300330032210',
  '3222333113332210',
  '3222233333322210',
  '3222231313122210',
  '3222221111222210',
  '3222222222222210',
  '3222222222222210',
  '3222222222222110',
  '1111111111111110',
  '0000000000000000',
];
/* Spent block: the floor block gone dark. */
const usedCrypt = [
  '2222222222222200',
  '2211111111111100',
  '2111111111111100',
  '2111111111101100',
  '2111111111011100',
  '2111111111111100',
  '2110111111111100',
  '2111011111111100',
  '2111101111111100',
  '2111111111111100',
  '2111111111121100',
  '2111111111211100',
  '2111111111111100',
  '2111111111111000',
  '0000000000000000',
  '0000000000000000',
];
/* Backdrop (scenery): night-blue bricks with black mortar. */
const wallCrypt = [
  'a9999990a9999990',
  '9000000090000000',
  '9000000090000000',
  '0000000000000000',
  '9990a9999990a999',
  '0000900000009000',
  '0000900000009000',
  '0000000000000000',
  'a9999990a9999990',
  '9000000090000900',
  '9000000090000000',
  '0000000000000000',
  '9990a9999990a999',
  '0000900900009000',
  '0000900000009000',
  '0000000000000000',
];
/* The backdrop's top: a stone cornice over the blue bricks. */
const wallTopCrypt = [
  '3333333333333333',
  '2222222222222222',
  '1111111111111111',
  '0000000000000000',
  '9990a9999990a999',
  '0000900000009000',
  '0000900000009000',
  '0000000000000000',
  'a9999990a9999990',
  '9000000090000900',
  '9000000090000000',
  '0000000000000000',
  '9990a9999990a999',
  '0000900900009000',
  '0000900000009000',
  '0000000000000000',
];
/* Ledge: a stone slab on corbels. */
const treeTopCrypt = [
  '3333333333333333',
  '2222222222222222',
  '2222222122222221',
  '1111111111111111',
  '0000000000000000',
  '0322100003221000',
  '.03210...03210..',
  '..0310....0310..',
  '...00......00...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
/* The ledge's support (scenery): a fluted column; repeats downwards. */
const treeTrunkCrypt = [
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
  '...03232212110..',
];
/* A thin stone walkway. */
const bridgeCrypt = [
  '3333333033333330',
  '2222221022222210',
  '2222221022222210',
  '1111111011111110',
  '0000000000000000',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/* ---------- Ryu's hideout under 6-2 (`@dojo`) ---------- */

/* Floor: polished boards, four narrow planks a tile, their ends staggered (repeats both ways). */
const groundDojo = [
  '3333333333303333',
  '2222112222103222',
  '2222222222102221',
  '1111111111111111',
  '3333303333333333',
  '2222102221122222',
  '2112102222222222',
  '1111111111111111',
  '3333333333333303',
  '2222222211222102',
  '2222222222222102',
  '1111111111111111',
  '3033333333333333',
  '1032222222112222',
  '1032112222222222',
  '1111111111111111',
];
/* Timber: two upright boards of dark wood, grain running down them (repeats both ways). */
const castleBrickDojo = [
  '0322222103222221',
  '0322212103221221',
  '0322212103221221',
  '0322222103222221',
  '0321222103222121',
  '0321222103222121',
  '0322222103222221',
  '0322222103122221',
  '0322122103122221',
  '0322122103222221',
  '0322222103222211',
  '0322222103222211',
  '0321222103222221',
  '0321222103221221',
  '0322222103221221',
  '0322222103222221',
];
/* Breakable: a wooden crate with a cross brace. */
const brickDojo = [
  '3333333333333330',
  '3322222222222110',
  '3232222222221210',
  '3223222222212210',
  '3222322222122210',
  '3222232221222210',
  '3222223212222210',
  '3222222322222210',
  '3222221232222210',
  '3222212223222210',
  '3222122222322210',
  '3221222222232210',
  '3212222222223210',
  '3122222222222310',
  '3111111111111110',
  '0000000000000000',
];
/* Hard block: a lacquered block inlaid with a diamond crest. */
const hardDojo = [
  '3333333333333330',
  '3222222222222210',
  '3222222112222210',
  '3222221331222210',
  '3222213223122210',
  '3222132222312210',
  '3221322112231210',
  '3213221331223110',
  '3213221331223110',
  '3221322112231210',
  '3222132222312210',
  '3222213223122210',
  '3222221331222210',
  '3222222112222110',
  '1111111111111110',
  '0000000000000000',
];
/* Spent block: the crest block gone dark. */
const usedDojo = swapColors(hardDojo, { '3': '2', '2': '1', '1': '0' });
/* Backdrop (scenery): shoji, a dark lattice of tall panes over paper glowing in lantern light. */
const wallDojo = Array.from({ length: 16 }, (_, y) =>
  y === 0 ? '1111111111111111' : y === 1 ? '1aaaaaaa1aaaaaaa' : '1a9999991a999999',
);
/* The backdrop's top: a wooden lintel over the shoji. */
const wallTopDojo = [
  '3333333333333333',
  '2222222222222222',
  '1111111111111111',
  '0000000000000000',
  ...wallDojo.slice(4),
];
/* Ledge: a wooden shelf on two brackets. */
const treeTopDojo = [
  '3333333333333333',
  '2222222222222222',
  '2222222222222222',
  '1111111111111111',
  '0000000000000000',
  '.01220....01220.',
  '..0120.....0120.',
  '...010......010.',
  '....00.......00.',
  ...Array.from({ length: 7 }, () => '................'),
];
/* The ledge's support (scenery): a round wooden pillar, banded once a tile; repeats downwards. */
const treeTrunkDojo = Array.from({ length: 16 }, (_, y) =>
  y === 0 ? '...03333333110..' : '...03322222110..',
);
/* A plank walkway. */
const bridgeDojo = [
  '3333333333333333',
  '2222212222222122',
  '1111111111111111',
  '0000000000000000',
  ...Array.from({ length: 12 }, () => '................'),
];

/* ---------- Ryu's mini game outdoors (`@ninja-night`) ---------- */

/* Street: rounded cobbles, each course shifted half a stone (repeats both ways). */
const cobble = [
  '13333320',
  '32222221',
  '32222221',
  '32222211',
  '32222211',
  '12221110',
  '01111100',
  '00000000',
];
const groundNinja = [
  ...cobble.map((r) => r + r),
  ...cobble.map((r) => (r + r).slice(4) + (r + r).slice(0, 4)),
];
/* Masonry: big dressed stones in running courses, the walls Ryu clings to. */
const castleBrickNinja = [
  '3333333333333331',
  '3222222222222221',
  '3222221222222221',
  '3222222222222221',
  '3222222222212221',
  '3222222222222221',
  '1111111111111111',
  '0000000000000000',
  '3333331033333333',
  '2222221032222222',
  '2122221032222122',
  '2222221032222222',
  '2222221032212222',
  '2222221032222222',
  '1111111031111111',
  '0000000000000000',
];
/* Hard block: an iron-banded stone with two rivets. */
const hardNinja = [
  '3333333333333330',
  '3222222222222210',
  '3222222222222210',
  '0000000000000000',
  '3330333333330330',
  '2210222222221020',
  '1110111111111010',
  '3222222222222210',
  '3222222222222210',
  '3222222222222210',
  '0000000000000000',
  '3330333333330330',
  '2210222222221020',
  '1110111111111010',
  '1111111111111110',
  '0000000000000000',
];
/* Backdrop (scenery): a distant wall of the sleeping town, plank-sided, one window still lit. */
const wallNinja = [
  '9999999999999999',
  '9999999999999999',
  '9999999999999999',
  '9999900000999999',
  '9999907770999999',
  '9999907770999999',
  '9999907770999999',
  '9999900000999999',
  '999999aaa9999999',
  '9999999999999999',
  '9999999999999999',
  'a99999999999999a',
  '9999999999999999',
  '9999999999999999',
  'aaaaaaaaaaaaaaaa',
  '9999999999999999',
];
/* The backdrop's top: the town's roof line, an eave over the wall. */
const wallTopNinja = [
  '................',
  '................',
  '.......aa.......',
  '....aaa99aaa....',
  '.aaa99999999aaa.',
  'a99999999999999a',
  '0000000000000000',
  'aaaaaaaaaaaaaaaa',
  ...wallNinja.slice(8),
];
/* Ledge: a tiled rooftop, ridge cap on top, rows of round tiles and the dark eave. */
const treeTopNinja = [
  '3333333333333333',
  '1111111111111111',
  '2310231023102310',
  '2210221022102210',
  '1100110011001100',
  '3102310231023102',
  '2102210221022102',
  '1001100110011001',
  '0000000000000000',
  ...Array.from({ length: 7 }, () => '................'),
];
/* The ledge's support (scenery): a wooden post with an iron band; repeats downwards. */
const treeTrunkNinja = Array.from({ length: 16 }, (_, y) =>
  y === 6 || y === 7 ? '.....003310.....' : '......03210.....',
);

export const tilesDef: SpriteDef = {
  palette: 'tiles-overworld',
  frames: {
    ground,
    brick,
    'question-0': question0,
    'question-1': swapColors(question0, { '7': '4' }),
    'question-2': swapColors(question0, { '4': '7' }),
    used,
    hard,
    'pipe-top-left': pipeTopLeft,
    'pipe-top-right': pipeTopRight,
    'pipe-bottom-left': pipeBottomLeft,
    'pipe-bottom-right': pipeBottomRight,
    'pipe-body-left': pipeBodyLeft,
    'pipe-body-right': pipeBodyRight,
    'pipe-h-top-left': pipeHTopLeft,
    'pipe-h-top-right': pipeHTopRight,
    'pipe-h-bottom-left': pipeHBottomLeft,
    'pipe-h-bottom-right': pipeHBottomRight,
    'coin-0': coin0,
    'coin-1': coin1,
    'coin-2': coin2,
    'coin-3': coin3,
    'flag-shaft': flagShaft,
    'flag-ball': flagBall,
    'tree-top': treeTop,
    'tree-trunk': treeTrunk,
    'mushroom-top': mushroomTop,
    'mushroom-stem': mushroomStem,
    'lava-0': lava0,
    'lava-1': lava1,
    bridge,
    chain,
    'castle-brick': castleBrick,
    'water-0': water0,
    'water-1': water1,
    'cloud-block': cloudBlock,
    'blaster-top': blasterTop,
    'blaster-base': blasterBase,
    wall: brick,
    'wall-top': wallTop,
    'ground@underground': groundUnderground,
    'ground@castle': groundCastle,
    'brick@underground': brickUnderground,
    // The Lost Levels' extra skins: the same platform tiles drawn as mushrooms or clouds.
    'tree-top@mushroom': mushroomTop,
    'tree-trunk@mushroom': mushroomStem,
    'tree-top@clouds': cloudLedge,
    'tree-trunk@clouds': cloudWisp,
    'ground@clouds': groundClouds,
    'tree-top@clouds-overworld': cloudLedge,
    'tree-trunk@clouds-overworld': cloudWisp,
    // Red giant mushrooms (the overworld palette's red caps) and the castle's flagstones underwater.
    'tree-top@mushroom-red': mushroomTop,
    'tree-trunk@mushroom-red': mushroomStem,
    'ground@castle-water': groundCastle,
    // The space station above 3-1 (Mega Man's stage).
    'ground@station': groundStation,
    'castle-brick@station': plateStation,
    'hard@station': hardStation,
    'brick@station': brickStation,
    'used@station': usedStation,
    'tree-top@station': catwalkStation,
    'tree-trunk@station': strutStation,
    'bridge@station': bridgeStation,
    'wall@station': wallStation,
    'wall-top@station': wallTopStation,
    // Samus's cavern below 4-2.
    'ground@cavern': groundCavern,
    'castle-brick@cavern': castleBrickCavern,
    'hard@cavern': hardCavern,
    'brick@cavern': brickCavern,
    'used@cavern': usedCavern,
    'tree-top@cavern': ledgeCavern,
    'tree-trunk@cavern': pillarCavern,
    'bridge@cavern': bridgeCavern,
    'wall@cavern': wallCavern,
    'wall-top@cavern': wallTopCavern,
    // Larry Koopa's airship (behind 4-2's right-hand pipe).
    'ground@airship': groundAirship,
    'castle-brick@airship': hullAirship,
    'hard@airship': hardAirship,
    'brick@airship': brickAirship,
    'used@airship': usedAirship,
    'tree-top@airship': ledgeAirship,
    'tree-trunk@airship': mastAirship,
    'bridge@airship': bridgeAirship,
    'wall@airship': wallAirship,
    'wall-top@airship': wallTopAirship,
    // The airship's open decks (4-2-airship).
    'ground@airship-deck': groundDeck,
    'castle-brick@airship-deck': portholeDeck,
    'hard@airship-deck': hardDeck,
    'brick@airship-deck': brickDeck,
    'used@airship-deck': usedDeck,
    'tree-top@airship-deck': ledgeDeck,
    'tree-trunk@airship-deck': strutDeck,
    'bridge@airship-deck': bridgeDeck,
    'wall@airship-deck': wallDeck,
    'wall-top@airship-deck': wallTopDeck,
    'blaster-top@airship-deck': swapColors(blasterTop, IRON),
    'blaster-base@airship-deck': swapColors(blasterBase, IRON),
    // Simon's crypt under 5-4 and his mini game's castle.
    'ground@crypt': groundCrypt,
    'castle-brick@crypt': castleBrickCrypt,
    'brick@crypt': brickCrypt,
    'hard@crypt': hardCrypt,
    'used@crypt': usedCrypt,
    'wall@crypt': wallCrypt,
    'wall-top@crypt': wallTopCrypt,
    'tree-top@crypt': treeTopCrypt,
    'tree-trunk@crypt': treeTrunkCrypt,
    'bridge@crypt': bridgeCrypt,
    // Ryu's hideout under 6-2.
    'ground@dojo': groundDojo,
    'castle-brick@dojo': castleBrickDojo,
    'brick@dojo': brickDojo,
    'hard@dojo': hardDojo,
    'used@dojo': usedDojo,
    'wall@dojo': wallDojo,
    'wall-top@dojo': wallTopDojo,
    'tree-top@dojo': treeTopDojo,
    'tree-trunk@dojo': treeTrunkDojo,
    'bridge@dojo': bridgeDojo,
    // Ryu's mini game outdoors: the moonlit town.
    'ground@ninja-night': groundNinja,
    'castle-brick@ninja-night': castleBrickNinja,
    'hard@ninja-night': hardNinja,
    'wall@ninja-night': wallNinja,
    'wall-top@ninja-night': wallTopNinja,
    'tree-top@ninja-night': treeTopNinja,
    'tree-trunk@ninja-night': treeTrunkNinja,
  },
};
