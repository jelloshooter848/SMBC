/**
 * SMB3 bonus games and the item inventory (docs/BONUS.md). Public API for the World 4 bonus spot
 * (L1: its map node, the Hammer Bro and the "bonus open" state) and everything else:
 *
 * State (on `Game.bonus`, saved field for field on the file, see `BonusState` in items.ts):
 *   - `game.bonus.inventory: ItemId[]` ('mushroom' | 'flower' | 'star' | '1up'), at most 12.
 *   - `game.bonus.inventoryUnlocked`: set it (and `game.autosave()`) when Larry is beaten; the
 *     map menu's Items entry and the ITEMS button (the special action) appear.
 *   - `game.bonus.bonusOpen`: the bonus spot can be played. L1 owns it: set when Larry is beaten
 *     or the Hammer Bro is, clear when a bonus game ends. Nothing in this folder reads it.
 *   - `game.bonus.bonusNext`: the rotation (0 Toad House, 1 N-spade, 2 spade game).
 *   - `game.bonus.devInventory`: dev mode's map menu "Item inventory" (unlocks while dev is on).
 *   - `game.bonus.starNext`: a Starman used from the map waits for the next level's start.
 *
 * Opening a bonus game (push it over the map; it pops itself):
 *   - `openNextBonus(game, onDone)`: plays the next game in the rotation and advances it (saved
 *     at once, so giving up cannot reroll the game). This is what the bonus node should call.
 *   - `openBonusGame(game, kind, onDone, opts?)`: one game of `kind` without touching the
 *     rotation. `opts.seed` fixes the deal (tests); `opts.music` is played when it closes
 *     (default: the map page's music in campaign play, else nothing).
 *   - `nextBonusKind(save | game.bonus)`: which game the rotation plays next.
 *   - `onDone(result: BonusResult)` runs after the scene is gone: `result.prizes` lists what was
 *     won, already given (items in the inventory, or used at once when it is full; lives and coins
 *     counted) and saved; `result.gaveUp` when the player chose Give up from its menu (prizes won
 *     before that are kept). Every ending counts as the bonus played.
 *
 * Items:
 *   - `useInventoryItem(game, index)`: the Items panel's use (also usable by other code).
 *   - `useItem(game, item)`, `awardPrize(game, prize)`, `inventoryAvailable(game)`.
 *   - `InventoryScene`: the panel; the world map opens it.
 */
import type { Scene } from '@engine/scene';
import { mapPage } from '@content/worldmap';
import { freshSeed } from '../world/world';
import type { Game } from '../scenes/game';
import type { BonusResult, BonusScene } from './common';
import { MemoryScene } from './memory';
import { BONUS_KINDS, nextBonusKind, type BonusKind } from './rules';
import { SlotsScene } from './slots';
import { ToadHouseScene } from './toad-house';

export type { BonusResult } from './common';
export type { BonusKind, BonusPrize, CardFace, SlotPicture } from './rules';
export { BONUS_KINDS, BONUS_TITLES, isBonusKind, nextBonusKind } from './rules';
export type { BonusState, ItemId } from './items';
export { INVENTORY_MAX, ITEM_IDS, ITEM_NAMES, newBonusState } from './items';
export { awardPrize, inventoryAvailable, useInventoryItem, useItem } from './use';
export { InventoryScene } from './inventory';
export { ToadHouseScene } from './toad-house';
export { MemoryScene } from './memory';
export { SlotsScene } from './slots';

export interface BonusOptions {
  /** The deal's seed (chest contents, the card layout, the reels' start); default: a fresh one. */
  seed?: number;
  /** Music to play once the game closes; null for none. Default: the map page's music (campaign). */
  music?: string | null;
}

/** One bonus game scene of `kind` (not pushed). */
export function createBonusScene(
  game: Game,
  kind: BonusKind,
  seed: number,
  onEnd: (r: BonusResult) => void,
): BonusScene {
  switch (kind) {
    case 'toad-house':
      return new ToadHouseScene(game, seed, onEnd);
    case 'memory':
      return new MemoryScene(game, seed, onEnd);
    case 'slots':
      return new SlotsScene(game, seed, onEnd);
  }
}

/**
 * Pushes one bonus game of `kind`. When it ends, it (and any menu over it) is popped, the music is
 * put back and `onDone` runs once. Returns the scene.
 */
export function openBonusGame(
  game: Game,
  kind: BonusKind,
  onDone: (result: BonusResult) => void,
  opts: BonusOptions = {},
): Scene {
  let finished = false;
  const scene: BonusScene = createBonusScene(game, kind, opts.seed ?? freshSeed(), (result) => {
    if (finished) return;
    finished = true;
    while (game.scenes.depth > 0 && game.scenes.find((s) => s === scene)) game.scenes.pop();
    const audio = game.ctx.audio;
    audio.stopMusic();
    const music =
      opts.music !== undefined
        ? opts.music
        : game.campaign
          ? (mapPage(game.mapProgress.position.page)?.music ?? null)
          : null;
    if (music) audio.playMusic(music);
    onDone(result);
  });
  game.scenes.push(scene);
  return scene;
}

/**
 * The bonus spot's game: the next kind in the rotation (Toad House, N-spade, spade game, ...),
 * advanced and saved before it opens.
 */
export function openNextBonus(
  game: Game,
  onDone: (result: BonusResult) => void,
  opts: BonusOptions = {},
): Scene {
  const kind = nextBonusKind(game.bonus);
  game.bonus.bonusNext = (BONUS_KINDS.indexOf(kind) + 1) % BONUS_KINDS.length;
  game.autosave();
  return openBonusGame(game, kind, onDone, opts);
}
