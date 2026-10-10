/*
 * Kakariko Village (0.4.41, docs/WORLD_MAP.md "Kakariko Village"): World 2's hidden map spot,
 * walked from above as in A Link to the Past. Laid out after ALttP's Kakariko for layout only:
 * every tile is drawn new (src/content/sprites/town.ts).
 *
 * Six outdoor screens (3 wide, 2 high) of 16×11 cells, and the rooms inside the buildings. Each
 * map character says what a cell is; the art (town.ts `townArt`) picks its picture from the cell
 * and its neighbours, so hedges, roofs, paths and the pond join up.
 *
 * Outdoors:                                         Indoors:
 *   . grass        , dirt path     : paving           # wall          . floor (boards)
 *   * flowers      = steps         D a door           = bar counter   t table
 *   T tree         P blossom tree  h hedge            F fireplace     j shelf of jars
 *   f fence        ^ ledge face    ~ pond             z bed           k barrel
 *   R red roof     B blue roof     Y thatch roof      y potted plant  b stool (walkable)
 *   W front wall   w window        o the well         D the way out   : rug
 *                                                     d a display table (2×2, the shop's)
 *   V weathervane  b bench         s sign
 *   l fallen log   p herb pot      v cabbages
 *   g gate post    k barrel        @ the gate (start)
 *
 * Doors (`DOORS`) pair a building's front door with the way out of its room. The secret house's
 * door leads to no room: it loads the side-view Top Secret Area ('@tsa'). The shop opened in
 * 0.4.42 (src/game/town/shop.ts).
 */

/** Screen ids, west to east, north then south. */
export const SCREENS = ['well', 'square', 'orchard', 'gardens', 'gate', 'healer'] as const;
export type ScreenId = (typeof SCREENS)[number];

/** Each outdoor screen's cell on the village map (column, row). */
export const SCREEN_AT: Readonly<Record<ScreenId, readonly [number, number]>> = {
  well: [0, 0],
  square: [1, 0],
  orchard: [2, 0],
  gardens: [0, 1],
  gate: [1, 1],
  healer: [2, 1],
};

/** What the HUD calls each screen. */
export const SCREEN_NAMES: Readonly<Record<ScreenId, string>> = {
  well: 'THE WELL',
  square: 'THE SQUARE',
  orchard: 'THE ORCHARD',
  gardens: 'THE GARDENS',
  gate: 'GATE STREET',
  healer: "HEALER'S LANE",
};

// prettier-ignore
export const OUTDOOR: Readonly<Record<ScreenId, readonly string[]>> = {
  well: [
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TT......*....,TT',
    'TT.RRRRR..o..,TT',
    'TT.RRRRR.....,TT',
    'TT.WwDwW..*..,TT',
    'll,,,,,,,,,,,,,,',
    'TT.....*.....,..',
    'TT..*....*...,..',
    'TT...........,..',
    'TT....*......,..',
  ],
  square: [
    'TTTTTTTTTTTTTTTT',
    'TT.RRRRRRRRRR.TT',
    'TT.RRRRRRRRRR.TT',
    'TT.WwwDwwDwwW.TT',
    'TT.k.,,..,,.k.TT',
    'TT^^^^^==^^^^^TT',
    ',,,,,,,::,,,,,,,',
    '..hhhh.::.hhhh..',
    '..h**..VV..**h..',
    '..h.b..VV..b.h..',
    '..hhhh.::.hhhh..',
  ],
  orchard: [
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TT..PP..PP..^^^^',
    'TT..PP..PP...~~~',
    'TT...........~~~',
    'TT...*....*..~~~',
    ',,..PP..PP....~~',
    '.,..PP..PP....~~',
    '.,*.........*.~~',
    '.,............~~',
    '.,............~~',
  ],
  gardens: [
    'TT...........,..',
    'TT.vvvvvvvv..,..',
    'TT...........,..',
    'TT.vvvvvvvv..,..',
    'TT...........,..',
    'TThh.hhhhhhh.,..',
    'TTh...RRRRRh.,..',
    'TTh*..RRRRRh.,..',
    'TTh...WwDwWh.,..',
    'TTh........h.,,,',
    'TThhhhhhhhhhTTTT',
  ],
  gate: [
    '..ffff.::.ffff..',
    '.......::.......',
    '.BBBBB.::...*...',
    '.BBBBB.::.......',
    '.WwDwWs::.......',
    '.......::.......',
    '..*...::::...*..',
    '......::::......',
    '......::::......',
    ',,,,..::::......',
    'TTTTTg::::gTTTTT',
  ],
  healer: [
    '.,............~~',
    '.,YYYYY......~~~',
    '.,YYYYY.p.p..~~~',
    '.,WwDwW......~~~',
    '.,,,,,,,,,,,..~~',
    '.........BBBBB~~',
    '..p......BBBBB.~',
    '.........WwDwW.~',
    '..............~~',
    '..*.....*.....~~',
    'TTTTTTTTTTTTTT~~',
  ],
};

