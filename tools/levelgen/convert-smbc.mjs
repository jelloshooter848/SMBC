// Converts level data from the original Super Mario Bros. Crossover source
// (assets/documents/levelDataSmb.xml, MIT licensed, not committed here) into this project's
// .map format. A map holds the "normal" difficulty as the original builds it for Mario (no level
// flags); `--layers` writes everything else (below).
//
//   node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world2 2-1 2-2 2-3 2-4
//   node tools/levelgen/convert-smbc.mjs --prefix=ll- tools/levelgen/source/levelDataLostLevels.xml src/content/levels/lost/world1 1-1 1-2 1-3 1-4
//   node tools/levelgen/convert-smbc.mjs --prefix=sp- tools/levelgen/source/levelDataSpecial.xml src/content/levels/special/world1 1-1 1-2 1-3 1-4
//
// `--prefix` namespaces every generated id (areas, parents, pipe/vine/pit/warp targets, exits) so
// another game's levels (The Lost Levels: `ll-1-1` ..., Super Mario Bros. Special: `sp-1-1` ...)
// can live next to SMB1's. The prefix also names the map set: `ll-` builds with The Lost Levels'
// rules and themes, `sp-` with Special's (G-020).
//
// The XML is a <LEVELDATA> of <LEVEL ID TIME MAIN_AREA> holding <AREA ID TYPE><MAP> cells:
// a flat comma list of 15 rows × W columns. A cell is `0` or tokens joined by `()`, each
// `name&&Key=Value&&Flag`; `HideOnDifficulties=easynormal` style values hide a token on the
// named difficulties. Crossover-only enemies and helpers are skipped and listed. Last, the few
// one-tile slips in the original data that the owner set to match the NES are applied
// (nes-fixes.mjs, SMB1 maps only).
//
// `--layers` writes, instead of the maps, each area's `<id>.layers` file: what the original builds
// for the other map difficulties (Easy, Hard) and for heroes with level flags (charHorz, charVert,
// BadSwimmer, WideCharacter, poorBowserFighter), as layers over the map (see areaLayers). It never
// touches a .map file, so the maps (and every hand edit in them) stay byte for byte as they are.
//
//   node tools/levelgen/convert-smbc.mjs --layers --maps=src/content/levels/world1 tools/levelgen/source/levelDataSmb.xml src/content/level-layers/world1 1-1 1-2 1-3 1-4
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { MapBuilder } from './lib.mjs';
import { applyNesFixes } from './nes-fixes.mjs';

const args = process.argv.slice(2);
const PREFIX = (args.find((a) => a.startsWith('--prefix='))?.slice(9) ?? '').trim();
const LAYERS = args.includes('--layers');
/** With --layers: where the maps are (to check the layers against them); default the out dir. */
const MAPS_ARG = args.find((a) => a.startsWith('--maps='))?.slice(7);
const [xmlPath, outDir, ...ids] = args.filter((a) => !a.startsWith('--'));
const MAPS_DIR = MAPS_ARG ?? outDir;
if (!xmlPath || !outDir || !ids.length) {
  console.error('usage: convert-smbc.mjs [--prefix=ll-] [--layers] <levelData.xml> <outDir> <levelId>...');
  process.exit(2);
}
if (LAYERS) {
  // Every profile is built: say each warning once.
  const said = new Set();
  const warn = console.warn;
  console.warn = (...a) => {
    const s = a.join(' ');
    if (!said.has(s)) warn((said.add(s), s));
  };
}
/** Lost Levels (`ll-`) runs: 8-4 ends the game, World 9 and each of A-D (10-13) stand alone. */
const LOST = PREFIX === 'll-';
/**
 * Super Mario Bros. Special (`sp-`, G-020; levelDataSpecial.xml, MapPack.Special): eight worlds,
 * 8-4 ends the game as in SMB1, with its own theme table (SPECIAL_THEMES).
 */
const SPECIAL = PREFIX === 'sp-';
const pid = (id) => (id === 'end' ? id : `${PREFIX}${id}`);

/* ---------- parsing ---------- */

function parseLevels(text) {
  const out = new Map();
  for (const m of text.matchAll(/<LEVEL ID="([^"]+)"([^>]*)>([\s\S]*?)<\/LEVEL>/g)) {
    const attrs = Object.fromEntries([...m[2].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const areas = [];
    for (const a of m[3].matchAll(/<AREA ID="([^"]+)" TYPE="([^"]+)">\s*<MAP>([\s\S]*?)<\/MAP>/g)) {
      const cells = a[3].trim().split(',');
      const width = cells.length / 15;
      if (!Number.isInteger(width)) throw new Error(`${m[1]} ${a[1]}: ${cells.length} cells is not 15 rows`);
      const grid = [];
      for (let r = 0; r < 15; r++) grid.push(cells.slice(r * width, (r + 1) * width).map(parseCell));
      areas.push({ id: a[1], type: a[2], width, grid });
    }
    out.set(m[1], { id: m[1], attrs, areas });
  }
  return out;
}

/** Every token of one cell (each difficulty's and each hero's: `visible` picks a profile's). */
function parseCell(cell) {
  cell = cell.trim().replace(/\]$/, '');
  if (cell === '' || cell === '0') return [];
  const toks = [];
  for (const t of cell.split('()')) {
    const [name, ...rest] = t.split('&&');
    const params = {};
    for (const p of rest) {
      const eq = p.indexOf('=');
      if (eq < 0) params[p] = true;
      else params[p.slice(0, eq)] = p.slice(eq + 1);
    }
    toks.push({ name, params });
  }
  return toks;
}

/*
 * Profiles: who the original builds a level for (Level.as buildLevel, 757-787). A profile is a map
 * difficulty (`easy`, `normal`, `hard`: GameSettings.mapDifficulty) and the playing hero's level
 * flags (Character.as): `horz` / `vert` (usesHorzObjs / usesVertObjs: limited reach),
 * `badswimmer` (not isGoodSwimmer), `wide` (isWideCharacter) and `poorbowser`
 * (poorBowserFighter). The base profile, Normal with no flags, is Mario's: a .map file holds it,
 * and only it; `--layers` writes the rest as layers over it.
 */
const FLAGS = ['horz', 'vert', 'badswimmer', 'wide', 'poorbowser'];
const BASE = { d: 'normal', flags: [] };
const profileKey = (p) => [p.d, ...p.flags].join(' ');

/**
 * Whether a token is built for profile `p`, as Level.as decides: HideOnDifficulties names the
 * difficulties it is left out on; determineHelperVisibility (675-693) shows `charHorz` /
 * `charVert` = Show pieces only to heroes with that flag (Show on both: either flag) and drops
 * `=Hide` pieces for them; getPropertyVisibility does the same for `BadSwimmer` (shown when the
 * hero is not a good swimmer) and `WideCharacter`; a `poorBowserFighter` piece is only for those
 * heroes (Simon and Ryu).
 */
function visible(params, p) {
  const has = (f) => p.flags.includes(f);
  if (String(params.HideOnDifficulties ?? '').includes(p.d)) return false;
  const h = params.charHorz;
  const v = params.charVert;
  if (h === 'Hide' && has('horz')) return false;
  if (v === 'Hide' && has('vert')) return false;
  if (h === 'Show' && v === 'Show') {
    if (!has('horz') && !has('vert')) return false;
  } else if (v === 'Show') {
    if (!has('vert')) return false;
  } else if (h === 'Show' && !has('horz')) return false;
  const prop = (val, show) => !((val === 'Hide' && show) || (val === 'Show' && !show));
  if (!prop(params.BadSwimmer, has('badswimmer'))) return false;
  if (!prop(params.WideCharacter, has('wide'))) return false;
  if (params.poorBowserFighter !== undefined && !has('poorbowser')) return false;
  return true;
}

/** A tag that keeps a piece for some heroes only (the base profile's skip log lists them). */
const helperTag = (params) =>
  ['charHorz', 'charVert', 'BadSwimmer', 'WideCharacter'].some((k) => params[k] === 'Show') ||
  params.poorBowserFighter !== undefined;

const built = new Map(); // profile key -> Map(level id -> the level built for that profile)
/**
 * `levels` as the original builds them for profile `p`: each cell's visible tokens only (a level
 * is built the first time it is asked for).
 */
