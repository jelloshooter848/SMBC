/*
 * The campaign's item flags in a hero's carried kit (Player.scratch, GameState.kit). Kept free of
 * imports so every hero's code can read them.
 *
 * - `found: 1` marks a campaign kit: the hero finds their items one by one in the power blocks
 *   (docs/POWERUPS.md). A kit without it (classic play, the mini games, the developer's levels)
 *   keeps today's rules: SMB's mushroom and flower, unlocking in a fixed order.
 * - `has-<item id>: 1` marks an item found (`has-ice-beam`), for items with no older key of their own.
 */

type Kit = { scratch: Record<string, number> };

export const FOUND = 'found';

/** The kit key of a found item. */
export const hasKey = (id: string): string => `has-${id}`;

/** The kit follows the campaign's found-item rules. */
export function isFound(p: Kit): boolean {
  return !!p.scratch[FOUND];
}

/** Item `id` was found (its own flag). */
export function has(p: Kit, id: string): boolean {
  return !!p.scratch[hasKey(id)];
}

export function setHas(p: Kit, id: string): void {
  p.scratch[hasKey(id)] = 1;
}

/** Outside the found-item rules everything counts as owned; inside, only found items. */
export function hasOrClassic(p: Kit, id: string): boolean {
  return !isFound(p) || has(p, id);
}
