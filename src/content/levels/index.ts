import { parseLayers, parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';

// SMB1's worlds, The Lost Levels' and Super Mario Bros. Special's (`sp-` ids, G-020; kept in
// src/content/special-levels/, apart from the campaign's maps here).
const sources = import.meta.glob(
  ['./world*/*.map', './lost/world*/*.map', '../special-levels/world*/*.map'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

/**
 * Each area's `.layers` file (src/content/level-layers/, same paths; written by
 * tools/levelgen/regen.mjs --layers): the original's pieces for the other map difficulties and
 * for heroes with level flags, laid in Classic play only (level/layers.ts). The .map files never
 * change for them.
 */
const layerSources = import.meta.glob(
  [
    '../level-layers/world*/*.layers',
    '../level-layers/special/world*/*.layers',
    '../level-layers/lost/world*/*.layers',
  ],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

const cache = new Map<string, LevelData>();

/** The `.layers` file beside a map's path (Special's under level-layers/special/). */
function layersPath(mapPath: string): string {
  return mapPath
    .replace(/^\.\.\/special-levels\//, '../level-layers/special/')
    .replace(/^\.\//, '../level-layers/')
    .replace(/\.map$/, '.layers');
}

/**
 * All bundled levels keyed by id (e.g. "1-1", "1-1-bonus", Special "sp-1-1", Lost Levels
 * "ll-1-1"). Parsed lazily.
 */
export function getLevel(id: string): LevelData {
  const hit = cache.get(id);
  if (hit) return hit;
  const path = Object.keys(sources).find((p) => p.endsWith(`/${id}.map`));
  if (!path) throw new Error(`unknown level "${id}"`);
  const level = parseTextMap(sources[path] as string, id);
  const layers = layerSources[layersPath(path)];
  if (layers !== undefined)
    level.layers = [...(level.layers ?? []), ...parseLayers(layers, level.width, level.height)];
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
