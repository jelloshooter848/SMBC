import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, recolor } from './paint';

/*
 * Kakariko Village's people from above (0.4.41), all original: the townsfolk (`town-folk`: each
 * with two idle frames facing down and one facing right, mirrored for left; the hen; the puff of
 * smoke of a hero switch) and the heroes who walk the village (`td-<hero>`, the `link-td`
 * contract: down-0/1, up-0/1, side-0/1). Everyone is built on one chibi body, 16×16 (a big head
 * and a short body, so tall heroes read at this size), with their own head, clothes and props;
 * the template's letters are filled per person:
 *
 *   O outline   H hair (or hat, helmet)   S skin   s skin shade   E eyes
 *   C clothes   c clothes shade           A belt / apron / trim   L legs   F shoes
 *
 * One palette for all (`town-folk`); the heroes' sheets use it too, and their power palettes
 * (fire Mario and Luigi, Samus's Varia) and Luigi's are recolours of it.
 *
 * Palette `town-folk` (index: colour):
 *   0 outline  1 skin  2 skin shade  3 brown hair  4 grey hair  5 blonde  6 black hair
 *   7 white  8 light grey  9 dark grey  a red  b dark red  c blue  d dark blue  e green
 *   f dark green  g yellow  h orange  i purple  j dark purple  k brown  l dark brown  m pink
 *   n teal  o dark teal  p tan  q dark tan  r steel  s dark steel  t sky blue  u gold
 *   v coral  w dark coral (0.4.42: the Traveler's Wallet)
 */
export const FOLK_PALETTE: readonly string[] = [
  '#201010',
  '#f8c890',
  '#d09060',
  '#784020',
  '#b8b8b8',
  '#f0c840',
  '#303040',
  '#f8f8f8',
  '#c8c8c8',
  '#686868',
  '#d83830',
  '#902018',
  '#3060d0',
  '#203890',
  '#40a040',
  '#206828',
  '#f0d040',
  '#e08030',
  '#9050c0',
  '#603080',
  '#a06030',
  '#603818',
  '#f090b0',
  '#30a0a0',
  '#206868',
  '#e0c088',
  '#b09058',
  '#a8b8c8',
  '#607080',
  '#70c8f8',
  '#c89818',
  '#f08870',
  '#b84838',
];

type Rows = readonly string[];
type Fill = Readonly<Record<string, string>>;

/* ---------------------------------------------------------------------------------------------- */
/* The chibi body                                                                                  */
/* ---------------------------------------------------------------------------------------------- */

const HEAD_FRONT: Rows = [
  '................',
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHSSSSSSHO...',
  '...OSSESSESSO...',
  '...OsSSSSSSsO...',
  '....OsSSSSsO....',
];
const BODY_FRONT: Rows = [
  '...OOCCCCCCOO...',
  '..OSCCCCCCCCSO..',
  '..OScCCCCCCcSO..',
  '...OAAAAAAAAO...',
  '....OLLLLLLO....',
];
const FEET_FRONT: readonly Rows[] = [
  ['....OFFOOFFO....', '.....OO..OO.....'],
  ['....OFFOOLLO....', '.....OO.OFFO....'],
  ['....OLLOOFFO....', '....OFFO.OO.....'],
];

const HEAD_BACK: Rows = [
  '................',
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OsHHHHHHsO...',
  '....OsHHHHsO....',
];
const BODY_BACK: Rows = [
  '...OOCCCCCCOO...',
  '..OSCCCCCCCCSO..',
  '..OScCCCCCCcSO..',
  '...OAAAAAAAAO...',
  '....OLLLLLLO....',
];

const HEAD_SIDE: Rows = [
  '................',
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHHHHSSSSO...',
  '...OHHHSSSESO...',
  '...OHHsSSSSSSO..',
  '....OHsSSSSOO...',
];
const BODY_SIDE: Rows = [
  '....OOCCCCOO....',
  '....OCCCCSCO....',
  '....OcCCCSCO....',
  '....OAAAAAAO....',
  '....OLLLLLLO....',
];
const FEET_SIDE: readonly Rows[] = [
  ['....OFFOOFFO....', '.....OO..OO.....'],
  ['...OFFO..OFFO...', '....OO....OO....'],
  ['.....OFFFFO.....', '......OOOO......'],
];

