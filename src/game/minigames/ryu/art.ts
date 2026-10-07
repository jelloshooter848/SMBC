import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';

/*
 * Shadow Duel's art and sounds, in one place: the `ninja` sheet (content/sprites, drawn for the
 * 6-2 dojo and this mini game) and the Ninja Gaiden-style songs and sounds. Until a frame or a
 * palette exists the pieces draw as plain boxes in their colours, and an unknown song or sound
 * plays nothing, so nothing here ever throws.
 */

/** The cutscene sting, the stage loop, the Masked Ninja, the win jingle, and the sounds. */
export const NG_SOUNDS = {
  cutscene: 'ng-cutscene',
  stage: 'ng-stage',
  boss: 'ng-boss',
  victory: 'castle-clear',
  lantern: 'candle',
  slash: 'slash',
  hawk: 'hawk',
  clang: 'clang',
  knife: 'boomerang',
  bark: 'bump',
  item: 'powerup',
  star: 'buster',
} as const;

/** The sheet and its hit-flash palette. */
export const NINJA_SHEET = 'ninja';
export const NINJA_FLASH = 'ninja-flash';
/** The afterimage's palette. */
export const NINJA_GHOST = 'ninja-ghost';
/** The tile theme the stage is drawn in: the moonlit town (its music is `ng-stage`). */
export const STAGE_THEME = 'ninja-night';

/*
 * The sheet's conventions: creatures and the Masked Ninja face LEFT (flip for right); standing
 * frames rest on their bottom row, airborne ones (the hawks, `masked-ninja-2`) are centred;
 * lanterns hang from their top row; `cut-ryu-*` face right, `cut-masked-*` left (frame 0 the
 * leap, 1 the strike).
 */

/** A box drawn in place of a frame not drawn yet: outer colour, inner colour. */
export type Fallback = readonly [string, string];

function ninjaSheet(assets: AssetRegistry, palette?: string): SpriteSheet | null {
  try {
    if (!assets.has(NINJA_SHEET)) return null;
    return assets.sheet(NINJA_SHEET, palette);
  } catch {
    // A palette not defined yet: the sheet's own colours.
    try {
      return palette ? assets.sheet(NINJA_SHEET) : null;
    } catch {
      return null;
    }
  }
}

/** Whether the ninja sheet has `frame` (the rest draws boxes). */
export function hasNinjaFrame(assets: AssetRegistry, frame: string): boolean {
  return ninjaSheet(assets)?.frames.has(frame) ?? false;
}

/** How a ninja-sheet piece is drawn: flipped, in the hit flash, or as the afterimage. */
export type NinjaLook = 'plain' | 'flash' | 'ghost';

/**
 * Draws `frame` of the ninja sheet with its top-left at (x, y), or a `w`×`h` box in `fallback`'s
 * colours while the frame does not exist. `look` 'flash' uses the hit-flash palette (callers skip
 * it with reduce flashing), 'ghost' the afterimage's.
 */
export function drawNinja(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: Fallback,
  flip = false,
  look: NinjaLook = 'plain',
): void {
  const palette = look === 'flash' ? NINJA_FLASH : look === 'ghost' ? NINJA_GHOST : undefined;
  const sheet = ninjaSheet(assets, palette);
  if (sheet?.frames.has(frame)) {
    r.sprite(sheet, frame, x, y, flip);
    return;
  }
  const [outer, inner] =
    look === 'flash'
      ? (['#fcfcfc', '#fcfcfc'] as const)
      : look === 'ghost'
        ? (['#3c1c7c', '#6c4cbc'] as const)
        : fallback;
  r.rect(x, y, w, h, outer);
  if (w > 2 && h > 2) r.rect(x + 1, y + 1, w - 2, h - 2, inner);
}
