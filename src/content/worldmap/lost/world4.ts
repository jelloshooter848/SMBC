import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/** Lost World 4, TOADSTOOL GROVE: roads that run over giant mushroom caps, a pond in the glade. */
export const SKETCH_LL_4 = [
  '................',
  '................',
  'hhhhhhhhhhhhhhhh',
  '###P,T#T,#T#(O)#',
  '#T,#T,#####,T!,T',
  '#,T*,T#*T,#T*,T#',
  '###T###(O)#,T*,T',
  'T,#*#T,T!*#T,###',
  ',T#,#*T,T(O)T#T,',
  'T,###,(O)#!,T#,T',
  '#T,*T,T!,#T*,#T#',
  ',#T,(O)T,##(O)T,',
  'Tabdf!T,T*,T!,T*',
  '#gilm,T#,T(O)T,T',
  'Tprtv#,T*,T!#T#,',
];

export const LL_4: WorldMapPage = {
  ...lostPageIds(4),
  title: 'TOADSTOOL GROVE',
  theme: 'mushroom',
  music: 'map',
  tiles: autoShore(SKETCH_LL_4),
  nodes: lostNodes(
    4,
    [0, 6],
    [
      [4, 9],
      [8, 4],
      [10, 11],
      [13, 7],
    ],
    [2, 3],
  ),
  paths: [
    { from: 'start', to: 'll-4-1', points: poly([0, 6], [2, 6], [2, 9], [4, 9]) },
    { from: 'start', to: 'hub', points: poly([0, 6], [0, 3], [2, 3]) },
    { from: 'll-4-1', to: 'll-4-2', points: poly([4, 9], [4, 6], [6, 6], [6, 4], [8, 4]) },
    { from: 'll-4-2', to: 'll-4-3', points: poly([8, 4], [10, 4], [10, 8], [9, 8], [9, 11], [10, 11]) },
    { from: 'll-4-3', to: 'll-4-4', points: poly([10, 11], [13, 11], [13, 7]) },
  ],
  exits: [{ from: 'll-4-4', to: 'll-5', side: 'right', points: poly([13, 7], [15, 7]) }],
  actors: [
    actor('lakitu', 100, 24, { range: 80 }),
    actor('cloud', 10, 18, { size: 2, speed: 0.1 }),
    actor('goomba', 96, 224, { range: 16 }),
    actor('goomba', 208, 192, { range: 16, phase: 60 }),
    actor('koopa', 176, 96, { range: 12, color: 'red' }),
    actor('bubble', 40, 222, { height: 14 }),
    actor('paratroopa', 16, 136, { range: 6 }),
  ],
};
