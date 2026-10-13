import type { MapProp, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';
import { WORLD_1 } from './world1';

/*
 * World 1 in campaign play (0.4.48, the look-and-sound release): the MUSHROOM KINGDOM drawn from
 * above, in the 3/4 view of Kakariko Village. Classic play keeps WORLD_1 (world1.ts) as it was.
 *
 * Travel is as on every page, node to node along roads. Everything the save files and the rules key
 * on is WORLD_1's own: the page id 'smb-1', its six node ids, kinds and fields IN THE SAME ORDER (a
 * save code's position is a pick from that list, docs/SAVE_CODES.md), the five road ids (pending
 * reveals name them), the exit '1-4>smb-2' with Luigi's gate, the start on the left edge and the
 * exit on row 10, the row World 2's start sits on. Only the node coordinates (never saved: a file
 * stores node ids), the road shapes, the scenery and the theme differ.
 *
 * The ground is written in the map's legend (render.ts); theme 'kingdom' draws it from the
 * `kingdom` sheet (sprites/kingdom.ts kingdomGround):
 *
 *   .  the woods' canopy under the header    #  grass     ,  light grass     *  flowers
 *   ~  the river (its banks are inside its tiles, so autoShore's shore chars draw as grass)
 *   =  water under the stone bridge (the bridge is a prop)
 *   T  pine     H  round bush     S  flowering bush     R  boulder     o  little red mushroom
 *   C  hedge (joins its neighbours)
 *
 * Landmarks bigger than a tile are props; the tiles under them are plain grass.
 */
export const SKETCH_1_KINGDOM: readonly string[] = [
  '................',
  '................',
  '###T######~~#o##',
  '###,######~~#*##',
  '###H######==##,o',
  '##*,######~~##H#',
  'H#########~~####',
  '*#########~~####',
  'T#,S######~~##*,',
  '##*,######~~###,',
  '##########~~####',
  'T#########~~#R##',
  '*####,H*,#~~#H##',
  'T,######*#~~#,T*',
  '#*##CCCCC#~~#H#,',
];

/** Mario's house by the start, Peach's Castle over its plaza, the Toad houses, the bridge, the pipe. */
export const PROPS_1_KINGDOM: readonly MapProp[] = [
  { frame: 'mario-house', x: 0, y: 32 }, // cols 0-2, rows 2-4: its door over the start
  { frame: 'peach-castle', x: 64, y: 24 }, // cols 4-8: Peach's Castle
  { frame: 'castle-walk', x: 96, y: 80, flat: true }, // its gate's walk down to the plaza
  { frame: 'plaza', x: 64, y: 100, flat: true }, // cols 4-8, rows 6-10: the round plaza
  { frame: 'fountain-0', x: 88, y: 116 }, // the plaza's heart
  { frame: 'toad-house-red', x: 32, y: 96 },
  { frame: 'toad-house-green', x: 32, y: 160 },
  { frame: 'toad-house-blue', x: 224, y: 96 },
  { frame: 'bridge', x: 152, y: 58 }, // over the river on row 4 (1-3's road east)
  { frame: 'pipe', x: 32, y: 208 }, // 1-2's way underground, by its node
  { frame: 'giant-shroom-red', x: 224, y: 32 }, // 1-3's treetops, over the bridge
  { frame: 'giant-shroom-green', x: 224, y: 176 },
];

/** Each node's tile on this page, by id (WORLD_1's nodes keep their order and every other field). */
const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 5], // Mario's front step
  '1-1': [1, 9], // the meadow by the Toad houses (Luigi's spot, 2,9, is kept clear)
  '1-2': [4, 12], // by the pipe down to the underground
  '1-3': [9, 5], // the castle's east lawn, by the bridge
  '1-4': [13, 10], // Bowser's fort across the river
  'bonus-1': [7, 13], // the warp spot, in the hedge garden
};

/** Each road's tiles on this page, by road id (the same five roads as WORLD_1's). */
const ROADS: Readonly<Record<string, [number, number][]>> = {
  'start>1-1': poly([0, 5], [1, 5], [1, 9]),
  '1-1>1-2': poly([1, 9], [1, 12], [4, 12]),
  '1-2>1-3': poly([4, 12], [4, 11], [9, 11], [9, 5]),
  '1-3>1-4': poly([9, 5], [9, 4], [13, 4], [13, 10]),
  '1-2>bonus-1': poly([4, 12], [4, 13], [7, 13]),
};

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world1-kingdom: no tile for node ${id}`);
  return p;
};

export const WORLD_1_KINGDOM: WorldMapPage = {
  ...WORLD_1,
  theme: 'kingdom',
  tiles: autoShore(SKETCH_1_KINGDOM),
  nodes: WORLD_1.nodes.map((n) => {
    const [x, y] = at(n.id);
    return { ...n, x, y };
  }),
  paths: WORLD_1.paths.map((p) => {
    const points = ROADS[`${p.from}>${p.to}`];
    if (!points) throw new Error(`world1-kingdom: no road ${p.from}>${p.to}`);
    return { ...p, points };
  }),
  // Off the right edge on row 10, to World 2.
  exits: WORLD_1.exits.map((e) => ({ ...e, points: poly(at(e.from), [15, 10]) })),
  // A Goomba in the garden between the roads, a Koopa on the east bank by the fort, Cheep Cheeps in
  // the river, smoke from Mario's chimney, the keep's flag. No clouds: a page seen from above has no
  // sky.
  actors: [
    actor('goomba', 128, 192, { range: 12 }),
    actor('koopa', 226, 136, { range: 10, speed: 0.2 }),
    actor('cheep', 160, 136, { range: 0, height: 14, period: 170 }),
    actor('cheep', 168, 200, { range: 0, height: 12, period: 200, phase: 90 }),
    actor('smoke', 34, 30, { period: 90 }),
    actor('flag', 100, 20, { phase: 0 }),
  ],
  props: [...PROPS_1_KINGDOM],
};
