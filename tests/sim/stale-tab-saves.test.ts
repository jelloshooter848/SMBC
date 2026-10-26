import { afterEach, describe, expect, it } from 'vitest';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import {
  classicFileKey,
  eraseClassicFile,
  loadClassicFile,
  loadClearedFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicNoteScene } from '@game/scenes/original-replay';
import { store, useStorage } from './heroes-harness';
import { pickAtContinue } from './continue-select';
import { classic, closeUnlockCards, inLevel, readNote, run, type G } from './cleared-nav';

/*
 * Item 142 (owner-approved, rule 33a: the edge cases first): a Classic run writes its file only
 * while the file holds its game (the same runId), or, before the run's first write lands, while
 * the slot still holds what the run took (empty for a new game, the loaded file for a resume).
 * A slot another tab erased never comes back, and another tab's new game is never written over:
 * the stale tab refuses and says so once, on its next WORLD card. Every save path, as two tabs
 * sharing one storage: a death, a WORLD card, a game over (its continue point, or the end of the
 * run), the Tutorials seen, and a run started while only the file keys could not be read.
 * Item 143 (1): a stale tab's beat over a file another tab already CLEARED does not say the file
 * is cleared, nor open the file box on it.
 */

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const B: ClassicFileRef = { set: 'smb', slot: 2 };
const key = classicFileKey(A);
const NOTE = /changed in another window/i;

/** Tab 1: a new game in `ref`, in its first level (its first WORLD card wrote it). */
function tab1In(ref = A, level = '1-1'): G {
  const t = classic();
  t.game.classicGame(MARIO, level, { ref });
  t.until(() => inLevel(t), 900);
  expect(loadClassicFile(ref)?.run.hero).toBe('mario');
  return t;
}

/** Tab 2: ERASE FILE on `ref`, then a new game there that reaches its first WORLD card. */
function tab2NewGame(ref = A, level = '1-1'): string {
  const t = classic();
  eraseClassicFile(ref);
  t.game.classicGame(LINK, level, { ref });
  t.until(() => inLevel(t), 900);
  expect(loadClassicFile(ref)?.run.hero).toBe('link');
  return store.get(classicFileKey(ref)) ?? '';
}

const notes = (t: G) => t.said.filter((s) => NOTE.test(s)).length;

