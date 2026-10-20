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

/**
 * The game each hero comes from, as the original's select names it under the hero
 * (CharacterSelectBox.changeNameBoxText: CharacterInfo's first game), by select-slot hero id; and
 * each skin's source game, as its skin menu names it (CharacterSkinMenu.generateBottomText:
 * BmdInfo's IND_GAME_SOURCE), by skin id where it differs. Heroes the original lacks name their
 * own game. Short titles, so a line fits the name box.
 */
export const CLASSIC_HERO_GAMES: Readonly<Record<string, string>> = {
  mario: 'Super Mario Bros.',
  luigi: 'The Lost Levels',
  link: 'The Legend of Zelda',
  megaman: 'Mega Man',
  samus: 'Metroid',
  simon: 'Castlevania',
  ryu: 'Ninja Gaiden',
  bill: 'Contra',
  sophia: 'Blaster Master',
  bass: 'Mega Man 10',
  protoman: 'Mega Man 3',
  rock: 'Mega Man',
  cutman: 'Mega Man',
  fireman: 'Mega Man',
  iceman: 'Mega Man',
  francesca: 'The Krion Conquest',
  rokko: 'Rokko Chan',
  pit: 'Kid Icarus',
  vicviper: 'Gradius',
  warriors: 'Final Fantasy',
  peach: 'Super Mario Bros. 2',
  arthur: "Ghosts 'n Goblins",
  yoshi: 'Super Mario World',
};

/** A skin's own source game where it is not its hero's (BmdInfo.as IND_GAME_SOURCE). */
export const CLASSIC_SKIN_GAMES: Readonly<Record<string, string>> = {
  darkpit: 'Kid Icarus: Uprising',
};
