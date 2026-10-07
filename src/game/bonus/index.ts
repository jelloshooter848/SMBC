/**
 * SMB3 bonus games and the item inventory (docs/BONUS.md). Public API:
 *
 * State (saved on the file, fields of the same names on SaveFile):
 *   - `game.inventoryUnlocked`, `game.bonusOpen`: the World 4 bonus spot's (map/bonus-spot.ts);
 *     Larry's crystal ball unlocks the inventory, the spot closes once used.
 *   - `game.bonus.inventory: ItemId[]` ('mushroom' | 'flower' | 'star' | '1up'), at most 12.
 *   - `game.bonus.bonusNext`: the rotation (0 Toad House, 1 N-spade, 2 spade game).
 *   - `game.bonus.devInventory`: dev mode's map menu "Item inventory" (unlocks while dev is on).
 *   - `game.bonus.starNext`: a Starman used from the map waits for the next level's start.
 *
 * The bonus spot: `spot.ts` registers `SMB3_BONUS` with `registerBonusGame` (the world map
 * imports it), so JUMP on the open node plays the next game in the rotation.
 *
 * Opening a bonus game elsewhere (pushed; it pops itself):
 *   - `openNextBonus(game, onDone)`: the next game in the rotation, advanced once it is played.
 *   - `openBonusGame(game, kind, onDone, opts?)`: one game of `kind` without touching the
 *     rotation. `opts.seed` fixes the deal (tests); `opts.music` is played when it closes
 *     (default: the map page's music in campaign play, else nothing).
 *   - `nextBonusKind(save | game.bonus)`: which game the rotation plays next.
 *   - `onDone(result: BonusResult)` runs after the scene is gone: `result.prizes` lists what was
 *     won, already given (items in the inventory, or used at once when it is full; lives and coins
 *     counted) and saved; `result.gaveUp` when the player chose Give up from its menu (prizes won
 *     before that are kept); `result.played` once any choice was made.
 *
 * Items:
 *   - `useInventoryItem(game, index)`: the Items panel's use (also usable by other code).
 *   - `useItem(game, item)`, `awardPrize(game, prize)`, `awardHammerPrize(game)`,
 *     `inventoryAvailable(game)`.
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
export { awardHammerPrize, awardPrize, inventoryAvailable, useInventoryItem, useItem } from './use';
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

/** The next game in the rotation (Toad House, N-spade, spade game, ...), advanced once it is played. */
export function openNextBonus(
  game: Game,
  onDone: (result: BonusResult) => void,
  opts: BonusOptions = {},
): Scene {
  const kind = nextBonusKind(game.bonus);
  return openBonusGame(
    game,
    kind,
    (result) => {
      if (result.played) {
        game.bonus.bonusNext = (BONUS_KINDS.indexOf(kind) + 1) % BONUS_KINDS.length;
        game.autosave();
      }
      onDone(result);
    },
    opts,
  );
}
