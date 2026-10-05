import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 1, GRASS LAND: green hills and flowers, a river crossed by a bridge, the sea below. */
export const SKETCH_1 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '########~~######',
  '#,HH#*##==###,T#',
  '#,#**###~~##*T,#',
  '#T,#*,##~~##,#T#',
  'T#######~~###**#',
  '#,#T#,*#~~####,#',
  ',T#T##,#~~#HH#P,',
  '###T#,##~~#H####',
  ',*######~~#,T,*#',
  '########~~######',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_1: WorldMapPage = {
  world: 1,
  title: 'GRASS LAND',
  theme: 'grass',
  music: 'map',
  tiles: autoShore(SKETCH_1),
  nodes: worldNodes(
    1,
    [0, 10],
    [
      [4, 7],
      [6, 4],
      [11, 6],
      [13, 10],
    ],
    [6, 11],
  ),
  paths: [
    { from: 'start', to: '1-1', points: poly([0, 10], [2, 10], [2, 7], [4, 7]) },
    { from: '1-1', to: '1-2', points: poly([4, 7], [6, 7], [6, 4]) },
    { from: '1-2', to: '1-3', points: poly([6, 4], [11, 4], [11, 6]) },
    { from: '1-3', to: '1-4', points: poly([11, 6], [11, 8], [13, 8], [13, 10]) },
    { from: '1-1', to: 'bonus-1', points: poly([4, 7], [4, 11], [6, 11]) },
  ],
  exits: [{ from: '1-4', toWorld: 2, side: 'right', points: poly([13, 10], [15, 10]) }],
  actors: [
    actor('cloud', 30, 18, { size: 2, speed: 0.12 }),
    actor('cloud', 170, 212, { size: 1, speed: 0.08 }),
    actor('goomba', 0, 176, { range: 20 }),
    actor('koopa', 224, 192, { range: 14, speed: 0.2 }),
    actor('bubble', 134, 150, { height: 20 }),
    actor('cheep', 40, 216, { range: 36, height: 22, period: 170 }),
    actor('cheep', 180, 216, { range: -30, height: 20, period: 200, phase: 90 }),
  ],
};
