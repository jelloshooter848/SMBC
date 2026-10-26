import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { packStore, type StoredPack } from '@engine/assets/idb';
import {
  buildPack,
  buildTemplateZip,
  importPackZip,
  PACK_ZIP_MAX_BYTES,
  PackImportError,
} from '@engine/assets/pack-loader';
import { packZip } from '@engine/assets/pack-zip';
import { AssetRegistry } from '@engine/assets/registry';
import { makeZip, unzip, ZIP_MAX_ENTRIES, ZIP_MAX_TOTAL, ZipError } from '@engine/save/zip';
import { bytesOf } from './save-data-helpers';
import { buildZip } from './zip-fixtures';

/*
 * Item 141 (owner): Import pack (.zip) on every device. A small zip reader with no dependencies:
 * stored entries, and deflated ones through DecompressionStream('deflate-raw'). It checks every
 * CRC, refuses ../ and absolute paths, and caps the entry count and the unpacked size (zip
 * bombs). Any error changes nothing: the pack store is written only once the whole pack reads.
 */

const enc = (s: string) => new TextEncoder().encode(s);
const MANIFEST = JSON.stringify({ schema: 1, name: 'retro', sprites: { mario: { image: 'img/mario.png' } } });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** Every entry read (each is inflated and checked only when read: item 141 review, memory). */
async function unzipAll(bytes: Uint8Array, limits?: Parameters<typeof unzip>[1]) {
  const entries = await unzip(bytes, limits);
  return Promise.all(entries.map(async (e) => ({ path: e.path, data: await e.read() })));
}

/** The step importPackZip failed at (size, read, pack or store), or 'ok'. */
async function step(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof PackImportError ? e.step : `other: ${(e as Error).message}`;
  }
  return 'ok';
}

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof ZipError ? e.code : `other: ${(e as Error).message}`;
  }
  return 'ok';
}

