import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 8, BOWSER'S LAND: ash fields and volcanoes under a red sky, lava, and the big castle.
 * Its gate opens east: once 8-4 is beaten (after the ending), a road leads off the right edge on
 * to Lost World 1 (0.4.7: the Lost Levels are the story's extension).
 */
export const SKETCH_8 = [
  '................',
  '................',
  '...........V.V..',
  '..........VWVWV.',
  'hhhhhhhhhhWWWWWh',
  '#R##^#R#^#WWWWG#',
  '#R##############',
  'R##^##LL###R##R#',
  '#^#R##LL########',
  'R###^#####~~~~~~',
  '###R##^R##~~~~~~',
  '^#R#######~~~~~~',
  '#^#R##R###~~~~~~',
  'R#^#####R#~~~~~~',
  '#R#^##^###~~~~~~',
];

export const WORLD_8: WorldMapPage = {
  id: 'smb-8',
  group: 'smb',
  label: 'WORLD 8',
  title: "BOWSER'S LAND",
  theme: 'bowser',
  music: 'map-bowser',
  tiles: autoShore(SKETCH_8),
  nodes: worldNodes(
    8,
    [0, 10],
    [
      [3, 6],
      [7, 11],
      [9, 6],
      [14, 5],
    ],
    [4, 13],
  ),
  paths: [
    { from: 'start', to: '8-1', points: poly([0, 10], [2, 10], [2, 6], [3, 6]) },
    { from: '8-1', to: '8-2', points: poly([3, 6], [5, 6], [5, 11], [7, 11]) },
    { from: '8-2', to: '8-3', points: poly([7, 11], [9, 11], [9, 6]) },
    { from: '8-3', to: '8-4', points: poly([9, 6], [14, 6], [14, 5]) },
    { from: '8-2', to: 'bonus-8', points: poly([7, 11], [7, 13], [4, 13]) },
  ],
  // The story goes on: Lost World 1 (a cross-group road, the only one; docs/WORLD_MAP.md).
  exits: [{ from: '8-4', to: 'll-1', side: 'right', points: poly([14, 5], [15, 5]), gate: 'sophia' }],
  actors: [
    actor('podoboo', 184, 176, { height: 44, period: 140 }),
    actor('podoboo', 224, 208, { height: 36, period: 170, phase: 80 }),
    actor('podoboo', 104, 120, { height: 30, period: 150, phase: 40 }),
    actor('smoke', 68, 62, { period: 130 }),
    actor('smoke', 132, 62, { period: 110, phase: 50 }),
    actor('flag', 160, 34),
    actor('flag', 192, 34, { phase: 15 }),
    actor('bullet', 120, 30, { speed: -0.4 }),
  ],
};
