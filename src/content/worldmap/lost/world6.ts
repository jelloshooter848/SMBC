import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/** Lost World 6, CORAL BAY: sandy islands strung round a bay, crossed by bridges and a pier. */
export const SKETCH_LL_6 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '~~~~~####~#####~',
  '~~~~~#Y##=##:Y#~',
  '~~~~~####~###:#~',
  '####=####~#####~',
  '##Y#~~~~~~~~I~~~',
  '#,Y#~~~~~~~~I~~~',
  '####~~~~~~######',
  ':Y##~~~~~~#Y####',
  '#:##~~~~~~#:Y:Y,',
  'Y:Y#~~~~~~#Y:Y:Y',
  '####~~~~~~######',
  '~~~~~~~~~~~~~~~~',
];

export const LL_6: WorldMapPage = {
  ...lostPageIds(6),
  title: 'CORAL BAY',
  theme: 'sea',
  music: 'map',
  tiles: autoShore(SKETCH_LL_6),
  nodes: lostNodes(
    6,
    [0, 9],
    [
      [2, 11],
      [6, 5],
      [11, 5],
      [12, 10],
    ],
  ),
  paths: [
    { from: 'start', to: 'll-6-1', points: poly([0, 9], [2, 9], [2, 11]) },
    { from: 'll-6-1', to: 'll-6-2', points: poly([2, 11], [3, 11], [3, 6], [5, 6], [5, 5], [6, 5]) },
    { from: 'll-6-2', to: 'll-6-3', points: poly([6, 5], [7, 5], [7, 4], [11, 4], [11, 5]) },
    { from: 'll-6-3', to: 'll-6-4', points: poly([11, 5], [12, 5], [12, 10]) },
  ],
  exits: [{ from: 'll-6-4', to: 'll-7', side: 'right', points: poly([12, 10], [15, 10]) }],
  actors: [
    actor('cheep', 80, 180, { range: 24, height: 30, period: 160 }),
    actor('cheep', 120, 200, { range: -24, height: 24, period: 190, phase: 70 }),
    actor('cheep', 170, 220, { range: 30, height: 18, period: 170, phase: 30 }),
    actor('cloud', 40, 18, { size: 2, speed: 0.1 }),
    actor('bubble', 100, 220, { height: 12 }),
    actor('koopa', 208, 192, { range: 16, color: 'red' }),
    actor('goomba', 0, 192, { range: 16 }),
  ],
};
