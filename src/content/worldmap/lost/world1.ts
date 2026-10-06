import { actor, autoShore, poly } from '../build';
import { lostNodes, lostPageIds, type LostMapPage } from './build';

/** Lost World 1, GREEN MEADOW: rolling hills round a quiet pond, a long beach to the south. */
export const SKETCH_LL_1 = [
  '................',
  '................',
  'hhhhhhhhhhhhhhhh',
  '#T,#H##T,##HH#T#',
  '###,#T##,#T##H#,',
  '#T#,#T#abdf####T',
  '#,###*#gilm##H#,',
  '#T*T#,#prtv##T##',
  '##,T#*,T#####H#,',
  '#P,##T#*,#T,###T',
  'T,#H#######H,#T#',
  '#T,#*T#,#T######',
  '################',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const LL_1: LostMapPage = {
  ...lostPageIds(1),
  title: 'GREEN MEADOW',
  theme: 'grass',
  music: 'map',
  tiles: autoShore(SKETCH_LL_1),
  nodes: lostNodes(
    1,
    [0, 4],
    [
      [3, 6],
      [6, 10],
      [12, 5],
      [13, 11],
    ],
    [1, 8],
  ),
  paths: [
    { from: 'start', to: 'll-1-1', points: poly([0, 4], [2, 4], [2, 6], [3, 6]) },
    { from: 'start', to: 'hub', points: poly([0, 4], [0, 8], [1, 8]) },
    { from: 'll-1-1', to: 'll-1-2', points: poly([3, 6], [4, 6], [4, 10], [6, 10]) },
    { from: 'll-1-2', to: 'll-1-3', points: poly([6, 10], [9, 10], [9, 8], [12, 8], [12, 5]) },
    { from: 'll-1-3', to: 'll-1-4', points: poly([12, 5], [14, 5], [14, 9], [13, 9], [13, 11]) },
  ],
  exits: [{ from: 'll-1-4', to: 'll-2', toWorld: 2, side: 'right', points: poly([13, 11], [15, 11]) }],
  actors: [
    actor('cloud', 30, 16, { size: 2, speed: 0.12 }),
    actor('cloud', 150, 210, { size: 1, speed: 0.08 }),
    actor('goomba', 16, 48, { range: 32 }),
    actor('koopa', 16, 176, { range: 16, speed: 0.2 }),
    actor('cheep', 40, 216, { range: 36, height: 20, period: 170 }),
    actor('cheep', 180, 216, { range: -30, height: 18, period: 200, phase: 90 }),
    actor('bubble', 130, 110, { height: 14 }),
  ],
};
