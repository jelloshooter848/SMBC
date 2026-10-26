import { DATA_EPOCH_KEY } from './storage';
import { crc32 } from './zip';

/*
 * SAVE DATA (owner items 86-88): one backup file of everything the game keeps in this browser's
 * localStorage, and the all-or-nothing import and erase.
 *
 * The inventory (every key the game writes; all start `smbc.` or `smbc-`):
 * - `smbc.settings`              engine/save/settings.ts   settings, cheats, assists, Classic options,
 *                                                          tutorials seen, packs turned on
 * - `smbc.progress`              engine/save/progress.ts   progress flags (map sets beaten…)
 * - `smbc.save.1..3`             game/save/save-files.ts   Campaign files
 * - `smbc-classic-file-{set}-{1..3}` game/original-files.ts Classic files (set: smb, lost, special)
 * - `smbc-classic-resume`, `smbc-classic-resume-{set}` game/run-resume.ts  old Classic slots
 *                                                          (0.4.67, 0.4.68) waiting to migrate
 * - `smbc.levels`                game/level/library.ts     the level editor's custom levels
 * - `smbc.devLast`               game/scenes/dev-play.ts   the dev Level select's last pick
 * - `smbc.dataEpoch`             engine/save/storage.ts    the data marker (not data: never exported)
 * IndexedDB: database `smbc`, store `packs` (engine/assets/idb.ts), the asset packs: exported as
 * `<name>.zip` files beside the backup, never inside it, and never restored by an import.
 *
 * Every key with the game's prefixes is backed up as its stored text, so a key a newer build adds
 * is kept too, and an import gives back the very same bytes. Older data inside a backup is read
 * by the game's own migrations once imported (settings, Campaign saves, Classic slots).
 */

/** What a backup file says it is. */
export const BACKUP_FORMAT = 'smbc-remix-backup';
/** This build's backup format (a newer one is refused: this build cannot know what it holds). */
export const BACKUP_FORMAT_VERSION = 1;
/** Longer than any browser's localStorage holds (about 5 million characters): refused unread. */
export const MAX_BACKUP_CHARS = 12_000_000;

/** Whether `key` is one of the game's: `smbc.` or `smbc-` (another app on the origin is left alone). */
export function isGameKey(key: string): boolean {
  return (key.startsWith('smbc.') || key.startsWith('smbc-')) && key !== DATA_EPOCH_KEY;
}

/** The parts of Storage the backup uses (localStorage; a test's stand-in). */
export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const local = (): KeyValueStore => (globalThis as { localStorage: KeyValueStore }).localStorage;

/** Every game key and its stored text, sorted by key. Throws when storage cannot be read. */
export function readGameData(store: KeyValueStore = local()): Record<string, string> {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k !== null && isGameKey(k)) keys.push(k);
  }
  keys.sort();
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = store.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  gameVersion: string;
  exportedAt: string;
  /** CRC-32 (8 hex digits) of `data` as JSON with its keys sorted: a changed letter shows. */
  checksum: string;
  data: Record<string, string>;
}

function sortedJson(data: Record<string, string>): string {
  const keys = Object.keys(data).sort();
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, data[k]])));
}

function checksumOf(data: Record<string, string>): string {
  return crc32(new TextEncoder().encode(sortedJson(data)))
    .toString(16)
    .padStart(8, '0');
}