describe("item 142: a stale tab never writes over another tab's game", () => {
  it('a death: the file keeps tab 2’s game; tab 1 says so once, on its next WORLD card', () => {
    const t1 = tab1In();
    const theirs = tab2NewGame();
    t1.game.respawn('1-1', { mode: 'stand' });
    expect(store.get(key)).toBe(theirs);
    pickAtContinue(t1);
    t1.until(() => inLevel(t1), 900);
    expect(notes(t1)).toBe(1);
    // A second death: still nothing written, and not said again.
    t1.game.respawn('1-1', { mode: 'stand' });
    pickAtContinue(t1);
    t1.until(() => inLevel(t1), 900);
    expect(store.get(key)).toBe(theirs);
    expect(notes(t1)).toBe(1);
  });

  it('a WORLD card (the next level)', () => {
    const t1 = tab1In();
    const theirs = tab2NewGame();
    t1.game.goToLevel('1-2', { mode: 'stand' });
    expect(store.get(key)).toBe(theirs);
  });

  it('a game over: neither its continue point nor the end of the run touches the file', () => {
    const t1 = tab1In();
    const theirs = tab2NewGame();
    t1.game.gameOver('1-1');
    expect(store.get(key)).toBe(theirs);
    const t3 = tab1In(B);
    const theirsB = tab2NewGame(B);
    t3.game.gameOver(null);
    expect(store.get(classicFileKey(B))).toBe(theirsB);
  });

  it('the Tutorials seen', () => {
    const t1 = tab1In();
    const theirs = tab2NewGame();
    t1.game.keepTutorialsSeen(['mario-start', 'mushroom']);
    expect(store.get(key)).toBe(theirs);
  });

  it('erased by another tab (left empty): a death, a WORLD card, a game over never bring it back', () => {
    const t1 = tab1In();
    eraseClassicFile(A);
    t1.game.respawn('1-1', { mode: 'stand' });
    expect(store.has(key)).toBe(false);
    pickAtContinue(t1);
    t1.until(() => inLevel(t1), 900);
    expect(notes(t1)).toBe(1);
    t1.game.goToLevel('1-2', { mode: 'stand' });
    t1.game.keepTutorialsSeen(['mario-start']);
    t1.game.gameOver('1-2');
    expect(store.has(key)).toBe(false);
  });

  it('a resumed file erased by another tab before the run wrote it: not brought back', () => {
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '1-2', world: 1, stage: 2 }),
    });
    const t1 = classic();
    expect(t1.game.resumeClassic(A)).toBe(true);
    eraseClassicFile(A);
    t1.game.goToLevel('1-2', { mode: 'stand' });
    expect(store.has(key)).toBe(false);
  });

  it('a run started while only the file keys could not be read never overwrites them once reads recover', () => {
    // File 1 holds a game; its key's reads throw (the probe key reads fine).
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '4-1', world: 4, stage: 1 }),
      runId: 'theirs',
    });
    const real = store.get(key) ?? '';
    const ls = globalThis.localStorage as Storage;
    const ok = ls.getItem.bind(ls);
    (globalThis as { localStorage?: unknown }).localStorage = {
      ...ls,
      getItem: (k: string) => {
        if (k.startsWith('smbc-classic-file-')) throw new Error('denied');
        return ok(k);
      },
      setItem: ls.setItem.bind(ls),
      removeItem: ls.removeItem.bind(ls),
    };
    const t1 = classic();
    t1.game.classicGame(MARIO, '1-1', { ref: A });
    t1.until(() => inLevel(t1), 900);
    expect(store.get(key)).toBe(real);
    // Reads come back.
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    t1.game.respawn('1-1', { mode: 'stand' });
    t1.game.goToLevel('1-2', { mode: 'stand' });
    t1.game.gameOver('1-2');
    expect(store.get(key)).toBe(real);
  });

  it('its own game saves as before: a new game, deaths, WORLD cards, a resumed file from before runIds', () => {
    const t1 = tab1In();
    t1.game.goToLevel('1-2', { mode: 'stand' });
    expect(loadClassicFile(A)?.run.levelId).toBe('1-2');
    t1.game.respawn('1-2', { mode: 'stand' });
    expect(loadClassicFile(A)?.run.lives).toBeDefined();
    expect(notes(t1)).toBe(0);
    // A file with no runId (an older save), resumed: its first write lands, then the next.
    saveClassicFile({
      ...B,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '2-1', world: 2, stage: 1 }),
    });
    const t2 = classic();
    expect(t2.game.resumeClassic(B)).toBe(true);
    t2.game.goToLevel('2-2', { mode: 'stand' });
    expect(loadClassicFile(B)?.run.levelId).toBe('2-2');
    t2.game.goToLevel('2-3', { mode: 'stand' });
    expect(loadClassicFile(B)?.run.levelId).toBe('2-3');
  });
});

describe('item 143 (1): a stale tab beats the set in a file another tab already CLEARED', () => {
  it('does not say the file is cleared, nor open the file box on it', () => {
    const t1 = tab1In(B, '8-4');
    // Tab 2: erase, a new game in File 2, and its beat (File 2 CLEARED).
    tab2NewGame(B, '8-4');
    const t2 = classic();
    expect(t2.game.resumeClassic(B)).toBe(true);
    t2.game.showEnding('8-4');
    expect(loadClearedFile(B)).not.toBeNull();
    const cleared = store.get(classicFileKey(B));
    // Tab 1 beats it too.
    t1.game.showEnding('8-4');
    (t1.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    closeUnlockCards(t1);
    expect(t1.top()).toBeInstanceOf(ClassicNoteScene);
    const text = readNote(t1).flat().join(' ');
    expect(text).not.toMatch(/FILE 2 IS CLEARED/);
    expect(text).toMatch(/ANOTHER GAME/);
    const files = t1.game.scenes.find((s) => s instanceof ClassicFilesScene) as ClassicFilesScene;
    expect((files as unknown as { index: number }).index).not.toBe(1);
    expect(store.get(classicFileKey(B))).toBe(cleared);
  });
});
