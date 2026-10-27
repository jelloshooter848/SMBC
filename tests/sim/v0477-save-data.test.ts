import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackup, isGameKey } from '@engine/save/backup';
import {
  ONLINE_BACKUP_KEY,
  ONLINE_NOTICE_KEY,
  type BackUpResult,
  type DeleteResult,
  type OnlineApi,
  type RestoreResult,
} from '@engine/online/online-backup';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type Settings,
} from '@engine/save/settings';
import { adoptDataEpoch, onStaleStorage } from '@engine/save/storage';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { PALETTES } from '@content/sprites';
import { FONT_COLOURS } from '@content/sprites/font';
import type { ShareEnv } from '@game/save/share-code';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { SaveDataOptions, onlineLoader, type SaveDataEnv } from '@game/scenes/save-data';
import type { RestoreCodeScene } from '@game/scenes/online-backup';
import { offlineNoticeDue, standaloneNoticeDue, type HomeScreenHooks } from '@game/pwa/home-screen';
import { newSave, saveKey, writeSave } from '@game/save/save-files';
import { makeGame, type H } from './heroes-harness';
import { FakeStorage, installStorage } from './save-data-helpers';

/*
 * v0.4.77 items 181-189 (owner): Save data redesigned as BACK UP ON DEVICE, BACK UP ONLINE (web
 * build only), RESET GAME and BACK. The online page opens with a once-per-device experimental
 * note; DELETE MOST RECENT CODE empties the online copy and forgets the code here; RESET GAME
 * never deletes the online copy, and first shows a code that is online, with COPY CODE; the
 * Home Screen notes' flags outlive a reset; a code counts as online only once it was uploaded.
 * Written first (rule 33a), with stale tabs, damaged data and storage that throws.
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
  api: OnlineApi & {
    deletes: { code: string; after?: number | undefined }[];
    backUps: { code: string; text: string; after?: number | undefined }[];
    restores: string[];
  };
  env: SaveDataEnv;
  loads: number;
  online: { value: boolean };
  copied: string[];
  shared: string[];
  picks: ((f: File) => void)[];
  restart: ReturnType<typeof vi.fn>;
}

function rig(
  opts: {
    backUp?: BackUpResult;
    restore?: RestoreResult;
    deleted?: DeleteResult;
    offlineBuild?: boolean;
    code?: string;
    settings?: Settings;
    homeScreen?: HomeScreenHooks;
  } = {},
): Rig {
  const backUps: Rig['api']['backUps'] = [];
  const restores: string[] = [];
  const api = {
    backUps,
    restores,
    newCode: () => opts.code ?? 'ABCDEF123456',
    backUp: async (code: string, text: string, after?: number) => {
      backUps.push({ code, text, after });
      return opts.backUp ?? { ok: true as const, accepted: 5, total: 5, at: 1234 };
    },
    restore: async (code: string) => {
      restores.push(code);
      return opts.restore ?? { ok: false as const, reason: 'not-found' as const };
    },
    deletes: [] as Rig['api']['deletes'],
    deleteOnline: async (code: string, after?: number) => {
      api.deletes.push({ code, after });
      return opts.deleted ?? { ok: true as const, deleted: 5, total: 5, at: 4321 };
    },
  };
  const online = { value: true };
  const copied: string[] = [];
  const shared: string[] = [];
  const picks: ((f: File) => void)[] = [];
  const restart = vi.fn();
  const r = { api, loads: 0, online, copied, shared, picks, restart } as unknown as Rig;
  const env: SaveDataEnv = {
    gameVersion: VERSION,
    now: () => new Date(2026, 9, 27),
    deliver: () => Promise.resolve('downloaded'),
    pickFile: (cb) => void picks.push(cb),
    packs: { list: () => Promise.resolve([]), clear: () => Promise.resolve() },
    restart,
    online: opts.offlineBuild
      ? null
      : {
          isOnline: () => online.value,
          load: async () => {
            r.loads++;
            return api;
          },
        },
  };
  r.env = env;
  const shareEnv: ShareEnv = {
    href: 'https://example.com/',
    copy: async (t) => (copied.push(t), true),
    share: async (d) => void shared.push(d.text ?? ''),
  };
  const settings = opts.settings ?? defaultSettings();
  r.h = makeGame({
    deps: {
      settings,
      applySettings: () => saveSettings(settings),
      saveDataEnv: env,
      shareEnv,
      ...(opts.homeScreen ? { homeScreen: opts.homeScreen } : {}),
    },
  });
  r.h.game.scenes.push(new SaveDataOptions(r.h.game, () => r.h.game.scenes.pop()));
  return r;
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

function back(r: Rig): void {
  r.h.idle(8);
  r.h.tap('attack');
}

/** Into BACK UP ONLINE, past the experimental note when it is up. */
function openOnline(r: Rig): void {
  press(r, 'Back up online');
  if (titleOf(r.h) === 'EXPERIMENTAL FEATURE') press(r, 'OK');
  expect(titleOf(r.h)).toBe('BACK UP ONLINE');
}

const CODE = 'ZZZZZZ999999';
const uploadedCode = (extra: Record<string, unknown> = {}) =>
  ls.setItem(
    ONLINE_BACKUP_KEY,
    JSON.stringify({ code: CODE, shown: true, lastAt: 900, uploaded: true, ...extra }),
  );
const seenNote = () => ls.setItem(ONLINE_NOTICE_KEY, 'true');

/** A backup file's text made on another device whose storage `fill` sets up. */
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

/** Every text drawn, with the font sheet it was drawn in. */
function drawSheets(scene: { render(r: Renderer): void }) {
  const texts: { str: string; sheet: string }[] = [];
  const rr: Renderer = Object.assign(new NullRenderer(), {
    text(f: SpriteSheet, str: string): void {
      texts.push({ str, sheet: f.id });
    },
  });
  scene.render(rr);
  return texts;
}

// ---------------------------------------------------------------------------------------------

