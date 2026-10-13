import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { WorldMapPage } from '@game/map/types';
import {
  ABOVE_WATER_TICKS,
  aboveRoadCells,
  drawAboveGround,
  drawAboveRoads,
  drawAboveScenery,
  KINGDOM_LOOK,
  type RoadCell,
} from './above-render';

/*
 * World 1's top-down page (theme 'kingdom', campaign play since 0.4.48) by its own names. Since
 * 0.4.50 the drawing is the shared kit for every page drawn from above (above-render.ts); these
 * draw World 1's page from the `kingdom` sheet through it.
 */

export { kingdomNodeFrame, tileReaches, tileShown, type RoadCell, type RoadRun } from './above-render';

/** The river's two frames swap every this many frames. */
export const KINGDOM_WATER_TICKS = ABOVE_WATER_TICKS;

/** Whether a page is drawn top-down from the `kingdom` sheet (World 1; above-render isAbovePage for any). */
export const isKingdomPage = (page: WorldMapPage): boolean => page.theme === 'kingdom';

/** The road tiles of the open roads `runs` on a kingdom page (above-render aboveRoadCells). */
export const kingdomRoadCells = aboveRoadCells;

/** Draws a kingdom page's open roads at page offset `ox` (above-render drawAboveRoads). */
export function drawKingdomRoads(
  r: Renderer,
  assets: AssetRegistry,
  cells: readonly RoadCell[],
  ox: number,
  shown: ReadonlyMap<string, number> | null,
): void {
  drawAboveRoads(r, assets, KINGDOM_LOOK, cells, ox, shown);
}

/** The ground and the flat landmarks (the plaza, the castle's walk) at page offset `ox`. */
export function drawKingdomGround(
  r: Renderer,
  assets: AssetRegistry,
  page: WorldMapPage,
  ox: number,
  t: number,
): void {
  drawAboveGround(r, assets, KINGDOM_LOOK, page, ox, t);
}

/** The standing scenery and landmarks, back to front, at page offset `ox`. */
export function drawKingdomScenery(r: Renderer, assets: AssetRegistry, page: WorldMapPage, ox: number): void {
  drawAboveScenery(r, assets, KINGDOM_LOOK, page, ox);
}
