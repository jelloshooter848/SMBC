import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';

/*
 * The Warp Zone hub (0.4.0), reached from World 1's warp spot once the campaign's 1-2 warp
 * zone pipe has been taken (secret 'bonus-1'). PLACEHOLDER look (World 3's night theme): the
 * hub art pass replaces the sketch, theme and actors, keeping the node ids, kinds and warp
 * fields (docs/WORLD_MAP.md). The centre, where the hero arrives from World 1, is itself the
 * warp back there (a start node carrying `to`: arriving never warps, JUMP does). Pads around it:
 * the Lost Levels (north, after SMB 8-4) and three mystery pads for future secrets.
 */
export const SKETCH_HUB = [
  '................',
  '................',
  '..s..x...s.D..x.',
  'hjjhjhhjjhjhhjjh',
  '#S,#####,###S#,#',
  '#,T####S###T#,S#',
  ',#S#,#####,#S#,#',
  '#T######,######T',
  '#,##############',
  'S#T#####,####T#S',
  '#,#S###,####S#,#',
  ',T######,#####T,',
  '################',
  '~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~',
];

export const HUB_PAGE: WorldMapPage = {
  id: 'hub',
  group: 'hub',
  label: 'WARP ZONE',
  title: 'SECRET HUB',
  theme: 'night',
  music: 'map',
  tiles: autoShore(SKETCH_HUB),
  nodes: [
    { id: 'start', kind: 'start', x: 8, y: 8, to: 'smb-1', toNode: 'bonus-1', label: 'RETURN TO WORLD 1' },
    {
      id: 'lost',
      kind: 'warp',
      x: 8,
      y: 5,
      to: 'll-1',
      requires: 'gameCleared',
      label: 'LOST LEVELS',
      hint: 'LOST LEVELS - BEAT 8-4 TO UNLOCK',
    },
    {
      id: 'mystery-1',
      kind: 'warp',
      x: 13,
      y: 8,
      to: 'hub',
      requires: 'never',
      hint: '??? - A FUTURE SECRET',
    },
    {
      id: 'mystery-2',
      kind: 'warp',
      x: 8,
      y: 11,
      to: 'hub',
      requires: 'never',
      hint: '??? - A FUTURE SECRET',
    },
    {
      id: 'mystery-3',
      kind: 'warp',
      x: 3,
      y: 8,
      to: 'hub',
      requires: 'never',
      hint: '??? - A FUTURE SECRET',
    },
  ],
  paths: [
    { from: 'start', to: 'lost', points: poly([8, 8], [8, 5]) },
    { from: 'start', to: 'mystery-1', points: poly([8, 8], [13, 8]) },
    { from: 'start', to: 'mystery-2', points: poly([8, 8], [8, 11]) },
    { from: 'start', to: 'mystery-3', points: poly([8, 8], [3, 8]) },
  ],
  exits: [],
  actors: [actor('star', 40, 40, { phase: 10 }), actor('star', 200, 56, { phase: 40 })],
};