describe('181.1: the main Save data page', () => {
  it('BACK UP ON DEVICE, BACK UP ONLINE, RESET GAME, BACK on the web build', async () => {
    const r = rig();
    await flush();
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(labels(r.h.top())).toEqual(['Back up on device', 'Back up online', 'Reset game', 'Back']);
  });

  it('a code on the device adds no rows to the main page', async () => {
    uploadedCode();
    const r = rig();
    expect(labels(r.h.top())).toEqual(['Back up on device', 'Back up online', 'Reset game', 'Back']);
  });

  it('no note is drawn under the rows; what a backup holds is still said', async () => {
    const r = rig();
    await flush();
    const drawn = drawSheets(r.h.top() as never).map((t) => t.str);
    expect(drawn.filter((s) => /PACKS|BACKUP HOLDS|IMPORT NEVER/.test(s))).toEqual([]);
    expect(r.h.said.join(' | ')).toMatch(/does not restore asset packs/i);
  });

  it('BACK leaves Save data', async () => {
    const r = rig();
    const below = r.h.game.scenes.top;
    back(r);
    expect(r.h.top()).not.toBe(below);
  });
});

describe('181.2: BACK UP ON DEVICE', () => {
  it('opens Export backup, Import backup and Back, said', async () => {
    const r = rig();
    press(r, 'Back up on device');
    expect(titleOf(r.h)).toBe('BACK UP ON DEVICE');
    expect(labels(r.h.top())).toEqual(['Export backup', 'Import backup', 'Back']);
    expect(r.h.said.at(-1)).toMatch(/^Back up on device\..*Export backup/);
  });

  it('BACK (the row, and the button) returns to the main page, its row said', async () => {
    const r = rig();
    press(r, 'Back up on device');
    press(r, 'Back');
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(r.h.said.at(-1)).toMatch(/^Back up on device/);
    press(r, 'Back up on device');
    back(r);
    expect(titleOf(r.h)).toBe('SAVE DATA');
  });

  it('Export backup works from it (one file) and its status shows there', async () => {
    const r = rig();
    const delivered: File[][] = [];
    r.env.deliver = (f) => (delivered.push(f), Promise.resolve('downloaded'));
    // The packs are listed on opening (asynchronously): Export waits for that.
    await flush();
    press(r, 'Back up on device');
    press(r, 'Export backup');
    await flush();
    expect(delivered).toHaveLength(1);
    expect(titleOf(r.h)).toBe('BACK UP ON DEVICE');
    expect(status(r.h)).toBe('BACKUP SAVED');
  });

  it('Import backup keeps its checks, question and EXPORT FIRST', async () => {
    const r = rig();
    press(r, 'Back up on device');
    press(r, 'Import backup');
    r.picks.at(-1)!(new File(['not json'], 'x.json'));
    await flush();
    expect(status(r.h)).toBe('FILE NOT READABLE');
    const t = backupFrom(() => writeSave(newSave(2, 'link', null)));
    press(r, 'Import backup');
    r.picks.at(-1)!(new File([t], 'b.json'));
    await flush();
    expect(labels(r.h.top())).toEqual(['No', 'Yes', 'Export first']);
    press(r, 'No');
    expect(titleOf(r.h)).toBe('BACK UP ON DEVICE');
  });
});

describe('181.3 / 182: BACK UP ONLINE and its experimental note', () => {
  it('the rows: Back up online, Restore from code, Back (no code yet)', async () => {
    seenNote();
    const r = rig();
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(labels(r.h.top())).toEqual(['Back up online', 'Restore from code', 'Back']);
  });

  it('with an uploaded code: Show and Delete Most Recent Code too', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    expect(labels(r.h.top())).toEqual([
      'Back up online',
      'Restore from code',
      'Show most recent code',
      'Delete most recent code',
      'Back',
    ]);
  });

  it('the first entry shows the note: said, OK only, waits for OK; then the page', async () => {
    const r = rig();
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('EXPERIMENTAL FEATURE');
    expect(labels(r.h.top())).toEqual(['OK']);
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/experimental/i);
    expect(said).toMatch(/may be lost/i);
    expect(said).toMatch(/Back up on device/i);
    expect(said).toMatch(/ OK$/);
    for (const l of linesOf(r.h)) expect(l.length).toBeLessThanOrEqual(28);
    expect(linesOf(r.h).join(' ')).toMatch(/BACK UP ON DEVICE/);
    r.h.idle(600);
    expect(titleOf(r.h)).toBe('EXPERIMENTAL FEATURE');
    press(r, 'OK');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(r.loads).toBe(0);
  });

  it('shown once per device: not again on a later entry, nor on a new page load', async () => {
    const r = rig();
    press(r, 'Back up online');
    press(r, 'OK');
    expect(JSON.parse(ls.getItem(ONLINE_NOTICE_KEY) as string)).toBe(true);
    press(r, 'Back');
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    const again = rig();
    press(again, 'Back up online');
    expect(titleOf(again.h)).toBe('BACK UP ONLINE');
  });

  it('the seen flag is a game key: in a backup, and RESET GAME clears it (shown again after)', async () => {
    const r = rig();
    press(r, 'Back up online');
    press(r, 'OK');
    expect(isGameKey(ONLINE_NOTICE_KEY)).toBe(true);
    press(r, 'Back');
    press(r, 'Reset game');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(ls.getItem(ONLINE_NOTICE_KEY)).toBeNull();
    adoptDataEpoch();
    const fresh = rig();
    press(fresh, 'Back up online');
    expect(titleOf(fresh.h)).toBe('EXPERIMENTAL FEATURE');
  });

  it('BACK at the note closes it as OK does', async () => {
    const r = rig();
    press(r, 'Back up online');
    back(r);
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
  });

  it('storage that refuses the seen flag: the note still closes, and shows again next time', async () => {
    ls.throwOnWrite = true;
    const r = rig();
    press(r, 'Back up online');
    press(r, 'OK');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    press(r, 'Back');
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('EXPERIMENTAL FEATURE');
  });

  it('a damaged seen flag reads as not seen', async () => {
    ls.setItem(ONLINE_NOTICE_KEY, '{oops');
    const r = rig();
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('EXPERIMENTAL FEATURE');
  });

  it('a stale tab (another tab reset the data): OK closes the note and writes nothing', async () => {
    const r = rig();
    const reload = vi.fn();
    onStaleStorage(reload);
    ls.setItem('smbc.dataEpoch', 'another-tab');
    press(r, 'Back up online');
    press(r, 'OK');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(ls.getItem(ONLINE_NOTICE_KEY)).toBeNull();
  });

  it('BACK on the online page returns to the main page', async () => {
    seenNote();
    const r = rig();
    press(r, 'Back up online');
    back(r);
    expect(titleOf(r.h)).toBe('SAVE DATA');
  });
});