export type View = 'front' | 'back' | 'side';

/** A person's look: what fills the template, and what is drawn over it. */
export interface Look {
  fill: Fill;
  /** Pasted over each view (props, hats, beards); [rows, x, y]. */
  over?: Partial<Record<View, readonly (readonly [Rows, number, number])[]>>;
  /** Other heads, if the template's will not do. */
  head?: Partial<Record<View, Rows>>;
  /** Other bodies (rows 9-13). */
  body?: Partial<Record<View, Rows>>;
}

/** One frame of `look`: `view`, with feet pose `step` (0 standing, 1 and 2 the walk). */
export function body(look: Look, view: View, step: 0 | 1 | 2 = 0): string[] {
  const head = look.head?.[view] ?? (view === 'front' ? HEAD_FRONT : view === 'back' ? HEAD_BACK : HEAD_SIDE);
  const torso =
    look.body?.[view] ?? (view === 'front' ? BODY_FRONT : view === 'back' ? BODY_BACK : BODY_SIDE);
  const feet = (view === 'side' ? FEET_SIDE : FEET_FRONT)[step] as Rows;
  const c = Canvas.from([...head, ...torso, ...feet]);
  for (const [rows, x, y] of look.over?.[view] ?? []) c.paste(rows, x, y);
  const fill: Fill = { O: '0', E: '0', S: '1', s: '2', ...look.fill };
  return recolor(c.rows(), fill).map((r) => r.replace(/[A-Z]/g, '.'));
}

/** The head moved down a pixel (the idle frame's breath). */
function breathe(rows: Rows): string[] {
  return ['................', ...rows.slice(0, 9), ...rows.slice(10)];
}

/* ---------------------------------------------------------------------------------------------- */
/* Townsfolk                                                                                       */
/* ---------------------------------------------------------------------------------------------- */

const SPEAR: Rows = ['r', 's', 'k', 'k', 'k', 'k', 'k', 'k', 'k', 'k', 'k', 'k', 'k', 'l'];
const BEARD: Rows = ['.777777.', '.777777.', '..7777..', '...77...'];
const MUSTACHE: Rows = ['.l..l.', '.llll.'];
const LONG_HAIR_FRONT: readonly (readonly [Rows, number, number])[] = [
  [['H', 'H', 'H', 'H', 'H'], 3, 5],
  [['H', 'H', 'H', 'H', 'H'], 12, 5],
];
const STRAW_HAT: Rows = ['....gggggg....', '..gggggggggg..', '.uuuuuuuuuuuu.', 'gggggggggggggg'];

