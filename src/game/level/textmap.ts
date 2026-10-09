import { LEVEL_ROWS } from '../constants';
import type {
  HeroItemEntry,
  CampaignLook,
  Decor,
  EntitySpawn,
  LevelData,
  LevelVariant,
  PipeDir,
  Theme,
  TransferMode,
  Zone,
} from './schema';
import { CAMERA_MODES, isTheme, themeMusic, type CameraMode } from './schema';
import { DEFAULT_AUTO_SCROLL } from '../world/camera';
import { DEFAULT_LEGEND, T } from './tiles';
import { entryItem, heroItems as heroItemList } from '../items/catalog';

export class MapParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`line ${line}: ${message}`);
  }
}

type Props = Record<string, string | number | boolean>;

function parseValue(v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseProps(parts: string[]): Props {
  const props: Props = {};
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) throw new Error(`expected key=value, got "${p}"`);
    props[p.slice(0, eq)] = parseValue(p.slice(eq + 1));
  }
  return props;
}

/**
 * Parses the hand-authored `.map` format:
 *
 *   key: value            header lines (id, name, theme, music, time, start, width...;
 *                         `camera: scroll|locked|free|auto`, and with `auto` an optional
 *                         `scroll: <px per frame>`, decimals fine, default 0.5)
 *   [legend]              optional overrides: `X tile-name` or `X @entity`
 *   [tiles]               15 rows (or the header's `height: N`, at least 15, for a
 *                         `camera: free` map with shafts); spaces and `;;` comments are
 *                         stripped, so rows can be written as space-separated 16-column screens
 *   [entities]            `type x y key=val ...` (`dx=` / `dy=`: a pixel nudge off the tile,
 *                         e.g. the original's half-tile shiftRight / shiftUp)
 *   [zones]               `pipe x y dir -> level x y [exit=dir] [campaign]` (`-> map 0 0`: back to
 *                         the world map, MAP_EXIT), `exit x next=id`,
 *                         `checkpoint x [y]`, `scrollStop x`, `warp x w worlds=4,3,2 [text=..] [secret=key] [goto=level,x,y[,exit]] [until=secret]`,
 *                         `text x y triggerX "..."`,
 *                         `bowser-fire x`, `vine x y -> level x y`, `pit x -> level x y`,
 *                         `teleport x y -> level x y [exit=beam|fall] [block=bx,by]` (a pad),
 *                         `descent x w -> level x y [campaign]` (a down lift's shaft),
 *                         `trick x y h -> level x y [exit=up] [campaign]` (a trick wall's spinning panel)
 *                         `pit x -> level x y [w=N] [campaign]` (`w`: only columns x..x+w-1)
 *                         `path x y w block=bx,by [one-way] [campaign]` (a hidden cloud path, World.layPath)
 *                         `ledge x y w campaign` (a one-way cloud ledge, laid in the campaign only)
 *   header `bonus: true`  a fill-up spot off the map (LevelData.bonus: no clock, no WORLD card)
 *   header `swim: true`   the player swims from the first row of wave tiles down, in any theme
 *                         (LevelData.swim; a water theme always swims)
 *   [decor]               `kind x y`
 *   [campaign-decor]      `kind x y`: the decor of the level's campaign look, which also takes
 *                         the headers `campaignTheme: <theme>` and `campaignMusic: <song>`
 *                         (level/campaign.ts applyLook; other play keeps [decor])
 *   [variant <hero>]      `x y tiles [*N]`: a run of map tiles from (x, y) rightward (`.` opens one,
 *                         a marker adds its spawn; `*N`: on N rows from y down), `+ type x y
 *                         [key=val]` (a spawn added), `- type x y` (one taken out): laid when any
 *                         player is that hero, in campaign play only; `[variant <hero> classic]` in
 *                         all play (level/variants.ts heroVariant); `music <song>`: the level's
 *                         music while that hero plays it
 *   [hero-items]          `x y hero=item ...`: what the power block at x y gives each hero in the
 *                         campaign (docs/POWERUPS.md 3.2; `grow`: their grow item; a hero not
 *                         named gets their default power). The tile must be a power block (M, P,
 *                         3 or W) in the map or a hero variant.
 */
