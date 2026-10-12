import { describe, expect, it } from 'vitest';
import { crc32, inflateSync } from 'node:zlib';
import {
  encodePng,
  precacheList,
  pwaPlugin,
  renderIcon,
  serviceWorkerSource,
  webManifest,
} from '../../tools/pwa/plugin';
import { APP_ICON, APP_ICON_COLOURS, APP_ICON_SIZES } from '../../src/content/sprites/app-icon';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A small PNG reader for the tests: checks every chunk's CRC and unpacks 8-bit RGBA, filter 0. */
function decodePng(png: Buffer): { width: number; height: number; rgba: Buffer } {
  expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  let at = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  let ended = false;
  while (at < png.length) {
    const len = png.readUInt32BE(at);
    const type = png.subarray(at + 4, at + 8).toString('latin1');
    const data = png.subarray(at + 8, at + 8 + len);
    const crc = png.readUInt32BE(at + 8 + len);
    expect(crc, `${type} CRC`).toBe(crc32(png.subarray(at + 4, at + 8 + len)));
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([...data.subarray(8)]).toEqual([8, 6, 0, 0, 0]); // 8-bit RGBA, no interlace
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') ended = true;
    at += 12 + len;
  }
  expect(ended).toBe(true);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4 + 1;
  expect(raw.length).toBe(stride * height);
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    expect(raw[y * stride]).toBe(0);
    raw.copy(rgba, y * width * 4, y * stride + 1, (y + 1) * stride);
  }
  return { width, height, rgba };
}

const hex = (rgba: Buffer, w: number, x: number, y: number) =>
  '#' +
  [...rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 3)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

describe('Home Screen icon PNGs (built from the pixel array)', () => {
  it('the art is a 24 × 24 grid whose every letter has a colour', () => {
    expect(APP_ICON).toHaveLength(24);
    for (const row of APP_ICON) {
      expect(row).toHaveLength(24);
      for (const ch of row) expect(APP_ICON_COLOURS[ch], ch).toBeDefined();
    }
  });

  it('encodePng writes a valid, decodable PNG', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 0]);
    const out = decodePng(encodePng(2, 2, rgba));
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect([...out.rgba]).toEqual([...rgba]);
  });

  it.each(APP_ICON_SIZES)('%i px: signature, size, opaque, the art centred by whole pixels', (size) => {
    const { width, height, rgba } = decodePng(renderIcon(size));
    expect(width).toBe(size);
    expect(height).toBe(size);
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(255); // iOS blackens transparency
    const cell = Math.floor(size / 24);
    const pad = Math.floor((size - cell * 24) / 2);
    // Every cell of the grid is one solid colour, at its own place.
    for (let gy = 0; gy < 24; gy++)
      for (let gx = 0; gx < 24; gx++) {
        const want = APP_ICON_COLOURS[(APP_ICON[gy] as string)[gx] as string];
        expect(hex(rgba, size, pad + gx * cell, pad + gy * cell)).toBe(want);
        expect(hex(rgba, size, pad + gx * cell + cell - 1, pad + gy * cell + cell - 1)).toBe(want);
      }
    // The margin round a grid that doesn't fill the square is the sky too.
    expect(hex(rgba, size, 0, 0)).toBe(APP_ICON_COLOURS['.']);
    expect(hex(rgba, size, size - 1, size - 1)).toBe(APP_ICON_COLOURS['.']);
  });
});

describe('web app manifest', () => {
  it('names, standalone, black, and the 192 and 512 icons, all relative to the base path', () => {
    const m = webManifest();
    expect(m.name).toBe('SMB Crossover REMIX');
    expect(m.short_name).toBe('SMBC REMIX');
    expect(m.display).toBe('standalone');
    expect(m.background_color).toBe('#000000');
    expect(m.theme_color).toBe('#000000');
    // Relative URLs resolve against the manifest's own URL, so /SMBC/ (Pages) and / both work.
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(m.icons).toEqual([
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ]);
  });
});

/** A fake build output: hashed JS and CSS with their source maps, the page, and generated files. */
const BUNDLE_FILES = [
  'index.html',
  'assets/index-B4xk2Lq9.js',
  'assets/index-B4xk2Lq9.js.map',
  'assets/index-Cz81Yt0a.css',
  'assets/worker-9fJd2k1L.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.webmanifest',
];

