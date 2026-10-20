import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH } from '@engine/gfx/pixelart';

/**
 * Original "green-tunic adventurer" character for the sword-wielding ("link") role. Drawn here from
 * scratch: a pointy-capped elf with a short sword and a round-topped shield slung on the back.
 *
 * Palette index roles (identical across every variant so recolours are plain index swaps):
 *   0 outline   1 tunic   2 tunic shade / cap band   3 skin   4 hair   5 boots & belt
 *   6 glint     7 blade   8 grip / blade shade       9 hilt & shield trim   a shield
 */
export const linkPalettes: Record<string, string[]> = {
  link: [
    NES.black,
    NES.greenMid,
    NES.greenDark,
    NES.skin,
    NES.brown,
    NES.brownDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.blueMid,
  ],
  // Classic play's white tunic (the original Crossover's, from the mushroom).
  'link-white': [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.skin,
    NES.brown,
    NES.brownDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.blueMid,
  ],
  // The campaign's Blue Ring (0.4.37, owner: light blue, clear of the shield's deep blue).
  'link-blue': [
    NES.black,
    NES.skyLight,
    NES.blueLight,
    NES.skin,
    NES.brown,
    NES.brownDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.blueMid,
  ],
  'link-red': [
    NES.black,
    NES.red,
    NES.redDark,
    NES.skin,
    NES.brown,
    NES.brownDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.blueMid,
  ],
  'link-star-0': [
    NES.black,
    NES.yellow,
    NES.orange,
    NES.white,
    NES.yellowLight,
    NES.redDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.white,
    NES.cyan,
  ],
  'link-star-1': [
    NES.black,
    NES.cyan,
    NES.teal,
    NES.skin,
    NES.white,
    NES.blueDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.pink,
  ],
  'link-star-2': [
    NES.black,
    NES.pink,
    NES.magenta,
    NES.yellowLight,
    NES.white,
    NES.brownDark,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.cyan,
    NES.yellow,
  ],
  'link-star-3': [
    NES.black,
    NES.white,
    NES.lightGray,
    NES.skin,
    NES.brown,
    NES.darkGray,
    NES.white,
    NES.lightGray,
    NES.gray,
    NES.yellow,
    NES.greenLight,
  ],
};

/* ---------- composition helpers ---------- */

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/** Paint the non-transparent pixels of `layer` onto a copy of `base` at (dx, dy). */
function paste(base: readonly string[], layer: readonly string[], dx: number, dy: number): string[] {
  const out = base.map((r) => r.split(''));
  layer.forEach((row, y) => {
    const ty = y + dy;
    const target = out[ty];
    if (!target) return;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string;
      const tx = x + dx;
      if (ch === '.' || tx < 0 || tx >= target.length) continue;
      target[tx] = ch;
    }
  });
  return out.map((r) => r.join(''));
}

const compose = (w: number, h: number, ...layers: [readonly string[], number, number][]): string[] =>
  layers.reduce<string[]>((acc, [rows, dx, dy]) => paste(acc, rows, dx, dy), blank(w, h));

/* ---------- parts (all facing right) ---------- */

// Head: pointed cap with a tail drooping behind, hair fringe, pointed ear, 10 rows (16 wide).
const head = [
  '........0000....',
  '.......011110...',
  '......01111110..',
  '.....0111111110.',
  '....011111111110',
  '.000022222222220',
  '011004443333330.',
  '.0103433330330..',
  '..0043333333330.',
  '...00333333330..',
];

// Torso (rows 14..24 of the standing pose): tunic, belt, shield slung on the back, sword arm held
// at the hip. Width 16, 11 rows. Sword itself is a separate layer.
const torso = [
  '....02111110....',
  '.000021111130...',
  '0aaa0211111330..',
  '0a9a0211111330..',
  '099902111110330.',
  '0a9a02111110330.',
  '0aaa05555550....',
  '.0aa02111110....',
  '..0002111110....',
  '....02111110....',
  '....0000000.....',
];

// Sword held point-down beside the hip (grip at top). 3 wide, 10 tall.
const swordDown = ['.8.', '.8.', '999', '.7.', '.7.', '.7.', '.7.', '.7.', '.7.', '.6.'];