function levelsFor(levels, p) {
  const key = profileKey(p);
  let cache = built.get(key);
  if (!cache) built.set(key, (cache = new Map()));
  return {
    has: (id) => levels.has(id),
    get: (id) => {
      if (!levels.has(id)) return undefined;
      if (!cache.has(id)) cache.set(id, buildFor(levels.get(id), p));
      return cache.get(id);
    },
  };
}

/** One level as the original builds it for profile `p`. */
function buildFor(level, p) {
  const areas = level.areas.map((a) => {
    const helpers = new Map();
    const grid = a.grid.map((row) =>
      row.map((toks) =>
        toks.filter((t) => {
          if (visible(t.params, p)) return true;
          const shown = !String(t.params.HideOnDifficulties ?? '').includes(p.d);
          if (shown && helperTag(t.params)) helpers.set(t.name, (helpers.get(t.name) ?? 0) + 1);
          return false;
        }),
      ),
    );
    return { ...a, grid, helpers };
  });
  return { ...level, areas };
}

const tokensAt = (area, x, y) => area.grid[y]?.[x] ?? [];
const find = (area, pred) => {
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < area.width; x++)
      for (const t of area.grid[y][x]) if (pred(t)) return { x, y, tok: t };
  }
  return null;
};

/* ---------- mapping tables ---------- */

/** Sub-area id suffixes by area type (a second area of the same type gets a 2 appended). */
const AREA_SUFFIX = {
  intro: 'intro',
  pipeBonus: 'bonus',
  coinHeaven: 'sky',
  water: 'water',
  normal: 'exit',
  platform: 'warp',
  castle: 'end',
  underGround: 'under',
};
/** Levels drawn with the night or snow palettes. */
const NIGHT = new Set(['3-1', '3-2', '3-3', '6-1']);
const SNOW = new Set(['6-3']);
/**
 * The Lost Levels' palettes, from the original's theme table for that map pack
 * (GameSuperMarioBros.as): world + area type, then single areas that override it (TG_OVERWORLD
 * entries are listed too: they stop the fall back to the general table below). Snowy nights
 * use the night palette, as SMB1's World 3 does; gray ones the snow palette, as SMB1's 6-3 does
 * (World 9's gray coin heaven too). The orange giant-mushroom skin (TG_MUSHROOM_PLATFORM_ORANGE)
 * is our 'mushroom', TG_CLOUDS 'clouds', TG_CLOUDS_OVERWORLD 'clouds-overworld',
 * TG_OVERWORLD_WATER 'overworld-water', TG_WATER_GRAY 'water-gray' and TG_CASTLE_OVERWORLD
 * 'castle-overworld'.
 */
const LOST_THEMES = {
  2: { normal: 'night', cheepCheep: 'night' },
  3: { normal: 'snow', platform: 'snow', coinHeaven: 'overworld' },
  4: { platform: 'overworld' },
  5: { normal: 'snow' },
  6: { normal: 'overworld' },
  7: { normal: 'night', platform: 'snow' },
  8: { normal: 'mushroom', platform: 'clouds' },
  9: { water: 'overworld-water', coinHeaven: 'snow' },
  10: { normal: 'mushroom', platform: 'clouds' },
  12: { normal: 'night', platform: 'night', cheepCheep: 'night' },
  13: { normal: 'snow' },
};
const LOST_AREA_THEMES = {
  '3-2a': 'overworld',
  '3-2c': 'overworld',
  '5-2a': 'overworld',
  '5-2c': 'overworld',
  '5-2d': 'overworld',
  '10-2a': 'overworld',
  '13-4b': 'overworld',
  '8-1a': 'snow',
  '8-1c': 'snow',
  '12-3a': 'snow',
  '8-1b': 'water',
  // TG_CASTLE on a water area: a swim through the castle.
  '8-4b': 'castle-water',
  '9-3a': 'castle-overworld',
  '9-4a': 'water-gray',
  '10-2c': 'clouds-overworld',
  '11-4b': 'clouds',
};
/**
 * The original's general theme table (no map pack: SMB1's world entries). The Lost Levels fall
 * back to it after their own table, as the original's lookup does (Themes.determineTheme: area,
 * world + type, type in the map pack's table, then the same in the general one), so e.g. their
 * World 4 normal areas get SMB1 World 4's red giant mushrooms (TG_MUSHROOM_PLATFORM) and a World 8
 * water area the castle water (TG_CASTLE_WATER). Our SMB1 maps keep NIGHT/SNOW above.
 */
const GENERAL_THEMES = {
  3: { normal: 'night', platform: 'night', coinHeaven: 'night' },
  4: { normal: 'mushroom-red', platform: 'mushroom' },
  5: { normal: 'snow' },
  6: { normal: 'night', coinHeaven: 'night', platform: 'snow' },
  7: { normal: 'snow' },
  8: { water: 'castle-water' },
};
const GENERAL_AREA_THEMES = { '7-2c': 'overworld' };
/**
 * Super Mario Bros. Special's own entries in the theme table (GameSuperMarioBros.as, themeMapPack =
 * MapPack.Special), before the general table above (G-020). World 8's platform levels are the
 * orange giant mushrooms. Single areas: 2-2c the underground (TG_UNDERGROUND_SCENERY), 3-1b and
 * 6-2e water at night (TG_WATER_NIGHT: our water), 3-2b and 8-3c the orange mushrooms, 4-1b and
 * 4-3b coin heavens (TG_COIN_HEAVEN, _BLUE: the overworld sky), 6-2c a water area underground
 * (TG_UNDERGROUND_WATER: our water), 8-2b plain water (not World 8's castle water) and 8-2c the
 * overworld before a castle wall (TG_OVERWORLD_CASTLE_WALL: our overworld).
 */
const SPECIAL_THEMES = { 8: { platform: 'mushroom' } };
const SPECIAL_AREA_THEMES = {
  '2-2c': 'underground',
  '3-1b': 'water',
  '6-2e': 'water',
  '3-2b': 'mushroom',
  '8-3c': 'mushroom',
  '4-1b': 'overworld',
  '4-3b': 'overworld',
  '6-2c': 'water',
  '8-2b': 'water',
  '8-2c': 'overworld',
};
/** Music for the themes that are not named after a song (by the area type they skin). */
const THEME_MUSIC = {
  night: 'overworld',
  snow: 'overworld',
  mushroom: 'overworld',
  'mushroom-red': 'overworld',
  clouds: 'overworld',
  'clouds-overworld': 'overworld',
  'overworld-water': 'water',
  'water-gray': 'water',
  'castle-overworld': 'castle',
  'castle-water': 'water',
};

// Lost Levels extras: a poison mushroom hurts like an enemy (4/5/6). A Clock in a `?` block is
// `Q` (see tileChar); in a brick or hidden block it is a `block-item` (blockItemOf, below).
const ITEM_BRICK = {
  Coin: 'E',
  MultiCoin: 'C',
  Star: 'S',
  Mushroom: 'P',
  OneUpMushroom: 'L',
  Vine: 'V',
  PoisonMushroom: '5',
  Clock: 'E',
};
const ITEM_Q = { Mushroom: 'M', OneUpMushroom: 'U', Star: '*', PoisonMushroom: '4', Clock: 'Q' };
const ITEM_HIDDEN = { OneUpMushroom: '1', Mushroom: '3', PoisonMushroom: '6', Clock: '2' };
/**
 * Items no tile holds: the block is a coin brick, `?` block or hidden coin block (`E` / `?` /
 * `2`) and a `block-item` spawn puts the item in it (World.blockItems). The Hudson Bee (G-023;
 * Hard only, pickups/HudsonBee.as) in any block; Super Mario Bros. Special's Atom, Hammer and Wing
 * (G-022; ground/Brick.as 420-434), and its one Exploding Rabbit power-up (`rabbit`;
 * Character.fullyPowerup: the hero's top power at once).
 */
const BLOCK_ITEMS = {
  HudsonBee: 'bee',
  Atom: 'atom',
  Hammer: 'hammer',
  Wing: 'wing',
  ExplodingRabbit: 'rabbit',
};
/**
 * A Clock in a brick or hidden block (Special's Easy and Hard layers, a few Lost Levels ones):
 * a `block-item` too (a `?` Clock is `Q`, see tileChar).
 */
