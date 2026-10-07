import { buildDungeon, type Dungeon, type LegendEntry, type RoomDef } from '../../topdown/room';

/**
 * The keep's own spawns: the keeper (keeper.ts) stands where 'M' is (the top-left of its 2×2
 * tiles); the Triforce shard lies where 'A' is.
 */
export const KEEP_LEGEND: Readonly<Record<string, LegendEntry>> = {
  M: { tile: 'floor', spawn: 'keeper' },
  A: { tile: 'floor', spawn: 'triforce' },
};

/** Tiles of wall round every room: Zelda's two, for a 12×7 floor. */
export const KEEP_WALL = 2;

/**
 * The Shadow Keep: the spell's prison in Link's mind, thirteen rooms laid out as a Zelda dungeon
 * on a 4×6 map, walked from the entrance at the bottom up to the Triforce at the top (legend in
 * topdown/room.ts). Every room is Zelda's: walls two tiles thick round a 12×7 floor, a doorway
 * centred in each wall it opens.
 *
 *          col 0      col 1       col 2       col 3
 *   row 0                       [triforce]
 *                                   X
 *   row 1 [shrine]::[armory]    [keeper]
 *                      |            X
 *   row 2           [knights]=L=[switch]
 *                      X
 *   row 3           [blocks]--X[shutters]X--[compass]
 *                                   |
 *   row 4           [cellar]----[map]
 *                                   L
 *   row 5           [bats]------[start]
 *
 * -- open, X shutters, L locked, :: the cracked wall a bomb opens. Link wakes in the entrance
 * with only his sword. The bats guard the first key; the map lies in the hall past the locked
 * door, the boomerang in the cellar's chest beside it, the compass in the east wing past the
 * kill-all room. The push block opens the way to the knights and the second key; the armory's
 * chest holds the bombs beside the cracked wall, and the shield waits in the secret shrine behind
 * it. Past the second locked door the rock-spitters' switch opens the keeper's lair; the keeper
 * leaves a heart container, and beyond it lies the Triforce.
 */
export const KEEP_ROOMS: readonly RoomDef[] = [
  {
    id: 'start',
    at: [2, 5],
    hint: 'Link... wake up... the spell holds you here. Find the way out. The door ahead is locked.',
    map: [
      '#######LL#######',
      '#######LL#######',
      '##............##',
      '##.S........S.##',
      '##............##',
      'OO............##',
      '##............##',
      '##.S...@....S.##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'bats',
    at: [1, 5],
    reveal: 'clear',
    hint: 'Bats! Use your sword. Something is hidden here.',
    map: [
      '################',
      '################',
      '##............##',
      '##..b......b..##',
      '##....S..S....##',
      '##......k.....OO',
      '##....S..S....##',
      '##..b......b..##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'map',
    at: [2, 4],
    reveal: 'clear',
    hint: 'A great hall. Its monsters guard a map of the keep.',
    map: [
      '#######OO#######',
      '#######OO#######',
      '##............##',
      '##.T..b....T..##',
      '##............##',
      'OO.....m......##',
      '##............##',
      '##.T....n..T..##',
      '##............##',
      '#######LL#######',
      '#######LL#######',
    ],
  },
  {
    id: 'cellar',
    at: [1, 4],
    chests: ['boomerang'],
    hint: 'A chest! Walk into it to open it.',
    map: [
      '################',
      '################',
      '##............##',
      '##.T......S.S.##',
      '##............##',
      '##.c......n...OO',
      '##............##',
      '##.T......S.S.##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'shutters',
    at: [2, 3],
    shutters: 'clear',
    hint: 'The side doors stay shut until every monster is gone.',
    map: [
      '################',
      '################',
      '##............##',
      '##..b......b..##',
      '##....n..n....##',
      'XX............XX',
      '##....S..S....##',
      '##..b.........##',
      '##............##',
      '#######OO#######',
      '#######OO#######',
    ],
  },
  {
    id: 'compass',
    at: [3, 3],
    reveal: 'clear',
    hint: 'Bats in the east wing, and a compass for the one who clears it.',
    map: [
      '################',
      '################',
      '##............##',
      '##.S..b...b.S.##',
      '##............##',
      'OO.......v....##',
      '##............##',
      '##.S...b....S.##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'blocks',
    at: [1, 3],
    shutters: 'plates',
    hint: 'A shut door, a floor plate and a row of blocks. One block is loose. If it gets stuck, leave the room and come back.',
    map: [
      '#######XX#######',
      '#######XX#######',
      '##............##',
      '##..BBBPBBB...##',
      '##............##',
      '##.......o....OO',
      '##............##',
      '##..S......S..##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'knights',
    at: [1, 2],
    reveal: 'clear',
    hint: 'Skeleton knights. They take two hits.',
    map: [
      '#######OO#######',
      '#######OO#######',
      '##............##',
      '##.n.......n..##',
      '##...BB..BB...##',
      '##.....k......LL',
      '##...BB..BB...##',
      '##.n..........##',
      '##............##',
      '#######OO#######',
      '#######OO#######',
    ],
  },
  {
    id: 'armory',
    at: [1, 1],
    chests: ['bomb'],
    hint: 'Another chest. The statues point at the west wall. It looks cracked.',
    map: [
      '################',
      '################',
      '##............##',
      '##...S........##',
      '##..S.........##',
      'CC.S......c...##',
      '##..S.........##',
      '##...S....n...##',
      '##.n..........##',
      '#######OO#######',
      '#######OO#######',
    ],
  },
  {
    id: 'shrine',
    at: [0, 1],
    chests: ['shield'],
    hint: 'A secret room! Something waits in the chest.',
    map: [
      '################',
      '################',
      '##............##',
      '##.T........T.##',
      '##............##',
      '##......c.....CC',
      '##............##',
      '##.T........T.##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'switch',
    at: [2, 2],
    shutters: 'switches',
    reveal: 'switches',
    hint: "Rock-spitters: step out of a rock's path, or face it with a shield. A floor switch hides behind the water.",
    map: [
      '#######XX#######',
      '#######XX#######',
      '##............##',
      '##r..~~~~~~..r##',
      '##...~....~...##',
      'LL...~.._.~...##',
      '##...~~..~~...##',
      '##r.........f.##',
      '##............##',
      '################',
      '################',
    ],
  },
  {
    id: 'keeper',
    at: [2, 1],
    shutters: 'clear',
    reveal: 'clear',
    dark: true,
    music: 'keeper',
    hint: 'The keeper of the spell!',
    map: [
      '#######XX#######',
      '#######XX#######',
      '##T..........T##',
      '##.....M......##',
      '##............##',
      '##............##',
      '##.......H....##',
      '##............##',
      '##T..........T##',
      '#######XX#######',
      '#######XX#######',
    ],
  },
  {
    id: 'triforce',
    at: [2, 0],
    goal: true,
    hint: 'A golden light. The Triforce!',
    map: [
      '################',
      '################',
      '##............##',
      '##.T........T.##',
      '##....S..S....##',
      '##......A.....##',
      '##....S..S....##',
      '##.T........T.##',
      '##............##',
      '#######OO#######',
      '#######OO#######',
    ],
  },
];

export function keepDungeon(): Dungeon {
  return buildDungeon(KEEP_ROOMS, KEEP_LEGEND, { wall: KEEP_WALL });
}
