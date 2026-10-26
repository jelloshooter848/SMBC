import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, SETTINGS_KEY } from '@engine/save/settings';
import { adoptDataEpoch } from '@engine/save/storage';
import { buildBackup, isGameKey } from '@engine/save/backup';
import type { StoredPack } from '@engine/assets/idb';
import { OptionsScene } from '@game/scenes/options';
import { SaveDataOptions, type SaveDataEnv } from '@game/scenes/save-data';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { newSave, saveKey, writeSave } from '@game/save/save-files';
import { makeGame, type H } from './heroes-harness';
import { FakeStorage, installStorage, readZip, text } from './save-data-helpers';

/*
 * Options > Save data on the REMIX title (owner items 86-88): EXPORT BACKUP, IMPORT BACKUP,
 * ERASE ALL DATA. The asset-pack question comes only when packs exist; the share sheet, the
 * downloads and the file chooser run inside the press's own event (iOS); every question and
 * every outcome is said; nothing changes without YES; after an import or an erase the game
 * starts again from its first screen.
 */

// A made-up build version for these tests (not a planned release).
const VERSION = '2.4.16';
let ls: FakeStorage;
beforeEach(() => {
  ls = installStorage(new FakeStorage());
  adoptDataEpoch();
});

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

function storedPack(name: string): StoredPack {
  return {
    name,
    manifest: { schema: 1, name, sprites: { mario: { image: 'mario.png' } } },
    files: { 'mario.png': new Blob([new Uint8Array([1, 2, 3])]) },
    addedAt: 1,
  };
}

interface Rig {
  h: H;
  env: SaveDataEnv;
  delivered: File[][];
  picks: ((f: File) => void)[];
  restart: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  /** Whether the last deliver / pick ran inside the press's own event. */
  inEvent: boolean[];
}

function rig(opts: { packs?: StoredPack[]; clearFails?: boolean; dev?: boolean } = {}): Rig {
  const delivered: File[][] = [];
  const picks: ((f: File) => void)[] = [];
  const inEvent: boolean[] = [];
  let inside = false;
  const restart = vi.fn();
  const clear = vi.fn(() => (opts.clearFails ? Promise.reject(new Error('IDB failed')) : Promise.resolve()));
  const env: SaveDataEnv = {
    gameVersion: VERSION,
    now: () => new Date(2026, 9, 22, 9, 0),
    deliver: (files) => {
      inEvent.push(inside);
      delivered.push(files);
      return Promise.resolve('downloaded');
    },
    pickFile: (cb) => {
      inEvent.push(inside);
      picks.push(cb);
    },
    packs: { list: () => Promise.resolve(opts.packs ?? []), clear },
    restart,
  };
  const settings = defaultSettings();
  const h = makeGame({ deps: { settings, applySettings: () => {}, saveDataEnv: env } });
  // The input handlers' in-event path (main.ts bindGestureKeys): a confirm key's keydown.
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
  return { h, env, delivered, picks, restart, clear, inEvent };
}

/** Moves the cursor on the page on top to row `label`. */
function moveTo(h: H, label: string): void {
  h.idle(8);
  const m = h.top() as MenuScene;
  const at = labels(m).indexOf(label);
  expect(at, `${label} in ${labels(m).join(', ')}`).toBeGreaterThanOrEqual(0);
  const index = () => (h.top() as unknown as { index: number }).index;
  while (index() !== at) h.tap(index() < at ? 'down' : 'up');
}

/** Picks row `label` as a key press does: in its keydown event, then the frame. */
function press(r: Rig, label: string): void {
  moveTo(r.h, label);
  r.h.game.gestures.key();
  r.h.tap('jump');
}

async function openPage(r: Rig): Promise<SaveDataOptions> {
  const page = new SaveDataOptions(r.h.game, () => r.h.game.scenes.pop());
  r.h.game.scenes.push(page);
  await flush();
  return page;
}

const titleOf = (h: H) => (h.top() as MenuScene).title;