const blockItemOf = (name, params) =>
  BLOCK_ITEMS[params.ContainedItem] ??
  (params.ContainedItem === 'Clock' && name !== 'itemBlock' ? 'clock' : undefined);
const MARKERS = {
  enemyGoomba: 'g',
  enemyKoopaGreen: 'k',
  enemyKoopaRed: 'K',
  springRed: 's',
  springGreen: 'y',
  enemyHamBro: 'h',
  enemyHamBroChase: 'n',
  enemyBeetle: 'z',
};
/** Entity types behind the grid markers (src/game/level/tiles.ts DEFAULT_LEGEND). */
const MARKER_TYPES = {
  g: 'goomba',
  k: 'koopa-green',
  K: 'koopa-red',
  s: 'spring',
  h: 'hammer-bro',
  z: 'buzzy',
  y: 'spring-green',
  n: 'hammer-bro-chase',
};
const ENTITIES = {
  // Easy and Hard layers only (none on Normal): our Spike Top (entities/enemies/spike-top.ts).
  enemySpikeTop: 'spike-top',
  // Hard ll-13-4-exit's walking Spinies (our Lakitu's Spiny, entities/enemies).
  enemySpiney: 'spiny',
  enemyCheepFast: 'cheep-red',
  enemyCheepSlow: 'cheep-grey',
  enemyBlooper: 'blooper',
  podoboo: 'podoboo',
  enemyWingedKoopaRed: 'koopa-para-red',
  enemyWingedKoopaGreen: 'koopa-para-green',
  enemyWingedKoopaHorizontalGreen: 'koopa-para-green-h',
  bowserAxe: 'axe',
  // Super Mario Bros. Special's enemies (G-021). Their HideOnDifficulties: in Special a few on
  // Easy and Normal and most on Hard only (e.g. 37 Icicles on Normal, 155 on Hard); in SMB1 and
  // The Lost Levels on Hard only.
  enemyIcicle: 'icicle',
  enemyCrab: 'crab',
  enemyFly: 'fly',
  enemyBarrel: 'barrel',
  enemyFireEnemy: 'fire-enemy',
  // FireBar.as: a label with "Left" turns counter-clockwise (clockwise = false), "Right" clockwise.
  fireBarLeft: 'firebar-ccw',
  fireBarRight: 'firebar',
};
const LIFTS = {
  WaveHorizontal: 'lift-h',
  WaveVertical: 'lift-v',
  StepFall: 'lift-fall',
  ConstantFall: 'lift-down',
  ConstantRise: 'lift-up',
  StepConstantRight: 'lift-right',
};
/**
 * The original's half-tile nudges. `Level.as` reads `shiftRight` / `shiftUp` per object
 * (PROP_SHIFT_RIGHT / PROP_SHIFT_UP, lines 791-794) and, once the object is placed, moves it
 * `TILE_SIZE*.5` right / up (lines 1254-1257): 16 Flash px, 8 px at our scale. Our maps keep
 * whole-tile coordinates (`tileToSub` cannot hold half tiles), so the nudge becomes pixel props
 * `dx=8` / `dy=-8` on the entity line, which `World.makeEntity` and `Lift` add to the spawn.
 * Only types whose spawn reads them get them: piranhas (centred on their pipe), Bowser (centred on
 * his two columns), pipes, the midpoint and the start are already placed where the shifted
 * original object is, and bowserFireBallStart ignores the token in the original (line 1153).
 */
const SHIFTABLE = new Set([
  'goomba',
  'koopa-green',
  'koopa-red',
  'koopa-para-red',
  'koopa-para-green',
  'koopa-para-green-h',
  'cheep-red',
  'cheep-grey',
  'blooper',
  'hammer-bro',
  'hammer-bro-chase',
  'buzzy',
  'icicle',
  'crab',
  'fly',
  'barrel',
  'fire-enemy',
  'spike-top',
  'spiny',
]);
const shiftProps = (params) => ({
  ...(params.shiftRight ? { dx: 8 } : {}),
  ...(params.shiftUp ? { dy: -8 } : {}),
});
/** Entity props with the shift nudge appended (undefined when there are none). */
function withShift(type, params, props) {
  const shift = SHIFTABLE.has(type) ? shiftProps(params) : {};
  const all = { ...props, ...shift };
  return Object.keys(all).length ? all : undefined;
}

const IGNORED = new Set([
  'flag',
  'colorRed',
  'colorLightBlue',
  'railing',
  'fence',
  'gameStateWatch',
  'pullyRopeVertical',
  'pullyRope',
  'treeSmallTrunk',
  'treeBigTrunk',
  'sceneryText_2',
  'sceneryText_3',
  'sceneryText_4',
  // Warp-zone digit labels of The Lost Levels (the warp zone draws its own).
  'sceneryText_1',
  'sceneryText_5',
  'sceneryText_6',
  'sceneryText_7',
  'sceneryText_8',
  'sceneryText_B',
  'sceneryText_C',
  'sceneryText_D',
  // Special 4-2's sign.
  'sceneryText_?',
]);

function themeFor(levelId, type, areaId) {
  // The Lost Levels' table also skins castle and water areas (9-3a, World 9's flooded overworld).
  if (LOST || SPECIAL) {
    const world = Number(levelId.split('-')[0]);
    const key = `${levelId}${areaId}`;
    const skin =
      (LOST ? LOST_AREA_THEMES : SPECIAL_AREA_THEMES)[key] ??
      (LOST ? LOST_THEMES : SPECIAL_THEMES)[world]?.[type] ??
      GENERAL_AREA_THEMES[key] ??
      GENERAL_THEMES[world]?.[type];
    if (skin) return skin;
  }
  if (type === 'castle') return 'castle';
  if (type === 'underGround' || type === 'pipeBonus') return 'underground';
  if (type === 'water') return 'water';
  if (LOST || SPECIAL) return 'overworld';
  if (!LOST && SNOW.has(levelId)) return 'snow';
  if (!LOST && NIGHT.has(levelId)) return 'night';
  return 'overworld';
}

/** The level after `levelId` (8-4 ends the game); levels with an intro scene start there. */
function nextLevel(levelId, levels) {
  const [w, s] = levelId.split('-').map(Number);
  if (w === 8 && s === 4) return 'end';
  // The Lost Levels: World 9 is a bonus world (its 9-4 ends), and A-D (10-13) run as one quest.
  if (LOST && s === 4 && (w === 9 || w === 13)) return 'end';
  const next = s < 4 ? `${w}-${s + 1}` : `${w + 1}-1`;
  if (!levels.has(next)) return 'end';
  return entryId(levels.get(next));
}

/**
 * Where a level is entered: its intro scene, or area "a" when the main area is another one (the
 * original always starts in "a"; Lost Levels 9-1 opens in a small room before the water).
 */
function entryId(level) {
  if (level.areas.some((a) => a.type === 'intro')) return pid(`${level.id}-intro`);
  if (level.attrs.MAIN_AREA !== 'a' && level.areas.some((a) => a.id === 'a')) {
    return pid(`${level.id}-start`);
  }
  return pid(level.id);
}

