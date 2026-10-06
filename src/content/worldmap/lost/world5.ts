import { actor, autoShore, poly } from '../build';
import { lostNodes, lostPageIds, type LostMapPage } from './build';

/** Lost World 5, CLOUD CANOPY: three isles in a sea of clouds, joined by bridges and a treetop. */
export const SKETCH_LL_5 = [
  '................',
  '................',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~####~~~~~',
  '#####~~####~~~~~',
  '#T###==#T##~~~~~',
  '#,#T#~~####~~~~~',
  '###*#~~~~I~~~~~~',
  '#T,T#~~~{-}=####',
  '#,T*#~~~~|~~#T##',
  '###P#~~~~|~~#,#T',
  '#####~~|~~~~#*#,',
  '~~|~~~~~|~~~####',
  '|~~~|~~|~~~|~|~~',
  '~|~~~|~~|~~~|~~|',
];

export const LL_5: LostMapPage = {
  ...lostPageIds(5),
  title: 'CLOUD CANOPY',
  theme: 'sky',
  music: 'map',
  tiles: autoShore(SKETCH_LL_5),
  nodes: lostNodes(
    5,
    [0, 7],
    [
      [3, 5],
      [9, 4],
      [13, 12],
      [14, 9],
    ],
    [2, 10],
  ),
  paths: [
    { from: 'start', to: 'll-5-1', points: poly([0, 7], [2, 7], [2, 5], [3, 5]) },
    { from: 'start', to: 'hub', points: poly([0, 7], [0, 10], [2, 10]) },
    { from: 'll-5-1', to: 'll-5-2', points: poly([3, 5], [7, 5], [7, 4], [9, 4]) },
    { from: 'll-5-2', to: 'll-5-3', points: poly([9, 4], [9, 8], [12, 8], [12, 12], [13, 12]) },
    { from: 'll-5-3', to: 'll-5-4', points: poly([13, 12], [14, 12], [14, 9]) },
  ],
  exits: [{ from: 'll-5-4', to: 'll-6', toWorld: 6, side: 'right', points: poly([14, 9], [15, 9]) }],
  actors: [
    actor('bullet', 200, 30, { speed: -0.7 }),
    actor('bullet', 40, 216, { speed: -0.5 }),
    actor('cloud', 20, 18, { size: 3, speed: 0.1 }),
    actor('cloud', 150, 210, { size: 2, speed: -0.08 }),
    actor('paratroopa', 96, 152, { range: 8 }),
    actor('paratroopa', 176, 64, { range: 8, color: 'red', phase: 60 }),
    actor('lakitu', 48, 200, { range: 64 }),
  ],
};
