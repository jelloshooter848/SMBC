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
    ...(storedMark(raw) ? { fromOld: storedMark(raw) as OldSaveMark } : {}),
  };
}

/** Writes file `f` (stamped now); false when storage refused it. */
export function saveClassicFile(
  f: Omit<ClassicFile, 'savedAt' | 'v' | 'tutorialsSeen'> & {
    savedAt?: number;
    tutorialsSeen?: readonly string[];
  },
): boolean {
  // #205: the file's old-save mark stays through every save that does not set its own.
  const fromOld = f.fromOld ?? storedMark(loadJson<unknown>(classicFileKey(f)));
  const out: ClassicFile = {
    v: 1,
    set: f.set,
    slot: f.slot,
    rules: copyFileRules(f.rules),
    continues: f.continues,
    tutorialsSeen: strings(f.tutorialsSeen),
    run: { ...f.run },
    savedAt: f.savedAt ?? Date.now(),
    ...(fromOld ? { fromOld: { key: fromOld.key, fp: fromOld.fp } } : {}),
  };
  // The run carries none of the old slot-only fields (the file holds them).
  delete out.run.difficulty;
  delete out.run.gameMode;
  delete out.run.continues;
  delete out.run.savedAt;
  return saveJson(classicFileKey(f), out);
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
