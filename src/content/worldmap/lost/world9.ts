import { actor, autoShore, poly } from '../build';
import { lostNodes, lostPageIds, type LostMapPage } from './build';

/**
 * Lost World 9, FAREWELL SEA: the secret world where sea meets sky; islets joined by a treetop
 * and bridges, Paratroopas and Lakitu overhead. The game ends at 9-4, so there is no road on.
 */
export const SKETCH_LL_9 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~#####~',
  '####~~~~~~#####~',
  '#Y,#~~~~~~#Y:##~',
  '##Y#={--}=#:Y##~',
  '##*#~~|~|~#####~',
  '####~~|~|~~~~I~~',
  '#Y:#~~~~~~~~~I~~',
  '#:P#~~~~~~#####~',
  '##,#~~~~~~#Y###~',
  '####~~|~~~#:Y:#~',
  '~~~~~~|~~~#####~',
  '~~~~~~~~~~~~~~~~',
];

export const LL_9: LostMapPage = {
  ...lostPageIds(9),
  title: 'FAREWELL SEA',
  theme: 'sea',
  music: 'map',
  tiles: autoShore(SKETCH_LL_9),
  nodes: lostNodes(
    9,
    [0, 6],
    [
      [2, 8],
      [7, 6],
      [12, 4],
      [12, 11],
    ],
    [1, 11],
  ),
  paths: [
    { from: 'start', to: 'll-9-1', points: poly([0, 6], [1, 6], [1, 8], [2, 8]) },
    { from: 'start', to: 'hub', points: poly([0, 6], [0, 11], [1, 11]) },
    { from: 'll-9-1', to: 'll-9-2', points: poly([2, 8], [3, 8], [3, 6], [7, 6]) },
    { from: 'll-9-2', to: 'll-9-3', points: poly([7, 6], [10, 6], [10, 4], [12, 4]) },
    { from: 'll-9-3', to: 'll-9-4', points: poly([12, 4], [13, 4], [13, 11], [12, 11]) },
  ],
  exits: [],
  actors: [
    actor('cloud', 40, 18, { size: 2, speed: 0.1 }),
    actor('cloud', 170, 16, { size: 1, speed: -0.06 }),
    actor('cheep', 72, 200, { range: 30, height: 30, period: 170 }),
    actor('cheep', 150, 150, { range: -20, height: 20, period: 190, phase: 60 }),
    actor('paratroopa', 80, 72, { range: 8 }),
    actor('paratroopa', 240, 160, { range: 10, color: 'red', phase: 40 }),
    actor('lakitu', 120, 216, { range: 48 }),
  ],
};
