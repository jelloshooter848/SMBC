import { hasKey, keyAbsent, loadJson, removeKey, saveJson } from '@engine/save/storage';
import { MAP_SET_IDS, type MapSetId } from '@engine/save/progress';
import {
  defaultClassicSettings,
  normaliseClassic,
  type ClassicSettings,
} from '@engine/save/original-options';
import { MAP_DIFFICULTIES, type MapDifficulty } from '@engine/save/settings';
import {
  CLASSIC_RESUME_KEY,
  classicResumeKey,
  parseResume,
  resumeSetOf,
  type ClassicResume,
} from './run-resume';

/*
 * B-L: Classic mode's save files. Each map set has three files (FILE 1-3), so 9 in all, each under
 * its own key `smbc-classic-file-{set}-{slot}`, never a campaign save. A file is made when a new
 * game is started on an empty one: its rules (Map difficulty, Game mode, More settings, Weapons,
 * Disable heroes) are chosen then, starting at the original's defaults, and are fixed for the
 * file's life; to change them the file is erased and started again. Beside the rules a file keeps
 * its run (run-resume.ts ClassicResume, written at each WORLD card and at a game over's continue
 * point) and its own continues count (Infinite Lives' goal). Nothing in a file is ever written
 * back into the shared settings.
 */

export const CLASSIC_FILE_SLOTS = [1, 2, 3] as const;
export type ClassicFileSlot = (typeof CLASSIC_FILE_SLOTS)[number];

/** Which file: its map set and slot. */
export interface ClassicFileRef {
  set: MapSetId;
  slot: ClassicFileSlot;
}

/** The storage key of file `ref`. */
export function classicFileKey(ref: ClassicFileRef): string {
  return `smbc-classic-file-${ref.set}-${ref.slot}`;
}

/** A file's rules, fixed once it starts. */
export interface ClassicFileRules {
  difficulty: MapDifficulty;
  /**
   * Game mode, More settings and Weapons (the shared Music set row is not a file's: its value
   * here is ignored and always the original's).
   */
  options: ClassicSettings;
  /** Disable heroes: the select-slot hero ids left out (at least one stays on). */
  heroesOff: string[];
}

export interface ClassicFile {
  v: 1;
  set: MapSetId;
  slot: ClassicFileSlot;
  rules: ClassicFileRules;
  /** Continues used in this file's run (Infinite Lives unlocks only at 0). */
  continues: number;
  /**
   * The Tutorials boxes shown in this file's game (TutorialManager.saveData keeps them in the
   * original's save): each shows once per game. A new file starts with none.
   */
  tutorialsSeen: string[];
  /** Where the run is. */
  run: ClassicResume;
  /**
   * v0.4.73 (owner 95): which game this is: a token each new game or resume of the file sets
   * (Game.runToken), kept at its every save. Only the game holding the file now may write it
   * CLEARED (saveClearedFile's `only`), so a tab whose file was erased and started again in
   * another tab never writes over that new game. Files from before have none.
   */
  runId?: string;
  /** When it was last written (Date.now()). */
  savedAt: number;
  /**
   * #205: the old save (pre-files key) this file was copied from, and a fingerprint of that
   * key's stored text. Kept through every later save of the file; it goes when the file is
   * erased. Only this marks an old key as already migrated (never the run's content).
   */
  fromOld?: OldSaveMark;
}

/** #205: which old save a file was copied from (its key and stored text's fingerprint). */
export interface OldSaveMark {
  key: string;
  fp: string;
}

/** A stable fingerprint of an old key's stored text (FNV-1a, 32 bits, as hex). */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The mark old key `key` would leave, from its stored value as read; null when it is gone. */
function markOf(key: string, raw: unknown): OldSaveMark | null {
  return raw === null || raw === undefined ? null : { key, fp: fingerprint(JSON.stringify(raw)) };
}

/** A stored file's mark, when it has a well-formed one. */
function storedMark(raw: unknown): OldSaveMark | null {
  const m = raw && typeof raw === 'object' ? (raw as { fromOld?: unknown }).fromOld : null;
  if (!m || typeof m !== 'object') return null;
  const { key, fp } = m as { key?: unknown; fp?: unknown };
  return typeof key === 'string' && typeof fp === 'string' ? { key, fp } : null;
}

