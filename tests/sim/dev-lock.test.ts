import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { TitleScene } from '@game/scenes/title';
import { DEV_CODE } from '@game/scenes/cheat';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { PassphraseScene, passphraseCells } from '@game/scenes/passphrase';
import { CHARACTERS } from '@game/characters/registry';
import {
  devLockFor,
  enforceDevLock,
  hashPassphrase,
  passphraseOpens,
  urlDevAllowed,
  type DevLock,
} from '@game/dev-lock';
import { urlLevelStart } from '@game/dev-url';

// The dev-mode lock (0.5.0, owner): release builds open dev mode only with the owner's passphrase,
// whose salted hash alone reaches the build. Local and test builds stay open.

const PASS = 'OPEN-SESAME-42';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame(devLock?: DevLock) {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const settings: Settings = defaultSettings();
  const applySettings = vi.fn();
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings,
    applySettings,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    ...(devLock ? { devLock } : {}),
  });
  const p1 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    game.scenes.update([p1]);
    game.scenes.render(r);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  return { game, said, settings, step, tap, idle, top: () => game.scenes.top, applySettings };
}
type H = ReturnType<typeof makeGame>;

/** The finished title, then the developer code. */
function enterCode(h: H): void {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  for (const a of DEV_CODE) h.tap(a);
}

/** Types `text` on the prompt with the d-pad's cursor and OK, then DONE (MENU), and waits for the check. */
async function typeAndCheck(h: H, text: string): Promise<void> {
  const p = h.top() as PassphraseScene;
  h.idle(CARD_GUARD_FRAMES + 1);
  const cells = passphraseCells();
  for (const ch of text) {
    p.index = cells.findIndex((c) => c.key === ch);
    h.tap('jump');
  }
  h.tap('start');
  for (let i = 0; i < 20 && p.checking; i++) await new Promise((r) => setTimeout(r, 5));
}

