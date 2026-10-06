import type { PageGroup, PageId, WorldMapPage } from '@game/map/types';
import { WORLD_1 } from './world1';
import { WORLD_2 } from './world2';
import { WORLD_3 } from './world3';
import { WORLD_4 } from './world4';
import { WORLD_5 } from './world5';
import { WORLD_6 } from './world6';
import { WORLD_7 } from './world7';
import { WORLD_8 } from './world8';
import { HUB_PAGE } from './hub';
import { LOST_PAGES } from './lost';

/*
 * The page registry (docs/WORLD_MAP.md). The eight themed SMB pages ('smb-1'..'smb-8'): every
 * one has a 'start' node on the left edge where the previous world's road arrives, nodes for
 * levels W-1..W-3 (kind 'level') and W-4 (kind 'castle'), paths between consecutive nodes, an
 * exit from the castle off the right edge to the next world (World 8: none) and one hidden
 * bonus slot with an unlock key (World 1's is the warp spot to the hub). The tile legend is in
 * render.ts; pages are sketched with plain ground and get their shores from build.ts.
 *
 * Order matters within a group: it is the play order (slide direction, the Worlds menu).
 */
export const SMB_PAGES: WorldMapPage[] = [
  WORLD_1,
  WORLD_2,
  WORLD_3,
  WORLD_4,
  WORLD_5,
  WORLD_6,
  WORLD_7,
  WORLD_8,
];

/** Every page: SMB worlds, the Warp Zone hub, the Lost Levels worlds. */
export const MAP_PAGES: WorldMapPage[] = [...SMB_PAGES, HUB_PAGE, ...LOST_PAGES];

/** The registered page `id`. */
export function mapPage(id: PageId): WorldMapPage | undefined {
  return MAP_PAGES.find((p) => p.id === id);
}

/** Whether `id` names a registered page. */
export function isPageId(id: unknown): id is PageId {
  return typeof id === 'string' && MAP_PAGES.some((p) => p.id === id);
}

/** A group's pages in play order. */
export function pagesInGroup(group: PageGroup): WorldMapPage[] {
  return MAP_PAGES.filter((p) => p.group === group);
}

/** The page a main level's node is on ('1-2' → smb-1, 'll-3-2' → ll-3), by lookup. */
export function levelPage(levelId: string): WorldMapPage | undefined {
  return MAP_PAGES.find((p) => p.nodes.some((n) => n.level === levelId));
}