/** The original's rules (GameSettings.resetDifficultySettings; Normal, every hero on). */
export function originalFileRules(): ClassicFileRules {
  return { difficulty: 'normal', options: defaultClassicSettings(), heroesOff: [] };
}

/** A copy of `r` (so a draft or a run never shares objects with a stored file). */
export function copyFileRules(r: ClassicFileRules): ClassicFileRules {
  return {
    difficulty: r.difficulty,
    options: { ...r.options, weapons: { ...r.options.weapons } },
    heroesOff: [...r.heroesOff],
  };
}

/** Rules as stored, each value checked (an unknown one is the original's). */
export function parseFileRules(raw: unknown): ClassicFileRules {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = r.difficulty;
  const off = Array.isArray(r.heroesOff)
    ? [...new Set((r.heroesOff as unknown[]).filter((id): id is string => typeof id === 'string'))]
    : [];
  const options = normaliseClassic(r.options);
  // The shared rows are not a file's (Music set; the retired Expansion heroes row).
  const base = defaultClassicSettings();
  options.musicSet = base.musicSet;
  options.expansion = base.expansion;
  return {
    difficulty: (MAP_DIFFICULTIES as readonly unknown[]).includes(d) ? (d as MapDifficulty) : 'normal',
    options,
    heroesOff: off,
  };
}

/** File `ref`, or null when it is empty or does not read as a file (a broken one). */
export function loadClassicFile(ref: ClassicFileRef): ClassicFile | null {
  return parseFile(loadJson<unknown>(classicFileKey(ref)), ref);
}

function parseFile(raw: unknown, ref: ClassicFileRef): ClassicFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<ClassicFile>;
  if (f.v !== 1) return null;
  const run = parseResume(f.run);
  if (!run) return null;
  const c = f.continues;
  return {
    v: 1,
    set: ref.set,
    slot: ref.slot,
    rules: parseFileRules(f.rules),
    continues: Number.isInteger(c) && (c as number) >= 0 ? Math.min(999999, c as number) : 0,
    tutorialsSeen: strings(f.tutorialsSeen),
    run,
    savedAt: typeof f.savedAt === 'number' && Number.isFinite(f.savedAt) ? f.savedAt : 0,
    ...(typeof f.runId === 'string' ? { runId: f.runId } : {}),
    ...(storedMark(raw) ? { fromOld: storedMark(raw) as OldSaveMark } : {}),
  };
}

/**
 * v0.4.73 (owner 46B, 47A): whether what is stored at `ref` must never be written over by a run:
 * a CLEARED file (v 2), and anything a later version wrote (a newer `v`), readable here or not.
 * Only ERASE FILE empties such a file.
 */
function keptForGood(raw: unknown): boolean {
  const v = raw && typeof raw === 'object' ? (raw as { v?: unknown }).v : undefined;
  return typeof v === 'number' && v >= 2;
}

/** v0.4.73: file `ref` is CLEARED (or a later version's): no run writes or empties it. */
export function classicFileKept(ref: ClassicFileRef): boolean {
  const now = storedNow(classicFileKey(ref));
  return !now.read || keptForGood(now.value);
}

/**
 * What is stored at `key` before a write: `read` false when storage could not be read (its
 * getItem threw), so a CLEARED file there cannot be ruled out and nothing is written; `value`
 * the parsed value (null when empty, the raw text when it is not JSON).
 */
function storedNow(key: string): { read: boolean; value: unknown } {
  let text: string | null;
  try {
    text = localStorage.getItem(key);
  } catch {
    return { read: false, value: null };
  }
  if (text === null) return { read: true, value: null };
  try {
    return { read: true, value: JSON.parse(text) as unknown };
  } catch {
    return { read: true, value: text };
  }
}