describe('181.4: the Back Up Online result card', () => {
  it('only BACKED UP (N OF 5 SERVERS), a blank line, then the code; COPY, SHARE, OK; the code spelled', async () => {
    const r = rig({ code: 'ABCDEF123456' });
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(linesOf(r.h)).toEqual(['BACKED UP (5 OF 5 SERVERS)', '', 'ABCD-EF12-3456']);
    expect(labels(r.h.top())).toEqual(['Copy code', 'Share code', 'OK']);
    expect(r.h.said.at(-1)).toMatch(/A B C D, E F 1 2, 3 4 5 6/);
    press(r, 'Copy code');
    await flush();
    expect(r.copied).toEqual(['ABCD-EF12-3456']);
    press(r, 'Share code');
    await flush();
    expect(r.shared[0]).toContain('ABCD-EF12-3456');
    press(r, 'OK');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
  });

  it('the code is drawn in its own colour (the gold font), the rest in the plain font', async () => {
    const r = rig({ code: 'ABCDEF123456' });
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    const texts = drawSheets(r.h.top() as never);
    const code = texts.filter((t) => t.str === 'ABCD-EF12-3456');
    expect(code).toHaveLength(1);
    expect(code[0]!.sheet).toBe(`font@${FONT_COLOURS.gold}`);
    expect(texts.find((t) => t.str === 'BACKED UP (5 OF 5 SERVERS)')!.sheet).toBe('font');
  });

  it("the code's colour comes from the palette system: distinct from the text in every palette mode", () => {
    for (const mode of PALETTE_MODES) {
      const plain = resolvePalette(PALETTES, 'font', mode);
      const gold = resolvePalette(PALETTES, FONT_COLOURS.gold, mode);
      expect(gold[1], mode).not.toBe(plain[1]);
      expect(gold[1], mode).not.toBe(plain[0]);
    }
    // The colour-blind and high-contrast modes have their own version of it.
    expect(resolvePalette(PALETTES, FONT_COLOURS.gold, 'highContrast')[1]).not.toBe(
      resolvePalette(PALETTES, FONT_COLOURS.gold, 'default')[1],
    );
  });

  it('Show Most Recent Code shows the code in the same colour, with Copy and Share', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    press(r, 'Show most recent code');
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(linesOf(r.h)).toContain('ZZZZ-ZZ99-9999');
    expect(labels(r.h.top())).toEqual(['Copy code', 'Share code', 'OK']);
    expect(r.h.said.at(-1)).toMatch(/Z Z Z Z, Z Z 9 9, 9 9 9 9/);
    expect(drawSheets(r.h.top() as never).find((t) => t.str === 'ZZZZ-ZZ99-9999')!.sheet).toBe(
      `font@${FONT_COLOURS.gold}`,
    );
    expect(r.loads).toBe(0);
  });

  it('a later backup with the same code: no card, just its status on the online page', async () => {
    seenNote();
    uploadedCode();
    const r = rig({ backUp: { ok: true, accepted: 3, total: 5, at: 1000 } });
    press(r, 'Back up online');
    press(r, 'Back up online');
    await flush();
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(status(r.h)).toBe('BACKED UP (3 OF 5 SERVERS)');
  });

  it('storage refusing the final write: the code card still shows (the player can keep the code)', async () => {
    const r = rig({ code: 'ABCDEF123456' });
    openOnline(r);
    press(r, 'Back up online');
    // The code's first write goes in; the one after the upload is refused.
    ls.writesLeft = 1;
    press(r, 'Yes, back up');
    await flush();
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(linesOf(r.h)).toContain('ABCD-EF12-3456');
  });
});

describe('181.3 / 183: DELETE MOST RECENT CODE', () => {
  it('asks DELETE YOUR ONLINE BACKUP? with NO first; NO changes nothing', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    expect(titleOf(r.h)).toBe('DELETE YOUR ONLINE BACKUP?');
    expect(labels(r.h.top())).toEqual(['No', 'Yes, delete']);
    expect(r.h.said.at(-1)).toMatch(/^Delete your online backup\?.*forget.* No$/i);
    for (const l of linesOf(r.h)) expect(l.length).toBeLessThanOrEqual(28);
    press(r, 'No');
    await flush();
    expect(r.api.deletes).toEqual([]);
    expect(r.loads).toBe(0);
    expect(stored()).toMatchObject({ code: CODE });
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
  });

  it('YES: the online copy is deleted AND the code forgotten; its rows go; the next backup makes a new code', async () => {
    seenNote();
    uploadedCode();
    const r = rig({ code: 'NEWNEW123456' });
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    expect(r.api.deletes).toEqual([{ code: CODE, after: 900 }]);
    expect(ls.getItem(ONLINE_BACKUP_KEY)).toBeNull();
    expect(status(r.h)).toBe('DELETED ON 5 OF 5 SERVERS');
    expect(r.h.said.at(-1)).toMatch(/deleted on 5 of 5 servers/i);
    expect(r.h.said.at(-1)).toMatch(/forgot/i);
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(labels(r.h.top())).toEqual(['Back up online', 'Restore from code', 'Back']);
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE?');
    press(r, 'Yes, back up');
    await flush();
    expect(r.api.backUps.at(-1)!.code).toBe('NEWNEW123456');
  });

  it('212: a partial delete KEEPS the code (still uploaded) and says to try again for the rest', async () => {
    seenNote();
    uploadedCode();
    const r = rig({ deleted: { ok: true, deleted: 2, total: 5, at: 1500 } });
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    expect(stored()).toMatchObject({ code: CODE, uploaded: true, lastAt: 1500 });
    expect(status(r.h)).toBe('DELETED ON 2 OF 5 SERVERS');
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/may remain/i);
    expect(said).toMatch(/try .*again/i);
    expect(said).not.toMatch(/forgot/i);
    expect(labels(r.h.top())).toContain('Delete most recent code');
    // Trying again: every server confirms, and only now is the code forgotten.
    r.api.deleteOnline = async (code, after) => {
      r.api.deletes.push({ code, after });
      return { ok: true, deleted: 5, total: 5, at: 1600 };
    };
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    await flush();
    expect(r.api.deletes.at(-1)).toEqual({ code: CODE, after: 1500 });
    expect(ls.getItem(ONLINE_BACKUP_KEY)).toBeNull();
  });

  it('a failed delete keeps the code (it can be tried again)', async () => {
    seenNote();
    uploadedCode();
    for (const d of [
      { ok: false, reason: 'servers', deleted: 0, total: 5 },
      { ok: false, reason: 'refused', deleted: 0, total: 5 },
      { ok: false, reason: 'newer', deleted: 0, total: 5 },
    ] as DeleteResult[]) {
      const r = rig({ deleted: d });
      press(r, 'Back up online');
      press(r, 'Delete most recent code');
      press(r, 'Yes, delete');
      await flush();
      expect(stored()).toMatchObject({ code: CODE, uploaded: true });
      expect(labels(r.h.top())).toContain('Delete most recent code');
    }
  });

  it('offline: says it needs internet and keeps the code', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    r.online.value = false;
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    expect(status(r.h)).toBe('NEEDS AN INTERNET CONNECTION');
    expect(stored()).toMatchObject({ code: CODE });
  });

  it('storage that will not let the code go: said, not claimed forgotten', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    press(r, 'Delete most recent code');
    press(r, 'Yes, delete');
    ls.throwOnWrite = true;
    await flush();
    expect(r.api.deletes).toHaveLength(1);
    expect(r.h.said.at(-1)).toMatch(/could not forget/i);
    expect(r.h.said.at(-1)).not.toMatch(/this device forgot/i);
  });
});

