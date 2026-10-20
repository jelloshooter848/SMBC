import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { defaultSettings } from '@engine/save/settings';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { TitleScene } from '@game/scenes/title';
import { FileSelectScene } from '@game/scenes/file-select';
import { BackupCardScene } from '@game/scenes/backup-card';
import { FileCodeScene, LoadCodeScene, PasteCodeScene, SaveFilesOptions } from '@game/scenes/save-codes';
import { OptionsScene } from '@game/scenes/options';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { loadSave, newSave, writeSave, type SaveFile, type SaveSlot } from '@game/save/save-files';
import { CODE_TYPO, encodeSaveCode, saveLink, shareText } from '@game/save/save-code';
import type { ShareEnv } from '@game/save/share-code';
import type { MenuItem } from '@game/scenes/menu';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { bindGestureKeys } from '@engine/input/gesture';
import { ALL_STORY } from './story-seen';

// Portable save codes (0.4.44, docs/SAVE_CODES.md) in play: a resume link's question at the
// title (never replacing a file without YES; the link leaves the address once answered), the
// "BACK UP YOUR GAME?" card after a castle's first clear (once per castle, off with the option),
// and Options > Save files' SHARE / COPY / PASTE.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function fakeEnv(opts: { share?: boolean; copy?: boolean } = {}) {
  const shared: string[] = [];
  const copied: string[] = [];
  const env: ShareEnv = {
    href: 'https://example.com/SMBC/',
    copy: async (t) => {
      copied.push(t);
      return opts.copy !== false;
    },
  };
  if (opts.share) env.share = async (d) => void shared.push(d.text ?? '');
  return { env, shared, copied };
}

