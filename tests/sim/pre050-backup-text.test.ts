import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBackup } from '@engine/save/backup';
import {
  ONLINE_BACKUP_KEY,
  ONLINE_NOTICE_KEY,
  type DeleteResult,
  type OnlineApi,
} from '@engine/online/online-backup';
import { defaultSettings, saveSettings } from '@engine/save/settings';
import { adoptDataEpoch, onStaleStorage } from '@engine/save/storage';
import { hexToRgb, NES, PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES } from '@content/sprites';
import { FONT_COLOURS } from '@content/sprites/font';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { SaveDataOptions, freshChunkUrl, onlineLoader, type SaveDataEnv } from '@game/scenes/save-data';
import { RYU } from '@game/characters/ryu';
import { BLANK_CAPTION, levelTouchLabels } from '@game/touch-labels';
import { makeGame, type H } from './heroes-harness';
import { FakeStorage, installStorage } from './save-data-helpers';
import { flatLevel, Rig as HeroRig } from './classic-plumber-harness';

/*
 * Pre-0.5.0 PR 2 (owner item 270 = A), written first (rule 33a):
 * - 265: a failed load of the online code is tried again under a fresh URL (Chromium keeps a
 *   rejected import() by its URL); where no fresh URL can be made, the first failure says to
 *   reload the page.
 * - After a partial delete, CODE KEPT: TRY AGAIN is drawn, not only said.
 * - Importing a code that was never backed up online says so, not "code is now" / CODE NOW.
 * - Save data's texts name Music Lab songs (what a backup holds, Reset game's hint and question).
 * - High contrast: the code's colour stands apart from the white text and still reads on black.
 * - Classic Ryu on a wall without the ninpo to throw: a blank ATTACK caption.
 */

const VERSION = '2.4.16';
let ls: FakeStorage;
beforeEach(() => {
  ls = installStorage(new FakeStorage());
  adoptDataEpoch();
  onStaleStorage(null);
});

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const titleOf = (h: H) => (h.top() as MenuScene).title;
const status = (h: H) => (h.top() as unknown as { status: string }).status;
const linesOf = (h: H) => (h.top() as unknown as { lines: string[] }).lines;
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};
const stored = () => JSON.parse(ls.getItem(ONLINE_BACKUP_KEY) ?? 'null');

interface Rig {
  h: H;
  api: OnlineApi & { deletes: { code: string; after?: number | undefined }[] };
  env: SaveDataEnv;
  picks: ((f: File) => void)[];
}

function rig(opts: { deleted?: DeleteResult } = {}): Rig {
  const api = {
    deletes: [] as Rig['api']['deletes'],
    newCode: () => 'ABCDEF123456',
    backUp: async () => ({ ok: true as const, accepted: 5, total: 5, at: 1234 }),
    restore: async () => ({ ok: false as const, reason: 'not-found' as const }),
    deleteOnline: async (code: string, after?: number) => {
      api.deletes.push({ code, after });
      return opts.deleted ?? { ok: true as const, deleted: 5, total: 5, at: 4321 };
    },
  };
  const picks: ((f: File) => void)[] = [];
  const env: SaveDataEnv = {
    gameVersion: VERSION,
    now: () => new Date(2026, 9, 27),
    deliver: () => Promise.resolve('downloaded'),
    pickFile: (cb) => void picks.push(cb),
    packs: { list: () => Promise.resolve([]), clear: () => Promise.resolve() },
    restart: vi.fn(),
    online: { isOnline: () => true, load: async () => api },
  };
  const settings = defaultSettings();
  const h = makeGame({ deps: { settings, applySettings: () => saveSettings(settings), saveDataEnv: env } });
  h.game.scenes.push(new SaveDataOptions(h.game, () => h.game.scenes.pop()));
  return { h, api, env, picks };
}

function press(r: Rig, label: string): void {
  r.h.idle(8);
  const at = labels(r.h.top()).indexOf(label);
  expect(at, `${label} in ${labels(r.h.top()).join(', ')}`).toBeGreaterThanOrEqual(0);
  const index = () => (r.h.top() as unknown as { index: number }).index;
  for (let i = 0; i < 40 && index() !== at; i++) r.h.tap(index() < at ? 'down' : 'up');
  r.h.game.gestures.key();
  r.h.tap('jump');
}