describe('181.5 / 188: RESET GAME', () => {
  async function resetAll(r: Rig): Promise<void> {
    press(r, 'Reset game');
    if (titleOf(r.h) === 'YOUR BACKUP CODE') press(r, 'Continue');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
  }

  it('without a code: RESET GAME? (NO, EXPORT BACKUP FIRST, YES), ARE YOU SURE?, then erased; nothing online', async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('RESET GAME?');
    expect(labels(r.h.top())).toEqual(['No', 'Export backup first', 'Yes']);
    expect(r.h.said.at(-1)).toMatch(/^Reset game\?/);
    press(r, 'Yes');
    expect(titleOf(r.h)).toBe('ARE YOU SURE?');
    expect(labels(r.h.top())).toEqual(['No', 'Yes, reset']);
    press(r, 'Yes, reset');
    await flush();
    expect(ls.snapshot(isGameKey)).toEqual({});
    expect(titleOf(r.h)).toBe('GAME RESET');
    expect(r.loads).toBe(0);
    expect(r.api.deletes).toEqual([]);
    press(r, 'OK');
    expect(r.restart).toHaveBeenCalledTimes(1);
  });

  it('with an uploaded code: the code first (COPY CODE, said), then the same questions; nothing deleted online', async () => {
    uploadedCode();
    const r = rig();
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(labels(r.h.top())).toEqual(['Copy code', 'Continue']);
    expect(linesOf(r.h)).toContain('ZZZZ-ZZ99-9999');
    for (const l of linesOf(r.h)) expect(l.length).toBeLessThanOrEqual(28);
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/stays on the servers/i);
    expect(said).toMatch(/Z Z Z Z, Z Z 9 9, 9 9 9 9/);
    expect(drawSheets(r.h.top() as never).find((t) => t.str === 'ZZZZ-ZZ99-9999')!.sheet).toBe(
      `font@${FONT_COLOURS.gold}`,
    );
    press(r, 'Copy code');
    await flush();
    expect(r.copied).toEqual(['ZZZZ-ZZ99-9999']);
    press(r, 'Continue');
    expect(titleOf(r.h)).toBe('RESET GAME?');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(r.api.deletes).toEqual([]);
    expect(r.loads).toBe(0);
    expect(ls.getItem(ONLINE_BACKUP_KEY)).toBeNull();
    expect(titleOf(r.h)).toBe('GAME RESET');
  });

  it('there is no ALSO DELETE YOUR ONLINE BACKUP? question anywhere', async () => {
    uploadedCode();
    const r = rig();
    const titles: string[] = [];
    press(r, 'Reset game');
    titles.push(titleOf(r.h));
    press(r, 'Continue');
    titles.push(titleOf(r.h));
    press(r, 'Yes');
    titles.push(titleOf(r.h));
    press(r, 'Yes, reset');
    await flush();
    titles.push(titleOf(r.h));
    expect(titles).toEqual(['YOUR BACKUP CODE', 'RESET GAME?', 'ARE YOU SURE?', 'GAME RESET']);
  });

  it('BACK at the code card, or at any question, cancels the whole reset', async () => {
    uploadedCode();
    writeSave(newSave(1, 'mario', null));
    const before = ls.snapshot();
    const r = rig();
    press(r, 'Reset game');
    back(r);
    expect(titleOf(r.h)).toBe('SAVE DATA');
    press(r, 'Reset game');
    press(r, 'Continue');
    back(r);
    expect(titleOf(r.h)).toBe('SAVE DATA');
    press(r, 'Reset game');
    press(r, 'Continue');
    press(r, 'Yes');
    back(r);
    await flush();
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(ls.snapshot()).toEqual(before);
  });

  it('a code that was never uploaded is not shown (nothing of it is online)', async () => {
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: false }));
    const r = rig();
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('RESET GAME?');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(r.h.said.join(' | ')).not.toMatch(/stays online|stays on the servers/i);
  });

  it('offline (no connection) with a code: the code card still comes, needing no network', async () => {
    uploadedCode();
    const r = rig();
    r.online.value = false;
    await resetAll(r);
    expect(ls.snapshot(isGameKey)).toEqual({});
    expect(r.loads).toBe(0);
  });

  it('a reset that fails keeps everything, the code included', async () => {
    uploadedCode();
    const r = rig();
    ls.throwOnWrite = true;
    await resetAll(r);
    expect(stored()).toMatchObject({ code: CODE, uploaded: true });
    expect(titleOf(r.h)).toBe('SAVE DATA');
  });

  it('storage that cannot be read: no code card, and the reset says storage cannot be read', async () => {
    uploadedCode();
    const r = rig();
    ls.throwOnRead = true;
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('RESET GAME?');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(status(r.h)).toBe('STORAGE CANNOT BE READ');
  });
});

