import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';

/*
 * The station's art and sounds by the names the shared brief gives them (sheet `station`, palette
 * `megaman-dark`, songs `mm-station` / `mm-boss`, sounds `boss-fill`, `beam`, `capsule`). They
 * arrive with the station art; until then everything here falls back (rectangles, the brainwashed
 * palette effect, existing songs and sounds) so nothing throws or goes missing.
 */

const SONG_IDS = new Set(songs.map((s) => s.id));
const SFX_IDS = new Set(sfx.map((s) => s.id));

/** A song by id, or `fallback` while it is not in the library yet. */
export function songOr(id: string, fallback: string): string {
  return SONG_IDS.has(id) ? id : fallback;
}

/** A sound by id, or `fallback` while it is not in the library yet. */
export function sfxOr(id: string, fallback: string): string {
  return SFX_IDS.has(id) ? id : fallback;
}

/** The stage loop, the boss loop, a tick of the boss's bar filling, the beam, the capsule. */
export const MM_SOUNDS = {
  stage: () => songOr('mm-station', 'castle'),
  boss: () => songOr('mm-boss', 'keeper'),
  victory: () => songOr('mm-victory', 'castle-clear'),
  fill: () => sfxOr('boss-fill', 'timer-tick'),
  beam: () => sfxOr('beam', 'magic'),
  capsule: () => sfxOr('capsule', 'item-get'),
};

/** Sheet/palette pairs that failed to load, per registry, so a missing one is tried only once. */
const missing = new WeakMap<AssetRegistry, Set<string>>();

/** A sheet in a palette, or null while the sheet or the palette does not exist. */
export function trySheet(assets: AssetRegistry, id: string, palette?: string): SpriteSheet | null {
  const key = `${id}@${palette ?? ''}`;
  const known = missing.get(assets);
  if (known?.has(key)) return null;
  try {
    if (typeof assets.has === 'function' && !assets.has(id)) throw new Error('no sheet');
    return assets.sheet(id, palette);
  } catch {
    if (known) known.add(key);
    else missing.set(assets, new Set([key]));
    return null;
  }
}

/**
 * Draws `frame` of the station sheet at (x, y), or runs `fallback` (rectangles) while the sheet
 * or that frame is missing.
 */
export function drawStation(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  flip: boolean,
  fallback: () => void,
): void {
  const sheet = trySheet(assets, 'station');
  if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y, flip);
  else fallback();
}

/** Mega Man's sheet in Dark Mega Man's palette (`megaman-dark`), else the brainwashed trance. */
export function darkSheet(assets: AssetRegistry): SpriteSheet | null {
  return trySheet(assets, 'megaman', 'megaman-dark') ?? trySheet(assets, 'megaman', 'megaman~brainwashed');
}
