import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { hashPassphrase } from '@game/dev-lock';

// The dev-mode lock (0.5.0): a release build carries only the passphrase's salted hash (from
// DEV_MODE_HASH, which the release workflow derives from its secret), never the passphrase.

const PASS = 'BUNDLE-TEST-PASS-7';

describe('a release build with the dev-mode lock', () => {
  it('has the hash in its bundle and not the passphrase', async () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const hash = await hashPassphrase(PASS);
    const out = mkdtempSync(join(tmpdir(), 'smbc-devlock-'));
    const env = { RELEASE_TAG: process.env.RELEASE_TAG, DEV_MODE_HASH: process.env.DEV_MODE_HASH };
    process.env.RELEASE_TAG = `v${pkg.version}`;
    process.env.DEV_MODE_HASH = hash;
    try {
      await build({
        configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
        mode: 'offline',
        logLevel: 'silent',
        build: { outDir: out, emptyOutDir: true },
      });
      const html = readFileSync(join(out, 'index.html'), 'utf8');
      expect(html).toContain(hash);
      expect(html.toUpperCase()).not.toContain(PASS);
    } finally {
      for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      rmSync(out, { recursive: true, force: true });
    }
  }, 180_000);
});