const FOLK_LOOKS: Readonly<Record<string, Look>> = {
  guard: {
    fill: { H: 'r', C: 'c', c: 'd', A: 's', L: 'd', F: 'l' },
    over: {
      front: [
        [SPEAR, 14, 1],
        [['..ss..'], 5, 1],
      ],
      side: [[SPEAR, 11, 1]],
    },
  },
  kid: { fill: { H: '3', C: 'e', c: 'f', A: 'k', L: '1', F: 'l' } },
  woman: {
    fill: { H: '5', C: 'm', c: 'i', A: '7', L: 'm', F: 'b' },
    over: { front: LONG_HAIR_FRONT, side: [[['H', 'H', 'H', 'H'], 4, 8]] },
  },
  gardener: {
    fill: { H: '3', C: 'e', c: 'f', A: 'k', L: 'c', F: 'l' },
    over: { front: [[STRAW_HAT, 1, 0]], side: [[STRAW_HAT, 1, 0]] },
  },
  'old-man': {
    fill: { H: '4', C: 'i', c: 'j', A: 'u', L: 'i', F: 'l' },
    over: { front: [[BEARD, 4, 8]], side: [[['7777', '777.', '77..'], 9, 8]] },
  },
  barkeep: {
    fill: { H: '6', C: '7', c: '8', A: 'l', L: 'l', F: '0' },
    over: { front: [[MUSTACHE, 5, 7]], side: [[['ll', 'l.'], 11, 7]] },
  },
  patron: { fill: { H: '3', C: 'a', c: 'b', A: 'k', L: 'd', F: 'l' } },
  'patron-2': { fill: { H: '5', C: 'n', c: 'o', A: 'k', L: 'k', F: 'l' } },
  stranger: {
    fill: { H: '6', C: 'j', c: '6', A: '9', L: 'j', F: '0' },
    over: { front: [[['OOOOOOOOOO', 'O66666666O'], 3, 0]], side: [[['OOOOOOOOOO', 'O66666666O'], 3, 0]] },
  },
  healer: {
    fill: { H: 'h', C: 'h', c: 'b', A: '7', L: 'h', F: 'l' },
    over: { front: [[['7777', '7777', '7777'], 6, 10]] },
  },
  mother: {
    fill: { H: '3', C: 'h', c: 'k', A: '7', L: 'h', F: 'l' },
    over: { front: [[['OHHO', 'OHHO'], 6, 0]] },
  },
  child: { fill: { H: '5', C: 't', c: 'c', A: 'c', L: '1', F: 'l' } },
  // The shop (0.4.42): the shopkeeper, bald with a black moustache, a teal shirt, a white apron.
  shopkeeper: {
    fill: { H: '1', C: 'n', c: 'o', A: '7', L: 'l', F: '0' },
    over: {
      front: [
        [MUSTACHE, 5, 7],
        [['7777', '7777', '7777'], 6, 10],
        [['.22.'], 6, 2],
      ],
      side: [[['ll', 'l.'], 11, 7]],
    },
  },
  // Hobb the tanner (0.4.42), who stitches wallets: grey hair under a brown cap, a leather apron.
  tanner: {
    fill: { H: 'k', C: 'e', c: 'f', A: 'l', L: 'l', F: 'l' },
    over: {
      front: [
        [['kkkk', 'kkkk', 'kkkk'], 6, 10],
        [['4', '4'], 3, 6],
        [['4', '4'], 12, 6],
      ],
      side: [[['44', '44'], 4, 6]],
    },
  },
};

/** The hen: white, a red comb, pecking (frame 1), wings up when she flutters. Faces right. */
const HEN: Readonly<Record<string, Rows>> = {
  'hen-0': [
    '................',
    '................',
    '................',
    '................',
    '..........aa....',
    '.........0770...',
    '.........07070h.',
    '....0....0777hh.',
    '...070..07770a..',
    '...0770077770...',
    '...07777777770..',
    '....0777777870..',
    '....07778888700.',
    '.....0777777700.',
    '......00g00g....',
    '.......gg..gg...',
  ],
  'hen-1': [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....0...........',
    '...070..........',
    '...0770.....aa..',
    '...077700..0770.',
    '...0777777707070h',
    '....077777777hh.',
    '....07778888a0..',
    '.....077777770..',
    '......00g00g....',
    '.......gg..gg...',
  ].map((r) => r.slice(0, 16)),
  'hen-flap': [
    '................',
    '...0.......0....',
    '..070.....070...',
    '..0770...0770...',
    '...0770.07770aa.',
    '....07707770770.',
    '....0777777707070h',
    '....077777777hh.',
    '...07777777770..',
    '...07777778870..',
    '....077788887...',
    '.....07777770...',
    '......00000.....',
    '.......g..g.....',
    '......gg..gg....',
    '................',
  ].map((r) => r.slice(0, 16)),
};

/** The puff of a hero switch: a ring of smoke opening out, and one still cloud (reduce flashing). */
function puff(r: number, ring: boolean): string[] {
  const c = new Canvas();
  c.ellipse(8, 8, r, r, (_x, _y, d) => (ring && d < 0.45 ? null : d > 0.8 ? '8' : '7'));
  for (const [x, y] of [
    [3, 3],
    [12, 4],
    [4, 12],
    [12, 12],
  ] as const)
    if (r > 5) c.ellipse(x, y, 2, 2, '7');
  return c.rows();
}

const folkFrames: Record<string, string[]> = {};
for (const [who, look] of Object.entries(FOLK_LOOKS)) {
  const front = body(look, 'front');
  folkFrames[`${who}-0`] = front;
  folkFrames[`${who}-1`] = breathe(front);
  folkFrames[`${who}-side`] = body(look, 'side');
  folkFrames[`${who}-up`] = body(look, 'back');
}
for (const [k, rows] of Object.entries(HEN)) folkFrames[k] = [...rows];
folkFrames['puff-0'] = puff(4, false);
folkFrames['puff-1'] = puff(6, true);
folkFrames['puff-2'] = puff(7.5, true);
folkFrames['puff-calm'] = puff(6, false);

