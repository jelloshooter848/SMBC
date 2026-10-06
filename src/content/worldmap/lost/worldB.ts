import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/** Lost World B, BREAKER COAST: a cannon-studded shelf under sea cliffs, a headland to the east. */
export const SKETCH_LL_B = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~#####',
  'KKKKKKKKKKK#X#R#',
  'R#X^^#X,R#X#####',
  '#R,#XR#^^,R#X#R,',
  'X#R,#X,R####^^#X',
  '#X###R^##X,R#X,R',
  'R,#X#,RX#^^#R,X#',
  '###R#X#,#R#X,^^R',
  '#,PR#####X,#RX#,',
  '################',
  '~~~~~~~~~~~~~~~~',
];

export const LL_B: WorldMapPage = {
  ...lostPageIds(11),
  title: 'BREAKER COAST',
  theme: 'coast',
  music: 'map',
  tiles: autoShore(SKETCH_LL_B),
  nodes: lostNodes(
    11,
    [0, 11],
    [
      [3, 9],
      [6, 12],
      [9, 8],
      [13, 6],
    ],
    [1, 13],
  ),
  paths: [
    { from: 'start', to: 'll-11-1', points: poly([0, 11], [2, 11], [2, 9], [3, 9]) },
    { from: 'start', to: 'hub', points: poly([0, 11], [0, 13], [1, 13]) },
    { from: 'll-11-1', to: 'll-11-2', points: poly([3, 9], [4, 9], [4, 12], [6, 12]) },
    { from: 'll-11-2', to: 'll-11-3', points: poly([6, 12], [8, 12], [8, 8], [9, 8]) },
    { from: 'll-11-3', to: 'll-11-4', points: poly([9, 8], [11, 8], [11, 6], [13, 6]) },
  ],
  exits: [{ from: 'll-11-4', to: 'll-12', side: 'right', points: poly([13, 6], [15, 6]) }],
  actors: [
    actor('cheep', 40, 56, { range: 32, height: 20, period: 170 }),
    actor('cheep', 120, 56, { range: -24, height: 18, period: 150, phase: 60 }),
    actor('cheep', 150, 222, { range: 30, height: 10, period: 200, phase: 30 }),
    actor('bullet', 200, 26, { speed: -0.7 }),
    actor('bullet', 60, 224, { speed: -0.5 }),
    actor('cloud', 100, 34, { size: 2, speed: 0.08 }),
    actor('hammer-bro', 208, 176, { range: 8 }),
  ],
};
