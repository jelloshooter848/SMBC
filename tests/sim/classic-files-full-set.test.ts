import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultClassicSettings } from '@engine/save/original-options';
import { defaultSettings } from '@engine/save/settings';
import {
  listClassicFiles,
  loadClassicFile,
  migrateClassicFiles,
  oldRunsWaiting,
  originalFileRules,
  saveClassicFile,
  type SharedClassicRules,
} from '@game/original-files';
import { CLASSIC_RESUME_KEY, classicResumeKey, type ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import type { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicEraseConfirmScene } from '@game/scenes/original-files-menu';
import { draw, makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

// 31a (v0.4.71, #199 review): an old save (a per-set key, or the 0.4.67 key) that finds its set
// with all three files used is never lost and never overwrites a file. Its key stays; once
// ERASE FILE frees a file, it moves in there, and the file box says so.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '4-2',
  rules: 'classic',
  hero: 'mario',
  score: 12300,
  coins: 7,
  lives: 4,
  world: 4,
  stage: 2,
  powerState: 'big',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});
const shared = (): SharedClassicRules => ({
  classic: defaultClassicSettings(),
  difficulty: 'normal',
  continuesUsed: 0,
});
const put = (key: string, v: unknown) => store.set(key, JSON.stringify(v));

function fullSet(): void {
  for (const slot of [1, 2, 3] as const)
    saveClassicFile({
      set: 'smb',
      slot,
      rules: originalFileRules(),
      continues: 0,
      run: run({ score: slot, levelId: `${slot}-1`, world: slot, stage: 1 }),
      savedAt: slot * 10,
    });
}
const scores = () => listClassicFiles('smb').map((f) => f?.run.score ?? null);

describe('31a: a full set keeps the old save', () => {
  it('a newer old run overwrites no file; its key stays', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    const before = new Map(store);
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 999 });
    expect(migrateClassicFiles(shared())).toBe(false);
    expect(scores()).toEqual([1, 2, 3]);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    for (const [k, v] of before) expect(store.get(k)).toBe(v);
  });

  it('an older old run is not dropped: its key stays', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    put(classicResumeKey('smb'), { ...run({ score: 5 }), savedAt: 1 });
    migrateClassicFiles(shared());
    expect(scores()).toEqual([1, 2, 3]);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
  });

  it('the 0.4.67 key stays too', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    put(CLASSIC_RESUME_KEY, { ...run({ score: 66 }), savedAt: 999 });
    migrateClassicFiles(shared());
    expect(scores()).toEqual([1, 2, 3]);
    expect(store.has(CLASSIC_RESUME_KEY)).toBe(true);
  });

  it('repeating changes nothing, and the full set is logged only once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    // A run of its own (the log is once per kept key and contents, for the whole session).
    put(classicResumeKey('smb'), { ...run({ score: 4242 }), savedAt: 999 });
    migrateClassicFiles(shared());
    const once = new Map(store);
    for (let i = 0; i < 5; i++) migrateClassicFiles(shared());
    expect(new Map(store)).toEqual(once);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('it moves into the first file ERASE frees, and its key goes then', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 999 });
    migrateClassicFiles(shared());
    expect(oldRunsWaiting('smb')).toBe(1);
    store.delete('smbc-classic-file-smb-2');
    expect(migrateClassicFiles(shared())).toBe(true);
    expect(scores()).toEqual([1, 77, 3]);
    expect(store.has(classicResumeKey('smb'))).toBe(false);
    expect(oldRunsWaiting('smb')).toBe(0);
  });

  it('two old runs for one full set: one per freed file, the other waits', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    put(CLASSIC_RESUME_KEY, { ...run({ score: 66 }), savedAt: 999 });
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 998 });
    migrateClassicFiles(shared());
    expect(oldRunsWaiting('smb')).toBe(2);
    store.delete('smbc-classic-file-smb-3');
    migrateClassicFiles(shared());
    expect(scores()).toEqual([1, 2, 66]);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(oldRunsWaiting('smb')).toBe(1);
  });
});

describe('31a: the file box announces the move', () => {
  const items = (s: unknown) => (s as { items: MenuItem[] }).items;
  const values = (s: unknown) => items(s).map((i) => i.value?.() ?? null);

  it('ERASE FILE 2 says the old run will move in, then that it moved in', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fullSet();
    put(classicResumeKey('smb'), { ...run({ score: 77 }), savedAt: 999 });
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    const box = h.top() as ClassicFilesScene;
    expect(values(box).slice(0, 3)).toEqual(['NORMAL 1-1 X4', 'NORMAL 2-1 X4', 'NORMAL 3-1 X4']);
    // The waiting run is told on the set's ERASE FILE row.
    const erase = items(box).find((i) => i.label === 'Erase file');
    expect(erase?.hint).toMatch(/older version is waiting for a free file/);
    choose(h, 'Erase file');
    choose(h, 'File 2');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    expect(h.said.at(-1)).toMatch(
      /It cannot be undone\. A game saved by an older version will then move into File 2\./,
    );
    choose(h, 'Yes');
    expect(h.top()).toBe(box);
    expect(values(box).slice(0, 3)).toEqual(['NORMAL 1-1 X4', 'NORMAL 4-2 X4', 'NORMAL 3-1 X4']);
    const said = h.said.at(-1) ?? '';
    expect(said).toMatch(
      /^File 2 erased\. A game saved by an older version moved into File 2: Normal, World 4-2, 4 lives, score 77, Mario/,
    );
    expect(said).not.toMatch(/NEW GAME|Empty/);
    // The line under the box says it too, until the cursor moves.
    expect(
      draw(box)
        .texts.map((x) => x.str)
        .join(' '),
    ).toMatch(/OLD SAVE MOVED INTO FILE 2/);
    h.tap('down');
    expect(
      draw(box)
        .texts.map((x) => x.str)
        .join(' '),
    ).not.toMatch(/OLD SAVE MOVED/);
    expect(store.has(classicResumeKey('smb'))).toBe(false);
    expect(loadClassicFile({ set: 'smb', slot: 2 })?.run.score).toBe(77);
  });

  it('with nothing waiting, ERASE says only that the file was erased', () => {
    fullSet();
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    choose(h, 'Erase file');
    choose(h, 'File 2');
    expect(h.said.at(-1)).not.toMatch(/older version/);
    choose(h, 'Yes');
    expect(h.said.at(-1)).toMatch(/^File 2 erased\. File 2: NEW GAME/);
    expect(h.said.at(-1)).not.toMatch(/older version/);
  });
});
