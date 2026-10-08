import type { Player } from '../entities/player';

/**
 * What a hero's own items do (docs/POWERUPS.md sections 4-5), one set per hero with items
 * (characters/<hero>/items.ts). The names, ids and order are in catalog.ts.
 */
export interface HeroItemRules {
  /** SMB's "small" for this hero: any power block gives them their grow item first (2.1). */
  small(p: Player): boolean;
  /** The hero has item `id` (a stacking item counts once at its maximum). */
  owned(p: Player, id: string): boolean;
  /** Item `id` taken for the first time (or one more of a stacking item): its effect. */
  give(p: Player, id: string): void;
  /** Item `id` taken while owned: its refill (section 4's "owned again"). */
  refill(p: Player, id: string): void;
  /** The hero's refill sound (an owned item). */
  refillSfx: string;
  /**
   * The campaign's basic kit beyond the `found` flag, and the hit points it starts with (Simon
   * and Ryu: a 10-point health bar, decision 4).
   */
  start?: { hp: number; kit: Readonly<Record<string, number>> };
}
