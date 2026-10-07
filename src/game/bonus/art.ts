import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { ItemId } from './items';
import type { CardFace, SlotPicture } from './rules';

/*
 * The bonus games' art and sounds, by name, in one place. The pictures come from the `smb3`
 * sheet (chest-closed/open, card-*, slot-<picture>-top/mid/bot, item-*) when it is registered and
 * has the frame; until then each falls back to the built-in items art on simple shapes, so the
 * games are playable before the art lands. Unknown sound ids only warn (AudioManager.sfx).
 */

export const BONUS_MUSIC = { toadHouse: 'toad-house', game: 'bonus-game' } as const;

export const BONUS_SFX = {
  /** A card turned over. */
  flip: 'card-flip',
  /** A reel stopped. */
  stop: 'slot-stop',
  /** A pair matched, a full picture, a chest's prize. */
  win: 'bonus-win',
  /** An item used from the map's Items. */
  use: 'item-use',
  /** Cursor moves. */
  move: 'select',
  /** A miss, a choice that cannot be made. */
  miss: 'bump',
  /** A chest's lid opens. */
  open: 'powerup-appear',
} as const;

/** Card size (px) and slot picture third size. */
export const CARD_W = 16;
export const CARD_H = 24;
export const SLOT_W = 32;
export const SLOT_H = 16;

/** The `smb3` sheet when it is registered and has `frame`, else null (draw the fallback). */
export function smb3(assets: AssetRegistry, frame: string): SpriteSheet | null {
  if (!assets.has('smb3')) return null;
  const sheet = assets.sheet('smb3');
  return sheet.frames.has(frame) ? sheet : null;
}

/** The built-in items sheet's frame for an inventory item. */
const ITEM_FRAME: Readonly<Record<ItemId, string>> = {
  mushroom: 'mushroom',
  flower: 'flower-0',
  star: 'star-0',
  '1up': '1up',
};

/** A 16×16 item icon (`item-<id>` on the smb3 sheet, else the level's own item sprite). */
export function drawItem(r: Renderer, assets: AssetRegistry, item: ItemId, x: number, y: number): void {
  const sheet = smb3(assets, `item-${item}`);
  if (sheet) r.sprite(sheet, `item-${item}`, x, y);
  else r.sprite(assets.sheet('items'), ITEM_FRAME[item], x, y);
}

/** A 16×16 chest, closed or open. */
export function drawChest(r: Renderer, assets: AssetRegistry, open: boolean, x: number, y: number): void {
  const frame = open ? 'chest-open' : 'chest-closed';
  const sheet = smb3(assets, frame);
  if (sheet) return r.sprite(sheet, frame, x, y);
  r.rect(x, y + 3, 16, 13, '#000');
  r.rect(x + 1, y + 4, 14, 11, '#c84c0c');
  r.rect(x + 1, y + 9, 14, 2, '#fca044');
  if (open) {
    r.rect(x + 1, y + 4, 14, 4, '#000');
    r.rect(x, y - 2, 16, 4, '#000');
    r.rect(x + 1, y - 1, 14, 2, '#c84c0c');
  } else {
    r.rect(x, y + 8, 16, 1, '#000');
    r.rect(x + 6, y + 8, 4, 5, '#fca044');
    r.rect(x + 7, y + 10, 2, 2, '#000');
  }
}

/** The spade card back's pattern and the face's frame names. */
export function drawCard(
  r: Renderer,
  assets: AssetRegistry,
  face: CardFace | null,
  x: number,
  y: number,
): void {
  const frame = face ? `card-${face}` : 'card-back';
  const sheet = smb3(assets, frame);
  if (sheet) return r.sprite(sheet, frame, x, y);
  r.rect(x, y, CARD_W, CARD_H, '#000');
  r.rect(x + 1, y + 1, CARD_W - 2, CARD_H - 2, '#fcfcfc');
  if (!face) {
    // A red spade-ish diamond pattern on white.
    r.rect(x + 3, y + 3, CARD_W - 6, CARD_H - 6, '#d82800');
    r.rect(x + 7, y + 6, 2, 12, '#fcfcfc');
    r.rect(x + 5, y + 9, 6, 4, '#fcfcfc');
    return;
  }
  const items = assets.sheet('items');
  if (face === 'coin10' || face === 'coin20') {
    r.sprite(items, 'coin-0', x, y + 1);
    r.text(assets.sheet('font'), face === 'coin10' ? '10' : '20', x, y + 16);
    return;
  }
  drawItem(r, assets, face, x, y + 4);
}

const SLOT_BG: Readonly<Record<SlotPicture, string>> = {
  mushroom: '#f8b8a8',
  flower: '#fcd8a8',
  star: '#b8f8d8',
};

/** One third (0 top, 1 middle, 2 bottom) of a slot picture, 32×16. */
export function drawSlotPiece(
  r: Renderer,
  assets: AssetRegistry,
  pic: SlotPicture,
  third: number,
  x: number,
  y: number,
): void {
  const frame = `slot-${pic}-${['top', 'mid', 'bot'][third] ?? 'mid'}`;
  const sheet = smb3(assets, frame);
  if (sheet) return r.sprite(sheet, frame, x, y);
  // Fallback: the picture's colour with its item on every third, so a full picture still reads.
  r.rect(x, y, SLOT_W, SLOT_H, SLOT_BG[pic]);
  drawItem(r, assets, pic, x + 8, y);
}

/** Toad, 16×24 (the castle's Toad from the items sheet). */
export function drawToad(r: Renderer, assets: AssetRegistry, x: number, y: number, flip = false): void {
  const sheet = smb3(assets, 'toad');
  r.sprite(sheet ?? assets.sheet('items'), 'toad', x, y, flip);
}