/** Legend char for a tile token, or null when it is not a tile. */
function tileChar(tok, area, world) {
  const { name, params } = tok;
  const castle = area.type === 'castle';
  // Coin heavens: the original skins them with its TG_COIN_HEAVEN theme groups (normal, night,
  // gray; GameSuperMarioBros.as setUpLevelThemes), whose groundNormal is the NES cloud block. Our
  // themes only recolour, so their ground becomes the cloud-block tile `O` (solid, like `#`).
  const clouds = area.type === 'coinHeaven';
  // Platform and bridge levels are treetops, except World 4's giant mushrooms.
  // (The Lost Levels draw every platform level as treetops; Special's are giant mushrooms where its
  // theme is one, convertArea's area.theme.)
  const mushrooms = SPECIAL ? String(area.theme).startsWith('mushroom') : !LOST && world === 4;
  const trees = (area.type === 'platform' || area.type === 'cheepCheep') && !mushrooms;
  switch (name) {
    case 'groundNormal':
    case 'groundWideNormal':
    case 'groundSinglePiece':
    case 'groundCoral':
      if (clouds) return 'O';
      return castle ? '%' : '#';
    case 'groundBlock':
    case 'boxGray':
    case 'groundFlagPoleBlock':
      return 'B';
    case 'brick':
      return ITEM_BRICK[params.ContainedItem] ?? '=';
    case 'itemBlock':
      return ITEM_Q[params.ContainedItem] ?? '?';
    case 'itemBlockInvisible':
      return ITEM_HIDDEN[params.ContainedItem] ?? '2';
    case 'coin':
      return '$';
    case 'groundPipeTopLeft':
      return '[';
    case 'groundPipeTopRight':
      return ']';
    case 'groundPipeMidLeft':
      return '{';
    case 'groundPipeMidRight':
      return '}';
    // A pipe hanging from the ceiling (The Lost Levels): its rim is at the bottom.
    case 'groundPipeBottomLeft':
      return 'D';
    case 'groundPipeBottomRight':
      return 'G';
    case 'groundPipeEndLeftTop':
      return '(';
    case 'groundPipeEndLeftBottom':
      return '<';
    case 'groundPipeMidRightSide':
    case 'groundPipeIntTop':
      return ')';
    // A sideways pipe opening to the right, and its junction on the left (Hard layers of 1-2 and
    // 6-2, many Lost Levels areas): no mirrored tiles (the tile list only grows at its end, and
    // the key box must stay last), so they are the left-facing pieces' tiles: solid all the same.
    case 'groundPipeEndRightTop':
      return '(';
    case 'groundPipeEndRightBottom':
      return '<';
    case 'groundPipeIntRightTop':
      return ')';
    case 'groundPipeIntRightBottom':
      return '>';
    case 'groundPipeMidLeftSide':
    case 'groundPipeIntBottom':
      return '>';
    case 'flagPole':
      return '!';
    case 'flagPoleTop':
      return 'o';
    case 'groundMushroom':
    case 'groundMushroomSinLft':
    case 'groundMushroomSinRht':
      return trees ? 'T' : 'm';
    case 'standardPlatformStem':
    case 'standardPlatformStemSin':
    case 'standardPlatformStemMidTop':
    case 'standardPlatformStemRhtTop':
    case 'standardPlatformStemMid':
      return trees ? 't' : 'i';
    case 'wavesLava':
      return '~';
    case 'groundBillBlasterTop':
      return '^';
    case 'castleWallTopLft':
    case 'castleWallTopMid':
    case 'castleWallTopRht':
      return 'A';
    case 'castleWallLft':
    case 'castleWallMid':
    case 'castleWallRht':
      return 'H';
    case 'groundBillBlasterMiddle':
    case 'groundBillBlasterBottom':
      return '|';
    case 'wavesDay':
    case 'wavesNight':
      return 'w';
    case 'bowserBridge':
    case 'groundRail':
      return '-';
    case 'bridgeChain':
      return ':';
    default:
      return null;
  }
}

/* ---------- one area ---------- */

/**
 * Whether the hero drops into a bonus room from its top row at its playerStart's column (SMB1's
 * and The Lost Levels' rooms on Easy and Normal: a gap in the ceiling over that column). Special's
 * rooms on every difficulty and SMB1's and The Lost Levels' on Hard are closed above, so a pipe in
 * comes out of the room's matching pipe end or puts the hero at its playerStart (RC-001).
 */
const dropsIn = (type, profile) => type === 'pipeBonus' && !SPECIAL && profile.d !== 'hard';

