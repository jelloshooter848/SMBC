import { NES, type PaletteBook } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { tilePalettes, tilesDef } from './tiles';
import { fontPalettes, fontDef, fontTints } from './font';
import { itemPalettes, itemsDef } from './items';
import { decorPalettes, decorDef } from './decor';
import { marioPalettes, marioDef } from './mario';
import { enemyPalettes, enemiesDef } from './enemies';
import { linkPalettes, linkDef } from './link';
import { megamanPalettes, megamanDef } from './megaman';
import { samusPalettes, samusDef } from './samus';
import { simonPalettes, simonDef } from './simon';
import { ryuPalettes, ryuDef } from './ryu';
import { billPalettes, billDef } from './bill';
import { mapPalettes, mapDef } from './map';
import { stationPalettes, stationDef } from './station';
import { zebesPalettes, zebesDef } from './zebes';
import { smb3Palettes, smb3Def } from './smb3';
import { cryptPalettes, cryptDef } from './crypt';
import { ninjaPalettes, ninjaDef } from './ninja';
import { contraPalettes, contraDef } from './contra';
import { sophiaPalettes, sophiaDef } from './sophia';
import { bmDungeonDef, bmDungeonPalettes } from './bm-dungeon';
import { partnersPalettes, partnersDef } from './partners';
import { npcsPalettes, npcsDef } from './npcs';
import { localsPalettes, localsDef } from './locals';
import { wandPalettes, wandDef } from './wand';
import { costumePalettes, costumesDef } from './costumes';
import { storyPalettes, storyDef } from './story';
import { housePalettes, houseDef } from './house';
import { zelda2SkyDef, zelda2SkyPalettes } from './zelda2-sky';
import { heroItemPalettes, heroItemsDef } from './hero-items';
import { townDef, townPalettes } from './town';
import { townFolkDef, townFolkPalettes, townHeroDefs } from './town-folk';
import { tsaHouseDef, tsaHousePalettes } from './tsa-house';
import { kingdomPalettes, kingdomSheet } from './kingdom';
import { kingdomLevelDef, kingdomLevelPalettes } from './kingdom-level';
import { WORLD_1_KINGDOM } from '@content/worldmap/world1-kingdom';
import { hyruleAboveSheet, HYRULE_ABOVE_PALETTE } from './hyrule-above';
import { megacityAboveSheet, MEGACITY_ABOVE_PALETTE } from './megacity-above';
import { zebesAboveSheet, ZEBES_ABOVE_PALETTE } from './zebes-above';
import { transylvaniaAboveSheet, TRANSYLVANIA_ABOVE_PALETTE } from './transylvania-above';
import { WORLD_4_ZEBES } from '@content/worldmap/world4-zebes';
import { WORLD_5_TRANSYLVANIA } from '@content/worldmap/world5-transylvania';
import { WORLD_2_HYRULE } from '@content/worldmap/world2-hyrule';
import { WORLD_3_MEGACITY } from '@content/worldmap/world3-megacity';
import {
  dungeonDef,
  dungeonEnemiesDef,
  dungeonEnemiesPalettes,
  dungeonPalettes,
  linkTdDef,
  linkTdPalettes,
} from './dungeon';
import { titleLogoDef, titleLogoPalettes, titleRiftDef } from './title-logo';
import { withSideFrames } from '@game/topdown/frames';
import { colorblindPalettes } from './colorblind';
import { HERO_FX, mapShadeFx } from './palette-fx';

/** `rows` cropped to its drawn pixels (no transparent border). */
function trim(rows: readonly string[]): string[] {
  const ys = rows.map((r, y) => (/[^.]/.test(r) ? y : -1)).filter((y) => y >= 0);
  const xs = rows.flatMap((r) => [...r].map((c, x) => (c === '.' ? -1 : x)).filter((x) => x >= 0));
  if (!ys.length) return [...rows];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  return rows.slice(ys[0], (ys[ys.length - 1] as number) + 1).map((r) => r.slice(x0, x1 + 1));
}

/**
 * Sophia III's sheet plus `portrait`: her `idle` tank cropped to its pixels, for the screens
 * that stand a hero's portrait on a floor line (her tank frames are padded 32x32 for turning).
 */
const sophiaSheet: SpriteDef = {
  ...sophiaDef,
  frames: { ...sophiaDef.frames, portrait: trim(sophiaDef.frames.idle ?? []) },
};