/** Writes file `f` (stamped now); false when storage refused it, or the file is CLEARED. */
export function saveClassicFile(
  f: Omit<ClassicFile, 'savedAt' | 'v' | 'tutorialsSeen'> & {
    savedAt?: number;
    tutorialsSeen?: readonly string[];
  },
): boolean {
  const stored = storedNow(classicFileKey(f));
  const now = stored.value;
  // v0.4.73 (47A): a CLEARED file (or a later version's) is never written again, by any run,
  // any tab: a stale tab's WORLD card, Tutorials list or continue point leaves it as it is. A
  // read that fails cannot rule one out: nothing is written then either.
  if (!stored.read || keptForGood(now)) return false;
  // #205: the file's old-save mark stays through every save that does not set its own.
  const fromOld = f.fromOld ?? storedMark(now);
  const out: ClassicFile = {
    v: 1,
    set: f.set,
    slot: f.slot,
    rules: copyFileRules(f.rules),
    continues: f.continues,
    tutorialsSeen: strings(f.tutorialsSeen),
    run: { ...f.run },
    savedAt: f.savedAt ?? Date.now(),
    ...(f.runId ? { runId: f.runId } : {}),
    ...(fromOld ? { fromOld: { key: fromOld.key, fp: fromOld.fp } } : {}),
  };
  // The run carries none of the old slot-only fields (the file holds them).
  delete out.run.difficulty;
  delete out.run.gameMode;
  delete out.run.continues;
  delete out.run.savedAt;
  return saveJson(classicFileKey(f), out);
}

/**
 * v0.4.73 (owner 46B): a map set beaten in a file keeps that file as CLEARED: the run as it was
 * when the set was beaten (its score, lives and hero frozen), its rules, and the worlds the run
 * reached (ClassicResume.worlds: the replay's world box). It is stored as `v: 2`, so an older
 * version (which reads only v 1) keeps it as unreadable and never writes over it. It is never
 * written again (saveClassicFile and saveClearedFile refuse it); ERASE FILE empties it, and only
 * then can a new game start there (50A). Migration counts it as used (hasClassicFile).
 *
 * `v: 2` is reserved for CLEARED files: a later run format must use v 3 or more (which this
 * version keeps as unreadable and never writes over), and a later CLEARED format must keep
 * `cleared: true` beside its own `v`.
 */
export interface ClearedFile {
  v: 2;
  cleared: true;
  set: MapSetId;
  slot: ClassicFileSlot;
  rules: ClassicFileRules;
  continues: number;
  tutorialsSeen: string[];
  /** The run as the set was beaten (never played on: the replay starts levels afresh). */
  run: ClassicResume;
  /** When the set was beaten (Date.now()). */
  savedAt: number;
  fromOld?: OldSaveMark;
}

/** File `ref` when it is CLEARED and reads, else null (empty, a run, or broken). */
export function loadClearedFile(ref: ClassicFileRef): ClearedFile | null {
  const raw = loadJson<unknown>(classicFileKey(ref));
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<ClearedFile>;
  if (f.v !== 2 || f.cleared !== true) return null;
  const run = parseResume(f.run);
  if (!run) return null;
  const c = f.continues;
  return {
    v: 2,
    cleared: true,
    set: ref.set,
    slot: ref.slot,
    rules: parseFileRules(f.rules),
    continues: Number.isInteger(c) && (c as number) >= 0 ? Math.min(999999, c as number) : 0,
    tutorialsSeen: strings(f.tutorialsSeen),
    run,
    savedAt: typeof f.savedAt === 'number' && Number.isFinite(f.savedAt) ? f.savedAt : 0,
    ...(storedMark(raw) ? { fromOld: storedMark(raw) as OldSaveMark } : {}),
  };
}

/**
 * The set beaten in file `f` (Game.showEnding): the file becomes CLEARED, once. False when
 * storage refused it (the file keeps its last run, so nothing is lost) or when it is CLEARED
 * already (or a later version's): the first clear stays as it was. v0.4.73 (owner 95): with
 * `only`, it is written only over the game `only` names (ClassicFile.runId): a file emptied or
 * started again by another tab is left as it is (false).
 */