/*
 * The village HUD's little icons (8×8, drawn here; each with its own dark outline so it reads on
 * grass, paths and floorboards): lives (a green mushroom), and a plumber's power from above the
 * fray (no mushroom, a red one, a fire flower).
 */
const MUSHROOM: Rows = [
  '..0000..',
  '.0aCCa0.',
  '0aaCCaa0',
  '0aCaaCa0',
  '00000000',
  '.011110.',
  '.010010.',
  '..0000..',
];
const shroom = (cap: string, spot: string) => MUSHROOM.map((r) => r.replace(/a/g, cap).replace(/C/g, spot));
folkFrames['hud-life'] = shroom('e', '7');
folkFrames['hud-shroom'] = shroom('a', '7');
folkFrames['hud-small'] = shroom('9', '8');
folkFrames['hud-flower'] = [
  '.000000.',
  '0hhgghh0',
  '0g7777g0',
  '0hhgghh0',
  '.000000.',
  '0e0ee0e0',
  '.0eeee0.',
  '..0000..',
];

/**
 * The Traveler's Wallet (0.4.42, Hobb's gift; held over the hero's head as he hands it over), an
 * original drawstring money bag: a coral body shaded darker below, a flared ruffled top with a
 * light zigzag trim, a cream band where it is cinched, a gold coin on the front, a darker swirled
 * band round the bottom, and the tie's cord looping off to the right with two orange beads. The
 * bag is centred on the frame (columns 2-13); only the cord hangs off to the side.
 */
folkFrames.wallet = [
  '................',
  '....00.00.00....',
  '...0vv0vv0vv0...',
  '...0vpvppvpv0...',
  '....00pppp00l...',
  '....0vvvvvv0.l..',
  '...0vvvvvvvv0.l.',
  '..0vvvvuuvvvv0l.',
  '..0vvvugguvvv0h.',
  '..0vvvugguvvv0h.',
  '..0wvvvuuvvvw0..',
  '..0wbwwbbwwbw0..',
  '...0bwbwwbwb0...',
  '....0bbbbbb0....',
  '.....000000.....',
  '................',
];

export const townFolkDef: SpriteDef = { palette: 'town-folk', frames: folkFrames };

/* ---------------------------------------------------------------------------------------------- */
/* The heroes from above                                                                           */
/* ---------------------------------------------------------------------------------------------- */

/** A hero's six frames from their look. */
function heroSet(look: Look): Record<string, string[]> {
  return {
    'down-0': body(look, 'front', 1),
    'down-1': body(look, 'front', 2),
    'up-0': body(look, 'back', 2),
    'up-1': body(look, 'back', 1),
    'side-0': body(look, 'side', 1),
    'side-1': body(look, 'side', 2),
  };
}

/** Mario: a red cap with a white badge and a brim, a moustache, red shirt and blue overalls. */
const MARIO: Look = {
  fill: { H: 'a', C: 'a', c: 'b', A: 'c', L: 'c', F: 'l' },
  head: {
    front: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHH77HHHO...',
      '...OHHH77HHHO...',
      '..OHHHHHHHHHHO..',
      '...O3SESSES3O...',
      '...OSSSSSSSSO...',
      '....OS3333SO....',
    ],
    back: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHHHHHO...',
      '...OHHHHHHHHO...',
      '...OHHHHHHHHO...',
      '...O33333333O...',
      '...Os333333sO...',
      '....OsSSSSsO....',
    ],
    side: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHH7HHO...',
      '...OHHHHHHHHHO..',
      '...O33HHSSSSHHO.',
      '...O333SSSESO...',
      '...O33sSSSSSSO..',
      '....O3sSS33OO...',
    ],
  },
  body: {
    front: [
      '...OOCCCCCCOO...',
      '..OSCAACCAACSO..',
      '..OScAAAAAAcSO..',
      '...OAAgAAgAAO...',
      '....OLLLLLLO....',
    ],
    back: [
      '...OOCCCCCCOO...',
      '..OSCACCCCACSO..',
      '..OScAAAAAAcSO..',
      '...OAAAAAAAAO...',
      '....OLLLLLLO....',
    ],
    side: [
      '....OOCCCCOO....',
      '....OCCCCSCO....',
      '....OAACCSAO....',
      '....OAAgAAAO....',
      '....OLLLLLLO....',
    ],
  },
};

