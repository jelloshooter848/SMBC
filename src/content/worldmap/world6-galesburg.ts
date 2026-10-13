import type { MapProp, WorldMapPage } from '@game/map/types';
import { campaignLabel } from '@game/map/campaign-order';
import { actor, autoShore, poly } from './build';
import { WORLD_6 } from './world6';

/*
 * World 6 in campaign play (0.4.53, TD58's approved design): GALESBURG, the town of the ninja
 * game's first act, drawn from above in the 3/4 view of World 1's Mushroom Kingdom
 * (world1-kingdom.ts), from the `galesburg-above` sheet (sprites/galesburg-above.ts). Classic play
 * keeps WORLD_6 (world6.ts).
 *
 * Everything the save files key on is WORLD_6's own: the page id 'smb-6', its six node ids, kinds
 * and fields in the same order, the exit '6-4>smb-7' with Ryu's gate, the start on the left edge
 * on row 11 (World 5's exit row) and the exit off the right edge on row 6 (World 7's start row).
 *
 * THE CAMPAIGN ORDER (map/campaign-order.ts): Ryu is met in his dojo under internal 6-2, so it is
 * played FIRST and shown as "6-1"; internal 6-1 is second, shown as "6-2". The roads run start,
 * 6-2, 6-1, 6-3, 6-4 (new road ids 'start>6-2', '6-2>6-1', '6-1>6-3'); '6-3>6-4' and the bonus
 * road '6-3>bonus-6' keep their ids.
 *
 * Where the levels sit in the town:
 *   start   the west road into town by the canal (the elder beside it, at 1,12)
 *   6-2     shown 6-1: the neon main street by the Hayabusa dojo where Ryu waits (6-2: the city
 *           street at night; its quay and sewer: the canal); Ryu's hint east of the node, at 5,10
 *   6-1     shown 6-2: the bamboo park in the middle of town, lanterns and lawn (6-1: a moonlit
 *           field by a bamboo forest)
 *   6-3     the snowy pass above the town, up the stairs through the cliff (6-3: the snow pass)
 *   bonus-6 the hermit's hot spring at the top of the pass (a manhole marker: the bonus spot)
 *   6-4     the demon temple's pagoda at the mountain's foot (6-4: Jaquio's temple), the exit east
 *
 * Tiles (above: 'galesburg', galesburgGround):
 *   .  under the header: far rooftops (x < 5) and snowy peaks
 *   #  paving    ,  park lawn    o  snow    :  the temple's raked gravel
 *   ^  cliff (snow along its lip)    G  stone stairs up the cliff    ~  the canal
 *   T  bamboo    Y  snowy pine    S  stone lantern    X  street lamp    H  shrub    R  snowy rock
 *   C  low concrete wall
 * The shore chars autoShore writes along the canal draw as paving (the canal tiles draw the quay).
 */
export const SKETCH_6_GALESBURG: readonly string[] = [
  '................',
  '................',
  '#####^Yooooooooo', // the pass: 6-3's stairs, the road up to the hermit's spring (bonus-6)
  '#####^oYoooooooo',
  '#####^YooooooRoR',
  '#####^^^G^^G^^^^', // the cliff, two stairs through it
  '#####TT,,,X#::::', // the bamboo park; the pagoda (6-4) at the cliff's foot, the exit east
  '#####TT,HTT#::::',
  '####,,,,,ST#S::S', // 6-1 (shown 6-2) in the park; the temple's lanterns
  '###X,,H,ST,#::::',
  '########X##X####', // the neon main street: 6-2 (shown 6-1), Ryu's hint east of it
  '###############X', // the west road in (start)
  'C###############', // the elder's spot (1,12); the quay
  '###~~~~~~~~~~~~~', // the canal
  '~~~~~~~~~~~~~~~~',
];

