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
  },
};
