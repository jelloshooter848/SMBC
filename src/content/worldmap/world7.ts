import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 7, CANNON COAST: rocky headlands bristling with cannons above steep sea cliffs. */
export const SKETCH_7 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '##############~~',
  '#X#R,##X######~~',
  ',##^^#R,#^^,##~~',
  '###X##,X#R#X##~~',
  'X,##R####,####~~',
  '#^^#,X##R##X##~~',
  ',^#R#,X#^R#,####',
  '#X#,####X,######',
  '##R#X#,##X#R#,##',
  'KKKKKKKKKKKKKKKK',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_7: WorldMapPage = {
  id: 'smb-7',
  group: 'smb',
  label: 'WORLD 7',
  title: 'CANNON COAST',
  theme: 'coast',
  music: 'map',
  tiles: autoShore(SKETCH_7),
  nodes: worldNodes(
    7,
    [0, 6],
    [
      [4, 3],
      [7, 7],
      [11, 4],
      [12, 10],
    ],
    [5, 11],
  ),
  paths: [
    { from: 'start', to: '7-1', points: poly([0, 6], [2, 6], [2, 3], [4, 3]) },
    { from: '7-1', to: '7-2', points: poly([4, 3], [5, 3], [5, 7], [7, 7]) },
    { from: '7-2', to: '7-3', points: poly([7, 7], [8, 7], [8, 4], [11, 4]) },
    { from: '7-3', to: '7-4', points: poly([11, 4], [12, 4], [12, 7], [10, 7], [10, 10], [12, 10]) },
    { from: '7-2', to: 'bonus-7', points: poly([7, 7], [7, 10], [5, 10], [5, 11]) },
  ],
  exits: [{ from: '7-4', to: 'smb-8', side: 'right', points: poly([12, 10], [15, 10]), gate: 'bill' }],
  actors: [
    actor('hammer-bro', 208, 144, { range: 6 }),
    actor('bullet', 180, 26, { speed: -0.8 }),
    actor('bullet', 60, 216, { speed: -0.55 }),
    actor('cheep', 40, 214, { range: 32, height: 22, period: 180 }),
    actor('cheep', 150, 214, { range: -28, height: 20, period: 150, phase: 75 }),
    actor('cheep', 236, 96, { range: -8, height: 26, period: 210, phase: 40 }),
    actor('cloud', 100, 18, { size: 2, speed: 0.1 }),
  ],
};
