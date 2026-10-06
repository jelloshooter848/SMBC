import { actor, autoShore, poly } from '../build';
import type { WorldMapPage } from '@game/map/types';
import { lostNodes, lostPageIds } from './build';

/** Lost World 3, FROST FIELDS: snowbound pines and peaks running down to an icy southern sea. */
export const SKETCH_LL_3 = [
  '................',
  '................',
  '..s.D....x..s..x',
  'jjhjjhjjjhjjhjjj',
  'S^To#S^^T#oS^To^',
  'T######oS^ToS^TS',
  'S#oT^o#TSo^To###',
  '^#SoTS#oTSo#T#S^',
  'T#TSoT###oST^#oT',
  '##oS^ToS#ToSo#TS',
  '#TSoTS^o#SToS#o^',
  '#oTSoTSo######TS',
  '################',
  '##P#~~~~~~~~~~~~',
  '#o##~~~~~~~~~~~~',
];

export const LL_3: WorldMapPage = {
  ...lostPageIds(3),
  title: 'FROST FIELDS',
  theme: 'snow',
  music: 'map',
  tiles: autoShore(SKETCH_LL_3),
  nodes: lostNodes(
    3,
    [0, 9],
    [
      [3, 5],
      [8, 8],
      [11, 11],
      [13, 6],
    ],
    [2, 12],
  ),
  paths: [
    { from: 'start', to: 'll-3-1', points: poly([0, 9], [1, 9], [1, 5], [3, 5]) },
    { from: 'start', to: 'hub', points: poly([0, 9], [0, 12], [2, 12]) },
    { from: 'll-3-1', to: 'll-3-2', points: poly([3, 5], [6, 5], [6, 8], [8, 8]) },
    { from: 'll-3-2', to: 'll-3-3', points: poly([8, 8], [8, 11], [11, 11]) },
    { from: 'll-3-3', to: 'll-3-4', points: poly([11, 11], [13, 11], [13, 6]) },
  ],
  exits: [{ from: 'll-3-4', to: 'll-4', side: 'right', points: poly([13, 6], [15, 6]) }],
  actors: [
    actor('star', 40, 30, { phase: 0 }),
    actor('star', 120, 36, { phase: 70 }),
    actor('star', 200, 28, { phase: 140 }),
    actor('cloud', 150, 20, { size: 2, speed: 0.05 }),
    actor('cheep', 90, 216, { range: 30, height: 20, period: 200 }),
    actor('cheep', 200, 216, { range: -28, height: 18, period: 180, phase: 80 }),
    actor('bubble', 150, 214, { height: 10 }),
    actor('goomba', 32, 64, { range: 40, speed: 0.2 }),
    actor('koopa', 144, 144, { range: 12, speed: 0.15 }),
  ],
};