describe('where SAVE DATA is', () => {
  it("in the REMIX title's Options only (not over a game, not Classic's)", () => {
    const { h } = rig();
    const title = new OptionsScene(h.game, () => {});
    expect(labels(title)).toContain('Save data');
    expect(labels(new OptionsScene(h.game, () => {}, true))).not.toContain('Save data');
    expect(labels(new OptionsScene(h.game, () => {}, false, true))).not.toContain('Save data');
  });

  it('opens a page of three rows and Back, said with what a backup leaves out', async () => {
    const r = rig();
    r.h.game.scenes.push(new OptionsScene(r.h.game, () => {}));
    press(r, 'Save data');
    await flush();
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(labels(r.h.top())).toEqual(['Export backup', 'Import backup', 'Erase all data', 'Back']);
    const said = r.h.said.join(' | ');
    expect(said).toMatch(/Save data\./);
    expect(said).toMatch(/asset packs/i);
  });
});

describe('EXPORT BACKUP', () => {
  it("no packs: one file, no question, delivered inside the press's own event", async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    await openPage(r);
    press(r, 'Export backup');
    await flush();
    expect(r.delivered).toHaveLength(1);
    const files = r.delivered[0] as File[];
    expect(files.map((f) => f.name)).toEqual(['smbc-remix-backup-2026-10-22.json']);
    expect(r.inEvent).toEqual([true]);
    const b = JSON.parse(await (files[0] as File).text());
    expect(b.data[saveKey(1)]).toBe(ls.getItem(saveKey(1)));
    expect(b.gameVersion).toBe(VERSION);
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(r.h.said.at(-1)).toMatch(/backup saved/i);
  });

  it('a gamepad press (no event of its own) still exports, from the frame', async () => {
    const r = rig();
    await openPage(r);
    moveTo(r.h, 'Export backup');
    r.h.tap('jump');
    await flush();
    expect(r.delivered).toHaveLength(1);
  });

  it('packs: asked once, ALSO EXPORT 2 ASSET PACKS?; NO gives the backup alone', async () => {
    const r = rig({ packs: [storedPack('retro'), storedPack('beta')] });
    await openPage(r);
    press(r, 'Export backup');
    expect(titleOf(r.h)).toBe('ALSO EXPORT 2 ASSET PACKS?');
    expect(r.h.said.at(-1)).toMatch(/^Also export 2 asset packs\? No/);
    expect(labels(r.h.top())).toEqual(['No', 'Yes']);
    expect(r.delivered).toHaveLength(0);
    press(r, 'No');
    await flush();
    expect(r.delivered.map((f) => f.map((x) => x.name))).toEqual([['smbc-remix-backup-2026-10-22.json']]);
    expect(titleOf(r.h)).toBe('SAVE DATA');
  });

  it('packs: YES adds each pack as <name>.zip, in the same event; says a backup import leaves packs out', async () => {
    const r = rig({ packs: [storedPack('retro')] });
    await openPage(r);
    press(r, 'Export backup');
    expect(titleOf(r.h)).toBe('ALSO EXPORT 1 ASSET PACK?');
    press(r, 'Yes');
    await flush();
    const names = (r.delivered[0] as File[]).map((f) => f.name);
    expect(names).toEqual(['smbc-remix-backup-2026-10-22.json', 'retro.zip']);
    expect(r.inEvent).toEqual([true]);
    const zip = readZip(new Uint8Array(await (r.delivered[0]![1] as File).arrayBuffer()));
    expect(zip.map((e) => e.path).sort()).toEqual(['manifest.json', 'mario.png']);
    expect(r.h.said.join(' | ')).toMatch(/importing a backup does not restore asset packs/i);
  });

  it('storage that cannot be read: nothing is delivered, and it says why', async () => {
    const r = rig();
    await openPage(r);
    ls.throwOnRead = true;
    press(r, 'Export backup');
    await flush();
    ls.throwOnRead = false;
    expect(r.delivered).toHaveLength(0);
    expect(r.h.said.at(-1)).toMatch(/cannot read/i);
  });
});

/** A File holding `body`, as the chooser hands it over. */
const fileOf = (body: string, name = 'backup.json') => new File([body], name, { type: 'application/json' });

