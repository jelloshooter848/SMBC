import { loadJson, saveJson } from './storage';

export interface Progress {
  v: 1;
  bestScore: number;
  lastCharacter: string;
  /** Highest level reached per character id, e.g. "1-3". */
  reached: Record<string, string>;
  /** Levels cleared at least once. */
  cleared: string[];
}

export const PROGRESS_KEY = 'smbc.progress';

export function loadProgress(): Progress {
  const p = loadJson<Progress>(PROGRESS_KEY);
  if (!p || p.v !== 1) return { v: 1, bestScore: 0, lastCharacter: 'mario', reached: {}, cleared: [] };
  return {
    v: 1,
    bestScore: p.bestScore ?? 0,
    lastCharacter: p.lastCharacter ?? 'mario',
    reached: p.reached ?? {},
    cleared: p.cleared ?? [],
  };
}

export function saveProgress(p: Progress): void {
  saveJson(PROGRESS_KEY, p);
}
