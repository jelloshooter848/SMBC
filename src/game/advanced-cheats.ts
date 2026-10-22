import { loadJson, saveJson, storageReadable } from '@engine/save/storage';
import type { AssistSettings } from '@engine/save/settings';
import {
  advancedCheatsKey,
  classicFileKey,
  fileFingerprint,
  loadClearedFile,
  type ClassicFileRef,
  type ClearedFile,
} from './original-files';

export { advancedCheatsKey };

/*
 * v0.4.74 (owner item 60): ADVANCED CHEATS. Beating a map set on HARD unlocks them on THAT file
 * only: every dev Assist (Options' Assists page in dev mode, as each plays today), for the runs
 * of that file (its level replays), never another file's, never the campaign.
 *
 * Where it lives. The set is beaten once per file, and that clear is the file's last write (a
 * CLEARED file, v 2, is never written again: original-files.ts). So:
 * - the unlock is written with the clear itself (ClearedFile.advancedCheats); a Hard CLEARED file
 *   from before v0.4.74 reads as unlocked too (its rules say Hard, fixed for the file's life);
 * - what changes later (each row's value, and whether its explanation box was read) is kept
 *   beside the frozen file, under advancedCheatsKey(ref), tied to that very CLEARED file by a
 *   fingerprint of its stored text (`of`), which never changes. A later clear of the same slot
 *   (after ERASE FILE) is another text: it never inherits an earlier one's values.
 * - ERASE FILE removes it with the file (eraseClassicFile). An older version ignores it.
 *   Data a later version wrote there (a newer `v`) is kept as it is: never written, nothing on.
 */

/** Every Advanced cheat off (the dev Assists' own defaults; slow motion: normal speed). */
export const ADVANCED_OFF: Readonly<AssistSettings> = Object.freeze({
  allowLeftScroll: false,
  infiniteLives: false,
  invulnerable: false,
  infiniteTime: false,
  coyoteFrames: 0,
  fireRevertsToBig: false,
  safetyFloor: false,
  showHidden: false,
  slowMotion: 1,
});

/** A file's Advanced cheats: their values, and whether its explanation box was read (OK). */
export interface AdvancedState {
  seen: boolean;
  assist: AssistSettings;
}

/** The stored form (this version writes v 1). */
interface StoredAdvanced {
  v: 1;
  /** The CLEARED file's fingerprint (fileFingerprint of its stored text). */
  of: string;
  seen: boolean;
  assist: AssistSettings;
}

/** CLEARED file `f` has its Advanced cheats: beaten on Hard. */
export function advancedUnlocked(f: Pick<ClearedFile, 'rules' | 'advancedCheats'>): boolean {
  return f.advancedCheats === true || f.rules.difficulty === 'hard';
}

/** Values as stored, each checked (anything else is off). */
export function parseAssist(raw: unknown): AssistSettings {
  const a = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const flag = (k: keyof AssistSettings) => a[k] === true;
  const c = a.coyoteFrames;
  return {
    allowLeftScroll: flag('allowLeftScroll'),
    infiniteLives: flag('infiniteLives'),
    invulnerable: flag('invulnerable'),
    infiniteTime: flag('infiniteTime'),
    coyoteFrames: Number.isInteger(c) && (c as number) >= 0 && (c as number) <= 10 ? (c as number) : 0,
    fireRevertsToBig: flag('fireRevertsToBig'),
    safetyFloor: flag('safetyFloor'),
    showHidden: flag('showHidden'),
    slowMotion: a.slowMotion === 2 ? 2 : 1,
  };
}

/** What is read for file `ref` (null: not CLEARED, not unlocked, or storage cannot be read). */
export interface AdvancedRead {
  /** The CLEARED file's fingerprint (what a write is tied to). */
  fp: string;
  state: AdvancedState;
  /** A later version's data is there: kept, never written. */
  newer: boolean;
}

export function readAdvanced(ref: ClassicFileRef): AdvancedRead | null {
  if (!storageReadable()) return null;
  const f = loadClearedFile(ref);
  if (!f || !advancedUnlocked(f)) return null;
  const fp = fileFingerprint(loadJson<unknown>(classicFileKey(ref)));
  const raw = loadJson<unknown>(advancedCheatsKey(ref));
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Partial<StoredAdvanced>) : null;
  const v = (r as { v?: unknown } | null)?.v;
  if (typeof v === 'number' && v > 1)
    return { fp, newer: true, state: { seen: true, assist: { ...ADVANCED_OFF } } };
  if (r && v === 1 && r.of === fp)
    return { fp, newer: false, state: { seen: r.seen === true, assist: parseAssist(r.assist) } };
  return { fp, newer: false, state: { seen: false, assist: { ...ADVANCED_OFF } } };
}

/**
 * Writes `state` for file `ref`, as read with fingerprint `fp`: false when the file is no longer
 * that CLEARED file (another tab erased or cleared it again), a later version's data is there,
 * or storage refused it.
 */
export function writeAdvanced(ref: ClassicFileRef, fp: string, state: AdvancedState): boolean {
  const now = readAdvanced(ref);
  if (!now || now.newer || now.fp !== fp) return false;
  const out: StoredAdvanced = { v: 1, of: fp, seen: state.seen, assist: parseAssist(state.assist) };
  return saveJson(advancedCheatsKey(ref), out);
}
