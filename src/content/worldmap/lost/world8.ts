import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/**
 * Lost World 8, DARK CITADEL: crags round a lava lake below Bowser's keep. The castle's road east
 * leads on to World 9, open once the file has cleared all 32 levels from Lost 1-1 to 8-4; a warp
 * pipe beside the keep leads to World A once Lost 8-4 is beaten (campaign rules, 0.4.0).
 */
export const SKETCH_LL_8 = [
  '................',
  '................',
  '........V.V.....',
  'hhhhhhhVWVWVhhhh',
  '####^#RWWWWW#^R#',
  '#R^#R^#WWGWWR#^R',
  '##P#^R##########',
  'R^##RP##R#######',
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
  nodes: [
    ...lostNodes(
      8,
      [0, 4],
      [
        [4, 8],
        [3, 12],
        [8, 11],
        [9, 6],
      ],
      [1, 6],
    ),
    // Worlds A-D: open once Lost 8-4 is beaten on the file ('llLetters').
    {
      id: 'warp-ll-10',
      kind: 'warp',
      to: 'll-10',
      requires: 'llLetters',
      label: 'LOST WORLD A',
      hint: 'LOST A - BEAT LOST 8-4',
      x: 6,
      y: 7,
    },
  ],
  paths: [
    { from: 'start', to: 'll-8-1', points: poly([0, 4], [3, 4], [3, 8], [4, 8]) },
    { from: 'start', to: 'hub', points: poly([0, 4], [0, 6], [1, 6]) },
    { from: 'll-8-1', to: 'll-8-2', points: poly([4, 8], [4, 10], [2, 10], [2, 12], [3, 12]) },
    { from: 'll-8-2', to: 'll-8-3', points: poly([3, 12], [6, 12], [6, 10], [8, 10], [8, 11]) },
    { from: 'll-8-3', to: 'll-8-4', points: poly([8, 11], [10, 11], [10, 7], [9, 7], [9, 6]) },
    { from: 'll-8-4', to: 'warp-ll-10', points: poly([9, 6], [7, 6], [7, 7], [6, 7]) },
  ],
  // World 9: every level from Lost 1-1 to 8-4 cleared on the file ('ll9'); the hint shows the count.
  exits: [
    {
      from: 'll-8-4',
      to: 'll-9',
      requires: 'll9',
      hint: 'WORLD 9 - CLEAR 1-1 TO 8-4 {n}',
      side: 'right',
      points: poly([9, 6], [15, 6]),
    },
  ],
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
