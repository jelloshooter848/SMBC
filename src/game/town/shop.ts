import type { GameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { carriedKit, Player } from '../entities/player';
import { itemInfo } from '../items/catalog';
import { has } from '../items/flags';
import { applyItem, itemRules, itemSfx } from '../items/heroes';
import { MAX_LIVES } from '../bonus/use';
import { MAX_BOMBS, MAX_MAGIC, LINK_SPELLS } from '../characters/link';
import { WEAPON_ENERGY, WEAPONS, RUSH } from '../characters/megaman/weapons';
import { MAX_MISSILES } from '../characters/samus';
import { MAX_HEARTS, START_HEARTS } from '../characters/simon';
import { START_NINPO } from '../characters/ryu';
import { HOMING_MAX, TRIPLE_MAX } from '../characters/sophia/profile';

/*
 * Kakariko's shop (0.4.42, the approved village design's release 2; docs/POWERUPS.md "Kakariko
 * shop"). Each hero's stock is placed, not worked out, like a power block's `[hero-items]` entry:
 * their grow item, one chosen power item (one of World 2's own new items, or the nearest earlier
 * one), a refill where they have one, and the 1-up, at fixed prices. What is shown is the current
 * hero's, so switching heroes changes the tables on the spot. Anything that would change nothing
 * is greyed out (SOLD OUT, FULL), and SMB's sequence rule holds: a small hero gets the grow item
 * first (the power item reads GROW FIRST). A purchase goes through the power blocks' item code
 * (`applyItem` and the hero's own give / refill rules) into the hero's carried kit.
 */

export type ShopSlot = 'grow' | 'power' | 'refill' | 'life';
/** The tables' order, left to right. */
export const SHOP_SLOTS: readonly ShopSlot[] = ['grow', 'power', 'refill', 'life'];

/** Fixed prices in coins (the 1-up: one a visit at this price without the Wallet). */
export const PRICES: Readonly<Record<ShopSlot, number>> = { grow: 20, power: 40, refill: 10, life: 50 };
/** The 1-up with the Wallet: no limit a visit. */
export const WALLET_LIFE_PRICE = 100;

/** A picture for a table (a sprite sheet's frame). */
export interface ShopIcon {
  sheet: string;
  frame: string;
}

/** A hero's refill: their ammo or energy, bought again. */
export interface ShopRefill {
  name: string;
  does: string;
  icon: ShopIcon;
  /**
   * The owned item whose "owned again" refill this is (the hero's own `refill` rule, as a power
   * block's repeat item), or null while the ammo item is not owned yet.
   */
  via(p: Player): string | null;
  /** There is something to fill. */
  room(p: Player): boolean;
}

export interface HeroStock {
  grow: string;
  power: string;
  refill: ShopRefill | null;
}

const owned = (p: Player, ids: readonly string[]): string | null => ids.find((id) => has(p, id)) ?? null;

const LINK_REFILL: ShopRefill = {
  name: 'Bombs and Magic',
  does: 'bombs to 8, and all your magic',
  icon: { sheet: 'items', frame: 'bomb-0' },
  via: (p) => owned(p, ['bomb-bag', ...LINK_SPELLS]),
  room: (p) =>
    (has(p, 'bomb-bag') && (p.scratch.bombs ?? 0) < MAX_BOMBS) ||
    (LINK_SPELLS.some((s) => has(p, s)) && (p.scratch.magic ?? MAX_MAGIC) < MAX_MAGIC),
};

/** Mega Man's weapons on his belt (each its own item) and Rush. */
const MEGAMAN_TANKS = [...WEAPONS.map((w) => ({ item: w.item, key: `w${w.id}` })), { item: 'rush-coil', key: `w${RUSH.id}` }];
const MEGAMAN_REFILL: ShopRefill = {
  name: 'Weapon Energy',
  does: 'every weapon filled',
  icon: { sheet: 'items', frame: 'weapon-pellet-large' },
  via: (p) => owned(p, MEGAMAN_TANKS.map((t) => t.item)),
  room: (p) => MEGAMAN_TANKS.some((t) => has(p, t.item) && (p.scratch[t.key] ?? WEAPON_ENERGY) < WEAPON_ENERGY),
};

const SAMUS_REFILL: ShopRefill = {
  name: 'Missile Pack',
  does: 'ten more missiles',
  icon: { sheet: 'items', frame: 'missile-pack' },
  via: (p) => owned(p, ['missiles']),
  room: (p) => has(p, 'missiles') && (p.scratch.missiles ?? 0) < MAX_MISSILES,
};

/** Simon's sub-weapons: what his hearts are for. */
const SIMON_SUBS = ['dagger', 'holy-water', 'axe', 'cross', 'stopwatch'];
const SIMON_REFILL: ShopRefill = {
  name: 'Hearts',
  does: 'ten more hearts for your sub-weapons',
  icon: { sheet: 'items', frame: 'heart-large' },
  via: (p) => owned(p, SIMON_SUBS),
  room: (p) => owned(p, SIMON_SUBS) !== null && (p.scratch.hearts ?? START_HEARTS) < MAX_HEARTS,
};

/** Ryu's arts: what his ninpo is for. */
const RYU_ARTS = ['throwing-star', 'windmill', 'fire-wheel', 'jump-slash'];
const RYU_REFILL: ShopRefill = {
  name: 'Ninpo',
  does: 'all your ninpo filled',
  icon: { sheet: 'items', frame: 'ninpo-large' },
  via: (p) => owned(p, RYU_ARTS),
  room: (p) => {
    const max = p.scratch.ninpoMax ?? START_NINPO;
    return owned(p, RYU_ARTS) !== null && (p.scratch.ninpo ?? max) < max;
  },
};

const SOPHIA_REFILL: ShopRefill = {
  name: 'Missile Ammo',
  does: 'more Triple and Homing missiles',
  icon: { sheet: 'sophia', frame: 'ammo-triple' },
  via: (p) => (p.scratch.hasTriple ? 'triple-missile' : p.scratch.hasHoming ? 'homing-missile' : null),
  room: (p) =>
    (!!p.scratch.hasTriple && (p.scratch.triple ?? 0) < TRIPLE_MAX) ||
    (!!p.scratch.hasHoming && (p.scratch.homing ?? 0) < HOMING_MAX),
};

/** Each hero's stock (the design's table, section 2). */
export const SHOP_STOCK: Readonly<Record<string, HeroStock>> = {
  mario: { grow: 'mushroom', power: 'fire-flower', refill: null },
  luigi: { grow: 'mushroom', power: 'fire-flower', refill: null },
  link: { grow: 'heart-container', power: 'shield-spell', refill: LINK_REFILL },
  megaman: { grow: 'helmet', power: 'rush-coil', refill: MEGAMAN_REFILL },
  samus: { grow: 'energy-tank', power: 'ice-beam', refill: SAMUS_REFILL },
  simon: { grow: 'pot-roast', power: 'holy-water', refill: SIMON_REFILL },
  ryu: { grow: 'medicine', power: 'windmill', refill: RYU_REFILL },
  bill: { grow: 'medal', power: 'machine-gun', refill: null },
  sophia: { grow: 'power-capsule', power: 'triple-missile', refill: SOPHIA_REFILL },
};

/** Grow items a hero can hold several of: at their maximum they read FULL, not SOLD OUT. */
const STACKING = new Set(['heart-container', 'energy-tank', 'medal']);

/** Why a table is greyed out. */
export type ShopMark = 'SOLD OUT' | 'FULL' | 'GROW FIRST';

export interface ShopEntry {
  slot: ShopSlot;
  /** The item id (`life` for the 1-up, `refill` for a refill). */
  id: string;
  name: string;
  does: string;
  price: number;
  icon: ShopIcon;
  /** Greyed out, and why; null when it can be bought. */
  mark: ShopMark | null;
}

/** One visit to the shop: the 1-up without the Wallet is one a visit. */
export interface ShopVisit {
  lifeBought: boolean;
}

export const newShopVisit = (): ShopVisit => ({ lifeBought: false });

/**
 * The run's hero as a Player (the item rules work on one), their kit in its scratch; `done`
 * writes their power, hit points and kit back.
 */
function heroPlayer(s: GameState): { p: Player; done: () => void } {
  const p = new Player(0, 0, s.character, s.powerState, s.hp);
  Object.assign(p.scratch, s.kit);
  return {
    p,
    done: () => {
      s.powerState = p.powerState;
      s.hp = p.hp;
      s.kit = carriedKit(p);
    },
  };
}

/** Mario and Luigi have SMB's items: their power state is all there is. */
const plumber = (c: CharacterDef) => c.damage.kind === 'powerup' && !itemRules(c.id);

/** A plumber's item is owned (big for the mushroom, fire for the flower). */
function plumberOwns(p: Player, id: string): boolean {
  if (id === 'mushroom') return p.powerState !== 'small';
  return p.powerState === 'fire';
}

/** An item's picture: the hero items' own, or SMB's mushroom and flower for Mario and Luigi. */
const heroIcon = (c: CharacterDef, id: string): ShopIcon =>
  plumber(c) ? { sheet: 'items', frame: id === 'mushroom' ? 'mushroom' : 'flower-0' } : { sheet: 'hero-items', frame: id };

/** The current hero's tables, left to right (three for a hero with no refill). */
export function shopEntries(s: GameState, visit: ShopVisit): ShopEntry[] {
  const c = s.character;
  const stock = SHOP_STOCK[c.id];
  if (!stock) return [];
  const { p } = heroPlayer(s);
  const rules = itemRules(c.id);
  const small = rules ? rules.small(p) : p.powerState === 'small';
  const owns = (id: string) => (rules ? rules.owned(p, id) : plumberOwns(p, id));
  const out: ShopEntry[] = [];
  const item = (slot: 'grow' | 'power', id: string, mark: ShopMark | null) => {
    const info = itemInfo(c.id, id);
    out.push({
      slot,
      id,
      name: info?.name ?? id,
      does: info?.does ?? '',
      price: PRICES[slot],
      icon: heroIcon(c, id),
      mark,
    });
  };
  item('grow', stock.grow, owns(stock.grow) ? (STACKING.has(stock.grow) ? 'FULL' : 'SOLD OUT') : null);
  item('power', stock.power, owns(stock.power) ? 'SOLD OUT' : small ? 'GROW FIRST' : null);
  const r = stock.refill;
  if (r)
    out.push({
      slot: 'refill',
      id: 'refill',
      name: r.name,
      does: r.does,
      price: PRICES.refill,
      icon: r.icon,
      mark: r.via(p) !== null && r.room(p) ? null : 'FULL',
    });
  out.push({
    slot: 'life',
    id: 'life',
    name: '1-Up',
    does: 'one more life',
    price: s.wallet ? WALLET_LIFE_PRICE : PRICES.life,
    icon: { sheet: 'items', frame: '1up' },
    mark: s.lives >= MAX_LIVES ? 'FULL' : !s.wallet && visit.lifeBought ? 'SOLD OUT' : null,
  });
  return out;
}

/** What a purchase did: bought (with what to play and say), refused (greyed out), or short of coins. */
export type BuyOutcome =
  | { kind: 'bought'; entry: ShopEntry; sfx: string }
  | { kind: 'refused'; mark: ShopMark }
  | { kind: 'short'; price: number };

/** Buys the current hero's `slot` table: the coins go, the item lands in the hero's kit. */
export function buy(s: GameState, visit: ShopVisit, slot: ShopSlot): BuyOutcome {
  const entry = shopEntries(s, visit).find((e) => e.slot === slot);
  if (!entry) return { kind: 'refused', mark: 'SOLD OUT' };
  if (entry.mark) return { kind: 'refused', mark: entry.mark };
  if (s.coins < entry.price) return { kind: 'short', price: entry.price };
  s.coins -= entry.price;
  if (slot === 'life') {
    s.lives = Math.min(MAX_LIVES, s.lives + 1);
    visit.lifeBought = true;
    return { kind: 'bought', entry, sfx: '1up' };
  }
  const { p, done } = heroPlayer(s);
  const c = s.character;
  let sfx = 'powerup';
  if (slot === 'refill') {
    const via = SHOP_STOCK[c.id]?.refill?.via(p);
    if (via) applyItem(p, via);
    sfx = itemRules(c.id)?.refillSfx ?? 'pickup';
  } else if (itemRules(c.id)) {
    applyItem(p, entry.id);
    sfx = itemSfx(entry.id);
  } else {
    // Mario and Luigi: SMB's mushroom makes them big, the flower fire.
    p.powerState = entry.id === 'mushroom' ? 'big' : 'fire';
  }
  p.transition = null;
  done();
  return { kind: 'bought', entry, sfx };
}
