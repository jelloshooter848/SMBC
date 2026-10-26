/** localStorage wrapper that never throws (private mode, quota, disabled storage). */

/*
 * The data marker (SAVE DATA, owner items 87-88): an import or an erase writes a new random value
 * here before it changes anything. Each page load keeps the value it first saw; once the stored
 * value differs, this tab's state is stale (another tab, or this one before its restart, replaced
 * the data under it), so its writes and removals are refused and onStaleStorage is told (main.ts
 * reloads the page). With no import or erase ever made the key is absent and nothing changes.
 * It holds no game data and is never exported.
 */
export const DATA_EPOCH_KEY = 'smbc.dataEpoch';

/** The marker this page load saw first (undefined: not read yet). */
let seenEpoch: string | null | undefined;
let staleHandler: (() => void) | null = null;

function readEpoch(): string | null {
  try {
    return localStorage.getItem(DATA_EPOCH_KEY);
  } catch {
    return null;
  }
}

function noteEpoch(): void {
  if (seenEpoch === undefined) seenEpoch = readEpoch();
}

/** Whether this tab's state is older than the stored data (it must not write); tells the handler. */
export function storageIsStale(): boolean {
  noteEpoch();
  if (readEpoch() === seenEpoch) return false;
  staleHandler?.();
  return true;
}

/** Called when this tab finds its state stale (main.ts: reload the page). */
export function onStaleStorage(fn: (() => void) | null): void {
  staleHandler = fn;
}

/** Takes the stored data as this tab's own again (a page load does this; tests stand in for one). */
export function adoptDataEpoch(): void {
  seenEpoch = readEpoch();
}

export function loadJson<T>(key: string): T | null {
  noteEpoch();
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): boolean {
  if (storageIsStale()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  if (storageIsStale()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Whether `key` is known to hold nothing: false when something is stored there, and false too
 * when storage cannot be read (so a refused erase is never taken for a done one).
 */
export function keyAbsent(key: string): boolean {
  try {
    return localStorage.getItem(key) === null;
  } catch {
    return false;
  }
}

/** Whether anything is stored under `key` (false when storage is unavailable). */
export function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * v0.4.73 (item 69): whether storage can be read at all (false when getItem throws, or there
 * is no storage). A read that throws looks like an empty key to loadJson and hasKey, so a writer
 * that must never put a run over a file it cannot see asks this first.
 */
export function storageReadable(): boolean {
  try {
    localStorage.getItem('smbc-classic-probe');
    return true;
  } catch {
    return false;
  }
}
