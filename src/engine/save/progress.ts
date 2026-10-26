import { loadJson, saveJson } from './storage';

/** The Lost Levels' worlds A-D open after the game has been beaten this many times (NES rules). */
export const LOST_LETTERS_GAMES = 8;

/** Classic mode's map sets, in the original's order (data/MapPack.as: Smb, Special, LostLevels). */
export const MAP_SET_IDS = ['smb', 'special', 'lost'] as const;
export type MapSetId = (typeof MAP_SET_IDS)[number];

/**
 * How far a map set has been beaten in Classic mode (enums/BeatGameStatus.as): the best map
 * difficulty a run of it was beaten on, or `none`. Ordered: a later status is a better one.
 */
export const BEAT_STATUSES = ['none', 'easy', 'normal', 'hard'] as const;
export type BeatStatus = (typeof BEAT_STATUSES)[number];
/** A difficulty a game can be beaten on (GameSettings.mapDifficulty). */
export type BeatDifficulty = Exclude<BeatStatus, 'none'>;

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
  /**
   * Classic mode's beat status per map set (G-005; StatManager.beatGameStatusVec): the best
   * difficulty each set was beaten on in a Classic mode run (never a campaign file or a dev run).
   * loadProgress always fills it in; absent counts as none beaten.
   */
  classicBeat?: Record<MapSetId, BeatStatus>;
}

const noBeat = (): Record<MapSetId, BeatStatus> => ({ smb: 'none', special: 'none', lost: 'none' });

/**
 * The stored beat statuses, cleaned. Before 0.5.0 a Classic SMB clear was kept as '8-4' in
 * `cleared` (it opened the Lost Levels): it counts as SMB beaten on Normal, the only difficulty
 * there was (docs/RELEASING.md: never silently drop saved data).
 */
function readBeat(stored: unknown, cleared: readonly string[]): Record<MapSetId, BeatStatus> {
  const out = noBeat();
  const o = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  for (const id of MAP_SET_IDS) {
    const v = o[id];
    if (typeof v === 'string' && (BEAT_STATUSES as readonly string[]).includes(v)) out[id] = v as BeatStatus;
  }
  if (out.smb === 'none' && cleared.includes('8-4')) out.smb = 'normal';
  return out;
}

export const PROGRESS_KEY = 'smbc.progress';

export function loadProgress(): Progress {
  const p = loadJson<Progress>(PROGRESS_KEY);
  const lost = { world9: false, letters: false, beaten: 0 };
  if (!p || p.v !== 1)
    return {
      v: 1,
      bestScore: 0,
      lastCharacter: 'mario',
      reached: {},
      cleared: [],
      lost,
      classicBeat: noBeat(),
    };
  const stored = p.lost?.beaten;
  // A 0.2.1 file has no count but may hold `letters: true` (set after one 8-4 clear then): it
  // starts at LOST_LETTERS_GAMES so the unlock it already had is kept (docs/RELEASING.md: never
  // silently drop saved data). New files still need LOST_LETTERS_GAMES clears.
  const beaten =
    typeof stored === 'number'
      ? Math.max(0, Math.floor(stored))
      : p.lost?.letters === true
        ? LOST_LETTERS_GAMES
        : 0;
  const cleared = Array.isArray(p.cleared) ? p.cleared : [];
  return {
    v: 1,
    bestScore: p.bestScore ?? 0,
    lastCharacter: p.lastCharacter ?? 'mario',
    reached: p.reached ?? {},
    cleared,
    lost: { world9: p.lost?.world9 === true, letters: beaten >= LOST_LETTERS_GAMES, beaten },
    classicBeat: readBeat(p.classicBeat, cleared),
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

/**
 * A Classic mode run beat map set `set` on `difficulty` (StatManager.setBeatGameStatus): kept
 * only when better than the status it had.
 */
export function recordBeat(p: Progress, set: MapSetId, difficulty: BeatDifficulty): Progress {
  const beat = p.classicBeat ?? noBeat();
  const was = BEAT_STATUSES.indexOf(beat[set]);
  if (BEAT_STATUSES.indexOf(difficulty) <= was) return p;
  return { ...p, classicBeat: { ...beat, [set]: difficulty } };
}

/**
 * Whether every map set has been beaten on at least `difficulty` (StatManager
 * allMapPacksBeatOnHard; v0.4.73 item 94: it no longer opens a Level Select cheat). `sets`
 * defaults to every set.
 */
export function allSetsBeaten(
  p: Progress,
  difficulty: BeatDifficulty,
  sets: readonly MapSetId[] = MAP_SET_IDS,
): boolean {
  const need = BEAT_STATUSES.indexOf(difficulty);
  return sets.every((id) => BEAT_STATUSES.indexOf((p.classicBeat ?? noBeat())[id]) >= need);
}
