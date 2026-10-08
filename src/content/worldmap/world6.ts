import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/** World 6, SNOW NIGHT: snowy pines and peaks around a dark lake under a starry sky. */
export const SKETCH_6 = [
  '................',
  '................',
  '.s...x..D...s..x',
  'jjhjjjjhjjjhjjjj',
  'ST^o#######TS^^T',
  'T^ST#oTSoT#oT^So',
  '^SoT#########S##',
  'To###,SoT,#T#o#T',
  'ST#o#Tabdf#S#T#S',
  'oS#T#ogilm#o###T',
  'T^#o#Sprtv#T#SoS',
  '###T##ToS##S#T^o',
  'SoTS#########oTS',
  '^TSo^T,oT^o^TSoT',
  'So^T,o^TSoT^,oT^',
];

export const WORLD_6: WorldMapPage = {
  id: 'smb-6',
  group: 'smb',
  label: 'WORLD 6',
  title: 'SNOW NIGHT',
  theme: 'snow',
  music: 'map',
  tiles: autoShore(SKETCH_6),
  nodes: worldNodes(
    6,
    [0, 11],
    [
      [2, 7],
      [7, 4],
      [12, 9],
      [14, 6],
    ],
    [10, 12],
  ),
  paths: [
    { from: 'start', to: '6-1', points: poly([0, 11], [2, 11], [2, 7]) },
    { from: '6-1', to: '6-2', points: poly([2, 7], [4, 7], [4, 4], [7, 4]) },
    { from: '6-2', to: '6-3', points: poly([7, 4], [10, 4], [10, 6], [12, 6], [12, 9]) },
    { from: '6-3', to: '6-4', points: poly([12, 9], [14, 9], [14, 6]) },
    { from: '6-3', to: 'bonus-6', points: poly([12, 9], [12, 12], [10, 12]) },
  ],
  exits: [{ from: '6-4', to: 'smb-7', side: 'right', points: poly([14, 6], [15, 6]), gate: 'ryu' }],
  actors: [
    actor('star', 40, 28, { phase: 20 }),
    actor('star', 104, 36, { phase: 80 }),
    actor('star', 170, 26, { phase: 140 }),
    actor('star', 226, 38, { phase: 60 }),
    actor('cloud', 120, 24, { size: 2, speed: 0.05 }),
    actor('koopa', 208, 208, { range: 12, speed: 0.15 }),
    actor('bubble', 128, 150, { height: 14 }),
    actor('cheep', 104, 160, { range: 24, height: 20, period: 220 }),
  ],
};
