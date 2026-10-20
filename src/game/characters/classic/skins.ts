import type { CharacterDef } from '../character';
import { LUIGI } from '../luigi';
import { MEGAMAN } from '../megaman';
import { SAMUS } from '../samus';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '../protoman/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '../pit/classic';
import { PEACH_CLASSIC } from '../peach/classic';
import { MARIO } from '../mario';
import { LINK } from '../link';
import { RYU } from '../ryu';
import { BASS_CLASSIC } from '../bass/classic';
import { QUICKMAN_CLASSIC } from '../bass/classic-quickman';
import { HAGGLEMAN_CLASSIC } from '../ryu/classic-haggleman';
import { ZELDA_GB_CLASSIC, ZELDA_NES_CLASSIC, ZELDA_SNES_CLASSIC } from '../link/classic-zelda';
import { LUIGI3_CLASSIC, MARIO3_CLASSIC } from '../mario/classic-looks';
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
 * Classic mode's skins (docs/classic/FOLLOW_UPS_PROPOSAL.md FU-8, FU-3), read only through
 * registry.ts (CLASSIC_SKINS, CLASSIC_SLOT_ORDER, CLASSIC_EXPANSION_HEROES).
 *
 * The original 3.1.21 has one select slot per hero and a skin menu on it; a skin brings its own
 * rules with it (SkinDescriptions.as), so ours is each skin's whole Classic def. The lists follow
 * the original's skin order (MegaMan.SKIN_ORDER and the others), leaving out the looks we have no
 * art for.
 */
export const CLASSIC_SKIN_LISTS: Readonly<Record<string, readonly CharacterDef[]>> = {
  // MegaMan.SKIN_ORDER: Mega Man, ..., Rock, Proto Man, Break Man, ..., Cut Man, Fire Man, Ice
  // Man, Francesca, Doropie, Rokko Chan.
  megaman: [
    MEGAMAN,
    ROCK_CLASSIC,
    PROTOMAN_CLASSIC,
    BREAKMAN_CLASSIC,
    CUTMAN_CLASSIC,
    FIREMAN_CLASSIC,
    ICEMAN_CLASSIC,
    FRANCESCA_CLASSIC,
    DOROPIE_CLASSIC,
    ROKKO_CLASSIC,
  ],
  // Samus's skins (BmdInfo.as): Pit, then Dark Pit.
  samus: [SAMUS, PIT_CLASSIC, DARKPIT_CLASSIC],
  // Luigi's: Princess Peach (Super Mario Bros. 2), and his Super Mario Bros. 3 look (G-053).
  luigi: [LUIGI, PEACH_CLASSIC, LUIGI3_CLASSIC],
  // 0.5.0 (G-050..G-053): Mario's Super Mario Bros. 3 look; Link's Princess Zelda (NES, SNES,
  // Game Boy, in Link.SKIN_* order); Bass's Quick Man; Ryu's Haggle Man.
  mario: [MARIO, MARIO3_CLASSIC],
  link: [LINK, ZELDA_NES_CLASSIC, ZELDA_SNES_CLASSIC, ZELDA_GB_CLASSIC],
  bass: [BASS_CLASSIC, QUICKMAN_CLASSIC],
  ryu: [RYU, HAGGLEMAN_CLASSIC],
};

/**
 * Classic mode's select slots, in the original's order (CharacterSelectBox.ORDER_VEC: two rows of
 * six, the Random slot last; the map-skin slot is left out, as we have no map skins). Every other
 * look is a skin on one of these.
 */
export const CLASSIC_SLOT_ORDER: readonly string[] = [
  'mario',
  'luigi',
  'link',
  'samus',
  'simon',
  'megaman',
  'bass',
  'bill',
  'ryu',
  'sophia',
];

/**
 * The heroes the original never had (Options > Expansion heroes; off by default): their slots
 * follow the original's. The Dev menu's own toggles still leave any of them out.
 */
export const CLASSIC_EXPANSION_HEROES: readonly string[] = ['vicviper', 'warriors', 'arthur', 'yoshi'];

/** No hero plays differently on a slot of its own any more: every variant is a skin. */
export const CLASSIC_VARIANT_DEFS: readonly CharacterDef[] = [];

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
  vicviper: 'Gradius',
  warriors: 'Final Fantasy',
  arthur: "Ghosts 'n Goblins",
  yoshi: 'Super Mario World',
};

/** A skin's own source game where it is not its hero's (BmdInfo.as IND_GAME_SOURCE). */
export const CLASSIC_SKIN_GAMES: Readonly<Record<string, string>> = {
  protoman: 'Mega Man 3',
  breakman: 'Mega Man 3',
  rock: 'Mega Man',
  cutman: 'Mega Man',
  fireman: 'Mega Man',
  iceman: 'Mega Man',
  francesca: 'The Krion Conquest',
  doropie: 'The Krion Conquest',
  rokko: 'Rokko Chan',
  pit: 'Kid Icarus',
  darkpit: 'Kid Icarus: Uprising',
  peach: 'Super Mario Bros. 2',
  mario3: 'Super Mario Bros. 3',
  luigi3: 'Super Mario Bros. 3',
  'zelda-nes': 'The Legend of Zelda',
  'zelda-snes': 'A Link to the Past',
  'zelda-gb': "Link's Awakening",
  quickman: 'Mega Man 2',
  haggleman: 'Haggle Man',
};
