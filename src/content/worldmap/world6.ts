import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 6, DRAGON VALLEY (0.4.29, owner notes 5, 18 and 21: each world is themed after the hero
 * freed there; World 6 is Ryu's): a ninja game's night map under a full moon. The Hayabusa
 * village and its dojo stand by the start, a bamboo forest runs round 6-1, the night city's
 * rooftops and neon signs crowd round 6-2, snowy mountain passes rise round 6-3 (SNOW NIGHT's snow,
 * kept) and the demon temple, Jaquio's fortress, looms over 6-4. Every node and road is where
 * SNOW NIGHT had them. On this page T is bamboo, Ħ a village house, 0 the city's rooftops and D the
 * full moon (render.ts THEME_TILE_FRAMES).
 */
export const SKETCH_6 = [
  '................',
  '................',
  '.s..x....D...s.x', // the full moon over the city
  'hhhh0¤¤##0jjj▛▀▜', // the skyline, open behind Ryu's silhouette by 6-2; the temple's roofs...
  'TTTT#######^S▙▄▟', // ...over its walls and gate, right above 6-4
  'TTTT#0¤#00#S^###',
  'TTTT############',
  'TT###TT¤0¤,S#o#S', // the bamboo forest round 6-1
  'TT#T#Tabdf#S#^#S',
  'TT#T,Tgilm#S###^', // a moonlit pond
  'ĦT#,#Tprtv#^#So^',
  '###Ħ⌐¬,T##S^#S^o', // the Hayabusa village and its dojo by the start
  'Ħ#Ħ,#########oS^',
  'Ħ,ĦTT,T,S^o^S^oS',
  ',Ħ,TTT,T^So^S^o^',
];

export const WORLD_6: WorldMapPage = {
  id: 'smb-6',
  group: 'smb',
  label: 'WORLD 6',
  title: 'DRAGON VALLEY',
  theme: 'ninja',
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
  // Ryu's world's creatures: hawks wheeling over the skyline and the snowy passes, a ninja leaping
  // from rooftop to rooftop along the city's skyline and the masked ninja's silhouette watching
  // from the temple's roof; a few stars twinkle by the moon.
  actors: [
    actor('star', 40, 28, { phase: 20 }),
    actor('star', 184, 30, { phase: 90 }),
    actor('hawk', 8, 24, { range: 48, period: 420 }),
    actor('hawk', 136, 208, { range: 88, period: 480, phase: 100 }),
    actor('ninja', 64, 37, { range: 32, period: 150, height: 13 }),
    actor('masked-ninja', 210, 50, {}),
  ],
};