/** The rooms inside the buildings (walls one tile thick; the way out is a door in the south wall). */
export const INDOOR_IDS = ['inn', 'back-room', 'house-a', 'house-b', 'healer-house', 'shop'] as const;
export type IndoorId = (typeof INDOOR_IDS)[number];

// prettier-ignore
export const INDOOR: Readonly<Record<IndoorId, readonly string[]>> = {
  inn: [
    '################',
    '#jj.....j..FF.j#',
    '#=======k......#',
    '#..............#',
    '#.b........b...#',
    '#.btb.....btb..#',
    '#..b.......b...#',
    '#..............#',
    '#k.....::.....k#',
    '#......::......#',
    '#######D########',
  ],
  'back-room': [
    '################',
    '#k...........jj#',
    '#..............#',
    '#..............#',
    '#......::......#',
    '#......::......#',
    '#..............#',
    '#..............#',
    '#k............k#',
    '#..............#',
    '#######D########',
  ],
  'house-a': [
    '################',
    '#jj.....FF...zk#',
    '#............z.#',
    '#..............#',
    '#....btb.......#',
    '#.....b........#',
    '#..............#',
    '#y............y#',
    '#......::......#',
    '#......::......#',
    '#######D########',
  ],
  'house-b': [
    '################',
    '#z..k...FF...jj#',
    '#z.............#',
    '#.y............#',
    '#.......btb....#',
    '#........b.....#',
    '#.............z#',
    '#.............z#',
    '#......::......#',
    '#......::......#',
    '#######D########',
  ],
  'healer-house': [
    '################',
    '#jjjj.....jjjjz#',
    '#.............z#',
    '#..............#',
    '#..y........y..#',
    '#....::::::....#',
    '#....::::::....#',
    '#..............#',
    '#k............k#',
    '#..............#',
    '#######D########',
  ],
  // The shop (0.4.42): the shopkeeper behind a counter across the back, and four display tables
  // in front, A Link to the Past's way (the current hero's stock on them: src/game/town/shop.ts).
  shop: [
    '################',
    '#jj.k......k.jj#',
    '#==============#',
    '#..............#',
    '#.dd.dd..dd.dd.#',
    '#.dd.dd..dd.dd.#',
    '#..............#',
    '#..............#',
    '#y............y#',
    '#......::......#',
    '#######D########',
  ],
};

/** The shop's display tables, left to right (each 2×2; its top-left cell). */
export const SHOP_TABLES: readonly (readonly [number, number])[] = [
  [2, 4],
  [5, 4],
  [9, 4],
  [12, 4],
];

/** Each room's cell on the dungeon grid: far from the village and from each other (no neighbours). */
export const INDOOR_AT: Readonly<Record<IndoorId, readonly [number, number]>> = {
  inn: [10, 10],
  'back-room': [12, 10],
  'house-a': [14, 10],
  'house-b': [16, 10],
  'healer-house': [18, 10],
  shop: [20, 10],
};

/** Room music: the village theme outdoors, its quiet arrangement indoors. */
export const OUTDOOR_MUSIC = 'village';
export const INDOOR_MUSIC = 'village-indoors';

export interface TownDoor {
  id: string;
  room: string;
  col: number;
  row: number;
  enter: 'up' | 'down';
  /** The paired door's id, or '@tsa' (the Top Secret Area). */
  to: string;
  /** Shut: a building not open (none since the shop opened in 0.4.42; the kit keeps the hook). */
  shut?: boolean;
  /**
   * The door lock (design section 4): a secret on the save file's `secrets` list that must be
   * found first. None is locked today; the hook is here for a later secret.
   */
  needs?: string;
  /** What the building is (said when going in, and on the HUD inside). */
  name: string;
}

