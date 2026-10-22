import { hasKey, loadJson, removeKey, saveJson } from '@engine/save/storage';
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
  };
}

/** Writes file `f` (stamped now); false when storage refused it. */
export function saveClassicFile(
  f: Omit<ClassicFile, 'savedAt' | 'v' | 'tutorialsSeen'> & {
    savedAt?: number;
    tutorialsSeen?: readonly string[];
  },
): boolean {
  const out: ClassicFile = {
    v: 1,
    set: f.set,
    slot: f.slot,
    rules: copyFileRules(f.rules),
    continues: f.continues,
    tutorialsSeen: strings(f.tutorialsSeen),
    run: { ...f.run },
    savedAt: f.savedAt ?? Date.now(),
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
 * count. A set with all three files used keeps the newest: the slot replaces the oldest file only
 * when it is newer (logged either way). An old key goes only once its run is written (or dropped
 * as older); a broken one is just removed. Returns whether anything was migrated.
 */
export function migrateClassicFiles(sharedRules: SharedClassicRules | (() => SharedClassicRules)): boolean {
  let moved = false;
  // The shared settings are read only when there is an old slot to migrate.
  let got: SharedClassicRules | null = null;
  const shared = () => (got ??= typeof sharedRules === 'function' ? sharedRules() : sharedRules);
  const take = (key: string, set: MapSetId | null) => {
    if (!hasKey(key)) return;
    const r = parseResume(loadJson<unknown>(key));
    if (!r) return removeKey(key);
    const into = set ?? resumeSetOf(r.levelId);
    if (!placeRun(into, r, shared())) return;
    moved = true;
    removeKey(key);
  };
  // The single slot first: it is the newer run of its set when both are there (an older build
  // wrote it after the per-set slots existed), so it lands in FILE 1 ahead of the per-set one.
  take(CLASSIC_RESUME_KEY, null);
  for (const set of MAP_SET_IDS) take(classicResumeKey(set), set);
  return moved;
}

/** One old run into a file of `set`; false when it could not be written (the old key stays). */
function placeRun(set: MapSetId, r: ClassicResume, shared: SharedClassicRules): boolean {
  const files = listClassicFiles(set);
  const savedAt = r.savedAt ?? 0;
  // A file with anything in it (an unreadable one too) is not empty.
  let slot: ClassicFileSlot | undefined = CLASSIC_FILE_SLOTS.find((s) => !hasClassicFile({ set, slot: s }));
  // Full, with an unreadable file: the old run takes the first unreadable one (a readable run is
  // never dropped for a file nothing can play).
  const broken = CLASSIC_FILE_SLOTS.findIndex((_, i) => files[i] === null);
  if (slot === undefined && broken >= 0) {
    slot = CLASSIC_FILE_SLOTS[broken] as ClassicFileSlot;
    console.warn(`Classic files: ${set} is full; unreadable FILE ${slot} was replaced by a saved run`);
  }
  if (slot === undefined) {
    // Full of readable files: the oldest goes only for a newer run (else the old run is dropped).
    let oldest = -1;
    files.forEach((f, i) => {
      if (f && (oldest < 0 || f.savedAt < (files[oldest] as ClassicFile).savedAt)) oldest = i;
    });
    const old = oldest < 0 ? null : (files[oldest] as ClassicFile);
    if (!old || savedAt <= old.savedAt) {
      console.warn(`Classic files: ${set} is full; an older saved run was not migrated`);
      return true;
    }
    slot = CLASSIC_FILE_SLOTS[oldest] as ClassicFileSlot;
    console.warn(`Classic files: ${set} is full; FILE ${slot} was replaced by a newer saved run`);
  }
  const options = { ...shared.classic, weapons: { ...shared.classic.weapons } };
  if (r.gameMode) options.gameMode = r.gameMode;
  const rules = parseFileRules({
    difficulty: r.difficulty ?? shared.difficulty,
    options,
    heroesOff: [...(shared.heroesOff ?? [])],
  });
  return saveClassicFile({
    set,
    slot,
    rules,
    continues: r.continues ?? Math.max(0, Math.floor(shared.continuesUsed) || 0),
    tutorialsSeen: shared.tutorialsSeen ?? [],
    run: r,
    ...(savedAt ? { savedAt } : {}),
  });
}
