import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 5, TRANSYLVANIA (0.4.28, owner notes 5, 18 and 21: each world is themed after the hero
 * freed there; World 5 is Simon's): a Castlevania-style night map. The moon hangs over the ridge;
 * a village stands by the start, a graveyard by 5-1 and the bonus spot, a dead forest on the moor,
 * a river and a moonlit lake run under the bridges, the clock tower rises by 5-3 and Dracula's
 * castle stands on its crag right under 5-4. Every node, road and bridge is where SKY TREES had
 * them.
 */
export const SKETCH_5 = [
  '................',
  '................',
  'hhhhhhhhhhhhhDhh', // the moon over the ridge
  '#Ħ##~~#J##~#T#T#', // the village by the start; a grave by 5-1
  '#ĦĦ#~~####=###T#',
  '####==#J##~#####',
  '##Ħ#~~#J##~#####', // (the start's local stands at 1,6)
  '####~~####~~~~I~', // the river and the lake under the bridges
  '~~~~~~~~I~~~~~I~',
  '~~~~~~~~I~~#####',
  '####~~#######T##',
  'T#T#~~#J#J#Ω####', // the clock tower by 5-3...
  '#T##~~##J##║#╔╦╗', // ...and Dracula's castle on its crag right under 5-4
  'T#T#~~#J#T##T╚╩╝',
  '#T##~~##T#T#####',
];

export const WORLD_5: WorldMapPage = {
  id: 'smb-5',
  group: 'smb',
  label: 'WORLD 5',
  title: 'TRANSYLVANIA',
  theme: 'transylvania',
  music: 'map',
  tiles: autoShore(SKETCH_5),
  nodes: worldNodes(
    5,
    [0, 5],
    [
      [8, 4],
      [13, 5],
      [12, 9],
      [14, 11],
    ],
    [7, 10],
  ),
  paths: [
    { from: 'start', to: '5-1', points: poly([0, 5], [6, 5], [6, 4], [8, 4]) },
    { from: '5-1', to: '5-2', points: poly([8, 4], [12, 4], [12, 5], [13, 5]) },
    { from: '5-2', to: '5-3', points: poly([13, 5], [14, 5], [14, 9], [12, 9]) },
    { from: '5-3', to: '5-4', points: poly([12, 9], [12, 11], [14, 11]) },
    { from: '5-1', to: 'bonus-5', points: poly([8, 4], [8, 10], [7, 10]) },
  ],
  exits: [{ from: '5-4', to: 'smb-6', side: 'right', points: poly([14, 11], [15, 11]), gate: 'simon' }],
  // Transylvania's creatures: bats round the village and the castle, Medusa heads drifting in
  // waves over the ridge and the moor, ravens over the graves and the dead forest.
  actors: [
    actor('bat', 40, 36, {}),
    actor('bat', 180, 200, { phase: 70 }),
    actor('medusa', 200, 36, { speed: -0.4, amp: 8 }),
    actor('medusa', 60, 210, { speed: -0.35, amp: 10, phase: 300 }),
    actor('raven', 100, 48, { range: 48, speed: 0.35 }),
    actor('raven', 8, 216, { range: 32, speed: 0.3, phase: 120 }),
  ],
};
