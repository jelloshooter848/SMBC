import type { Settings } from '@engine/save/settings';

/*
 * The developer-mode lock (0.5.0, owner). Release builds open dev mode only with the owner's
 * passphrase; local and test builds keep it open as before.
 *
 * - The passphrase is never in the repository, the CI logs or the bundle. The release workflow
 *   reads the Actions secret DEV_MODE_PASSPHRASE and hands the build only its salted SHA-256
 *   (`DEV_MODE_HASH`, vite.config.ts → `__DEV_LOCK_HASH__`). At runtime the entry is hashed with
 *   WebCrypto and compared.
 * - With no secret, a release build has no way in at all: the title's code does nothing.
 * - `?dev=` is ignored on a release build, and a dev flag saved by an earlier version is cleared
 *   until the passphrase is entered (settings.devUnlock remembers which build's lock was opened).
 * - The prompt (scenes/passphrase.ts) offers A-Z, 0-9, space and '-': an entry is hashed in
 *   capitals with its outer spaces trimmed (`normalizePassphrase`), as the workflow does.
 */

/** The fixed salt in front of the passphrase (the same in release.yml's hash step). */
export const DEV_LOCK_SALT = 'smbc-remix/dev-mode/v1:';

/**
 * open: dev mode as before (local, dev and test builds). locked: only the passphrase opens it
 * (a release build with a hash). closed: no way in (a release build without one).
 */
export type DevLockMode = 'open' | 'locked' | 'closed';

export interface DevLock {
  readonly mode: DevLockMode;
  /** The salted SHA-256 (64 hex digits) a correct entry hashes to; '' unless locked. */
  readonly hash: string;
}

export const OPEN_DEV_LOCK: DevLock = { mode: 'open', hash: '' };

/** The lock for a build: open unless it is a release; a release with a well-formed hash is locked. */
export function devLockFor(release: boolean, hash: string): DevLock {
  if (!release) return OPEN_DEV_LOCK;
  return /^[0-9a-f]{64}$/.test(hash) ? { mode: 'locked', hash } : { mode: 'closed', hash: '' };
}

/** What the prompt hashes: capitals, outer spaces trimmed. */
export function normalizePassphrase(text: string): string {
  return text.trim().toUpperCase();
}

/** The salted SHA-256 of an entry, as 64 lowercase hex digits (WebCrypto). */
export async function hashPassphrase(text: string): Promise<string> {
  const data = new TextEncoder().encode(DEV_LOCK_SALT + normalizePassphrase(text));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether `entry` opens `lock` (never for an open or closed lock: nothing to check). */
export async function passphraseOpens(lock: DevLock, entry: string): Promise<boolean> {
  if (lock.mode !== 'locked' || !entry.trim()) return false;
  return (await hashPassphrase(entry)) === lock.hash;
}

/**
 * At start-up: a locked or closed build turns off a dev flag that this build's passphrase did
 * not open (one saved by an earlier version, or by another build). True when it changed anything.
 */
export function enforceDevLock(lock: DevLock, settings: Pick<Settings, 'dev' | 'devUnlock'>): boolean {
  if (lock.mode === 'open') return false;
  const opened = lock.mode === 'locked' && settings.devUnlock === lock.hash;
  if (!settings.dev || opened) return false;
  settings.dev = false;
  return true;
}

/** Whether `?dev=` may change dev mode: only on a build whose lock is open. */
export function urlDevAllowed(lock: DevLock): boolean {
  return lock.mode === 'open';
}
