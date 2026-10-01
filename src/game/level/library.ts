import { loadJson, saveJson } from '@engine/save/storage';
import { parseTextMap } from './textmap';
import type { LevelData } from './schema';

/** Custom levels saved in the browser, keyed by name, stored as .map text. */
export interface LevelLibrary {
  v: 1;
  levels: Record<string, string>;
}

export const LIBRARY_KEY = 'smbc.levels';
export const CUSTOM_PREFIX = 'custom-';

export function loadLibrary(): LevelLibrary {
  const lib = loadJson<LevelLibrary>(LIBRARY_KEY);
  if (!lib || lib.v !== 1 || typeof lib.levels !== 'object') return { v: 1, levels: {} };
  return lib;
}

export function saveLibrary(lib: LevelLibrary): boolean {
  return saveJson(LIBRARY_KEY, lib);
}

export function customLevelId(name: string): string {
  return (
    CUSTOM_PREFIX +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/** Parse a stored custom level; the level id is derived from its library name. */
export function getCustomLevel(lib: LevelLibrary, id: string): LevelData | null {
  for (const [name, text] of Object.entries(lib.levels)) {
    if (customLevelId(name) === id) {
      const lvl = parseTextMap(text, id);
      lvl.id = id;
      return lvl;
    }
  }
  return null;
}