// Sword held point-up. 3 wide, 10 tall.
const swordUp = ['.6.', '.7.', '.7.', '.7.', '.7.', '.7.', '.7.', '999', '.8.', '.8.'];

// Horizontal sword for thrusts: grip, guard, 2px blade with a bright tip. 10 wide, 3 tall.
const swordFwd = ['.9........', '8977777776', '.98888888.'];

// Legs (rows 25..31 of the standing pose), 16 wide, 7 rows.
const legsStand = [
  '.....0330330....',
  '.....0330330....',
  '.....0550550....',
  '.....0550550....',
  '....055505550...',
  '....055505550...',
  '....000000000...',
];

// Contact pose: back leg trailing, front leg planted.
const legsWalk0 = [
  '.....0330330....',
  '....03300330....',
  '...0550.0550....',
  '..0550..0550....',
  '.05550..05550...',
  '.05550..05550...',
  '.00000..00000...',
];

// Passing pose: legs together, body a pixel higher (8 rows).
const legsWalk1 = [
  '.....0330330....',
  '.....0330330....',
  '.....0550550....',
  '.....0550550....',
  '.....0550550....',
  '....055505550...',
  '....055505550...',
  '....000000000...',
];

// Lead pose: front knee lifted and reaching forward, back leg straight.
const legsWalk2 = [
  '.....03300330...',
  '.....033005550..',
  '.....0550.0550..',
  '.....0550.0550..',
  '....05550.05550.',
  '....05550.00000.',
  '....00000.......',
];

// Jump: back leg tucked, front leg reaching down.
const legsJump = [
  '....0330.0330...',
  '...0550..0330...',
  '..0550...0550...',
  '.05550...0550...',
  '.00000..05550...',
  '........05550...',
  '........00000...',
];

/* ---------- frames ---------- */

const W = 16;
const H = 32;

const standing = (legs: readonly string[], legsY = 25): string[] =>
  compose(W, H, [head, 0, 4], [torso, 0, 14], [legs, 0, legsY], [swordDown, 13, 18]);

const idle = standing(legsStand);
const walk0 = standing(legsWalk0);
const walk1 = compose(W, H, [head, 0, 3], [torso, 0, 13], [legsWalk1, 0, 24], [swordDown, 13, 17]);
const walk2 = standing(legsWalk2);
const jump = standing(legsJump);

// Kneeling in the lower half: head, compressed body, sword held upright in front of the cap.
const crouch = compose(
  W,
  H,
  [head, 0, 16],
  [
    [
      '.000021111110...',
      '0aaa02111110.999',
      '0a9a05555550338.',
      '099902111110338.',
      '.0aa055505550...',
      '..00000000000...',
    ],
    0,
    26,
  ],
  [['6', '7', '7', '7', '7', '7', '7', '7'], 14, 19],
);

// Crouching low stab (24 wide): kneel body with the sword level at the belt.
const crouchAttack = compose(
  24,
  H,
  [head, 0, 16],
  [
    [
      '.000021111110...',
      '0aaa02111111330.',
      '0a9a05555550338.',
      '099902111110....',
      '.0aa055505550...',
      '..00000000000...',
    ],
    0,
    26,
  ],
  [swordFwd, 14, 27],
);

// Attack windup (24 wide): sword raised behind the shoulder, pointing up and back.
const attack0 = compose(
  24,
  H,
  [head, 0, 4],
  [
    [
      '....02111110....',
      '.000021111130...',
      '0aaa0211111330..',
      '0a9a0211111 0338',
      '099902111110338.',
      '0a9a02111110.999',
      '0aaa05555550....',
      '.0aa02111110....',
      '..0002111110....',
      '....02111110....',
      '....0000000.....',
    ].map((r) => r.replace(' ', '1')),
    0,
    14,
  ],
  [legsStand, 0, 25],
  [['......6', '.....7.', '....7..', '...7...', '..7....', '.7.....', '7......'], 14, 11],
);

