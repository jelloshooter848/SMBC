import type { CharacterDef } from '../character';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '../protoman/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '../pit/classic';
import {
  CUTMAN_CLASSIC,
  DOROPIE_CLASSIC,
  FIREMAN_CLASSIC,
  FRANCESCA_CLASSIC,
  ICEMAN_CLASSIC,
  ROCK_CLASSIC,
  ROKKO_CLASSIC,
} from '../megaman/classic-variants';

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
 * - Doropie plays exactly as Francesca (both only lose the slide), so she is Francesca's second
 *   skin.
 */
export const CLASSIC_SKIN_LISTS: Readonly<Record<string, readonly CharacterDef[]>> = {
  protoman: [PROTOMAN_CLASSIC, BREAKMAN_CLASSIC],
  pit: [PIT_CLASSIC, DARKPIT_CLASSIC],
  francesca: [FRANCESCA_CLASSIC, DOROPIE_CLASSIC],
};

/**
 * The gameplay variants (FU-3), in the original's skin order (MegaMan.SKIN_ORDER): each plays
 * differently from Mega Man, so each has its own slot (Doropie's folds into Francesca's).
 */
export const CLASSIC_VARIANT_DEFS: readonly CharacterDef[] = [
  ROCK_CLASSIC,
  CUTMAN_CLASSIC,
  FIREMAN_CLASSIC,
  ICEMAN_CLASSIC,
  FRANCESCA_CLASSIC,
  DOROPIE_CLASSIC,
  ROKKO_CLASSIC,
];