export function parseTextMap(src: string, idHint = 'level'): LevelData {
  const header: Record<string, string> = {};
  const legend: Record<string, number | string> = { ...DEFAULT_LEGEND };
  const rows: { text: string; line: number }[] = [];
  const entities: EntitySpawn[] = [];
  const zones: Zone[] = [];
  const decor: Decor[] = [];
  const lookDecor: Decor[] = [];
  let hasLookDecor = false;
  const variants: LevelVariant[] = [];
  /** Each variant run's source line, for the bounds check once the width is known. */
  const runLines: { run: LevelVariant['tiles'][number]; line: number }[] = [];
  const heroItems: { entry: HeroItemEntry; line: number }[] = [];
  let section:
    | 'header'
    | 'legend'
    | 'tiles'
    | 'entities'
    | 'zones'
    | 'decor'
    | 'campaign-decor'
    | 'variant'
    | 'hero-items' = 'header';

  const lines = src.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    let line = raw;
    const c = line.indexOf(';;');
    if (c >= 0) line = line.slice(0, c);
    if (section !== 'tiles' && line.trimStart().startsWith('#')) return;
    const trimmed = line.trim();
    if (!trimmed) return;
    const variant = /^\[variant\s+([\w-]+)(\s+classic)?\]$/.exec(trimmed);
    if (variant) {
      const v: LevelVariant = { hero: variant[1] as string, tiles: [] };
      if (variant[2]) v.classic = true;
      variants.push(v);
      section = 'variant';
      return;
    }
    const sec = /^\[([\w-]+)\]$/.exec(trimmed);
    if (sec) {
      const name = sec[1];
      if (
        name !== 'legend' &&
        name !== 'tiles' &&
        name !== 'entities' &&
        name !== 'zones' &&
        name !== 'decor' &&
        name !== 'campaign-decor' &&
        name !== 'hero-items'
      ) {
        throw new MapParseError(`unknown section [${name}]`, lineNo);
      }
      section = name;
      if (name === 'campaign-decor') hasLookDecor = true;
      return;
    }
    try {
      switch (section) {
        case 'header': {
          const m = /^([\w-]+)\s*:\s*(.*)$/.exec(trimmed);
          if (!m) throw new Error(`expected "key: value"`);
          header[m[1] as string] = (m[2] as string).trim();
          break;
        }
        case 'legend': {
          const [ch, name] = trimmed.split(/\s+/);
          if (!ch || ch.length !== 1 || !name) throw new Error(`expected "<char> <tile|@entity>"`);
          if (name.startsWith('@')) legend[ch] = name;
          else {
            const id = tileIdByName(name);
            if (id === undefined) throw new Error(`unknown tile "${name}"`);
            legend[ch] = id;
          }
          break;
        }
        case 'tiles':
          rows.push({ text: line.replace(/\s+/g, ''), line: lineNo });
          break;
        case 'entities': {
          const parts = trimmed.split(/\s+/);
          const [type, xs, ys, ...rest] = parts;
          if (!type || xs === undefined || ys === undefined) throw new Error('expected "type x y [key=val]"');
          const e: EntitySpawn = { type, x: Number(xs), y: Number(ys) };
          if (rest.length) e.props = parseProps(rest);
          entities.push(e);
          break;
        }
        case 'zones':
          zones.push(parseZone(trimmed));
          break;
        case 'decor':
        case 'campaign-decor': {
          const [kind, xs, ys] = trimmed.split(/\s+/);
          if (!kind || xs === undefined || ys === undefined) throw new Error('expected "kind x y"');
          (section === 'decor' ? decor : lookDecor).push({ kind, x: Number(xs), y: Number(ys) });
          break;
        }
        case 'hero-items': {
          const entry = parseHeroItems(trimmed);
          if (heroItems.some((h) => h.entry.x === entry.x && h.entry.y === entry.y))
            throw new Error(`a second line for the block at ${entry.x} ${entry.y}`);
          heroItems.push({ entry, line: lineNo });
          break;
        }
        case 'variant': {
          const v = variants.at(-1) as LevelVariant;
          const parts = trimmed.split(/\s+/);
          if (parts[0] === 'music') {
            // `music <song>`: the level's music while that hero plays it.
            if (parts.length !== 2 || !parts[1]) throw new Error('expected "music <song>"');
            v.music = parts[1];
            break;
          }
          if (parts[0] === '+' || parts[0] === '-') {
            // `+ type x y [key=val]`: a spawn added; `- type x y`: the map's spawn there taken out.
            const [sign, type, xs, ys, ...rest] = parts;
            if (!type || !/^\d+$/.test(xs ?? '') || !/^\d+$/.test(ys ?? '') || (sign === '-' && rest.length))
              throw new Error('expected "+ type x y [key=val]" or "- type x y"');
            const e: EntitySpawn = { type, x: Number(xs), y: Number(ys) };
            if (sign === '-') (v.remove ??= []).push(e);
            else {
              if (rest.length) e.props = parseProps(rest);
              (v.add ??= []).push(e);
            }
            break;
          }
          const [xs, ys, chars, rep, ...more] = parts;
          if (
            !/^\d+$/.test(xs ?? '') ||
            !/^\d+$/.test(ys ?? '') ||
            !chars ||
            (rep !== undefined && !/^\*[1-9]\d*$/.test(rep)) ||
            more.length
          )
            throw new Error('expected "x y tiles [*rows]"');
          const x0 = Number(xs);
          // `*N`: the same run on N rows, from y down.
          for (let y = Number(ys); y < Number(ys) + (rep ? Number(rep.slice(1)) : 1); y++) {
            // A marker in a run (a spring's `s`) adds that spawn on open air, as in [tiles].
            const ids = [...chars].map((ch, i) => {
              const t = legend[ch];
              if (t === undefined) throw new Error(`"${ch}" is not a tile`);
              if (typeof t === 'number') return t;
              (v.add ??= []).push({ type: t.slice(1), x: x0 + i, y });
              return T.AIR;
            });
            const run = { x: x0, y, tiles: ids };
            v.tiles.push(run);
            runLines.push({ run, line: lineNo });
          }
          break;
        }
      }
    } catch (e) {
      throw new MapParseError((e as Error).message, lineNo);
    }
  });

  const height = header.height === undefined ? LEVEL_ROWS : Number(header.height);
  if (!Number.isInteger(height) || height < LEVEL_ROWS)
    throw new MapParseError(`height must be a whole number of at least ${LEVEL_ROWS} rows`, 0);
  // Only a free camera can show more than one screen of rows.
  if (height > LEVEL_ROWS && header.camera !== 'free')
    throw new MapParseError(`height ${height} needs "camera: free" (only it scrolls vertically)`, 0);
  const camera = (header.camera ?? 'scroll') as CameraMode;
  if (!CAMERA_MODES.includes(camera))
    throw new MapParseError(`unknown camera "${camera}" (${CAMERA_MODES.join(', ')})`, 0);
  let scroll: number | undefined;
  if (header.scroll !== undefined) {
    if (camera !== 'auto') throw new MapParseError(`"scroll" needs "camera: auto"`, 0);
    scroll = Number(header.scroll);
    if (!/^\d*\.?\d+$/.test(header.scroll) || !(scroll > 0) || scroll > 16)
      throw new MapParseError(`scroll must be a speed in px per frame above 0 (at most 16)`, 0);
  } else if (camera === 'auto') scroll = DEFAULT_AUTO_SCROLL;
  if (rows.length !== height) {
    throw new MapParseError(
      `expected ${height} tile rows, got ${rows.length}`,
      rows[rows.length - 1]?.line ?? 0,
    );
  }
  const width = (rows[0] as { text: string }).text.length;
  const tiles = new Uint16Array(width * height);
  rows.forEach((row, y) => {
    if (row.text.length !== width) {
      throw new MapParseError(`row ${y} has ${row.text.length} columns, expected ${width}`, row.line);
    }
    for (let x = 0; x < width; x++) {
      const ch = row.text[x] as string;
      const v = legend[ch];
      if (v === undefined) throw new MapParseError(`unknown tile char "${ch}" at column ${x}`, row.line);
      if (typeof v === 'string') {
        entities.push({ type: v.slice(1), x, y });
        tiles[y * width + x] = T.AIR;
      } else tiles[y * width + x] = v;
    }
  });

  for (const { run, line } of runLines)
    if (run.y >= height || run.x + run.tiles.length > width)
      throw new MapParseError(`variant run at ${run.x},${run.y} reaches outside the level`, line);
  // A `[hero-items]` line names a power block: in the map, or laid by a hero variant.
  for (const { entry, line } of heroItems) {
    const { x, y } = entry;
    const atMap = x < width && y < height ? (tiles[y * width + x] as number) : -1;
    const inVariant = runLines.some(
      ({ run }) =>
        run.y === y &&
        x >= run.x &&
        x < run.x + run.tiles.length &&
        POWER_BLOCKS.has(run.tiles[x - run.x] as number),
    );
    if (!POWER_BLOCKS.has(atMap) && !inVariant)
      throw new MapParseError(`no power block (M, P, 3 or W) at ${x} ${y} for [hero-items]`, line);
  }

  const id = header.id ?? idHint;
  const [ws, ss] = id.split('-');
  const start = (header.start ?? '2,12').split(',').map(Number) as [number, number];
  const timeRaw = header.time ?? '400';
  const theme: Theme = isTheme(header.theme ?? '') ? (header.theme as Theme) : 'overworld';
  const level: LevelData = {
    schema: 1,
    id,
    name: header.name ?? `WORLD ${id}`,
    world: whole(header.world ?? ws, 1),
    // Stage 0 is real: Mario's tutorial stage 1-0.
    stage: whole(header.stage ?? ss, 1),
    theme,
    music: header.music ?? themeMusic(theme),
    time: timeRaw === 'inherit' || timeRaw === 'null' ? null : Number(timeRaw),
    width,
    height,
    tiles,
    entities,
    zones,
    decor,
    start: { x: start[0], y: start[1] },
    startMode: (header.startMode as LevelData['startMode']) ?? 'stand',
    camera,
    parent: header.parent ?? null,
  };
  if (scroll !== undefined) level.scroll = scroll;
  if (header.bonus !== undefined) {
    if (header.bonus !== 'true') throw new MapParseError('"bonus" must be "true"', 0);
    level.bonus = true;
  }
  if (header.swim !== undefined) {
    if (header.swim !== 'true') throw new MapParseError('"swim" must be "true"', 0);
    level.swim = true;
  }
  if (header.campaignMusic !== undefined && header.campaignTheme === undefined)
    throw new MapParseError('"campaignMusic" needs "campaignTheme"', 0);
  if (hasLookDecor && header.campaignTheme === undefined)
    throw new MapParseError('[campaign-decor] needs "campaignTheme"', 0);
  if (header.campaignTheme !== undefined) {
    const look: CampaignLook = { theme: header.campaignTheme };
    if (header.campaignMusic !== undefined) look.music = header.campaignMusic;
    if (hasLookDecor) look.decor = lookDecor;
    level.campaignLook = look;
  }
  if (variants.length) level.variants = variants;
  if (heroItems.length) level.heroItems = heroItems.map((h) => h.entry);
  return level;
}

