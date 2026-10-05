import { loadJson, saveJson } from './storage';

export interface Progress {
  v: 1;
  bestScore: number;
  lastCharacter: string;
  /** Highest level reached per character id, e.g. "1-3". */
  reached: Record<string, string>;
  /** Levels cleared at least once. */
  cleared: string[];
  /** The Lost Levels: World 9 (cleared 8-4 without warping) and worlds A-D (cleared 8-4). */
  lost: { world9: boolean; letters: boolean };
}

export const PROGRESS_KEY = 'smbc.progress';

export function loadProgress(): Progress {
  const p = loadJson<Progress>(PROGRESS_KEY);
  const lost = { world9: false, letters: false };
  if (!p || p.v !== 1) return { v: 1, bestScore: 0, lastCharacter: 'mario', reached: {}, cleared: [], lost };
  return {
    v: 1,
    bestScore: p.bestScore ?? 0,
    lastCharacter: p.lastCharacter ?? 'mario',
    reached: p.reached ?? {},
    cleared: p.cleared ?? [],
    lost: { world9: p.lost?.world9 === true, letters: p.lost?.letters === true },
  };
}

export function saveProgress(p: Progress): void {
  saveJson(PROGRESS_KEY, p);
}
