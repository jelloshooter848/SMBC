import { actor, autoShore, poly } from '../build';
import { lostNodes, lostPageIds, type LostMapPage } from './build';

/** Lost World 2, TWILIGHT VALE: frosted hills under the evening stars, a dark lake in the corner. */
export const SKETCH_LL_2 = [
  '................',
  '................',
  '.x...s..s..x.D..',
  'jhhjhjjhhjhjjhhj',
  'S#T,S#,#S#T#S,T#',
  'T#S,#T#S,#####S,',
  '#S,#T#S,##TS##T#',
  '#T#S,#T#,#S,T#S#',
  'T,####ST,#,TS#,T',
  'ST#,S#,ST#S#T###',
  '#S#T,#S#########',
  '###TS#,#T#~~~~~~',
  '#P,ST###,#~~~~~~',
  '##T,S#T,S#~~~~~~',
  'S,T#S,#T,#~~~~~~',
];

export const LL_2: LostMapPage = {
  ...lostPageIds(2),
  title: 'TWILIGHT VALE',
  theme: 'night',
  music: 'map',
  tiles: autoShore(SKETCH_LL_2),
  nodes: lostNodes(
    2,
    [0, 11],
    [
      [3, 8],
      [7, 12],
      [10, 5],
      [13, 9],
    ],
    [1, 13],
  ),
  paths: [
    { from: 'start', to: 'll-2-1', points: poly([0, 11], [2, 11], [2, 8], [3, 8]) },
    { from: 'start', to: 'hub', points: poly([0, 11], [0, 13], [1, 13]) },
    { from: 'll-2-1', to: 'll-2-2', points: poly([3, 8], [5, 8], [5, 12], [7, 12]) },
    { from: 'll-2-2', to: 'll-2-3', points: poly([7, 12], [7, 10], [9, 10], [9, 5], [10, 5]) },
    { from: 'll-2-3', to: 'll-2-4', points: poly([10, 5], [13, 5], [13, 9]) },
  ],
  exits: [{ from: 'll-2-4', to: 'll-3', toWorld: 3, side: 'right', points: poly([13, 9], [15, 9]) }],
  actors: [
    actor('star', 20, 30, { phase: 0 }),
    actor('star', 84, 36, { phase: 60 }),
    actor('star', 150, 28, { phase: 120 }),
    actor('star', 236, 34, { phase: 30 }),
    actor('cloud', 100, 20, { size: 1, speed: 0.06 }),
    actor('bubble', 200, 200, { height: 12 }),
    actor('cheep', 176, 200, { range: 24, height: 20, period: 190 }),
    actor('goomba', 32, 64, { range: 40, speed: 0.2 }),
    actor('koopa', 176, 144, { range: 8, speed: 0.15 }),
  ],
};