export function saveClearedFile(
  f: Omit<ClearedFile, 'savedAt' | 'v' | 'cleared' | 'tutorialsSeen'> & {
    savedAt?: number;
    tutorialsSeen?: readonly string[];
  },
  only?: string,
): boolean {
  const stored = storedNow(classicFileKey(f));
  const now = stored.value;
  if (!stored.read || keptForGood(now)) return false;
  if (only !== undefined && !holdsGame(now, only)) return false;
  const fromOld = f.fromOld ?? storedMark(now);
  const out: ClearedFile = {
    v: 2,
    cleared: true,
    set: f.set,
    slot: f.slot,
    rules: copyFileRules(f.rules),
    continues: f.continues,
    tutorialsSeen: strings(f.tutorialsSeen),
    run: { ...f.run },
    savedAt: f.savedAt ?? Date.now(),
    ...(fromOld ? { fromOld: { key: fromOld.key, fp: fromOld.fp } } : {}),
  };
  delete out.run.difficulty;
  delete out.run.gameMode;
  delete out.run.continues;
  delete out.run.savedAt;
  delete out.run.continued;
  return saveJson(classicFileKey(f), out);
}

/** Whether stored value `raw` is a v 1 file of game `runId`. */
function holdsGame(raw: unknown, runId: string): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const f = raw as { v?: unknown; runId?: unknown };
  return f.v === 1 && f.runId === runId;
}

/**
 * The worlds a CLEARED file's replay offers (its world box): Worlds 1-8 of every set; The Lost
 * Levels' World 9 and A-D (10-13) only when its run reached them (a run with no record of that,
 * from before v0.4.73, reached none of them as far as anyone knows).
 */
export function replayWorlds(f: Pick<ClearedFile, 'set' | 'run'>): number[] {
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  if (f.set !== 'lost') return base;
  const reached = new Set(f.run.worlds ?? []);
  return [...base, ...[9, 10, 11, 12, 13].filter((w) => reached.has(w))];
}

/** Whether anything is stored for file `ref` (a broken file too). */
export function hasClassicFile(ref: ClassicFileRef): boolean {
  return hasKey(classicFileKey(ref));
}

/** #205: whether file `ref` is known to be empty (false when storage cannot be read). */
export function classicFileGone(ref: ClassicFileRef): boolean {
  return keyAbsent(classicFileKey(ref));
}

/** ERASE FILE: file `ref` is empty again. */
export function eraseClassicFile(ref: ClassicFileRef): void {
  removeKey(classicFileKey(ref));
}

/** Map set `set`'s three files, in slot order (null: empty). */
export function listClassicFiles(set: MapSetId): (ClassicFile | null)[] {
  return CLASSIC_FILE_SLOTS.map((slot) => loadClassicFile({ set, slot }));
}

/** A list of ids as stored: its strings, each once. */
function strings(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
}

/** What migration takes from the shared settings for a run that had no rules of its own. */
export interface SharedClassicRules {
  classic: ClassicSettings;
  heroesOff?: readonly string[];
  difficulty: MapDifficulty;
  /** The retired shared count (classicCheats.continuesUsed), read only here. */
  continuesUsed: number;
  /** The old shared Tutorials seen list (Settings.classicTutorialsSeen), read only here. */
  tutorialsSeen?: readonly string[];
}

/**
 * B-L migration, copy then delete, safe to repeat: the 0.4.67 single slot goes into its level's
 * set; each per-set slot (0.4.68 on) goes into FILE 1 of its set, or the next empty file. A
 * migrated file keeps the slot's Map difficulty and Game mode; its other rules are the shared
 * Classic options as they are now, and its continues the slot's own count (#196), else the shared
 * count. No file is ever overwritten (31a-b, v0.4.71): a set with no empty file (an unreadable
 * one counts as used) keeps the old key as it is, logged once, and it moves into the next file
 * that is freed (by ERASE FILE, or a run ending; oldRunsWaiting tells the file box). An old key
 * goes only once its run is written; one that does not read as a run is kept as it is (31c).
 * Returns whether anything was migrated.
 */
