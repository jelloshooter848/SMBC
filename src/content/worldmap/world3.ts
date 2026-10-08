import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 3, MEGA CITY (0.4.26, owner notes 5, 18 and 21: each world is themed after the hero freed
 * there; World 3 is Mega Man's): a Mega Man 2-style city map. Dr. Light's lab stands by the start,
 * city blocks fill the streets, Metal Man's gearworks hide the bonus spot, Wood Man's forest grows
 * in the south-west and Flash Man's crystals by 3-3, and Wily's skull fortress stands over the
 * castle between grey crags, a dark harbour to the south-east. Every node and road is where NIGHT
 * HILLS had them.
 */
export const SKETCH_3 = [
  '................',
  '................',
  '000000"""0^^^^^^',
  '0&$#00#""0^^^^^^', // Dr. Light's lab above the first road
  '#####,0#"#^^+?/^', // Wily's towers and skull...
  '0###,#0##"#^;_`^', // ...over its gate, 3-4's castle node below; gearworks by the bonus spot
  '0,0#####000#####', // plain ground left of 3-1 (Mega Man's map hint)
  '00#,#00#0A0#0000',
  'T####0A##A0#####',
  'TT#TT0####0#~~~~',
  '55#5T#,0A###~~~~', // Wood Man's forest; Flash Man's crystals by 3-3
  '55######0A##~~~~',
  '############~~~~',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_3: WorldMapPage = {
  id: 'smb-3',
  group: 'smb',
  label: 'WORLD 3',
  title: 'MEGA CITY',
  theme: 'megaman',
  music: 'map',
  tiles: autoShore(SKETCH_3),
  nodes: worldNodes(
    3,
    [0, 4],
    [
      [4, 6],
      [3, 11],
      [9, 10],
      [13, 6],
    ],
    [8, 5],
  ),
  paths: [
    { from: 'start', to: '3-1', points: poly([0, 4], [4, 4], [4, 6]) },
    { from: '3-1', to: '3-2', points: poly([4, 6], [4, 8], [2, 8], [2, 11], [3, 11]) },
    { from: '3-2', to: '3-3', points: poly([3, 11], [6, 11], [6, 9], [9, 9], [9, 10]) },
    { from: '3-3', to: '3-4', points: poly([9, 10], [11, 10], [11, 6], [13, 6]) },
    { from: '3-1', to: 'bonus-3', points: poly([4, 6], [7, 6], [7, 5], [8, 5]) },
  ],
  exits: [{ from: '3-4', to: 'smb-4', side: 'right', points: poly([13, 6], [15, 6]), gate: 'megaman' }],
  // Mega City's robots: Mets on the streets, propeller bots over the skyline and the harbour.
  actors: [
    actor('cloud', 90, 18, { size: 1, speed: 0.06 }),
    actor('copter', 88, 34, { phase: 0 }),
    actor('copter', 216, 168, { phase: 90 }),
    actor('copter', 200, 36, { phase: 45 }),
    actor('met', 112, 192, { range: 32 }),
    actor('met', 192, 128, { range: 24, phase: 120 }),
  ],
};
