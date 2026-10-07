import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { ItemId } from './items';
import type { CardFace, SlotPicture } from './rules';

/** The SMB3 art's sheet (content/sprites/smb3.ts). */
const SMB3_SHEET = 'smb3';

/*
 * The bonus games' art and sounds, by name, in one place. The pictures are the `smb3` sheet's
 * (chest-closed/open, card-*, slot-<picture>-top/mid/bot, item-*); Toad is the items sheet's.
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

/** The SMB3 art's sheet (content/sprites/smb3.ts). */
function smb3(assets: AssetRegistry): SpriteSheet {
  return assets.sheet(SMB3_SHEET);
}

/** A 16×16 item icon (`item-<id>`). */
export function drawItem(r: Renderer, assets: AssetRegistry, item: ItemId, x: number, y: number): void {
  r.sprite(smb3(assets), `item-${item}`, x, y);
}

/** A 16×16 chest, closed or open. */
export function drawChest(r: Renderer, assets: AssetRegistry, open: boolean, x: number, y: number): void {
  r.sprite(smb3(assets), open ? 'chest-open' : 'chest-closed', x, y);
}

/** A 16×24 spade card: its back, or face up. */
export function drawCard(
  r: Renderer,
  assets: AssetRegistry,
  face: CardFace | null,
  x: number,
  y: number,
): void {
  r.sprite(smb3(assets), face ? `card-${face}` : 'card-back', x, y);
}

/** One third (0 top, 1 middle, 2 bottom) of a slot picture, 32×16. */
export function drawSlotPiece(
  r: Renderer,
  assets: AssetRegistry,
  pic: SlotPicture,
  third: number,
  x: number,
  y: number,
): void {
  r.sprite(smb3(assets), `slot-${pic}-${['top', 'mid', 'bot'][third] ?? 'mid'}`, x, y);
}

/** Toad, 16×24 (the castle's Toad on the items sheet). */
export function drawToad(r: Renderer, assets: AssetRegistry, x: number, y: number, flip = false): void {
  r.sprite(assets.sheet('items'), 'toad', x, y, flip);
}
