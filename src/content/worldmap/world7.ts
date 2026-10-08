import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly, worldNodes } from './build';

/**
 * World 7, GALUGA ISLAND (0.4.30, owner notes 5, 18 and 21: each world is themed after the hero
 * freed there; World 7 is Bill's): a jungle run-and-gun's island at night. A snowfield bristling
 * with pillboxes runs round the start and 7-1, the enemy base and its defense wall stand beside
 * 7-1, the jungle fills the middle round 7-2, cliffs and a waterfall rise over 7-3 with the river
 * below, the energy zone's pylons line the road down to 7-4 and Red Falcon's alien lair looms
 * over 7-4, the island's cliffs over the sea along the bottom. Every node and road is where
 * CANNON COAST had them. On this page T is jungle and X a pillbox in the snow (render.ts
 * THEME_TILE_FRAMES).
 */
export const SKETCH_7 = [
  '................',
  '................',
  'jjjjjjΓΠΔhh^CC≡≡', // the snowfield's ridge, the enemy base's battlements, cliffs and the falls
  'oXooooΣΞΦ^C##C~~', // the base's wall and gate beside 7-1; the falls' pool, the river below
  'SooXSooX#######~',
  'XoooXoST#YTЖ###~', // the snowfield's pillboxes; the energy zone's pylons by 7-3
  'oooSooTY#TY##Ж#~',
  'o#ooT####Y#####~', // the jungle round 7-2
  'SoTYTY##TY#◤◆◥#~', // Red Falcon's lair's horns...
  'TYTTYT##YT#◣●◢##', // ...over its maw, right above 7-4
  'YTYTT###TY######',
  'TYTYY#YTYTYTYTYT',
  'KKKKKKKKKKKKKKKK', // the island's cliffs over the sea
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const WORLD_7: WorldMapPage = {
  id: 'smb-7',
  group: 'smb',
  label: 'WORLD 7',
  title: 'GALUGA ISLAND',
  theme: 'contra',
  music: 'map',
  tiles: autoShore(SKETCH_7),
  nodes: worldNodes(
    7,
    [0, 6],
    [
      [4, 3],
      [7, 7],
      [11, 4],
      [12, 10],
    ],
    [5, 11],
  ),
  paths: [
    { from: 'start', to: '7-1', points: poly([0, 6], [2, 6], [2, 3], [4, 3]) },
    { from: '7-1', to: '7-2', points: poly([4, 3], [5, 3], [5, 7], [7, 7]) },
    { from: '7-2', to: '7-3', points: poly([7, 7], [8, 7], [8, 4], [11, 4]) },
    { from: '7-3', to: '7-4', points: poly([11, 4], [12, 4], [12, 7], [10, 7], [10, 10], [12, 10]) },
    { from: '7-2', to: 'bonus-7', points: poly([7, 7], [7, 10], [5, 10], [5, 11]) },
  ],
  exits: [{ from: '7-4', to: 'smb-8', side: 'right', points: poly([12, 10], [15, 10]), gate: 'bill' }],
  // Bill's world's critters: weapon capsules flying over the island, soldiers running by the base
  // and through the jungle and a helicopter crossing the sky.
  actors: [
    actor('chopper', 200, 26, { speed: -0.45 }),
    actor('capsule', 40, 28, { speed: 0.5, amp: 3 }),
    actor('capsule', 150, 200, { speed: -0.35, amp: 6, phase: 60 }),
    actor('soldier', 0, 56, { range: 16, speed: 0.3 }),
    actor('soldier', 96, 68, { range: 16, speed: 0.35 }),
    actor('soldier', 8, 140, { range: 40, speed: 0.5 }),
    actor('soldier', 160, 176, { range: 64, speed: 0.45 }),
  ],
};
