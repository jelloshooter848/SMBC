import { describe, expect, it } from 'vitest';
import { crc32, makeZip } from '@engine/save/zip';
import { packZip, packZips } from '@engine/assets/pack-zip';
import { readPackFiles } from '@engine/assets/pack-loader';
import type { StoredPack } from '@engine/assets/idb';
import { asPickedFolder, bytesOf, readZip, refCrc32, text } from './save-data-helpers';

/*
 * The store-only zip writer (no runtime dependencies): CRC-32 against known values and an
 * independent implementation, a layout any unzip tool reads, and each asset pack exported as
 * `<name>.zip` that, unzipped, goes back in through Import pack as the same pack.
 */

const enc = (s: string) => new TextEncoder().encode(s);

describe('CRC-32', () => {
  it('matches the standard check values', () => {
    expect(crc32(enc('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(enc('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  it('agrees with an independent implementation on random data', () => {
    let seed = 7;
    for (const n of [1, 3, 255, 256, 4097]) {
      const b = new Uint8Array(n).map(() => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff);
      expect(crc32(b)).toBe(refCrc32(b));
    }
  });
});

describe('makeZip', () => {
  it('writes entries an unzip tool reads back exactly (stored, UTF-8 names, CRCs right)', () => {
    const bin = new Uint8Array(1000).map((_, i) => (i * 37) & 0xff);
    const zip = makeZip([
      { path: 'manifest.json', data: '{"schema":1}' },
      { path: 'sprites/mario.png', data: bin },
      { path: 'snö☃.txt', data: 'ünï' },
      { path: 'empty.bin', data: new Uint8Array(0) },
    ]);
    const got = readZip(zip);
    expect(got.map((e) => e.path)).toEqual(['manifest.json', 'sprites/mario.png', 'snö☃.txt', 'empty.bin']);
    expect(text(got[0]!.data)).toBe('{"schema":1}');
    expect([...got[1]!.data]).toEqual([...bin]);
    expect(text(got[2]!.data)).toBe('ünï');
    expect(got[3]!.data.length).toBe(0);
    expect(got.every((e) => e.method === 0 && e.utf8)).toBe(true);
  });

  it('an empty zip is still a valid zip', () => {
    expect(readZip(makeZip([]))).toEqual([]);
  });

  it('the same input gives the same bytes (a fixed time stamp)', () => {
    const when = new Date(2026, 9, 22, 12, 0, 0);
    const a = makeZip([{ path: 'a.txt', data: 'x' }], when);
    const b = makeZip([{ path: 'a.txt', data: 'x' }], when);
    expect([...a]).toEqual([...b]);
  });

  it('refuses unsafe paths (absolute, parent folders, backslashes, empty, twice)', () => {
    for (const path of ['/etc/x', '../x', 'a/../../x', 'a\\b', '', 'C:/x'])
      expect(() => makeZip([{ path, data: 'x' }]), path).toThrow();
    expect(() =>
      makeZip([
        { path: 'a.txt', data: 'x' },
        { path: 'a.txt', data: 'y' },
      ]),
    ).toThrow();
  });
});

function pack(name: string, files: Record<string, string | Uint8Array>, manifest?: unknown): StoredPack {
  const blobs: Record<string, Blob> = {};
  for (const [p, d] of Object.entries(files)) blobs[p] = new Blob([d]);
  return {
    name,
    manifest: manifest ?? {
      schema: 1,
      name,
      sprites: Object.fromEntries(
        Object.keys(files)
          .filter((p) => p.endsWith('.png'))
          .map((p) => [p.replace(/^.*\//, '').replace('.png', ''), { image: p }]),
      ),
      music: { overworld: 'music/overworld.ogg' },
    },
    files: blobs,
    addedAt: 1,
  };
}

describe('asset packs as .zip files', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]);
  const ogg = new Uint8Array(3000).map((_, i) => i & 0xff);
  const retro = pack('retro', { 'mario.png': png, 'tiles/tiles.png': png, 'music/overworld.ogg': ogg });

  it('a pack becomes <name>.zip holding manifest.json and its files at the paths it reads', async () => {
    const z = await packZip(retro);
    expect(z.fileName).toBe('retro.zip');
    const got = readZip(z.bytes);
    expect(got.map((e) => e.path).sort()).toEqual(
      ['manifest.json', 'mario.png', 'music/overworld.ogg', 'tiles/tiles.png'].sort(),
    );
    expect(JSON.parse(text(got.find((e) => e.path === 'manifest.json')!.data))).toEqual(retro.manifest);
  });

  it('the .zip, unzipped, re-imports through Import pack and gives the same pack', async () => {
    const z = await packZip(retro);
    const picked = asPickedFolder('retro', readZip(z.bytes));
    const back = await readPackFiles(picked);
    expect(back.manifest).toEqual(retro.manifest);
    expect(Object.keys(back.files).sort()).toEqual(Object.keys(retro.files).sort());
    for (const [p, blob] of Object.entries(retro.files))
      expect(await bytesOf(back.files[p] as Blob), p).toEqual(await bytesOf(blob));
  });

  it('packZips exports every pack it can, and names the ones it could not read (a partial IndexedDB failure)', async () => {
    const broken: StoredPack = {
      ...pack('broken', { 'a.png': png }),
      files: {
        'a.png': {
          arrayBuffer: () => Promise.reject(new Error('NotReadableError')),
          size: 9,
        } as unknown as Blob,
      },
    };
    const odd: StoredPack = { ...pack('odd', { 'x.png': png }), files: { '../x.png': new Blob([png]) } };
    const out = await packZips([retro, broken, odd, pack('beta', { 'b.png': png })]);
    expect(out.zips.map((z) => z.fileName)).toEqual(['retro.zip', 'beta.zip']);
    expect(out.failed).toEqual(['broken', 'odd']);
  });

  it('no packs: nothing to export', async () => {
    expect(await packZips([])).toEqual({ zips: [], failed: [] });
  });
});
