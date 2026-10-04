import type { PaletteBook } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { tilePalettes, tilesDef } from './tiles';
import { fontPalette, fontDef } from './font';
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
import { colorblindPalettes } from './colorblind';

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
};

const defaults: Record<string, readonly string[]> = {
  ...tilePalettes,
  font: fontPalette,
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
};

// Fallbacks so every theme/character variant the game asks for exists even if art only ships one.
const fallback = (name: string, from: string) => {
  if (!defaults[name] && defaults[from]) defaults[name] = defaults[from] as readonly string[];
};
for (const t of ['underground', 'castle', 'night', 'water', 'snow', 'treetop'])
  fallback(`tiles-${t}`, 'tiles-overworld');
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

export const PALETTES: PaletteBook = { default: defaults, ...colorblindPalettes(defaults) };
