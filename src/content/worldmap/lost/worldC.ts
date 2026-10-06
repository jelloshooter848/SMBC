import { actor, autoShore, poly } from '../build';
import { lostNodes, lostPageIds, type LostMapPage } from './build';

/** Lost World C, STARLIT RIDGE: hills and pines split by a dark river, a pond under the stars. */
export const SKETCH_LL_C = [
  '................',
  '................',
  '.s..x....D..s.x.',
  'hjhhjjhjhhjhjjhh',
  '###PST,S#~~#ST,S',
  '#TS,#ST,#~~#####',
  '####T,ST#~~##ST,',
  'ST,#S#TS#~~####T',
  '#ST#,TS,#~~#ST#S',
  'T,S####T#~~#,##T',
  'ST#S,T#S#~~#T#S,',
  'abdfST#,#~~#S#TS',
  'gilmT,###==###,T',
  'prtvST,S#~~#TS,T',
  'ST,STST,#~~#,TS,',
];

export const LL_C: LostMapPage = {
  ...lostPageIds(12),
  title: 'STARLIT RIDGE',
  theme: 'night',
  music: 'map',
  tiles: autoShore(SKETCH_LL_C),
  nodes: lostNodes(
    12,
    [0, 6],
    [
      [3, 9],
      [6, 12],
      [13, 9],
      [12, 5],
    ],
    [2, 4],
  ),
  paths: [
    { from: 'start', to: 'll-12-1', points: poly([0, 6], [3, 6], [3, 9]) },
    { from: 'start', to: 'hub', points: poly([0, 6], [0, 4], [2, 4]) },
    { from: 'll-12-1', to: 'll-12-2', points: poly([3, 9], [6, 9], [6, 12]) },
    { from: 'll-12-2', to: 'll-12-3', points: poly([6, 12], [13, 12], [13, 9]) },
    { from: 'll-12-3', to: 'll-12-4', points: poly([13, 9], [14, 9], [14, 7], [12, 7], [12, 5]) },
  ],
  exits: [{ from: 'll-12-4', to: 'll-13', toWorld: 13, side: 'right', points: poly([12, 5], [15, 5]) }],
  actors: [
    actor('star', 24, 30, { phase: 0 }),
    actor('star', 100, 36, { phase: 50 }),
    actor('star', 170, 28, { phase: 110 }),
    actor('star', 230, 38, { phase: 20 }),
    actor('cloud', 60, 20, { size: 1, speed: 0.05 }),
    actor('bubble', 148, 140, { height: 14 }),
    actor('bubble', 24, 200, { height: 12, phase: 50 }),
    actor('goomba', 64, 160, { range: 16, speed: 0.2 }),
    actor('koopa', 192, 224, { range: 8, speed: 0.15 }),
  ],
};
