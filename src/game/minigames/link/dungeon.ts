import { buildDungeon, type Dungeon, type LegendEntry, type RoomDef } from '../../topdown/room';

/** The keeper (keeper.ts) stands where 'M' is: the top-left of its 2×2 tiles. */
export const KEEP_LEGEND: Readonly<Record<string, LegendEntry>> = { M: { tile: 'floor', spawn: 'keeper' } };

/**
 * The Shadow Keep: the spell's prison in Link's mind, eight rooms on a 4×4 map, walked from the
 * bottom up (legend in topdown/room.ts):
 *
 *        col 0      col 1      col 2      col 3
 *   row 0                     [keeper]--[exit]
 *                                |
 *   row 1 [knights]==[shutters]-[switch]
 *            |
 *   row 2 [blocks]---[bats]
 *                      |
 *   row 3            [start]
 *
 * (== is the locked door; the key appears in the knights' room once they are gone.)
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
      'O..............#',
      '#.....S..S.....#',
      '#..............#',
      '#....b....b....#',
      '#..............#',
      '#######OO#######',
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
    hint: 'The far door stays shut until every monster is gone.',
    map: [
      '################',
      '#..............#',
      '#..b.......b...#',
      '#..............#',
      '#....n....n....#',
      'L..............X',
      '#..............#',
      '#....S....S....#',
      '#..b...........#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'switch',
    at: [2, 1],
    shutters: 'switches',
    reveal: 'switches',
    hint: 'Rock-spitters. Your shield stops rocks from the front. A floor switch hides behind the water.',
    map: [
      '#######XX#######',
      '#..............#',
      '#.r..~~~~~~..r.#',
      '#....~....~....#',
      '#....~.._.~....#',
      'O....~....~....#',
      '#....~~..~~....#',
      '#..............#',
      '#.r.........H..#',
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
