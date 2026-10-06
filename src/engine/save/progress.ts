import { loadJson, saveJson } from './storage';

/** The Lost Levels' worlds A-D open after the game has been beaten this many times (NES rules). */
export const LOST_LETTERS_GAMES = 8;

export interface Progress {
  v: 1;
  bestScore: number;
  lastCharacter: string;
  /** Highest level reached per character id, e.g. "1-3". */
  reached: Record<string, string>;
  /** Levels cleared at least once. */
  cleared: string[];
  /**
   * The Lost Levels, under the NES (Famicom Disk System) rules the owner chose: `beaten` counts
   * the games beaten (8-4 cleared, with or without warps); `letters` (worlds A-D) is open once
   * that reaches LOST_LETTERS_GAMES; `world9` is set by an 8-4 clear without warps.
   */
  lost: { world9: boolean; letters: boolean; beaten: number };
}

export const PROGRESS_KEY = 'smbc.progress';

export function loadProgress(): Progress {
  const p = loadJson<Progress>(PROGRESS_KEY);
  const lost = { world9: false, letters: false, beaten: 0 };
  if (!p || p.v !== 1) return { v: 1, bestScore: 0, lastCharacter: 'mario', reached: {}, cleared: [], lost };
  const beaten = typeof p.lost?.beaten === 'number' && p.lost.beaten > 0 ? Math.floor(p.lost.beaten) : 0;
  return {
    v: 1,
    bestScore: p.bestScore ?? 0,
    lastCharacter: p.lastCharacter ?? 'mario',
    reached: p.reached ?? {},
    cleared: p.cleared ?? [],
    // `letters` follows the count: older builds set it after a single 8-4 clear.
    lost: { world9: p.lost?.world9 === true, letters: beaten >= LOST_LETTERS_GAMES, beaten },
  };
}

export function saveProgress(p: Progress): void {
  saveJson(PROGRESS_KEY, p);
}

/** One more Lost Levels game beaten (ll-8-4 cleared); `world9` when no warp zone was used. */
export function recordLostGameBeaten(p: Progress, warped: boolean): Progress {
  const beaten = p.lost.beaten + 1;
  return {
    ...p,
    lost: { world9: p.lost.world9 || !warped, letters: beaten >= LOST_LETTERS_GAMES, beaten },
  };
}

/** Whether the Lost Levels' worlds A-D are open (for the title's Lost Levels entry, when it comes). */
export function lostLettersOpen(p: Progress): boolean {
  return p.lost.beaten >= LOST_LETTERS_GAMES;
}
