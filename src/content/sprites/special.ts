import type { SpriteDef } from '@engine/gfx/pixelart';

/*
 * Super Mario Bros. Special's enemies and items (G-021, G-022): original designs in the Classic
 * sheets' 8-bit style, nothing traced. All 16x16.
 *
 * Enemies (sheet `special-enemies`) use the enemy palettes' roles (sprites/enemies.ts), so they
 * take each area's colours like the rest: 1 outline, 2 body, 3 light, 4 white, 7 red accent,
 * 9 yellow, a steel, b steel highlight. They face LEFT (the renderer flips them).
 *
 * Items (frames added to the `items` sheet) use the item palette's roles (sprites/items.ts):
 * 0 outline, 1 white, 2 red, 3 cream, 5 gold, 6 gold light, 9 brown, a light blue, b grey.
 */

/** An icicle hanging point down: a white-blue shard with a steel edge. */
const icicle = [
  '.1111111111.....',
  '.1bbb4b4bb1.....',
  '..1bb4b4b1......',
  '..1bb4bbb1......',
  '..1b4bbbb1......',
  '...1b4bb1.......',
  '...1b4bb1.......',
  '...1bb4b1.......',
  '....1b41........',
  '....1b41........',
  '....1bb1........',
  '.....141........',
  '.....1b1........',
  '.....1b1........',
  '......1.........',
  '................',
];

/** A crab's shell and face over its legs (`legs` 0 or 1); `body` its colour, `eye` its eyes. */
function crab(legs: 0 | 1, body: string, eye: string): string[] {
  const top = [
    '................',
    '.11..........11.',
    '1BB1..1..1..1BB1',
    '1BBB11E11E1.1BB1',
    '.1BB11E11E1.1B1.',
    '..1B1.1..1..1B1.',
    '...1BBBBBBBBB1..',
    '..1BBBBBBBBBBB1.',
    '.1BB3BBBBBB3BBB1',
    '.1BBBBBBBBBBBBB1',
    '..1BBBBBBBBBBB1.',
    '...11111111111..',
  ].map((r) => r.replaceAll('B', body).replaceAll('E', eye));
  const feet =
    legs === 0
      ? ['..1.1.1..1.1.1..', '.1..1..1..1..1..', '1...1...1..1...1', '................']
      : ['...1.1.11.1.1...', '..1..1.1..1..1..', '.1...1.1..1...1.', '................'];
  return [...top, ...feet];
}

/** A fly: a dark round body with white wings up (0) or down (1), red eyes, thin legs. */
const flyBody = [
  '................',
  '................',
  '................',
  '................',
  '......1111......',
  '....11aaaa11....',
  '...17aaaaa71....',
  '...14aaaaa41....',
  '..1aaaaaaaaa1...',
  '..1abababab1....',
  '...1aaaaaaa1....',
  '....1111111.....',
  '....1..1..1.....',
  '...1...1...1....',
  '..1....1....1...',
  '................',
];
const wing = (rows: readonly [number, string][]): string[] =>
  flyBody.map((row, y) => {
    const w = rows.find(([r]) => r === y)?.[1];
    if (!w) return row;
    return [...row].map((c, x) => (w[x] && w[x] !== '.' ? w[x] : c)).join('');
  });
const flyStand = wing([
  [3, '.......44.......'],
  [4, '......1441......'],
]);
const fly0 = wing([
  [0, '....44....44....'],
  [1, '...4444..4444...'],
  [2, '...14441.4441...'],
  [3, '....1441441.....'],
]);
const fly1 = wing([
  [5, '44............44'],
  [6, '444..........444'],
  [7, '.44..........44.'],
]);

/** A barrel on its side, its hoops (a) and staves turning a quarter turn a frame. */
function barrel(k: 0 | 1 | 2 | 3): string[] {
  const staves = ['2232', '2322', '3222', '2223'][k] as string;
  const row = (i: number): string => {
    const s = staves.repeat(4).slice(i % 4, (i % 4) + 10);
    return s;
  };
  return [
    '................',
    '.....111111.....',
    '...11aaaaaa11...',
    '..1a2222222aa1..',
    `.1a${row(0)}a1.`.slice(0, 16),
    `.1a${row(1)}a1.`.slice(0, 16),
    `1aa${row(2)}aa1`.slice(0, 16),
    `1ab${row(3)}ba1`.slice(0, 16),
    `1ab${row(0)}ba1`.slice(0, 16),
    `1aa${row(1)}aa1`.slice(0, 16),
    `.1a${row(2)}a1.`.slice(0, 16),
    `.1a${row(3)}a1.`.slice(0, 16),
    '..1aa2222222a1..',
    '...11aaaaaa11...',
    '.....111111.....',
    '................',
  ];
}