describe('IMPORT BACKUP', () => {
  function backupText(): string {
    const other = installStorage(new FakeStorage());
    adoptDataEpoch();
    other.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), announce: false }));
    writeSave(newSave(2, 'link', null));
    const t = buildBackup({ gameVersion: VERSION, now: new Date() }).text;
    installStorage(ls);
    adoptDataEpoch();
    return t;
  }

  it("the file chooser opens inside the press's own event", async () => {
    const r = rig();
    await openPage(r);
    press(r, 'Import backup');
    expect(r.picks).toHaveLength(1);
    expect(r.inEvent).toEqual([true]);
  });

  for (const [what, body, said] of [
    [
      'a damaged file',
      '{"format":"smbc-remix-backup","formatVersion":1,"gameVersion":"2.4.16","data":{"smbc.settings":"x"},"checksum":"00000000"}',
      /damaged/i,
    ],
    ['a truncated file', '{"format":"smbc-remix-backup","formatVer', /not a backup|not readable/i],
    ["another game's file", '{"game":"Other","save":{}}', /not an smbc remix backup/i],
    ['a newer format', '', /newer/i],
  ] as const) {
    it(`${what}: nothing changes, and the reason is said`, async () => {
      const r = rig();
      writeSave(newSave(1, 'mario', null));
      const before = ls.snapshot();
      await openPage(r);
      press(r, 'Import backup');
      let text = body as string;
      if (!text) {
        const b = JSON.parse(backupText());
        text = JSON.stringify({ ...b, formatVersion: 99 });
      }
      r.picks[0]!(fileOf(text));
      await flush();
      expect(titleOf(r.h)).toBe('SAVE DATA');
      expect(r.h.said.at(-1)).toMatch(said);
      expect(ls.snapshot()).toEqual(before);
      expect(r.restart).not.toHaveBeenCalled();
    });
  }

  it('a good file: REPLACE ALL DATA ON THIS DEVICE? NO keeps everything', async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    const before = ls.snapshot();
    const t = backupText();
    await openPage(r);
    press(r, 'Import backup');
    r.picks[0]!(fileOf(t));
    await flush();
    expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
    expect(labels(r.h.top())).toEqual(['No', 'Yes', 'Export first']);
    expect(r.h.said.at(-1)).toMatch(/^Replace all data on this device\?.* No/);
    press(r, 'No');
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(ls.snapshot()).toEqual(before);
  });

  it("EXPORT FIRST saves this device's backup, in the press's event, and asks again", async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    const mine = ls.getItem(saveKey(1));
    const t = backupText();
    await openPage(r);
    press(r, 'Import backup');
    r.picks[0]!(fileOf(t));
    await flush();
    press(r, 'Export first');
    await flush();
    expect(r.delivered).toHaveLength(1);
    expect(r.inEvent).toEqual([true, true]);
    expect(JSON.parse(await r.delivered[0]![0]!.text()).data[saveKey(1)]).toBe(mine);
    expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
  });

  it('YES replaces everything, says so, and OK starts the game again', async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    const t = backupText();
    await openPage(r);
    press(r, 'Import backup');
    r.picks[0]!(fileOf(t));
    await flush();
    press(r, 'Yes');
    await flush();
    expect(ls.getItem(saveKey(1))).toBeNull();
    expect(ls.getItem(saveKey(2))).toBe(JSON.parse(t).data[saveKey(2)]);
    expect(r.h.said.join(' | ')).toMatch(/backup imported/i);
    expect(r.restart).not.toHaveBeenCalled();
    press(r, 'OK');
    expect(r.restart).toHaveBeenCalledTimes(1);
  });

  it('the quota running out midway: everything put back, the reason said, no restart', async () => {
    const r = rig();
    writeSave(newSave(1, 'mario', null));
    const t = backupText();
    await openPage(r);
    press(r, 'Import backup');
    r.picks[0]!(fileOf(t));
    await flush();
    const before = ls.snapshot();
    ls.writesLeft = 1;
    press(r, 'Yes');
    await flush();
    expect(ls.snapshot()).toEqual(before);
    expect(r.h.said.at(-1)).toMatch(/not enough space/i);
    expect(r.restart).not.toHaveBeenCalled();
    expect(titleOf(r.h)).toBe('SAVE DATA');
  });
});

