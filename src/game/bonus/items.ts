import { BONUS_KINDS, boardFaces, NSPADE_BOARDS, takenCards } from './rules';
import { heroItems, itemInfo, spokenItem, type ItemInfo } from '../items/catalog';

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
 * The hero's own item a prize stands for (docs/POWERUPS.md 8.1): the mushroom is their grow item,
 * the flower their default power. Null for Starman and the 1-up, and for Mario and Luigi (SMB's own).
 */
export function heroPrize(hero: string | undefined, item: ItemId): ItemInfo | null {
  if (!hero || (item !== 'mushroom' && item !== 'flower')) return null;
  const h = heroItems(hero);
  if (!h?.ownItems) return null;
  return itemInfo(hero, item === 'mushroom' ? h.grow : h.defaultPower);
}

/** A prize's on-screen name for `hero` (ITEM_NAMES, or the hero's own item's). */
export function itemName(item: ItemId, hero?: string): string {
  return heroPrize(hero, item)?.name.toUpperCase() ?? ITEM_NAMES[item];
}

/** A prize's spoken name for `hero` ("a Mushroom", "an Energy Tank"). */
export function itemSpoken(item: ItemId, hero?: string): string {
  const own = heroPrize(hero, item);
  return own ? spokenItem(own.name) : ITEM_SPOKEN[item];
}

/** Items a use on the map holds for the start of the next level (a 1-up counts at once). */
export type NextItem = 'mushroom' | 'flower' | 'star';
/** The order held items are given in at a level's start (a mushroom before a flower). */
export const NEXT_ORDER: readonly NextItem[] = ['mushroom', 'flower', 'star'];

/**
 * The bonus and inventory state of a campaign file: every field but `devItems` and `devNext` is saved, field for
 * field (`SaveFile` has each as an optional field; no format bump). `Game.bonus` carries it.
 * Whether the inventory is unlocked and the bonus spot open are `Game.inventoryUnlocked` /
 * `Game.bonusOpen` (SaveFile's fields of the same names, the World 4 bonus spot's).
 */
export interface BonusState {
  /**
   * The hero whose inventory `inventory` and `itemsNext` are (player 1's hero: Game.setHero swaps
   * them, swapInventory). Each hero has their own (0.4.33, docs/POWERUPS.md 8).
   */
  owner: string;
  /** Item ids in the order won, at most INVENTORY_MAX. */
  inventory: ItemId[];
  /** The other heroes' inventories (hero id → items, each at most INVENTORY_MAX). */
  heroInventory: Record<string, ItemId[]>;
  /** The other heroes' items held for their next level. */
  heroItemsNext: Record<string, NextItem[]>;
  /** Rotation: index into BONUS_KINDS of the next bonus game. */
  bonusNext: number;
  /** The N-spade board in play (an index into NSPADE_BOARDS, wrapping). */
  spadeBoard: number;
  /** Its cards taken on earlier visits (whole pairs; cleared with the board). */
  spadeTaken: number[];
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
  /**
   * Dev items used from the map, held for the next level like `itemsNext` (never saved; one per
   * kind across both lists). Cleared with the dev items when dev mode or the toggle goes off.
   */
  devNext: NextItem[];
}

/**
 * The fields of BonusState a save file stores: every hero's inventory and held items by hero id
 * (`heroInventory`, `heroItemsNext`, the owner's included). The single `inventory` / `itemsNext`
 * of older files are read once (bonusStateFrom: they become Mario's) and no longer written.
 */
export type BonusSaveFields = Omit<BonusState, 'devItems' | 'devNext' | 'owner' | 'inventory' | 'itemsNext'>;

/** The hero an older file's single inventory goes to (decision 13). */
export const LEGACY_INVENTORY_HERO = 'mario';

/** What a file without any of the fields has. */
export function newBonusState(owner = LEGACY_INVENTORY_HERO): BonusState {
  return {
    owner,
    inventory: [],
    heroInventory: {},
    heroItemsNext: {},
    bonusNext: 0,
    spadeBoard: 0,
    spadeTaken: [],
    devInventory: false,
    itemsNext: [],
    devItems: [],
    devNext: [],
  };
}

/** Known item ids from `x` (anything else dropped), at most INVENTORY_MAX; [] when not a list. */
export function inventoryItems(x: unknown): ItemId[] {
  return Array.isArray(x) ? x.filter(isItemId).slice(0, INVENTORY_MAX) : [];
}

/** Held items from `x`: known kinds only, each once, in NEXT_ORDER. */
export function nextItems(x: unknown): NextItem[] {
  return Array.isArray(x) ? NEXT_ORDER.filter((k) => x.includes(k)) : [];
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

/** Hero id → list, each list validated by `items`, empty lists left out; heroes `known` only. */
function byHero<T>(
  x: unknown,
  items: (v: unknown) => T[],
  known: (id: string) => boolean,
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  if (isRecord(x))
    for (const [hero, v] of Object.entries(x)) {
      const list = items(v);
      if (known(hero) && list.length) out[hero] = list;
    }
  return out;
}

/**
 * The bonus state stored on a save file (or any record), each field validated; missing = default.
 * `owner` is player 1's hero, whose inventory is taken out to be the one in use. An older file's
 * single `inventory` / `itemsNext` become Mario's (decision 13). `known` filters hero ids.
 */
export function bonusStateFrom(
  stored: Partial<Record<keyof BonusState | 'inventory' | 'itemsNext', unknown>>,
  owner = LEGACY_INVENTORY_HERO,
  known: (id: string) => boolean = () => true,
): BonusState {
  const n = stored.bonusNext;
  const b = stored.spadeBoard;
  const board = typeof b === 'number' && Number.isInteger(b) && b >= 0 ? b % NSPADE_BOARDS.length : 0;
  // Older files keep one shared `inventory` / `itemsNext`: Mario's now (never written again).
  const heroInventory = byHero(stored.heroInventory, inventoryItems, known);
  const heroItemsNext = byHero(stored.heroItemsNext, nextItems, known);
  const oldItems = inventoryItems(stored.inventory);
  const oldNext = nextItems(stored.itemsNext);
  if (oldItems.length && !heroInventory[LEGACY_INVENTORY_HERO])
    heroInventory[LEGACY_INVENTORY_HERO] = oldItems;
  if (oldNext.length && !heroItemsNext[LEGACY_INVENTORY_HERO]) heroItemsNext[LEGACY_INVENTORY_HERO] = oldNext;
  const inventory = heroInventory[owner] ?? [];
  const itemsNext = heroItemsNext[owner] ?? [];
  delete heroInventory[owner];
  delete heroItemsNext[owner];
  return {
    owner,
    inventory,
    heroInventory,
    heroItemsNext,
    bonusNext: typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n % BONUS_KINDS.length : 0,
    spadeBoard: board,
    spadeTaken: takenCards(boardFaces(board), stored.spadeTaken),
    devInventory: stored.devInventory === true,
    itemsNext,
    devItems: [],
    devNext: [],
  };
}

/** The fields of `s` to write onto a save file (never the dev items). */
export function bonusSaveFields(s: BonusState): BonusSaveFields {
  const heroInventory: Record<string, ItemId[]> = {};
  for (const [hero, list] of Object.entries(s.heroInventory))
    if (hero !== s.owner && list.length) heroInventory[hero] = list.slice(0, INVENTORY_MAX);
  if (s.inventory.length) heroInventory[s.owner] = s.inventory.slice(0, INVENTORY_MAX);
  const heroItemsNext: Record<string, NextItem[]> = {};
  for (const [hero, list] of Object.entries(s.heroItemsNext))
    if (hero !== s.owner && list.length) heroItemsNext[hero] = list.slice();
  if (s.itemsNext.length) heroItemsNext[s.owner] = s.itemsNext.slice();
  return {
    heroInventory,
    heroItemsNext,
    bonusNext: s.bonusNext,
    spadeBoard: s.spadeBoard,
    spadeTaken: s.spadeTaken.slice(),
    devInventory: s.devInventory,
  };
}

/**
 * Player 1's hero is now `hero`: the inventory in use (and its held items) becomes theirs, the
 * last owner's put away until they play again (docs/POWERUPS.md 8.1).
 */
export function swapInventory(s: BonusState, hero: string): void {
  if (hero === s.owner) return;
  if (s.inventory.length) s.heroInventory[s.owner] = s.inventory;
  else delete s.heroInventory[s.owner];
  if (s.itemsNext.length) s.heroItemsNext[s.owner] = s.itemsNext;
  else delete s.heroItemsNext[s.owner];
  s.owner = hero;
  s.inventory = s.heroInventory[hero] ?? [];
  s.itemsNext = s.heroItemsNext[hero] ?? [];
  delete s.heroInventory[hero];
  delete s.heroItemsNext[hero];
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