function convertArea(level, area, id, levels, profile) {
  const levelId = level.id;
  const [world, stage] = levelId.split('-').map(Number);
  const isMain = area.id === level.attrs.MAIN_AREA;
  const theme = themeFor(levelId, area.type, area.id);
  area.theme = theme;
  // Special's single-area skins keep the music of their area type (the playlist goes by type:
  // GameSuperMarioBros.createPlayList), e.g. 2-2c's underground look over the overworld tune.
  const typeMusic =
    SPECIAL && SPECIAL_AREA_THEMES[`${levelId}${area.id}`]
      ? ({ underGround: 'underground', pipeBonus: 'underground', water: 'water', castle: 'castle' }[
          area.type
        ] ?? 'overworld')
      : null;
  const music = typeMusic ?? THEME_MUSIC[theme] ?? theme;
  const header = {
    id,
    name: `WORLD ${levelId}`,
    world,
    stage,
    theme,
    music,
    time: isMain ? Number(level.attrs.TIME) : 'inherit',
  };
  const b = new MapBuilder(area.width, header);
  const skipped = new Map();
  const skip = (name) => skipped.set(name, (skipped.get(name) ?? 0) + 1);
  // Crossover pieces only built for other heroes (see visible).
  for (const [name, n] of area.helpers ?? []) skipped.set(`${name}(helper)`, n);

  let start = null;
  let levelExit = null;
  let warpText = null;
  let vineStart = null;
  let pitEnd = null;
  let pitStart = null;
  const cheepStarts = []; // leaping Cheep Cheep stretches (an area may have several)
  const cheepEnds = [];
  const bulletZone = { start: null, end: null };
  let bowserFire = null; // bowserFireBallStart: Bowser's flames fly in from this column on
  const vines = []; // vine bricks: { x, y, dest }
  const vertEnds = new Map(); // transporter number -> pipe top-left tile
  const pipes = []; // outgoing transporters
  const castles = []; // { big, x, y }
  const bushRuns = new Map(); // row -> [[x0, len]]
  const pulleys = []; // { x, y, side }
  const lakitus = []; // lakituStart tokens
  const lakituEnds = []; // lakituEnd / lakituEndMiddle columns
  const teleports = new Map(); // number -> { start, end, check }: { x, ys }
  const balances = []; // Pully platforms: { x, y, len }

  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < area.width; x++) {
      // An enemy sharing its cell with a tile (a Hammer Bro in front of a castle wall, a Koopa
      // over a coin) keeps both: it becomes an entity line instead of a grid marker.
      const cellMarkers = [];
      for (const tok of tokensAt(area, x, y)) {
        const { name, params } = tok;
        const ch = tileChar(tok, area, world);
        if (ch) {
          // Water and lava are a background layer: they never cover a tile (9-1's flag ball).
          if ((ch === 'w' || ch === '~') && b.rows[y][x] !== '.') continue;
          // Two `?` blocks on one cell (Lost Levels 9-1, 24,9 on normal: a Clock block and a
          // coin block; Level.as builds one ItemBlock per token): `Q` is that pair.
          if (ch === '?' && b.rows[y][x] === 'Q') continue;
          // A Clock block on its own (Easy and Hard layers): a `?` holding the Clock (`Q` is the
          // Clock-and-coin pair).
          const solo = ch === 'Q' && !tokensAt(area, x, y).some((t) => tileChar(t, area, world) === '?');
          b.set(x, y, solo ? '?' : ch);
          if (solo) b.entity('block-item', x, y, { item: 'clock' });
          const item = blockItemOf(name, params);
          if (item && (name === 'brick' || name === 'itemBlockInvisible' || name === 'itemBlock')) {
            b.set(x, y, name === 'brick' ? 'E' : name === 'itemBlock' ? '?' : '2');
            b.entity('block-item', x, y, { item });
          }
          if (ch === 'V') vines.push({ x, y, dest: params.pTransDest, number: params.number });
          continue;
        }
        if (MARKERS[name]) {
          cellMarkers.push({ m: MARKERS[name], props: withShift(MARKER_TYPES[MARKERS[name]], params) });
          continue;
        }
        if (ENTITIES[name]) {
          b.entity(ENTITIES[name], x, y, withShift(ENTITIES[name], params));
          continue;
        }
        switch (name) {
          case 'enemyBowser':
          case 'enemyBowserFake': {
            // Later castles' Bowsers throw hammers (Hammer) or hammers and fire (FireballHammer).
            const attack = { Hammer: 'hammer', FireballHammer: 'both' }[params.BowserType];
            // A fake Bowser (The Lost Levels) fights like one but isn't the bridge's boss.
            const props = {
              ...(attack ? { attack } : {}),
              ...(name === 'enemyBowserFake' ? { fake: 1 } : {}),
            };
            b.entity('bowser', x, y, Object.keys(props).length ? props : undefined);
            break;
          }
          // A red plant (PiranhaRed) gets `red=1`: it comes out with the player closer to its
          // pipe. Green ones carry no prop, so their lines stay as they were.
          case 'enemyPiranhaGreen':
          case 'enemyPiranhaRed':
            // the token sits above the pipe's top-left tile
            b.entity('piranha', x, y + 1, name === 'enemyPiranhaRed' ? { red: 1 } : undefined);
            break;
          case 'enemyPiranhaRedUpsideDown':
          case 'enemyPiranhaGreenUpsideDown':
            // The Lost Levels' hanging piranha: the token shares the cell of the pipe's
            // bottom-left rim tile (groundPipeBottomLeft), so it is placed there unchanged.
            b.entity('piranha-down', x, y, name === 'enemyPiranhaRedUpsideDown' ? { red: 1 } : undefined);
            break;
          case 'peach':
            b.entity('princess', x, y);
            break;
          case 'toad':
            // Toad waits past the axe of every castle but the last. The Crossover's Lost Levels
            // data keeps Toad in 8-4 too, but the NES game ends 8-4 with the princess: a castle
            // whose level ends the game (next=end) gets her instead.
            b.entity(nextLevel(levelId, levels) === 'end' ? 'princess' : 'toad', x, y);
            break;
          case 'lakituStart':
            lakitus.push({ x, y });
            break;
          case 'lakituEnd':
          case 'lakituEndMiddle':
            lakituEnds.push({ x, middle: name === 'lakituEndMiddle' });
            break;
          case 'teleporterStart':
          case 'teleporterStartOne':
          case 'teleporterEnd':
          case 'teleporterCheckPoint': {
            const n = String(params.number ?? '0');
            const t = teleports.get(n) ?? {};
            if (name === 'teleporterCheckPoint') {
              // Every column is its own checkpoint (with the rows it covers).
              const checks = (t.checks ??= new Map());
              const c = checks.get(x) ?? { x, ys: [] };
              c.ys.push(y);
              checks.set(x, c);
            } else {
              const key = name === 'teleporterEnd' ? 'end' : 'start';
              const e = t[key] ?? { x, ys: [] };
              if (e.x !== x) console.warn(`${id}: teleporter ${n} ${key} spans columns ${e.x} and ${x}`);
              e.ys.push(y);
              t[key] = e;
              if (name === 'teleporterStartOne') t.any = true;
            }
            teleports.set(n, t);
            break;
          }
          case 'pullyCornerLeft':
          case 'pullyCornerRight':
            pulleys.push({ x, y, side: name === 'pullyCornerLeft' ? 'left' : 'right' });
            break;
          case 'movingPlatform': {
            // `width` is in half tiles; our `len` counts 8 px segments too.
            const len = Math.max(1, Number(params.width ?? 6));
            if (params.type === 'Pully') {
              balances.push({ x, y, len });
              break;
            }
            const kind = LIFTS[params.type] ?? 'lift-h';
            const props = { len };
            if (kind === 'lift-h') props.range = 3;
            if (kind === 'lift-v') props.range = 6;
            // The original centres a lift on its cell: Level.as places a Platform at
            // `currentX + TILE_SIZE/2`, `currentY` (lines 1205-1207), and the platform clip's HRect
            // (Platform.setColPoints, hMidX = x) spans -w/2..w/2 around it with its top at y in
            // every width frame. Ours is placed by its top-left corner, so `dx` moves it from the
            // cell's left edge to `8 - len*4` px (half the cell minus half the lift), plus the
            // shift nudges above: the lift's centre is then the original's x, its top the
            // original's y.
            const dx = 8 - len * 4 + (params.shiftRight ? 8 : 0);
            if (dx) props.dx = dx;
            if (params.shiftUp) props.dy = -8;
            b.entity(kind, x, y, props);
            break;
          }
          case 'castleSmall':
            castles.push({ big: false, x, y });
            break;
          case 'castleBig':
            castles.push({ big: true, x, y });
            break;
          // Scenery anchors in the original sit on the centre column; ours use the bottom-left tile.
          case 'hillMedium':
          case 'hillBig':
            // hillBig: Special's taller hill (no art of its own: the big hill).
            b.dec('hill-big', x - 2, y);
            break;
          case 'hillSmall':
            b.dec('hill-small', x - 1, y);
            break;
          case 'cloudSingle':
          case 'cloudDouble':
          case 'cloudTriple':
            b.dec(`cloud-${{ cloudSingle: 1, cloudDouble: 2, cloudTriple: 3 }[name]}`, x - 1, y - 1);
            break;
          // Special's small cloud (no art of its own: the single cloud).
          case 'cloudSmall':
            b.dec('cloud-1', x - 1, y - 1);
            break;
          case 'treeSmallTop':
            b.dec('tree-small', x, y + 1); // ours anchor on the trunk tile
            break;
          case 'treeBigTop':
            b.dec('tree-big', x, y + 1);
            break;
          case 'bushGreen': {
            const runs = bushRuns.get(y) ?? [];
            const last = runs[runs.length - 1];
            if (last && last[0] + last[1] === x) last[1]++;
            else runs.push([x, 1]);
            bushRuns.set(y, runs);
            break;
          }
          case 'playerStart':
            // Level.as puts the hero's middle on the cell's middle, plus half a tile with
            // shiftRight: in Special's bonus rooms that is the line between this column and the
            // next, and on Hard those rooms' floors have holes in every other column (this one).
            // Our arrivals centre the hero in a column, so a shifted start there is the next one.
            start = { x: SPECIAL && area.type === 'pipeBonus' && params.shiftRight ? x + 1 : x, y };
            break;
          case 'halfwayPoint':
            // LOCKED_CP levels (castles, SMB1 World 8, Lost Levels 7-4 to 8-4) have no halfway
            // start on normal difficulty in the original (Level.as shouldStartAtCheckPoint).
            // The row is kept: the respawn puts the feet on the bottom of the midpoint's cell
            // (Level.as hwPnt = currentY + TILE_SIZE, lines 1068-1072); ll-5-3's is on row 9.
            // Easy and Hard open them (Level.as:1454: mapDifficulty HARD or EASY).
            if (level.attrs.LOCKED_CP !== 'True' || profile.d !== 'normal') b.zone(`checkpoint ${x} ${y}`);
            break;
          case 'levelExit':
            levelExit = { x, y };
            break;
          case 'vineStart':
            vineStart = { x, y };
            break;
          case 'pitTransferStart':
            pitStart = { x, y, dest: params.pTransDest };
            break;
          case 'pitTransferEnd':
            pitEnd = { x, y };
            break;
          case 'flyingCheepStart':
            cheepStarts.push(x);
            break;
          case 'flyingCheepEnd':
            cheepEnds.push(x);
            break;
          case 'bulletBillStart':
            bulletZone.start = x;
            break;
          case 'bulletBillEnd':
            bulletZone.end = x;
            break;
          case 'bowserFireBallStart':
            // Level.as bfbX: once the player reaches it, an off-screen Bowser's flames fly in.
            bowserFire = Math.min(bowserFire ?? x, x);
            break;
          case 'fireBarLongLeft':
          case 'fireBarLongRight':
            // FireBar.as: "Left" is counter-clockwise, "Right" clockwise (see ENTITIES).
            b.entity(name === 'fireBarLongLeft' ? 'firebar-ccw' : 'firebar', x, y, { len: 12 });
            break;
          case 'pipeTransporterGlobalVertEnd':
            vertEnds.set(String(params.number ?? '1'), { x, y });
            break;
          case 'pipeTransporterGlobalVert':
          case 'pipeTransporterGlobalHorz':
            pipes.push({
              x,
              y,
              dir: name.endsWith('Horz') ? 'right' : 'down',
              dest: params.pTransDest,
              number: params.number,
            });
            break;
          case 'sceneryText_WelcomeToWarpZone':
            warpText = { x, y };
            break;
          default:
            if (!IGNORED.has(name)) skip(name);
        }
      }
      // A shifted enemy needs its nudge props, so it gets an entity line too.
      for (const c of cellMarkers) {
        if (b.rows[y][x] === '.' && c === cellMarkers[0] && !c.props) b.set(x, y, c.m);
        else b.entity(MARKER_TYPES[c.m], x, y, c.props);
      }
    }
  }

  // Bushes: the original places one token per tile; ours are 2-4 tiles wide (bush-1..3).
  for (const [y, runs] of bushRuns) {
    for (const [x, len] of runs) b.dec(`bush-${Math.min(3, Math.max(1, len - 1))}`, x, y);
  }
  // Balance lifts: a left pulley and the next right pulley on the same row share a rope; the
  // two platforms hang under them (their left columns match the pulley columns).
  for (const left of pulleys.filter((q) => q.side === 'left')) {
    const right = pulleys.find((q) => q.side === 'right' && q.y === left.y && q.x > left.x);
    const a = balances.find((q) => q.x === left.x);
    const c = right && balances.find((q) => q.x === right.x);
    if (!right || !a || !c) {
      console.warn(`${id}: unpaired balance lift at ${left.x},${left.y}`);
      continue;
    }
    b.entity('balance', a.x, a.y, { x2: c.x, y2: c.y, len: a.len, top: left.y });
    a.used = true;
    c.used = true;
  }
  for (const q of balances)
    if (!q.used) console.warn(`${id}: balance platform without a rope at ${q.x},${q.y}`);
  // Each Lakitu leaves at the first end marker after its start.
  // An end marker named "Middle" makes that Lakitu fly at mid-screen height.
  lakituEnds.sort((a, c) => a.x - c.x);
  for (const l of lakitus) {
    const end = lakituEnds.find((e) => e.x > l.x);
    b.entity('lakitu', l.x, l.y, { end: end?.x ?? area.width, ...(end?.middle ? { mid: 1 } : {}) });
  }
  // Castle mazes: each numbered teleporter moves the player from its start column to its end
  // column once its checkpoints were passed: all of them (Start) or any one (StartOne).
  for (const [n, t] of [...teleports].sort((a, c) => Number(a[0]) - Number(c[0]))) {
    if (!t.start || !t.end) {
      console.warn(`${id}: teleporter ${n} needs a start and an end`);
      continue;
    }
    const span = (e) => [Math.min(...e.ys), Math.max(...e.ys)];
    const checks = t.checks ? [...t.checks.values()].sort((a, c) => a.x - c.x) : [];
    const check = checks.length ? ` check=${checks.map((c) => `${c.x}:${span(c).join(':')}`).join(',')}` : '';
    b.zone(`loop ${t.start.x} ${span(t.start).join(' ')} -> ${t.end.x}${check}${t.any ? ' any' : ''}`);
  }
  // Castles: a big castle is drawn as a small one on top of a big base; keep one entity.
  let door = null;
  for (const c of castles) {
    if (!c.big && castles.some((o) => o.big && o.x === c.x)) continue;
    b.entity(c.big ? 'decor-castle-big' : 'decor-castle', c.x - (c.big ? 4 : 2), c.y);
    door = c.x;
  }
  if (levelExit) {
    // The flag walk ends 6 tiles right of the exit marker, in the castle door.
    const exitX = door !== null ? door - 6 : levelExit.x;
    b.zone(`exit ${exitX} next=${nextLevel(levelId, levels)}`);
  }
  cheepStarts.sort((a, c) => a - c);
  cheepEnds.sort((a, c) => a - c);
  for (const s of cheepStarts) {
    const end = cheepEnds.find((e) => e > s) ?? area.width;
    b.zone(`cheeps ${s} ${end - s}`);
  }
  if (bulletZone.start !== null) {
    b.zone(`bullets ${bulletZone.start} ${(bulletZone.end ?? area.width) - bulletZone.start}`);
  }
  if (bowserFire !== null) b.zone(`bowser-fire ${bowserFire}`);
  if (vineStart) b.entity('vine', vineStart.x, vineStart.y, { len: 8 });

  // How the player arrives decides the start mode.
  const pipeExit = [...vertEnds.values()][0];
  // Special's bonus rooms are closed above (no ceiling gap to drop through, unlike SMB1's and The
  // Lost Levels'): the hero starts at the room's playerStart (Level.as), and a pipe in comes out
  // of its matching pipe end (linkAreas). On Hard, SMB1's and The Lost Levels' rooms are closed
  // too (their Hard pieces lay a ceiling and an entry pipe), so they take the same rule (RC-001).
  if (dropsIn(area.type, profile)) {
    header.start = `${start?.x ?? 1},0`;
    header.startMode = 'fall';
    header.camera = area.width <= 16 ? 'locked' : 'scroll';
  } else if (area.type === 'intro') {
    header.start = `${start?.x ?? 2},${start?.y ?? 12}`;
    header.startMode = 'autowalk';
    header.camera = 'locked';
  } else if (vineStart) {
    header.start = `${vineStart.x},${vineStart.y}`;
    header.startMode = 'climb';
    header.camera = 'scroll';
  } else if (!isMain && pipeExit) {
    header.start = `${pipeExit.x},${pipeExit.y - 1}`;
    header.startMode = 'pipe-exit';
    header.camera = 'scroll';
  } else {
    const sx = start?.x ?? 2;
    const sy = start?.y ?? 12;
    const below = tokensAt(area, sx, sy + 1).some((t) => {
      const c = tileChar(t, area, world);
      return c && c !== '$' && c !== 'w';
    });
    header.start = `${sx},${sy}`;
    // A Hard SMB1 or Lost Levels bonus room: at the playerStart under its entry pipe (RC-001).
    const closed = area.type === 'pipeBonus' && !SPECIAL;
    header.startMode = below || closed ? 'stand' : 'fall';
    header.camera = area.width <= 16 ? 'locked' : 'scroll';
  }
  if (!isMain) header.parent = pid(levelId);
  // No scrollStop: the camera may reach the level's real end (scrollStop is its right edge).

  return {
    id,
    builder: b,
    pipes,
    vertEnds,
    warpText,
    skipped,
    start,
    area,
    vineStart,
    pitEnd,
    pitStart,
    vines,
  };
}