/** The village's doors: each building's front door and its room's way out. */
export const DOORS: readonly TownDoor[] = [
  { id: 'house-a', room: 'well', col: 5, row: 5, enter: 'up', to: 'house-a-out', name: "OLD MAN'S HOUSE" },
  { id: 'house-a-out', room: 'house-a', col: 7, row: 10, enter: 'down', to: 'house-a', name: 'THE WELL' },
  { id: 'inn', room: 'square', col: 6, row: 3, enter: 'up', to: 'inn-out', name: 'THE INN' },
  { id: 'inn-out', room: 'inn', col: 7, row: 10, enter: 'down', to: 'inn', name: 'THE SQUARE' },
  { id: 'back-room', room: 'square', col: 9, row: 3, enter: 'up', to: 'back-room-out', name: 'BACK ROOM' },
  {
    id: 'back-room-out',
    room: 'back-room',
    col: 7,
    row: 10,
    enter: 'down',
    to: 'back-room',
    name: 'THE SQUARE',
  },
  { id: 'secret-house', room: 'gardens', col: 8, row: 8, enter: 'up', to: '@tsa', name: 'TOP SECRET AREA' },
  { id: 'shop', room: 'gate', col: 3, row: 4, enter: 'up', to: 'shop-out', name: 'THE SHOP' },
  { id: 'shop-out', room: 'shop', col: 7, row: 10, enter: 'down', to: 'shop', name: 'GATE STREET' },
  {
    id: 'healer-house',
    room: 'healer',
    col: 4,
    row: 3,
    enter: 'up',
    to: 'healer-house-out',
    name: "HEALER'S HOUSE",
  },
  {
    id: 'healer-house-out',
    room: 'healer-house',
    col: 7,
    row: 10,
    enter: 'down',
    to: 'healer-house',
    name: "HEALER'S LANE",
  },
  {
    id: 'house-b',
    room: 'healer',
    col: 11,
    row: 7,
    enter: 'up',
    to: 'house-b-out',
    name: "THE FAMILY'S HOUSE",
  },
  {
    id: 'house-b-out',
    room: 'house-b',
    col: 7,
    row: 10,
    enter: 'down',
    to: 'house-b',
    name: "HEALER'S LANE",
  },
];

/** The south gate: where the hero walks in from the map, and out again (the gate screen's south edge). */
export const GATE = { room: 'gate' as ScreenId, col: 7, row: 10 };

/** Who stands where (see src/game/town/folk.ts for what each says and does). */
export interface FolkSpot {
  who: string;
  room: string;
  col: number;
  row: number;
}

export const FOLK: readonly FolkSpot[] = [
  { who: 'guard', room: 'gate', col: 11, row: 8 },
  { who: 'kid', room: 'gate', col: 12, row: 4 },
  { who: 'hen', room: 'gate', col: 13, row: 3 },
  { who: 'woman', room: 'square', col: 5, row: 9 },
  { who: 'gardener', room: 'gardens', col: 2, row: 2 },
  { who: 'old-man', room: 'house-a', col: 9, row: 3 },
  { who: 'barkeep', room: 'inn', col: 5, row: 1 },
  { who: 'patron', room: 'inn', col: 2, row: 5 },
  { who: 'patron-2', room: 'inn', col: 12, row: 5 },
  { who: 'error', room: 'back-room', col: 7, row: 3 },
  { who: 'healer', room: 'healer-house', col: 7, row: 2 },
  { who: 'mother', room: 'house-b', col: 6, row: 3 },
  { who: 'child', room: 'house-b', col: 11, row: 6 },
  // The shop (0.4.42): the shopkeeper, and the display tables (things to buy, not to talk to).
  { who: 'shopkeeper', room: 'shop', col: 7, row: 1 },
  ...SHOP_TABLES.map(([col, row], i) => ({ who: `table-${i}`, room: 'shop', col, row })),
  // Hobb the tanner, who gives the Wallet on the first visit (0.4.42).
  { who: 'tanner', room: 'gate', col: 2, row: 7 },
  // Things to read or look at (no picture of their own: the tiles draw them).
  { who: 'weathervane', room: 'square', col: 7, row: 9 },
  { who: 'well', room: 'well', col: 10, row: 3 },
  { who: 'log', room: 'well', col: 1, row: 6 },
  { who: 'shop-sign', room: 'gate', col: 6, row: 4 },
];
