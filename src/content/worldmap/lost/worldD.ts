import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/** Lost World D, LAST GLACIER: a frozen land under the stars, an ice lake and Bowser's last keep. */
export const SKETCH_LL_D = [
  '................',
  '................',
  '.s..x...D..V.V..',
  'jjhjjhjjjjVWVWVj',
  'ST^oST^oTSWWWWWT',
  '####TSo^ToWWGWWS',
  '#ST#^oTSoT^o#TSo',
  '#oT#STo^TSoT#o^T',
  '##S###STo####STo',
  'TSoT^#oST#######',
  'SoT###ST###~~~~~',
  'T^S#oT^S#T#~~~~~',
  'oTS######S#~~~~~',
  'S^ToST^oTS#~~~~~',
  '^ST^oSTo^S#~~~~~',
];

export const LL_D: WorldMapPage = {
  ...lostPageIds(13),
  title: 'LAST GLACIER',
  theme: 'snow',
  music: 'map-bowser',
  tiles: autoShore(SKETCH_LL_D),
  nodes: lostNodes(
    13,
    [0, 5],
    [
      [5, 8],
      [3, 12],
      [9, 10],
      [12, 6],
    ],
  ),
  paths: [
    { from: 'start', to: 'll-13-1', points: poly([0, 5], [3, 5], [3, 8], [5, 8]) },
    { from: 'll-13-1', to: 'll-13-2', points: poly([5, 8], [5, 10], [3, 10], [3, 12]) },
    { from: 'll-13-2', to: 'll-13-3', points: poly([3, 12], [8, 12], [8, 10], [9, 10]) },
    { from: 'll-13-3', to: 'll-13-4', points: poly([9, 10], [9, 8], [12, 8], [12, 6]) },
  ],
  exits: [],
  actors: [
    actor('star', 20, 30, { phase: 0 }),
    actor('star', 70, 36, { phase: 60 }),
    actor('star', 236, 30, { phase: 120 }),
    actor('cloud', 120, 22, { size: 1, speed: 0.05 }),
    actor('flag', 176, 16),
    actor('flag', 208, 16, { phase: 15 }),
    actor('cheep', 200, 200, { range: 24, height: 24, period: 180 }),
    actor('bubble', 190, 224, { height: 12 }),
    actor('koopa', 96, 96, { range: 8, speed: 0.15 }),
    actor('hammer-bro', 224, 128, { range: 8 }),
  ],
};
