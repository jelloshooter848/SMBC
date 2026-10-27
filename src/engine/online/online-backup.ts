import { defaultSettings, SETTINGS_KEY } from '../save/settings';
import { loadJson, saveJson } from '../save/storage';

/*
 * Online backup (owner item 159), the part the page needs at once: the backup code (typed and
 * shown), where this device keeps it, the online copy's dev-field stripping, and the types of
 * the network side. Nothing here talks to the network or loads crypto: that is
 * nostr-backup.ts, reached only through import() when a row is used (owner item 160).
 *
 * The code IS the key (nostr-backup.ts): 10 random Crockford Base32 characters (50 bits),
 * shown as two groups of five. Typing is as forgiving as save codes: any case, spaces and
 * dashes ignored, O read as 0, I and L as 1.
 */

/** Characters in a backup code. */
export const CODE_CHARS = 10;
/** The built-in relays (nostr-backup.ts RELAYS) and how many must accept a backup. */
export const RELAY_COUNT = 5;
export const MIN_ACCEPTS = 2;

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const READ_AS: Readonly<Record<string, string>> = { O: '0', I: '1', L: '1' };

/** A new random code (10 canonical characters), from the browser's crypto random numbers. */
export function newBackupCode(
  rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  return [...rand(CODE_CHARS)].map((b) => BASE32[b & 31]).join('');
}

/** Typed text as a code's 10 canonical characters, or null when it is not one. */
export function normalizeBackupCode(text: string): string | null {
  let out = '';
  for (const ch of text) {
    if (ch === '-' || /\s/.test(ch)) continue;
    const up = ch.toUpperCase();
    const c = READ_AS[up] ?? up;
    if (!BASE32.includes(c)) return null;
    out += c;
  }
  return out.length === CODE_CHARS ? out : null;
}

/** 'ABCDE-12345'. */
export function formatBackupCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** The code letter by letter, its two groups apart, so a screen reader spells it. */
export function spokenBackupCode(code: string): string {
  return `${code.slice(0, 5).split('').join(' ')}, ${code.slice(5).split('').join(' ')}`;
}

/**
 * Where this device keeps its backup code, so BACK UP ONLINE replaces the same online copy
 * every time: a game key, so it is in a backup file and in the online copy (a restore on another
 * device brings it along) and Erase all data removes it, as everything else. `shown`: the code
 * has been shown to the player (it is shown once, after the first backup with it).
 */
export const ONLINE_BACKUP_KEY = 'smbc.onlineBackup';

export interface StoredOnlineCode {
  code: string;
  shown: boolean;
  /**
   * The last backup's time (its event's created_at, seconds): the next one is at least a second
   * later, so a device clock behind it, or two backups in one second, still replace it.
   */
  lastAt?: number;
}

export function loadOnlineCode(): StoredOnlineCode | null {
  const v = loadJson<Partial<StoredOnlineCode>>(ONLINE_BACKUP_KEY);
  const code = typeof v?.code === 'string' ? normalizeBackupCode(v.code) : null;
  if (!code) return null;
  const at = v?.lastAt;
  return {
    code,
    shown: v?.shown === true,
    ...(typeof at === 'number' && Number.isFinite(at) ? { lastAt: at } : {}),
  };
}

/**
 * `data` as restored or imported onto this device: its backup code (if any) marked not yet
 * shown here, so this device shows it once, as after a first backup (v0.4.76 review).
 */
export function withCodeUnshown(data: Readonly<Record<string, string>>): Record<string, string> {
  const out = { ...data };
  const raw = out[ONLINE_BACKUP_KEY];
  if (raw === undefined) return out;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (v && typeof v === 'object' && !Array.isArray(v))
      out[ONLINE_BACKUP_KEY] = JSON.stringify({ ...v, shown: false });
  } catch {
    /* kept as it is: loadOnlineCode reads no code from it */
  }
  return out;
}

export function saveOnlineCode(v: StoredOnlineCode): boolean {
  return saveJson(ONLINE_BACKUP_KEY, v);
}

/** Keys only dev mode uses, left out of the online copy. */
const DEV_KEYS = ['smbc.devLast'];
/** A dev field's name: dev, devUnlock, devUnlockAll… (not "device"). */
const DEV_FIELD = /^dev([A-Z]|$)/;
/** A Campaign file's key. */
const SAVE_KEY = /^smbc\.save\.\d+$/;

/** `raw` (JSON) without its top-level dev fields, `also` applied; as it is when it does not read. */
function withoutDev(raw: string, also?: (o: Record<string, unknown>) => void): string {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return raw;
    for (const k of Object.keys(o)) if (DEV_FIELD.test(k)) delete o[k];
    also?.(o);
    return JSON.stringify(o);
  } catch {
    return raw;
  }
}

/**
 * The online copy of this device's data (owner defaults 3 and item 161): every key as stored,
 * but the settings and every Campaign file without their dev fields (dev, devUnlock,
 * devUnlockAll, devAllHeroes, devGateOpen, devInventory, any dev*), the settings' Classic dev
 * toggles and assists (only dev mode plays them) at their defaults, and the dev level pick left
 * out, so a restore never opens dev mode, or its tools, on another device. (A Classic file's
 * run keeps its devHero mark: a guard that stops a dev-only hero's file playing outside dev
 * mode.) Values that do not read are sent as they are: the restore checks them as it checks a
 * backup file.
 */
export function onlineCopy(data: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (DEV_KEYS.includes(k)) continue;
    if (k === SETTINGS_KEY)
      out[k] = withoutDev(v, (s) => {
        const d = defaultSettings();
        s.classicDev = d.classicDev;
        s.assist = d.assist;
      });
    else if (SAVE_KEY.test(k)) out[k] = withoutDev(v);
    else out[k] = v;
  }
  return out;
}

/**
 * BACK UP ONLINE's outcome: backed up on `accepted` of `total` relays at `at` (the event's
 * time), or why not: 'too-big'; 'newer' (the servers hold a newer copy under this code);
 * 'refused' (every relay that answered said no); 'servers' (too few, or none, answered).
 */
export type BackUpResult =
  | { ok: true; accepted: number; total: number; at: number }
  | { ok: false; reason: 'too-big' | 'servers' | 'refused' | 'newer'; accepted: number; total: number };

/** RESTORE FROM CODE's outcome: the backup's text, or why not ('servers': none answered). */
export type RestoreResult =
  { ok: true; text: string; from: string } | { ok: false; reason: 'not-found' | 'servers' };

/** The network side, from the lazily loaded nostr-backup.ts. */
export interface OnlineApi {
  newCode(): string;
  /** `after`: the last backup's time; this one is at least a second later. */
  backUp(code: string, text: string, after?: number): Promise<BackUpResult>;
  restore(code: string): Promise<RestoreResult>;
}
