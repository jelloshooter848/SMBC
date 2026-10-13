import type { MapProp, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';
import { WORLD_2 } from './world2';

/*
 * World 2 in campaign play (0.4.50, TD52's approved design): HYRULE drawn from above in the 3/4 view
 * of World 1's Mushroom Kingdom (world1-kingdom.ts), laid out like A Link to the Past's light world.
 * Classic play keeps WORLD_2 (world2.ts) as it is.
 *
 * Everything the save files and rules key on is WORLD_2's own: the page id 'smb-2', its six node
 * ids, kinds and fields in the same order (the bonus node keeps its Top Secret Area level and
 * Kakariko town), the five road ids, the exit '2-4>smb-3' with Link's gate, the start on the left
 * edge (row 10, where World 1's exit arrives) and the exit on row 4 (where World 3's start sits).
 * Only the node tiles, the road shapes, the scenery and the look (drawn from above) differ.
 *
 * Where ALttP's places sit (the owner's overworld map):
 *   Lost Woods        top left, dense treetops              (no node; the fairy flutters over it)
 *   Death Mountain    the brown plateau and cliffs on top   2-4, the palace, up the stairs
 *   Kakariko Village  the houses and well on the left       bonus-2 (Top Secret Area / Kakariko)
 *   the west road     below Kakariko                        start (the healer beside it)
 *   Hyrule Castle     the middle, in its moat               (landmark; the roads skirt the moat)
 *   Link's house      south of the castle, red roof         on 2-1's road down to the lake
 *   Desert            bottom left, its palace, a ledge      (landmark)
 *   Lake Hylia        bottom right                          2-2, the lake level, on its shore
 *   Eastern Palace    east, on its ledge                    2-3, at its west steps
 *   2-1 sits between Kakariko and the castle moat, the field where the Moblin's cave is.
 *
 * Legend (above: 'hyrule', sprites/hyrule-above.ts hyruleGround):
 *   .  under the header: the woods' canopy (x < 4) and Death Mountain's far peaks
 *   #  grass    ,  meadow    *  flowers    o  the mountain's earth    :  desert sand
 *   5  the Lost Woods    ^  a cliff face    h  a ledge    G  stone stairs through a cliff or ledge
 *   ~  water    =  water under the plank bridge (a prop)    I  the moat under the castle's bridge
 *   T  tree    H  bush    S  flowering bush    R  boulder    C  wooden stakes
 * The shore chars autoShore writes draw as grass.
 */
export const SKETCH_2_HYRULE: readonly string[] = [
  '................',
  '................',
  '5555ooooRoRooooR', // Death Mountain's plateau
  '5555^^^^^^^^oooR', // its cliffs, two tiles tall
  '5555^^^^^^^^oooo', // 2-4 on the east plateau, the exit east along it
  '############^G^^', // the stairs up to 2-4
  '#####~~~~~~###HH', // Kakariko's houses (props) left; the castle's moat
  '#####~####~#####', // Kakariko's street; the castle island; the Eastern Palace (prop)
  '#####~####~#####',
  '#####~####~#####', // 2-1 between Kakariko and the moat
  '#####~~~I~~##hhh', // the start; the castle's bridge; the Eastern Palace's ledge
  '##########=#####', // the plank bridge over the moat's outflow
  'hhhh#H##S#~~~~~~', // the desert's ledge; Link's house (prop); 2-2 on Lake Hylia's shore
  '::::######~~~~~~', // the desert and its palace (prop); the road past Link's door
  '::::*H**H#~~~~~~',
];

/** Kakariko, the castle and its bridges, Link's house, the palaces, the mountain's stones and cave. */
export const PROPS_2_HYRULE: readonly MapProp[] = [
  { frame: 'house-blue', x: 0, y: 80 }, // Kakariko, cols 0-1 rows 5-6
  { frame: 'house-red', x: 32, y: 80 }, // cols 2-3 rows 5-6 (its door over the street)
  { frame: 'well', x: 0, y: 112 }, // the village well, beside the Top Secret Area's spot
  { frame: 'house-blue', x: 0, y: 128 }, // cols 0-1 rows 8-9, over the start (Link's hint at 2,9 kept clear)
  { frame: 'castle-bridge', x: 128, y: 160, flat: true }, // over the moat to the castle gate
  { frame: 'hyrule-castle', x: 96, y: 96 }, // cols 6-9, rows 6-9: the island, towers over the back moat
  { frame: 'link-house', x: 96, y: 176 }, // cols 6-7 rows 11-12, its door on 2-1's road
  { frame: 'bridge', x: 152, y: 172 }, // the plank bridge on row 11 (2-2's road north)
  { frame: 'desert-palace', x: 0, y: 208 }, // cols 0-2 rows 13-14
  { frame: 'eastern-palace', x: 208, y: 112 }, // cols 13-15 rows 7-9, on its ledge
  { frame: 'standing-stones', x: 80, y: 24 }, // on Death Mountain's plateau
  { frame: 'sign', x: 32, y: 176 }, // at the west road, beside the healer
  { frame: 'cave-mouth', x: 128, y: 64 }, // in the mountain's cliff
];

/** Each node's tile on this page, by id (WORLD_2's nodes keep their order and every other field). */
const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 10], // the west road under Kakariko
  '2-1': [3, 9], // the field between Kakariko and the moat (Link's hint at 2,9, west)
  '2-2': [9, 12], // Lake Hylia's west shore
  '2-3': [12, 8], // at the Eastern Palace's west steps
  '2-4': [13, 4], // the palace on Death Mountain
  'bonus-2': [1, 7], // Kakariko's street, by the well
};