/** Every text drawn, with its x and y. */
function drawn(scene: { render(r: Renderer): void }) {
  const texts: { str: string; sheet: string; x: number; y: number }[] = [];
  const rr: Renderer = Object.assign(new NullRenderer(), {
    text(f: SpriteSheet, str: string, x: number, y: number): void {
      texts.push({ str, sheet: f.id, x, y });
    },
  });
  scene.render(rr);
  return texts;
}

const CODE = 'ZZZZZZ999999';
const uploadedCode = () =>
  ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: true, lastAt: 900, uploaded: true }));
const seenNote = () => ls.setItem(ONLINE_NOTICE_KEY, 'true');

function backupFrom(fill: (s: FakeStorage) => void): string {
  const other = installStorage(new FakeStorage());
  adoptDataEpoch();
  fill(other);
  const t = buildBackup({ gameVersion: VERSION, now: new Date(2026, 9, 1) }).text;
  installStorage(ls);
  adoptDataEpoch();
  return t;
}

async function importFile(r: Rig, text: string): Promise<void> {
  press(r, 'Back up on device');
  press(r, 'Import backup');
  r.picks.at(-1)!(new File([text], 'b.json', { type: 'application/json' }));
  await flush();
  expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
  press(r, 'Yes');
  await flush();
}

// ---------------------------------------------------------------------------------------------

