import type { MapProp, WorldMapPage } from '@game/map/types';
import { campaignLabel } from '@game/map/campaign-order';
import { actor, autoShore, poly } from './build';
import { WORLD_5 } from './world5';

/*
 * World 5 in campaign play (0.4.52, TD54's approved design): TRANSYLVANIA drawn from above in the
 * 3/4 view of World 1's Mushroom Kingdom (world1-kingdom.ts): Dracula's castle on its crag, its
 * parts along the route NES Castlevania takes through it (sprites/transylvania-above.ts). Classic
 * play keeps WORLD_5 (world5.ts).
 *
 * Everything the save files and rules key on is WORLD_5's own: the page id 'smb-5', its six node
 * ids, kinds and fields in the same order, the five road ids, the exit '5-4>smb-6' with Simon's
 * gate, the start on the left edge on row 5 (World 4's exit row) and the exit off the right edge
 * on row 11 (World 6's start row). World 5 keeps its order (map/campaign-order.ts has no rows).
 *
 * The route: out of the dark forest to the courtyard gate and the cemetery (5-1, where Simon is
 * found: his crypt's new entrance is in 5-1, so his map hint stands west of it, where the captive
 * scan puts it once the crypt hangs off 5-1); the catacombs under the crypt (the bonus spot); down
 * into the town by the river (5-2); back up the crag to the clock tower (5-3) and on to Dracula's
 * keep under the moon (5-4); the road on goes down the crag's stairs, over the river and away east.
 *
 * Tiles (above: 'transylvania', drawn from the `transylvania-above` sheet):
 *   .  under the header    #  ground (the part's own floor; shore chars too)    h  the night
 *   C  the crag's face    G  stairs up the crag (walkable)    ~  water    I  a bridge
 *   T  a tree (the forest's pines; elsewhere a dead tree)    J  graves    A  a candelabrum
 *   H  a forest shrub    R  a boulder
 * ZONES (one letter a tile): f forest, c courtyard, r great hall, b battlements, k the keep's
 *   crag, u the town, g the moor, v the caves, n the night.
 */
export const SKETCH_5_TRANSYLVANIA: readonly string[] = [
  '................',
  '................',
  'HHH####~~#hhhhhh', // the great hall; the aqueduct under the battlements; night behind the keep
  'TTT####~~#######',
  'T#T####~~#######',
  '#######~~#######', // the start, on the forest road
  'H###############', // the courtyard gate (5-1's), the clock tower, the keep (5-4)
  'T#####A#A#######',
  'T#####CCC#CGCGCC', // the crag's face, two stairs up it
  'T###########~I~~', // the river under the crag
  'T####J######~I~~', // the graveyard and the crypt (the catacombs)
  'TJ###J#####~~###',
  'TJ#########~~##H',
  'TJ#J######~~~##T', // the town by the river; the river runs on into the caves
  'TTJ#######~~~###',
];

export const ZONES_5_TRANSYLVANIA: readonly string[] = [
  'fffrrrrbbbnnnnnn',
  'fffrrrrbbbnnnnnn',
  'fffrrrrbbbnnnnnn',
  'fffrrrrbbbkkkkkk',
  'fffrrrrbbbkkkkkk',
  'fffrrrrbbbkkkkkk',
  'fffcccbbbbkkkkkk',
  'fffcccbbbbkkkkkk',
  'fffcccbbbbkkkkkk',
  'fffccccuuuuggggg',
  'ffffcccuuuuggggg',
  'ffffuuuuuuugggff',
  'fffffuuuuuvvvgff',
  'fffffuuuuuvvvvvf',
  'fffffuuuuuvvvvvf',
];

