import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 5, SKY TREES: treetop canopies on a sea of clouds, ladders and bridges, Bullet Bills. */
export const SKETCH_5 = [
  '................',
  '~~~~~~~~~~~#T##,',
  '~~~~~~####~#####',
  '####~~####=##,#T',
  '#T,#~~#T##~##T##',
  '####==#,##~#####',
  '#*T#~~####~~~~I~',
  '####~~~~I~~~~~I~',
  '~|~~~~~~I~~#####',
  '###~~#####~#####',
  '#T#~~#T###~##T,*',
  '#T#~~#,T##~#####',
  '###~~#####~#####',
  '~~~~~~|~~~~~|~~~',
  '~{-}~~|~~~~~|~~~',
];

export const WORLD_5: WorldMapPage = {
  world: 5,
  title: 'SKY TREES',
  theme: 'sky',
  music: 'map',
  tiles: autoShore(SKETCH_5),
  nodes: worldNodes(
    5,
    [0, 5],
    [
      [8, 3],
      [13, 2],
      [12, 9],
      [14, 11],
    ],
    [7, 10],
  ),
  paths: [
    { from: 'start', to: '5-1', points: poly([0, 5], [6, 5], [6, 3], [8, 3]) },
    { from: '5-1', to: '5-2', points: poly([8, 3], [12, 3], [12, 2], [13, 2]) },
    { from: '5-2', to: '5-3', points: poly([13, 2], [14, 2], [14, 9], [12, 9]) },
    { from: '5-3', to: '5-4', points: poly([12, 9], [12, 11], [14, 11]) },
    { from: '5-1', to: 'bonus-5', points: poly([8, 3], [8, 10], [7, 10]) },
  ],
  exits: [{ from: '5-4', toWorld: 6, side: 'right', points: poly([14, 11], [15, 11]) }],
  actors: [
    actor('bullet', 200, 104, { speed: -0.7 }),
    actor('bullet', 40, 214, { speed: -0.5 }),
    actor('bullet', 120, 40, { speed: 0.6 }),
    actor('cloud', 20, 120, { size: 3, speed: 0.1 }),
    actor('cloud', 150, 200, { size: 2, speed: -0.08 }),
    actor('cloud', 230, 26, { size: 1, speed: 0.12 }),
    actor('paratroopa', 56, 132, { range: 10 }),
  ],
};
