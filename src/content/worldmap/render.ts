import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { MapActor, WorldMapPage } from '@game/map/types';

/*
 * PLACEHOLDER drawing for map pages, replaced by the real map art. The engine calls only these
 * three functions, so the art can change without touching it.
 */

/** Background colour behind the tiles. */
export function mapSky(page: WorldMapPage): string {
  return page.theme === 'night' || page.theme === 'snow' || page.theme === 'bowser' ? '#000' : '#5c94fc';
}

/** Draws the tile `ch` of `page` at screen pixel (x, y); `frame` is the animation counter. */
export function drawMapTile(
  r: Renderer,
  _assets: AssetRegistry,
  _page: WorldMapPage,
  ch: string,
  x: number,
  y: number,
  _frame: number,
): void {
  if (ch === '.') return;
  r.rect(x, y, 16, 16, ch === '~' ? '#2038ec' : '#00a800');
}

/** Draws a decorative actor; `frame` is the animation counter. */
export function drawMapActor(
  _r: Renderer,
  _assets: AssetRegistry,
  _page: WorldMapPage,
  _actor: MapActor,
  _frame: number,
): void {}