describe('184: the Home Screen flags outlive a reset and an import', () => {
  const hooks = (): HomeScreenHooks => ({
    ios: true,
    phone: true,
    standalone: true,
    fileCopy: true,
    variant: () => 'ios-safari',
    prompt: async () => 'unavailable',
    updateReady: () => false,
    applyUpdate: () => {},
  });
  const withFlags = () => {
    const s = defaultSettings();
    s.homeScreen = { tipDone: true, noticeDone: true, offlineDone: true };
    s.audio.sfx = 0.3;
    ls.setItem(SETTINGS_KEY, JSON.stringify(s));
    return s;
  };
  /** The game as main.ts starts it again after the restart. */
  const restarted = () => {
    adoptDataEpoch();
    const s = loadSettings();
    return makeGame({ deps: { settings: s, applySettings: () => saveSettings(s), homeScreen: hooks() } });
  };

  it('erase, restart: standaloneNoticeDue and offlineNoticeDue are both false; the rest is fresh', async () => {
    const r = rig({ settings: withFlags(), homeScreen: hooks() });
    press(r, 'Reset game');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(titleOf(r.h)).toBe('GAME RESET');
    const g = restarted();
    expect(standaloneNoticeDue(g.game)).toBe(false);
    expect(offlineNoticeDue(g.game)).toBe(false);
    expect(g.game.deps.settings!.homeScreen).toEqual({ tipDone: true, noticeDone: true, offlineDone: true });
    expect(g.game.deps.settings!.audio.sfx).toBe(defaultSettings().audio.sfx);
    expect(Object.keys(ls.snapshot(isGameKey))).toEqual([SETTINGS_KEY]);
  });

  it('flags set in this tab but not yet stored are kept too', async () => {
    const s = defaultSettings();
    s.homeScreen = { tipDone: false, noticeDone: true, offlineDone: false };
    const r = rig({ settings: s, homeScreen: hooks() });
    press(r, 'Reset game');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    const g = restarted();
    expect(standaloneNoticeDue(g.game)).toBe(false);
    expect(offlineNoticeDue(g.game)).toBe(true);
  });

  it('with no flag set, a reset leaves no key behind', async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    press(r, 'Reset game');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(ls.snapshot(isGameKey)).toEqual({});
  });

  it("an import keeps this device's flags over the backup's (they are device facts)", async () => {
    const t = backupFrom((o) => {
      const s = defaultSettings();
      s.homeScreen = { tipDone: false, noticeDone: false, offlineDone: false };
      s.audio.sfx = 0.1;
      o.setItem(SETTINGS_KEY, JSON.stringify(s));
    });
    const r = rig({ settings: withFlags(), homeScreen: hooks() });
    await importFile(r, t);
    expect(titleOf(r.h)).toBe('BACKUP IMPORTED');
    const g = restarted();
    expect(standaloneNoticeDue(g.game)).toBe(false);
    expect(offlineNoticeDue(g.game)).toBe(false);
    expect(g.game.deps.settings!.audio.sfx).toBe(0.1);
    expect(g.game.deps.settings!.homeScreen).toEqual({ tipDone: true, noticeDone: true, offlineDone: true });
  });

  it("review: the device's flags win outright, false over the file's true too", async () => {
    // This device: only the phone tip seen. The file (another device): every note seen.
    const t = backupFrom((o) => {
      const s = defaultSettings();
      s.homeScreen = { tipDone: false, noticeDone: true, offlineDone: true };
      o.setItem(SETTINGS_KEY, JSON.stringify(s));
    });
    const mine = defaultSettings();
    mine.homeScreen = { tipDone: true, noticeDone: false, offlineDone: false };
    ls.setItem(SETTINGS_KEY, JSON.stringify(mine));
    const r = rig({ settings: mine, homeScreen: hooks() });
    await importFile(r, t);
    const g = restarted();
    expect(g.game.deps.settings!.homeScreen).toEqual({
      tipDone: true,
      noticeDone: false,
      offlineDone: false,
    });
    expect(standaloneNoticeDue(g.game)).toBe(true);
    expect(offlineNoticeDue(g.game)).toBe(true);
  });

  it("review: a device that has seen no note takes none of the file's", async () => {
    const t = backupFrom((o) => {
      const s = defaultSettings();
      s.homeScreen = { tipDone: true, noticeDone: true, offlineDone: true };
      o.setItem(SETTINGS_KEY, JSON.stringify(s));
    });
    const r = rig({ homeScreen: hooks() });
    await importFile(r, t);
    const g = restarted();
    expect(g.game.deps.settings!.homeScreen).toEqual({
      tipDone: false,
      noticeDone: false,
      offlineDone: false,
    });
  });

  it('review: the tip seen only in this tab (not stored) is kept by a reset and an import', async () => {
    const s = defaultSettings();
    s.homeScreen = { tipDone: true, noticeDone: false, offlineDone: false };
    const r = rig({ settings: s, homeScreen: hooks() });
    press(r, 'Reset game');
    press(r, 'Yes');
    press(r, 'Yes, reset');
    await flush();
    expect(restarted().game.deps.settings!.homeScreen?.tipDone).toBe(true);
    ls = installStorage(new FakeStorage());
    adoptDataEpoch();
    const t = backupFrom(() => writeSave(newSave(2, 'link', null)));
    const s2 = defaultSettings();
    s2.homeScreen = { tipDone: true, noticeDone: false, offlineDone: false };
    const r2 = rig({ settings: s2, homeScreen: hooks() });
    await importFile(r2, t);
    expect(restarted().game.deps.settings!.homeScreen?.tipDone).toBe(true);
  });

  it('an import without settings still keeps the flags', async () => {
    const t = backupFrom(() => writeSave(newSave(2, 'link', null)));
    const r = rig({ settings: withFlags(), homeScreen: hooks() });
    await importFile(r, t);
    const g = restarted();
    expect(standaloneNoticeDue(g.game)).toBe(false);
    expect(ls.getItem(saveKey(2))).not.toBeNull();
  });
});