/** Mega Man: the blue helmet with its light stripe and ear discs, a light blue chest. */
const MEGAMAN: Look = {
  fill: { H: 'c', C: 't', c: 'c', A: 'c', L: 'c', F: 'd' },
  head: {
    front: [
      '................',
      '.....OOOOOO.....',
      '....OHHttHHO....',
      '...OHHHttHHHO...',
      '...OHHHHHHHHO...',
      '..OtOSSSSSSOtO..',
      '..OtOSESSESOtO..',
      '...OHSSSSSSHO...',
      '....OHSSSSHO....',
    ],
    back: [
      '................',
      '.....OOOOOO.....',
      '....OHHttHHO....',
      '...OHHHttHHHO...',
      '...OHHHttHHHO...',
      '..OtHHHHHHHHtO..',
      '..OtHHHHHHHHtO..',
      '...OHHHHHHHHO...',
      '....OHHHHHHO....',
    ],
    side: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHttO....',
      '...OHHHHHHttO...',
      '...OHHHHHHHHO...',
      '...OHOtOSSSSO...',
      '...OHOtOSSESO...',
      '...OHHOSSSSSO...',
      '....OHHSSSSOO...',
    ],
  },
  body: {
    front: [
      '...OOCCCCCCOO...',
      '..OcCCCCCCCCcO..',
      '..OccCCCCCCccO..',
      '...OAAAAAAAAO...',
      '....OLLLLLLO....',
    ],
    back: [
      '...OOccccccOO...',
      '..OcCCCCCCCCcO..',
      '..OccCCCCCCccO..',
      '...OAAAAAAAAO...',
      '....OLLLLLLO....',
    ],
    side: [
      '....OOCCCCOO....',
      '....OCCCcccO....',
      '....OCCCcccO....',
      '....OAAAAAAO....',
      '....OLLLLLLO....',
    ],
  },
};

/** Samus: the round helmet with a green visor, big round shoulders, the arm cannon on her right. */
const SAMUS: Look = {
  fill: { H: 'h', C: 'h', c: 'b', A: 'b', L: 'h', F: 'b' },
  head: {
    front: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHHHHHO...',
      '...OHeeeeeeHO...',
      '...OHeffffeHO...',
      '...OHHeeeeHHO...',
      '...OHHHHHHHHO...',
      '....OHHHHHHO....',
    ],
    side: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHHHHHO...',
      '...OHHHHHeeeO...',
      '...OHHHHHefeO...',
      '...OHHHHHHeeO...',
      '...OHHHHHHHHO...',
      '....OHHHHHHO....',
    ],
  },
  body: {
    front: [
      '.OOggOCCCCOggOO.',
      'OgggggCCCCgggg9O',
      'OgggOcCCCcO99990',
      '..OOAAAAAAOO990.',
      '....OLLLLLLO....',
    ],
    back: [
      '.OOggOCCCCOggOO.',
      'OggggggCCggggggO',
      'OgggOcCCCcOgggO.',
      '..OOAAAAAAOO....',
      '....OLLLLLLO....',
    ],
    side: [
      '...OOggCCCOO....',
      '..OggggCC9999O..',
      '..OgggOCC9999O..',
      '....OAAAAAAO....',
      '....OLLLLLLO....',
    ],
  },
};

/** Simon: long brown hair under a red band, a leather tunic, the whip coiled at his belt. */
const SIMON: Look = {
  fill: { H: '3', C: 'k', c: 'l', A: 'u', L: 'l', F: 'l' },
  over: {
    front: [
      [['aaaaaaaa'], 4, 4],
      [['.uu.', 'u..u', '.uu.'], 11, 11],
    ],
    back: [
      [['aaaaaaaa'], 4, 4],
      [['HH', 'HH', 'HH'], 7, 9],
    ],
    side: [
      [['aaaaaa'], 4, 4],
      [['H', 'H', 'H'], 4, 9],
      [['.uu.', 'u..u', '.uu.'], 6, 11],
    ],
  },
};

