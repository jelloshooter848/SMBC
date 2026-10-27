import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackup, isGameKey } from '@engine/save/backup';
import {
  ONLINE_BACKUP_KEY,
  type BackUpResult,
  type OnlineApi,
  type RestoreResult,
} from '@engine/online/online-backup';
import { defaultSettings, SETTINGS_KEY } from '@engine/save/settings';
import { adoptDataEpoch } from '@engine/save/storage';
import type { ShareEnv } from '@game/save/share-code';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { SaveDataOptions, type SaveDataEnv } from '@game/scenes/save-data';
import { RestoreCodeScene } from '@game/scenes/online-backup';
import { newSave, saveKey, writeSave } from '@game/save/save-files';
import { makeGame, type H } from './heroes-harness';
import { FakeStorage, installStorage } from './save-data-helpers';

/*
 * Item 159 (owner): Options > Save data > BACK UP ONLINE and RESTORE FROM CODE. The first backup
 * shows an explainer (opt-in, NO first); the code is shown once with COPY and SHARE; later backups
 * with the same code just say BACKED UP (N OF 5 SERVERS). A restore goes through the same checks
 * and REPLACE ALL DATA ON THIS DEVICE? as a backup file. Every failure is said and changes
 * nothing; offline, both rows say they need internet; the offline build has neither row. The
 * network side (OnlineApi) is faked: it is the lazily loaded module's job (online-backup-relays).
 */

const VERSION = '2.4.16';
let ls: FakeStorage;
beforeEach(() => {
  ls = installStorage(new FakeStorage());
  adoptDataEpoch();
});

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);
const titleOf = (h: H) => (h.top() as MenuScene).title;
const status = (h: H) => (h.top() as unknown as { status: string }).status;
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

interface Rig {
  h: H;
  api: OnlineApi & { backUps: { code: string; text: string; after?: number | undefined }[]; restores: string[] };
  loads: number;
  online: { value: boolean };
  copied: string[];
  shared: string[];
  restart: ReturnType<typeof vi.fn>;
}