/* ---------- links between areas ---------- */

/** Every area of level `levelId`, built for `profile` (default: the base profile). */
function convertLevel(levelId, allLevels, profile = BASE) {
  const levels = levelsFor(allLevels, profile);
  const level = levels.get(levelId);
  const used = new Map();
  const ids = level.areas.map((a) => {
    if (a.id === level.attrs.MAIN_AREA) return pid(level.id);
    if (a.id === 'a' && a.type !== 'intro') return pid(`${level.id}-start`);
    const suffix = AREA_SUFFIX[a.type] ?? a.id;
    const n = (used.get(suffix) ?? 0) + 1;
    used.set(suffix, n);
    return pid(`${level.id}-${suffix}${n > 1 ? n : ''}`);
  });
  const converted = level.areas.map((a, i) => convertArea(level, a, ids[i], levels, profile));
  const byAreaId = new Map(level.areas.map((a, i) => [a.id, converted[i]]));
  for (const c of converted) {
    for (const v of c.vines) {
      const t = byAreaId.get(v.dest);
      if (!t) {
        console.warn(`${c.id}: vine at ${v.x},${v.y} to unknown area ${v.dest}`);
        continue;
      }
      // A vine with a `number` (Special 4-1 and 4-3: Vine.as globPipeExInt) arrives like a pipe:
      // the hero rises out of the target's pipe end with that number (Character.checkVinePosition
      // -> levelTransfer(dest, vineExInt)), whichever the profile builds (charVert pieces).
      if (v.number !== undefined && t.vertEnds.has(String(v.number))) {
        const e = t.vertEnds.get(String(v.number));
        c.builder.zone(`vine ${v.x} ${v.y} -> ${t.id} ${e.x} ${e.y - 1} exit=up`);
        continue;
      }
      if (!t.vineStart) {
        // No vine to climb there and no pipe end: the hero starts as the area starts.
        const [sx, sy] = t.builder.header.start.split(',');
        const exit = { 'pipe-exit': 'up', fall: 'fall' }[t.builder.header.startMode] ?? 'none';
        c.builder.zone(`vine ${v.x} ${v.y} -> ${t.id} ${sx} ${sy} exit=${exit}`);
        continue;
      }
      c.builder.zone(`vine ${v.x} ${v.y} -> ${t.id} ${t.vineStart.x} ${t.vineStart.y}`);
    }
    if (c.pitStart) {
      const t = byAreaId.get(c.pitStart.dest);
      if (!t?.pitEnd)
        console.warn(`${c.id}: pit transfer to area ${c.pitStart.dest} without a pitTransferEnd`);
      else c.builder.zone(`pit 0 -> ${t.id} ${t.pitEnd.x} ${t.pitEnd.y}`);
    }
    const warpPipes = [];
    for (const p of c.pipes.sort((a, b) => a.x - b.x)) {
      const dest = p.dest;
      if (levels.has(dest)) {
        // A warp to another level lands at that level's start.
        const target = levels.get(dest);
        const main = target.areas.find((a) => a.id === target.attrs.MAIN_AREA);
        const ps = find(main, (t) => t.name === 'playerStart') ?? { x: 2, y: 12 };
        c.builder.zone(`pipe ${p.x} ${p.y} ${p.dir} -> ${pid(dest)} ${ps.x} ${ps.y}`);
        warpPipes.push({ x: p.x, world: Number(dest.split('-')[0]) });
        continue;
      }
      const t = byAreaId.get(dest);
      if (!t) {
        console.warn(`${c.id}: pipe at ${p.x},${p.y} to unknown area ${dest}`);
        continue;
      }
      if (dropsIn(t.area.type, profile)) {
        c.builder.zone(`pipe ${p.x} ${p.y} ${p.dir} -> ${t.id} ${t.start?.x ?? 1} 0 exit=none`);
      } else if (p.number !== undefined && t.vertEnds.has(String(p.number))) {
        const e = t.vertEnds.get(String(p.number));
        c.builder.zone(`pipe ${p.x} ${p.y} ${p.dir} -> ${t.id} ${e.x} ${e.y - 1} exit=up`);
      } else {
        // Into a closed bonus room (Special's; SMB1's and The Lost Levels' on Hard) with no matching
        // pipe end: at its playerStart, standing there (ground under it) or dropping in down its
        // column (SMB1-style rooms' gap in the ceiling).
        const ground =
          t.start &&
          tokensAt(t.area, t.start.x, t.start.y + 1).some((k) => {
            const ch = tileChar(k, t.area, Number(level.id.split('-')[0]));
            return ch && ch !== '$' && ch !== 'w';
          });
        // A Hard SMB1 or Lost Levels room's playerStart is just under its entry pipe, with its
        // ceiling closed: the hero is put there (exit=stand; the map's own start mode is Normal's
        // drop) and falls to the floor, as Level.as puts him. A `fall` comes from above the
        // screen, onto the roof (RC-001).
        const exit = t.area.type !== 'pipeBonus' ? 'none' : !SPECIAL ? 'stand' : !ground ? 'fall' : 'none';
        c.builder.zone(
          `pipe ${p.x} ${p.y} ${p.dir} -> ${t.id} ${t.start?.x ?? 2} ${t.start?.y ?? 12} exit=${exit}`,
        );
      }
    }
    if (c.warpText && warpPipes.length) {
      const worlds = warpPipes.map((w) => w.world).join(',');
      c.builder.zone(`warp ${c.area.width - 16} 16 worlds=${worlds} text=WELCOME_TO_WARP_ZONE!`);
    }
    c.builder.entities.sort((a, b) => a.x - b.x || a.y - b.y);
    c.builder.decor.sort((a, b) => Number(a.split(' ')[1]) - Number(b.split(' ')[1]));
  }
  return converted;
}