let puts: StoredPack[] = [];
beforeEach(() => {
  puts = [];
  vi.spyOn(packStore, 'put').mockImplementation(async (p) => void puts.push(p));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('unzip: what it reads', () => {
  it('our own stored zips, byte for byte', async () => {
    const bin = new Uint8Array(5000).map((_, i) => (i * 7) & 0xff);
    const out = await unzipAll(
      makeZip([
        { path: 'a/b.bin', data: bin },
        { path: 'c.txt', data: 'hé' },
      ]),
    );
    expect(out.map((e) => e.path)).toEqual(['a/b.bin', 'c.txt']);
    expect([...out[0]!.data]).toEqual([...bin]);
    expect(new TextDecoder().decode(out[1]!.data)).toBe('hé');
  });

  it('deflated entries (what most zip tools write)', async () => {
    const text = 'repeat '.repeat(2000);
    const out = await unzipAll(
      buildZip([
        { name: 'x.txt', data: text, method: 8 },
        { name: 'y.bin', data: PNG },
      ]),
    );
    expect(new TextDecoder().decode(out[0]!.data)).toBe(text);
    expect([...out[1]!.data]).toEqual([...PNG]);
  });

  it('skips folder entries and macOS extras (__MACOSX/, .DS_Store)', async () => {
    const out = await unzipAll(
      buildZip([
        { name: 'pack/' },
        { name: 'pack/manifest.json', data: MANIFEST },
        { name: '__MACOSX/pack/._manifest.json', data: 'junk' },
        { name: 'pack/.DS_Store', data: 'junk' },
      ]),
    );
    expect(out.map((e) => e.path)).toEqual(['pack/manifest.json']);
  });

  it('deflate where the browser cannot inflate: a clear reason, not a crash', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    expect(await code(unzipAll(buildZip([{ name: 'x.txt', data: 'abc', method: 8 }])))).toBe('no-deflate');
    // Stored zips (our own exports) still read without it.
    expect(await code(unzipAll(makeZip([{ path: 'x.txt', data: 'abc' }])))).toBe('ok');
  });
});

describe('unzip: review of 39868fd2', () => {
  it('reads nothing until asked: an entry is inflated and checked only by its read()', async () => {
    const z = buildZip([
      { name: 'good.txt', data: 'fine' },
      { name: 'bad.txt', data: 'abc', crc: 1 },
    ]);
    const entries = await unzip(z);
    expect(entries.map((e) => [e.path, e.size])).toEqual([
      ['good.txt', 4],
      ['bad.txt', 3],
    ]);
    expect(new TextDecoder().decode(await entries[0]!.read())).toBe('fine');
    expect(await code(entries[1]!.read())).toBe('crc');
  });

  it('the end record must close the file: trailing junk is not a zip; a real comment is fine', async () => {
    const z = makeZip([{ path: 'a.txt', data: 'x' }]);
    const junk = new Uint8Array(z.length + 5);
    junk.set(z);
    expect(await code(unzipAll(junk))).toBe('not-zip');
    expect(
      await code(unzipAll(buildZip([{ name: 'a.txt', data: 'x' }], { comment: 'made by a tool' }))),
    ).toBe('ok');
  });

  it('names without the UTF-8 flag are CP437 (Windows "Send to compressed folder")', async () => {
    const out = await unzipAll(
      buildZip([{ name: '', nameBytes: new Uint8Array([0x81, 0x2e, 0x74]), flags: 0, data: 'x' }]),
    );
    expect(out[0]!.path).toBe('ü.t');
  });

  it('backslash folders (old PowerShell zips) read as folders', async () => {
    const out = await unzipAll(buildZip([{ name: 'img\\mario.png', data: 'x' }]));
    expect(out[0]!.path).toBe('img/mario.png');
  });
});

describe('unzip: what it refuses', () => {
  it('not a zip at all, or cut short', async () => {
    expect(await code(unzipAll(enc('hello')))).toBe('not-zip');
    expect(await code(unzipAll(new Uint8Array(0)))).toBe('not-zip');
    const z = makeZip([{ path: 'a.txt', data: 'x'.repeat(100) }]);
    expect(await code(unzipAll(z.slice(0, z.length - 30)))).toBe('not-zip');
    expect(await code(unzipAll(z.slice(40)))).toBe('damaged');
  });

  it('a wrong CRC, stored or deflated', async () => {
    expect(await code(unzipAll(buildZip([{ name: 'a.txt', data: 'abc', crc: 1 }])))).toBe('crc');
    expect(await code(unzipAll(buildZip([{ name: 'a.txt', data: 'abc', method: 8, crc: 1 }])))).toBe('crc');
  });

  it('path traversal and absolute paths', async () => {
    for (const name of [
      '../evil.txt',
      'a/../../evil.txt',
      '/etc/passwd',
      'C:/x.txt',
      'a\\..\\b.txt',
      'a//b.txt',
    ])
      expect(await code(unzipAll(buildZip([{ name, data: 'x' }]))), name).toBe('unsafe-path');
  });

  it('a zip bomb: too many entries', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.txt`, data: 'x' }));
    expect(await code(unzipAll(buildZip(many), { maxEntries: 10 }))).toBe('too-many');
    expect(await code(unzipAll(buildZip(many.slice(0, 10)), { maxEntries: 10 }))).toBe('ok');
  });

  it('a zip bomb: more unpacked bytes than the cap, refused before inflating', async () => {
    const zeros = new Uint8Array(2 * 1024 * 1024);
    const z = buildZip([{ name: 'zeros.bin', data: zeros, method: 8 }]);
    expect(z.length).toBeLessThan(10_000);
    expect(await code(unzipAll(z, { maxTotal: 1024 * 1024 }))).toBe('too-big');
  });

  it('a zip bomb that lies about its size: inflating stops at the size it gave', async () => {
    const zeros = new Uint8Array(4 * 1024 * 1024);
    const z = buildZip([{ name: 'zeros.bin', data: zeros, method: 8, usize: 100 }]);
    expect(await code(unzipAll(z))).toBe('damaged');
  });

  it('the lying size is caught by the inflate guard itself (not by a write past the buffer)', async () => {
    const z = buildZip([{ name: 'zeros.bin', data: new Uint8Array(4 * 1024 * 1024), method: 8, usize: 100 }]);
    try {
      await unzipAll(z);
      throw new Error('read');
    } catch (e) {
      expect(e).toBeInstanceOf(ZipError);
      expect((e as Error).message).toBe('an entry inflates past its size');
    }
  });

  it('entries whose data overlap (a known zip bomb shape) are refused', async () => {
    const z = buildZip([
      { name: 'a.txt', data: 'same' },
      { name: 'b.txt', data: 'same', localAt: 0 },
    ]);
    expect(await code(unzipAll(z))).toBe('damaged');
  });

  it('encrypted entries, zip64 and unknown methods', async () => {
    expect(await code(unzipAll(buildZip([{ name: 'a.txt', data: 'x', flags: 0x0801 }])))).toBe('unsupported');
    // Deflate64, LZMA, …: its own reason (review nit).
    expect(await code(unzipAll(buildZip([{ name: 'a.txt', data: 'x', method: 12 }])))).toBe('method');
    expect(await code(unzipAll(buildZip([{ name: 'a.txt', data: 'x' }], { zip64: true })))).toBe(
      'unsupported',
    );
  });

  it('a stored entry whose sizes disagree, or the same path twice', async () => {
    expect(await code(unzipAll(buildZip([{ name: 'a.txt', data: 'abc', usize: 5 }])))).toBe('damaged');
    expect(
      await code(
        unzipAll(
          buildZip([
            { name: 'a.txt', data: 'x' },
            { name: 'a.txt', data: 'y' },
          ]),
        ),
      ),
    ).toBe('damaged');
  });

  it('the caps are generous for a real pack and finite', () => {
    expect(ZIP_MAX_ENTRIES).toBeGreaterThanOrEqual(2000);
    expect(ZIP_MAX_TOTAL).toBeGreaterThanOrEqual(64 * 1024 * 1024);
    expect(ZIP_MAX_TOTAL).toBeLessThanOrEqual(256 * 1024 * 1024);
    expect(PACK_ZIP_MAX_BYTES).toBeLessThanOrEqual(ZIP_MAX_TOTAL);
  });
});

function registry(): AssetRegistry {
  const r = new AssetRegistry(PALETTES);
  r.defineAll(SPRITES);
  return r;
}

describe('importPackZip', () => {
  it('a pack exported by SAVE DATA comes back identical', async () => {
    const pack: StoredPack = {
      name: 'retro',
      manifest: {
        schema: 1,
        name: 'retro',
        sprites: { mario: { image: 'img/mario.png' } },
        music: { overworld: 'music/ow.ogg' },
      },
      files: { 'img/mario.png': new Blob([PNG]), 'music/ow.ogg': new Blob([new Uint8Array(300).fill(9)]) },
      addedAt: 1,
    };
    const z = await packZip(pack);
    expect(await importPackZip(new Blob([z.bytes as BlobPart]))).toBe('retro');
    expect(puts).toHaveLength(1);
    const got = puts[0]!;
    expect(got.name).toBe('retro');
    expect(got.manifest).toEqual(pack.manifest);
    expect(Object.keys(got.files).sort()).toEqual(Object.keys(pack.files).sort());
    for (const [p, b] of Object.entries(pack.files))
      expect(await bytesOf(got.files[p] as Blob), p).toEqual(await bytesOf(b));
  });

  it('manifest.json under one top folder imports even with stray files at the top (a README)', async () => {
    const z = buildZip([
      { name: 'README.txt', data: 'hello' },
      { name: 'retro/manifest.json', data: MANIFEST },
      { name: 'retro/img/mario.png', data: PNG },
    ]);
    expect(await importPackZip(new Blob([z as BlobPart]))).toBe('retro');
    expect(Object.keys(puts[0]!.files)).toEqual(['img/mario.png']);
  });

  it('only the manifest and the files it names are read: a damaged extra file is never inflated', async () => {
    const z = buildZip([
      { name: 'manifest.json', data: MANIFEST },
      { name: 'img/mario.png', data: PNG },
      { name: 'notes/extra.bin', data: 'zzz', crc: 1 },
    ]);
    expect(await importPackZip(new Blob([z as BlobPart]))).toBe('retro');
  });

  it('a zip of the pack folder (one top-level folder, deflated) imports the same', async () => {
    const z = buildZip([
      { name: 'retro/' },
      { name: 'retro/manifest.json', data: MANIFEST, method: 8 },
      { name: 'retro/img/mario.png', data: PNG, method: 8 },
    ]);
    expect(await importPackZip(new Blob([z as BlobPart]))).toBe('retro');
    expect(await bytesOf(puts[0]!.files['img/mario.png'] as Blob)).toEqual([...PNG]);
  });

  it('the pack template .zip imports and loads with no warnings', async () => {
    const reg = registry();
    const fakePng = (id: string) => Promise.resolve(new Uint8Array([0x89, 0x50, ...enc(id)]));
    const z = await buildTemplateZip(reg, {
      songs: songs.map((s) => s.id),
      sfx: sfx.map((s) => s.id),
      encodePng: fakePng,
    });
    expect(await importPackZip(new Blob([z as BlobPart]))).toBe('my-pack');
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 1, height: 1 })),
    );
    const loaded = await buildPack(puts[0]!, reg);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.sheets.size).toBe(reg.ids().length);
  });

  it('every bad file changes nothing: the store is never written', async () => {
    const bad: Uint8Array[] = [
      enc('not a zip'),
      buildZip([{ name: 'manifest.json', data: MANIFEST, crc: 5 }]),
      buildZip([
        { name: 'manifest.json', data: MANIFEST },
        { name: '../img/mario.png', data: PNG },
      ]),
      buildZip([{ name: 'manifest.json', data: '{"schema":2}' }]),
      buildZip([{ name: 'manifest.json', data: MANIFEST }]),
      buildZip([{ name: 'readme.txt', data: 'no manifest' }]),
      buildZip([
        { name: 'a/manifest.json', data: MANIFEST },
        { name: 'b/img/mario.png', data: PNG },
      ]),
      buildZip([{ name: 'zeros.bin', data: new Uint8Array(1000), method: 8, usize: 10 }]),
    ];
    for (const b of bad) expect(await step(importPackZip(new Blob([b as BlobPart])))).toBe('pack');
    expect(puts).toEqual([]);
  });

  it('a file bigger than the cap is refused before it is read', async () => {
    const big = { size: PACK_ZIP_MAX_BYTES + 1, arrayBuffer: vi.fn() } as unknown as Blob;
    // #219 nit: importPackZip names the step that failed (the page's own lines come from it).
    expect(await step(importPackZip(big))).toBe('size');
    expect((big as unknown as { arrayBuffer: ReturnType<typeof vi.fn> }).arrayBuffer).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });
});
