import type { CharacterDef } from '../characters/character';
import { startHp } from '../characters/character';
import type { Player } from '../entities/player';
import { LINK_ITEMS } from '../characters/link/items';
import { MEGAMAN_ITEMS } from '../characters/megaman/items';
import { SAMUS_ITEMS } from '../characters/samus/items';
import { SIMON_ITEMS } from '../characters/simon/items';
import { RYU_ITEMS } from '../characters/ryu/items';
import { BILL_ITEMS } from '../characters/bill/items';
import { SOPHIA_ITEMS } from '../characters/sophia/items';
import { entryItem, heroItems, itemInfo } from './catalog';
import { FOUND } from './flags';
import type { HeroItemRules } from './rules';

/** What each hero's own items do (Mario and Luigi have SMB's: their onPowerUp). */
export const ITEM_RULES: Readonly<Record<string, HeroItemRules>> = {
  link: LINK_ITEMS,
  megaman: MEGAMAN_ITEMS,
  samus: SAMUS_ITEMS,
  simon: SIMON_ITEMS,
  ryu: RYU_ITEMS,
  bill: BILL_ITEMS,
  sophia: SOPHIA_ITEMS,
};

export function itemRules(hero: string): HeroItemRules | null {
  return ITEM_RULES[hero] ?? null;
}

/** A hero's power, hit points and kit. */
export interface HeroPower {
  powerState: string;
  hp: number;
  kit: Record<string, number>;
}

/**
 * The campaign's basic kit (decision 2: every hero starts with it the first time they are played,
 * and comes back to it after a death): the hero's starting power and hit points, and a kit that
 * follows the found-item rules (`found`).
 */
export function heroStart(def: CharacterDef): HeroPower {
  const start = itemRules(def.id)?.start;
  return {
    powerState: def.damage.kind === 'powerup' ? 'small' : 'full',
    hp: start?.hp ?? startHp(def),
    kit: { [FOUND]: 1, ...start?.kit },
  };
}

/**
 * The item a power block gives `p` (docs/POWERUPS.md 3.3): a small hero gets their grow item; else
 * the block's entry for their hero, or their default power. `content` `mushroom` is the Top Secret
 * Area's fixed grow block. A grow-slot block (that, or an entry `grow`) works as SMB's does for a
 * big Mario (0.4.35): once the hero owns their grow item (a stacking one at its maximum) it gives
 * their next power item they don't own, in the catalog's order, else their default power (its
 * refill); never the grow item again. Null for a hero without items of their own.
 */
export function blockItem(
  p: Player,
  entries: Readonly<Record<string, string>> | null | undefined,
  content: 'powerup' | 'mushroom' | 'flower' = 'powerup',
): string | null {
  const hero = p.def.id;
  const items = heroItems(hero);
  const rules = itemRules(hero);
  if (!items?.ownItems || !rules) return null;
  if (rules.small(p)) return items.grow;
  const entry = entries?.[hero];
  const placed = content === 'mushroom' ? items.grow : entry !== undefined ? entryItem(hero, entry) : null;
  if (placed !== items.grow) return placed ?? items.defaultPower;
  if (!rules.owned(p, items.grow)) return items.grow;
  return items.items.find((i) => i.kind === 'power' && !rules.owned(p, i.id))?.id ?? items.defaultPower;
}

/** What taking an item did: `fresh` the first one (named on screen), else a refill. */
export interface TakeResult {
  id: string;
  name: string;
  does: string;
  fresh: boolean;
}

/**
 * `p` takes their own item `id`: owned already, its refill; else its effect. Score, sound and the
 * caption are the caller's (World.takeHeroItem). Null when `id` isn't one of `p`'s items.
 */
export function applyItem(p: Player, id: string): TakeResult | null {
  const rules = itemRules(p.def.id);
  const info = itemInfo(p.def.id, id);
  if (!rules || !info) return null;
  const fresh = !rules.owned(p, id);
  if (fresh) rules.give(p, id);
  else rules.refill(p, id);
  return { id, name: info.name, does: info.does, fresh };
}

/** The sound an item's pickup plays (one per item, src/content/sfx/hero-items.ts). */
export const itemSfx = (id: string): string => `item-${id}`;