describe('ERASE ALL DATA', () => {
  function seed() {
    writeSave(newSave(1, 'mario', null));
    ls.setItem('smbc-classic-file-smb-1', '{"v":1}');
    ls.setItem('other-app', 'keep');
  }

  it('two confirms, the first offering a backup first; NO at either keeps everything', async () => {
    const r = rig();
    seed();
    const before = ls.snapshot();
    await openPage(r);
    press(r, 'Erase all data');
    expect(titleOf(r.h)).toBe('ERASE ALL DATA?');
    expect(labels(r.h.top())).toEqual(['No', 'Export backup first', 'Yes']);
    expect(r.h.said.at(-1)).toMatch(/^Erase all data\? .*Export a backup first\?.* No/);
    press(r, 'No');
    expect(titleOf(r.h)).toBe('SAVE DATA');
    press(r, 'Erase all data');
    press(r, 'Yes');
    expect(titleOf(r.h)).toBe('ARE YOU SURE?');
    expect(labels(r.h.top())).toEqual(['No', 'Yes, erase']);
    press(r, 'No');
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(ls.snapshot()).toEqual(before);
  });

  it("EXPORT BACKUP FIRST delivers this device's backup in the press's event, then asks again", async () => {
    const r = rig();
    seed();
    await openPage(r);
    press(r, 'Erase all data');
    press(r, 'Export backup first');
    await flush();
    expect(r.delivered).toHaveLength(1);
    expect(r.inEvent).toEqual([true]);
    expect(titleOf(r.h)).toBe('ERASE ALL DATA?');
  });

  it('no packs: no pack question; every game key goes; OK starts the game again', async () => {
    const r = rig();
    seed();
    await openPage(r);
    press(r, 'Erase all data');
    press(r, 'Yes');
    press(r, 'Yes, erase');
    await flush();
    expect(ls.snapshot(isGameKey)).toEqual({});
    expect(ls.getItem('other-app')).toBe('keep');
    expect(r.clear).not.toHaveBeenCalled();
    expect(r.h.said.join(' | ')).toMatch(/all data erased/i);
    press(r, 'OK');
    expect(r.restart).toHaveBeenCalledTimes(1);
  });

  it('packs: a separate question; NO keeps them', async () => {
    const r = rig({ packs: [storedPack('retro')] });
    seed();
    await openPage(r);
    press(r, 'Erase all data');
    press(r, 'Yes');
    press(r, 'Yes, erase');
    expect(titleOf(r.h)).toBe('ALSO ERASE 1 ASSET PACK?');
    press(r, 'No');
    await flush();
    expect(r.clear).not.toHaveBeenCalled();
    expect(ls.snapshot(isGameKey)).toEqual({});
  });

  it('packs: YES erases them too', async () => {
    const r = rig({ packs: [storedPack('retro'), storedPack('b')] });
    seed();
    await openPage(r);
    press(r, 'Erase all data');
    press(r, 'Yes');
    press(r, 'Yes, erase');
    expect(titleOf(r.h)).toBe('ALSO ERASE 2 ASSET PACKS?');
    press(r, 'Yes');
    await flush();
    expect(r.clear).toHaveBeenCalledTimes(1);
    expect(ls.snapshot(isGameKey)).toEqual({});
  });

  it('a partial IndexedDB failure: the save data goes, the packs stay, and it says so', async () => {
    const r = rig({ packs: [storedPack('retro')], clearFails: true });
    seed();
    await openPage(r);
    press(r, 'Erase all data');
    press(r, 'Yes');
    press(r, 'Yes, erase');
    press(r, 'Yes');
    await flush();
    expect(ls.snapshot(isGameKey)).toEqual({});
    expect(r.h.said.join(' | ')).toMatch(/asset packs could not be erased/i);
  });

  it('storage refusing the erase: nothing goes, the reason is said, no restart', async () => {
    const r = rig();
    seed();
    const before = ls.snapshot();
    await openPage(r);
    press(r, 'Erase all data');
    press(r, 'Yes');
    ls.throwOnWrite = true;
    press(r, 'Yes, erase');
    await flush();
    ls.throwOnWrite = false;
    expect(ls.snapshot()).toEqual(before);
    expect(r.h.said.at(-1)).toMatch(/nothing (was )?erased|nothing changed/i);
    expect(r.restart).not.toHaveBeenCalled();
  });
});

describe('all the new text', () => {
  it('fits its rows and lines (28 columns for a status, 32 for a title)', async () => {
    const r = rig({ packs: [storedPack('retro')] });
    const page = await openPage(r);
    for (const l of labels(page)) expect(l.length).toBeLessThanOrEqual(24);
    press(r, 'Erase all data');
    for (const l of labels(r.h.top())) expect(l.length).toBeLessThanOrEqual(24);
    expect(titleOf(r.h).length).toBeLessThanOrEqual(32);
  });

  it('names no raw button letters', () => {
    const src = text(new TextEncoder().encode(SaveDataOptions.toString()));
    expect(src).not.toMatch(/PRESS [ABXY]\b|\b[ABXY] BUTTON/);
  });
});
