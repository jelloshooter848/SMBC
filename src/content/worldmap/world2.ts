import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 2, SEA SIDE: sandy islands and palms, bridges over the sea, 2-2 out on an islet. */
export const SKETCH_2 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '######~###~#####',
  'Y#,###=###~#####',
  '##Y###~###~##T,#',
  ',#####~~~~~###Y#',
  '#Y,#T#~~~~~#*##,',
  '####,#~~~~~###Y#',
  '##Y,##~~~~~##,##',
  '###Y##~###~##T##',
  ',#,###=###=###,#',
  '######~###~#####',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_2: WorldMapPage = {
  world: 2,
  title: 'SEA SIDE',
  theme: 'sea',
  music: 'map',
  tiles: autoShore(SKETCH_2),
  nodes: worldNodes(
    2,
    [0, 10],
    [
      [3, 6],
      [8, 11],
      [12, 8],
      [13, 4],
    ],
    [8, 4],
  ),
  paths: [
    { from: 'start', to: '2-1', points: poly([0, 10], [1, 10], [1, 8], [3, 8], [3, 6]) },
    { from: '2-1', to: '2-2', points: poly([3, 6], [5, 6], [5, 11], [8, 11]) },
    { from: '2-2', to: '2-3', points: poly([8, 11], [12, 11], [12, 8]) },
    { from: '2-3', to: '2-4', points: poly([12, 8], [13, 8], [13, 6], [12, 6], [12, 4], [13, 4]) },
    { from: '2-1', to: 'bonus-2', points: poly([3, 6], [3, 4], [8, 4]) },
  ],
  exits: [{ from: '2-4', toWorld: 3, side: 'right', points: poly([13, 4], [15, 4]) }],
  actors: [
    actor('cheep', 104, 136, { range: 24, height: 36, period: 150 }),
    actor('cheep', 140, 140, { range: -24, height: 28, period: 190, phase: 70 }),
    actor('cheep', 30, 214, { range: 40, height: 22, period: 170, phase: 30 }),
    actor('cheep', 200, 214, { range: -36, height: 20, period: 160, phase: 110 }),
    actor('cloud', 60, 18, { size: 1, speed: 0.1 }),
    actor('cloud', 190, 212, { size: 2, speed: 0.14 }),
    actor('bubble', 120, 222, { height: 12 }),
    actor('koopa', 208, 192, { range: 20, color: 'red' }),
  ],
};
