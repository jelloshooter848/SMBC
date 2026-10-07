import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/**
 * Lost World 8, DARK CITADEL: crags round a lava lake below Bowser's keep. The castle's road east
 * leads on to World 9 once Lost 8-4 is beaten (0.4.7: the worlds open in order; until then World
 * 9 needed all 32 levels warpless and a warp pipe here led to World A).
 */
export const SKETCH_LL_8 = [
  '................',
  '................',
  '........V.V.....',
  'hhhhhhhVWVWVhhhh',
  '####^#RWWWWW#^R#',
  '#R^#R^#WWGWWR#^R',
  '##^#^R##########',
  'R^##R###R#######',
  '#R^##R^#R##LLLLL',
  '^#R^##R^#R#LLLLL',
  'R^###R###^#LLLLL',
  '#R#^R^#R###LLLLL',
  '^R#####^R##LLLLL',
  'R#^R#^R#^R#LLLLL',
  '#^R#^#R^#R#LLLLL',
];

export const LL_8: WorldMapPage = {
  ...lostPageIds(8),
  title: 'DARK CITADEL',
  theme: 'bowser',
  music: 'map-bowser',
  tiles: autoShore(SKETCH_LL_8),
  nodes: lostNodes(
    8,
    [0, 4],
    [
      [4, 8],
      [3, 12],
      [8, 11],
      [9, 6],
    ],
  ),
  paths: [
    { from: 'start', to: 'll-8-1', points: poly([0, 4], [3, 4], [3, 8], [4, 8]) },
    { from: 'll-8-1', to: 'll-8-2', points: poly([4, 8], [4, 10], [2, 10], [2, 12], [3, 12]) },
    { from: 'll-8-2', to: 'll-8-3', points: poly([3, 12], [6, 12], [6, 10], [8, 10], [8, 11]) },
    { from: 'll-8-3', to: 'll-8-4', points: poly([8, 11], [10, 11], [10, 7], [9, 7], [9, 6]) },
  ],
  exits: [{ from: 'll-8-4', to: 'll-9', side: 'right', points: poly([9, 6], [15, 6]) }],
  actors: [
    actor('podoboo', 200, 176, { height: 40, period: 140 }),
    actor('podoboo', 232, 208, { height: 36, period: 170, phase: 80 }),
    actor('podoboo', 184, 224, { height: 30, period: 150, phase: 40 }),
    actor('smoke', 212, 64, { period: 120 }),
    actor('flag', 128, 18),
    actor('flag', 160, 18, { phase: 15 }),
    actor('bullet', 120, 26, { speed: -0.4 }),
    actor('hammer-bro', 0, 224, { range: 8 }),
  ],
};
