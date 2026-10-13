import type { MapProp, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';
import { WORLD_3 } from './world3';

/*
 * World 3 in campaign play (0.4.50, TD52's approved design, toned down): MEGA CITY drawn from above
 * in the 3/4 view of World 1's Mushroom Kingdom (world1-kingdom.ts), split into robot-master districts in the
 * colours of Mega Man 1's six stages (sprites/megacity-above.ts). Classic play keeps WORLD_3.
 *
 * Everything the save files and rules key on is WORLD_3's own: the page id 'smb-3', its six node
 * ids, kinds and fields in the same order, the five road ids, the exit '3-4>smb-4' with Mega
 * Man's gate, the start on the left edge (row 4, where World 2's exit arrives), the exit on row 6
 * (where World 4's start sits), the local (Roll) in column 2 beside the start.
 *
 * One calm grey pavement across the city; each district is told by its buildings, props and a
 * few accent tiles (','), not a flooded floor. Districts (ZONES_3_MEGACITY) and their nodes:
 *   L  Dr. Light's lab (top left)    start, before the lab's door; Roll beside it
 *   C  Cut Man's ruins (top)         3-1 (its classic stage); green brick ruins, red ladders
 *   F  Fire Man's works (top right)  bonus-3, a hatch by the magma pool and the furnace
 *   W  Wily's crag (right)           3-4, Wily's gate under his skull fortress
 *   B  Bomb Man's park (middle left) 3-2 (Wood Man's forest stage: the park's round trees)
 *   E  Elec Man's works (middle)     3-3 (Air Man's sky stage: at the foot of the tall tower)
 *   G  Guts Man's quarry             a small accent in the bottom-left corner; no node
 *   N  plain city: the harbour's quay and the cyan sea along the bottom
 *
 * Legend (above: 'megacity'): '#' pavement (shore chars too), ',' the district's accent tile,
 * '0' the district's block, 'T' a tree, 'H' a hedge, 'R' a boulder, 'P' a fire pillar,
 * 'X' a generator, '~' the sea, 'L' magma.
 */
export const SKETCH_3_MEGACITY: readonly string[] = [
  '................',
  '................',
  '###0,#,0##LL####', // the lab (prop) left; Cut Man's ruins; Fire Man's magma; Wily's fortress (prop)
  '###,######LL####', // bonus-3's road along the works
  '################', // the start before the lab's door; Fire Man's furnace (prop)
  'H,#0###0##P,####', // Roll at 2,5; 3-1, its hint tile east at 6,5
  'T,#,##,#,,######', // Elec Man's tower (prop) rises from here; 3-4 at Wily's gate, the exit east
  '##T#########X#,0', // Bomb Man's park begins
  ',T,,############', // the park's lawn
  ',,,T##,#,T##X###', // 3-2 in the park; a generator in the walkway's bend
  ',T,,####T#######', // 3-3 at the tower's foot
  '################', // Guts Man's quarry (prop) in the corner below
  '###R###########~', // the harbour's quay
  '###############~',
  '#####~~~~~~~~~~~',
];

/** Each tile's district (rows 0-1 are the band under the header; N is plain city). */
export const ZONES_3_MEGACITY: readonly string[] = [
  'LLLLLLLLLLLLLLLL',
  'LLLLLLLLLLLLLLLL',
  'LLLCCCCCFFFFWWWW',
  'LLLCCCCCFFFFWWWW',
  'LLLCCCCCFFFFWWWW',
  'LLLCCCCCFFFFWWWW',
  'LLLCCCCCFFFFWWWW',
  'BBBBBBBBBBEEEWWW',
  'BBBBBBBBBBEEENNN',
  'BBBBBBBBBBEEENNN',
  'BBBBBBBBBBEEENNN',
  'GGGGNNNNNNNNNNNN',
  'GGGGNNNNNNNNNNNN',
  'GGGGNNNNNNNNNNNN',
  'GGGGNNNNNNNNNNNN',
];

/** The lab, Wily's fortress, the furnace, Elec Man's tower and Guts Man's quarry. */
export const PROPS_3_MEGACITY: readonly MapProp[] = [
  { frame: 'light-lab', x: 0, y: 32 }, // cols 0-2 rows 2-3, its door over the start
  { frame: 'wily-fortress', x: 192, y: 32 }, // cols 12-15 rows 2-5, over 3-4's gate
  { frame: 'furnace', x: 128, y: 64 }, // cols 8-9 rows 4-5, under bonus-3
  { frame: 'elec-tower', x: 160, y: 96 }, // cols 10-11 rows 6-9, over 3-3
  { frame: 'quarry', x: 0, y: 176 }, // cols 0-2 rows 11-13: Guts Man's corner
];

/** Each node's tile on this page, by id (WORLD_3's nodes keep their order and every other field). */
const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 4], // before Dr. Light's door
  '3-1': [5, 5], // Cut Man's ruins (Mega Man's hint east, at 6,5)
  '3-2': [7, 9], // Bomb Man's park
  // At the foot of Elec Man's tower, under its west half: 3-4 lies within LEFT's aim (aimedRoad).
  '3-3': [10, 10],
  '3-4': [13, 6], // Wily's skull gate
  'bonus-3': [9, 3], // Fire Man's works, by the magma
};

/** Each road's tiles on this page, by road id (the same five roads as WORLD_3's). */
const ROADS: Readonly<Record<string, [number, number][]>> = {
  'start>3-1': poly([0, 4], [4, 4], [4, 5], [5, 5]),
  '3-1>3-2': poly([5, 5], [5, 7], [7, 7], [7, 9]),
  '3-2>3-3': poly([7, 9], [7, 11], [10, 11], [10, 10]),
  '3-3>3-4': poly([10, 10], [13, 10], [13, 6]),
  '3-1>bonus-3': poly([5, 5], [5, 3], [9, 3]),
};

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world3-megacity: no tile for node ${id}`);
  return p;
};

export const WORLD_3_MEGACITY: WorldMapPage = {
  ...WORLD_3,
  // Drawn from above from the `megacity-above` sheet; the theme stays 'megaman'.
  above: 'megacity',
  tiles: autoShore(SKETCH_3_MEGACITY),
  // Each tile's district, read by megacityGround.
  zones: ZONES_3_MEGACITY,
  nodes: WORLD_3.nodes.map((n) => {
    const [x, y] = at(n.id);
    return { ...n, x, y };
  }),
  paths: WORLD_3.paths.map((p) => {
    const points = ROADS[`${p.from}>${p.to}`];
    if (!points) throw new Error(`world3-megacity: no road ${p.from}>${p.to}`);
    return { ...p, points };
  }),
  // East along Wily's crag on row 6, to World 4.
  exits: WORLD_3.exits.map((e) => ({ ...e, points: poly(at(e.from), [15, 6]) })),
  // Mets in the quarry and on the quay, propeller bots over the park, the sea and the fortress.
  actors: [
    actor('met', 0, 208, { range: 32 }),
    actor('met', 96, 208, { range: 40, phase: 120 }),
    actor('met', 224, 176, { range: 16, phase: 60 }),
    actor('copter', 40, 168, { phase: 0 }),
    actor('copter', 200, 216, { phase: 90 }),
    actor('copter', 216, 32, { phase: 45 }),
  ],
  props: [...PROPS_3_MEGACITY],
};
