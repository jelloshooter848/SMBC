import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProgress } from '@engine/save/progress';
import { MARIO } from '@game/characters/mario';
import {
  classicFileKey,
  hasClassicFile,
  loadClassicFile,
  loadClearedFile,
  migrateClassicFiles,
  oldRunsWaiting,
  originalFileRules,
  saveClassicFile,
  saveClearedFile,
  type ClassicFileRef,
} from '@game/original-files';
import { classicResumeKey } from '@game/run-resume';
import { defaultClassicSettings } from '@engine/save/original-options';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicEraseConfirmScene, ClassicEraseScene } from '@game/scenes/original-files-menu';
import { store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { beat, classic, closeUnlockCards, inLevel, keepCleared, openFiles, run, stored } from './cleared-nav';

// v0.4.73 PR 2 (A, owner 46B, 47A, 50A): beating a map set keeps its file as CLEARED, never
// emptied by the credits and never written again; only ERASE FILE empties it. Rule 33a: the
// edge cases first (a waiting old save, migration, a new game, a stale tab, a downgrade, newer
// or damaged data, a full set, storage throwing).

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const B: ClassicFileRef = { set: 'smb', slot: 2 };
const C: ClassicFileRef = { set: 'smb', slot: 3 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const values = (s: unknown) => items(s).map((i) => i.value?.() ?? null);
const shared = () => ({
  classic: defaultClassicSettings(),
  difficulty: 'normal' as const,
  continuesUsed: 0,
});
const waiting = () =>
  store.set(
    classicResumeKey('smb'),
    JSON.stringify({ ...run({ levelId: '3-1', world: 3, stage: 1 }), savedAt: 5 }),
  );

/** The stubbed storage, with some of its calls refusing. */
function refuse(calls: ('getItem' | 'setItem' | 'removeItem')[], only?: (k: string) => boolean): void {
  const ls = (globalThis as { localStorage: Record<string, (...a: string[]) => unknown> }).localStorage;
  for (const c of calls) {
    const real = ls[c] as (...a: string[]) => unknown;
    ls[c] = (...a: string[]) => {
      if (!only || only(a[0] as string)) throw new Error(`${c} refused`);
      return real(...a);
    };
  }
}

describe('A: beating a set keeps the file as CLEARED', () => {
  it('the credits do not empty it: score, lives and hero are frozen as the set was beaten', () => {
    const h = classic();
    beat(h, A);
    const f = loadClearedFile(A);
    expect(f).not.toBeNull();
    expect(f?.run).toMatchObject({ hero: 'mario', score: 55500, lives: 6 });
    expect(h.game.classicFileState(A)).toBe('cleared');
    // It is no run to go on with (CONTINUE never takes it).
    expect(loadClassicFile(A)).toBeNull();
    expect(h.game.resumeClassic(A)).toBe(false);
  });

  it('the beaten record and the cheat unlocks are as before', () => {
    const h = classic();
    beat(h, A);
    expect(loadProgress().classicBeat?.smb).toBe('normal');
    expect(h.settings.classicCheats.beaten.smb).toBe(true);
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(true);
  });

  it('is stored in a format an older version cannot take for a run (so it never rewrites it)', () => {
    const h = classic();
    beat(h, A);
    const raw = JSON.parse(store.get(classicFileKey(A)) as string) as { v: number };
    // v0.4.72 and earlier read only v 1 as a file: a CLEARED file is kept there as unreadable.
    expect(raw.v).not.toBe(1);
    expect(hasClassicFile(A)).toBe(true);
  });

  it('a credits roll with an old save waiting: nothing moves into the CLEARED file', () => {
    const h = classic();
    for (const ref of [B, C])
      saveClassicFile({ ...ref, rules: originalFileRules(), continues: 0, run: run() });
    h.game.classicGame(MARIO, '8-4', { ref: A });
    h.until(() => inLevel(h), 900);
    waiting();
    expect(oldRunsWaiting('smb')).toBe(1);
    h.game.showEnding('8-4');
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    closeUnlockCards(h);
    h.game.classicFiles('smb');
    expect(loadClearedFile(A)).not.toBeNull();
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    expect(oldRunsWaiting('smb')).toBe(1);
  });
});

describe('A: a CLEARED file is never overwritten', () => {
  it('by migration: a full set of CLEARED files keeps the old save waiting, as it is', () => {
    for (const ref of [A, B, C]) keepCleared(ref);
    waiting();
    const before = stored();
    expect(migrateClassicFiles(shared)).toBe(false);
    expect(stored()).toBe(before);
    expect(oldRunsWaiting('smb')).toBe(1);
  });

  it('by a new game', () => {
    keepCleared(A);
    const before = stored();
    const h = classic();
    h.game.startClassicFile(A, originalFileRules(), () => {});
    h.game.classicGame(MARIO, '1-1', { ref: A });
    expect(stored()).toBe(before);
    expect(h.game.classicFile).toBeNull();
  });

  it('by saveClassicFile itself (any writer, any tab)', () => {
    keepCleared(A);
    const before = stored();
    expect(
      saveClassicFile({ ...A, rules: originalFileRules(), continues: 0, run: run({ levelId: '1-1' }) }),
    ).toBe(false);
    expect(stored()).toBe(before);
  });

  it('by a second clear: the first stays as it was', () => {
    keepCleared(A, { score: 111 });
    const before = stored();
    expect(
      saveClearedFile({ ...A, rules: originalFileRules(), continues: 0, run: run({ score: 222 }) }),
    ).toBe(false);
    expect(stored()).toBe(before);
  });

  it('by a stale tab: a run of the same file reaching a WORLD card, a game over, or the ending', () => {
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '1-1', world: 1, stage: 1 }),
    });
    const h = classic();
    expect(h.game.resumeClassic(A)).toBe(true);
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    // Another tab beat the set in this file meanwhile.
    store.delete(classicFileKey(A));
    keepCleared(A, { score: 424242 });
    const before = stored();
    h.game.levelExitTo('1-2', { world: 1, stage: 1 });
    expect(stored()).toBe(before);
    h.game.gameOver(null);
    expect(stored()).toBe(before);
    h.game.classicGame(MARIO, '8-4');
    h.game.showEnding('8-4');
    expect(stored()).toBe(before);
    expect(loadClearedFile(A)?.run.score).toBe(424242);
  });

  it('this version reads a CLEARED file as it was and writes nothing on reading it (v0.4.72 itself: v0473-cleared-review)', () => {
    keepCleared(A, { score: 31337 });
    const before = stored();
    // An older version keeps it as unreadable (never written: its saves need an empty file).
    const h = classic();
    expect(h.game.classicFileState(A)).toBe('cleared');
    h.game.classicFiles('smb');
    expect(stored()).toBe(before);
  });

  it('newer-format data (a later version) is kept as unreadable, and only ERASE FILE empties it', () => {
    const newer = JSON.stringify({ v: 3, cleared: true, run: run(), rules: {} });
    store.set(classicFileKey(A), newer);
    const h = classic();
    expect(h.game.classicFileState(A)).toBe('unreadable');
    expect(loadClearedFile(A)).toBeNull();
    expect(saveClassicFile({ ...A, rules: originalFileRules(), continues: 0, run: run() })).toBe(false);
    expect(saveClearedFile({ ...A, rules: originalFileRules(), continues: 0, run: run() })).toBe(false);
    for (const ref of [B, C])
      saveClassicFile({ ...ref, rules: originalFileRules(), continues: 0, run: run() });
    waiting();
    migrateClassicFiles(shared);
    expect(store.get(classicFileKey(A))).toBe(newer);
    expect(oldRunsWaiting('smb')).toBe(1);
  });

  it('a damaged CLEARED file is unreadable and kept; ERASE FILE empties it', () => {
    store.set(classicFileKey(A), JSON.stringify({ v: 2, cleared: true, run: { v: 1 }, rules: {} }));
    const h = classic();
    expect(h.game.classicFileState(A)).toBe('unreadable');
    const box = openFiles(h);
    expect(values(box)[0]).toBe('UNREADABLE');
    choose(h, 'Erase file');
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    choose(h, 'Yes');
    expect(hasClassicFile(A)).toBe(false);
  });
});

