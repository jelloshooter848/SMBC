// Converts level data from the original Super Mario Bros. Crossover source
// (assets/documents/levelDataSmb.xml, MIT licensed, not committed here) into this project's
// .map format. Only the "normal" difficulty layer is converted.
//
//   node tools/levelgen/convert-smbc.mjs tools/levelgen/source/levelDataSmb.xml src/content/levels/world2 2-1 2-2 2-3 2-4
//   node tools/levelgen/convert-smbc.mjs --prefix=ll- tools/levelgen/source/levelDataLostLevels.xml src/content/levels/lost/world1 1-1 1-2 1-3 1-4
//
// `--prefix` namespaces every generated id (areas, parents, pipe/vine/pit/warp targets, exits) so
// another game's levels (The Lost Levels: `ll-1-1` ...) can live next to SMB1's.
//
// The XML is a <LEVELDATA> of <LEVEL ID TIME MAIN_AREA> holding <AREA ID TYPE><MAP> cells:
// a flat comma list of 15 rows × W columns. A cell is `0` or tokens joined by `()`, each
// `name&&Key=Value&&Flag`; `HideOnDifficulties=easynormal` style values hide a token on the
// named difficulties. Crossover-only enemies and helpers are skipped and listed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MapBuilder } from './lib.mjs';

const args = process.argv.slice(2);
const PREFIX = (args.find((a) => a.startsWith('--prefix='))?.slice(9) ?? '').trim();
const [xmlPath, outDir, ...ids] = args.filter((a) => !a.startsWith('--'));
if (!xmlPath || !outDir || !ids.length) {
  console.error('usage: convert-smbc.mjs [--prefix=ll-] <levelData.xml> <outDir> <levelId>...');
  process.exit(2);
}
/** Lost Levels (prefixed) runs: 8-4 ends the game, World 9 and each of A-D (10-13) stand alone. */
const LOST = PREFIX !== '';
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

/** Tokens of one cell that are visible on normal difficulty. */
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
    if (String(params.HideOnDifficulties ?? '').includes('normal')) continue;
    toks.push({ name, params });
  }
  return toks;
}

/**
 * Pieces the original shows only to heroes who need help (it builds each level per character in
 * `Level.as`): `charHorz` / `charVert` = Show for heroes with limited horizontal or vertical
 * reach, `BadSwimmer` = Show for poor swimmers, `WideCharacter` = Show for wide heroes, and
 * anything marked `poorBowserFighter`. A `Hide` value means "present for everyone else", so a
 * classic hero keeps those. Our maps are built for the classic hero.
 */
function helperOnly(params) {
  for (const k of ['charHorz', 'charVert', 'BadSwimmer', 'WideCharacter'])
    if (params[k] === 'Show') return true;
  return params.poorBowserFighter !== undefined;
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
 * (GameSuperMarioBros.as): world + area type, then single areas that override it. Snowy nights
 * use the night palette, as SMB1's World 3 does; skins we don't have stay overworld.
 */
const LOST_THEMES = {
  2: { normal: 'night', cheepCheep: 'night' },
  3: { normal: 'snow', platform: 'snow' },
  5: { normal: 'snow' },
  7: { normal: 'night' },
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
};

// Lost Levels extras: a poison mushroom hurts like an enemy (4/5/6); the Clock item (time bonus)
// is not modelled and becomes a plain coin block.
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
const ITEM_Q = { Mushroom: 'M', OneUpMushroom: 'U', Star: '*', PoisonMushroom: '4', Clock: '?' };
const ITEM_HIDDEN = { OneUpMushroom: '1', Mushroom: '3', PoisonMushroom: '6', Clock: '2' };
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
  enemyCheepFast: 'cheep-red',
  enemyCheepSlow: 'cheep-grey',
  enemyBlooper: 'blooper',
  podoboo: 'podoboo',
  enemyWingedKoopaRed: 'koopa-para-red',
  enemyWingedKoopaGreen: 'koopa-para-green',
  enemyWingedKoopaHorizontalGreen: 'koopa-para-green-h',
  bowserAxe: 'axe',
  fireBarLeft: 'firebar',
  fireBarRight: 'firebar-ccw',
};
const LIFTS = {
  WaveHorizontal: 'lift-h',
  WaveVertical: 'lift-v',
  StepFall: 'lift-fall',
  ConstantFall: 'lift-down',
  ConstantRise: 'lift-up',
  StepConstantRight: 'lift-right',
};
const IGNORED = new Set([
  'flag',
  'colorRed',
  'colorLightBlue',
  'railing',
  'fence',
  'toad',
  'gameStateWatch',
  'bowserFireBallStart',
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
]);