describe('185: the online code loader tries again after a failed import()', () => {
  it('a rejected load is not kept: the next call loads again; a good one is kept', async () => {
    let n = 0;
    const api = {} as OnlineApi;
    const raw = vi.fn(() =>
      n++ === 0 ? Promise.reject(new Error('Failed to fetch module')) : Promise.resolve(api),
    );
    const load = onlineLoader(raw);
    await expect(load()).rejects.toThrow('Failed to fetch module');
    await expect(load()).resolves.toBe(api);
    await expect(load()).resolves.toBe(api);
    expect(raw).toHaveBeenCalledTimes(2);
  });

  it('two presses while it loads share one load', async () => {
    let open!: (a: OnlineApi) => void;
    const raw = vi.fn(() => new Promise<OnlineApi>((res) => (open = res)));
    const load = onlineLoader(raw);
    const a = load();
    const b = load();
    open({} as OnlineApi);
    expect(await a).toBe(await b);
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('review: a second failed load in a row says to reload the page; a load that works resets that', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    let fails = 2;
    r.env.online!.load = onlineLoader(() =>
      fails-- > 0 ? Promise.reject(new Error('Failed to fetch module')) : Promise.resolve(r.api),
    );
    press(r, 'Back up online');
    press(r, 'Back up online');
    await flush();
    expect(r.h.said.at(-1)).not.toMatch(/reload/i);
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('COULD NOT REACH THE SERVERS');
    expect(r.h.said.at(-1)).toMatch(/reload the page/i);
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('BACKED UP (5 OF 5 SERVERS)');
    // One failure after a good load is a first failure again.
    r.env.online!.load = onlineLoader(() => Promise.reject(new Error('x')));
    press(r, 'Back up online');
    await flush();
    expect(r.h.said.at(-1)).not.toMatch(/reload/i);
  });

  it('228: the same loader failing, working, then failing once: no reload line (the count was reset)', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    const plan = [false, true, false];
    // One load function throughout (onlineLoader would keep the good load, so it is left out).
    r.env.online!.load = () =>
      plan.shift() ? Promise.resolve(r.api) : Promise.reject(new Error('Failed to fetch module'));
    for (const want of [
      'COULD NOT REACH THE SERVERS',
      'BACKED UP (5 OF 5 SERVERS)',
      'COULD NOT REACH THE SERVERS',
    ]) {
      press(r, 'Back up online');
      await flush();
      expect(status(r.h)).toBe(want);
      expect(r.h.said.at(-1)).not.toMatch(/reload/i);
    }
  });

  it('on the page: COULD NOT REACH THE SERVERS once, then the next try backs up', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    let n = 0;
    r.env.online!.load = onlineLoader(() =>
      n++ === 0 ? Promise.reject(new Error('Failed to fetch module')) : Promise.resolve(r.api),
    );
    press(r, 'Back up online');
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('COULD NOT REACH THE SERVERS');
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('BACKED UP (5 OF 5 SERVERS)');
  });
});

describe('223: a first backup only some servers took', () => {
  it('ONLY 1 OF 5 SERVERS TOOK IT: said, and the code counts as online (Show, Delete, the reset card)', async () => {
    const r = rig({ backUp: { ok: false, reason: 'servers', accepted: 1, total: 5 } });
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(status(r.h)).toBe('ONLY 1 OF 5 SERVERS TOOK IT');
    expect(r.h.said.at(-1)).not.toMatch(/nothing changed/i);
    expect(stored()).toMatchObject({ code: 'ABCDEF123456', uploaded: true });
    expect(labels(r.h.top())).toContain('Show most recent code');
    expect(labels(r.h.top())).toContain('Delete most recent code');
  });

  it('none took it: not uploaded', async () => {
    const r = rig({ backUp: { ok: false, reason: 'servers', accepted: 0, total: 5 } });
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(stored()?.uploaded).not.toBe(true);
  });
});

describe('226: a code stored by v0.4.76 (no uploaded field, owner exception)', () => {
  const old = () => ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: true, lastAt: 900 }));

  it('reads as uploaded when it has a last backup time: Show and Delete appear', async () => {
    seenNote();
    old();
    const r = rig();
    press(r, 'Back up online');
    expect(labels(r.h.top())).toEqual([
      'Back up online',
      'Restore from code',
      'Show most recent code',
      'Delete most recent code',
      'Back',
    ]);
  });

  it('Reset shows its code first', async () => {
    old();
    const r = rig();
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(linesOf(r.h)).toContain('ZZZZ-ZZ99-9999');
  });

  it('without a last backup time (never backed up) it is not online; uploaded: false is not either', async () => {
    seenNote();
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: false }));
    const r = rig();
    press(r, 'Back up online');
    expect(labels(r.h.top())).not.toContain('Show most recent code');
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: true, lastAt: 900, uploaded: false }));
    const r2 = rig();
    press(r2, 'Back up online');
    expect(labels(r2.h.top())).not.toContain('Show most recent code');
  });
});

describe('227: the online page after the first backup', () => {
  it('OK on the code card: the online page says BACKED UP, not BACKING UP...', async () => {
    const r = rig();
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    press(r, 'OK');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE');
    expect(status(r.h)).toBe('BACKED UP (5 OF 5 SERVERS)');
    // The main page underneath keeps no stale line of its own.
    press(r, 'Back');
    expect(status(r.h)).toBe('');
  });
});

describe('186 / 187: a failed first backup', () => {
  for (const [what, setup] of [
    ['no server reached', { backUp: { ok: false, reason: 'servers', accepted: 0, total: 5 } }],
    ['refused', { backUp: { ok: false, reason: 'refused', accepted: 0, total: 5 } }],
    ['too big', { backUp: { ok: false, reason: 'too-big', accepted: 0, total: 5 } }],
  ] as const) {
    it(`${what}: never says "Nothing changed" while a code was kept; the code is not uploaded`, async () => {
      const r = rig(setup as { backUp: BackUpResult });
      openOnline(r);
      press(r, 'Back up online');
      press(r, 'Yes, back up');
      await flush();
      const said = r.h.said.at(-1) as string;
      if (ls.getItem(ONLINE_BACKUP_KEY) !== null) expect(said).not.toMatch(/nothing changed/i);
      expect(stored()?.uploaded).not.toBe(true);
      expect(labels(r.h.top())).not.toContain('Show most recent code');
      expect(labels(r.h.top())).not.toContain('Delete most recent code');
    });
  }

  it('the backUp call throwing: not "Nothing changed" either', async () => {
    const r = rig();
    r.api.backUp = () => Promise.reject(new Error('socket'));
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(status(r.h)).toBe('COULD NOT REACH THE SERVERS');
    expect(r.h.said.at(-1)).not.toMatch(/nothing changed/i);
    expect(r.h.said.at(-1)).toMatch(/nothing was backed up/i);
  });

  it('after a reopen, the never-uploaded code still has no Show or Delete row; a later good backup shows it', async () => {
    const bad = rig({ backUp: { ok: false, reason: 'servers', accepted: 0, total: 5 } });
    openOnline(bad);
    press(bad, 'Back up online');
    press(bad, 'Yes, back up');
    await flush();
    const kept = stored().code;
    const r = rig();
    press(r, 'Back up online');
    expect(labels(r.h.top())).toEqual(['Back up online', 'Restore from code', 'Back']);
    press(r, 'Back up online');
    await flush();
    // Same code, and the card shows it (it was never shown).
    expect(r.api.backUps.at(-1)!.code).toBe(kept);
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    press(r, 'OK');
    expect(stored()).toMatchObject({ code: kept, uploaded: true, shown: true });
    expect(labels(r.h.top())).toContain('Show most recent code');
  });
});

