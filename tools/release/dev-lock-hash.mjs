#!/usr/bin/env node
/*
 * The release workflow's dev-mode lock step (0.5.0, src/game/dev-lock.ts; docs/RELEASING.md).
 * Reads the passphrase from the DEV_MODE_PASSPHRASE environment variable (the Actions secret) and
 * prints only `DEV_MODE_HASH=<salted SHA-256>` for $GITHUB_ENV, which vite.config.ts builds in. It
 * never prints the passphrase. With no passphrase it prints nothing: the build then has no way into
 * dev mode at all.
 *
 * The passphrase must be one the game's prompt can type (scenes/passphrase.ts): 8 to 32 of A-Z,
 * 0-9 and '-', in any case (it is upper-cased first). Anything else fails the release (exit 1)
 * rather than lock the owner out; the error never shows the secret. The salt and the normalising
 * match dev-lock.ts.
 */
import { createHash } from 'node:crypto';

export const DEV_LOCK_SALT = 'smbc-remix/dev-mode/v1:';

/** What the prompt can type: 8 to 32 of A-Z, 0-9 and '-' (after upper-casing). */
export const PASSPHRASE_RULE = /^[A-Z0-9-]{8,32}$/;

/** The hash dev-lock.ts's hashPassphrase gives for `text`. */
export function devLockHash(text) {
  return createHash('sha256')
    .update(DEV_LOCK_SALT + text.trim().toUpperCase(), 'utf8')
    .digest('hex');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = process.env.DEV_MODE_PASSPHRASE ?? '';
  if (!raw) {
    process.stderr.write('No DEV_MODE_PASSPHRASE: this build has no dev mode.\n');
  } else {
    const pass = raw.toUpperCase();
    if (!PASSPHRASE_RULE.test(pass)) {
      process.stderr.write(
        '::error::DEV_MODE_PASSPHRASE must be 8 to 32 characters of A-Z, 0-9 and "-" (any case), ' +
          'which is all the game can type. Change the secret and release again.\n',
      );
      process.exit(1);
    }
    process.stdout.write(`DEV_MODE_HASH=${devLockHash(pass)}\n`);
  }
}
