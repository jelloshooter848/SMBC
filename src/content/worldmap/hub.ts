import type { MapNode, WorldMapPage } from '@game/map/types';
import { actor, autoShore, poly } from './build';

/*
 * The Warp Zone hub: the space between worlds, reached from World 1's warp spot. Violet
 * platforms float in a starry void ('~' in the 'warp' theme), joined by bridges of light, with a
 * walkway of light (':') across the middle. The start stands in the middle; four warp pads sit
 * one in each direction:
 *
 *   west   RETURN TO WORLD 1                     east   LOST LEVELS (after SMB 8-4 is beaten)
 *   north  ??? (a future secret)                 south  ??? (a future secret)
 *
 * Room for more pads: the start offers all four directions already, so new pads hang off the
 * mystery pads, west or east along their platforms: (4,3), (10,3), (4,13) and (10,13) are free
 * walkable ground kept for that. Crystals ('A', '*') stay on the middle platform, off the roads.
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

/** A warp pad: where it leads, what opens it (a save flag; 'never' = not yet) and its hint. */
export interface HubNode extends Omit<MapNode, 'kind'> {
  kind: 'start' | 'warp';
  /** Page id the pad leads to. */
  to?: string;
  /** Save flag that opens the pad. */
  requires?: string;
  /** Spoken / shown when the hero stands on the pad. */
  hint?: string;
}

/**
 * The hub page as drawn here. TODO(H0): the engine's string page ids replace `world` (this page
 * is id 'hub', label 'WARP ZONE', group 'hub') and MapNode gains kind 'warp'; at merge this
 * becomes a plain WorldMapPage.
 */
export interface HubPageDraft extends Omit<WorldMapPage, 'nodes'> {
  id: 'hub';
  label: string;
  group: 'hub';
  nodes: HubNode[];
}

export const HUB_PAGE: HubPageDraft = {
  id: 'hub',
  label: 'WARP ZONE',
  group: 'hub',
  world: 0, // TODO(H0): placeholder until pages are keyed by id
  title: 'WARP ZONE',
  theme: 'warp',
  music: 'map',
  tiles: autoShore(SKETCH_HUB),
  nodes: [
    { id: 'start', kind: 'start', x: 7, y: 8 },
    { id: 'warp-world-1', kind: 'warp', x: 1, y: 8, to: 'smb-1', hint: 'RETURN TO WORLD 1' },
    {
      id: 'warp-lost',
      kind: 'warp',
      x: 13,
      y: 8,
      to: 'll-1',
      requires: 'gameCleared',
      hint: 'LOST LEVELS - BEAT 8-4 TO UNLOCK',
    },
    { id: 'warp-mystery-1', kind: 'warp', x: 7, y: 3, requires: 'never', hint: '??? - A FUTURE SECRET' },
    { id: 'warp-mystery-2', kind: 'warp', x: 7, y: 13, requires: 'never', hint: '??? - A FUTURE SECRET' },
  ],
  paths: [
    { from: 'start', to: 'warp-world-1', points: poly([7, 8], [1, 8]) },
    { from: 'start', to: 'warp-lost', points: poly([7, 8], [13, 8]) },
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
