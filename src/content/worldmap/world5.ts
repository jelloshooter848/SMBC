import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 5, SKY TREES: treetop canopies on a sea of clouds, trunks reaching down into a sea of clouds, Bullet Bills. */
export const SKETCH_5 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '####~~####~#####',
  '#T##~~####=##T,#',
  '####==#T##~#####',
  '#*T#~~#,##~#####',
  '####~~####~~|~I~',
  '~|~~~~|~I~~~|~I~',
  '~|~~~~|~I~~#####',
  '###~~#####~##T,#',
  '#T#~~#T,T#~#####',
  '###~~#####~#####',
  '|~{-}~|~|{-}|~|~',
  '|~~|~~|~|~|~|~|~',
];

export const WORLD_5: WorldMapPage = {
  id: 'smb-5',
  group: 'smb',
  label: 'WORLD 5',
  title: 'SKY TREES',
  theme: 'sky',
  music: 'map',
  tiles: autoShore(SKETCH_5),
  nodes: worldNodes(
    5,
    [0, 5],
    [
      [8, 4],
      [13, 5],
      [12, 9],
      [14, 11],
    ],
    [7, 10],
  ),
  paths: [
    { from: 'start', to: '5-1', points: poly([0, 5], [6, 5], [6, 4], [8, 4]) },
    { from: '5-1', to: '5-2', points: poly([8, 4], [12, 4], [12, 5], [13, 5]) },
    { from: '5-2', to: '5-3', points: poly([13, 5], [14, 5], [14, 9], [12, 9]) },
    { from: '5-3', to: '5-4', points: poly([12, 9], [12, 11], [14, 11]) },
    { from: '5-1', to: 'bonus-5', points: poly([8, 4], [8, 10], [7, 10]) },
  ],
  exits: [{ from: '5-4', to: 'smb-6', side: 'right', points: poly([14, 11], [15, 11]), gate: 'simon' }],
  actors: [
    actor('bullet', 200, 26, { speed: -0.7 }),
    actor('bullet', 40, 218, { speed: -0.5 }),
    actor('bullet', 120, 208, { speed: 0.6, phase: 200 }),
    actor('cloud', 20, 18, { size: 3, speed: 0.1 }),
    actor('cloud', 150, 212, { size: 2, speed: -0.08 }),
    actor('paratroopa', 72, 136, { range: 10 }),
    actor('paratroopa', 160, 120, { range: 8, color: 'red', phase: 60 }),
  ],
};