/* ---------- layers (--layers) ---------- */

const MARKER_CHARS = new Set(Object.keys(MARKER_TYPES));
const entityLine = (e) =>
  `${e.type} ${e.x} ${e.y}${
    e.props
      ? ' ' +
        Object.entries(e.props)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      : ''
  }`;
/** An entity line's `type x y` (what a layer's `- type x y` takes out). */
const entityKey = (line) => line.split(' ').slice(0, 3).join(' ');

/** A built area as rows of tile chars (markers become spawns, as parseTextMap reads them). */
function stateOf(b) {
  const rows = b.rows.map((r) => [...r]);
  const ents = b.entities.map(entityLine);
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (!MARKER_CHARS.has(ch)) continue;
      ents.push(`${MARKER_TYPES[ch]} ${x} ${y}`);
      rows[y][x] = '.';
    }
  const start = `${b.header.start.replace(',', ' ')} ${b.header.startMode}`;
  return { rows, ents, zones: [...b.zones], decor: [...b.decor], header: JSON.stringify(b.header), start };
}

/** `s` with layer `l` laid: its cells set, its spawns and zones taken out, then added. */
function applyLayer(s, l) {
  const rows = s.rows.map((r) => [...r]);
  for (const c of l.cells) rows[c.y][c.x] = c.ch;
  const gone = new Set(l.removes);
  const out = new Set(l.zonesOut);
  return {
    ...s,
    rows,
    ents: s.ents.filter((e) => !gone.has(entityKey(e))).concat(l.adds),
    zones: s.zones.filter((z) => !out.has(z)).concat(l.zonesIn),
    start: l.start ?? s.start,
  };
}

/** Lines of `a` and `b` grouped by `key`, for the keys whose lines differ. */
function changedKeys(a, b, key) {
  const group = (list) => {
    const m = new Map();
    for (const l of list) m.set(key(l), [...(m.get(key(l)) ?? []), l]);
    return m;
  };
  const ga = group(a);
  const gb = group(b);
  const out = [];
  for (const k of new Set([...ga.keys(), ...gb.keys()])) {
    const la = (ga.get(k) ?? []).slice().sort().join('\n');
    const lb = (gb.get(k) ?? []).slice().sort().join('\n');
    if (la !== lb) out.push({ key: k, had: ga.has(k), lines: gb.get(k) ?? [] });
  }
  return out;
}

/** The layer that turns `from` into `to` (null when they are the same). */
function diffLayer(from, to, d, flags) {
  const cells = [];
  for (let y = 0; y < to.rows.length; y++)
    for (let x = 0; x < to.rows[y].length; x++)
      if (from.rows[y][x] !== to.rows[y][x]) cells.push({ x, y, ch: to.rows[y][x] });
  const removes = [];
  const adds = [];
  for (const c of changedKeys(from.ents, to.ents, entityKey)) {
    if (c.had) removes.push(c.key);
    adds.push(...c.lines);
  }
  const zonesOut = [];
  const zonesIn = [];
  for (const c of changedKeys(from.zones, to.zones, (z) => z)) {
    if (c.had) zonesOut.push(c.key);
    zonesIn.push(...c.lines);
  }
  const start = from.start === to.start ? null : to.start;
  if (!cells.length && !removes.length && !adds.length && !zonesOut.length && !zonesIn.length && !start)
    return null;
  return { d, flags, cells, removes, adds, zonesOut, zonesIn, start };
}

/** Every non-empty subset of FLAGS, smallest first (then in FLAGS order). */
const SUBSETS = (() => {
  const out = [];
  for (let m = 1; m < 1 << FLAGS.length; m++) out.push(FLAGS.filter((_, i) => m & (1 << i)));
  const rank = (s) => s.map((f) => FLAGS.indexOf(f));
  return out.sort((a, b) => a.length - b.length || String(rank(a)).localeCompare(String(rank(b))));
})();

/**
 * Area states of level `levelId` for every profile, by profile key then area id. The NES fixes
 * are applied to each (quietly: a profile that changes a fixed cell keeps its own tile).
 */
function profileStates(levelId, levels) {
  const out = new Map();
  for (const d of ['easy', 'normal', 'hard'])
    for (const flags of [[], ...SUBSETS]) {
      const p = { d, flags };
      const areas = new Map();
      for (const c of convertLevel(levelId, levels, p)) {
        applyNesFixes(c.id, c.builder, true);
        const state = stateOf(c.builder);
        // What this profile's build skipped (helpers for other heroes aside), for the log.
        state.skipped = [...c.skipped]
          .filter(([k]) => !k.endsWith('(helper)'))
          .map(([k, v]) => `${k}×${v}`)
          .join(', ');
        areas.set(c.id, state);
      }
      out.set(profileKey(p), areas);
    }
  return out;
}

