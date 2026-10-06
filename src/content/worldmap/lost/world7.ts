import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/** Lost World 7, BULLET BLUFFS: a rocky plateau of cannons between a cliff-lined shore and a bay. */
export const SKETCH_LL_7 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '################',
  'X#R,^^#X,#######',
  '#X#R#,X#R##X#R,#',
  'R,^^#X#R###,X#^R',
  '#X####,X#R######',
  ',R#X,#^^#,X#~~~~',
  'X##R^#R,#XR#~~~~',
  '###X,####,R#~~~~',
  '#R^^#X,R#X,#~~~~',
  '##P,R#^X,R##~~~~',
  'KKKKKKKKKKKK~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const LL_7: WorldMapPage = {
  ...lostPageIds(7),
  title: 'BULLET BLUFFS',
  theme: 'coast',
  music: 'map',
  tiles: autoShore(SKETCH_LL_7),
  nodes: lostNodes(
    7,
    [0, 10],
    [
      [3, 7],
      [7, 10],
      [10, 6],
      [13, 4],
    ],
    [1, 12],
  ),
  paths: [
    { from: 'start', to: 'll-7-1', points: poly([0, 10], [2, 10], [2, 7], [3, 7]) },
    { from: 'start', to: 'hub', points: poly([0, 10], [0, 12], [1, 12]) },
    { from: 'll-7-1', to: 'll-7-2', points: poly([3, 7], [5, 7], [5, 10], [7, 10]) },
    { from: 'll-7-2', to: 'll-7-3', points: poly([7, 10], [8, 10], [8, 6], [10, 6]) },
    { from: 'll-7-3', to: 'll-7-4', points: poly([10, 6], [10, 4], [13, 4]) },
  ],
  exits: [{ from: 'll-7-4', to: 'll-8', side: 'right', points: poly([13, 4], [15, 4]) }],
  actors: [
    actor('hammer-bro', 48, 192, { range: 8 }),
    actor('bullet', 180, 34, { speed: -0.8 }),
    actor('bullet', 60, 216, { speed: -0.55 }),
    actor('cheep', 200, 180, { range: 24, height: 30, period: 180 }),
    actor('cheep', 80, 216, { range: 32, height: 20, period: 150, phase: 75 }),
    actor('cloud', 100, 16, { size: 2, speed: 0.1 }),
    actor('goomba', 96, 48, { range: 40, speed: 0.2 }),
  ],
};
