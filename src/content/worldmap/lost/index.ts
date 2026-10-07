import type { WorldMapPage } from '@game/map/types';
import { LL_1 } from './world1';
import { LL_2 } from './world2';
import { LL_3 } from './world3';
import { LL_4 } from './world4';
import { LL_5 } from './world5';
import { LL_6 } from './world6';
import { LL_7 } from './world7';
import { LL_8 } from './world8';
import { LL_9 } from './world9';
import { LL_A } from './worldA';
import { LL_B } from './worldB';
import { LL_C } from './worldC';
import { LL_D } from './worldD';

/*
 * The thirteen Lost Levels map pages in play order ('ll-1'..'ll-9', then 'll-10'..'ll-13' for
 * worlds A-D), group 'll'; the registry (../index.ts) spreads this list after the hub. Each is a
 * new layout in one of the SMB map themes. Every page has: a 'start' node on the left edge,
 * nodes ll-W-1..ll-W-3 (kind 'level') and the ll-W-4 castle, and paths between them. They are the
 * story's extension (0.4.7): SMB World 8's castle road arrives at World 1's start (walking left
 * off it goes back there), and each castle's exit opens the next page, in play order:
 *   1 -> 2 -> ... -> 8 -> 9 -> A -> B -> C -> D, the castle's exit off the right edge.
 * D ends at its castle (the final ending). No page has a warp node; the Lost Levels' own warp
 * zones still warp as on the NES (level/lost-campaign.ts).
 */
export const LOST_PAGES: WorldMapPage[] = [
  LL_1,
  LL_2,
  LL_3,
  LL_4,
  LL_5,
  LL_6,
  LL_7,
  LL_8,
  LL_9,
  LL_A,
  LL_B,
  LL_C,
  LL_D,
];
