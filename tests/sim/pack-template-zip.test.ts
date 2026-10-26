import { afterEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { AssetRegistry } from '@engine/assets/registry';
import { buildPack, buildTemplateZip, exportTemplate, readPackFiles } from '@engine/assets/pack-loader';
import { validateManifest } from '@engine/assets/manifest';
import { asPickedFolder, readZip, text } from './save-data-helpers';

/*
 * Owner item 92: Options > Asset packs > Export template is ONE download,
 * smbc-remix-pack-template.zip (the save-data zip writer), instead of two files per sheet and a
 * manifest. It holds manifest.json, each registered sheet's PNG and frames.json, and a README.txt
 * listing every music and sfx id a pack can replace (read live from the registries), every
 * palette with its colours, and a minimal example manifest. Unzipped, it imports through Import
 * pack and loads with no warnings.
 */

function registry(): AssetRegistry {
  const r = new AssetRegistry(PALETTES);
  r.defineAll(SPRITES);
  return r;
}

/** A stand-in PNG encoder (node has no canvas): a PNG signature and the sheet id. */
const fakePng = (id: string) =>
  Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new TextEncoder().encode(id)]));
const lists = { songs: songs.map((s) => s.id), sfx: sfx.map((s) => s.id), encodePng: fakePng };

afterEach(() => {
  delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
});

describe('the pack template .zip', () => {
  it("holds manifest.json, README.txt and every registered sheet's PNG and frames.json", async () => {
    const reg = registry();
    const entries = readZip(await buildTemplateZip(reg, lists));
    const paths = new Set(entries.map((e) => e.path));
    expect(paths.has('manifest.json')).toBe(true);
    expect(paths.has('README.txt')).toBe(true);
    const ids = reg.ids();
    expect(ids.length).toBeGreaterThan(50);
    for (const id of ids) {
      expect(paths.has(`${id}.png`), id).toBe(true);
      expect(paths.has(`${id}.frames.json`), id).toBe(true);
    }
    expect(paths.size).toBe(2 + ids.length * 2);
    const manifest = JSON.parse(text(entries.find((e) => e.path === 'manifest.json')!.data));
    expect(validateManifest(manifest)).toBe(true);
    expect(Object.keys(manifest.sprites).sort()).toEqual([...ids].sort());
    // frames.json gives each frame's rectangle as the registry lays it out.
    const sheet = reg.sheet('mario');
    const frames = JSON.parse(text(entries.find((e) => e.path === 'mario.frames.json')!.data));
    for (const [k, f] of sheet.frames) expect(frames[k]).toEqual([f.x, f.y, f.w, f.h]);
  });

  it('a sheet registered later is in the next template (ids read live)', async () => {
    const reg = registry();
    reg.define('zz-new-sheet', { palette: 'mario', frames: { a: ['1'] } } as never);
    const paths = readZip(await buildTemplateZip(reg, lists)).map((e) => e.path);
    expect(paths).toContain('zz-new-sheet.png');
  });

  it('README.txt lists every song id, every sfx id and every palette with its colours', async () => {
    const reg = registry();
    const readme = text(
      readZip(await buildTemplateZip(reg, lists)).find((e) => e.path === 'README.txt')!.data,
    );
    const words = new Set(readme.split(/[\s,:]+/));
    for (const s of songs) expect(words.has(s.id), `song ${s.id}`).toBe(true);
    for (const s of sfx) expect(words.has(s.id), `sfx ${s.id}`).toBe(true);
    for (const [name, colors] of Object.entries(PALETTES.default)) {
      const line = readme.split('\n').find((l) => l.trim().startsWith(`${name}:`));
      expect(line, `palette ${name}`).toBeDefined();
      for (const c of colors) expect(line).toContain(c);
    }
    expect(readme).toMatch(/Fire Mario/);
    expect(readme).toMatch(/star/i);
    expect(readme).toMatch(/theme/i);
    // The example manifest in it is a valid one.
    const example = /```json\n([\s\S]*?)\n```/.exec(readme)?.[1];
    expect(example).toBeDefined();
    expect(validateManifest(JSON.parse(example as string))).toBe(true);
  });

  it("a pack's palette recolours are not listed as built-in colours (the boot snapshot is)", async () => {
    const reg = registry();
    const built = [...(PALETTES.default.mario as string[])];
    reg.overridePalette('mario', ['#123456', '#123456', '#123456', '#123456', '#123456', '#123456']);
    try {
      const readme = text(
        readZip(await buildTemplateZip(reg, lists)).find((e) => e.path === 'README.txt')!.data,
      );
      const line = readme.split('\n').find((l) => l.trim().startsWith('mario:'));
      expect(line).toBe(`  mario: ${built.join(', ')}`);
    } finally {
      reg.overridePalette('mario', built);
    }
  });

  it('the lists are the ones handed in (the live registries), not a copy kept here', async () => {
    const readme = text(
      readZip(await buildTemplateZip(registry(), { ...lists, songs: ['only-song'], sfx: ['only-sfx'] })).find(
        (e) => e.path === 'README.txt',
      )!.data,
    );
    expect(readme).toContain('only-song');
    expect(readme).toContain('only-sfx');
    expect(readme).not.toContain(`  ${songs[0]!.id}\n`);
  });

  it('unzipped, it imports through Import pack and loads with no warnings', async () => {
    const reg = registry();
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi.fn(async () => ({
      width: 1,
      height: 1,
    }));
    const entries = readZip(await buildTemplateZip(reg, lists));
    const { manifest, files } = await readPackFiles(asPickedFolder('my-pack', entries));
    const pack = await buildPack({ name: manifest.name, manifest, files, addedAt: 1 }, reg);
    expect(pack.warnings).toEqual([]);
    expect(pack.sheets.size).toBe(reg.ids().length);
  });

  it('Export template makes exactly one download, smbc-remix-pack-template.zip', async () => {
    const saved: { name: string; blob: Blob }[] = [];
    await exportTemplate(registry(), lists, (name, blob) => saved.push({ name, blob }));
    expect(saved.map((s) => s.name)).toEqual(['smbc-remix-pack-template.zip']);
    expect(saved[0]!.blob.type).toBe('application/zip');
    expect(readZip(new Uint8Array(await saved[0]!.blob.arrayBuffer())).length).toBeGreaterThan(100);
  });
});