/** The tiles a `[hero-items]` line can name: ? and brick power blocks, the hidden one, the flower block. */
const POWER_BLOCKS: ReadonlySet<number> = new Set([
  T.Q_POWERUP,
  T.BRICK_POWERUP,
  T.HIDDEN_POWERUP,
  T.Q_FLOWER,
]);

/** `x y hero=item ...` (each hero once, each item theirs or `grow`). */
function parseHeroItems(line: string): HeroItemEntry {
  const [xs, ys, ...pairs] = line.split(/\s+/);
  if (!/^\d+$/.test(xs ?? '') || !/^\d+$/.test(ys ?? '') || !pairs.length)
    throw new Error('expected "x y hero=item ..."');
  const items: Record<string, string> = {};
  for (const pair of pairs) {
    const m = /^([\w-]+)=([\w-]+)$/.exec(pair);
    if (!m) throw new Error(`expected "hero=item", got "${pair}"`);
    const [, hero, item] = m as unknown as [string, string, string];
    if (!heroItemList(hero)) throw new Error(`unknown hero "${hero}"`);
    if (hero in items) throw new Error(`"${hero}" named twice`);
    if (entryItem(hero, item) === null) throw new Error(`"${item}" is not one of ${hero}'s items`);
    items[hero] = item;
  }
  return { x: Number(xs), y: Number(ys), items };
}

