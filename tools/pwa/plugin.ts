/*
 * Home Screen support at build time (0.4.44): a small Vite plugin that
 * - draws the Home Screen icons (180, 192, 512 px PNG) from the pixel array in
 *   src/content/sprites/app-icon.ts, so no PNG is kept in the repository (check-no-binaries);
 * - writes the web app manifest;
 * - writes the service worker (tools/pwa/sw.js) with this release's version and the list of
 *   every file the build wrote, for offline play (build only: `pnpm dev` has no worker);
 * - links the manifest and the iPhone icon from index.html (base-path aware).
 * Dev serves the manifest and icons too, so the page's links resolve there.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import type { Plugin, ResolvedConfig } from 'vite';
import { APP_ICON, APP_ICON_COLOURS, APP_ICON_SIZES } from '../../src/content/sprites/app-icon.ts';

// ------------------------------------------------------------------ PNG

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** An 8-bit RGBA PNG of `rgba` (row-major, 4 bytes a pixel), compressed with node:zlib. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // bit depth 8, RGBA, deflate, no filter method, no interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** The icon at `size` px: each art cell a whole number of pixels, centred on the sky. */
export function renderIcon(size: number): Buffer {
  const grid = APP_ICON.length;
  const cell = Math.floor(size / grid);
  const pad = Math.floor((size - cell * grid) / 2);
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const sky = rgb(APP_ICON_COLOURS['.'] as string);
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - pad) / cell);
      const gy = Math.floor((y - pad) / cell);
      const ch = x >= pad && y >= pad && gx < grid && gy < grid ? APP_ICON[gy]?.[gx] : '.';
      const c = ch ? rgb(APP_ICON_COLOURS[ch] ?? '#000000') : sky;
      px.set([...c, 255], (y * size + x) * 4);
    }
  return encodePng(size, size, px);
}

// ------------------------------------------------------------------ manifest

/** The web app manifest. URLs are relative to the manifest, so any base path (/SMBC/) works. */
export function webManifest() {
  return {
    name: 'SMB Crossover REMIX',
    short_name: 'SMBC REMIX',
    description:
      'An unofficial browser remake of the fan game Super Mario Bros. Crossover by Exploding Rabbit, with original art and music.',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [192, 512].map((s) => ({
      src: `icons/icon-${s}.png`,
      sizes: `${s}x${s}`,
      type: 'image/png',
      purpose: 'any',
    })),
  };
}

// ------------------------------------------------------------------ service worker

const SW_FILE = 'sw.js';

/**
 * What the worker caches: the start URL ('./'), and every file the build wrote (`bundleFiles`,
 * hashed assets, index.html, icons, manifest) plus the public folder's (`publicFiles`), but not
 * source maps or the worker itself. Sorted, so the same build gives the same worker.
 */
export function precacheList(bundleFiles: readonly string[], publicFiles: readonly string[]): string[] {
  const keep = (f: string) => !f.endsWith('.map') && f !== SW_FILE && f !== '404.html';
  return ['./', ...[...new Set([...bundleFiles, ...publicFiles])].filter(keep).sort()];
}

const SW_TEMPLATE = new URL('./sw.js', import.meta.url);

/** The worker's source for release `version` caching `files`. */
export function serviceWorkerSource(version: string, files: readonly string[]): string {
  return readFileSync(SW_TEMPLATE, 'utf8')
    .replace("'__SW_VERSION__'", JSON.stringify(version))
    .replace('/* __SW_FILES__ */ []', JSON.stringify(files));
}

/** Every file under `dir`, relative and with forward slashes (the public folder). */
function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const n of names) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out;
}

// ------------------------------------------------------------------ the plugin

export interface PwaOptions {
  /** The release (__APP_VERSION__); the worker's version adds a hash of every file's content. */
  version: string;
  /** The public folder's files (default: read from Vite's publicDir). */
  publicFiles?: () => string[];
}

const ICON = (s: number) => `icons/icon-${s}.png`;

export function pwaPlugin(opts: PwaOptions): Plugin {
  let config: ResolvedConfig | null = null;
  const publicFiles = () => opts.publicFiles?.() ?? (config?.publicDir ? listFiles(config.publicDir) : []);
  return {
    name: 'smbc:pwa',
    configResolved(c) {
      config = c;
    },
    transformIndexHtml() {
      const base = config?.base ?? '/';
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}${ICON(180)}` }, injectTo: 'head' },
      ];
    },
    configureServer(server) {
      // Dev: the manifest and icons (no service worker).
      server.middlewares.use((req, res, next) => {
        const base = config?.base ?? '/';
        const path = (req.url ?? '').split('?')[0] ?? '';
        if (!path.startsWith(base)) return next();
        const file = path.slice(base.length);
        const size = APP_ICON_SIZES.find((s) => file === ICON(s));
        if (size) {
          res.setHeader('Content-Type', 'image/png');
          return res.end(renderIcon(size));
        }
        if (file === 'manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          return res.end(JSON.stringify(webManifest(), null, 2));
        }
        next();
      });
    },
    generateBundle: {
      order: 'post',
      handler(_out, bundle) {
        // Files emitted here may not show in `bundle` (Rolldown), so they are listed by name too.
        const ours = [...APP_ICON_SIZES.map(ICON), 'manifest.webmanifest'];
        for (const s of APP_ICON_SIZES)
          this.emitFile({ type: 'asset', fileName: ICON(s), source: renderIcon(s) });
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.webmanifest',
          source: JSON.stringify(webManifest(), null, 2) + '\n',
        });
        const files = precacheList([...Object.keys(bundle), ...ours], publicFiles());
        // Any change to any file (index.html included) makes a new worker, so a new cache.
        const hash = createHash('sha256');
        for (const name of Object.keys(bundle).sort()) {
          const item = bundle[name] as { code?: string; source?: string | Uint8Array };
          hash.update(name).update(item.code ?? item.source ?? '');
        }
        const version = `${opts.version}-${hash.digest('hex').slice(0, 10)}`;
        this.emitFile({ type: 'asset', fileName: SW_FILE, source: serviceWorkerSource(version, files) });
      },
    },
  };
}