function rig(
  opts: { backUp?: BackUpResult; restore?: RestoreResult; offlineBuild?: boolean; code?: string } = {},
): Rig {
  const backUps: { code: string; text: string; after?: number | undefined }[] = [];
  const restores: string[] = [];
  const api = {
    backUps,
    restores,
    newCode: () => opts.code ?? 'ABCDE12345',
    backUp: async (code: string, text: string, after?: number) => {
      backUps.push({ code, text, after });
      return opts.backUp ?? { ok: true as const, accepted: 5, total: 5, at: 1234 };
    },
    restore: async (code: string) => {
      restores.push(code);
      return opts.restore ?? { ok: false as const, reason: 'not-found' as const };
    },
  };
  const online = { value: true };
  const copied: string[] = [];
  const shared: string[] = [];
  const restart = vi.fn();
  const r = { api, loads: 0, online, copied, shared, restart } as unknown as Rig;
  const env: SaveDataEnv = {
    gameVersion: VERSION,
    now: () => new Date(2026, 9, 27),
    deliver: () => Promise.resolve('downloaded'),
    pickFile: () => {},
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
  const shareEnv: ShareEnv = {
    href: 'https://example.com/',
    copy: async (t) => (copied.push(t), true),
    share: async (d) => void shared.push(d.text ?? ''),
  };
  r.h = makeGame({
    deps: { settings: defaultSettings(), applySettings: () => {}, saveDataEnv: env, shareEnv },
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

const stored = () => JSON.parse(ls.getItem(ONLINE_BACKUP_KEY) ?? 'null');

describe('where the rows are', () => {
  it('under Save data, on the web build', async () => {
    const r = rig();
    await flush();
    expect(labels(r.h.top())).toEqual([
      'Export backup',
      'Import backup',
      'Back up online',
      'Restore from code',
      'Erase all data',
      'Back',
    ]);
  });

  it('not in the offline build (it makes no network requests)', async () => {
    const r = rig({ offlineBuild: true });
    await flush();
    expect(labels(r.h.top())).not.toContain('Back up online');
    expect(labels(r.h.top())).not.toContain('Restore from code');
  });

  it('opening the page loads nothing and contacts nothing', async () => {
    const r = rig();
    await flush();
    expect(r.loads).toBe(0);
  });
});

describe('BACK UP ONLINE', () => {
  it('the first time: an explainer, said, NO first; NO changes nothing and loads nothing', async () => {
    const r = rig();
    press(r, 'Back up online');
    expect(titleOf(r.h)).toBe('BACK UP ONLINE?');
    expect(labels(r.h.top())).toEqual(['No', 'Yes, back up']);
    const said = r.h.said.at(-1) as string;
    expect(said).toMatch(/^Back up online\?/);
    expect(said).toMatch(/encrypted/i);
    expect(said).toMatch(/anonymous/i);
    expect(said).toMatch(/keep a backup file too/i);
    expect(said).toMatch(/ No$/);
    const lines = (r.h.top() as unknown as { lines: string[] }).lines;
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(28);
    press(r, 'No');
    await flush();
    expect(r.loads).toBe(0);
    expect(ls.getItem(ONLINE_BACKUP_KEY)).toBeNull();
    expect(titleOf(r.h)).toBe('SAVE DATA');
  });

  it('YES: backs up under a new code, shows it once with COPY and SHARE, and says it letter by letter', async () => {
    const r = rig({ code: 'ABCDE12345' });
    writeSave(newSave(1, 'mario', null));
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    expect(r.api.backUps).toHaveLength(1);
    expect(r.api.backUps[0]!.code).toBe('ABCDE12345');
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(labels(r.h.top())).toEqual(['Copy code', 'Share code', 'OK']);
    const lines = (r.h.top() as unknown as { lines: string[] }).lines;
    expect(lines).toContain('ABCDE-12345');
    expect(lines).toContain('BACKED UP (5 OF 5 SERVERS)');
    expect(r.h.said.at(-1)).toMatch(/A B C D E, 1 2 3 4 5/);
    press(r, 'Copy code');
    await flush();
    expect(r.copied).toEqual(['ABCDE-12345']);
    press(r, 'Share code');
    await flush();
    expect(r.shared[0]).toContain('ABCDE-12345');
    press(r, 'OK');
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(stored()).toMatchObject({ code: 'ABCDE12345', shown: true });
  });

  it("the online copy is the backup file's text, without dev fields, and carries the code", async () => {
    const r = rig();
    const s = defaultSettings();
    s.dev = true;
    s.devUnlock = 'x';
    ls.setItem(SETTINGS_KEY, JSON.stringify(s));
    ls.setItem('smbc.devLast', '{"level":"1-1"}');
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    const b = JSON.parse(r.api.backUps[0]!.text);
    expect(b.format).toBe('smbc-remix-backup');
    // Item 161: the dev fields are left out (a restore reads them as their defaults).
    expect(JSON.parse(b.data[SETTINGS_KEY]).dev).toBeUndefined();
    expect(JSON.parse(b.data[SETTINGS_KEY]).devUnlock).toBeUndefined();
    expect(b.data['smbc.devLast']).toBeUndefined();
    expect(JSON.parse(b.data[ONLINE_BACKUP_KEY]).code).toBe('ABCDE12345');
    // This device keeps its own dev settings.
    expect(JSON.parse(ls.getItem(SETTINGS_KEY) as string).dev).toBe(true);
  });

  it('again later: the same code, no explainer, no code box, just BACKED UP (N OF 5 SERVERS)', async () => {
    const r = rig({ backUp: { ok: true, accepted: 3, total: 5, at: 1 } });
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ZZZZZ99999', shown: true }));
    press(r, 'Back up online');
    await flush();
    expect(r.api.backUps[0]!.code).toBe('ZZZZZ99999');
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(status(r.h)).toBe('BACKED UP (3 OF 5 SERVERS)');
    expect(r.h.said.at(-1)).toMatch(/^Backed up to 3 of 5 servers/);
  });

  it('BACKING UP... shows and is said at once; a second press meanwhile does nothing', async () => {
    let open!: (v: BackUpResult) => void;
    const r = rig();
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ZZZZZ99999', shown: true }));
    r.api.backUp = () => new Promise((res) => (open = res));
    press(r, 'Back up online');
    expect(status(r.h)).toBe('BACKING UP...');
    expect(r.h.said.at(-1)).toMatch(/^Backing up online/);
    await flush();
    press(r, 'Back up online');
    await flush();
    expect(r.loads).toBe(1);
    open({ ok: true, accepted: 5, total: 5, at: 1 });
    await flush();
    expect(status(r.h)).toBe('BACKED UP (5 OF 5 SERVERS)');
  });

  for (const [what, result, shown, said] of [
    [
      'only 1 of 5 servers took it',
      { ok: false, reason: 'servers', accepted: 1, total: 5 },
      'ONLY 1 OF 5 SERVERS TOOK IT',
      /not safe yet/i,
    ],
    [
      'no server could be reached',
      { ok: false, reason: 'servers', accepted: 0, total: 5 },
      'COULD NOT REACH THE SERVERS',
      /internet/i,
    ],
    [
      'too big for one event',
      { ok: false, reason: 'too-big', accepted: 0, total: 5 },
      'TOO BIG TO BACK UP ONLINE',
      /export backup.*custom levels/i,
    ],
  ] as const) {
    it(`${what}: said, and no code is shown`, async () => {
      const r = rig({ backUp: result as BackUpResult });
      press(r, 'Back up online');
      press(r, 'Yes, back up');
      await flush();
      expect(titleOf(r.h)).toBe('SAVE DATA');
      expect(status(r.h)).toBe(shown);
      expect(r.h.said.at(-1)).toMatch(said);
    });
  }

  it('the online code module failing to load (no connection): said, nothing changed', async () => {
    const r = rig();
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ZZZZZ99999', shown: true }));
    const env = (r.h.game.deps.saveDataEnv as SaveDataEnv).online!;
    env.load = () => Promise.reject(new Error('Failed to fetch dynamically imported module'));
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('COULD NOT REACH THE SERVERS');
  });

  it('offline: says it needs internet, and loads nothing', async () => {
    const r = rig();
    r.online.value = false;
    press(r, 'Back up online');
    await flush();
    expect(status(r.h)).toBe('NEEDS AN INTERNET CONNECTION');
    expect(r.h.said.at(-1)).toMatch(/needs an internet connection/i);
    expect(r.loads).toBe(0);
  });
});

describe('RESTORE FROM CODE', () => {
  function goodText(): string {
    const other = installStorage(new FakeStorage());
    adoptDataEpoch();
    writeSave(newSave(2, 'link', null));
    other.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ABCDE12345', shown: true }));
    const t = buildBackup({ gameVersion: VERSION, now: new Date() }).text;
    installStorage(ls);
    adoptDataEpoch();
    return t;
  }

  it('offline: says it needs internet; no code box', async () => {
    const r = rig();
    r.online.value = false;
    press(r, 'Restore from code');
    expect(r.h.top()).not.toBeInstanceOf(RestoreCodeScene);
    expect(status(r.h)).toBe('NEEDS AN INTERNET CONNECTION');
  });

  it("opens the code box in the press's own event, said; CANCEL changes nothing", async () => {
    const r = rig();
    press(r, 'Restore from code');
    const box = r.h.top() as RestoreCodeScene;
    expect(box).toBeInstanceOf(RestoreCodeScene);
    expect(r.h.said.at(-1)).toMatch(/^Restore from code\. Type your backup code/);
    box.cancel();
    expect(titleOf(r.h)).toBe('SAVE DATA');
    expect(r.loads).toBe(0);
  });

  it('text that is not a code stays in the box with a reason; nothing is looked up', async () => {
    const r = rig();
    press(r, 'Restore from code');
    const box = r.h.top() as RestoreCodeScene;
    expect(box.submit('hello')).toMatch(/not a backup code/i);
    expect(r.h.top()).toBe(box);
    await flush();
    expect(r.api.restores).toEqual([]);
  });

  it('a good code: LOOKING FOR THE BACKUP..., then REPLACE ALL DATA ON THIS DEVICE?; YES replaces all', async () => {
    const t = goodText();
    const r = rig({ restore: { ok: true, text: t, from: 'wss://x' } });
    writeSave(newSave(1, 'mario', null));
    press(r, 'Restore from code');
    expect((r.h.top() as RestoreCodeScene).submit('abcde-12345')).toBeNull();
    expect(status(r.h)).toBe('LOOKING FOR THE BACKUP...');
    await flush();
    expect(r.api.restores).toEqual(['ABCDE12345']);
    expect(titleOf(r.h)).toBe('REPLACE ALL DATA ON THIS DEVICE?');
    press(r, 'Yes');
    await flush();
    expect(ls.getItem(saveKey(1))).toBeNull();
    expect(ls.getItem(saveKey(2))).toBe(JSON.parse(t).data[saveKey(2)]);
    expect(stored()).toMatchObject({ code: 'ABCDE12345' });
    press(r, 'OK');
    expect(r.restart).toHaveBeenCalledTimes(1);
  });

  it('NO at the question keeps everything', async () => {
    const r = rig({ restore: { ok: true, text: goodText(), from: 'wss://x' } });
    writeSave(newSave(1, 'mario', null));
    const before = ls.snapshot(isGameKey);
    press(r, 'Restore from code');
    (r.h.top() as RestoreCodeScene).submit('ABCDE12345');
    await flush();
    press(r, 'No');
    expect(ls.snapshot(isGameKey)).toEqual(before);
  });

  for (const [what, result, shown, said] of [
    [
      'no backup for the code',
      { ok: false, reason: 'not-found' },
      'NO BACKUP FOR THAT CODE',
      /check the code/i,
    ],
    [
      'the servers cannot be reached',
      { ok: false, reason: 'servers' },
      'COULD NOT REACH THE SERVERS',
      /internet/i,
    ],
    [
      'a damaged copy',
      { ok: true, text: '{"format":"smbc-remix-backup"', from: 'x' },
      'FILE NOT READABLE',
      /nothing changed/i,
    ],
    [
      'a copy from a newer game',
      { ok: true, text: 'NEWER', from: 'x' },
      'BACKUP FROM A NEWER GAME',
      /newer version/i,
    ],
  ] as const) {
    it(`${what}: said, nothing changed`, async () => {
      let res = result as RestoreResult;
      if (res.ok && res.text === 'NEWER') {
        const b = JSON.parse(goodText());
        res = { ...res, text: JSON.stringify({ ...b, gameVersion: '9.0.0' }) };
      }
      const r = rig({ restore: res });
      writeSave(newSave(1, 'mario', null));
      const before = ls.snapshot();
      press(r, 'Restore from code');
      (r.h.top() as RestoreCodeScene).submit('ABCDE12345');
      await flush();
      expect(titleOf(r.h)).toBe('SAVE DATA');
      expect(status(r.h)).toBe(shown);
      expect(r.h.said.at(-1)).toMatch(said);
      expect(ls.snapshot()).toEqual(before);
    });
  }
});

describe('v0.4.76 fix round', () => {
  it('item 162: SHOW MY CODE only once a code exists; it shows it with COPY and SHARE, said letter by letter', async () => {
    const none = rig();
    expect(labels(none.h.top())).not.toContain('Show my code');
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ZZZZZ99999', shown: true }));
    const r = rig();
    expect(labels(r.h.top())).toContain('Show my code');
    press(r, 'Show my code');
    expect(titleOf(r.h)).toBe('YOUR BACKUP CODE');
    expect(labels(r.h.top())).toEqual(['Copy code', 'Share code', 'OK']);
    expect((r.h.top() as unknown as { lines: string[] }).lines).toContain('ZZZZZ-99999');
    expect(r.h.said.at(-1)).toMatch(/Z Z Z Z Z, 9 9 9 9 9/);
    const items = (r.h.top() as unknown as { items: MenuItem[] }).items;
    expect(items[0]?.gesture).toBe(true);
    expect(items[1]?.gesture).toBe(true);
    press(r, 'Copy code');
    await flush();
    expect(r.copied).toEqual(['ZZZZZ-99999']);
    expect(r.loads).toBe(0);
  });

  it('item 162: the row appears after the first backup', async () => {
    const r = rig();
    press(r, 'Back up online');
    press(r, 'Yes, back up');
    await flush();
    press(r, 'OK');
    expect(labels(r.h.top())).toContain('Show my code');
  });

  it('the last backup time is kept with the code and handed to the next backup (a clock behind)', async () => {
    const r = rig({ backUp: { ok: true, accepted: 5, total: 5, at: 7777 } });
    ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ZZZZZ99999', shown: true }));
    press(r, 'Back up online');
    await flush();
    expect(stored()).toMatchObject({ code: 'ZZZZZ99999', lastAt: 7777 });
    press(r, 'Back up online');
    await flush();
    expect(r.api.backUps[1]!.after).toBe(7777);
  });

  it('a restored or imported copy shows its code again on this device (shown reset)', async () => {
    const other = installStorage(new FakeStorage());
    adoptDataEpoch();
    other.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ABCDE12345', shown: true, lastAt: 50 }));
    const t = buildBackup({ gameVersion: VERSION, now: new Date() }).text;
    installStorage(ls);
    adoptDataEpoch();
    const r = rig({ restore: { ok: true, text: t, from: 'x' } });
    press(r, 'Restore from code');
    (r.h.top() as RestoreCodeScene).submit('ABCDE12345');
    await flush();
    press(r, 'Yes');
    await flush();
    expect(stored()).toEqual({ code: 'ABCDE12345', shown: false, lastAt: 50 });
  });

  for (const [what, result, shown, said] of [
    [
      'the servers refused it',
      { ok: false, reason: 'refused', accepted: 0, total: 5 },
      'SERVERS REFUSED THE BACKUP',
      /refused/i,
    ],
    [
      'a newer backup is online',
      { ok: false, reason: 'newer', accepted: 0, total: 5 },
      'A NEWER BACKUP IS ONLINE',
      /newer backup/i,
    ],
  ] as const) {
    it(`${what}: its own line, said`, async () => {
      const r = rig({ backUp: result as BackUpResult });
      ls.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ code: 'ZZZZZ99999', shown: true }));
      press(r, 'Back up online');
      await flush();
      expect(status(r.h)).toBe(shown);
      expect(r.h.said.at(-1)).toMatch(said);
      expect(r.h.said.at(-1)).not.toMatch(/could not reach/i);
    });
  }
});