describe('265: a failed load is tried again under a fresh URL', () => {
  const BASE = 'https://smbc.example/assets/index-AAAA.js';
  const CHROMIUM = (url: string) => new TypeError(`Failed to fetch dynamically imported module: ${url}`);

  it("freshChunkUrl: the failed chunk's URL plus ?retry=n (Chromium's and Firefox's messages)", () => {
    const url = 'https://smbc.example/assets/nostr-backup-DcTM_ceu.js';
    expect(freshChunkUrl(CHROMIUM(url), 1, BASE)).toBe(`${url}?retry=1`);
    expect(freshChunkUrl(new TypeError(`error loading dynamically imported module: ${url}`), 2, BASE)).toBe(
      `${url}?retry=2`,
    );
    // A failed retry names the fresh URL: its query is replaced, not added to.
    expect(freshChunkUrl(CHROMIUM(`${url}?retry=1`), 2, BASE)).toBe(`${url}?retry=2`);
    // The dev server's module.
    expect(
      freshChunkUrl(
        CHROMIUM('http://localhost:5302/src/engine/online/nostr-backup.ts'),
        1,
        'http://localhost:5302/src/game/scenes/save-data.ts',
        '/src/engine/online/nostr-backup.ts',
      ),
    ).toBe('http://localhost:5302/src/engine/online/nostr-backup.ts?retry=1');
  });

  it('freshChunkUrl: null without a URL, for another module, or for another site', () => {
    expect(freshChunkUrl(new TypeError('Importing a module script failed.'), 1, BASE)).toBeNull();
    expect(freshChunkUrl('nope', 1, BASE)).toBeNull();
    expect(freshChunkUrl(null, 1, BASE)).toBeNull();
    expect(freshChunkUrl(CHROMIUM('https://smbc.example/assets/index-AAAA.js'), 1, BASE)).toBeNull();
    expect(freshChunkUrl(CHROMIUM('https://evil.example/nostr-backup-X.js'), 1, BASE)).toBeNull();
    expect(freshChunkUrl(CHROMIUM('data:text/javascript,nostr-backup.js'), 1, BASE)).toBeNull();
    // 281: the same path on another site (only the origin check stops it).
    expect(
      freshChunkUrl(
        CHROMIUM('https://evil.example/SMBC/assets/nostr-backup-x.js'),
        1,
        'https://user.github.io/SMBC/assets/index-AAAA.js',
      ),
    ).toBeNull();
  });

  it('280: encoded traversal or backslashes in the path are refused', () => {
    const base = 'https://host.example/SMBC/assets/index-AAAA.js';
    for (const bad of [
      'https://host.example/SMBC/assets/%2e%2e%2f%2e%2e%2fother/nostr-backup.js',
      'https://host.example/SMBC/assets/%2e%2e%2f%2e%2e%2fother/nostr-backup-x.js',
      'https://host.example/SMBC/assets/nostr-backup%2F..%2F..%2Fevil.js',
      'https://host.example/SMBC/assets/nostr-backup-x%2F..%2F..%2Fevil.js',
      'https://host.example/SMBC/assets/nostr-backup-x.js%00',
      'https://host.example/SMBC/assets/%6eostr-backup-x.js',
      'https://host.example/SMBC/assets/nostr-backup-%78.js',
      'https://host.example/SMBC/assets/..%5c..%5cevil/nostr-backup-x.js',
      'https://host.example/SMBC/assets/..\\..\\evil\\nostr-backup-x.js',
      'https://host.example/SMBC/assets\\nostr-backup-x.js',
      '/SMBC/assets/%2e%2e%2fnostr-backup-x.js',
    ])
      expect(freshChunkUrl(CHROMIUM(bad), 1, base), bad).toBeNull();
  });

  it("280: only a built chunk's name (nostr-backup-<hash>.js), in the built chunks' own folder", () => {
    const base = 'https://host.example/SMBC/assets/index-AAAA.js';
    const ok = 'https://host.example/SMBC/assets/nostr-backup-Ban9kVUr.js';
    expect(freshChunkUrl(CHROMIUM(ok), 1, base)).toBe(`${ok}?retry=1`);
    expect(freshChunkUrl(CHROMIUM('https://host.example/SMBC/assets/nostr-backup-a_b-C9.js'), 1, base)).toBe(
      'https://host.example/SMBC/assets/nostr-backup-a_b-C9.js?retry=1',
    );
    for (const bad of [
      'https://host.example/SMBC/assets/nostr-backup.js',
      'https://host.example/SMBC/assets/nostr-backup-.js',
      'https://host.example/SMBC/assets/nostr-backup-x.ts',
      'https://host.example/SMBC/assets/nostr-backup-x.mjs',
      'https://host.example/SMBC/assets/xnostr-backup-x.js',
      'https://host.example/SMBC/assets/nostr-backup-x.y.js',
      'https://host.example/SMBC/assets/sub/nostr-backup-x.js',
      'https://host.example/SMBC/nostr-backup-x.js',
      'https://host.example/SMBC/assets2/nostr-backup-x.js',
      // The dev server's module, outside the dev server.
      'https://host.example/src/engine/online/nostr-backup.ts',
    ])
      expect(freshChunkUrl(CHROMIUM(bad), 1, base), bad).toBeNull();
  });

  it('280: on the dev server, exactly its module path (and still not encoded or elsewhere)', () => {
    const base = 'http://localhost:5302/src/game/scenes/save-data.ts';
    const dev = '/src/engine/online/nostr-backup.ts';
    const ok = 'http://localhost:5302/src/engine/online/nostr-backup.ts';
    expect(freshChunkUrl(CHROMIUM(`${ok}?t=1`), 2, base, dev)).toBe(`${ok}?retry=2`);
    // Not without the dev path given (a build).
    expect(freshChunkUrl(CHROMIUM(ok), 1, base)).toBeNull();
    for (const bad of [
      'http://localhost:5302/src/engine/online/%6eostr-backup.ts',
      'http://localhost:5302/src/engine/online/nostr-backup.ts%2F..%2Fx.ts',
      'http://localhost:5302/src/engine/online/nostr-backup-x.ts',
      'http://localhost:5302/src/engine/nostr-backup.ts',
      'http://localhost:5302/x/src/engine/online/nostr-backup.ts',
      'http://evil.example/src/engine/online/nostr-backup.ts',
    ])
      expect(freshChunkUrl(CHROMIUM(bad), 1, base, dev), bad).toBeNull();
  });

  it('review: only a nostr-backup chunk file itself (not a source map, not a file in a nostr-backup folder)', () => {
    expect(freshChunkUrl(CHROMIUM('https://smbc.example/assets/nostr-backup-x.js.map'), 1, BASE)).toBeNull();
    expect(freshChunkUrl(CHROMIUM('https://smbc.example/assets/nostr-backup/evil.js'), 1, BASE)).toBeNull();
  });

  it("review: the failed URL's own query is dropped, not kept beside retry", () => {
    expect(freshChunkUrl(CHROMIUM('https://smbc.example/assets/nostr-backup-x.js?a=b'), 1, BASE)).toBe(
      'https://smbc.example/assets/nostr-backup-x.js?retry=1',
    );
    expect(freshChunkUrl(CHROMIUM('https://smbc.example/assets/nostr-backup-x.js#h'), 3, BASE)).toBe(
      'https://smbc.example/assets/nostr-backup-x.js?retry=3',
    );
  });

  it('review: a quoted or bracketed URL in the message is read without its punctuation', () => {
    const url = 'https://smbc.example/assets/nostr-backup-x.js';
    const want = `${url}?retry=1`;
    for (const msg of [`'${url}'`, `"${url}"`, `(${url})`, `module (${url}) failed`])
      expect(
        freshChunkUrl(new TypeError(`Failed to fetch dynamically imported module: ${msg}`), 1, BASE),
        msg,
      ).toBe(want);
  });

  it("review: only under the app's own base directory (another repo on the same github.io origin, .., %2e%2e)", () => {
    const base = 'https://user.github.io/SMBC/assets/index-AAAA.js';
    const ok = 'https://user.github.io/SMBC/assets/nostr-backup-x.js';
    expect(freshChunkUrl(CHROMIUM(ok), 1, base)).toBe(`${ok}?retry=1`);
    for (const bad of [
      'https://user.github.io/other/assets/nostr-backup-x.js',
      'https://user.github.io/SMBC/../other/nostr-backup-x.js',
      'https://user.github.io/SMBC/assets/../../other/nostr-backup-x.js',
      'https://user.github.io/SMBC/%2e%2e/other/nostr-backup-x.js',
      'https://user.github.io/SMBC/assets/%2E%2E/%2e%2e/evil/nostr-backup-x.js',
      'https://user.github.io/SMBCX/nostr-backup-x.js',
      'https://user.github.io/nostr-backup-x.js',
    ])
      expect(freshChunkUrl(CHROMIUM(bad), 1, base), bad).toBeNull();
    // Only the base module's own folder (the built chunks'), not the app's root.
    expect(freshChunkUrl(CHROMIUM('https://user.github.io/SMBC/nostr-backup-x.js'), 1, base)).toBeNull();
  });

  it('onlineLoader: the first load by its own name, each retry by a fresh URL; a good one kept', async () => {
    const url = 'https://smbc.example/assets/nostr-backup-X.js';
    const api = {} as OnlineApi;
    const asked: (string | null)[] = [];
    let fails = 2;
    const load = onlineLoader(
      (u) => {
        asked.push(u);
        return fails-- > 0 ? Promise.reject(CHROMIUM(u ?? url)) : Promise.resolve(api);
      },
      (e, n) => freshChunkUrl(e, n, BASE),
    );
    await expect(load()).rejects.toThrow(/dynamically imported/);
    await expect(load()).rejects.toThrow(/dynamically imported/);
    await expect(load()).resolves.toBe(api);
    await expect(load()).resolves.toBe(api);
    expect(asked).toEqual([null, `${url}?retry=1`, `${url}?retry=2`]);
  });

  it('a failure with no fresh URL to try says to reload the page at once, the first time', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    const api = r.api;
    let fails = 1;
    r.env.online!.load = onlineLoader(
      () =>
        fails-- > 0
          ? Promise.reject(new TypeError('Importing a module script failed.'))
          : Promise.resolve(api),
      (e, n) => freshChunkUrl(e, n, BASE),
    );
    press(r, 'Back up online');
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('COULD NOT REACH THE SERVERS');
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/reload the page/i);
    expect(said).not.toMatch(/twice/i);
    // Review: said once, not "try again ... then try again".
    expect(said.match(/try again/gi) ?? []).toHaveLength(0);
    expect(said.match(/reload/gi)).toHaveLength(1);
    // Review: drawn too.
    expect(drawn(r.h.top() as never).some((t) => t.str === 'RELOAD THE PAGE')).toBe(true);
  });

  it('review: the second failure in a row says just to reload, drawn and said', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    r.env.online!.load = onlineLoader(() => Promise.reject(new Error('Failed to fetch module')));
    press(r, 'Back up online');
    press(r, 'Back up online');
    await flush();
    expect(drawn(r.h.top() as never).some((t) => t.str === 'RELOAD THE PAGE')).toBe(false);
    press(r, 'Back up online');
    await flush();
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/reload the page/i);
    expect(said).not.toMatch(/twice|try again/i);
    expect(drawn(r.h.top() as never).some((t) => t.str === 'RELOAD THE PAGE')).toBe(true);
  });

  it('a failure that has a fresh URL to try does not ask for a reload the first time', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    const api = r.api;
    let fails = 1;
    r.env.online!.load = onlineLoader(
      (u) =>
        fails-- > 0
          ? Promise.reject(CHROMIUM(u ?? 'https://smbc.example/assets/nostr-backup-X.js'))
          : Promise.resolve(api),
      (e, n) => freshChunkUrl(e, n, BASE),
    );
    press(r, 'Back up online');
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('COULD NOT REACH THE SERVERS');
    expect(r.h.said.at(-1)).not.toMatch(/reload/i);
    expect(drawn(r.h.top() as never).some((t) => t.str === 'RELOAD THE PAGE')).toBe(false);
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('BACKED UP (5 OF 5 SERVERS)');
  });

  it('the browser loader: a fresh specifier through new URL(..., import.meta.url) and @vite-ignore, behind the offline switch', () => {
    const src = readFileSync(resolve(__dirname, '../../src/game/scenes/save-data.ts'), 'utf8');
    expect(src).toMatch(/import\(\s*\/\*\s*@vite-ignore\s*\*\//);
    expect(src).toMatch(/freshChunkUrl\(\s*e,\s*n,\s*import\.meta\.url,/);
    // 280: the dev server's module path only on the dev server.
    expect(src).toMatch(
      /import\.meta\.env\.DEV\s*\?\s*`\$\{import\.meta\.env\.BASE_URL\}src\/engine\/online\/nostr-backup\.ts`/,
    );
    expect(src).toMatch(/new URL\(named, base\)/);
    // The fresh import sits after the offline build's early return, so that build drops it.
    const fn = src.slice(src.indexOf('function browserOnlineEnv'));
    expect(fn.indexOf("import.meta.env.MODE === 'offline'")).toBeGreaterThan(-1);
    expect(fn.indexOf("import.meta.env.MODE === 'offline'")).toBeLessThan(fn.indexOf('@vite-ignore'));
  });
});

describe('a partial delete draws CODE KEPT: TRY AGAIN', () => {
  it('drawn under the outcome on the online page, and said', async () => {
    seenNote();
    uploadedCode();
    const r = rig({ deleted: { ok: true, deleted: 2, total: 5, at: 1500 } });
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(status(r.h)).toBe('DELETED ON 2 OF 5 SERVERS');
    const texts = drawn(r.h.top() as never);
    const outcome = texts.find((t) => t.str === 'DELETED ON 2 OF 5 SERVERS');
    const kept = texts.find((t) => t.str === 'CODE KEPT: TRY AGAIN');
    expect(outcome).toBeDefined();
    expect(kept).toBeDefined();
    // One under the other, apart, both above the BACK line (y 216).
    expect(kept!.y).toBeGreaterThanOrEqual(outcome!.y + 8);
    expect(kept!.y + 8).toBeLessThanOrEqual(216);
    expect(r.h.said.at(-1)).toMatch(/code is kept/i);
    expect(r.h.said.at(-1)).toMatch(/try .*again/i);
    expect(stored()).toMatchObject({ code: CODE, uploaded: true });
  });

  it('the next outcome on the page drops the line', async () => {
    seenNote();
    uploadedCode();
    const r = rig({ deleted: { ok: true, deleted: 2, total: 5, at: 1500 } });
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    r.api.deleteOnline = async () => ({ ok: true, deleted: 5, total: 5, at: 1600 });
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    expect(status(r.h)).toBe('DELETED ON 5 OF 5 SERVERS');
    expect(drawn(r.h.top() as never).some((t) => t.str === 'CODE KEPT: TRY AGAIN')).toBe(false);
  });

  it('a full delete draws no such line', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    expect(drawn(r.h.top() as never).some((t) => t.str === 'CODE KEPT: TRY AGAIN')).toBe(false);
  });
});

