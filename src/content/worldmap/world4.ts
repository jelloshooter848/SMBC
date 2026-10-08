import type { MapNode, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 4, MUSHROOM WOODS: giant red mushrooms among orange trees, a round pond, Lakitu overhead. */
export const SKETCH_4 = [
  '................',
  '................',
  'hhhhhhhhhhhhhhhh',
  '###(O)#######T,#',
  'T#,#!###abdf##T#',
  '##T,#*##gilm####',
  '###T*,##prtv#,T#',
  'T,############*,',
  '#T,*#,T##T#,###T',
  '#(O)##,#####T#,#',
  ',#!##T*#,T#,##T#',
  '#,T######(O)###,', // the tree left of 4-2 stands one tile out, clear of Samus's map hint
  '#T,##,T*##!#,T##',
  'T#####(O),#T(O)#',
  ',T#*,##!#T,##!#T',
];

export const WORLD_4: WorldMapPage = {
  id: 'smb-4',
  group: 'smb',
  label: 'WORLD 4',
  title: 'MUSHROOM WOODS',
  theme: 'mushroom',
  music: 'map',
  tiles: autoShore(SKETCH_4),
  // The bonus spot (0.5.0): found with Larry Koopa's crystal ball in 4-2's airship (secret
  // 'larry', a secret exit of 4-2), guarded by a wandering Hammer Bro once used (map/hammer-bro.ts).
  nodes: worldNodes(
    4,
    [0, 6],
    [
      [4, 3],
      [4, 11],
      [10, 11],
      [13, 5],
    ],
    [2, 13],
  ).map((n): MapNode => (n.kind === 'bonus' ? { ...n, unlock: 'larry', guard: 'hammer-bro' } : n)),
  paths: [
    { from: 'start', to: '4-1', points: poly([0, 6], [1, 6], [1, 3], [4, 3]) },
    { from: '4-1', to: '4-2', points: poly([4, 3], [6, 3], [6, 7], [4, 7], [4, 11]) },
    { from: '4-2', to: '4-3', points: poly([4, 11], [7, 11], [7, 9], [10, 9], [10, 11]) },
    { from: '4-3', to: '4-4', points: poly([10, 11], [13, 11], [13, 8], [12, 8], [12, 5], [13, 5]) },
    { from: '4-2', to: 'bonus-4', exit: 'secret:larry', points: poly([4, 11], [4, 13], [2, 13]) },
  ],
  exits: [{ from: '4-4', to: 'smb-5', side: 'right', points: poly([13, 5], [15, 5]), gate: 'samus' }],
  actors: [
    actor('lakitu', 120, 32, { range: 80 }),
    actor('cloud', 10, 20, { size: 2, speed: 0.1 }),
    actor('cloud', 200, 18, { size: 1, speed: 0.07 }),
    actor('goomba', 176, 224, { range: 16 }),
    actor('goomba', 32, 224, { range: 12, phase: 60 }),
    actor('koopa', 32, 128, { range: 12, color: 'red' }),
    actor('bubble', 156, 90, { height: 14 }),
  ],
};
