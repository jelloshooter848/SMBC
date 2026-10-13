import type { MapProp, WorldMapPage } from '@game/map/types';
import { campaignLabel } from '@game/map/campaign-order';
import { actor, autoShore, poly } from './build';
import { WORLD_7 } from './world7';

/*
 * World 7 in campaign play (0.4.53, TD58's approved design): GALUGA ISLAND drawn from above in the
 * 3/4 view of World 1's Mushroom Kingdom (world1-kingdom.ts), laid out like the run-and-gun's first
 * stage seen from overhead, from the `galuga-above` sheet (sprites/galuga-above.ts). Classic play
 * keeps WORLD_7 (world7.ts).
 *
 * Everything the save files key on is WORLD_7's own: the page id 'smb-7', its six node ids, kinds
 * and fields in the same order, the exit '7-4>smb-8' with Bill's gate, the start on the left edge
 * on row 6 (World 6's exit row) and the exit off the right edge on row 10 (World 8's start row).
 *
 * THE CAMPAIGN ORDER (map/campaign-order.ts): Bill waits in his jungle camp under internal 7-3, so
 * it is played FIRST and shown as "7-1"; internal 7-1 is second (shown "7-2"), internal 7-2 third
 * (shown "7-3"), 7-4 last. The roads run start, 7-3, 7-1, 7-2, 7-4 (new road ids 'start>7-3',
 * '7-3>7-1', '7-1>7-2', '7-2>7-4'); the bonus road '7-2>bonus-7' keeps its id.
 *
 * Where the levels sit on the island:
 *   start   the west shore track under the cliffs (the sergeant beside it, at 1,7)
 *   7-3     shown 7-1: Bill's camp in the west jungle (7-3: the jungle camp); his hint west of it,
 *           at 2,9
 *   7-1     shown 7-2: the snowfield on the high ground, its pillboxes and bunker, up the steps
 *           (7-1: the snowfield before the enemy base)
 *   7-2     shown 7-3: across the steel bridge over the river's head, down the east cliff's steps
 *           past the waterfall to the jungle river's east bank (7-2: the jungle river)
 *   bonus-7 the weapon-capsule pad by the enemy base (the bonus spot)
 *   7-4     the alien lair at the foot of the enemy base's blue wall, the exit east on row 10
 *
 * Tiles (above: 'galuga', galugaGround):
 *   .  under the header: the far snowy peaks
 *   #  jungle floor (sand by the sea, snow in the snowfield; so do the shores)
 *   o  snow    :  beach sand    5  the jungle canopy on the high ground
 *   ^  golden rock cliff (snow or canopy along its lip)    G  rock steps down it
 *   ~  the river and the sea (the sea from row 12)    ≡  the waterfall    =  water under the bridge
 *   T  palm    Y  snowy pine    X  pillbox    H  jungle bush    R  boulder
 */
export const SKETCH_7_GALUGA: readonly string[] = [
  '................',
  '................',
  'oooooo#~~#555555', // the bunker and the far mountain; the river's head; the canopy
  'oooooo#==##55555', // 7-1 (shown 7-2) in the snow; the steel bridge; the track through the canopy
  'YooXXo#~~##55555', // pillboxes
  '^^^^^G#≡≡#G^^^^^', // the cliffs, a flight of steps each side, the waterfall
  '####T##≡≡#G^^^^^', // the start on the shore track; the high ground's cliffs are two tall
  '####T##~~#######', // the bonus pad (12,7) by the enemy base
  'T#T#H##~~#######', // 7-2 (shown 7-3) on the river's east bank
  '#######~~##H####', // Bill's camp: 7-3 (shown 7-1), his hint west of it
  '###H###~~#######', // the lair (7-4), the exit east
  '##:::##~~#######', // the beach
  '######~~~~~~~~~~', // the sea
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

/** The bunker, the far mountain, the steel bridge, the enemy base's wall, Bill's camp. */
export const PROPS_7_GALUGA: readonly MapProp[] = [
  { frame: 'bunker', x: 0, y: 24 }, // cols 0-1 over the snowfield
  { frame: 'mountain', x: 32, y: 24 }, // cols 2-3
  { frame: 'steel-bridge', x: 104, y: 42 }, // over the river's head on row 3 (7-1's road east)
  { frame: 'base-wall', x: 208, y: 112 }, // cols 13-15, rows 7-9: the enemy base over the lair
  { frame: 'camp', x: 0, y: 152 }, // cols 0-1 below Bill's hint
];

const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 6], // the shore track (World 7's local, the sergeant, stands at 1,7)
  '7-1': [5, 3], // shown 7-2: the snowfield
  '7-2': [10, 8], // shown 7-3: the jungle river's east bank
  '7-3': [3, 9], // shown 7-1: Bill's camp; his silhouette or trophy stands on 2,9
  '7-4': [14, 10], // the alien lair
  'bonus-7': [12, 7], // the weapon-capsule pad
};

/** The roads in campaign order: start, internal 7-3, 7-1, 7-2, then 7-4; the bonus off 7-2. */
const ROADS: readonly { from: string; to: string; points: [number, number][] }[] = [
  { from: 'start', to: '7-3', points: poly([0, 6], [3, 6], [3, 9]) },
  { from: '7-3', to: '7-1', points: poly([3, 9], [5, 9], [5, 3]) }, // up the west steps
  { from: '7-1', to: '7-2', points: poly([5, 3], [10, 3], [10, 8]) }, // over the bridge, down the east steps
  { from: '7-2', to: '7-4', points: poly([10, 8], [10, 10], [14, 10]) },
  { from: '7-2', to: 'bonus-7', points: poly([10, 8], [12, 8], [12, 7]) },
];

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world7-galuga: no tile for node ${id}`);
  return p;
};

export const WORLD_7_GALUGA: WorldMapPage = {
  ...WORLD_7,
  // Drawn from above from the `galuga-above` sheet; the theme stays 'contra' (its actors' looks).
  above: 'galuga',
  tiles: autoShore(SKETCH_7_GALUGA),
  // WORLD_7's nodes in their order, each level with its campaign label (MapNode.shown).
  nodes: WORLD_7.nodes.map((n) => {
    const [x, y] = at(n.id);
    const shown = n.level ? campaignLabel(n.level) : undefined;
    return { ...n, x, y, ...(shown && shown !== n.level ? { shown } : {}) };
  }),
  // A road WORLD_7 also has keeps its fields; the others are new road ids.
  paths: ROADS.map((r) => {
    const main = WORLD_7.paths.find((p) => p.from === r.from && p.to === r.to);
    return { ...(main ?? { from: r.from, to: r.to }), points: r.points };
  }),
  // East from the lair on row 10, to World 8.
  exits: WORLD_7.exits.map((e) => ({ ...e, points: poly(at(e.from), [15, 10]) })),
  // Soldiers on guard in the snow and on the beach, fish leaping in the sea, the bunker's flag,
  // smoke from the base's tower.
  actors: [
    actor('soldier', 16, 64, { range: 8, speed: 0.3 }),
    actor('soldier', 224, 176, { range: 12, speed: 0.35 }),
    actor('cheep', 128, 208, { range: 16, height: 14, period: 180 }),
    actor('cheep', 200, 216, { range: 0, height: 12, period: 210, phase: 90 }),
    actor('flag', 8, 24, { phase: 0 }),
    actor('smoke', 240, 88, { period: 100 }),
  ],
  props: [...PROPS_7_GALUGA],
};
