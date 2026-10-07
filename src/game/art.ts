import type { AssetRegistry } from '@engine/assets/registry';
import type { SpriteSheet } from '@engine/gfx/spritesheet';

/**
 * Sheet `id` (in `palette`) when it is registered and has `frame`, else null, so a caller can
 * draw a fallback until the art lands (the SMB3 sheet `smb3`: Larry Koopa, his wand blasts, the
 * crystal ball, the bonus spot's map icons and the map's Hammer Bro). Never throws.
 */
export function sheetWith(
  assets: AssetRegistry,
  id: string,
  frame: string,
  palette?: string,
): SpriteSheet | null {
  if (!assets.has(id)) return null;
  const sheet = assets.sheet(id, palette);
  return sheet.frames.has(frame) ? sheet : null;
}

/** The SMB3 art's sheet id (owned by the SMB3 art work; docs/HEROES.md lists its frames). */
export const SMB3_SHEET = 'smb3';