// Full thrust (24 wide): body leans in, sword level, tip at the right edge.
const attack1 = compose(
  24,
  H,
  [head, 1, 4],
  [
    [
      '.....02111110...',
      '..000021111130..',
      '.0aaa02111113 3.',
      '.0a9a0211111330.',
      '.099902111110...',
      '.0a9a02111110...',
      '.0aaa05555550...',
      '..0aa02111110...',
      '...0002111110...',
      '.....02111110...',
      '.....0000000....',
    ].map((r) => r.replace(' ', '3')),
    0,
    14,
  ],
  [legsWalk0, 1, 25],
  [swordFwd, 14, 16],
);

// Recovery (24 wide): sword still level but pulled halfway back.
const attack2 = compose(
  24,
  H,
  [head, 0, 4],
  [
    [
      '....02111110....',
      '.000021111130...',
      '0aaa02111133....',
      '0a9a02111133....',
      '099902111110....',
      '0a9a02111110....',
      '0aaa05555550....',
      '.0aa02111110....',
      '..0002111110....',
      '....02111110....',
      '....0000000.....',
    ],
    0,
    14,
  ],
  [legsStand, 0, 25],
  [swordFwd, 12, 15],
);

// Mid-air downward stab: body raised, legs tucked, blade below the feet.
const downThrust = compose(
  W,
  H,
  [head, 0, 0],
  [
    [
      '....02111110....',
      '.000021111130...',
      '0aaa0211111330..',
      '0a9a0211111330..',
      '099902111110330.',
      '0a9a02111110330.',
      '0aaa05555550....',
      '.0aa02111110....',
      '..0002111110....',
      '....02111110....',
      '....0000000.....',
    ],
    0,
    10,
  ],
  [['....03300330....', '...0550.05550...', '...0550.05550...', '...0000.00000...'], 0, 21],
  [['.8.', '.8.', '999', ...Array.from({ length: 10 }, () => '.7.'), '.6.'], 13, 18],
);

// Knockback: leaning back, sword arm flung up, legs splayed.
const hurt = compose(
  W,
  H,
  [head, -1, 5],
  [
    [
      '...02111110.....',
      '000021111130....',
      'aaa0211111 0....',
      'a9a0211111 0....',
      '9990211111 0....',
      'a9a02111110.....',
      'aaa05555550.....',
      '0aa02111110.....',
      '.0002111110.....',
      '...02111110.....',
      '...0000000......',
    ].map((r) => r.replace(' ', '1')),
    0,
    15,
  ],
  [legsWalk0, 0, 25],
  [['.33', '.33'], 12, 14],
  [swordUp, 13, 4],
);

// Fallen: face down on the ground, head to the left, boots flat to the right.
const die = compose(W, H, [
  [
    '..0000..........',
    '.011110.........',
    '01111110........',
    '022222220000000.',
    '044333330211150.',
    '0330033302111550',
    '0333333021155550',
    '.000000.00000000',
  ],
  0,
  24,
]);

// Climbing, seen from behind: shield with a spearhead emblem on the back, cap tail hanging down
// over it, one arm reaching up and the other gripping low, one knee raised.
const climb0 = [
  '................',
  '................',
  '......0000......',
  '.....011110.....',
  '....01111110....',
  '...0111111110...',
  '.0.0111111110...',
  '0300222222220...',
  '0300411444440...',
  '0300411444440...',
  '0300411444440...',
  '030.0414444 0...',
  '030.0100000 0...',
  '0300a1aaaaaa0000',
  '0300a1a99aaa0030',
  '0300a19999aa0030',
  '0300a199999a0030',
  '.000aaa99aaa0030',
  '....aaa99aaa0030',
  '...0aaaaaaaa0030',
  '...0555555550000',
  '...0222222220...',
  '...0000000000...',
  '...0330..0330...',
  '...0330..0330...',
  '...0550..0330...',
  '...0550..0550...',
  '...0000..0550...',
  '.........0550...',
  '.........0550...',
  '.........0550...',
  '.........0000...',
].map((r) => r.replace(/ /g, '.'));

const climb1 = flipH(climb0);

