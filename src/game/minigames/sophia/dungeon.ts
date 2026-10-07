import { buildDungeon, type Dungeon, type LegendEntry, type RoomDef } from '../../topdown/room';
import type { Spawner, TdWorldOptions } from '../../topdown/world';
import { Capsule, Jason, POW_MAX, UNDERWORLD_ITEMS, UnderworldWorld } from './jason';
import { Blob, Eye, Turret } from './mutants';
import { Guardian } from './guardian';

/** Spawn characters of the dungeon's own (on top of topdown/room.ts's legend). */
export const UNDERWORLD_LEGEND: Readonly<Record<string, LegendEntry>> = {
  m: { tile: 'floor', spawn: 'blob' },
  y: { tile: 'floor', spawn: 'eye' },
  u: { tile: 'floor', spawn: 'turret' },
  g: { tile: 'floor', spawn: 'gun-capsule' },
  p: { tile: 'floor', spawn: 'pow-capsule' },
  Z: { tile: 'floor', spawn: 'guardian' },
};

/**
 * The Underworld's dungeon, behind the gateway at the end of the tank's cavern: eight rooms on a
 * 4×3 map, walked from the bottom up as in a Blaster Master overhead area (legend: topdown/room.ts
 * and UNDERWORLD_LEGEND):
 *
 *            col 0      col 1        col 2         col 3
 *   row 0             [ante]  ===  [guardian] === [way out]
 *                        |
 *   row 1  [cache] :: [crossing] -- [turrets]
 *                        |              |
 *   row 2              [gate]  ----  [hall]
 *
 * Jason comes in at the gateway; the hall's blobs and eyes, the turret room round its pool, the
 * crossing (statues point at its cracked west wall: a grenade opens the cache, two G capsules
 * and a P), the antechamber (a P capsule before the guardian's door), and the guardian's chamber
 * (=== , shutters that close behind him and open when it falls). Beyond it a short corridor
 * leads up to the way out, back to the tank (an exit). Every other door is open, as in the
 * original (no keys).
 */
export const UNDERWORLD_ROOMS: readonly RoomDef[] = [
  {
    id: 'gate',
    at: [1, 2],
    hint: 'Through the gateway, into the dungeon. Shoot the mutants; G capsules raise your gun.',
    map: [
      '################',
      '#..............#',
      '#..::......::..#',
      '#..............#',
      '#...m......m...#',
      '#..............O',
      '#.....~~~~.....#',
      '#.....~~~~.....#',
      '#......@.....g.#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'hall',
    at: [2, 2],
    hint: 'Blobs and floating eyes. An eye glares before it spits.',
    map: [
      '#######OO#######',
      '#..............#',
      '#..y........y..#',
      '#....B....B....#',
      '#..............#',
      'O......m.......#',
      '#....B....B....#',
      '#..............#',
      '#...m......m...#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'turrets',
    at: [2, 1],
    hint: 'Turrets round a pool. A turret fires when its barrel points at you.',
    map: [
      '################',
      '#..............#',
      '#.u..........u.#',
      '#..............#',
      '#....~~~~~~....#',
      'O....~~~~~~....#',
      '#....~~~~~~....#',
      '#..............#',
      '#.u..........u.#',
      '#..............#',
      '#######OO#######',
    ],
  },
  {
    id: 'crossing',
    at: [1, 1],
    hint: 'The statues point at a cracked wall. A grenade can break it.',
    map: [
      '#######OO#######',
      '#..............#',
      '#.S..........S.#',
      '#......y.......#',
      '#..............#',
      'C....m....m....O',
      '#..............#',
      '#......y.......#',
      '#.S..........S.#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'cache',
    at: [0, 1],
    hint: 'A hidden cache of capsules.',
    map: [
      '################',
      '#..............#',
      '#..............#',
      '#...:......:...#',
      '#..............#',
      '#...g..p...g...C',
      '#..............#',
      '#...:......:...#',
      '#..............#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'ante',
    at: [1, 0],
    hint: "The guardian's door is to the east.",
    map: [
      '################',
      '#..............#',
      '#.S..........S.#',
      '#..............#',
      '#..............#',
      '#.......p......O',
      '#..............#',
      '#..............#',
      '#.S..........S.#',
      '#..............#',
      '#######OO#######',
    ],
  },
  {
    id: 'guardian',
    at: [2, 0],
    hint: 'The guardian!',
    music: 'boss',
    shutters: 'clear',
    dark: true,
    map: [
      '################',
      '#..............#',
      '#.....Z........#',
      '#..............#',
      '#..............#',
      'X..............X',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '################',
    ],
  },
  {
    id: 'exit',
    at: [3, 0],
    hint: 'The way back to Sophia.',
    map: [
      '#######EE#######',
      '######....######',
      '######....######',
      '######....######',
      '#..............#',
      'O..............#',
      '#..............#',
      '################',
      '################',
      '################',
      '################',
    ],
  },
];

export function underworldDungeon(): Dungeon {
  return buildDungeon(UNDERWORLD_ROOMS, UNDERWORLD_LEGEND);
}

/** A capsule placed in a room's text: there until taken (the room remembers). */
const placed =
  (kind: 'gun' | 'pow'): Spawner =>
  (w, s) =>
    w.state().taken.has(`${s.col},${s.row}`) ? null : new Capsule(s.x, s.y, kind);

/**
 * The dungeon's spawners. Mutants of a kind start their rhythm at staggered points (by where
 * they stand), so a room's eyes do not all glare at once; turrets start pointing at the room's
 * middle side.
 */
export const UNDERWORLD_SPAWNERS: Readonly<Record<string, Spawner>> = {
  blob: (_w, s) => new Blob(s.x, s.y, (s.col * 13 + s.row * 7) % 60),
  eye: (_w, s) => new Eye(s.x, s.y, (s.col * 31 + s.row * 17) % 90),
  turret: (_w, s) => new Turret(s.x, s.y, s.col < 8 ? 1 : 3),
  'gun-capsule': placed('gun'),
  'pow-capsule': placed('pow'),
  guardian: (_w, s) => new Guardian(s.x, s.y),
};

export interface UnderworldWorldOptions {
  seed?: number;
  noDamage?: () => boolean;
}

/** The dungeon's world with Jason at the gateway, grenades in hand. */
export function newUnderworld(opts: UnderworldWorldOptions = {}): UnderworldWorld {
  const o: TdWorldOptions = {
    seed: opts.seed ?? 0xb1a5,
    spawners: UNDERWORLD_SPAWNERS,
    items: UNDERWORLD_ITEMS,
    maxHp: POW_MAX,
    shield: false,
    hero: (x, y, maxHp) => new Jason(x, y, maxHp),
    ...(opts.noDamage ? { noDamage: opts.noDamage } : {}),
  };
  const w = new UnderworldWorld(underworldDungeon(), o);
  w.inv.give('grenade');
  return w;
}