/** Ryu: the blue hood and mask (the eyes showing), a blue gi, the sword's hilt over his back. */
const RYU: Look = {
  fill: { H: 'd', C: 'c', c: 'd', A: 'b', L: 'd', F: '6' },
  head: {
    front: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHHHHHO...',
      '...OHHHHHHHHO...',
      '...OHSSSSSSHO...',
      '...OHSESSESHO...',
      '...OHHHHHHHHO...',
      '....OHHHHHHO....',
    ],
    side: [
      '................',
      '.....OOOOOO.....',
      '....OHHHHHHO....',
      '...OHHHHHHHHO...',
      '...OHHHHHHHHO...',
      '...OHHHHSSSSO...',
      '...OHHHHSSESO...',
      '...OHHHHHHHHO...',
      '....OHHHHHHO....',
    ],
  },
  over: {
    front: [[['r', 'r'], 12, 0]],
    back: [[['r..', '.r.', '..9', '...9', '....9'], 9, 0]],
    side: [[['r', 'r', '9'], 3, 0]],
  },
};

/** Bill: dark hair under a red bandana, bare arms, a sleeveless vest, blue fatigues, his rifle. */
const BILL: Look = {
  fill: { H: '6', C: 'f', c: '2', A: 'l', L: 'd', F: 'l' },
  over: {
    front: [
      [['aaaaaaaa'], 4, 4],
      [['9999999', '..9.9..'], 4, 11],
    ],
    back: [
      [['aaaaaaaa'], 4, 4],
      [['.a.', 'aa.', 'a..'], 9, 6],
    ],
    side: [
      [['aaaaaa'], 5, 4],
      [['a', 'aa'], 3, 5],
      [['99999999', '9.......'], 8, 11],
    ],
  },
  body: {
    front: [
      '...OOCCCCCCOO...',
      '..O1CC1111CC1O..',
      '..O1CC1111CC1O..',
      '...OAAAAAAAAO...',
      '....OLLLLLLO....',
    ],
  },
};

/** The hero sheets (`td-<hero>`), all in the town-folk palette's colours. */
export const townHeroDefs: Record<string, SpriteDef> = {
  'td-mario': { palette: 'td-mario', frames: heroSet(MARIO) },
  'td-megaman': { palette: 'td-megaman', frames: heroSet(MEGAMAN) },
  'td-samus': { palette: 'td-samus', frames: heroSet(SAMUS) },
  'td-simon': { palette: 'td-simon', frames: heroSet(SIMON) },
  'td-ryu': { palette: 'td-ryu', frames: heroSet(RYU) },
  'td-bill': { palette: 'td-bill', frames: heroSet(BILL) },
};

/** The folk palette with some colours changed (by index character). */
function swapPalette(swaps: Readonly<Record<string, string>>): string[] {
  const idx = (ch: string) => parseInt(ch, 36);
  const p = [...FOLK_PALETTE];
  for (const [from, to] of Object.entries(swaps)) p[idx(from)] = FOLK_PALETTE[idx(to)] as string;
  return p;
}

export const townFolkPalettes: Record<string, string[]> = {
  'town-folk': [...FOLK_PALETTE],
  'td-mario': [...FOLK_PALETTE],
  // Luigi: Mario's set in green; fire: white cap and shirt (Mario's overalls red, Luigi's green).
  'td-luigi': swapPalette({ a: 'e', b: 'f' }),
  'td-mario-fire': swapPalette({ a: '7', b: '8', c: 'a', d: 'b' }),
  'td-luigi-fire': swapPalette({ a: '7', b: '8', c: 'e', d: 'f' }),
  'td-megaman': [...FOLK_PALETTE],
  'td-samus': [...FOLK_PALETTE],
  // The Varia suit: deeper red armour, orange shoulders.
  'td-samus-varia': swapPalette({ h: 'a', g: 'h' }),
  'td-simon': [...FOLK_PALETTE],
  'td-ryu': [...FOLK_PALETTE],
  'td-bill': [...FOLK_PALETTE],
};