describe('187: the uploaded flag', () => {
  it('set by a confirmed upload', async () => {
    const r = rig();
    openOnline(r);
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(stored()).toMatchObject({ code: 'ABCDEF123456', uploaded: true, lastAt: 1234 });
  });

  it('set by a successful restore from code (the copy itself never says uploaded)', async () => {
    const t = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ABCDEF123456', shown: true })),
    );
    seenNote();
    const r = rig({ restore: { ok: true, text: t, from: 'x', at: 5000 } });
    // The seen flag is replaced with the backup's data; this rig opened before.
    press(r, 'Back up online');
    press(r, 'Restore from code');
    (r.h.top() as RestoreCodeScene).submit('ABCDEF123456');
    await flush();
    press(r, 'Yes');
    await flush();
    expect(stored()).toMatchObject({ code: 'ABCDEF123456', uploaded: true, shown: false, lastAt: 5000 });
  });

  it('set by an import carrying a valid uploaded code; not by one carrying a code never uploaded', async () => {
    const up = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'QQQQQQ111111', shown: true, uploaded: true })),
    );
    const r = rig();
    await importFile(r, up);
    expect(stored()).toMatchObject({ code: 'QQQQQQ111111', uploaded: true, shown: false });
    // From empty storage: a file's code never uploaded stays not uploaded.
    ls = installStorage(new FakeStorage());
    adoptDataEpoch();
    const never = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'QQQQQQ111111', shown: true })),
    );
    const r2 = rig();
    await importFile(r2, never);
    expect(stored()?.uploaded).not.toBe(true);
    seenNote();
    const r3 = rig();
    press(r3, 'Back up online');
    expect(labels(r3.h.top())).not.toContain('Show most recent code');
  });

  it('review MUST 1: an import of an older file with the SAME code keeps uploaded and the later lastAt', async () => {
    // The first backup failed (code kept, not uploaded), the file was exported, then a backup worked.
    const older = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'qqqq-qq11-1111', shown: false, lastAt: 100 })),
    );
    ls.setItem(
      ONLINE_BACKUP_KEY,
      JSON.stringify({ code: 'QQQQQQ111111', shown: true, lastAt: 900, uploaded: true }),
    );
    const r = rig();
    await importFile(r, older);
    expect(stored()).toMatchObject({ code: 'QQQQQQ111111', uploaded: true, lastAt: 900 });
    seenNote();
    adoptDataEpoch();
    const r2 = rig();
    press(r2, 'Back up online');
    expect(labels(r2.h.top())).toContain('Delete most recent code');
    press(r2, 'Back');
    press(r2, 'Reset game');
    expect(titleOf(r2.h)).toBe('YOUR BACKUP CODE');
  });

  it('review MUST 1: the same code, the file uploaded and later: uploaded, and its lastAt', async () => {
    const newer = backupFrom((o) =>
      o.setItem(
        ONLINE_BACKUP_KEY,
        JSON.stringify({ code: 'QQQQQQ111111', shown: true, lastAt: 2000, uploaded: true }),
      ),
    );
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'QQQQQQ111111', shown: true, lastAt: 900 }));
    const r = rig();
    await importFile(r, newer);
    expect(stored()).toMatchObject({ code: 'QQQQQQ111111', uploaded: true, lastAt: 2000 });
  });

  it("a different code in the file replaces this device's, with the file's own uploaded and lastAt", async () => {
    const other = backupFrom((o) =>
      o.setItem(
        ONLINE_BACKUP_KEY,
        JSON.stringify({ code: 'RRRRRR222222', shown: true, lastAt: 5, uploaded: false }),
      ),
    );
    uploadedCode();
    const r = rig();
    await importFile(r, other);
    expect(stored()).toEqual({ code: 'RRRRRR222222', shown: false, lastAt: 5 });
  });

  it('damaged: an uploaded field that is not true reads as not uploaded', async () => {
    seenNote();
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: true, uploaded: 'yes' }));
    const r = rig();
    press(r, 'Back up online');
    expect(labels(r.h.top())).not.toContain('Show most recent code');
    press(r, 'Back');
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('RESET GAME?');
  });

  it('damaged: a code entry that does not read at all gives no rows and no reset card', async () => {
    seenNote();
    ls.setItem(ONLINE_BACKUP_KEY, '{"code":');
    const r = rig();
    press(r, 'Back up online');
    expect(labels(r.h.top())).toEqual(['Back up online', 'Restore from code', 'Back']);
    press(r, 'Back');
    press(r, 'Reset game');
    expect(titleOf(r.h)).toBe('RESET GAME?');
  });

  it('a stale tab: the confirmed upload cannot mark the code, and nothing claims it did', async () => {
    seenNote();
    const r = rig();
    press(r, 'Back up online');
    onStaleStorage(() => {});
    ls.setItem('smbc.dataEpoch', 'another-tab');
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    // The code could not even be kept: said, nothing uploaded.
    expect(r.api.backUps).toEqual([]);
    expect(status(r.h)).toBe('STORAGE CANNOT BE READ');
  });
});