describe('importing a code that was never backed up online', () => {
  const OTHER = 'QQQQQQ111111';

  it('is not called "online backup code is now" / CODE NOW: a code not yet backed up online', async () => {
    const t = backupFrom((s) =>
      s.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: OTHER, shown: false, uploaded: false })),
    );
    const r = rig();
    await importFile(r, t);
    expect(titleOf(r.h)).toBe('BACKUP IMPORTED');
    const said = r.h.said.at(-1) as string;
    expect(said).not.toMatch(/code is now/i);
    expect(said).toMatch(/not (yet )?backed up online/i);
    expect(said).toMatch(/Q Q Q Q, Q Q 1 1, 1 1 1 1/);
    const lines = linesOf(r.h);
    expect(lines.some((l) => l.startsWith('CODE NOW'))).toBe(false);
    // Review: the code, then what it is.
    expect(lines.slice(0, 2)).toEqual(['CODE QQQQ-QQ11-1111', 'NOT YET BACKED UP ONLINE']);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(28);
    expect(stored()).toMatchObject({ code: OTHER });
    expect(stored().uploaded).not.toBe(true);
  });

  it('a code that was backed up online keeps CODE NOW', async () => {
    const t = backupFrom((s) =>
      s.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: OTHER, shown: true, lastAt: 5, uploaded: true })),
    );
    const r = rig();
    await importFile(r, t);
    expect(linesOf(r.h)).toContain('CODE NOW QQQQ-QQ11-1111');
    expect(r.h.said.at(-1)).toMatch(/online backup code is now Q Q Q Q/i);
  });

  it('review: the import question does not call a never-uploaded brought code an online backup code', async () => {
    uploadedCode();
    const t = backupFrom((s) =>
      s.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: OTHER, shown: false, uploaded: false })),
    );
    const r = rig();
    press(r, 'Back up on device');
    press(r, 'Import backup');
    r.picks.at(-1)!(new File([t], 'b.json', { type: 'application/json' }));
    await flush();
    expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
    const said = r.h.said.at(-1) as string;
    expect(said).not.toMatch(/another online backup code/i);
    expect(said).toMatch(/another backup code, not yet backed up online/i);
    // This device's own (online) code is still shown, to keep.
    expect(said).toMatch(/Z Z Z Z, Z Z 9 9, 9 9 9 9/);
    expect(linesOf(r.h)).toContain('ZZZZ-ZZ99-9999');
  });

  it('review: an uploaded brought code is still "another online backup code" on the question', async () => {
    uploadedCode();
    const t = backupFrom((s) =>
      s.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: OTHER, shown: true, lastAt: 5, uploaded: true })),
    );
    const r = rig();
    press(r, 'Back up on device');
    press(r, 'Import backup');
    r.picks.at(-1)!(new File([t], 'b.json', { type: 'application/json' }));
    await flush();
    expect(r.h.said.at(-1)).toMatch(/another online backup code/i);
  });

  it("this device's own code brought back: nothing said about a code", async () => {
    uploadedCode();
    const t = backupFrom((s) =>
      s.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: true, uploaded: false })),
    );
    const r = rig();
    await importFile(r, t);
    expect(r.h.said.at(-1)).not.toMatch(/code/i);
    expect(linesOf(r.h)).toEqual(['THE GAME STARTS AGAIN.']);
  });
});

