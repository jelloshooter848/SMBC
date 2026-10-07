import { NES, type PaletteBook } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { tilePalettes, tilesDef } from './tiles';
import { fontPalette, fontDef, fontTints } from './font';
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
import {
  dungeonDef,
  dungeonEnemiesDef,
  dungeonEnemiesPalettes,
  dungeonPalettes,
  linkTdDef,
  linkTdPalettes,
} from './dungeon';
import { withSideFrames } from '@game/topdown/frames';
import { colorblindPalettes } from './colorblind';
import { HERO_FX, mapShadeFx } from './palette-fx';

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
};

const defaults: Record<string, readonly string[]> = {
  ...tilePalettes,
  font: fontPalette,
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
fallback('samus-varia', 'samus');
for (const w of ['plain', 'saw', 'leaf', 'flame', 'knuckle', 'bolt', 'rush'])
  fallback(`megaman-${w}`, 'megaman');

const modes = colorblindPalettes(defaults);
// High contrast crushes dark greys toward black, which would sink the fake king's true forms'
// dark-grey outline back into the castle's black; give that one outline a mid grey there.
const trueFormHc = modes.highContrast?.['bowser-true-form'];
if (modes.highContrast && trueFormHc)
  modes.highContrast['bowser-true-form'] = trueFormHc.map((c, i) => (i === 1 ? NES.gray : c));

export const PALETTES: PaletteBook = {
  default: defaults,
  ...modes,
  fx: { ...HERO_FX, ...mapShadeFx(mapPalettes) },
};
