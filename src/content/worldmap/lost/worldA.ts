import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/**
 * Lost World A, SPORE FOREST: a dense mushroom wood between two ponds, entered by a warp pipe
 * from World 8; the pipe by the start ('warp-ll-8') goes back to that World 8 pad. It is always
 * open: reaching A means World 8's pad was open.
 */
export const SKETCH_LL_A = [
  '................',
  '................',
  'hhhhhhhhhhhhhhhh',
  'T,(O)#abdfT*(O)T',
  '#T,!*Tgilm,T#!,#',
  ',#T*,#prtv####T,',
  'T#####,T*T,#T#*T',
  ',#(O)#T,T(O),#T*',
  'T#,!T#*T,#!T*#,T',
  '##T*,#T,T#(O)#T,',
  '#T,T*#####,!T#,T',
  '#,T*,T,T*,(O)###',
  '###PabdfT,T!*T,T',
  'T,*Tgilm,(O)T,*T',
  ',T,#prtvT,!T*T,#',
];

export const LL_A: WorldMapPage = {
  ...lostPageIds(10),
  title: 'SPORE FOREST',
  theme: 'mushroom',
  music: 'map',
  tiles: autoShore(SKETCH_LL_A),
  nodes: [
    ...lostNodes(
      10,
      [0, 9],
      [
        [3, 6],
        [7, 10],
        [11, 5],
        [13, 11],
      ],
    ),
    { id: 'warp-ll-8', kind: 'warp', to: 'll-8', toNode: 'warp-ll-10', label: 'LOST WORLD 8', x: 2, y: 12 },
  ],
  paths: [
    { from: 'start', to: 'll-10-1', points: poly([0, 9], [1, 9], [1, 6], [3, 6]) },
    { from: 'start', to: 'warp-ll-8', points: poly([0, 9], [0, 12], [2, 12]) },
    { from: 'll-10-1', to: 'll-10-2', points: poly([3, 6], [5, 6], [5, 10], [7, 10]) },
    { from: 'll-10-2', to: 'll-10-3', points: poly([7, 10], [9, 10], [9, 7], [11, 7], [11, 5]) },
    { from: 'll-10-3', to: 'll-10-4', points: poly([11, 5], [13, 5], [13, 11]) },
  ],
  exits: [{ from: 'll-10-4', to: 'll-11', side: 'right', points: poly([13, 11], [15, 11]) }],
  actors: [
    actor('lakitu', 60, 24, { range: 100 }),
    actor('cloud', 180, 18, { size: 2, speed: 0.08 }),
    actor('goomba', 176, 224, { range: 16 }),
    actor('goomba', 16, 208, { range: 16, phase: 50 }),
    actor('koopa', 224, 144, { range: 8, color: 'red' }),
    actor('bubble', 90, 220, { height: 14 }),
    actor('bubble', 120, 64, { height: 12, phase: 40 }),
  ],
};