describe('Save data names Music Lab songs', () => {
  it('what a backup holds, said on Save data and Back up on device', async () => {
    const r = rig();
    await flush();
    expect(r.h.said.join(' ')).toMatch(/custom level and Music Lab song/);
    press(r, 'Back up on device');
    expect(r.h.said.at(-1)).toMatch(/Music Lab song/);
  });

  it("Reset game's hint and question", async () => {
    const r = rig();
    await flush();
    const reset = (r.h.top() as unknown as { items: MenuItem[] }).items.find((i) => i.label === 'Reset game');
    expect(reset!.hint).toMatch(/Music Lab song/);
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('RESET GAME?');
    expect(r.h.said.at(-1)).toMatch(/Music Lab song/);
    const lines = linesOf(r.h);
    expect(lines.join(' ')).toMatch(/MUSIC LAB/);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(28);
  });
});

describe('high contrast: the backup code colour', () => {
  const lum = (hex: string) => {
    const [r, g, b] = hexToRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
    return (x + 0.05) / (y + 0.05);
  };
  const hc = (name: string) => resolvePalette(PALETTES, name, 'highContrast')[1] as string;
  const code = hc(FONT_COLOURS.code);
  const white = hc('font');

  it('is not the old pale #ffffa2', () => {
    expect(code.toLowerCase()).not.toBe('#ffffa2');
  });

  it('meets WCAG AAA (7:1) on the black card', () => {
    expect(ratio(code, '#000000')).toBeGreaterThanOrEqual(7);
  });

  it('stands clearly apart from the white text: a strong hue, not a pale tint', () => {
    const [r, g, b] = hexToRgb(code);
    // Saturated: its weakest channel well below its strongest (white's are equal).
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThanOrEqual(0xc0);
    expect(ratio(white, code)).toBeGreaterThanOrEqual(1.4);
  });

  it('review: the code has its own font colour; in every other mode it looks as the gold does', () => {
    for (const mode of PALETTE_MODES) {
      const gold = resolvePalette(PALETTES, FONT_COLOURS.gold, mode);
      const mine = resolvePalette(PALETTES, FONT_COLOURS.code, mode);
      if (mode === 'highContrast') {
        expect(mine[1]).toBe('#ffb800');
        expect(mine.filter((_, i) => i !== 1)).toEqual(gold.filter((_, i) => i !== 1));
      } else expect(mine).toEqual(gold);
    }
  });

  it("review: the gold font (CLASSIC box headers on the orange box) keeps main's high-contrast colour", () => {
    const gold = hc(FONT_COLOURS.gold);
    expect(gold).toBe('#ffffa2');
    // The header on the CLASSIC box's orange (menu-box.ts): 4.47:1 (4.467), as before.
    expect(ratio(gold, NES.orangeBrown)).toBeCloseTo(4.467, 3);
  });

  it('review: every backup code line is drawn in the code colour', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    press(r, 'Show most recent code');
    const line = drawn(r.h.top() as never).find((t) => t.str === 'ZZZZ-ZZ99-9999');
    expect(line!.sheet).toBe(`font@${FONT_COLOURS.code}`);
  });
});