/** A living flame: red outside, yellow in, white-hot eyes; its tips flicker (0, 1). */
const fire0 = [
  '.......7........',
  '......77....7...',
  '...7..797..77...',
  '...77.7997.77...',
  '..7977799779977.',
  '..799799999997..',
  '.77999999999977.',
  '.79999999999997.',
  '.79944999449997.',
  '7799414994149977',
  '7999414994149997',
  '7999999999999997',
  '7799999999999977',
  '.77999999999977.',
  '..777999999777..',
  '....77777777....',
];
const fire1 = [
  '....7......7....',
  '....77....77....',
  '...797..7797....',
  '...7997.7997..7.',
  '.7.79977999977..',
  '.7799999999997..',
  '.77999999999977.',
  '.79999999999997.',
  '.79944999449997.',
  '7799414994149977',
  '7999414994149997',
  '7999999999999997',
  '7799999999999977',
  '.77999999999977.',
  '..777999999777..',
  '....77777777....',
];

export const specialEnemiesDef: SpriteDef = {
  palette: 'enemies-overworld',
  frames: {
    icicle,
    'crab-0': crab(0, '7', '4'),
    'crab-1': crab(1, '7', '4'),
    // Angry: the body turns the area's main colour and the eyes red.
    'crab-angry-0': crab(0, '2', '7'),
    'crab-angry-1': crab(1, '2', '7'),
    'fly-stand': flyStand,
    'fly-0': fly0,
    'fly-1': fly1,
    'barrel-0': barrel(0),
    'barrel-1': barrel(1),
    'barrel-2': barrel(2),
    'barrel-3': barrel(3),
    'fire-enemy-0': fire0,
    'fire-enemy-1': fire1,
  },
};

/** The Atom: a gold nucleus inside three white orbits, the orbits turning (0, 1). */
const atom0 = [
  '................',
  '......0000......',
  '....00111100....',
  '...0110000110...',
  '..010..55..010..',
  '..10..5665..01..',
  '.010.566665.010.',
  '.01..566665..10.',
  '.01..566665..10.',
  '.010.566665.010.',
  '..10..5665..01..',
  '..010..55..010..',
  '...0110000110...',
  '....00111100....',
  '......0000......',
  '................',
];
const atom1 = [
  '................',
  '..000......000..',
  '..0110....0110..',
  '..01110..01110..',
  '...0011..1100...',
  '....01556510....',
  '....05666650....',
  '....56666665....',
  '....56666665....',
  '....05666650....',
  '....01556510....',
  '...0011..1100...',
  '..01110..01110..',
  '..0110....0110..',
  '..000......000..',
  '................',
];

/** The Hammer item: a grey head on a brown handle, standing on its head. */
const hammerItem = [
  '................',
  '.......00.......',
  '......0990......',
  '......0990......',
  '......0990......',
  '......0990......',
  '......0990......',
  '......0990......',
  '......0990......',
  '..000000000000..',
  '.0bbbbbbbbbbb10.',
  '.0b1111111111b0.',
  '.0bbbbbbbbbbbb0.',
  '.0bbbbbbbbbbbb0.',
  '..000000000000..',
  '................',
];
/** The hammer held overhead (HammerWeapon "above"): head up. */
const hammerUp = [...hammerItem].reverse();
/** The hammer swung forward (HammerWeapon "side"): head out to the right, handle back. */
const hammerSide = [
  '................',
  '..........0000..',
  '.........0bbb10.',
  '.........0b11b0.',
  '.........0b1bb0.',
  '.........0b1bb0.',
  '0000000000b1bb0.',
  '0999999990b1bb0.',
  '0999999990b1bb0.',
  '0000000000b1bb0.',
  '.........0b1bb0.',
  '.........0b1bb0.',
  '.........0bbbb0.',
  '..........0000..',
  '................',
  '................',
];

/** The Wing: a white feathered wing with a gold root, flapping up (0) and down (1). */
const wing0 = [
  '................',
  '..0000..........',
  '.011110.........',
  '.0111110........',
  '..01111100000...',
  '..0111111111100.',
  '...01111111111a0',
  '...0111111111aa0',
  '....01111111aa0.',
  '....011111aaa0..',
  '.....0111aaa0...',
  '.....055aa00....',
  '....05665.......',
  '....0550........',
  '.....00.........',
  '................',
];
const wing1 = [
  '................',
  '................',
  '................',
  '................',
  '.......000......',
  '....0001110000..',
  '..00111111111a0.',
  '.01111111111aa0.',
  '.0111111111aaa0.',
  '..01111111aaa0..',
  '...0111111aa0...',
  '....0111aa00....',
  '....05665.......',
  '....0550........',
  '.....00.........',
  '................',
];

/** Frames the `items` sheet adds (sprites/items.ts). */
export const specialItemFrames: Record<string, string[]> = {
  'atom-0': atom0,
  'atom-1': atom1,
  hammer: hammerItem,
  'hammer-up': hammerUp,
  'hammer-side': hammerSide,
  'wing-0': wing0,
  'wing-1': wing1,
};