/** The town's blocks, the neon shops, the dojo, the hot spring, the torii, a boat. */
export const PROPS_6_GALESBURG: readonly MapProp[] = [
  { frame: 'tower', x: 0, y: 32 }, // cols 0-1, rows 2-5
  { frame: 'brick-low', x: 32, y: 32 }, // cols 2-4, rows 2-3
  { frame: 'brick-block', x: 32, y: 64 }, // cols 2-4, rows 4-6
  { frame: 'neon-shop-wide', x: 0, y: 128 }, // cols 0-2 on the main street's north side
  { frame: 'brick-low', x: 48, y: 176 }, // cols 3-5 on the quay
  { frame: 'dojo', x: 96, y: 168 }, // cols 6-8: the Hayabusa dojo, past Ryu's hint
  { frame: 'neon-shop', x: 144, y: 172 }, // cols 9-10 on the quay
  { frame: 'brick-block', x: 192, y: 160 }, // cols 12-14
  { frame: 'brick-narrow', x: 224, y: 112 }, // cols 14-15 behind the precinct
  { frame: 'torii', x: 200, y: 108 }, // the temple's gate, below the pagoda
  { frame: 'hot-spring', x: 224, y: 32 }, // the hermit's spring, beside bonus-6
  { frame: 'boat', x: 64, y: 216 }, // moored in the canal
];

const AT: Readonly<Record<string, [number, number]>> = {
  start: [0, 11], // the west road into town (World 6's local, the elder, stands at 1,12)
  '6-2': [4, 10], // shown 6-1: the neon main street; Ryu's silhouette or trophy stands on 5,10
  '6-1': [7, 8], // shown 6-2: the bamboo park
  '6-3': [9, 3], // the snowy pass
  '6-4': [13, 6], // the demon temple's pagoda
  'bonus-6': [13, 2], // the hermit's hot spring
};

/** The roads in campaign order: start, internal 6-2, internal 6-1, 6-3, 6-4; the bonus off 6-3. */
const ROADS: readonly { from: string; to: string; points: [number, number][] }[] = [
  { from: 'start', to: '6-2', points: poly([0, 11], [2, 11], [2, 10], [4, 10]) },
  { from: '6-2', to: '6-1', points: poly([4, 10], [4, 8], [7, 8]) }, // up into the park
  { from: '6-1', to: '6-3', points: poly([7, 8], [7, 6], [8, 6], [8, 3], [9, 3]) }, // up the stairs
  { from: '6-3', to: '6-4', points: poly([9, 3], [11, 3], [11, 6], [13, 6]) }, // down the east stairs
  { from: '6-3', to: 'bonus-6', points: poly([9, 3], [9, 2], [13, 2]) },
];

const at = (id: string): [number, number] => {
  const p = AT[id];
  if (!p) throw new Error(`world6-galesburg: no tile for node ${id}`);
  return p;
};

export const WORLD_6_GALESBURG: WorldMapPage = {
  ...WORLD_6,
  // Drawn from above from the `galesburg-above` sheet; the theme stays 'ninja' (its actors' looks).
  above: 'galesburg',
  tiles: autoShore(SKETCH_6_GALESBURG),
  // WORLD_6's nodes in their order, each level with its campaign label (MapNode.shown).
  nodes: WORLD_6.nodes.map((n) => {
    const [x, y] = at(n.id);
    const shown = n.level ? campaignLabel(n.level) : undefined;
    return { ...n, x, y, ...(shown && shown !== n.level ? { shown } : {}) };
  }),
  // A road WORLD_6 also has keeps its fields; the others are new road ids.
  paths: ROADS.map((r) => {
    const main = WORLD_6.paths.find((p) => p.from === r.from && p.to === r.to);
    return { ...(main ?? { from: r.from, to: r.to }), points: r.points };
  }),
  // East from the pagoda on row 6, to World 7.
  exits: WORLD_6.exits.map((e) => ({ ...e, points: poly(at(e.from), [15, 6]) })),
  // Hawks over the roofs and the canal, ninjas leaping roof to roof, the masked ninja on a roof by
  // the temple, steam from the hot spring and a roof vent.
  actors: [
    actor('hawk', 0, 40, { range: 32, period: 420 }),
    actor('hawk', 176, 200, { range: 48, period: 480, phase: 100 }),
    actor('ninja', 4, 40, { range: 40, period: 150, height: 12 }),
    actor('ninja', 196, 162, { range: 24, period: 170, height: 4 }),
    actor('masked-ninja', 232, 132, {}),
    actor('smoke', 232, 40, { period: 110 }),
    actor('smoke', 40, 40, { period: 90 }),
  ],
  props: [...PROPS_6_GALESBURG],
};