describe('Classic Ryu on a wall without the ninpo to throw: a blank ATTACK caption', () => {
  const col = (c: number, ch: string) => '.'.repeat(c) + ch;
  const TALL_WALL = Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map((y) => [y, col(12, '#')]));
  function onWall(): HeroRig {
    const r = new HeroRig(RYU, flatLevel(TALL_WALL), 'classic');
    r.settle();
    r.until(() => r.p.body.hitWall === 1, ['right'], 200);
    r.until(
      () => r.p.wall !== null,
      (i) => (i === 0 ? ['right', 'jump'] : ['right']),
      200,
    );
    expect(r.p.wall).not.toBeNull();
    return r;
  }
  const attack = (r: HeroRig) => levelTouchLabels(r.p, r.world).attack;

  it('0 ninpo: blank; ninpo back: SHURIKEN again', () => {
    const r = onWall();
    r.p.scratch.ninpo = 0;
    expect(attack(r)).toBe(BLANK_CAPTION);
    r.p.scratch.ninpo = 3;
    expect(attack(r)).toBe('SHURIKEN');
  });

  it('less than the throw costs (2 of 3): blank too', () => {
    const r = onWall();
    r.p.scratch.ninpo = 2;
    expect(attack(r)).toBe(BLANK_CAPTION);
  });

  it('0 ninpo under a Star or Infinite ammo (throws cost nothing): SHURIKEN', () => {
    const r = onWall();
    r.p.scratch.ninpo = 0;
    r.p.star = 100;
    expect(attack(r)).toBe('SHURIKEN');
    r.p.star = 0;
    r.p.cheatAmmo = true;
    expect(attack(r)).toBe('SHURIKEN');
  });

  it('with 0 ninpo ATTACK on the wall really throws nothing', () => {
    const thrown = (ninpo: number) => {
      const r = onWall();
      r.p.scratch.ninpo = ninpo;
      let most = 0;
      for (let i = 0; i < 30; i++) {
        r.step(i % 2 ? ['right'] : ['right', 'attack']);
        most = Math.max(most, r.world.countProjectiles(r.p, 'classic-shuriken'));
      }
      return most;
    };
    expect(thrown(0)).toBe(0);
    // The check itself: with the ninpo he throws.
    expect(thrown(3)).toBeGreaterThan(0);
  });

  it('on the ground, SLASH whatever the ninpo', () => {
    const r = new HeroRig(RYU, flatLevel(), 'classic');
    r.settle();
    r.p.scratch.ninpo = 0;
    expect(attack(r)).toBe('SLASH');
  });
});