/** A whole number ≥ 0 from a header or id part, else `d`. */
function whole(v: string | undefined, d: number): number {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : d;
}

function parseZone(line: string): Zone {
  const parts = line.split(/\s+/);
  const kind = parts[0];
  switch (kind) {
    case 'pipe': {
      // pipe x y dir -> level x y [exit=dir]
      const [, xs, ys, dir, arrow, level, tx, ty, ...rest] = parts;
      if (arrow !== '->' || !level || tx === undefined || ty === undefined || !isPipeDir(dir)) {
        throw new Error('expected "pipe x y dir -> level x y [exit=dir]"');
      }
      const props = parseProps(rest.filter((r) => r !== 'campaign'));
      const target: { level: string; x: number; y: number; exitDir?: TransferMode } = {
        level,
        x: Number(tx),
        y: Number(ty),
      };
      if (props.exit !== undefined) target.exitDir = String(props.exit) as TransferMode;
      const z: Zone = { kind: 'pipe', x: Number(xs), y: Number(ys), dir, target };
      if (rest.includes('campaign')) z.campaign = true;
      return z;
    }
    case 'vine': {
      // vine x y -> level x y
      const [, xs, ys, arrow, level, tx, ty] = parts;
      if (arrow !== '->' || !level || tx === undefined || ty === undefined)
        throw new Error('expected "vine x y -> level x y"');
      return { kind: 'vine', x: Number(xs), y: Number(ys), target: { level, x: Number(tx), y: Number(ty) } };
    }
    case 'teleport': {
      // teleport x y -> level x y [exit=beam|fall] [block=bx,by]
      const [, xs, ys, arrow, level, tx, ty, ...rest] = parts;
      if (
        arrow !== '->' ||
        !level ||
        xs === undefined ||
        ys === undefined ||
        tx === undefined ||
        ty === undefined
      )
        throw new Error('expected "teleport x y -> level x y [exit=beam|fall] [block=x,y]"');
      const props = parseProps(rest);
      const exit = props.exit ?? 'beam';
      if (exit !== 'beam' && exit !== 'fall') throw new Error('teleport exit must be beam or fall');
      const z: Zone = {
        kind: 'teleport',
        x: Number(xs),
        y: Number(ys),
        target: { level, x: Number(tx), y: Number(ty), exitDir: exit },
      };
      if (props.block !== undefined) {
        const [bx, by] = String(props.block).split(',').map(Number);
        if (!Number.isInteger(bx) || !Number.isInteger(by)) throw new Error('teleport block must be "x,y"');
        z.block = { x: bx as number, y: by as number };
      }
      return z;
    }
    case 'pit': {
      // pit x -> level x y [w=N] [campaign]
      const [, xs, arrow, level, tx, ty, ...rest] = parts;
      if (arrow !== '->' || !level || tx === undefined || ty === undefined)
        throw new Error('expected "pit x -> level x y [w=N] [campaign]"');
      const z: Zone = { kind: 'pit', x: Number(xs), target: { level, x: Number(tx), y: Number(ty) } };
      const w = parseProps(rest.filter((r) => r.includes('='))).w;
      if (w !== undefined) {
        if (typeof w !== 'number' || !Number.isInteger(w) || w < 1)
          throw new Error('pit w must be a whole number of columns');
        z.w = w;
      }
      if (rest.includes('campaign')) z.campaign = true;
      return z;
    }
    case 'descent': {
      // descent x w -> level x y [campaign]
      const [, xs, ws, arrow, level, tx, ty, ...rest] = parts;
      if (arrow !== '->' || !level || ws === undefined || tx === undefined || ty === undefined)
        throw new Error('expected "descent x w -> level x y [campaign]"');
      const z: Zone = {
        kind: 'descent',
        x: Number(xs),
        w: Number(ws),
        target: { level, x: Number(tx), y: Number(ty) },
      };
      if (rest.includes('campaign')) z.campaign = true;
      return z;
    }
    case 'trick': {
      // trick x y h -> level x y [exit=up] [campaign]
      const [, xs, ys, hs, arrow, level, tx, ty, ...rest] = parts;
      if (
        arrow !== '->' ||
        !level ||
        xs === undefined ||
        ys === undefined ||
        hs === undefined ||
        tx === undefined ||
        ty === undefined
      )
        throw new Error('expected "trick x y h -> level x y [exit=up] [campaign]"');
      const z: Zone = {
        kind: 'trick',
        x: Number(xs),
        y: Number(ys),
        h: Number(hs),
        target: { level, x: Number(tx), y: Number(ty) },
      };
      const exit = parseProps(rest.filter((r) => r.includes('='))).exit;
      if (exit !== undefined) {
        if (exit !== 'up') throw new Error('trick exit must be up');
        z.target.exitDir = 'up';
      }
      if (rest.includes('campaign')) z.campaign = true;
      return z;
    }
    case 'path': {
      // path x y w block=bx,by [one-way] [campaign]
      const [, xs, ys, ws, ...rest] = parts;
      const block = parseProps(rest.filter((r) => r.includes('='))).block;
      const [bx, by] = String(block ?? '')
        .split(',')
        .map(Number);
      if (
        !/^\d+$/.test(xs ?? '') ||
        !/^\d+$/.test(ys ?? '') ||
        !/^\d+$/.test(ws ?? '') ||
        !Number.isInteger(bx) ||
        !Number.isInteger(by)
      )
        throw new Error('expected "path x y w block=bx,by [one-way] [campaign]"');
      const z: Zone = {
        kind: 'path',
        x: Number(xs),
        y: Number(ys),
        w: Number(ws),
        block: { x: bx as number, y: by as number },
      };
      if (rest.includes('one-way')) z.oneWay = true;
      if (rest.includes('campaign')) z.campaign = true;
      return z;
    }
    case 'ledge': {
      // ledge x y w campaign
      const [, xs, ys, ws, ...rest] = parts;
      if (
        !/^\d+$/.test(xs ?? '') ||
        !/^\d+$/.test(ys ?? '') ||
        !/^[1-9]\d*$/.test(ws ?? '') ||
        rest.join(' ') !== 'campaign'
      )
        throw new Error('expected "ledge x y w campaign"');
      return { kind: 'ledge', x: Number(xs), y: Number(ys), w: Number(ws), campaign: true };
    }
    case 'cheeps':
      return { kind: 'cheeps', x: Number(parts[1]), w: Number(parts[2]) };
    case 'bullets':
      return { kind: 'bullets', x: Number(parts[1]), w: Number(parts[2]) };
    case 'bowser-fire':
      if (parts[1] === undefined) throw new Error('expected "bowser-fire x"');
      return { kind: 'bowser-fire', x: Number(parts[1]) };
    case 'loop': {
      // loop x y0 y1 -> to [check=x:y0:y1[,x:y0:y1...]] [any]
      const [, xs, y0, y1, arrow, to, ...rest] = parts;
      if (arrow !== '->' || xs === undefined || y0 === undefined || y1 === undefined || to === undefined)
        throw new Error('expected "loop x y0 y1 -> to [check=x:y0:y1,...] [any]"');
      const check = rest.find((r) => r.startsWith('check='));
      const checks = check
        ? check
            .slice(6)
            .split(',')
            .map((c) => {
              const [cx, cy0, cy1] = c.split(':').map(Number);
              return { x: cx as number, y0: cy0 as number, y1: cy1 as number };
            })
        : [];
      return {
        kind: 'loop',
        x: Number(xs),
        y0: Number(y0),
        y1: Number(y1),
        to: Number(to),
        checks,
        need: rest.includes('any') ? 'any' : 'all',
      };
    }
    case 'exit': {
      const [, xs, ...rest] = parts;
      const props = parseProps(rest);
      if (xs === undefined || typeof props.next !== 'string') throw new Error('expected "exit x next=id"');
      return { kind: 'exit', x: Number(xs), next: props.next };
    }
    case 'checkpoint':
      // checkpoint x [y]
      return parts[2] === undefined
        ? { kind: 'checkpoint', x: Number(parts[1]) }
        : { kind: 'checkpoint', x: Number(parts[1]), y: Number(parts[2]) };
    case 'scrollStop':
      return { kind: 'scrollStop', x: Number(parts[1]) };
    case 'warp': {
      const [, xs, ws, ...rest] = parts;
      const props = parseProps(rest);
      const worlds = String(props.worlds ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number);
      if (xs === undefined || ws === undefined || !worlds.length)
        throw new Error('expected "warp x w worlds=a,b,c"');
      const z: Zone = { kind: 'warp', x: Number(xs), w: Number(ws), worlds };
      if (typeof props.text === 'string') z.text = props.text.replace(/_/g, ' ');
      if (typeof props.secret === 'string') z.secret = props.secret;
      if (typeof props.until === 'string') z.until = props.until;
      if (props.goto !== undefined) {
        // goto=level,x,y[,exitDir]: the campaign's one pipe leads there (level/campaign.ts).
        const [level, gx, gy, exit] = String(props.goto).split(',');
        if (!level || !/^\d+$/.test(gx ?? '') || !/^\d+$/.test(gy ?? ''))
          throw new Error('warp goto must be "level,x,y[,exit]"');
        z.goto = { level, x: Number(gx), y: Number(gy) };
        if (exit) z.goto.exitDir = exit as TransferMode;
      }
      return z;
    }
    case 'text': {
      const m = /^text\s+(\d+)\s+(\d+)\s+(\d+)\s+"(.*)"$/.exec(line);
      if (!m) throw new Error('expected text x y triggerX "message"');
      return { kind: 'text', x: Number(m[1]), y: Number(m[2]), triggerX: Number(m[3]), text: m[4] as string };
    }
    default:
      throw new Error(`unknown zone "${kind}"`);
  }
}