describe('230: an import that replaces an uploaded code shows it first', () => {
  async function toQuestion(r: Rig, text: string): Promise<void> {
    press(r, 'Back up on device');
    press(r, 'Import backup');
    r.picks.at(-1)!(new File([text], 'b.json', { type: 'application/json' }));
    await flush();
    expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
  }

  it("a file with another code: this device's code on the question, with Copy code, said", async () => {
    const t = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'QQQQQQ111111', shown: true, uploaded: true })),
    );
    uploadedCode();
    const r = rig();
    await toQuestion(r, t);
    expect(labels(r.h.top())).toEqual(['No', 'Yes', 'Export first', 'Copy code']);
    expect(linesOf(r.h)).toContain('ZZZZ-ZZ99-9999');
    for (const l of linesOf(r.h)) expect(l.length).toBeLessThanOrEqual(28);
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/Z Z Z Z, Z Z 9 9, 9 9 9 9/);
    expect(said).toMatch(/stays on the servers/i);
    expect(said).toMatch(/ No$/);
    expect(drawSheets(r.h.top() as never).find((t) => t.str === 'ZZZZ-ZZ99-9999')!.sheet).toBe(
      `font@${FONT_COLOURS.gold}`,
    );
    press(r, 'Copy code');
    await flush();
    expect(r.copied).toEqual(['ZZZZ-ZZ99-9999']);
    expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
    press(r, 'Yes');
    await flush();
    expect(stored()).toMatchObject({ code: 'QQQQQQ111111' });
  });

  it('no Copy code row when the file has the same code, no code, or this device has none uploaded', async () => {
    const same = backupFrom((o) => o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: true })));
    const none = backupFrom(() => writeSave(newSave(2, 'link', null)));
    const other = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'QQQQQQ111111', shown: true, uploaded: true })),
    );
    uploadedCode();
    for (const t of [same, none]) {
      const r = rig();
      await toQuestion(r, t);
      expect(labels(r.h.top())).toEqual(['No', 'Yes', 'Export first']);
    }
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: CODE, shown: false }));
    const r = rig();
    await toQuestion(r, other);
    expect(labels(r.h.top())).toEqual(['No', 'Yes', 'Export first']);
  });

  it('a restore from another code shows it the same way', async () => {
    const t = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ABCDEF123456', shown: true, lastAt: 3 })),
    );
    seenNote();
    uploadedCode();
    const r = rig({ restore: { ok: true, text: t, from: 'x', at: 10 } });
    press(r, 'Back up online');
    press(r, 'Restore from code');
    (r.h.top() as RestoreCodeScene).submit('ABCDEF123456');
    await flush();
    expect(labels(r.h.top())).toContain('Copy code');
    expect(linesOf(r.h)).toContain('ZZZZ-ZZ99-9999');
  });
});

describe('189: a code from an imported file is stored normalised', () => {
  it('lower case, dashes and spaces, O and I: stored as its 12 canonical characters', async () => {
    const t = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'abcd-ef12-3456', shown: true, uploaded: true })),
    );
    const r = rig();
    await importFile(r, t);
    expect(stored().code).toBe('ABCDEF123456');
    const t2 = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'zzzz zz99 999o', shown: true, uploaded: true })),
    );
    const r2 = rig();
    await importFile(r2, t2);
    expect(stored().code).toBe('ZZZZZZ999990');
  });

  it('from a restore too', async () => {
    const t = backupFrom((o) =>
      o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'abcd-ef12-3456', shown: true })),
    );
    seenNote();
    const r = rig({ restore: { ok: true, text: t, from: 'x' } });
    press(r, 'Back up online');
    press(r, 'Restore from code');
    (r.h.top() as RestoreCodeScene).submit('ABCDEF123456');
    await flush();
    press(r, 'Yes');
    await flush();
    expect(stored().code).toBe('ABCDEF123456');
  });
});

describe('the offline build: no online row, and no network request at all', () => {
  it('every page and flow, an imported uploaded code included, without one request', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in the offline build')));
    const sockets = vi.fn();
    const g = globalThis as { fetch?: unknown; WebSocket?: unknown };
    const saved = { fetch: g.fetch, WebSocket: g.WebSocket };
    g.fetch = fetchSpy;
    g.WebSocket = class {
      constructor() {
        sockets();
      }
    };
    try {
      const r = rig({ offlineBuild: true });
      await flush();
      expect(labels(r.h.top())).toEqual(['Back up on device', 'Reset game', 'Back']);
      press(r, 'Back up on device');
      expect(labels(r.h.top())).toEqual(['Export backup', 'Import backup', 'Back']);
      press(r, 'Export backup');
      await flush();
      press(r, 'Back');
      const t = backupFrom((o) =>
        o.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'abcd-ef12-3456', shown: true, uploaded: true })),
      );
      await importFile(r, t);
      expect(stored()).toMatchObject({ code: 'ABCDEF123456', uploaded: true });
      const r2 = rig({ offlineBuild: true });
      expect(labels(r2.h.top())).not.toContain('Back up online');
      // Item 181.5 / 188: the imported code is shown before the reset, with COPY CODE.
      press(r2, 'Reset game');
      expect(titleOf(r2.h)).toBe('YOUR BACKUP CODE');
      press(r2, 'Copy code');
      await flush();
      expect(r2.copied).toEqual(['ABCD-EF12-3456']);
      press(r2, 'Continue');
      press(r2, 'Yes');
      press(r2, 'Yes, reset');
      await flush();
      expect(titleOf(r2.h)).toBe('GAME RESET');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(sockets).not.toHaveBeenCalled();
      expect(r.loads + r2.loads).toBe(0);
    } finally {
      g.fetch = saved.fetch;
      g.WebSocket = saved.WebSocket;
    }
  });
});

describe('every new text is said', () => {
  it('each row of the three pages has a hint', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    const pages: MenuItem[][] = [];
    pages.push((r.h.top() as unknown as { items: MenuItem[] }).items);
    press(r, 'Back up on device');
    pages.push((r.h.top() as unknown as { items: MenuItem[] }).items);
    press(r, 'Back');
    press(r, 'Back up online');
    pages.push((r.h.top() as unknown as { items: MenuItem[] }).items);
    for (const items of pages)
      for (const it of items) if (it.label !== 'Back') expect(it.hint, it.label).toBeTruthy();
  });

  it('moving onto Delete most recent code says what it does', async () => {
    seenNote();
    uploadedCode();
    const r = rig();
    press(r, 'Back up online');
    r.h.idle(8);
    while (labels(r.h.top())[(r.h.top() as unknown as { index: number }).index] !== 'Delete most recent code')
      r.h.tap('down');
    expect(r.h.said.at(-1)).toMatch(/^Delete most recent code\..*forget/i);
  });
});
