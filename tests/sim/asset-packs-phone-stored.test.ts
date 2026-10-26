import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packStore } from '@engine/assets/idb';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// Item 128 review: on a phone or tablet (a coarse pointer) the ASSET PACKS page still lists the
// packs already stored (On/Off, OK deletes after the confirm): an Android player who imported
// one in v0.4.73 can turn it off or delete it. Only Import pack and Export template are gone,
// and the ASSET PACKS NEED A COMPUTER line is drawn above the rows. Helpers copied from
// asset-packs-page.test.ts.

useStorage();

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

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

describe('item 128 review: stored packs on a phone', () => {
  async function phone(ua = ANDROID_UA): Promise<H> {
    browser({ dir: true, ua, touchPoints: 5, coarse: true });
    const s = defaultSettings();
    s.packs = ['retro'];
    const h = game(true, s);
    packs = ['retro', 'neon'];
    await packsPage(h);
    await flush();
    return h;
  }

  it('lists the stored packs and Back, no Import pack or Export template; the line is above the rows', async () => {
    const h = await phone();
    expect(labels(h.top())).toEqual(['neon', 'retro', 'Back']);
    expect(h.said.some((s) => s.startsWith('ASSET PACKS NEED A COMPUTER'))).toBe(true);
    const texts = draw(h.top() as never).texts;
    const line = texts.find((t) => t.str === 'ASSET PACKS NEED A COMPUTER');
    const row = texts.find((t) => t.str === 'NEON');
    expect(line).toBeDefined();
    expect(row).toBeDefined();
    expect(line!.y).toBeLessThan(row!.y);
  });

  it('left / right toggles a stored pack', async () => {
    const h = await phone();
    const s = h.game.deps.settings as Settings;
    h.idle(8);
    for (let i = 0; i < 5 && labels(h.top())[index(h)] !== 'retro'; i++) h.tap('down');
    expect(labels(h.top())[index(h)]).toBe('retro');
    h.tap('right');
    expect(s.packs).toEqual([]);
    h.tap('right');
    expect(s.packs).toEqual(['retro']);
  });

  it('OK deletes it after DELETE <NAME>? YES; the cursor stays on a pack row', async () => {
    const h = await phone();
    pick(h, 'retro');
    expect((h.top() as unknown as { title: string }).title).toBe('DELETE RETRO?');
    pick(h, 'Yes');
    await flush();
    await flush();
    expect(removed).toEqual(['retro']);
    expect((h.game.deps.settings as Settings).packs).toEqual([]);
    expect(labels(h.top())).toEqual(['neon', 'Back']);
    expect(labels(h.top())[index(h)]).toBe('neon');
    expect(h.said.at(-1)).toMatch(/^Deleted retro/);
  });

  it('an iPhone too: its stored packs stay listed', async () => {
    const h = await phone(IPHONE_UA);
    expect(labels(h.top())).toEqual(['neon', 'retro', 'Back']);
  });
});
