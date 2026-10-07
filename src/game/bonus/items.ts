import { BONUS_KINDS } from './rules';

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

/** Items a use on the map holds for the start of the next level (a 1-up counts at once). */
export type NextItem = 'mushroom' | 'flower' | 'star';
/** The order held items are given in at a level's start (a mushroom before a flower). */
export const NEXT_ORDER: readonly NextItem[] = ['mushroom', 'flower', 'star'];

/**
 * The bonus and inventory state of a campaign file: every field but `devItems` is saved, field for
 * field (`SaveFile` has each as an optional field; no format bump). `Game.bonus` carries it.
 * Whether the inventory is unlocked and the bonus spot open are `Game.inventoryUnlocked` /
 * `Game.bonusOpen` (SaveFile's fields of the same names, the World 4 bonus spot's).
 */
export interface BonusState {
  /** Item ids in the order won, at most INVENTORY_MAX. */
  inventory: ItemId[];
  /** Rotation: index into BONUS_KINDS of the next bonus game. */
  bonusNext: number;
  /** Dev mode's map menu "Item inventory": unlocks it while dev mode is on (never written to inventoryUnlocked). */
  devInventory: boolean;
  /**
   * Items used from the map, held for the start of the next level and given to the hero who
   * enters it (at most one of each kind, in NEXT_ORDER).
   */
  itemsNext: NextItem[];
  /**
   * Dev mode's "Give items": never saved, shown and usable only while dev mode and the "Item
   * inventory" toggle are on (after the file's own items). Together with `inventory` at most
   * INVENTORY_MAX: a won item pushes the last one out.
   */
  devItems: ItemId[];
}

/** The fields of BonusState a save file stores. */
export type BonusSaveFields = Omit<BonusState, 'devItems'>;

/** What a file without any of the fields has. */
export function newBonusState(): BonusState {
  return { inventory: [], bonusNext: 0, devInventory: false, itemsNext: [], devItems: [] };
}

/** Known item ids from `x` (anything else dropped), at most INVENTORY_MAX; [] when not a list. */
export function inventoryItems(x: unknown): ItemId[] {
  return Array.isArray(x) ? x.filter(isItemId).slice(0, INVENTORY_MAX) : [];
}

/** Held items from `x`: known kinds only, each once, in NEXT_ORDER. */
export function nextItems(x: unknown): NextItem[] {
  return Array.isArray(x) ? NEXT_ORDER.filter((k) => x.includes(k)) : [];
}

/** The bonus state stored on a save file (or any record), each field validated; missing = default. */
export function bonusStateFrom(stored: Partial<Record<keyof BonusState, unknown>>): BonusState {
  const n = stored.bonusNext;
  return {
    inventory: inventoryItems(stored.inventory),
    bonusNext: typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n % BONUS_KINDS.length : 0,
    devInventory: stored.devInventory === true,
    itemsNext: nextItems(stored.itemsNext),
    devItems: [],
  };
}

/** The fields of `s` to write onto a save file (never the dev items). */
export function bonusSaveFields(s: BonusState): BonusSaveFields {
  return {
    inventory: s.inventory.slice(0, INVENTORY_MAX),
    bonusNext: s.bonusNext,
    devInventory: s.devInventory,
    itemsNext: s.itemsNext.slice(),
  };
}

/**
 * Adds `item` to the file's inventory when there is room; false (unchanged) when it is full. A dev
 * item gives way to it when the two lists together would hold more than INVENTORY_MAX.
 */
export function addItem(s: BonusState, item: ItemId): boolean {
  if (s.inventory.length >= INVENTORY_MAX) return false;
  s.inventory.push(item);
  s.devItems.splice(Math.max(0, INVENTORY_MAX - s.inventory.length));
  return true;
}

/** Dev "Give items": one of each item into the unsaved dev list, as room allows; how many. */
export function giveDevItems(s: BonusState): number {
  let n = 0;
  for (const id of ITEM_IDS) {
    if (s.inventory.length + s.devItems.length >= INVENTORY_MAX) break;
    s.devItems.push(id);
    n++;
  }
  return n;
}

/** Takes the item at `index` out of the file's inventory; null when there is none. */
export function takeItem(s: BonusState, index: number): ItemId | null {
  if (index < 0 || index >= s.inventory.length) return null;
  return s.inventory.splice(index, 1)[0] ?? null;
}
