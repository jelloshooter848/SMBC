import { buildDungeon, type Dungeon, type LegendEntry, type RoomDef } from '../../topdown/room';

/** The keeper (keeper.ts) stands where 'M' is: the top-left of its 2×2 tiles. */
export const KEEP_LEGEND: Readonly<Record<string, LegendEntry>> = { M: { tile: 'floor', spawn: 'keeper' } };

/**
 * The Shadow Keep: the spell's prison in Link's mind, eleven rooms on a 4×4 map, walked from the
 * bottom up (legend in topdown/room.ts):
 *
 *        col 0      col 1      col 2      col 3
 *   row 0 [shrine]::[armory]   [keeper]--[exit]
 *                      |          |
 *   row 1 [knights]==[shutters]-[switch]
 *            |
 *   row 2 [blocks]---[bats]----[cellar]
 *                      |
 *   row 3            [start]
 *
 * == is the locked door (the key appears in the knights' room once they are gone); :: is the
 * cracked wall a bomb opens. Link starts with only his sword: the boomerang is in the cellar's
 * chest, a heart container appears in the shutters room once it is clear, the bombs are in the
 * armory's chest beside the cracked wall, and the shield waits in the secret shrine behind it.
 */
export const KEEP_ROOMS: readonly RoomDef[] = [
  {
    id: 'start',
    at: [1, 3],
    hint: 'Link... wake up... the spell holds you here. Find the way out.',
    map: [
      '#######OO#######',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '#....:....:....#',
      '#..............#',
      '#....:....:....#',
      '#..............#',
      '#.T....@.....T.#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'bats',
    at: [1, 2],
    hint: 'Bats! Use your sword.',
    map: [
      '################',
      '#..............#',
      '#..b........b..#',
      '#..............#',
      '#.....S..S.....#',
      'O..............O',
      '#.....S..S.....#',
      '#..............#',
      '#....b....b....#',
      '#..............#',
      '#######OO#######',
    ],
  },
  {
    id: 'cellar',
    at: [2, 2],
    chests: ['boomerang'],
    hint: 'A chest! Walk into it to open it.',
    map: [
      '################',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '#..........S.S.#',
      'O....n......c..#',
      '#..........S.S.#',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'blocks',
    at: [0, 2],
    shutters: 'plates',
    hint: 'A shut door, a floor plate and a row of blocks. One block is loose. If it gets stuck, leave the room and come back.',
    map: [
      '#######XX#######',
      '#..............#',
      '#..............#',
      '#...BBBPBBB....#',
      '#..............#',
      '#........o.....O',
      '#..............#',
      '#...S......S...#',
      '#..............#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'knights',
    at: [0, 1],
    reveal: 'clear',
    hint: 'Skeleton knights. They take two hits.',
    map: [
      '################',
      '#..............#',
      '#..n........n..#',
      '#..............#',
      '#....BB..BB....#',
      '#......k.......L',
      '#....BB..BB....#',
      '#..............#',
      '#..n...........#',
      '#..............#',
      '#######OO#######',
    ],
  },
  {
    id: 'shutters',
    at: [1, 1],
    shutters: 'clear',
    reveal: 'clear',
    hint: 'The far doors stay shut until every monster is gone.',
    map: [
      '#######XX#######',
      '#..............#',
      '#..b.......b...#',
      '#..............#',
      '#....n....n....#',
      'L.......H......X',
      '#..............#',
      '#....S....S....#',
      '#..b...........#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'armory',
    at: [1, 0],
    chests: ['bomb'],
    hint: 'Another chest. The statues point at the west wall. It looks cracked.',
    map: [
      '################',
      '#..............#',
      '#..............#',
      '#....S.........#',
      '#...S..........#',
      'C..S.......c...#',
      '#...S..........#',
      '#....S.........#',
      '#..n.......n...#',
      '#..............#',
      '#######OO#######',
    ],
  },
  {
    id: 'shrine',
    at: [0, 0],
    chests: ['shield'],
    hint: 'A secret room! Something waits in the chest.',
    map: [
      '################',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '#..............#',
      '#.......c......C',
      '#..............#',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'switch',
    at: [2, 1],
    shutters: 'switches',
    reveal: 'switches',
    hint: "Rock-spitters: step out of a rock's path, or face it with a shield. A floor switch hides behind the water.",
    map: [
      '#######XX#######',
      '#..............#',
      '#.r..~~~~~~..r.#',
      '#....~....~....#',
      '#....~.._.~....#',
      'O....~....~....#',
      '#....~~..~~....#',
      '#..............#',
      '#.r.........f..#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'keeper',
    at: [2, 0],
    shutters: 'clear',
    dark: true,
    music: 'keeper',
    hint: 'The keeper of the spell!',
    map: [
      '################',
      '#T............T#',
      '#......M.......#',
      '#..............#',
      '#..............#',
      '#..............X',
      '#..............#',
      '#..............#',
      '#..............#',
      '#T............T#',
      '#######XX#######',
    ],
  },
  {
    id: 'exit',
    at: [3, 0],
    hint: 'The way out shines ahead.',
    map: [
      '#######EE#######',
      '#..............#',
      '#..............#',
      '#...S......S...#',
      '#..............#',
      'O..............#',
      '#..............#',
      '#...S......S...#',
      '#..............#',
      '#..............#',
      '################',
    ],
  },
];

export function keepDungeon(): Dungeon {
  return buildDungeon(KEEP_ROOMS, KEEP_LEGEND);
}
