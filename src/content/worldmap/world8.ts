import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 8, BOWSER'S UNDERWORLD (0.4.31, owner notes 5, 18 and 21: each world is themed after the
 * hero freed there; World 8 is Sophia's). Blaster Master's Underworld has broken into Bowser's land
 * (it was BOWSER'S LAND): his castle and the lava sea stay at 8-4, the real castle and Chapter 1's
 * finale; the rest is the Underworld's surface. Its first area's gnarled forest and stone ruins,
 * cavern mouths, the radioactive pit Jason fell through after his frog (by 8-1), and Sophia's
 * garage below the castle (she waits under 8-4); mutants hop and fly about. Every node and road
 * is where BOWSER'S LAND had them. On this page T is a gnarled tree (render.ts THEME_TILE_FRAMES).
 * Its gate opens east: once 8-4 is beaten (after the ending), a road leads off the right edge on
 * to Lost World 1 (0.4.7: the Lost Levels are the story's extension).
 */
export const SKETCH_8 = [
  '................',
  '................',
  '...........V.V..',
  '..........VWVWV.',
  'hhhhhhhhhhWWWWWh',
  'TT∩TШT∩T^#WWWWG#', // forest, cavern mouths and ruins; Bowser's castle at 8-4
  '#R##############',
  'TШ#T∩#╭╮T##⌂#R#R', // the radioactive pit by 8-1; Sophia's garage below the castle
  'T^#ШT#╰╯Ш#######',
  'ШT#T^#TT∩#~~~~~~', // Bowser's lava sea
  '###T^#Ш^T#~~~~~~',
  'T#T∩T#####~~~~~~',
  'T^TШ∩TR#T#~~~~~~',
  'T∩T#####Ш#~~~~~~',
  'TTШT^TTTT#~~~~~~',
];

export const WORLD_8: WorldMapPage = {
  id: 'smb-8',
  group: 'smb',
  label: 'WORLD 8',
  title: "BOWSER'S UNDERWORLD",
  theme: 'blaster',
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
  // Bowser's podoboos leap from the lava and his flags fly on the castle; the Underworld's mutants
  // hop through the forest and flit over it.
  actors: [
    actor('podoboo', 184, 176, { height: 44, period: 140 }),
    actor('podoboo', 224, 208, { height: 36, period: 170, phase: 80 }),
    actor('flag', 160, 34),
    actor('flag', 192, 34, { phase: 15 }),
    actor('mutant-hopper', 8, 196, { range: 24, speed: 0.25, period: 56 }),
    actor('mutant-hopper', 96, 148, { range: 16, speed: 0.2, period: 64 }),
    actor('mutant-flyer', 40, 28, { speed: 0.4, amp: 3 }),
    actor('mutant-flyer', 120, 52, { speed: -0.3, amp: 4, phase: 50 }),
  ],
};
