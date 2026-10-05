import type { WorldMapPage } from '@game/map/types';
import { WORLD_1 } from './world1';
import { WORLD_2 } from './world2';
import { WORLD_3 } from './world3';
import { WORLD_4 } from './world4';
import { WORLD_5 } from './world5';
import { WORLD_6 } from './world6';
import { WORLD_7 } from './world7';
import { WORLD_8 } from './world8';

/*
 * The eight themed world map pages (SMB1 worlds 1-8). Every page has: a 'start' node on the left
 * edge where the previous world's road arrives, nodes for levels W-1..W-3 (kind 'level') and W-4
 * (kind 'castle'), paths between consecutive nodes, an exit from the castle off the right edge to
 * the next world (World 8: none) and one hidden bonus node with an unlock key. The tile legend
 * is in render.ts; pages are sketched with plain ground and get their shores from build.ts.
 */
export const MAP_PAGES: WorldMapPage[] = [
  WORLD_1,
  WORLD_2,
  WORLD_3,
  WORLD_4,
  WORLD_5,
  WORLD_6,
  WORLD_7,
  WORLD_8,
];

export function mapPage(world: number): WorldMapPage | undefined {
  return MAP_PAGES.find((p) => p.world === world);
}