/** `smbc-remix-backup-YYYY-MM-DD.json`, the local date. */
export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `smbc-remix-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** The backup of everything stored now. Throws when storage cannot be read (no half backup). */
export function buildBackup(opts: { gameVersion: string; now: Date; store?: KeyValueStore }): {
  text: string;
  fileName: string;
  keys: number;
} {
  const data = readGameData(opts.store);
  const b: Backup = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    gameVersion: opts.gameVersion,
    exportedAt: opts.now.toISOString(),
    checksum: checksumOf(data),
    data,
  };
  return {
    text: JSON.stringify(b, null, 1),
    fileName: backupFileName(opts.now),
    keys: Object.keys(data).length,
  };
}

/** Why a file was not taken. */
export type BackupRefusal = 'too-big' | 'not-json' | 'not-backup' | 'newer-format' | 'newer-game' | 'damaged';

/** What the screen says for each (font text, at most 28 characters). */
export const REFUSAL_TEXT: Readonly<Record<BackupRefusal, string>> = {
  'too-big': 'FILE TOO BIG: NOT A BACKUP',
  'not-json': 'FILE NOT READABLE',
  'not-backup': 'NOT AN SMBC REMIX BACKUP',
  'newer-format': 'BACKUP FROM A NEWER GAME',
  'newer-game': 'BACKUP FROM A NEWER GAME',
  damaged: 'BACKUP IS DAMAGED',
};

/** What is said for each (the screen reader's longer line). */
export const REFUSAL_SAID: Readonly<Record<BackupRefusal, string>> = {
  'too-big': 'That file is too big to be a backup. Nothing changed.',
  'not-json': 'That file is not readable: it is not a backup, or it was cut short. Nothing changed.',
  'not-backup': 'That file is not an SMBC REMIX backup. Nothing changed.',
  'newer-format':
    'That backup was made by a newer version of the game. Update the game, then import it. Nothing changed.',
  'newer-game':
    'That backup was made by a newer version of the game. Update the game, then import it. Nothing changed.',
  damaged: 'That backup is damaged. Nothing changed.',
};

/** The release numbers of a version ("2.4.16-dev.abc" → [2, 4, 16]); null when there are none. */
function release(v: string): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Whether release `a` is newer than release `b` (a dev build counts as its release). */
export function newerVersion(a: string, b: string): boolean {
  const x = release(a);
  const y = release(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++)
    if ((x[i] as number) !== (y[i] as number)) return (x[i] as number) > (y[i] as number);
  return false;
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; reason: BackupRefusal };

/**
 * The whole file checked before anything changes: JSON, a backup of this game, a format and a
 * game version this build reads, every key the game's and every value text, the checksum right.
 */
export function parseBackup(text: string, gameVersion: string): ParsedBackup {
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, reason: 'too-big' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not-backup' };
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) return { ok: false, reason: 'not-backup' };
  const fv = o.formatVersion;
  if (typeof fv !== 'number' || !Number.isInteger(fv) || fv < 1) return { ok: false, reason: 'damaged' };
  if (fv > BACKUP_FORMAT_VERSION) return { ok: false, reason: 'newer-format' };
  if (typeof o.gameVersion !== 'string' || !release(o.gameVersion)) return { ok: false, reason: 'damaged' };
  if (newerVersion(o.gameVersion, gameVersion)) return { ok: false, reason: 'newer-game' };
  const data = o.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'damaged' };
  for (const [k, v] of Object.entries(data as Record<string, unknown>))
    if (!isGameKey(k) || typeof v !== 'string') return { ok: false, reason: 'damaged' };
  const d = data as Record<string, string>;
  if (typeof o.checksum !== 'string' || o.checksum !== checksumOf(d)) return { ok: false, reason: 'damaged' };
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      formatVersion: fv,
      gameVersion: o.gameVersion,
      exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
      checksum: o.checksum,
      data: d,
    },
  };
}

/**
 * Why an import or an erase changed nothing: storage could not be read ('read'), ran out of room
 * ('quota'), refused a write ('write'), or another tab changed the data meanwhile ('changed').
 */
export type ChangeFailure = 'read' | 'quota' | 'write' | 'changed';
export type ChangeResult = { ok: true } | { ok: false; reason: ChangeFailure };

const isQuota = (e: unknown): boolean => {
  const n = (e as { name?: string; code?: number } | null)?.name;
  const c = (e as { code?: number } | null)?.code;
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || c === 22 || c === 1014;
};

/** A fresh value for the data marker. */
function newEpoch(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Makes the game's keys exactly `data` (an import; an erase is `{}`), all or nothing: the old
 * keys go (room for the new), the data marker changes (stale tabs stop writing), the new ones
 * are written and read back (a write that slipped in shows there). Any failure puts every key, and the marker, back as it was.
 */
export function replaceGameData(data: Record<string, string>, store: KeyValueStore = local()): ChangeResult {
  let before: Record<string, string>;
  let epoch: string | null;
  try {
    before = readGameData(store);
    epoch = store.getItem(DATA_EPOCH_KEY);
  } catch {
    return { ok: false, reason: 'read' };
  }
  const rollBack = (): void => {
    try {
      for (const k of Object.keys(readGameData(store))) store.removeItem(k);
    } catch {
      for (const k of new Set([...Object.keys(before), ...Object.keys(data)])) {
        try {
          store.removeItem(k);
        } catch {
          /* keep going: put back what can be */
        }
      }
    }
    try {
      if (epoch === null) store.removeItem(DATA_EPOCH_KEY);
      else store.setItem(DATA_EPOCH_KEY, epoch);
    } catch {
      /* keep going: put back what can be */
    }
    for (const [k, v] of Object.entries(before)) {
      try {
        store.setItem(k, v);
      } catch {
        /* the old data fitted before: this only fails with storage itself failing */
      }
    }
  };
  try {
    for (const k of Object.keys(before)) store.removeItem(k);
    store.setItem(DATA_EPOCH_KEY, newEpoch());
    for (const k of Object.keys(data).sort()) store.setItem(k, data[k] as string);
  } catch (e) {
    rollBack();
    return { ok: false, reason: isQuota(e) ? 'quota' : 'write' };
  }
  // Read back: every key as written and no other (an old build's tab may have written meanwhile).
  let now: Record<string, string>;
  try {
    now = readGameData(store);
  } catch {
    rollBack();
    return { ok: false, reason: 'read' };
  }
  if (sortedJson(now) !== sortedJson(data)) {
    rollBack();
    return { ok: false, reason: 'changed' };
  }
  return { ok: true };
}

/** ERASE ALL DATA: every game key goes, all or nothing (the data marker stays, changed). */
export function eraseGameData(store: KeyValueStore = local()): ChangeResult {
  return replaceGameData({}, store);
}

/** What the screen says when an import or erase changed nothing (font text, 28 characters at most). */
export const CHANGE_FAILURE_TEXT: Readonly<Record<ChangeFailure, string>> = {
  read: 'STORAGE CANNOT BE READ',
  quota: 'NOT ENOUGH SPACE',
  write: 'STORAGE REFUSED THE CHANGE',
  changed: 'ANOTHER TAB CHANGED DATA',
};
