import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTES, SPRITES } from '@content/sprites';
import { packStore, type StoredPack } from '@engine/assets/idb';
import { folderPickerSupported, packsNeedComputer } from '@engine/assets/folder-picker';
import { loadEnabledPacks } from '@engine/assets/pack-loader';
import { AssetRegistry } from '@engine/assets/registry';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// 0.4.73 (owner, item 84, choice A). (1) On a phone the ASSET PACKS page's Import pack did
// nothing (iOS has no folder picker), so where a folder cannot be picked on a touch device the
// page says ASSET PACKS NEED A COMPUTER, with only Back. (2) OK on a pack's row deletes THAT pack,
// after DELETE <NAME>? NO / YES (NO first); the old Delete pack row always took the first pack.

useStorage();

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** A file input's prototype that does (or does not) know webkitdirectory. */
const doc = (dir: boolean) => (dir ? { webkitdirectory: false } : {});
const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints }) as Navigator;

/** Pretends the browser: its folder picker and its pointer. */
function browser(opts: { dir: boolean; ua: string; touchPoints?: number; coarse?: boolean }): void {
  vi.stubGlobal('HTMLInputElement', { prototype: doc(opts.dir) });
  vi.stubGlobal('navigator', nav(opts.ua, opts.touchPoints ?? 0));
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(pointer: coarse)' ? !!opts.coarse : q === '(hover: none)' ? !!opts.coarse : false,
  }));
}

let packs: string[] = [];
const removed: string[] = [];
beforeEach(() => {
  packs = [];
  removed.length = 0;
  vi.spyOn(packStore, 'list').mockImplementation(async () =>
    packs.map((name) => ({ name, manifest: { schema: 1, name }, files: {}, addedAt: 0 })),
  );
  vi.spyOn(packStore, 'remove').mockImplementation(async (name: string) => {
    removed.push(name);
    packs = packs.filter((n) => n !== name);
  });
});
afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flush = () => new Promise((r) => setTimeout(r, 0));
const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const index = (h: H) => (h.top() as unknown as { index: number }).index;
const status = (h: H) => (h.top() as unknown as { status: string }).status;

function game(touch: boolean, settings: Settings = defaultSettings()): H {
  return makeGame({
    deps: { settings, applySettings: () => {}, controlScheme: () => (touch ? 'touch' : 'keyboard') },
  });
}

