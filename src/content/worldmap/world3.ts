import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 3, NIGHT HILLS: snow-capped hills under the moon and stars, a dark lake to the south. */
export const SKETCH_3 = [
  '................',
  '................',
  '..s..x...s.D..x.',
  'hjjhjhhjjhjhhjjh',
  '#####SS,S#T#SS#S',
  'ST,##,###,#S#T,#',
  '#S#,####ST######',
  '#,SS#T,SS#,#TSS#',
  'S####S#,TS######',
  '#T#S,#####S#~~~~',
  ',S#TS,#S,###~~~~',
  'S######,ST##~~~~',
  '############~~~~',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_3: WorldMapPage = {
  id: 'smb-3',
  group: 'smb',
  label: 'WORLD 3',
  title: 'NIGHT HILLS',
  theme: 'night',
  music: 'map',
  tiles: autoShore(SKETCH_3),
  nodes: worldNodes(
    3,
    [0, 4],
    [
      [4, 6],
      [3, 11],
      [9, 10],
      [13, 6],
    ],
    [8, 5],
  ),
  paths: [
    { from: 'start', to: '3-1', points: poly([0, 4], [4, 4], [4, 6]) },
    { from: '3-1', to: '3-2', points: poly([4, 6], [4, 8], [2, 8], [2, 11], [3, 11]) },
    { from: '3-2', to: '3-3', points: poly([3, 11], [6, 11], [6, 9], [9, 9], [9, 10]) },
    { from: '3-3', to: '3-4', points: poly([9, 10], [11, 10], [11, 6], [13, 6]) },
    { from: '3-1', to: 'bonus-3', points: poly([4, 6], [7, 6], [7, 5], [8, 5]) },
  ],
  exits: [{ from: '3-4', to: 'smb-4', side: 'right', points: poly([13, 6], [15, 6]), gate: 'megaman' }],
  actors: [
    actor('star', 52, 30, { phase: 0 }),
    actor('star', 132, 26, { phase: 50 }),
    actor('star', 200, 34, { phase: 100 }),
    actor('star', 20, 38, { phase: 140 }),
    actor('star', 236, 28, { phase: 30 }),
    actor('bubble', 214, 170, { height: 14 }),
    actor('goomba', 224, 80, { range: 14, speed: 0.2 }),
    actor('cloud', 90, 24, { size: 1, speed: 0.06 }),
  ],
};
