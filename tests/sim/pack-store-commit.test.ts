import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packStore, type StoredPack } from '@engine/assets/idb';
import { importPackFiles } from '@engine/assets/pack-loader';
import { packZip } from '@engine/assets/pack-zip';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { installFakeIdb, type FakeIdb } from './fake-idb';
import { makeGame, store, useStorage, type H } from './heroes-harness';

/*
 * #219 review: the pack store's writes count only once their transaction COMMITS. A quota error
 * can arrive as an abort at commit, after the put itself succeeded; the page must then say
 * COULD NOT SAVE PACK and leave the pack off, and delete and erase must report their failure.
 */

useStorage();

let idb: FakeIdb;
beforeEach(() => {
  idb = installFakeIdb();
});
afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pack = (name: string): StoredPack => ({
  name,
  manifest: { schema: 1, name, sprites: { mario: { image: 'mario.png' } } },
  files: { 'mario.png': new Blob([new Uint8Array([1, 2, 3])]) },
  addedAt: 1,
});

describe('packStore: a write is done only when its transaction commits', () => {
  it('put: committed, it lists; aborted after the put succeeded, it rejects and nothing lands', async () => {
    await packStore.put(pack('a'));
    expect((await packStore.list()).map((p) => p.name)).toEqual(['a']);
    idb.abortAfter = (op) => op === 'put';
    await expect(packStore.put(pack('b'))).rejects.toThrow();
    idb.abortAfter = () => false;
    expect((await packStore.list()).map((p) => p.name)).toEqual(['a']);
  });

  it('remove (Delete pack) and clear (SAVE DATA erase) reject when aborted, and keep the packs', async () => {
    await packStore.put(pack('a'));
    idb.abortAfter = (op) => op === 'delete' || op === 'clear';
    await expect(packStore.remove('a')).rejects.toThrow();
    await expect(packStore.clear()).rejects.toThrow();
    idb.abortAfter = () => false;
    expect((await packStore.list()).map((p) => p.name)).toEqual(['a']);
  });

  it('the folder import rejects when its save is aborted', async () => {
    idb.abortAfter = (op) => op === 'put';
    const files = [
      new File([JSON.stringify(pack('f').manifest)], 'manifest.json'),
      new File([new Uint8Array([1])], 'mario.png'),
    ];
    await expect(importPackFiles(files)).rejects.toThrow();
    idb.abortAfter = () => false;
    expect(await packStore.list()).toEqual([]);
  });
});

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};
const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const index = (h: H) => (h.top() as unknown as { index: number }).index;
const status = (h: H) => (h.top() as unknown as { status: string }).status;

async function page(settings: Settings, picks: ((f: File) => void)[]): Promise<H> {
  vi.stubGlobal('HTMLInputElement', { prototype: { webkitdirectory: false } });
  vi.stubGlobal('navigator', { userAgent: 'X11; Linux', maxTouchPoints: 0 });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const h = makeGame({
    deps: {
      settings,
      applySettings: () => {},
      controlScheme: () => 'keyboard',
      pickFile: (_accept, cb) => void picks.push(cb),
    },
  });
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
  press(h, 'Asset packs');
  await flush();
  return h;
}

function press(h: H, label: string): void {
  h.idle(8);
  const at = labels(h.top()).indexOf(label);
  expect(at, `${label} in ${labels(h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < 40 && index(h) !== at; i++) h.tap(index(h) < at ? 'down' : 'up');
  h.game.gestures.key();
  h.tap('jump');
}

describe('the ASSET PACKS page when the save is aborted at commit', () => {
  it('Import pack (.zip): COULD NOT SAVE PACK, nothing changed, the pack not turned on', async () => {
    const s = defaultSettings();
    const picks: ((f: File) => void)[] = [];
    const h = await page(s, picks);
    idb.abortAfter = (op) => op === 'put';
    press(h, 'Import pack (.zip)');
    picks[0]!(new File([(await packZip(pack('retro'))).bytes as BlobPart], 'retro.zip'));
    await flush();
    expect(status(h)).toBe('COULD NOT SAVE PACK');
    expect(h.said.at(-1)).toMatch(/could not be saved.*Nothing changed\./);
    expect(s.packs).toEqual([]);
    expect(labels(h.top())).not.toContain('retro');
    idb.abortAfter = () => false;
    expect(await packStore.list()).toEqual([]);
  });

  it('Delete: Could not delete, and the pack stays, still on', async () => {
    await packStore.put(pack('retro'));
    const s = defaultSettings();
    s.packs = ['retro'];
    const h = await page(s, []);
    idb.abortAfter = (op) => op === 'delete';
    press(h, 'retro');
    press(h, 'Yes');
    await flush();
    expect(h.said.at(-1)).toBe('Could not delete');
    expect(s.packs).toEqual(['retro']);
    idb.abortAfter = () => false;
    expect((await packStore.list()).map((p) => p.name)).toEqual(['retro']);
  });
});
