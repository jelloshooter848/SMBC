import type { MapNode, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 2, HYRULE (0.4.24, owner notes 5, 18 and 21: each world is themed after the hero freed
 * there; World 2 is Link's): a Zelda II overworld. Brown mountains along the north, the palace
 * (2-4) set into them, stone ruins by the hidden bonus spot (the Top Secret Area), forests east
 * and west, a lake in the middle (2-2's) draining south to the sea under a bridge, and a
 * graveyard by the start, where the healer stands. Every node, road and bridge is where SEA SIDE
 * had it.
 */
export const SKETCH_2 = [
  '................',
  '................',
  '^^^^^^^^^^^^<U>^', // the palace's roof...
  '55^#H#,#ZZ^^Q@y^', // ...over its columns and door, 2-4's castle node before it; ruins by the bonus spot
  '555######Z,R####',
  '55##,########T55', // plain ground left of 2-1 (Link's map hint)
  '55####~~~~~###55',
  '5T,#*#~~~~~#H#55',
  'T###,#~~~~~###55',
  '5#,J##~~~~~##,55',
  '##J#J#~######T55', // the graveyard; the healer stands on plain ground below the start
  ',#J###=#######55',
  '######~#########',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_2: WorldMapPage = {
  id: 'smb-2',
  group: 'smb',
  label: 'WORLD 2',
  title: 'HYRULE',
  theme: 'hyrule',
  music: 'map',
  tiles: autoShore(SKETCH_2),
  nodes: worldNodes(
    2,
    [0, 10],
    [
      [3, 6],
      [8, 11],
      [12, 8],
      [13, 4],
    ],
    [8, 4],
  )
    // The bonus slot is the Top Secret Area (0.4.10): found by jumping over 2-1's flagpole and
    // walking on past the castle into the Moblin's cave (secret 'bonus-2'; a secret exit only, 2-1's flagpole opens 2-2).
    // Since 0.4.41 JUMP on it walks into Kakariko Village (src/game/town), where the secret house
    // holds the Top Secret Area; once the village is found (secret 'kakariko') the spot is named
    // after it (docs/WORLD_MAP.md).
    .map((n): MapNode =>
      n.kind === 'bonus'
        ? {
            ...n,
            level: '2-top-secret',
            label: 'TOP SECRET AREA',
            town: 'kakariko',
            townLabel: 'KAKARIKO VILLAGE',
          }
        : n,
    ),
  paths: [
    { from: 'start', to: '2-1', points: poly([0, 10], [1, 10], [1, 8], [3, 8], [3, 6]) },
    { from: '2-1', to: '2-2', points: poly([3, 6], [5, 6], [5, 11], [8, 11]) },
    { from: '2-2', to: '2-3', points: poly([8, 11], [12, 11], [12, 8]) },
    { from: '2-3', to: '2-4', points: poly([12, 8], [13, 8], [13, 6], [12, 6], [12, 4], [13, 4]) },
    { from: '2-1', to: 'bonus-2', points: poly([3, 6], [3, 4], [8, 4]) },
  ],
  exits: [{ from: '2-4', to: 'smb-3', side: 'right', points: poly([13, 4], [15, 4]), gate: 'link' }],
  // Hyrule's critters: blobs hopping by the lake and in the east, a fairy over the western
  // forest, river creatures surfacing in the lake and the sea.
  actors: [
    actor('cloud', 60, 18, { size: 1, speed: 0.1 }),
    actor('cloud', 190, 212, { size: 2, speed: 0.14 }),
    actor('blob', 112, 160, { range: 32 }),
    actor('blob', 208, 176, { range: 16, phase: 40 }),
    actor('fairy', 16, 48, { phase: 30 }),
    actor('zora', 128, 112, { period: 260 }),
    actor('zora', 40, 216, { period: 220, phase: 120 }),
  ],
};
