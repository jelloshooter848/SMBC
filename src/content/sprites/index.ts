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
import { localsPalettes, localsDef } from './locals';
import { wandPalettes, wandDef } from './wand';
import { storyPalettes, storyDef } from './story';
import { zelda2SkyDef, zelda2SkyPalettes } from './zelda2-sky';
import { heroItemPalettes, heroItemsDef } from './hero-items';
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
  locals: localsDef,
  wand: wandDef,
  // The 0.4.23 story's opening props: Bowser's star wand, the wax seal, Toad's note.
  story: storyDef,
  // 0.4.24: Link's sky palace above 2-1 (2-1-sky2's campaign look).
  'zelda2-sky': zelda2SkyDef,
  // 0.4.33: the heroes' own pickup items (docs/POWERUPS.md 11).
  'hero-items': heroItemsDef,
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
  ...localsPalettes,
  ...wandPalettes,
  ...storyPalettes,
  ...zelda2SkyPalettes,
  ...heroItemPalettes,
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
