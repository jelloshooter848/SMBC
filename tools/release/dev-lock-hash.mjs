#!/usr/bin/env node
/*
 * The release workflow's dev-mode lock step (0.5.0, src/game/dev-lock.ts; docs/RELEASING.md).
 * Reads the passphrase from the DEV_MODE_PASSPHRASE environment variable (the Actions secret) and
 * prints only `DEV_MODE_HASH=<salted SHA-256>` for $GITHUB_ENV, which vite.config.ts builds in. It
 * never prints the passphrase. With no passphrase it prints nothing: the build then has no way into
 * dev mode at all. The salt and the normalising (outer spaces trimmed, capitals) match dev-lock.ts.
 */
import { createHash } from 'node:crypto';

export const DEV_LOCK_SALT = 'smbc-remix/dev-mode/v1:';

/** The hash dev-lock.ts's hashPassphrase gives for `text`. */
export function devLockHash(text) {
  return createHash('sha256')
    .update(DEV_LOCK_SALT + text.trim().toUpperCase(), 'utf8')
    .digest('hex');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pass = process.env.DEV_MODE_PASSPHRASE ?? '';
  if (pass.trim()) process.stdout.write(`DEV_MODE_HASH=${devLockHash(pass)}\n`);
  else process.stderr.write('No DEV_MODE_PASSPHRASE: this build has no dev mode.\n');
}