// Mid-air upward stab: body shifted a pixel left to make room for the sword arm, which is raised straight
// up beside the head to hold the hilt at cap height; the blade runs out through the top of the frame.
const upThrust = compose(
  W,
  H,
  [head, -1, 4],
  [
    [
      '...02111110.3330',
      '00002111111330..',
      'aaa02111110.....',
      'a9a02111110.....',
      '99902111110.....',
      'a9a02111110.....',
      'aaa05555550.....',
      '0aa02111110.....',
      '.0002111110.....',
      '...02111110.....',
      '...0000000......',
    ],
    0,
    14,
  ],
  [legsJump, -1, 25],
  [Array.from({ length: 6 }, () => '33'), 14, 8],
  [['.6.', ...Array.from({ length: 6 }, () => '.7.'), '999'], 13, 0],
);

// The guard's torso: the shield arm brought round to the front (the shield itself is `shieldFront`).
const torsoGuard = [
  '....02111110....',
  '...0021111110...',
  '..03321111110...',
  '..03321111110...',
  '..03321111110...',
  '..03321111110...',
  '.000055555550...',
  '....02111110....',
  '....02111110....',
  '....02111110....',
  '....0000000.....',
];

// The shield held out in front, chest to knees. 6 wide, 13 rows.
const shieldFront = [
  '.0000.',
  '099990',
  '09aa90',
  '09aa90',
  '09aa90',
  '09aa90',
  '09aa90',
  '09aa90',
  '09aa90',
  '09aa90',
  '099990',
  '.0990.',
  '..00..',
];

// Guarding: the shield comes off the back and is held out in front, chest to knees, while the sword
// hangs point-down in the back hand.
const block = compose(
  W,
  H,
  [head, 0, 4],
  [torsoGuard, 0, 14],
  [legsStand, 0, 25],
  [swordDown, 1, 18],
  [shieldFront, 10, 15],
);

// Swimming (0.4.25): the guard pose with the legs kicking. A wide scissor kick, then the legs
// drawn together with the boots pointed back; the body bobs a pixel between the two.
const legsKick0 = [
  '.....0330330....',
  '....03300330....',
  '...0330..0330...',
  '..0550....0550..',
  '.0550......0550.',
  '0550........000.',
  '000.............',
];
const legsKick1 = [
  '.....0330330....',
  '.....0330330....',
  '....0550550.....',
  '....0550550.....',
  '...05550550.....',
  '...0555.0550....',
  '...000..000.....',
];
const swimming = (legs: readonly string[], dy: number): string[] =>
  compose(
    W,
    H,
    [head, 0, 4 + dy],
    [torsoGuard, 0, 14 + dy],
    [legs, 0, 25 + dy],
    [swordDown, 1, 18 + dy],
    [shieldFront, 10, 15 + dy],
  );
const swim0 = swimming(legsKick0, 0);
const swim1 = swimming(legsKick1, -1);

// Throwing: the sword arm is empty and stretched out level at the shoulder, palm open, with the sword
// hanging unheld at the hip.
const throwFrame = compose(
  W,
  H,
  [head, 0, 4],
  [
    [
      '....02111110..33',
      '.000021111133333',
      '0aaa021111133333',
      '0a9a021111100033',
      '099902111110....',
      '0a9a02111110....',
      '0aaa05555550....',
      '.0aa02111110....',
      '..0002111110....',
      '....02111110....',
      '....0000000.....',
    ],
    0,
    14,
  ],
  [legsStand, 0, 25],
  [swordDown, 12, 18],
);

export const linkDef: SpriteDef = {
  palette: 'link',
  frames: {
    idle,
    'walk-0': walk0,
    'walk-1': walk1,
    'walk-2': walk2,
    jump,
    crouch,
    'attack-0': attack0,
    'attack-1': attack1,
    'attack-2': attack2,
    'crouch-attack': crouchAttack,
    'down-thrust': downThrust,
    'up-thrust': upThrust,
    block,
    throw: throwFrame,
    hurt,
    die,
    'climb-0': climb0,
    'climb-1': climb1,
    'swim-0': swim0,
    'swim-1': swim1,
  },
};