function makeGame(env: ShareEnv = fakeEnv().env, reminders = true) {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const settings = defaultSettings();
  settings.backupReminders = reminders;
  const clearSaveLink = vi.fn();
  const game = new Game({
    ctx: {
      assets,
      audio: { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn() },
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    settings,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    shareEnv: env,
    clearSaveLink,
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
  const until = (pred: () => boolean, max = 3000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  return { game, said, step, tap, idle, until, top, clearSaveLink, settings };
}
type H = ReturnType<typeof makeGame>;

/** A stored file in `slot` (every story beat seen: these tests are about the codes). */
function file(over: Partial<SaveFile> = {}, slot: SaveSlot = 1): SaveFile {
  writeSave({ ...newSave(slot, MARIO.id), story: [...ALL_STORY], ...over });
  return loadSave(slot) as SaveFile;
}

const worldFive = (slot: SaveSlot) =>
  file(
    {
      cleared: [
        '1-0',
        '1-1',
        '1-2',
        '1-3',
        '1-4',
        '2-1',
        '2-2',
        '2-3',
        '2-4',
        '3-1',
        '3-2',
        '3-3',
        '3-4',
        '4-1',
        '4-2',
        '4-3',
        '4-4',
      ],
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4', 'smb-5'],
      freed: ['mario', 'luigi', 'link', 'megaman', 'samus'],
      position: { page: 'smb-5', node: 'start' },
    },
    slot,
  );

const stored = () => new Map(store);

// ------------------------------------------------------------------ resume links

describe('a resume link (#save=) at the title', () => {
  /** The title with a link's code waiting, up to the question. */
  function openLink(h: H, code: string) {
    h.settings.dev = true; // 0.5.0 (G-101): resume links load in dev mode until Chapter 1 ships
    h.game.saveLink = code;
    h.game.showTitle();
    h.until(() => h.top() instanceof LoadCodeScene);
    h.idle(20);
    return h.top() as LoadCodeScene;
  }

  it('asks after the title, names the save, and shows what each file holds', () => {
    const h = makeGame();
    const code = encodeSaveCode(worldFive(3));
    store.clear();
    file({ cleared: ['1-0', '1-1'] }, 1);
    const q = openLink(h, code);
    expect(q.mode).toBe('pick');
    expect(h.said.some((t) => /Load this save\? WORLD 5, 5 HEROES\. Into which file\?/.test(t))).toBe(true);
    expect(q.saves[0]).not.toBeNull();
    expect(q.saves[1]).toBeNull();
    expect(h.game.scenes.find((s) => s instanceof TitleScene)).toBeDefined();
  });

  it('Cancel (or NO, then Cancel) leaves every file untouched, and the link is cleared', () => {
    const h = makeGame();
    const code = encodeSaveCode(worldFive(2));
    store.clear();
    file({ cleared: ['1-0', '1-1'] }, 1);
    const before = stored();
    const q = openLink(h, code);
    h.tap('jump'); // file 1 → the question, NO highlighted
    expect(q.mode).toBe('confirm');
    h.idle(20);
    expect(q.yes).toBe(false);
    expect(h.said.some((t) => /File 1 has WORLD 1, 1 HERO\. It will be replaced\. No\./.test(t))).toBe(true);
    h.tap('jump'); // NO
    expect(q.mode).toBe('pick');
    h.idle(20);
    expect(stored()).toEqual(before);
    expect(h.clearSaveLink).not.toHaveBeenCalled();
    h.tap('attack'); // back: cancelled
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(stored()).toEqual(before);
    expect(h.clearSaveLink).toHaveBeenCalledTimes(1);
    expect(h.game.saveLink).toBeNull();
    h.idle(60);
    expect(h.top()).toBeInstanceOf(TitleScene); // never asked again
  });

  it('YES loads it into the file picked (replacing it), then the file select opens on it', () => {
    const h = makeGame();
    const save = worldFive(2);
    const code = encodeSaveCode(save);
    store.clear();
    file({ cleared: ['1-0', '1-1'] }, 1);
    const q = openLink(h, code);
    h.tap('jump');
    h.idle(20);
    h.tap('right'); // YES
    expect(q.yes).toBe(true);
    expect(loadSave(1)?.cleared).toEqual(['1-0', '1-1']); // nothing written yet
    h.tap('jump');
    expect(loadSave(1)?.pages).toEqual(save.pages);
    expect(loadSave(1)?.freed).toEqual(save.freed);
    expect(loadSave(1)?.slot).toBe(1);
    expect(q.mode).toBe('message');
    h.idle(20);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(FileSelectScene);
    expect((h.top() as FileSelectScene).index).toBe(0);
    expect(h.clearSaveLink).toHaveBeenCalledTimes(1);
  });

  it('an empty file still asks YES / NO before the code goes in', () => {
    const h = makeGame();
    const code = encodeSaveCode(worldFive(1));
    store.clear();
    const q = openLink(h, code);
    h.tap('down'); // file 2
    h.tap('jump');
    expect(q.mode).toBe('confirm');
    expect(loadSave(2)).toBeNull();
    h.idle(20);
    h.tap('right');
    h.tap('jump');
    expect(loadSave(2)?.pages).toContain('smb-5');
    expect(loadSave(1)).toBeNull();
  });

  it("a typo says THAT CODE DOESN'T LOOK RIGHT, writes nothing, and clears the link", () => {
    const h = makeGame();
    const code = encodeSaveCode(worldFive(1));
    store.clear();
    const broken = code.slice(0, 7) + (code[7] === 'Q' ? 'R' : 'Q') + code.slice(8);
    const q = openLink(h, broken);
    expect(q.mode).toBe('message');
    expect(q.lines.join(' ')).toBe(CODE_TYPO);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(store.size).toBe(0);
    expect(h.clearSaveLink).toHaveBeenCalledTimes(1);
  });

  it('a whole share message as the link still loads (the code is found in it)', () => {
    const h = makeGame();
    const save = worldFive(1);
    store.clear();
    const msg = shareText(save, saveLink(encodeSaveCode(save), 'https://example.com/SMBC/'));
    const q = openLink(h, msg);
    expect(q.mode).toBe('pick');
  });
});

// ------------------------------------------------------------------ the backup card

describe('"BACK UP YOUR GAME?" after a castle', () => {
  /** Clear 1-4 from the map (Luigi freed, so World 1's gate opens). */
  function clearCastle(h: H) {
    h.game.enterLevelFromMap('1-4');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    (h.top() as LevelScene).world.events.push({ type: 'exit', next: '2-1' });
    h.step();
  }

  const castleFile = () =>
    file({
      cleared: ['1-0', '1-1', '1-2', '1-3'],
      freed: ['mario', 'luigi'],
      position: { page: 'smb-1', node: '1-4' },
    });

  it("comes once the map is the player's after the first clear, waits for a press, and is read out", () => {
    const h = makeGame();
    h.game.openFile(1, castleFile());
    clearCastle(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    h.until(() => h.top() instanceof BackupCardScene);
    expect(h.said.some((t) => t.startsWith('Back up your game?'))).toBe(true);
    const card = h.top() as BackupCardScene;
    h.idle(300);
    expect(h.top()).toBe(card); // never goes on by itself
    h.tap('down');
    h.tap('down'); // NOT NOW
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(loadSave(1)?.cleared).toContain('1-4');
  });

  it('never again for that castle', () => {
    const h = makeGame();
    h.game.openFile(1, castleFile());
    clearCastle(h);
    h.until(() => h.top() instanceof BackupCardScene);
    h.idle(40);
    h.tap('attack'); // NOT NOW
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    // Back to 1-4 and clear it again: no card.
    h.game.openFile(1, loadSave(1) as SaveFile);
    h.game.mapProgress.position = { page: 'smb-1', node: '1-4' };
    clearCastle(h);
    h.until(() => h.top() instanceof WorldMapScene && (h.top() as WorldMapScene).mode === 'idle');
    h.idle(120);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });

  it('a level that is not a castle brings no card', () => {
    const h = makeGame();
    h.game.openFile(1, file({ cleared: ['1-0'], position: { page: 'smb-1', node: '1-1' } }));
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    (h.top() as LevelScene).world.events.push({ type: 'exit', next: '1-2' });
    h.step();
    h.until(() => h.top() instanceof WorldMapScene && (h.top() as WorldMapScene).mode === 'idle');
    h.idle(120);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });

  it('is off while Options > Save files > Backup reminders is off', () => {
    const h = makeGame(fakeEnv().env, false);
    h.game.openFile(1, castleFile());
    clearCastle(h);
    h.until(() => h.top() instanceof WorldMapScene && (h.top() as WorldMapScene).mode === 'idle');
    h.idle(120);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.backupDue).toBeNull();
  });

  it('SHARE SAVE without a share sheet copies the resume link and says so; COPY CODE copies the code', async () => {
    const f = fakeEnv();
    const h = makeGame(f.env);
    h.game.openFile(1, castleFile());
    clearCastle(h);
    h.until(() => h.top() instanceof BackupCardScene);
    const card = h.top() as BackupCardScene;
    h.idle(40);
    h.tap('jump'); // SHARE SAVE
    await vi.waitFor(() => expect(card.status).toBe('NO SHARE SHEET: LINK COPIED'));
    const code = encodeSaveCode(loadSave(1) as SaveFile);
    expect(f.copied[0]).toBe(`https://example.com/SMBC/#save=${code}`);
    expect(card.done).toBe(true);
    card.index = 1;
    h.tap('jump'); // COPY CODE
    await vi.waitFor(() => expect(h.said).toContain('CODE COPIED. Done.'));
    expect(f.copied[1]).toBe(code);
  });

  it('a share sheet that never answers does not hold the card: NOT NOW still closes it', () => {
    const env: ShareEnv = { href: 'https://example.com/SMBC/', share: () => new Promise<void>(() => {}) };
    const h = makeGame(env);
    h.game.openFile(1, castleFile());
    clearCastle(h);
    h.until(() => h.top() instanceof BackupCardScene);
    const card = h.top() as BackupCardScene;
    h.idle(40);
    h.tap('jump'); // SHARE SAVE: the sheet is up, and stays up
    h.idle(10);
    expect(card.status).toBe('SHARING...');
    h.tap('attack'); // NOT NOW
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });

  it('SHARE SAVE with a share sheet sends the summary line and the link', async () => {
    const f = fakeEnv({ share: true });
    const h = makeGame(f.env);
    h.game.openFile(1, castleFile());
    clearCastle(h);
    h.until(() => h.top() instanceof BackupCardScene);
    const card = h.top() as BackupCardScene;
    h.idle(40);
    h.tap('jump');
    await vi.waitFor(() => expect(card.status).toBe('SAVE SHARED'));
    expect(f.shared[0]).toMatch(
      /^My SMBC REMIX save \(World 2, 2 heroes\): https:\/\/example\.com\/SMBC\/#save=[0-9A-Z-]+$/,
    );
  });
});

// ------------------------------------------------------------------ Options > Save files

function item(scene: unknown, label: string): MenuItem {
  const it = (scene as { items: MenuItem[] }).items.find((i) => i.label === label);
  expect(it, label).toBeDefined();
  return it as MenuItem;
}

describe('Options > Save files', () => {
  it('lists the files with their summary, and turns backup reminders off and on', () => {
    const h = makeGame();
    worldFive(2);
    h.game.showTitle();
    const opts = new OptionsScene(h.game, () => h.game.scenes.pop());
    h.game.scenes.push(opts);
    item(opts, 'Save files').select?.();
    const menu = h.top() as SaveFilesOptions;
    expect(menu).toBeInstanceOf(SaveFilesOptions);
    expect(item(menu, 'File 1').value?.()).toBe('EMPTY');
    expect(item(menu, 'File 2').value?.()).toBe('WORLD 5, 5 HEROES');
    item(menu, 'Backup reminders').adjust?.(1);
    expect(h.settings.backupReminders).toBe(false);
    expect(item(menu, 'Backup reminders').value?.()).toBe('Off');
    item(menu, 'Backup reminders').adjust?.(1);
    expect(h.settings.backupReminders).toBe(true);
  });

  it('a file shows its code; PASTE CODE takes a pasted message, asks, and only YES replaces the file', () => {
    const h = makeGame();
    const other = worldFive(3);
    const code = encodeSaveCode(other);
    file({ cleared: ['1-0', '1-1'] }, 1);
    h.game.showTitle();
    const files = new SaveFilesOptions(h.game, () => h.game.scenes.pop());
    h.game.scenes.push(files);
    item(files, 'File 1').select?.();
    const fileScene = h.top() as FileCodeScene;
    expect(fileScene.code).toBe(encodeSaveCode(loadSave(1) as SaveFile));
    item(fileScene, 'Paste code').select?.();
    const paste = h.top() as PasteCodeScene;
    expect(paste).toBeInstanceOf(PasteCodeScene);
    expect(paste.submit('hello there')).toBe(CODE_TYPO);
    expect(paste.submit(`yo here's my save ${code.toLowerCase()} cheers`)).toBeNull();
    const q = h.top() as LoadCodeScene;
    expect(q).toBeInstanceOf(LoadCodeScene);
    h.idle(20);
    expect(q.mode).toBe('confirm');
    h.tap('jump'); // NO
    expect(h.top()).toBe(fileScene);
    expect(loadSave(1)?.cleared).toEqual(['1-0', '1-1']);
    item(fileScene, 'Paste code').select?.();
    (h.top() as PasteCodeScene).submit(code);
    h.idle(20);
    h.tap('left');
    h.tap('jump'); // YES
    h.idle(20);
    h.tap('jump');
    expect(h.top()).toBe(fileScene);
    expect(loadSave(1)?.pages).toEqual(other.pages);
    expect(fileScene.code).toBe(encodeSaveCode(loadSave(1) as SaveFile));
    expect(fileScene.code).toBe(code);
  });

  it("PASTE CODE on the Save files list itself (the Home Screen note's path) asks which file, and only YES writes", () => {
    const h = makeGame();
    const other = worldFive(3);
    const code = encodeSaveCode(other);
    store.delete('smbc.save.3');
    file({ cleared: ['1-0', '1-1'] }, 1);
    h.game.showTitle();
    const files = new SaveFilesOptions(h.game, () => h.game.scenes.pop());
    h.game.scenes.push(files);
    const labels = (files as unknown as { items: MenuItem[] }).items.map((i) => i.label);
    expect(labels.indexOf('Paste code')).toBe(labels.indexOf('File 3') + 1);
    item(files, 'Paste code').select?.();
    const paste = h.top() as PasteCodeScene;
    expect(paste).toBeInstanceOf(PasteCodeScene);
    expect(paste.slot).toBeUndefined();
    expect(paste.submit(code)).toBeNull();
    const q = h.top() as LoadCodeScene;
    expect(q).toBeInstanceOf(LoadCodeScene);
    h.idle(20);
    expect(q.mode).toBe('pick');
    h.tap('jump'); // file 1: used, so it names what it replaces
    expect(q.mode).toBe('confirm');
    expect(h.said.at(-1)).toMatch(/File 1 has WORLD 1, 1 HERO\. It will be replaced/);
    h.idle(20);
    h.tap('jump'); // NO: back to the files
    expect(q.mode).toBe('pick');
    expect(loadSave(1)?.cleared).toEqual(['1-0', '1-1']);
    h.idle(20);
    h.tap('down');
    h.tap('jump'); // file 2 (empty)
    h.idle(20);
    h.tap('left');
    h.tap('jump'); // YES
    h.idle(20);
    h.tap('jump');
    expect(h.top()).toBe(files);
    expect(loadSave(2)?.pages).toEqual(other.pages);
    expect(loadSave(1)?.cleared).toEqual(['1-0', '1-1']);
    expect(item(files, 'File 2').value?.()).toBe('WORLD 5, 5 HEROES');
  });

  it("over a game, the list's PASTE CODE is only offered from the title", () => {
    const h = makeGame();
    const files = new SaveFilesOptions(h.game, () => h.game.scenes.pop(), true);
    h.game.scenes.push(files);
    item(files, 'Paste code').select?.();
    expect(h.top()).toBe(files);
    expect(h.said).toContain('PASTE CODES FROM THE TITLE');
  });

  it('B cancels PASTE CODE without touching the file', () => {
    const h = makeGame();
    file({ cleared: ['1-0', '1-1'] }, 1);
    const before = stored();
    h.game.showTitle();
    const fileScene = new FileCodeScene(h.game, 1, () => h.game.scenes.pop());
    h.game.scenes.push(fileScene);
    fileScene.paste();
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBe(fileScene);
    expect(stored()).toEqual(before);
  });

  it('over a game (the pause menu), PASTE CODE is only offered from the title; SHARE works', async () => {
    const f = fakeEnv({ share: true });
    const h = makeGame(f.env);
    file({ cleared: ['1-0', '1-1'] }, 1);
    const fileScene = new FileCodeScene(h.game, 1, () => h.game.scenes.pop(), true);
    h.game.scenes.push(fileScene);
    fileScene.paste();
    expect(h.top()).toBe(fileScene);
    expect(h.said).toContain('PASTE CODES FROM THE TITLE');
    await fileScene.share();
    expect(f.shared).toHaveLength(1);
    expect(h.said).toContain('SAVE SHARED');
  });

  it('an empty file has nothing to share or copy', async () => {
    const f = fakeEnv();
    const h = makeGame(f.env);
    const fileScene = new FileCodeScene(h.game, 2, () => h.game.scenes.pop());
    h.game.scenes.push(fileScene);
    await fileScene.share();
    await fileScene.copy();
    expect(f.copied).toEqual([]);
    expect(h.said).toContain('FILE 2 IS EMPTY');
  });
});

// ------------------------------------------------------------------ inside the input event (iOS)

describe("share, copy and paste run inside the player's input event (iOS needs a user gesture)", () => {
  /** A confirm key's keydown, dispatched like the browser's: `inEvent` is true only inside it. */
  function keys(h: H) {
    const target = new EventTarget();
    bindGestureKeys(h.game.gestures, target, (c) => c === 'KeyZ');
    const state = { inEvent: false };
    const press = () => {
      const e = new Event('keydown');
      Object.defineProperty(e, 'code', { value: 'KeyZ' });
      state.inEvent = true;
      target.dispatchEvent(e);
      state.inEvent = false;
    };
    return { state, press };
  }

  it('COPY CODE on the file screen copies inside the keydown, and the frame does not copy again', async () => {
    const calls: boolean[] = [];
    let k: ReturnType<typeof keys> | null = null;
    const env: ShareEnv = {
      href: 'https://example.com/SMBC/',
      copy: async () => {
        calls.push(k?.state.inEvent ?? false);
        return true;
      },
    };
    const h = makeGame(env);
    k = keys(h);
    file({ cleared: ['1-0', '1-1'] }, 1);
    const fileScene = new FileCodeScene(h.game, 1, () => h.game.scenes.pop());
    h.game.scenes.push(fileScene);
    h.idle(8);
    h.tap('down'); // COPY CODE
    k.press();
    expect(calls).toEqual([true]);
    h.tap('jump'); // the same press, seen by the game a frame later
    await vi.waitFor(() => expect(h.said).toContain('CODE COPIED'));
    expect(calls).toEqual([true]);
    // A gamepad has no such event: its press copies in the frame, as before.
    h.idle(4);
    h.tap('jump');
    await vi.waitFor(() => expect(calls).toEqual([true, false]));
  });

  it('PASTE CODE opens the box (and reads the clipboard) inside the keydown', () => {
    const h = makeGame();
    const k = keys(h);
    h.game.showTitle();
    const files = new SaveFilesOptions(h.game, () => h.game.scenes.pop());
    h.game.scenes.push(files);
    h.idle(8);
    for (let i = 0; i < 3; i++) h.tap('down'); // PASTE CODE
    k.press();
    expect(h.top()).toBeInstanceOf(PasteCodeScene);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(PasteCodeScene);
  });

  it("the backup card shares on the touch button's release, not on its press or a later frame", async () => {
    const calls: boolean[] = [];
    let inEvent = false;
    const env: ShareEnv = {
      href: 'https://example.com/SMBC/',
      share: async () => void calls.push(inEvent),
    };
    const h = makeGame(env);
    h.game.openFile(1, castleFileFor());
    clearCastleFor(h);
    h.until(() => h.top() instanceof BackupCardScene);
    const card = h.top() as BackupCardScene;
    h.idle(40);
    h.game.gestures.touchDown(); // the A button goes down: no gesture yet on iOS
    h.step(['jump']);
    h.step(['jump']);
    expect(calls).toEqual([]);
    inEvent = true;
    h.game.gestures.touchUp(); // ... and lifts
    inEvent = false;
    h.step();
    expect(calls).toEqual([true]);
    await vi.waitFor(() => expect(card.status).toBe('SAVE SHARED'));
    expect(calls).toEqual([true]);
  });

  it('when the browser refuses, the card shows the code to copy by hand (and reads it out)', async () => {
    const h = makeGame(fakeEnv({ copy: false }).env);
    h.game.openFile(1, castleFileFor());
    clearCastleFor(h);
    h.until(() => h.top() instanceof BackupCardScene);
    const card = h.top() as BackupCardScene;
    h.idle(40);
    h.tap('down');
    h.tap('jump'); // COPY CODE
    const code = encodeSaveCode(loadSave(1) as SaveFile);
    await vi.waitFor(() => expect(card.shownCode).toBe(code));
    expect(h.said).toContain('COPY FAILED');
    expect(h.said.some((t) => t.startsWith('Your save code: '))).toBe(true);
    expect(h.top()).toBe(card);
  });
});

function castleFileFor(): SaveFile {
  return file({
    cleared: ['1-0', '1-1', '1-2', '1-3'],
    freed: ['mario', 'luigi'],
    position: { page: 'smb-1', node: '1-4' },
  });
}

function clearCastleFor(h: H): void {
  h.game.enterLevelFromMap('1-4');
  h.idle(12);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene);
  (h.top() as LevelScene).world.events.push({ type: 'exit', next: '2-1' });
  h.step();
}