export function migrateClassicFiles(sharedRules: SharedClassicRules | (() => SharedClassicRules)): boolean {
  let moved = false;
  // The shared settings are read only when there is an old slot to migrate.
  let got: SharedClassicRules | null = null;
  const shared = () => (got ??= typeof sharedRules === 'function' ? sharedRules() : sharedRules);
  const take = (key: string, set: MapSetId | null) => {
    if (!hasKey(key)) return;
    const raw = loadJson<unknown>(key);
    const r = parseResume(raw);
    // 31c: an old key that does not read as a run (damaged, or a newer build's) is kept as it is.
    if (!r) return noteOnce(key, raw, `Classic files: ${key} cannot be read; it is kept`);
    const into = set ?? resumeSetOf(r.levelId);
    const mark = markOf(key, raw) as OldSaveMark;
    // #205: a file of its set was copied from this very key and text (its removal was refused
    // then): it is migrated. Only the removal is retried; it is never copied again.
    if (markedIn(into, mark)) {
      removeKey(key);
      return;
    }
    const placed = placeRun(into, r, shared(), mark);
    if (placed === 'full')
      return noteOnce(key, raw, `Classic files: ${into} is full; ${key} waits for a free file`);
    if (placed !== 'placed') return;
    moved = true;
    removeKey(key);
  };
  // The single slot first: it is the newer run of its set when both are there (an older build
  // wrote it after the per-set slots existed), so it lands in FILE 1 ahead of the per-set one.
  take(CLASSIC_RESUME_KEY, null);
  for (const set of MAP_SET_IDS) take(classicResumeKey(set), set);
  return moved;
}

/** What has been logged already (migration runs at every read; each kept key is logged once). */
const noted = new Set<string>();
function noteOnce(key: string, raw: unknown, message: string): void {
  const id = `${key}|${JSON.stringify(raw) ?? ''}`;
  if (noted.has(id)) return;
  noted.add(id);
  console.warn(message);
}

/**
 * #205: whether a file of `set` carries `mark` (the same old key and the same stored text): the
 * old save was copied there. Decided by provenance only, never by the run's content.
 */
function markedIn(set: MapSetId, mark: OldSaveMark): boolean {
  return CLASSIC_FILE_SLOTS.some((slot) => {
    const m = storedMark(loadJson<unknown>(classicFileKey({ set, slot })));
    return m !== null && m.key === mark.key && m.fp === mark.fp;
  });
}

/**
 * 31a: how many old saves (readable, so they will migrate) are waiting for a free file of `set`,
 * which is full: each moves into the next file that is freed.
 */
export function oldRunsWaiting(set: MapSetId): number {
  let n = 0;
  if (hasKey(CLASSIC_RESUME_KEY)) {
    const raw = loadJson<unknown>(CLASSIC_RESUME_KEY);
    const r = parseResume(raw);
    if (r && resumeSetOf(r.levelId) === set && !markedIn(set, markOf(CLASSIC_RESUME_KEY, raw) as OldSaveMark))
      n++;
  }
  const key = classicResumeKey(set);
  if (hasKey(key)) {
    const raw = loadJson<unknown>(key);
    const r = parseResume(raw);
    if (r && !markedIn(set, markOf(key, raw) as OldSaveMark)) n++;
  }
  return n;
}

/**
 * One old run into the first empty file of `set`: 'placed'; 'full' when every file has something
 * in it (an unreadable one too: it is never overwritten); 'failed' when storage refused it.
 */
function placeRun(
  set: MapSetId,
  r: ClassicResume,
  shared: SharedClassicRules,
  fromOld: OldSaveMark,
): 'placed' | 'full' | 'failed' {
  // A file with anything in it is not empty: an unreadable one too (a newer build's after a
  // downgrade may read again there), so it is never overwritten (31b).
  const slot = CLASSIC_FILE_SLOTS.find((s) => !hasClassicFile({ set, slot: s }));
  if (slot === undefined) return 'full';
  const savedAt = r.savedAt ?? 0;
  const options = { ...shared.classic, weapons: { ...shared.classic.weapons } };
  if (r.gameMode) options.gameMode = r.gameMode;
  const rules = parseFileRules({
    difficulty: r.difficulty ?? shared.difficulty,
    options,
    heroesOff: [...(shared.heroesOff ?? [])],
  });
  const ok = saveClassicFile({
    set,
    slot,
    rules,
    continues: r.continues ?? Math.max(0, Math.floor(shared.continuesUsed) || 0),
    tutorialsSeen: shared.tutorialsSeen ?? [],
    run: r,
    ...(savedAt ? { savedAt } : {}),
    fromOld,
  });
  return ok ? 'placed' : 'failed';
}
