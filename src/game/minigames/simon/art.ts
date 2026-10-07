import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';

/*
 * Dracula's Castle's art and sounds, in one place: the `crypt` sheet (content/sprites, drawn for
 * the 5-4 crypt and this mini game) and the Castlevania-style songs and sounds. Until a frame or
 * a palette exists the pieces draw as plain boxes in their colours, and an unknown song or sound
 * plays nothing, so nothing here ever throws.
 */

/** The stage loop, Dracula, his beast form, the win jingle, and the sounds. */
export const CV_SOUNDS = {
  stage: 'cv-stage',
  boss: 'cv-boss',
  beast: 'cv-beast',
  victory: 'castle-clear',
  candle: 'candle',
  teleport: 'dracula-teleport',
  roar: 'beast-roar',
  door: 'door-open',
  item: 'powerup',
  bone: 'fireball',
  fire: 'fireball',
  stomp: 'cannon',
  // The ENEMY bar filling again for the beast.
  refill: 'boss-fill',
} as const;

/** The sheet and its hit-flash palette. */
export const CRYPT_SHEET = 'crypt';
export const CRYPT_FLASH = 'crypt-flash';
/** The tile theme the stage is drawn in. */
export const STAGE_THEME = 'crypt';

/** A box drawn in place of a frame not drawn yet: outer colour, inner colour. */
export type Fallback = readonly [string, string];

function cryptSheet(assets: AssetRegistry, palette?: string): SpriteSheet | null {
  try {
    if (!assets.has(CRYPT_SHEET)) return null;
    return assets.sheet(CRYPT_SHEET, palette);
  } catch {
    // A palette not defined yet: the sheet's own colours.
    try {
      return palette ? assets.sheet(CRYPT_SHEET) : null;
    } catch {
      return null;
    }
  }
}

/** Whether the crypt sheet has `frame` (the rest draws boxes). */
export function hasCryptFrame(assets: AssetRegistry, frame: string): boolean {
  return cryptSheet(assets)?.frames.has(frame) ?? false;
}

/**
 * Draws `frame` of the crypt sheet with its top-left at (x, y), or a `w`×`h` box in `fallback`'s
 * colours while the frame does not exist. `flash` uses the hit-flash palette (callers skip it
 * with reduce flashing).
 */
export function drawCrypt(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: Fallback,
  flip = false,
  flash = false,
): void {
  const sheet = cryptSheet(assets, flash ? CRYPT_FLASH : undefined);
  if (sheet?.frames.has(frame)) {
    r.sprite(sheet, frame, x, y, flip);
    return;
  }
  const [outer, inner] = flash ? (['#fcfcfc', '#fcfcfc'] as const) : fallback;
  r.rect(x, y, w, h, outer);
  if (w > 2 && h > 2) r.rect(x + 1, y + 1, w - 2, h - 2, inner);
}
