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
 * nodes ll-W-1..ll-W-3 (kind 'level') and the ll-W-4 castle, and paths between them. Only World 1
 * has a 'hub' warp node back to the Warp Zone hub (the hub's Lost Levels pad lands on it, and it
 * lands back on the pad). Roads between pages:
 *   1 -> 2 -> ... -> 8: the castle's exit off the right edge, as in SMB.
 *   8 -> 9: the World 8 castle's exit, behind the condition 'll9' (the file has cleared all 32
 *           levels from 1-1 to 8-4), with a hint showing the count while it is locked.
 *   8 -> A: a warp node 'warp-ll-10' beside the World 8 keep, behind 'llLetters' (the file has
 *           beaten 8-4). It sits on World 8 rather than World 9 because A-D can open
 *           without World 9. It lands on World A's pipe 'warp-ll-8', which leads back to it.
 *   A -> B -> C -> D: castle exits as in SMB. Worlds 9 and D end at their castles.
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