/** Landmarks: the keep, the gate, the great hall, the aqueduct's arches, the clock tower, the moon, the crypt, the town. */
export const PROPS_5_TRANSYLVANIA: readonly MapProp[] = [
  { frame: 'moon', x: 196, y: 33 }, // behind the keep's spires
  { frame: 'great-hall', x: 48, y: 32 }, // cols 3-6, rows 2-4
  { frame: 'arches', x: 104, y: 40 }, // over the aqueduct
  { frame: 'gatehouse', x: 48, y: 96 }, // cols 3-5, rows 6-8: 5-1's courtyard gate
  { frame: 'keep', x: 184, y: 48 }, // Dracula's keep under the moon, 5-4's gatehouse at its foot
  { frame: 'clock-tower', x: 136, y: 64 }, // cols 8.5-10.5, rows 4-8: 5-3's
  { frame: 'crypt', x: 48, y: 160 }, // the catacombs' crypt in the graveyard (the bonus spot)
  { frame: 'fountain', x: 112, y: 152 }, // the town square
  { frame: 'house-0', x: 80, y: 208 },
  { frame: 'house-1', x: 128, y: 208 },
  { frame: 'cave-mouth', x: 160, y: 216 }, // the river runs under the rock: the waterway
  { frame: 'bridge-v', x: 204, y: 140, flat: true }, // the bridge the road on crosses
];

const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 5], // the forest road (World 5's local stands beside it)
  '5-1': [2, 9], // by the courtyard gate and the cemetery; Simon's mark stands west of it, at 1,9
  '5-2': [8, 12], // the town by the river
  '5-3': [9, 9], // the clock tower's foot
  '5-4': [13, 7], // Dracula's keep
  'bonus-5': [3, 12], // before the crypt in the graveyard: the catacombs
};

const ROADS: Readonly<Record<string, [number, number][]>> = {
  'start>5-1': poly([0, 5], [2, 5], [2, 9]),
  '5-1>5-2': poly([2, 9], [6, 9], [6, 12], [8, 12]),
  '5-2>5-3': poly([8, 12], [9, 12], [9, 9]),
  '5-3>5-4': poly([9, 9], [11, 9], [11, 7], [13, 7]),
  '5-1>bonus-5': poly([2, 9], [2, 12], [3, 12]),
};

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world5-transylvania: no tile for node ${id}`);
  return p;
};

export const WORLD_5_TRANSYLVANIA: WorldMapPage = {
  ...WORLD_5,
  // Drawn from above from the `transylvania-above` sheet; the theme stays 'transylvania'.
  above: 'transylvania',
  tiles: autoShore(SKETCH_5_TRANSYLVANIA),
  // Each tile's part of the land, read by transylvaniaGround.
  zones: ZONES_5_TRANSYLVANIA,
  // Simon is found in 5-1 (his crypt's new entrance), so his mark stands west of it: 5-1's roads
  // leave north, east and south. The captive scan (map/captives.ts) names the node.
  nodes: WORLD_5.nodes.map((n) => {
    const [x, y] = at(n.id);
    const shown = n.level ? campaignLabel(n.level) : undefined;
    return { ...n, x, y, ...(shown && shown !== n.level ? { shown } : {}) };
  }),
  paths: WORLD_5.paths.map((p) => {
    const points = ROADS[`${p.from}>${p.to}`];
    if (!points) throw new Error(`world5-transylvania: no road ${p.from}>${p.to}`);
    return { ...p, points };
  }),
  // Down the keep's stairs, over the river, east on row 11 (World 6's start row).
  exits: WORLD_5.exits.map((e) => ({ ...e, points: poly(at(e.from), [13, 11], [15, 11]) })),
  // Bats over the battlements, the great hall and the night, ravens over the graveyard and the
  // moor. No Medusa heads: their wave crosses the whole page, and every band of it has a road.
  actors: [
    actor('bat', 112, 96, {}),
    actor('bat', 72, 72, { phase: 70 }),
    actor('bat', 168, 34, { phase: 30 }),
    actor('raven', 0, 210, { range: 8, speed: 0.3 }),
    actor('raven', 224, 196, { range: 8, speed: 0.35, phase: 120 }),
    actor('raven', 232, 220, { range: 0, speed: 0.25, phase: 40 }),
  ],
  props: [...PROPS_5_TRANSYLVANIA],
};
