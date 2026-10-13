import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { pwaPlugin } from './tools/pwa/plugin.ts';
import { offlinePlugin } from './tools/offline/plugin.ts';

const base = process.env.VITE_BASE ?? '/';

// Version shown on the title screen (docs/RELEASING.md): the bare package.json version for a release
// build (RELEASE_TAG, or the commit carrying the tag v<version>), `<version>-dev.<sha>` otherwise.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
function git(args: string): string | null {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null; // no git, not a repository, or no such tag
  }
}
const releaseTag = `v${pkg.version}`;
const isRelease =
  process.env.RELEASE_TAG === releaseTag ||
  git(`describe --exact-match --tags --match ${releaseTag} HEAD`) === releaseTag;
const sha = git('rev-parse --short HEAD');
const appVersion = isRelease ? pkg.version : sha ? `${pkg.version}-dev.${sha}` : `${pkg.version}-dev`;

/**
 * Level files use the `.map` extension, which Vite's dev server treats as a source map: any URL whose
 * path ends in `.map` is answered as JSON (or handed to the static server) before the `?raw` transform
 * runs, so `import x from './1-1.map?raw'` gets the bare text back instead of a JS module. Resolve those
 * imports to a virtual id that doesn't end in `.map` and load the text ourselves; this behaves the same
 * in dev, build and Vitest. The real file is registered as a watch dependency so edits still trigger HMR.
 */
function rawMapFiles(): Plugin {
  const prefix = '\0raw-map:';
  const suffix = '.js';
  return {
    name: 'smbc:raw-map-files',
    enforce: 'pre',
    async resolveId(source, importer) {
      const [path = '', query = ''] = source.split('?', 2);
      if (!path.endsWith('.map') || !new URLSearchParams(query).has('raw')) return null;
      const resolved = await this.resolve(path, importer, { skipSelf: true });
      if (!resolved || resolved.external || resolved.id.includes('/node_modules/')) return null;
      return prefix + resolved.id + suffix;
    },
    async load(id) {
      if (!id.startsWith(prefix)) return null;
      const file = id.slice(prefix.length, -suffix.length);
      this.addWatchFile(file);
      return `export default ${JSON.stringify(await readFile(file, 'utf8'))};`;
    },
  };
}

/**
 * `pnpm build:offline` (vite build --mode offline, 0.4.49): the download, one index.html in
 * dist-offline/ that plays from the disk (file://) with everything inside it (tools/offline/plugin.ts).
 * Relative paths, one script, no public folder, no source map, and no PWA plugin: no service worker,
 * manifest or Home Screen icon.
 */
const OFFLINE_BUILD = {
  outDir: 'dist-offline',
  sourcemap: false,
  modulePreload: false,
  assetsInlineLimit: () => true,
  chunkSizeWarningLimit: 8192,
  rolldownOptions: { output: { codeSplitting: false } },
} as const;

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: offline ? './' : base,
    publicDir: offline ? false : 'public',
    plugins: [
      rawMapFiles(),
      offline
        ? offlinePlugin({
            version: appVersion,
            favicon: fileURLToPath(new URL('./public/favicon.svg', import.meta.url)),
          })
        : pwaPlugin({ version: appVersion }),
    ],
    define: { __APP_VERSION__: JSON.stringify(appVersion) },
    resolve: {
      alias: {
        '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
        '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
        '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      },
    },
    build: offline ? { target: 'es2022', ...OFFLINE_BUILD } : { target: 'es2022', sourcemap: true },
    server: { port: 5173 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
      // The level and map sims take a second or two each alone, far longer on a busy machine.
      testTimeout: 30_000,
    },
  };
});