describe('service worker precache list', () => {
  it('has index.html and every hashed asset, the public files, and no source maps or sw.js', () => {
    const list = precacheList([...BUNDLE_FILES, 'sw.js'], ['favicon.svg']);
    expect(list).toContain('index.html');
    for (const f of BUNDLE_FILES.filter((f) => !f.endsWith('.map'))) expect(list).toContain(f);
    expect(list).toContain('favicon.svg');
    expect(list.some((f) => f.endsWith('.map'))).toBe(false);
    expect(list).not.toContain('sw.js');
    expect(new Set(list).size).toBe(list.length);
    // './' (the start URL) is the page too.
    expect(list).toContain('./');
  });

  it('the plugin emits icons, manifest and sw.js; the worker lists every file of the build', async () => {
    const plugin = pwaPlugin({ version: '0.4.44', publicFiles: () => ['favicon.svg'] });
    const emitted = new Map<string, string | Uint8Array>();
    const bundle: Record<string, { fileName: string; type: string; code?: string; source?: string }> = {};
    for (const f of BUNDLE_FILES.filter((f) => !f.startsWith('icons/') && !f.startsWith('manifest')))
      bundle[f] = f.endsWith('.js')
        ? { fileName: f, type: 'chunk', code: `/* ${f} */` }
        : { fileName: f, type: 'asset', source: `/* ${f} */` };
    const ctx = {
      emitFile(file: { fileName: string; source: string | Uint8Array }) {
        // Like Rolldown: what is emitted here does not show in `bundle`.
        emitted.set(file.fileName, file.source);
        return file.fileName;
      },
    };
    const hook = plugin.generateBundle as unknown as { handler: (...a: unknown[]) => void };
    hook.handler.call(ctx, {}, bundle, false);
    for (const s of APP_ICON_SIZES) expect(emitted.has(`icons/icon-${s}.png`)).toBe(true);
    expect(JSON.parse(String(emitted.get('manifest.webmanifest'))).short_name).toBe('SMBC REMIX');
    const sw = String(emitted.get('sw.js'));
    const worker = runWorker(sw, 'https://example.github.io/SMBC/');
    await worker.wait;
    const files = worker.files;
    for (const f of BUNDLE_FILES.filter((f) => !f.endsWith('.map')))
      expect(files).toContain(`https://example.github.io/SMBC/${f}`);
    expect(files).toContain('https://example.github.io/SMBC/favicon.svg');
  });
});

/** Runs the worker's source against a fake `self` and `caches`, and installs it. */
function runWorker(source: string, scope: string) {
  const listeners = new Map<string, (e: unknown) => void>();
  const files: string[] = [];
  const cacheNames: string[] = [];
  const self = {
    registration: { scope },
    location: new URL('sw.js', scope),
    addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, fn),
    skipWaiting: () => undefined,
  };
  const caches = {
    open: async (name: string) => {
      cacheNames.push(name);
      return { addAll: async (reqs: { url: string }[]) => void files.push(...reqs.map((r) => r.url)) };
    },
  };
  class FakeRequest {
    constructor(
      readonly url: string,
      readonly init: unknown,
    ) {}
  }
  new Function('self', 'caches', 'Request', source)(self, caches, FakeRequest);
  let wait: Promise<unknown> = Promise.resolve();
  listeners.get('install')?.({ waitUntil: (p: Promise<unknown>) => (wait = p) });
  return { files, cacheNames, listeners, wait };
}

describe('service worker', () => {
  it('a new release (a new version) uses a new cache, and activate drops the old ones', async () => {
    const files = ['./', 'index.html'];
    const a = runWorker(serviceWorkerSource('0.4.44-abc', files), 'https://x.test/SMBC/');
    const b = runWorker(serviceWorkerSource('0.4.45-def', files), 'https://x.test/SMBC/');
    await a.wait;
    await b.wait;
    expect(a.cacheNames).toHaveLength(1);
    expect(b.cacheNames).toHaveLength(1);
    expect(a.cacheNames[0]).not.toBe(b.cacheNames[0]);
    expect(a.files).toEqual(['https://x.test/SMBC/', 'https://x.test/SMBC/index.html']);
    // activate: every smbc- cache but this release's own is deleted; others' caches stay.
    const deleted: string[] = [];
    const self = {
      registration: { scope: 'https://x.test/SMBC/' },
      location: new URL('https://x.test/SMBC/sw.js'),
    };
    const listeners = new Map<string, (e: unknown) => void>();
    const caches = {
      keys: async () => [b.cacheNames[0], a.cacheNames[0], 'someone-else'],
      delete: async (k: string) => void deleted.push(k),
    };
    new Function('self', 'caches', 'Request', serviceWorkerSource('0.4.45-def', files))(
      { ...self, addEventListener: (t: string, fn: (e: unknown) => void) => listeners.set(t, fn) },
      caches,
      class {},
    );
    let done: Promise<unknown> = Promise.resolve();
    listeners.get('activate')?.({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(deleted).toEqual([a.cacheNames[0]]);
  });
});