/**
 * One area's layers over its base (Normal, no flags), in the order Classic play lays them
 * (level/layers.ts): for each flag set S (none first, then smallest first), a layer for any
 * difficulty and then one for Easy and one for Hard; a profile lays every layer whose flags it
 * has and whose difficulty is its own or any. Each is the difference between what the original
 * builds for (difficulty, S) and what the earlier layers already lay for it, so every profile's
 * result is exactly the original's.
 */
function areaLayers(areaId, states) {
  const base = states.get(profileKey(BASE)).get(areaId);
  const layers = [];
  const compose = (d, flags) =>
    layers
      .filter((l) => (l.d === null || l.d === d) && l.flags.every((f) => flags.includes(f)))
      .reduce(applyLayer, base);
  const warned = new Set();
  for (const flags of [[], ...SUBSETS])
    for (const d of flags.length ? [null, 'easy', 'hard'] : ['easy', 'hard']) {
      const target = states.get(profileKey({ d: d ?? 'normal', flags })).get(areaId);
      const l = diffLayer(compose(d ?? 'normal', flags), target, d, flags);
      if (l) layers.push(l);
      // A layer holds tiles, spawns and zones; the header and decor stay the map's.
      const th = JSON.parse(target.header);
      const bh = JSON.parse(base.header);
      const keys = Object.keys(th).filter((k) => th[k] !== bh[k] && k !== 'start' && k !== 'startMode');
      const decor = target.decor.filter((x) => !base.decor.includes(x));
      for (const [what, diff] of [
        ['header', keys.map((k) => `${k}: ${bh[k]} -> ${th[k]}`).join(', ')],
        ['decor', decor.join(', ')],
      ])
        if (diff && !warned.has(what)) {
          warned.add(what);
          console.warn(
            `${areaId}: ${what} differs for ${profileKey({ d: d ?? 'normal', flags })} (${diff}); kept`,
          );
        }
    }
  return layers;
}

/** Tile rows and spawn keys of a committed map (to check the layers lay over its base). */
function readMap(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const rows = [];
  const ents = new Set();
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;;.*$/, '').trim();
    if (!line) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      section = sec[1];
      continue;
    }
    if (section === 'tiles') rows.push([...line.replace(/\s+/g, '')]);
    else if (section === 'entities') ents.add(entityKey(line));
  }
  rows.forEach((r, y) =>
    r.forEach((ch, x) => {
      if (!MARKER_CHARS.has(ch)) return;
      ents.add(`${MARKER_TYPES[ch]} ${x} ${y}`);
      r[x] = '.';
    }),
  );
  return { rows, ents };
}

const layerHeader = (l) => ['layer', ...(l.d ? [l.d] : []), ...l.flags].join(' ');

function layersText(areaId, layers) {
  const source = xmlPath.replace(/^.*[\\/]/, '');
  const out = [
    `;; ${areaId}: the original's pieces for the other map difficulties and for heroes with level flags`,
    `;; (generated by tools/levelgen/convert-smbc.mjs --layers from ${source}; do not edit by hand).`,
    ';; Classic play lays, in order, each layer whose flags the hero has and whose difficulty is the',
    ";; run's or any (level/layers.ts). The .map file holds Normal for a hero with no flags.",
  ];
  for (const l of layers) {
    out.push('', `[${layerHeader(l)}]`);
    // Runs of changed cells per row (only changed cells: the map's own edits stay).
    const byRow = new Map();
    for (const c of l.cells) byRow.set(c.y, [...(byRow.get(c.y) ?? []), c]);
    for (const [y, cells] of [...byRow].sort((a, b) => a[0] - b[0])) {
      let run = null;
      for (const c of cells.sort((a, b) => a.x - b.x)) {
        if (run && c.x === run.x + run.chars.length) run.chars += c.ch;
        else {
          if (run) out.push(`${run.x} ${y} ${run.chars}`);
          run = { x: c.x, chars: c.ch };
        }
      }
      if (run) out.push(`${run.x} ${y} ${run.chars}`);
    }
    for (const k of l.removes) out.push(`- ${k}`);
    for (const a of l.adds) out.push(`+ ${a}`);
    for (const z of l.zonesOut) out.push(`-zone ${z}`);
    for (const z of l.zonesIn) out.push(`+zone ${z}`);
    if (l.start) out.push(`start ${l.start}`);
  }
  return out.join('\n') + '\n';
}

/** Writes `<area>.layers` beside each area's map (removing a stale one); never touches a .map. */
function writeLayers(levelId, levels) {
  const states = profileStates(levelId, levels);
  for (const areaId of states.get(profileKey(BASE)).keys()) {
    const layers = areaLayers(areaId, states);
    const file = join(outDir, `${areaId}.layers`);
    if (!layers.length) {
      rmSync(file, { force: true });
      console.log(`${areaId}: no layers`);
      continue;
    }
    writeFileSync(file, layersText(areaId, layers));
    // The layers lay over the committed map: report the cells and spawns where it is not the
    // original's base (its own hand edits), which a layer would overwrite or miss.
    const map = readMap(join(MAPS_DIR, `${areaId}.map`));
    const base = states.get(profileKey(BASE)).get(areaId);
    let cells = 0;
    let spawns = 0;
    if (map) {
      const added = new Set();
      for (const l of layers) {
        for (const c of l.cells) if (map.rows[c.y]?.[c.x] !== base.rows[c.y][c.x]) cells++;
        for (const k of l.removes) if (!map.ents.has(k) && !added.has(k)) spawns++;
        for (const a of l.adds) added.add(entityKey(a));
      }
    }
    const lines = layers.reduce((n, l) => n + l.cells.length + l.adds.length + l.removes.length, 0);
    // The tokens each profile's build skipped (no mapping yet), grouped by the same list.
    const skips = new Map();
    for (const [key, areas] of states) {
      const sk = areas.get(areaId)?.skipped;
      if (sk) skips.set(sk, [...(skips.get(sk) ?? []), key]);
    }
    for (const [sk, keys] of skips)
      console.log(
        `${areaId}: skipped ${sk} (${keys.length > 3 ? `${keys.slice(0, 3).join('; ')} and ${keys.length - 3} more` : keys.join('; ')})`,
      );
    console.log(
      `${areaId}: ${layers.length} layers (${layers
        .map(layerHeader)
        .map((h) => h.slice(6))
        .join('; ')}), ${lines} changes` +
        (map ? '' : '; no map to check') +
        (cells ? `; ${cells} cells over the map's own edits` : '') +
        (spawns ? `; ${spawns} removals miss` : ''),
    );
  }
}

/* ---------- run ---------- */

const levels = parseLevels(readFileSync(xmlPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const level = levels.get(id);
  if (!level) {
    console.error(`no level ${id}`);
    process.exit(1);
  }
  if (LAYERS) {
    writeLayers(id, levels);
    continue;
  }
  for (const c of convertLevel(id, levels)) {
    // One-tile slips in the original data, set to match the NES (nes-fixes.mjs).
    const fixed = applyNesFixes(c.id, c.builder);
    const text = c.builder.toString();
    const file = join(outDir, `${c.id}.map`);
    let changed = 'new file';
    try {
      const old = readFileSync(file, 'utf8');
      const tiles = (s) =>
        (s.split('\n[tiles]\n')[1]?.split('\n\n')[0] ?? '').replace(/;;.*\n/, '').replace(/\s/g, '');
      const a = tiles(old);
      const n = tiles(text);
      let diff = 0;
      for (let i = 0; i < Math.max(a.length, n.length); i++) if (a[i] !== n[i]) diff++;
      changed = `${diff} tile cells differ (old ${a.length}, new ${n.length})`;
    } catch {
      /* no previous file */
    }
    writeFileSync(file, text);
    const skipped = [...c.skipped].map(([k, v]) => `${k}×${v}`).join(', ');
    console.log(
      `${c.id}: ${c.area.width} wide, ${changed}${fixed ? `; ${fixed} NES fixes` : ''}${skipped ? `; skipped ${skipped}` : ''}`,
    );
  }
}
