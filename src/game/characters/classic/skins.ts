import type { CharacterDef } from '../character';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '../protoman/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '../pit/classic';

/**
 * Classic mode's skins and gameplay variants (docs/classic/FOLLOW_UPS_PROPOSAL.md FU-8, FU-3), read
 * only through registry.ts (CLASSIC_SKINS, CLASSIC_VARIANTS).
 *
 * The owner's rule: one select slot per hero, and a skin picker on that slot chooses among looks
 * that play exactly alike. A variant that plays differently has its own slot.
 *
 * - Break Man plays exactly as Proto Man (the same four rule changes; only his colours differ and
 *   he does not whistle when picked), so he is Proto Man's second skin.
 * - Dark Pit plays exactly as Pit (the same six rule changes; his colours and his arrows' colours
 *   differ), so he is Pit's second skin.
 */
export const CLASSIC_SKIN_LISTS: Readonly<Record<string, readonly CharacterDef[]>> = {
  protoman: [PROTOMAN_CLASSIC, BREAKMAN_CLASSIC],
  pit: [PIT_CLASSIC, DARKPIT_CLASSIC],
};

/** The gameplay variants with their own slots (FU-3), in select order. */
export const CLASSIC_VARIANT_DEFS: readonly CharacterDef[] = [];
