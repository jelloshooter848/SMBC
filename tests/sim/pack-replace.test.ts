import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packStore, type StoredPack } from '@engine/assets/idb';
import { packZip } from '@engine/assets/pack-zip';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { bytesOf } from './save-data-helpers';

/*
 * Owner item 147: importing a pack whose name is already stored asks REPLACE PACK <NAME>? with
 * NO focused first (BACK is NO), for the .zip import and the folder import alike. NO leaves the
 * stored pack exactly as it was and turns nothing on or off; YES replaces it as before; a new
 * name imports with no question.
 */

useStorage();

let packs = new Map<string, StoredPack>();
let puts = 0;
beforeEach(() => {
  packs = new Map();
  puts = 0;
  vi.spyOn(packStore, 'list').mockImplementation(async () => [...packs.values()]);
  vi.spyOn(packStore, 'get').mockImplementation(async (n) => packs.get(n));
  vi.spyOn(packStore, 'put').mockImplementation(async (p) => {
    puts++;
    packs.set(p.name, p);
  });
});
afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};
const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const index = (h: H) => (h.top() as unknown as { index: number }).index;
const title = (h: H) => (h.top() as unknown as { title: string }).title;

const pack = (name: string, byte: number): StoredPack => ({
  name,
  manifest: { schema: 1, name, sprites: { mario: { image: 'mario.png' } } },
  files: { 'mario.png': new Blob([new Uint8Array([byte, byte, byte])]) },
  addedAt: 1,
});

/** The pack's folder as the folder picker hands it over. */
function folder(p: StoredPack): File[] {
  const mk = (path: string, body: BlobPart) => {
    const f = new File([body], path.split('/').pop() as string);
    Object.defineProperty(f, 'webkitRelativePath', { value: `${p.name}/${path}` });
    return f;
  };
  return [
    mk('manifest.json', JSON.stringify(p.manifest)),
    ...Object.entries(p.files).map(([path, b]) => mk(path, b)),
  ];
}

interface Rig {
  h: H;
  settings: Settings;
  zips: ((f: File) => void)[];
  folders: ((f: File[]) => void)[];
}

async function rig(): Promise<Rig> {
  vi.stubGlobal('HTMLInputElement', { prototype: { webkitdirectory: false } });
  vi.stubGlobal('navigator', { userAgent: 'X11; Linux', maxTouchPoints: 0 });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const zips: Rig['zips'] = [];
  const folders: Rig['folders'] = [];
  const settings = defaultSettings();
  const h = makeGame({
    deps: {
      settings,
      applySettings: () => {},
      controlScheme: () => 'keyboard',
      pickFile: (_a, cb) => void zips.push(cb),
      pickFolder: (cb) => void folders.push(cb),
    },
  });
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
  const r = { h, settings, zips, folders };
  press(r, 'Asset packs');
  await flush();
  return r;
}

function press(r: Rig, label: string): void {
  r.h.idle(8);
  const at = labels(r.h.top()).indexOf(label);
  expect(at, `${label} in ${labels(r.h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < 40 && index(r.h) !== at; i++) r.h.tap(index(r.h) < at ? 'down' : 'up');
  r.h.game.gestures.key();
  r.h.tap('jump');
}

const zipOf = async (p: StoredPack) => new File([(await packZip(p)).bytes as BlobPart], `${p.name}.zip`);

/** Starts an import of `p` the given way; returns once its question (or result) is up. */
async function importIt(r: Rig, how: 'zip' | 'folder', p: StoredPack): Promise<void> {
  if (how === 'zip') {
    press(r, 'Import pack (.zip)');
    r.zips.at(-1)!(await zipOf(p));
  } else {
    press(r, 'Import pack (folder)');
    r.folders.at(-1)!(folder(p));
  }
  await flush();
}

for (const how of ['zip', 'folder'] as const) {
  describe(`item 147: the ${how} import of a name already stored`, () => {
    async function withOld(): Promise<{ r: Rig; old: StoredPack }> {
      const old = pack('retro', 1);
      packs.set('retro', old);
      const r = await rig();
      r.settings.packs = [];
      return { r, old };
    }

    it('asks REPLACE PACK RETRO? with NO focused first, and says so', async () => {
      const { r } = await withOld();
      await importIt(r, how, pack('retro', 2));
      expect(title(r.h)).toBe('REPLACE PACK RETRO?');
      expect(labels(r.h.top())).toEqual(['No', 'Yes']);
      expect(index(r.h)).toBe(0);
      expect(r.h.said.at(-1)).toBe('Replace pack retro? No');
    });

    it('NO keeps the stored pack byte for byte and turns nothing on or off', async () => {
      const { r, old } = await withOld();
      const before = await bytesOf(old.files['mario.png'] as Blob);
      await importIt(r, how, pack('retro', 2));
      press(r, 'No');
      await flush();
      expect(puts).toBe(0);
      expect(packs.get('retro')).toBe(old);
      expect(await bytesOf(packs.get('retro')!.files['mario.png'] as Blob)).toEqual(before);
      expect(r.settings.packs).toEqual([]);
      expect(title(r.h)).toBe('ASSET PACKS');
      expect(r.h.said.at(-1)).toMatch(/nothing changed/i);
    });

    it('BACK is NO', async () => {
      const { r, old } = await withOld();
      await importIt(r, how, pack('retro', 2));
      r.h.idle(8);
      r.h.tap('attack');
      await flush();
      expect(puts).toBe(0);
      expect(packs.get('retro')).toBe(old);
      expect(title(r.h)).toBe('ASSET PACKS');
    });

    it('YES replaces it and turns it on, as before', async () => {
      const { r } = await withOld();
      await importIt(r, how, pack('retro', 2));
      press(r, 'Yes');
      await flush();
      expect(puts).toBe(1);
      expect(await bytesOf(packs.get('retro')!.files['mario.png'] as Blob)).toEqual([2, 2, 2]);
      expect(r.settings.packs).toEqual(['retro']);
      expect(r.h.said.at(-1)).toMatch(/^Imported retro/);
    });

    it('a new name imports with no question', async () => {
      packs.set('retro', pack('retro', 1));
      const r = await rig();
      await importIt(r, how, pack('neon', 3));
      expect(title(r.h)).toBe('ASSET PACKS');
      expect(puts).toBe(1);
      expect(r.settings.packs).toEqual(['neon']);
    });
  });
}

it('item 147: a long name is cut to fit the 28-column title', async () => {
  const long = 'a-very-long-pack-name-indeed-yes';
  packs.set(long, pack(long, 1));
  const r = await rig();
  await importIt(r, 'zip', pack(long, 2));
  expect(title(r.h).length).toBeLessThanOrEqual(28);
  expect(title(r.h).startsWith('REPLACE PACK A-VERY')).toBe(true);
  expect(r.h.said.at(-1)).toBe(`Replace pack ${long}? No`);
});
