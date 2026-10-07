import type { WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';
import { HUB_ARENA_PAD } from './arena';

/*
 * The Warp Zone hub: the space between worlds, reached from World 1's warp spot. Violet
 * platforms float in a starry void ('~' in the 'warp' theme), joined by bridges of light, with a
 * walkway of light (':') across the middle. The hero arrives from World 1 on the centre node,
 * which is also the warp back (RETURN TO WORLD 1: a start node carrying `to`, so arriving never
 * warps and JUMP does); four pads sit one in each direction:
 *
 *   east   MINI GAME ARENA (0.5.0; always open), paired 1:1 with the arena's Return pad
 *   north, south, west   ??? (future secrets; `requires: 'never'`)
 *
 * The east pad led to the Lost Levels (after SMB 8-4) until 0.5.0; the Lost Levels are reached
 * from World 8 now (docs/WORLD_MAP.md), and the pad is the arena's (src/content/worldmap/arena.ts).
 *
 * Room for more pads: the centre offers all four directions already, so new pads hang off the
 * north and south pads, west or east along their platforms: (4,3), (10,3), (4,13) and (10,13) are free
 * walkable ground kept for that. Crystals ('A', '*') stay on the middle platform, off the roads.
 * docs/WORLD_MAP.md has the node and warp contract.
 */
export const SKETCH_HUB = [
  '................',
  '................',
  '~s~~~~~~~~~~~~x~',
  '~~~#########~D~~',
  '~~~#########~~~~',
  'x~~~~~~I~~~~~s~~',
  '~~~~#######~~~~x',
  '~##~#A*:*A#~##~~',
  '~##=#:::::#=##~~',
  '~##~#A,:,A#~##~~',
  '~~~~#######~~~~~',
  'x~~~~~~I~~~~~~s~',
  '~~~#########~~~~',
  '~s~#########~x~~',
  '~~~~~~~~~~~~~~~~',
];

/** A mystery pad: shown and walkable, never works (yet). */
const mystery = (id: string, x: number, y: number) =>
  ({ id, kind: 'warp', x, y, to: 'hub', requires: 'never', hint: '??? - A FUTURE SECRET' }) as const;

export const HUB_PAGE: WorldMapPage = {
  id: 'hub',
  group: 'hub',
  label: 'WARP ZONE',
  title: 'STARLIGHT CROSSING',
  theme: 'warp',
  music: 'map',
  tiles: autoShore(SKETCH_HUB),
  nodes: [
    // The arrival point and the warp home in one.
    { id: 'start', kind: 'start', x: 7, y: 8, to: 'smb-1', toNode: 'bonus-1', label: 'RETURN TO WORLD 1' },
    mystery('warp-mystery-3', 1, 8),
    {
      id: HUB_ARENA_PAD,
      kind: 'warp',
      x: 13,
      y: 8,
      to: 'arena', // lands on the arena's Return pad (its start), which warps back here
      label: 'MINI GAME ARENA',
    },
    mystery('warp-mystery-1', 7, 3),
    mystery('warp-mystery-2', 7, 13),
  ],
  paths: [
    { from: 'start', to: 'warp-mystery-3', points: poly([7, 8], [1, 8]) },
    { from: 'start', to: HUB_ARENA_PAD, points: poly([7, 8], [13, 8]) },
    { from: 'start', to: 'warp-mystery-1', points: poly([7, 8], [7, 3]) },
    { from: 'start', to: 'warp-mystery-2', points: poly([7, 8], [7, 13]) },
  ],
  exits: [],
  actors: [
    actor('star', 40, 84, { phase: 0 }),
    actor('star', 196, 70, { phase: 60 }),
    actor('star', 148, 86, { phase: 120 }),
    actor('star', 22, 180, { phase: 30 }),
    actor('star', 228, 150, { phase: 90 }),
    actor('star', 100, 184, { phase: 150 }),
    actor('star', 210, 196, { phase: 45 }),
    actor('comet', 60, 34, { speed: 0.45 }),
  ],
};
