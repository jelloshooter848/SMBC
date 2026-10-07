/*
 * The SMB3-style item inventory: what it holds and the bonus fields of a save file (docs/BONUS.md).
 * Pure data, no scenes: the save code and Game read and write it through here.
 */

/** Items the inventory holds (the SMB3 item box's mushroom, fire flower, star and 1-up). */
export type ItemId = 'mushroom' | 'flower' | 'star' | '1up';
export const ITEM_IDS: readonly ItemId[] = ['mushroom', 'flower', 'star', '1up'];
export const isItemId = (x: unknown): x is ItemId =>
  typeof x === 'string' && (ITEM_IDS as string[]).includes(x);

/** Most items the inventory holds (SMB3 held 28 over three rows; one row of 12 fits the map). */
export const INVENTORY_MAX = 12;

/** On-screen names. */
export const ITEM_NAMES: Readonly<Record<ItemId, string>> = {
  mushroom: 'MUSHROOM',
  flower: 'FIRE FLOWER',
  star: 'STARMAN',
  '1up': '1-UP MUSHROOM',
};

/** Spoken names ("a Fire Flower"). */
export const ITEM_SPOKEN: Readonly<Record<ItemId, string>> = {
  mushroom: 'a Mushroom',
  flower: 'a Fire Flower',
  star: 'a Starman',
  '1up': 'a 1-up Mushroom',
};

/**
 * The bonus and inventory state of a campaign file, field for field as the save stores it
 * (`SaveFile` has each as an optional field; no format bump). `Game.bonus` carries it.
 */
export interface BonusState {
  /** Item ids in the order won, at most INVENTORY_MAX. */
  inventory: ItemId[];
  /** Set when Larry is beaten (L1): the map's Items menu appears. */
  inventoryUnlocked: boolean;
  /** The World 4 bonus spot can be played (L1 opens and spends it). */
  bonusOpen: boolean;
  /** Rotation: index into BONUS_KINDS of the next bonus game. */
  bonusNext: number;
  /** Dev mode's map menu "Item inventory": unlocks it while dev mode is on (never written to inventoryUnlocked). */
  devInventory: boolean;
  /** A Starman used from the map: star power at the start of the next level. */
  starNext: boolean;
}

/** What a file without any of the fields has. */
export function newBonusState(): BonusState {
  return {
    inventory: [],
    inventoryUnlocked: false,
    bonusOpen: false,
    bonusNext: 0,
    devInventory: false,
    starNext: false,
  };
}

/** Known item ids from `x` (anything else dropped), at most INVENTORY_MAX; [] when not a list. */
export function inventoryItems(x: unknown): ItemId[] {
  return Array.isArray(x) ? x.filter(isItemId).slice(0, INVENTORY_MAX) : [];
}

/** The bonus state stored on a save file (or any record), each field validated; missing = default. */
export function bonusStateFrom(stored: Partial<Record<keyof BonusState, unknown>>): BonusState {
  const n = stored.bonusNext;
  return {
    inventory: inventoryItems(stored.inventory),
    inventoryUnlocked: stored.inventoryUnlocked === true,
    bonusOpen: stored.bonusOpen === true,
    bonusNext: typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n % 3 : 0,
    devInventory: stored.devInventory === true,
    starNext: stored.starNext === true,
  };
}

/** A copy of `s` to write onto a save file. */
export function bonusSaveFields(s: BonusState): BonusState {
  return { ...s, inventory: s.inventory.slice(0, INVENTORY_MAX) };
}

/** Adds `item` when there is room; false (unchanged) when the inventory is full. */
export function addItem(s: BonusState, item: ItemId): boolean {
  if (s.inventory.length >= INVENTORY_MAX) return false;
  s.inventory.push(item);
  return true;
}

/** Takes the item at `index` out; null when there is none. */
export function takeItem(s: BonusState, index: number): ItemId | null {
  if (index < 0 || index >= s.inventory.length) return null;
  return s.inventory.splice(index, 1)[0] ?? null;
}
