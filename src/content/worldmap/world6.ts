import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 6, SNOW NIGHT: snow fields and frosty pines under a starry sky, an icy sea to the south. */
export const SKETCH_6 = [
  '................',
  '.x..s....x...D.s',
  's....x..s.....x.',
  'jjhjjjhjjjjhjjjh',
  'SoT#SS#oT#S^^SoT',
  '#TSo#####oT^S#TS',
  'o#T###To##ST####',
  'So##TSo##ToS#TSo',
  '#TS###oT##S##oT#',
  'o#T#T#SoT#o#S#oS',
  'So##S##To#######',
  '####oT#SToS#~~~~',
  '############~~~~',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_6: WorldMapPage = {
  world: 6,
  title: 'SNOW NIGHT',
  theme: 'snow',
  music: 'map',
  tiles: autoShore(SKETCH_6),
  nodes: worldNodes(
    6,
    [0, 11],
    [
      [3, 8],
      [7, 5],
      [10, 10],
      [13, 6],
    ],
    [6, 12],
  ),
  paths: [
    { from: 'start', to: '6-1', points: poly([0, 11], [3, 11], [3, 8]) },
    { from: '6-1', to: '6-2', points: poly([3, 8], [3, 6], [5, 6], [5, 5], [7, 5]) },
    { from: '6-2', to: '6-3', points: poly([7, 5], [8, 5], [8, 8], [9, 8], [9, 10], [10, 10]) },
    { from: '6-3', to: '6-4', points: poly([10, 10], [11, 10], [11, 8], [12, 8], [12, 6], [13, 6]) },
    { from: '6-1', to: 'bonus-6', points: poly([3, 8], [5, 8], [5, 10], [6, 10], [6, 12]) },
  ],
  exits: [{ from: '6-4', toWorld: 7, side: 'right', points: poly([13, 6], [15, 6]) }],
  actors: [
    actor('star', 40, 28, { phase: 20 }),
    actor('star', 104, 36, { phase: 80 }),
    actor('star', 170, 26, { phase: 140 }),
    actor('star', 226, 38, { phase: 60 }),
    actor('cloud', 120, 16, { size: 2, speed: 0.05 }),
    actor('koopa', 208, 128, { range: 12, speed: 0.15 }),
    actor('bubble', 220, 186, { height: 14 }),
    actor('cheep', 90, 214, { range: 30, height: 24, period: 220 }),
  ],
};
