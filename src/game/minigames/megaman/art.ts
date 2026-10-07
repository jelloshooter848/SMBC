import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';

/*
 * The station's art and sounds (content/sprites/station.ts, the `megaman-dark` palette,
 * content/music and content/sfx): the names Station Escape uses, in one place.
 */

/** The stage loop, the boss loop, the victory jingle, a notch of the boss's bar, the beam, the capsule, the dink. */
export const MM_SOUNDS = {
  stage: 'mm-station',
  boss: 'mm-boss',
  victory: 'castle-clear',
  fill: 'boss-fill',
  beam: 'beam',
  capsule: 'capsule',
  /** A shot bouncing off a Met's hard hat. */
  dink: 'dink',
} as const;

/** Dark Mega Man's palette on Mega Man's sheet. */
export const DARK_PALETTE = 'megaman-dark';
/** A station robot struck by a shot. */
export const FLASH_PALETTE = 'station-flash';

/** The station sheet, in its own palette or `palette`. */
export function stationSheet(assets: AssetRegistry, palette?: string): SpriteSheet {
  return assets.sheet('station', palette);
}

/**
 * Draws `frame` of the station sheet at (x, y). The station's robots face left: `flip` turns them
 * right.
 */
export function drawStation(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  flip = false,
  palette?: string,
  flipY = false,
): void {
  r.sprite(stationSheet(assets, palette), frame, x, y, flip, flipY);
}

/** Mega Man's sheet in Dark Mega Man's palette. */
export function darkSheet(assets: AssetRegistry): SpriteSheet {
  return assets.sheet('megaman', DARK_PALETTE);
}