function isPipeDir(d: string | undefined): d is PipeDir {
  return d === 'down' || d === 'up' || d === 'left' || d === 'right';
}

import { TILES } from './tiles';
function tileIdByName(name: string): number | undefined {
  return TILES.find((t) => t.name === name)?.id;
}

/** Serialize back to the text format (used by the editor and round-trip tests). */
export function serializeTextMap(level: LevelData): string {
  const rev = new Map<number | string, string>();
  for (const [ch, v] of Object.entries(DEFAULT_LEGEND)) if (!rev.has(v)) rev.set(v, ch);
  const out: string[] = [];
  out.push(`id: ${level.id}`, `name: ${level.name}`, `world: ${level.world}`, `stage: ${level.stage}`);
  out.push(
    `theme: ${level.theme}`,
    `music: ${level.music}`,
    `time: ${level.time === null ? 'inherit' : level.time}`,
  );
  out.push(
    `start: ${level.start.x},${level.start.y}`,
    `startMode: ${level.startMode}`,
    `camera: ${level.camera}`,
  );
  if (level.camera === 'auto') out.push(`scroll: ${level.scroll ?? DEFAULT_AUTO_SCROLL}`);
  if (level.height !== LEVEL_ROWS) out.push(`height: ${level.height}`);
  if (level.bonus) out.push('bonus: true');
  if (level.swim) out.push('swim: true');
  if (level.campaignLook) {
    out.push(`campaignTheme: ${level.campaignLook.theme}`);
    if (level.campaignLook.music !== undefined) out.push(`campaignMusic: ${level.campaignLook.music}`);
  }
  out.push('', '[tiles]');
  const markers = new Map<string, string>();
  for (const e of level.entities) {
    const ch = rev.get(`@${e.type}`);
    if (ch && !e.props) markers.set(`${e.x},${e.y}`, ch);
  }
  for (let y = 0; y < level.height; y++) {
    let row = '';
    for (let x = 0; x < level.width; x++) {
      if (x > 0 && x % 16 === 0) row += ' ';
      const m = markers.get(`${x},${y}`);
      row += m ?? rev.get(level.tiles[y * level.width + x] ?? 0) ?? '.';
    }
    out.push(row);
  }
  const extra = level.entities.filter((e) => !(rev.get(`@${e.type}`) && !e.props));
  if (extra.length) {
    out.push('', '[entities]');
    for (const e of extra) {
      const props = e.props
        ? ' ' +
          Object.entries(e.props)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : '';
      out.push(`${e.type} ${e.x} ${e.y}${props}`);
    }
  }
  if (level.zones.length) {
    out.push('', '[zones]');
    for (const z of level.zones) out.push(serializeZone(z));
  }
  if (level.decor.length) {
    out.push('', '[decor]');
    for (const d of level.decor) out.push(`${d.kind} ${d.x} ${d.y}`);
  }
  if (level.campaignLook?.decor) {
    out.push('', '[campaign-decor]');
    for (const d of level.campaignLook.decor) out.push(`${d.kind} ${d.x} ${d.y}`);
  }
  if (level.heroItems?.length) {
    out.push('', '[hero-items]');
    for (const h of level.heroItems)
      out.push(
        `${h.x} ${h.y} ${Object.entries(h.items)
          .map(([hero, item]) => `${hero}=${item}`)
          .join(' ')}`,
      );
  }
  for (const v of level.variants ?? []) {
    out.push('', `[variant ${v.hero}${v.classic ? ' classic' : ''}]`);
    if (v.music) out.push(`music ${v.music}`);
    for (const r of v.tiles) out.push(`${r.x} ${r.y} ${r.tiles.map((t) => rev.get(t) ?? '.').join('')}`);
    for (const e of v.add ?? [])
      out.push(
        `+ ${e.type} ${e.x} ${e.y}${
          e.props
            ? ' ' +
              Object.entries(e.props)
                .map(([k, val]) => `${k}=${val}`)
                .join(' ')
            : ''
        }`,
      );
    for (const e of v.remove ?? []) out.push(`- ${e.type} ${e.x} ${e.y}`);
  }
  return out.join('\n') + '\n';
}