/** All built-in sprite definitions keyed by sheet id. */
export const SPRITES: Record<string, SpriteDef> = {
  tiles: tilesDef,
  font: fontDef,
  items: itemsDef,
  decor: decorDef,
  mario: marioDef,
  enemies: enemiesDef,
  link: linkDef,
  megaman: megamanDef,
  samus: samusDef,
  simon: simonDef,
  ryu: ryuDef,
  bill: billDef,
  map: mapDef,
  // Walls and doors are drawn for the north edge; the top-down kit adds rotated west twins.
  dungeon: withSideFrames(dungeonDef),
  'link-td': linkTdDef,
  'dungeon-enemies': dungeonEnemiesDef,
  station: stationDef,
  zebes: zebesDef,
  smb3: smb3Def,
  crypt: cryptDef,
  ninja: ninjaDef,
  contra: contraDef,
  'title-logo': titleLogoDef,
  'title-rift': titleRiftDef,
  sophia: sophiaSheet,
  // Sophia's overhead dungeon for the top-down kit (north-edge walls and doors, turned like Link's).
  'bm-dungeon': withSideFrames(bmDungeonDef),
  partners: partnersDef,
  // 0.4.40: the folk in every level of Chapter 1 (partners in new colours, and a few new faces).
  npcs: npcsDef,
  locals: localsDef,
  wand: wandDef,
  // 0.4.47: the fake Bowsers' villain costumes (castles 2-4 to 7-4, campaign) and their piles.
  costumes: costumesDef,
  // The 0.4.23 story's opening props: Bowser's star wand, the wax seal, Toad's note.
  story: storyDef,
  // 0.4.36: Mario's house, where the opening plays (story/opening.ts).
  house: houseDef,
  // 0.4.24: Link's sky palace above 2-1 (2-1-sky2's campaign look).
  'zelda2-sky': zelda2SkyDef,
  // 0.4.33: the heroes' own pickup items (docs/POWERUPS.md 11).
  'hero-items': heroItemsDef,
  // 0.4.41: Kakariko Village's tiles (the art layer of its rooms, src/content/town).
  town: townDef,
  // Its townsfolk, and the heroes from above (td-<hero>; Link's is link-td, Sophia III's Jason's).
  'town-folk': townFolkDef,
  ...townHeroDefs,
  // The Top Secret Area's campaign look: the secret house's back wall (decor `tsa-house:wall`).
  'tsa-house': tsaHouseDef,
  // 0.4.48: the Mushroom Kingdom from above (World 1's campaign map page).
  kingdom: kingdomSheet([WORLD_1_KINGDOM.tiles]),
  // 0.4.48: World 1's levels in the Mushroom Kingdom's look: the far hills and the keep's wall.
  'kingdom-level': kingdomLevelDef,
  // 0.4.50: Hyrule and Mega City from above (Worlds 2 and 3's campaign map pages). Each is painted
  // the first time its page shows, never when the game loads (above-kit.ts lazySheet).
  'hyrule-above': hyruleAboveSheet([WORLD_2_HYRULE.tiles]),
  'megacity-above': megacityAboveSheet([[WORLD_3_MEGACITY.tiles, WORLD_3_MEGACITY.zones ?? []]]),
  // 0.4.52: Planet Zebes and Transylvania from above (Worlds 4 and 5's campaign map pages), painted
  // the same way: the first time each page shows (or ahead, while the map idles).
  'zebes-above': zebesAboveSheet([[WORLD_4_ZEBES.tiles, WORLD_4_ZEBES.zones ?? []]]),
  'transylvania-above': transylvaniaAboveSheet([
    [WORLD_5_TRANSYLVANIA.tiles, WORLD_5_TRANSYLVANIA.zones ?? []],
  ]),
};

