import { LEVEL_ROWS } from '../constants';
import type { Decor, EntitySpawn, LevelData, PipeDir, Theme, TransferMode, Zone } from './schema';
import { DEFAULT_LEGEND, T } from './tiles';

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
 *   key: value            header lines (id, name, theme, music, time, start, width...)
 *   [legend]              optional overrides: `X tile-name` or `X @entity`
 *   [tiles]               15 rows; spaces and `;;` comments are stripped, so rows can be
 *                         written as space-separated 16-column screens
 *   [entities]            `type x y key=val ...`
 *   [zones]               `pipe x y dir -> level x y [exit=dir]`, `exit x next=id`,
 *                         `checkpoint x`, `scrollStop x`, `warp x w worlds=4,3,2`, `text x y triggerX "..."`
 *   [decor]               `kind x y`
 */
export function parseTextMap(src: string, idHint = 'level'): LevelData {
  const header: Record<string, string> = {};
  const legend: Record<string, number | string> = { ...DEFAULT_LEGEND };
  const rows: { text: string; line: number }[] = [];
  const entities: EntitySpawn[] = [];
  const zones: Zone[] = [];
  const decor: Decor[] = [];
  let section: 'header' | 'legend' | 'tiles' | 'entities' | 'zones' | 'decor' = 'header';

  const lines = src.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    let line = raw;
    const c = line.indexOf(';;');
    if (c >= 0) line = line.slice(0, c);
    if (section !== 'tiles' && line.trimStart().startsWith('#')) return;
    const trimmed = line.trim();
    if (!trimmed) return;
    const sec = /^\[(\w+)\]$/.exec(trimmed);
    if (sec) {
      const name = sec[1];
      if (
        name !== 'legend' &&
        name !== 'tiles' &&
        name !== 'entities' &&
        name !== 'zones' &&
        name !== 'decor'
      ) {
        throw new MapParseError(`unknown section [${name}]`, lineNo);
      }
      section = name;
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
        case 'decor': {
          const [kind, xs, ys] = trimmed.split(/\s+/);
          if (!kind || xs === undefined || ys === undefined) throw new Error('expected "kind x y"');
          decor.push({ kind, x: Number(xs), y: Number(ys) });
          break;
        }
      }
    } catch (e) {
      throw new MapParseError((e as Error).message, lineNo);
    }
  });

  if (rows.length !== LEVEL_ROWS) {
    throw new MapParseError(
      `expected ${LEVEL_ROWS} tile rows, got ${rows.length}`,
      rows[rows.length - 1]?.line ?? 0,
    );
  }
  const width = (rows[0] as { text: string }).text.length;
  const tiles = new Uint16Array(width * LEVEL_ROWS);
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

  const id = header.id ?? idHint;
  const [ws, ss] = id.split('-');
  const start = (header.start ?? '2,12').split(',').map(Number) as [number, number];
  const timeRaw = header.time ?? '400';
  const level: LevelData = {
    schema: 1,
    id,
    name: header.name ?? `WORLD ${id}`,
    world: Number(header.world ?? ws ?? 1) || 1,
    stage: Number(header.stage ?? ss ?? 1) || 1,
    theme: (header.theme ?? 'overworld') as Theme,
    music: header.music ?? header.theme ?? 'overworld',
    time: timeRaw === 'inherit' || timeRaw === 'null' ? null : Number(timeRaw),
    width,
    height: 15,
    tiles,
    entities,
    zones,
    decor,
    start: { x: start[0], y: start[1] },
    startMode: (header.startMode as LevelData['startMode']) ?? 'stand',
    camera: (header.camera as LevelData['camera']) ?? 'scroll',
    parent: header.parent ?? null,
  };
  return level;
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
      const props = parseProps(rest);
      const target: { level: string; x: number; y: number; exitDir?: TransferMode } = {
        level,
        x: Number(tx),
        y: Number(ty),
      };
      if (props.exit !== undefined) target.exitDir = String(props.exit) as TransferMode;
      return { kind: 'pipe', x: Number(xs), y: Number(ys), dir, target };
    }
    case 'vine': {
      // vine x y -> level x y
      const [, xs, ys, arrow, level, tx, ty] = parts;
      if (arrow !== '->' || !level || tx === undefined || ty === undefined)
        throw new Error('expected "vine x y -> level x y"');
      return { kind: 'vine', x: Number(xs), y: Number(ys), target: { level, x: Number(tx), y: Number(ty) } };
    }
    case 'pit': {
      // pit x -> level x y
      const [, xs, arrow, level, tx, ty] = parts;
      if (arrow !== '->' || !level || tx === undefined || ty === undefined)
        throw new Error('expected "pit x -> level x y"');
      return { kind: 'pit', x: Number(xs), target: { level, x: Number(tx), y: Number(ty) } };
    }
    case 'cheeps':
      return { kind: 'cheeps', x: Number(parts[1]), w: Number(parts[2]) };
    case 'bullets':
      return { kind: 'bullets', x: Number(parts[1]), w: Number(parts[2]) };
    case 'loop': {
      // loop x y0 y1 -> to [check=x:y0:y1]
      const [, xs, y0, y1, arrow, to, ...rest] = parts;
      if (arrow !== '->' || xs === undefined || y0 === undefined || y1 === undefined || to === undefined)
        throw new Error('expected "loop x y0 y1 -> to [check=x:y0:y1]"');
      const check = rest.find((r) => r.startsWith('check='));
      const c = check ? check.slice(6).split(':').map(Number) : null;
      return {
        kind: 'loop',
        x: Number(xs),
        y0: Number(y0),
        y1: Number(y1),
        to: Number(to),
        check: c ? { x: c[0] as number, y0: c[1] as number, y1: c[2] as number } : null,
      };
    }
    case 'exit': {
      const [, xs, ...rest] = parts;
      const props = parseProps(rest);
      if (xs === undefined || typeof props.next !== 'string') throw new Error('expected "exit x next=id"');
      return { kind: 'exit', x: Number(xs), next: props.next };
    }
    case 'checkpoint':
      return { kind: 'checkpoint', x: Number(parts[1]) };
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
  return out.join('\n') + '\n';
}

function serializeZone(z: Zone): string {
  switch (z.kind) {
    case 'pipe':
      return `pipe ${z.x} ${z.y} ${z.dir} -> ${z.target.level} ${z.target.x} ${z.target.y}${z.target.exitDir ? ` exit=${z.target.exitDir}` : ''}`;
    case 'exit':
      return `exit ${z.x} next=${z.next}`;
    case 'vine':
      return `vine ${z.x} ${z.y} -> ${z.target.level} ${z.target.x} ${z.target.y}`;
    case 'pit':
      return `pit ${z.x} -> ${z.target.level} ${z.target.x} ${z.target.y}`;
    case 'cheeps':
      return `cheeps ${z.x} ${z.w}`;
    case 'bullets':
      return `bullets ${z.x} ${z.w}`;
    case 'loop':
      return `loop ${z.x} ${z.y0} ${z.y1} -> ${z.to}${z.check ? ` check=${z.check.x}:${z.check.y0}:${z.check.y1}` : ''}`;
    case 'checkpoint':
      return `checkpoint ${z.x}`;
    case 'scrollStop':
      return `scrollStop ${z.x}`;
    case 'warp':
      return `warp ${z.x} ${z.w} worlds=${z.worlds.join(',')}${z.text ? ` text=${z.text.replace(/ /g, '_')}` : ''}`;
    case 'text':
      return `text ${z.x} ${z.y} ${z.triggerX} "${z.text}"`;
  }
}