function serializeZone(z: Zone): string {
  switch (z.kind) {
    case 'pipe':
      return `pipe ${z.x} ${z.y} ${z.dir} -> ${z.target.level} ${z.target.x} ${z.target.y}${z.target.exitDir ? ` exit=${z.target.exitDir}` : ''}${
        z.campaign ? ' campaign' : ''
      }`;
    case 'path':
      return `path ${z.x} ${z.y} ${z.w} block=${z.block.x},${z.block.y}${z.oneWay ? ' one-way' : ''}${
        z.campaign ? ' campaign' : ''
      }`;
    case 'ledge':
      // Always `campaign` (the only way a map holds one): a campaign variant's woken ledge (its
      // tiles laid, which a map cannot write) is written back as the sleeping zone that lays them.
      return `ledge ${z.x} ${z.y} ${z.w} campaign`;
    case 'exit':
      return `exit ${z.x} next=${z.next}`;
    case 'vine':
      return `vine ${z.x} ${z.y} -> ${z.target.level} ${z.target.x} ${z.target.y}`;
    case 'pit':
      return `pit ${z.x} -> ${z.target.level} ${z.target.x} ${z.target.y}${z.w === undefined ? '' : ` w=${z.w}`}${
        z.campaign ? ' campaign' : ''
      }`;
    case 'descent':
      return `descent ${z.x} ${z.w} -> ${z.target.level} ${z.target.x} ${z.target.y}${z.campaign ? ' campaign' : ''}`;
    case 'trick':
      return `trick ${z.x} ${z.y} ${z.h} -> ${z.target.level} ${z.target.x} ${z.target.y}${
        z.target.exitDir ? ` exit=${z.target.exitDir}` : ''
      }${z.campaign ? ' campaign' : ''}`;
    case 'teleport':
      return `teleport ${z.x} ${z.y} -> ${z.target.level} ${z.target.x} ${z.target.y}${
        z.target.exitDir === 'beam' ? '' : ` exit=${z.target.exitDir}`
      }${z.block ? ` block=${z.block.x},${z.block.y}` : ''}`;
    case 'cheeps':
      return `cheeps ${z.x} ${z.w}`;
    case 'bullets':
      return `bullets ${z.x} ${z.w}`;
    case 'bowser-fire':
      return `bowser-fire ${z.x}`;
    case 'loop':
      return `loop ${z.x} ${z.y0} ${z.y1} -> ${z.to}${
        z.checks.length ? ` check=${z.checks.map((c) => `${c.x}:${c.y0}:${c.y1}`).join(',')}` : ''
      }${z.need === 'any' ? ' any' : ''}`;
    case 'checkpoint':
      return `checkpoint ${z.x}${z.y === undefined ? '' : ` ${z.y}`}`;
    case 'scrollStop':
      return `scrollStop ${z.x}`;
    case 'warp':
      return `warp ${z.x} ${z.w} worlds=${z.worlds.join(',')}${z.text ? ` text=${z.text.replace(/ /g, '_')}` : ''}${
        z.secret ? ` secret=${z.secret}` : ''
      }${
        z.goto
          ? ` goto=${[z.goto.level, z.goto.x, z.goto.y, ...(z.goto.exitDir ? [z.goto.exitDir] : [])].join(',')}`
          : ''
      }${z.until ? ` until=${z.until}` : ''}`;
    case 'text':
      return `text ${z.x} ${z.y} ${z.triggerX} "${z.text}"`;
  }
}
