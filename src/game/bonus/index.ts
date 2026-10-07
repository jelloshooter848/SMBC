/**
 * SMB3 bonus games and the item inventory (docs/BONUS.md). Public API:
 *
 * State (saved on the file, fields of the same names on SaveFile):
 *   - `game.inventoryUnlocked`, `game.bonusOpen`: the World 4 bonus spot's (map/bonus-spot.ts);
 *     Larry's crystal ball unlocks the inventory, the spot closes once used.
 *   - `game.bonus.inventory: ItemId[]` ('mushroom' | 'flower' | 'star' | '1up'), at most 12.
 *   - `game.bonus.bonusNext`: the rotation (0 Toad House, 1 N-spade, 2 spade game).
 *   - `game.bonus.devInventory`: dev mode's map menu "Item inventory" (unlocks while dev is on).
 *   - `game.bonus.itemsNext`: items used from the map, given at the next level's start to the hero
 *     who enters it (one of each kind).
 *   - `game.bonus.devItems`: dev "Give items", never saved.
 *
 * The bonus spot: `spot.ts` registers `SMB3_BONUS` with `registerBonusGame` (the world map
 * imports it), so JUMP on the open node plays the next game in the rotation; the first choice
 * closes the spot and advances the rotation (saved before any prize).
 *
 * Opening a bonus game elsewhere (pushed; it pops itself):
 *   - `openBonusGame(game, kind, onDone, opts?)`: one game of `kind` without touching the
 *     rotation. `opts.seed` fixes the deal (tests); `opts.music` is played when it closes
 *     (default: the map page's music in campaign play, else nothing).
 *   - `createBonusScene(game, kind, seed, onEnd, onPlayed?)`: the scene alone.
 *   - `nextBonusKind(save | game.bonus)`: which game the rotation plays next.
 *   - `onDone(result: BonusResult)` runs after the scene is gone: `result.prizes` lists what was
 *     won, already given (items in the inventory; lives and coins counted) and saved;
 *     `result.gaveUp` when the player chose Give up from its menu (prizes won before that are
 *     kept; there is no menu once the outcome is decided); `result.played` once any choice was made.
 *
 * Items:
 *   - `useInventoryItem(game, index)`: the Items panel's use (also usable by other code).
 *   - `useItem`, `awardPrize`, `awardHammerPrize`, `applyHeldItems`, `inventoryAvailable`,
 *     `shownItems`.
 *   - `InventoryScene`: the panel; the world map opens it.
 */
import type { Scene } from '@engine/scene';
import { mapPage } from '@content/worldmap';
import { freshSeed } from '../world/world';
import type { Game } from '../scenes/game';
import type { BonusResult, BonusScene } from './common';
import { MemoryScene } from './memory';
import type { BonusKind } from './rules';
import { SlotsScene } from './slots';
import { ToadHouseScene } from './toad-house';

export type { BonusResult } from './common';
export type { BonusKind, BonusPrize, CardFace, SlotPicture } from './rules';
export { BONUS_KINDS, BONUS_TITLES, isBonusKind, nextBonusKind } from './rules';
export type { BonusState, ItemId } from './items';
export { INVENTORY_MAX, ITEM_IDS, ITEM_NAMES, newBonusState } from './items';
export {
  applyHeldItems,
  heldItems,
  awardHammerPrize,
  awardPrize,
  inventoryAvailable,
  shownItems,
  useInventoryItem,
  useItem,
} from './use';
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

/**
 * One bonus game scene of `kind` (not pushed). `onPlayed` runs once at the first choice, before any
 * prize is given (the bonus spot closes itself there).
 */
export function createBonusScene(
  game: Game,
  kind: BonusKind,
  seed: number,
  onEnd: (r: BonusResult) => void,
  onPlayed: (() => void) | null = null,
): BonusScene {
  const scene =
    kind === 'toad-house'
      ? new ToadHouseScene(game, seed, onEnd)
      : kind === 'memory'
        ? new MemoryScene(game, seed, onEnd)
        : new SlotsScene(game, seed, onEnd);
  scene.onPlayed = onPlayed;
  return scene;
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