describe('A: ERASE FILE is the only way to a new game on a CLEARED file', () => {
  it('the picker shows it CLEARED, the question says so, and YES empties it', () => {
    keepCleared(A);
    const h = classic();
    openFiles(h);
    choose(h, 'Erase file');
    expect(h.top()).toBeInstanceOf(ClassicEraseScene);
    expect(values(h.top())[0]).toMatch(/CLEARED/);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    expect(h.said.at(-1)).toMatch(/^Erase file 1\?.*cleared/i);
    choose(h, 'Yes');
    expect(hasClassicFile(A)).toBe(false);
    expect(h.game.classicFileState(A)).toBe('empty');
  });

  it('with an old save waiting, it moves in once the CLEARED file is erased', () => {
    for (const ref of [A, B, C]) keepCleared(ref);
    waiting();
    const h = classic();
    openFiles(h);
    choose(h, 'Erase file');
    choose(h, 'File 2');
    choose(h, 'Yes');
    expect(loadClassicFile(B)?.run.levelId).toBe('3-1');
    expect(loadClearedFile(A)).not.toBeNull();
    expect(loadClearedFile(C)).not.toBeNull();
  });
});

describe('A: storage refusing the CLEARED write', () => {
  it('the run is not lost: the file keeps its last run, and the message says it was not saved', () => {
    const h = classic();
    h.game.classicGame(MARIO, '8-4', { ref: A });
    h.until(() => inLevel(h), 900);
    const kept = store.get(classicFileKey(A));
    expect(kept).toBeDefined();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    refuse(['setItem'], (k) => k === classicFileKey(A));
    h.game.showEnding('8-4');
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    closeUnlockCards(h);
    expect(store.get(classicFileKey(A))).toBe(kept);
    expect(loadClassicFile(A)?.run.levelId).toBe('8-4');
    expect(h.said.join(' ')).toMatch(/could not be saved/i);
  });
});