const defaults: Record<string, readonly string[]> = {
  ...tilePalettes,
  ...fontPalettes,
  ...fontTints,
  ...itemPalettes,
  ...decorPalettes,
  ...marioPalettes,
  ...enemyPalettes,
  ...linkPalettes,
  ...megamanPalettes,
  ...samusPalettes,
  ...simonPalettes,
  ...ryuPalettes,
  ...billPalettes,
  ...mapPalettes,
  ...dungeonPalettes,
  ...linkTdPalettes,
  ...dungeonEnemiesPalettes,
  ...stationPalettes,
  ...zebesPalettes,
  ...smb3Palettes,
  ...cryptPalettes,
  ...ninjaPalettes,
  ...contraPalettes,
  ...titleLogoPalettes,
  ...sophiaPalettes,
  ...bmDungeonPalettes,
  ...partnersPalettes,
  ...npcsPalettes,
  ...localsPalettes,
  ...wandPalettes,
  ...costumePalettes,
  ...storyPalettes,
  ...housePalettes,
  ...zelda2SkyPalettes,
  ...heroItemPalettes,
  ...townPalettes,
  ...townFolkPalettes,
  ...tsaHousePalettes,
  ...kingdomPalettes,
  ...kingdomLevelPalettes,
  // Colour-blind and high-contrast variants come with every palette here (colorblindPalettes).
  'hyrule-above': HYRULE_ABOVE_PALETTE,
  'megacity-above': MEGACITY_ABOVE_PALETTE,
  'zebes-above': ZEBES_ABOVE_PALETTE,
  'transylvania-above': TRANSYLVANIA_ABOVE_PALETTE,
};

// Fallbacks so every theme/character variant the game asks for exists even if art only ships one.
const fallback = (name: string, from: string) => {
  if (!defaults[name] && defaults[from]) defaults[name] = defaults[from] as readonly string[];
};
for (const t of [
  'underground',
  'castle',
  'night',
  'water',
  'snow',
  'treetop',
  'clouds-overworld',
  'castle-overworld',
  'mushroom-red',
])
  fallback(`tiles-${t}`, 'tiles-overworld');
// A swim through a castle: the castle's stone and its water colours.
fallback('tiles-castle-water', 'tiles-castle');
// World 1 as the Mushroom Kingdom (0.4.48): decor and backdrop only, so SMB's own tiles.
fallback('tiles-kingdom', 'tiles-overworld');
fallback('tiles-kingdom-keep', 'tiles-castle');
for (const t of ['underground', 'castle', 'water']) fallback(`enemies-${t}`, 'enemies-overworld');
fallback('koopa-green', 'enemies-overworld');
fallback('koopa-red', 'enemies-overworld');
fallback('decor-night', 'decor-overworld');
fallback('decor-snow', 'decor-overworld');
for (let i = 0; i < 4; i++) {
  fallback(`mario-star-${i}`, 'mario');
  fallback(`link-star-${i}`, 'link');
  fallback(`megaman-star-${i}`, 'megaman');
  fallback(`samus-star-${i}`, 'samus');
  fallback(`simon-star-${i}`, 'simon');
  fallback(`ryu-star-${i}`, 'ryu');
  fallback(`bill-star-${i}`, 'bill');
}
for (let i = 0; i < 3; i++) fallback(`megaman-charge-${i}`, 'megaman');
fallback('mario-fire', 'mario');
fallback('luigi', 'mario');
fallback('luigi-fire', 'mario-fire');
fallback('link-red', 'link');
fallback('link-white', 'link');
fallback('link-blue', 'link');
fallback('samus-varia', 'samus');
for (const w of ['plain', 'saw', 'leaf', 'flame', 'knuckle', 'bolt', 'rush'])
  fallback(`megaman-${w}`, 'megaman');

const modes = colorblindPalettes(defaults);
// High contrast crushes dark greys toward black, which would sink the fake king's true forms'
// dark-grey outline back into the castle's black; give that one outline a mid grey there.
const trueFormHc = modes.highContrast?.['bowser-true-form'];
if (modes.highContrast && trueFormHc)
  modes.highContrast['bowser-true-form'] = trueFormHc.map((c, i) => (i === 1 ? NES.gray : c));
// The same for the costumes' dark grey (index c: Dracula's wig, the ninja's robe, the card's shade).
const costumesHc = modes.highContrast?.costumes;
if (modes.highContrast && costumesHc)
  modes.highContrast.costumes = costumesHc.map((c, i) => (i === 12 ? NES.gray : c));

export const PALETTES: PaletteBook = {
  default: defaults,
  ...modes,
  // The pages drawn from above (0.4.50) shade a hidden hero in their sheet's ground (above-render shadeTheme).
  fx: {
    ...HERO_FX,
    ...mapShadeFx({
      ...mapPalettes,
      'map-above-hyrule': HYRULE_ABOVE_PALETTE,
      'map-above-megacity': MEGACITY_ABOVE_PALETTE,
    }),
  },
};