function pick(h: H, label: string): void {
  h.idle(8);
  const at = labels(h.top()).indexOf(label);
  expect(at, `${label} in ${labels(h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  while (index(h) !== at) h.tap(index(h) < at ? 'down' : 'up');
  h.tap('jump');
}

async function packsPage(h: H): Promise<void> {
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
  pick(h, 'Asset packs');
  await flush();
}

describe('item 84 (1): the folder picker check', () => {
  it('needs a computer only on a touch device without a folder picker', () => {
    expect(packsNeedComputer({ touchShown: true, coarsePointer: true, folderPicker: false })).toBe(true);
    expect(packsNeedComputer({ touchShown: true, coarsePointer: false, folderPicker: false })).toBe(true);
    expect(packsNeedComputer({ touchShown: false, coarsePointer: true, folderPicker: false })).toBe(true);
    expect(packsNeedComputer({ touchShown: true, coarsePointer: true, folderPicker: true })).toBe(false);
    // A desktop always keeps Import, picker or not (its browser will say what it can do).
    expect(packsNeedComputer({ touchShown: false, coarsePointer: false, folderPicker: false })).toBe(false);
  });

  it('iPhone and iPad have no folder picker, even though their inputs know webkitdirectory', () => {
    expect(folderPickerSupported(doc(true), nav(IPHONE_UA, 5))).toBe(false);
    expect(folderPickerSupported(doc(true), nav(IPAD_UA, 5))).toBe(false);
    expect(folderPickerSupported(doc(true), nav(DESKTOP_UA))).toBe(true);
    expect(folderPickerSupported(doc(true), nav(ANDROID_UA, 5))).toBe(true);
    // A Mac (no touch points) is a desktop.
    expect(folderPickerSupported(doc(true), nav(IPAD_UA, 0))).toBe(true);
    expect(folderPickerSupported(doc(false), nav(DESKTOP_UA))).toBe(false);
    expect(folderPickerSupported(undefined, undefined)).toBe(false);
  });
});

describe('item 84 (1): ASSET PACKS on a phone that cannot pick a folder', () => {
  it('an iPhone: one announced line and Back, no Import pack or Export template', async () => {
    browser({ dir: true, ua: IPHONE_UA, touchPoints: 5, coarse: true });
    const h = game(true);
    packs = ['retro'];
    await packsPage(h);
    expect(labels(h.top())).toEqual(['Back']);
    expect(status(h)).toBe('ASSET PACKS NEED A COMPUTER');
    expect(h.said.some((s) => s.startsWith('ASSET PACKS NEED A COMPUTER'))).toBe(true);
    // Back returns to Options.
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(labels(h.top())).toContain('Asset packs');
  });

  it('a coarse pointer alone (pad hidden) without a folder picker gets the same page', async () => {
    browser({ dir: false, ua: ANDROID_UA, touchPoints: 5, coarse: true });
    const h = game(false);
    await packsPage(h);
    expect(labels(h.top())).toEqual(['Back']);
  });

  it('a touch device with a folder picker still offers Import pack', async () => {
    browser({ dir: true, ua: ANDROID_UA, touchPoints: 5, coarse: true });
    const h = game(true);
    await packsPage(h);
    expect(labels(h.top())).toContain('Import pack');
    expect(labels(h.top())).toContain('Export template');
  });

  it('stored packs keep loading on such a phone: settings.packs untouched, the pack applied', async () => {
    browser({ dir: true, ua: IPHONE_UA, touchPoints: 5, coarse: true });
    const s = defaultSettings();
    s.packs = ['retro'];
    const h = game(true, s);
    packs = ['retro'];
    await packsPage(h);
    h.idle(8);
    h.tap('jump');
    expect(s.packs).toEqual(['retro']);
    // The boot loader (main.ts) builds and applies them as before, on any device.
    const image = { width: 8, height: 8 } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', async () => image);
    const stored: StoredPack = {
      name: 'retro',
      manifest: { schema: 1, name: 'retro', sprites: { mario: { image: 'mario.png' } } },
      files: { 'mario.png': new Blob(['x']) },
      addedAt: 0,
    };
    vi.spyOn(packStore, 'get').mockImplementation(async (n) => (n === 'retro' ? stored : undefined));
    const reg = new AssetRegistry(PALETTES);
    reg.defineAll(SPRITES);
    const loaded = await loadEnabledPacks(s.packs, reg);
    expect(loaded.map((p) => p.name)).toEqual(['retro']);
    expect(reg.sheet('mario').image).toBe(image);
  });
});

describe('item 84 (1): a desktop keeps Import pack', () => {
  it('Import pack, Export template, each pack, Back; Import runs inside the input event', async () => {
    browser({ dir: true, ua: DESKTOP_UA });
    const h = game(false);
    packs = ['alpha', 'beta'];
    await packsPage(h);
    expect(labels(h.top())).toEqual(['Import pack', 'Export template', 'alpha', 'beta', 'Back']);
    expect(status(h)).toBe('');
    const items = (h.top() as unknown as { items: MenuItem[] }).items;
    expect(items[0]?.gesture).toBe(true);
  });

  it('a desktop browser without a folder picker still lists Import pack', async () => {
    browser({ dir: false, ua: DESKTOP_UA });
    const h = game(false);
    await packsPage(h);
    expect(labels(h.top())).toContain('Import pack');
  });
});

describe('item 84 (2): OK on a pack deletes that pack, after a confirm', () => {
  async function confirmFor(name: string): Promise<H> {
    browser({ dir: true, ua: DESKTOP_UA });
    const s = defaultSettings();
    s.packs = ['alpha', 'beta', 'gamma'];
    const h = game(false, s);
    packs = ['alpha', 'beta', 'gamma'];
    await packsPage(h);
    pick(h, name);
    return h;
  }

  it('asks DELETE <NAME>? with NO focused first, and says so', async () => {
    const h = await confirmFor('beta');
    expect((h.top() as unknown as { title: string }).title).toBe('DELETE BETA?');
    expect(labels(h.top())).toEqual(['No', 'Yes']);
    expect(index(h)).toBe(0);
    expect(h.said.at(-1)).toBe('Delete beta? No');
    expect(removed).toEqual([]);
  });

  it('YES deletes the chosen pack, not the first one, and turns it off', async () => {
    const h = await confirmFor('gamma');
    pick(h, 'Yes');
    await flush();
    expect(removed).toEqual(['gamma']);
    const s = h.game.deps.settings as Settings;
    expect(s.packs).toEqual(['alpha', 'beta']);
    expect(labels(h.top())).toEqual(['Import pack', 'Export template', 'alpha', 'beta', 'Back']);
    expect(status(h)).toBe('Deleted gamma');
    expect(h.said.at(-1)).toMatch(/^Deleted gamma/);
  });

  it('NO (or BACK) keeps the pack', async () => {
    const h = await confirmFor('beta');
    pick(h, 'No');
    await flush();
    expect(removed).toEqual([]);
    expect(labels(h.top())).toContain('beta');
    expect(labels(h.top())[index(h)]).toBe('beta');
    const h2 = await confirmFor('alpha');
    h2.idle(8);
    h2.tap('attack');
    await flush();
    expect(removed).toEqual([]);
    expect(labels(h2.top())).toContain('alpha');
  });

  it('left / right still toggles a pack, and the old Delete pack row is gone', async () => {
    browser({ dir: true, ua: DESKTOP_UA });
    const s = defaultSettings();
    s.packs = [];
    const h = game(false, s);
    packs = ['alpha'];
    await packsPage(h);
    expect(labels(h.top())).not.toContain('Delete pack');
    h.idle(8);
    while (labels(h.top())[index(h)] !== 'alpha') h.tap('down');
    h.idle(8);
    h.tap('right');
    expect(s.packs).toEqual(['alpha']);
    expect(h.said.at(-1)).toMatch(/^alpha: On\. /);
    expect(removed).toEqual([]);
  });
});

// Break-it review (0.4.73): after a delete the cursor stays on a pack (or Export template when
// none are left) and the line says so; a store that cannot delete says so too.
describe('item 84 (2): the cursor and the line after YES', () => {
  async function packsWith(names: string[]): Promise<H> {
    browser({ dir: true, ua: DESKTOP_UA });
    const s = defaultSettings();
    s.packs = [...names];
    const h = game(false, s);
    packs = [...names];
    await packsPage(h);
    return h;
  }
  const focused = (h: H) => labels(h.top())[index(h)];

  it('deleting a middle pack: the cursor moves to the next pack, and the line names it', async () => {
    const h = await packsWith(['alpha', 'beta', 'gamma']);
    pick(h, 'beta');
    pick(h, 'Yes');
    await flush();
    expect(labels(h.top())).toEqual(['Import pack', 'Export template', 'alpha', 'gamma', 'Back']);
    expect(focused(h)).toBe('gamma');
    expect(h.said.at(-1)).toBe('Deleted beta. gamma: On. Left/right toggles. OK deletes it');
  });

  it('deleting the last listed pack: the cursor moves to the pack above it', async () => {
    const h = await packsWith(['alpha', 'beta']);
    pick(h, 'beta');
    pick(h, 'Yes');
    await flush();
    expect(focused(h)).toBe('alpha');
    expect(h.said.at(-1)).toBe('Deleted beta. alpha: On. Left/right toggles. OK deletes it');
  });

  it('deleting the only pack: the cursor goes to Export template, never silently to Back', async () => {
    const h = await packsWith(['alpha']);
    pick(h, 'alpha');
    pick(h, 'Yes');
    await flush();
    expect(labels(h.top())).toEqual(['Import pack', 'Export template', 'Back']);
    expect(focused(h)).toBe('Export template');
    expect(h.said.at(-1)).toBe('Deleted alpha. Export template. Downloads PNGs to repaint');
  });

  it('a store that cannot delete: "Could not delete", said, and the pack is kept and still on', async () => {
    const h = await packsWith(['alpha', 'beta']);
    vi.spyOn(packStore, 'remove').mockImplementation(async () => {
      throw new Error('QuotaExceededError');
    });
    pick(h, 'beta');
    pick(h, 'Yes');
    await flush();
    expect(status(h)).toBe('Could not delete');
    expect(h.said.at(-1)).toBe('Could not delete');
    expect((h.game.deps.settings as Settings).packs).toEqual(['alpha', 'beta']);
    expect(labels(h.top())).toContain('beta');
    expect(focused(h)).toBe('beta');
  });
});
