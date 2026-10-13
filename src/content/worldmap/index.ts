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
import { ARENA_PAGE } from './arena';
import { WORLD_1_KINGDOM } from './world1-kingdom';
import { WORLD_2_HYRULE } from './world2-hyrule';
import { WORLD_3_MEGACITY } from './world3-megacity';
import { WORLD_4_ZEBES } from './world4-zebes';
import { WORLD_5_TRANSYLVANIA } from './world5-transylvania';
import { WORLD_6_GALESBURG } from './world6-galesburg';
import { WORLD_7_GALUGA } from './world7-galuga';

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

/** Every page: SMB worlds, the Warp Zone hub, the Lost Levels worlds, the Mini Game Arena. */
export const MAP_PAGES: WorldMapPage[] = [...SMB_PAGES, HUB_PAGE, ...LOST_PAGES, ARENA_PAGE];

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

/**
 * Pages drawn differently in campaign play, by id: drawn from above, World 1 since 0.4.48
 * (world1-kingdom.ts), Worlds 2 and 3 since 0.4.50 (world2-hyrule.ts, world3-megacity.ts), Worlds
 * 4 and 5 since 0.4.52 (world4-zebes.ts, world5-transylvania.ts), Worlds 6 and 7 since 0.4.53
 * (world6-galesburg.ts, world7-galuga.ts). Each keeps its registered page's id, node ids, kinds and
 * order, and exits, so saves and save codes read it exactly as the registered one; its roads keep
 * their ids too, but for a world the campaign plays in another order (map/campaign-order.ts:
 * Worlds 4, 6 and 7), whose roads follow that order.
 */
const CAMPAIGN_LOOKS: Readonly<Record<PageId, WorldMapPage>> = Object.fromEntries(
  [
    WORLD_1_KINGDOM,
    WORLD_2_HYRULE,
    WORLD_3_MEGACITY,
    WORLD_4_ZEBES,
    WORLD_5_TRANSYLVANIA,
    WORLD_6_GALESBURG,
    WORLD_7_GALUGA,
  ].map((p) => [p.id, p]),
);

/** The campaign looks (each also registered under its id in MAP_PAGES, as classic play shows it). */
export const CAMPAIGN_PAGES: readonly WorldMapPage[] = Object.values(CAMPAIGN_LOOKS);

/** `page` as play shows it: its campaign look in campaign play, if it has one, else itself. */
export function pageLook<P extends WorldMapPage | undefined>(page: P, campaign: boolean): P {
  if (!campaign || !page) return page;
  return (CAMPAIGN_LOOKS[page.id] ?? page) as P;
}

/** Every registered page as campaign play has it (pageLook), in MAP_PAGES' order. */
export const CAMPAIGN_MAP_PAGES: readonly WorldMapPage[] = MAP_PAGES.map((p) => CAMPAIGN_LOOKS[p.id] ?? p);

/**
 * The pages the map rules read (rules.clearLevel, openMetExits, warpTo, secretExit, nextStep):
 * campaign play's (CAMPAIGN_MAP_PAGES, whose roads follow the campaign order) or classic play's.
 */
export function rulePages(campaign: boolean): readonly WorldMapPage[] {
  return campaign ? CAMPAIGN_MAP_PAGES : MAP_PAGES;
}