/** Each road's tiles on this page, by road id (the same five roads as WORLD_2's). */
const ROADS: Readonly<Record<string, [number, number][]>> = {
  'start>2-1': poly([0, 10], [3, 10], [3, 9]),
  '2-1>2-2': poly([3, 9], [4, 9], [4, 13], [9, 13], [9, 12]),
  '2-2>2-3': poly([9, 12], [9, 11], [12, 11], [12, 8]),
  '2-3>2-4': poly([12, 8], [12, 6], [13, 6], [13, 4]),
  '2-1>bonus-2': poly([3, 9], [3, 7], [1, 7]),
};

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world2-hyrule: no tile for node ${id}`);
  return p;
};

export const WORLD_2_HYRULE: WorldMapPage = {
  ...WORLD_2,
  // Drawn from above from the `hyrule-above` sheet. The theme stays 'hyrule', so everything keyed
  // on it (the actors' palettes, the colour behind a slide, the hint's shade) holds.
  above: 'hyrule',
  tiles: autoShore(SKETCH_2_HYRULE),
  nodes: WORLD_2.nodes.map((n) => {
    const [x, y] = at(n.id);
    return { ...n, x, y };
  }),
  paths: WORLD_2.paths.map((p) => {
    const points = ROADS[`${p.from}>${p.to}`];
    if (!points) throw new Error(`world2-hyrule: no road ${p.from}>${p.to}`);
    return { ...p, points };
  }),
  // East along the mountain's plateau on row 4, to World 3.
  exits: WORLD_2.exits.map((e) => ({ ...e, points: poly(at(e.from), [15, 4]) })),
  // Blobs in the swamp and on the east bank, the fairy over the Lost Woods, river creatures in the
  // moat and the lake. No clouds: a page seen from above has no sky.
  actors: [
    actor('blob', 96, 32, { range: 16 }),
    actor('blob', 224, 176, { range: 16, phase: 40 }),
    actor('fairy', 24, 40, { phase: 30 }),
    actor('zora', 80, 120, { period: 260 }),
    actor('zora', 200, 208, { period: 220, phase: 120 }),
    actor('zora', 232, 200, { period: 240, phase: 60 }),
  ],
  props: [...PROPS_2_HYRULE],
};