describe('the lock for a build', () => {
  it('open unless a release; a release with a hash is locked, without one closed', async () => {
    const hash = await hashPassphrase(PASS);
    expect(devLockFor(false, '')).toEqual({ mode: 'open', hash: '' });
    expect(devLockFor(false, hash).mode).toBe('open');
    expect(devLockFor(true, hash)).toEqual({ mode: 'locked', hash });
    expect(devLockFor(true, '')).toEqual({ mode: 'closed', hash: '' });
    expect(devLockFor(true, 'not-a-hash').mode).toBe('closed');
  });

  it("the hash is the salted SHA-256 in capitals, the same as the release workflow's script", async () => {
    const hash = await hashPassphrase(PASS);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassphrase(' open-sesame-42 ')).toBe(hash);
    const out = execFileSync(process.execPath, ['tools/release/dev-lock-hash.mjs'], {
      env: { ...process.env, DEV_MODE_PASSPHRASE: PASS },
    }).toString();
    expect(out).toBe(`DEV_MODE_HASH=${hash}\n`);
    expect(out).not.toContain(PASS);
  });

  it('the workflow script prints nothing without the secret (the build then has no dev mode)', () => {
    const out = execFileSync(process.execPath, ['tools/release/dev-lock-hash.mjs'], {
      env: { ...process.env, DEV_MODE_PASSPHRASE: '' },
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    expect(out).toBe('');
  });

  it('the workflow script refuses a secret the prompt cannot type (exit 1, never echoing it)', async () => {
    const run = (secret: string) => {
      const r = spawnSync(process.execPath, ['tools/release/dev-lock-hash.mjs'], {
        env: { ...process.env, DEV_MODE_PASSPHRASE: secret },
      });
      return { code: r.status, out: r.stdout.toString(), err: r.stderr.toString() };
    };
    // Valid: 8 to 32 of A-Z, 0-9 and '-', any case (upper-cased before hashing).
    for (const ok of ['abcd-123', 'Open-Sesame-42', 'A'.repeat(32)]) {
      const r = run(ok);
      expect(r.code, ok).toBe(0);
      expect(r.out).toBe(`DEV_MODE_HASH=${await hashPassphrase(ok)}\n`);
      expect(r.out + r.err).not.toContain(ok);
    }
    const bad = {
      'too short': 'ABC-123',
      'too long': 'A'.repeat(33),
      'a space': 'OPEN SESAME',
      'an underscore': 'OPEN_SESAME',
    };
    for (const [why, secret] of Object.entries(bad)) {
      const r = run(secret);
      expect(r.code, why).toBe(1);
      expect(r.out, why).toBe('');
      expect(r.err, why).toMatch(/8 to 32 characters of A-Z, 0-9 and "-"/);
      expect(r.err, why).not.toContain(secret);
    }
  });

  it('only the right entry opens a locked build; nothing opens an open or closed one', async () => {
    const lock = devLockFor(true, await hashPassphrase(PASS));
    expect(await passphraseOpens(lock, PASS)).toBe(true);
    expect(await passphraseOpens(lock, 'open-sesame-42')).toBe(true);
    expect(await passphraseOpens(lock, 'OPEN-SESAME-43')).toBe(false);
    expect(await passphraseOpens(lock, '')).toBe(false);
    expect(await passphraseOpens(devLockFor(true, ''), PASS)).toBe(false);
  });

  it('?dev= is honoured only on an open build', async () => {
    expect(urlDevAllowed(devLockFor(false, ''))).toBe(true);
    expect(urlDevAllowed(devLockFor(true, await hashPassphrase(PASS)))).toBe(false);
    expect(urlDevAllowed(devLockFor(true, ''))).toBe(false);
  });

  it('an old dev flag is cleared on a release build, until its own passphrase opens it', async () => {
    const hash = await hashPassphrase(PASS);
    const locked = devLockFor(true, hash);
    const old = { dev: true, devUnlock: '' };
    expect(enforceDevLock(locked, old)).toBe(true);
    expect(old.dev).toBe(false);
    const opened = { dev: true, devUnlock: hash };
    expect(enforceDevLock(locked, opened)).toBe(false);
    expect(opened.dev).toBe(true);
    const closed = { dev: true, devUnlock: hash };
    expect(enforceDevLock(devLockFor(true, ''), closed)).toBe(true);
    expect(closed.dev).toBe(false);
    const local = { dev: true, devUnlock: '' };
    expect(enforceDevLock(devLockFor(false, ''), local)).toBe(false);
    expect(local.dev).toBe(true);
  });
});

describe('the title on a release build', () => {
  it('locked: the code opens the passphrase prompt (announced); the right entry turns dev mode on', async () => {
    const hash = await hashPassphrase(PASS);
    const h = makeGame(devLockFor(true, hash));
    enterCode(h);
    expect(h.top()).toBeInstanceOf(PassphraseScene);
    expect(h.settings.dev).toBe(false);
    expect(h.said.at(-1)).toMatch(/^Developer mode\. Enter the passphrase\./);
    await typeAndCheck(h, PASS);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.settings.dev).toBe(true);
    expect(h.settings.devUnlock).toBe(hash);
    expect(h.applySettings).toHaveBeenCalled();
    expect(h.said.at(-1)).toBe('Developer mode unlocked.');
    // The entry is never said aloud: only counts.
    expect(h.said.join(' ')).not.toContain(PASS);
    expect(h.said).toContain(`${PASS.length} typed.`);
  });

  it('locked: a wrong entry says "Wrong passphrase" and changes nothing', async () => {
    const h = makeGame(devLockFor(true, await hashPassphrase(PASS)));
    enterCode(h);
    await typeAndCheck(h, 'GUESS');
    expect(h.top()).toBeInstanceOf(PassphraseScene);
    expect((h.top() as PassphraseScene).wrong).toBe(true);
    expect(h.said.at(-1)).toBe('Wrong passphrase.');
    expect(h.settings.dev).toBe(false);
    expect(h.settings.devUnlock).toBe('');
  });

  it('locked: BACK with nothing typed closes the prompt, back to the title', async () => {
    const h = makeGame(devLockFor(true, await hashPassphrase(PASS)));
    enterCode(h);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.settings.dev).toBe(false);
  });

  it('closed (no secret): the code does nothing at all, and the title has no Dev mode row', () => {
    const h = makeGame(devLockFor(true, ''));
    const said = h.said.length;
    enterCode(h);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.settings.dev).toBe(false);
    expect(h.said.slice(said).join(' ')).not.toMatch(/Developer|passphrase/i);
    const rows = (h.top() as unknown as { items: { label: string }[] }).items.map((i) => i.label);
    expect(rows).not.toContain('Dev mode');
  });

  it('a dev build is open: the code turns dev mode on at once, with no prompt', () => {
    const h = makeGame();
    enterCode(h);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.settings.dev).toBe(true);
    expect(h.said.at(-1)).toBe('Developer mode unlocked.');
  });

  it('the prompt takes a 32-character entry (the longest the secret may be) and opens with it', async () => {
    const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012-34';
    expect(long).toHaveLength(32);
    const hash = await hashPassphrase(long);
    const h = makeGame(devLockFor(true, hash));
    enterCode(h);
    await typeAndCheck(h, long);
    expect(h.settings.dev).toBe(true);
    expect(h.settings.devUnlock).toBe(hash);
  });

  it('the prompt works by touch: no buttons during the guard, then OK, DELETE / BACK and DONE; a tap on a letter types it', async () => {
    const h = makeGame(devLockFor(true, await hashPassphrase(PASS)));
    enterCode(h);
    const p = h.top() as PassphraseScene;
    expect(p.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
    h.idle(CARD_GUARD_FRAMES + 1);
    expect(p.touchLabels()).toMatchObject({ jump: 'OK', attack: 'BACK', start: 'DONE' });
    const a = passphraseCells().find((c) => c.key === 'A');
    expect(p.tapAt((a?.x ?? 0) + 2, (a?.y ?? 0) + 2)).toBe(true);
    expect(p.length).toBe(1);
    expect(p.touchLabels().attack).toBe('DELETE');
  });
});

describe('?level= links outside dev mode (0.5.0): no campaign content', () => {
  const start = (q: string, dev = false) => urlLevelStart(new URLSearchParams(q), dev);
  it('SMB and Lost Levels levels start a Classic run; custom levels play as before', () => {
    expect(start('level=1-1&char=link')).toBe('classic');
    expect(start('level=8-4')).toBe('classic');
    expect(start('level=ll-1-1')).toBe('classic');
    expect(start('level=ll-13-4')).toBe('classic');
    expect(start('level=custom-mine')).toBe('free');
  });

  it("the campaign's own levels open the title instead", () => {
    expect(start('level=1-0')).toBeNull();
    expect(start('level=kakariko')).toBeNull();
    expect(start('level=link-stage')).toBeNull();
    expect(start('level=9-9')).toBeNull();
    expect(start('char=link')).toBeNull();
  });

  it('with dev mode on, as before: free play, or a Classic run with mode=classic', () => {
    expect(start('level=1-0', true)).toBe('free');
    expect(start('level=1-1&mode=classic', true)).toBe('classic');
  });
});
