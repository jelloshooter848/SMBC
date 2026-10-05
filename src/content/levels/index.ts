import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';

const sources = import.meta.glob(['./world*/*.map', './lost/world*/*.map'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const cache = new Map<string, LevelData>();

/** All bundled levels keyed by id (e.g. "1-1", "1-1-bonus", Lost Levels "ll-1-1"). Parsed lazily. */
export function getLevel(id: string): LevelData {
  const hit = cache.get(id);
  if (hit) return hit;
  const path = Object.keys(sources).find((p) => p.endsWith(`/${id}.map`));
  if (!path) throw new Error(`unknown level "${id}"`);
  const level = parseTextMap(sources[path] as string, id);
  cache.set(id, level);
  return level;
}

/** Level ids in natural order (1-1, 1-1-bonus, 1-2, ..., 1-10). */
export function levelIds(): string[] {
  const key = (id: string) =>
    id
      .split('-')
      .map((part) => (/^\d+$/.test(part) ? part.padStart(4, '0') : part))
      .join('-');
  return Object.keys(sources)
    .map((p) => p.replace(/^.*\//, '').replace(/\.map$/, ''))
    .sort((a, b) => key(a).localeCompare(key(b)));
}
