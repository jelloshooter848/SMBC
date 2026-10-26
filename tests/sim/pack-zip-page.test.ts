import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packStore, type StoredPack } from '@engine/assets/idb';
import { packZip } from '@engine/assets/pack-zip';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { buildZip } from './zip-fixtures';

/*
 * Item 141 (owner): ASSET PACKS > Import pack (.zip) on every device. The file chooser opens
 * inside the press's own event (iOS, as SAVE DATA's Import backup); a good zip is stored and
 * turned on, and a bad one changes nothing and says why.
 */

useStorage();

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function browser(phone: boolean): void {
  vi.stubGlobal('HTMLInputElement', { prototype: { webkitdirectory: false } });
  vi.stubGlobal('navigator', { userAgent: phone ? IPHONE_UA : DESKTOP_UA, maxTouchPoints: phone ? 5 : 0 });
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: phone && (q === '(pointer: coarse)' || q === '(hover: none)'),
  }));
}

let stored: StoredPack[] = [];
beforeEach(() => {
  stored = [];
  vi.spyOn(packStore, 'list').mockImplementation(async () => stored);
  vi.spyOn(packStore, 'put').mockImplementation(
    async (p) => void (stored = [...stored.filter((x) => x.name !== p.name), p]),
  );
});
afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};
const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const index = (h: H) => (h.top() as unknown as { index: number }).index;
const status = (h: H) => (h.top() as unknown as { status: string }).status;

interface Rig {
  h: H;
  picks: { accept: string; cb: (f: File) => void; inEvent: boolean }[];
  settings: Settings;
}

async function rig(phone: boolean): Promise<Rig> {
  browser(phone);
  const picks: Rig['picks'] = [];
  let inside = false;
  const settings = defaultSettings();
  const h = makeGame({
    deps: {
      settings,
      applySettings: () => {},
      controlScheme: () => (phone ? 'touch' : 'keyboard'),
      pickFile: (accept, cb) => void picks.push({ accept, cb, inEvent: inside }),
    },
  });
  const gate = h.game.gestures;
  const key = gate.key.bind(gate);
  gate.key = () => {
    inside = true;
    try {
      return key();
    } finally {
      inside = false;
    }
  };
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
  press({ h, picks, settings }, 'Asset packs');
  await flush();
  return { h, picks, settings };
}

function press(r: Rig, label: string): void {
  r.h.idle(8);
  const at = labels(r.h.top()).indexOf(label);
  expect(at, `${label} in ${labels(r.h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < 40 && index(r.h) !== at; i++) r.h.tap(index(r.h) < at ? 'down' : 'up');
  r.h.game.gestures.key();
  r.h.tap('jump');
}

const pack = (name: string): StoredPack => ({
  name,
  manifest: { schema: 1, name, sprites: { mario: { image: 'mario.png' } } },
  files: { 'mario.png': new Blob([new Uint8Array([1, 2, 3])]) },
  addedAt: 1,
});
const zipFile = async (p: StoredPack) => new File([(await packZip(p)).bytes as BlobPart], `${p.name}.zip`);

for (const phone of [true, false]) {
  describe(`Import pack (.zip) on ${phone ? 'a phone' : 'a desktop'}`, () => {
    it("is offered, and opens the chooser for .zip files inside the press's own event", async () => {
      const r = await rig(phone);
      expect(labels(r.h.top())).toContain('Import pack (.zip)');
      press(r, 'Import pack (.zip)');
      expect(r.picks).toHaveLength(1);
      expect(r.picks[0]!.inEvent).toBe(true);
      expect(r.picks[0]!.accept).toMatch(/\.zip/);
    });

    it('a good zip is stored, turned on, listed, and said', async () => {
      const r = await rig(phone);
      press(r, 'Import pack (.zip)');
      r.picks[0]!.cb(await zipFile(pack('retro')));
      await flush();
      expect(stored.map((p) => p.name)).toEqual(['retro']);
      expect(r.settings.packs).toEqual(['retro']);
      expect(labels(r.h.top())).toContain('retro');
      expect(status(r.h).toUpperCase()).toBe('IMPORTED RETRO');
      expect(r.h.said.at(-1)).toMatch(/^Imported retro/);
    });

    it('a bad zip changes nothing and says why', async () => {
      const r = await rig(phone);
      const before = labels(r.h.top());
      for (const [bytes, said] of [
        [new TextEncoder().encode('not a zip'), /not a zip file/i],
        [buildZip([{ name: '../manifest.json', data: '{}' }]), /unsafe/i],
        [buildZip([{ name: 'manifest.json', data: '{}', crc: 1 }]), /damaged/i],
        [buildZip([{ name: 'readme.txt', data: 'hi' }]), /not an asset pack/i],
      ] as const) {
        press(r, 'Import pack (.zip)');
        r.picks.at(-1)!.cb(new File([bytes as BlobPart], 'x.zip'));
        await flush();
        expect(r.h.said.at(-1)).toMatch(said);
        expect(r.h.said.at(-1)).toMatch(/nothing changed/i);
      }
      expect(stored).toEqual([]);
      expect(r.settings.packs).toEqual([]);
      expect(labels(r.h.top())).toEqual(before);
    });

    it('a deflated zip where the browser cannot inflate says so', async () => {
      const r = await rig(phone);
      vi.stubGlobal('DecompressionStream', undefined);
      press(r, 'Import pack (.zip)');
      r.picks[0]!.cb(
        new File([buildZip([{ name: 'manifest.json', data: '{}', method: 8 }]) as BlobPart], 'x.zip'),
      );
      await flush();
      expect(r.h.said.at(-1)).toMatch(/cannot read compressed zip/i);
      expect(stored).toEqual([]);
    });
  });
}

describe('which rows each device gets (item 141)', () => {
  it('a phone: Import pack (.zip) and its packs; no folder import, no Export template', async () => {
    stored = [pack('neon')];
    const r = await rig(true);
    expect(labels(r.h.top())).toEqual(['Import pack (.zip)', 'neon', 'Back']);
  });

  it('a desktop: the folder import too, and Export template', async () => {
    stored = [pack('neon')];
    const r = await rig(false);
    expect(labels(r.h.top())).toEqual([
      'Import pack (folder)',
      'Import pack (.zip)',
      'Export template',
      'neon',
      'Back',
    ]);
  });
});
