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
import { galesburgAboveSheet, GALESBURG_ABOVE_PALETTE } from './galesburg-above';
import { galugaAboveSheet, GALUGA_ABOVE_PALETTE } from './galuga-above';
import { WORLD_6_GALESBURG } from '@content/worldmap/world6-galesburg';
import { WORLD_7_GALUGA } from '@content/worldmap/world7-galuga';
import { underworldAboveSheet, UNDERWORLD_ABOVE_PALETTE } from './underworld-above';
import { valleyAboveSheet, VALLEY_ABOVE_PALETTE } from './valley-above';
import { WORLD_8_UNDERWORLD } from '@content/worldmap/world8-underworld';
import { VALLEY_OF_BOWSER } from '@content/worldmap/valley-of-bowser';
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
  // 0.4.53: Galesburg and Galuga Island from above (Worlds 6 and 7's campaign map pages), painted
  // the same way: the first time each page shows (or ahead, while the map idles).
  'galesburg-above': galesburgAboveSheet([WORLD_6_GALESBURG.tiles]),
  'galuga-above': galugaAboveSheet([WORLD_7_GALUGA.tiles]),
  // 0.4.54: THE UNDERWORLD (World 8's campaign page) and the VALLEY OF BOWSER from above, painted
  // the same way. The Valley's sheet is painted only once its page shows, so never while the page
  // is not live (valley-of-bowser.ts VALLEY_LIVE).
  'underworld-above': underworldAboveSheet([WORLD_8_UNDERWORLD.tiles]),
  'valley-above': valleyAboveSheet([VALLEY_OF_BOWSER.tiles]),
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
  'galesburg-above': GALESBURG_ABOVE_PALETTE,
  'galuga-above': GALUGA_ABOVE_PALETTE,
  'underworld-above': UNDERWORLD_ABOVE_PALETTE,
  'valley-above': VALLEY_ABOVE_PALETTE,
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

/**
 * 0.4.53: Galesburg's and Galuga Island's earth tones stay put in the red/green modes, as Hyrule's
 * do (0.4.50): their red shift would turn the town's brick, its wood and the roads' rims, the
 * island's golden rock, its trunks, its track's rim and its brown outline pink or purple. (Hyrule
 * nudged its browns green enough instead; the brick cannot be, and stay brick.) Their true reds,
 * the lacquer, the neon, the alien lair and the warning lights, still shift, so an open level's
 * red space stays apart from the start's green one. By palette role (index 0-9, then a-z).
 *
 * 0.4.54: the same for Zebes's and Transylvania's browns (Brinstar's orange rock and Samus's
 * gunship; the cobbles, the wood and the cave rock), which turned pink, and for THE UNDERWORLD's
 * (its cave dirt, red rock and gnarled wood) and the VALLEY OF BOWSER's lamplight (the windows' and
 * braziers' amber glow; its tan road and grey-blue rock never shift). Their true reds still shift:
 * Norfair's rock and the lava, the magenta brick, the drapes and an open level's space, the
 * plutonium and the warning red, the Valley's lava and the king's banners.
 */
export const KEEP_EARTH_TONES: Readonly<Record<string, string>> = {
  'galesburg-above': '4dhij', // road rim, wood, brick (dark, mid, light)
  'galuga-above': '04dhi', // outline, track rim, trunk, rock (dark, mid)
  'zebes-above': '567', // Brinstar's orange rock (dark, mid, light)
  'transylvania-above': 'ijklmrs', // cave rock (dark, mid, light), cobbles (dark, mid), wood (dark, mid)
  'underworld-above': '123789d', // cave dirt (dark, mid, light), red rock (dark, mid, light), wood
  'valley-above': 'o', // the windows' and braziers' amber glow
};
const ROLES = '0123456789abcdefghijklmnopqrstuvwxyz';
for (const mode of ['deuteranopia', 'protanopia'] as const)
  for (const [sheet, roles] of Object.entries(KEEP_EARTH_TONES)) {
    const book = modes[mode];
    const pal = book?.[sheet];
    const base = defaults[sheet];
    if (book && pal && base)
      book[sheet] = pal.map((c, i) => (roles.includes(ROLES[i] ?? '') ? (base[i] ?? c) : c));
  }

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
      // 0.4.52: Zebes and Transylvania shade theirs in the ground where the world's hero hides
      // (roles 1-2: its shade and main colour): Kraid's moss beside Samus's cavern, the forest's
      // grass beside 5-1 (Simon's crypt), so the silhouette is a faint shadow there too.
      'map-above-zebes': ['#000000', '#1a4422', '#368236'],
      'map-above-transylvania': ['#000000', '#12261c', '#1f402a'],
      // 0.4.53: Galesburg's paving beside 6-2 (Ryu's dojo), Galuga Island's jungle floor beside 7-3
      // (Bill's camp).
      'map-above-galesburg': ['#000000', '#262a40', '#363c5a'],
      'map-above-galuga': ['#000000', '#1a4412', '#2a6418'],
      // 0.4.54: THE UNDERWORLD's moss ledge beside 8-1 (Sophia's garage is reached from 8-1); the
      // VALLEY OF BOWSER's cavern floor (no hero hides there).
      'map-above-underworld': ['#000000', '#263410', '#44621a'],
      'map-above-valley': ['#000000', '#1a2232', '#2a3850'],
    }),
  },
};