function themeFor(levelId, type, areaId) {
  if (type === 'castle') return 'castle';
  if (type === 'underGround' || type === 'pipeBonus') return 'underground';
  if (type === 'water') return 'water';
  if (LOST) {
    const world = Number(levelId.split('-')[0]);
    return LOST_AREA_THEMES[`${levelId}${areaId}`] ?? LOST_THEMES[world]?.[type] ?? 'overworld';
  }
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
  // Platform and bridge levels are treetops, except World 4's giant mushrooms.
  // (The Lost Levels draw every platform level as treetops.)
  const trees = (area.type === 'platform' || area.type === 'cheepCheep') && (LOST || world !== 4);
  switch (name) {
    case 'groundNormal':
    case 'groundWideNormal':
    case 'groundSinglePiece':
    case 'groundCoral':
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

function convertArea(level, area, id, levels) {
  const levelId = level.id;
  const [world, stage] = levelId.split('-').map(Number);
  const isMain = area.id === level.attrs.MAIN_AREA;
  const theme = themeFor(levelId, area.type, area.id);
  const music = theme === 'night' || theme === 'snow' ? 'overworld' : theme;
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

  let start = null;
  let levelExit = null;
  let warpText = null;
  let vineStart = null;
  let pitEnd = null;
  let pitStart = null;
  const cheepStarts = []; // leaping Cheep Cheep stretches (an area may have several)
  const cheepEnds = [];
  const bulletZone = { start: null, end: null };
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
        if (helperOnly(params)) {
          // Crossover pieces only shown for heroes with special needs (see helperOnly).
          skip(`${name}(helper)`);
          continue;
        }
        const ch = tileChar(tok, area, world);
        if (ch) {
          // Water and lava are a background layer: they never cover a tile (9-1's flag ball).
          if ((ch === 'w' || ch === '~') && b.rows[y][x] !== '.') continue;
          b.set(x, y, ch);
          if (ch === 'V') vines.push({ x, y, dest: params.pTransDest });
          continue;
        }
        if (MARKERS[name]) {
          cellMarkers.push(MARKERS[name]);
          continue;
        }
        if (ENTITIES[name]) {
          b.entity(ENTITIES[name], x, y);
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
          case 'enemyPiranhaGreen':
          case 'enemyPiranhaRed':
            b.entity('piranha', x, y + 1); // the token sits above the pipe's top-left tile
            break;
          case 'enemyPiranhaRedUpsideDown':
          case 'enemyPiranhaGreenUpsideDown':
            // The Lost Levels' hanging piranha: the token shares the cell of the pipe's
            // bottom-left rim tile (groundPipeBottomLeft), so it is placed there unchanged.
            b.entity('piranha-down', x, y);
            break;
          case 'peach':
            b.entity('princess', x, y);
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
            start = { x, y };
            break;
          case 'halfwayPoint':
            // LOCKED_CP levels (castles, SMB1 World 8, Lost Levels 7-4 to 8-4) have no halfway
            // start on normal difficulty in the original (Level.as shouldStartAtCheckPoint).
            if (level.attrs.LOCKED_CP !== 'True') b.zone(`checkpoint ${x}`);
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
          case 'fireBarLongLeft':
          case 'fireBarLongRight':
            b.entity(name === 'fireBarLongLeft' ? 'firebar' : 'firebar-ccw', x, y, { len: 12 });
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
      for (const m of cellMarkers) {
        if (b.rows[y][x] === '.' && m === cellMarkers[0]) b.set(x, y, m);
        else b.entity(MARKER_TYPES[m], x, y);
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
  if (vineStart) b.entity('vine', vineStart.x, vineStart.y, { len: 8 });

  // How the player arrives decides the start mode.
  const pipeExit = [...vertEnds.values()][0];
  if (area.type === 'pipeBonus') {
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
    header.startMode = below ? 'stand' : 'fall';
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

function convertLevel(level, levels) {
  const used = new Map();
  const ids = level.areas.map((a) => {
    if (a.id === level.attrs.MAIN_AREA) return pid(level.id);
    if (a.id === 'a' && a.type !== 'intro') return pid(`${level.id}-start`);
    const suffix = AREA_SUFFIX[a.type] ?? a.id;
    const n = (used.get(suffix) ?? 0) + 1;
    used.set(suffix, n);
    return pid(`${level.id}-${suffix}${n > 1 ? n : ''}`);
  });
  const converted = level.areas.map((a, i) => convertArea(level, a, ids[i], levels));
  const byAreaId = new Map(level.areas.map((a, i) => [a.id, converted[i]]));
  for (const c of converted) {
    for (const v of c.vines) {
      const t = byAreaId.get(v.dest);
      if (!t?.vineStart) {
        console.warn(`${c.id}: vine at ${v.x},${v.y} to area ${v.dest} without a vineStart`);
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
      if (t.area.type === 'pipeBonus') {
        c.builder.zone(`pipe ${p.x} ${p.y} ${p.dir} -> ${t.id} ${t.start?.x ?? 1} 0 exit=none`);
      } else if (p.number !== undefined && t.vertEnds.has(String(p.number))) {
        const e = t.vertEnds.get(String(p.number));
        c.builder.zone(`pipe ${p.x} ${p.y} ${p.dir} -> ${t.id} ${e.x} ${e.y - 1} exit=up`);
      } else {
        c.builder.zone(
          `pipe ${p.x} ${p.y} ${p.dir} -> ${t.id} ${t.start?.x ?? 2} ${t.start?.y ?? 12} exit=none`,
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

/* ---------- run ---------- */

const levels = parseLevels(readFileSync(xmlPath, 'utf8'));
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const level = levels.get(id);
  if (!level) {
    console.error(`no level ${id}`);
    process.exit(1);
  }
  for (const c of convertLevel(level, levels)) {
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
    console.log(`${c.id}: ${c.area.width} wide, ${changed}${skipped ? `; skipped ${skipped}` : ''}`);
  }
}
