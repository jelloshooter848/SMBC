import { afterEach, describe, expect, it } from 'vitest';
import { GameOverScene } from '@game/scenes/game-over';
import { QuitRunScene } from '@game/scenes/quit-run';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { draw } from './heroes-harness';
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
import { IntroScene } from '@game/scenes/intro';
import { store, useStorage } from './heroes-harness';
import { pickAtContinue } from './continue-select';
import { classic, closeUnlockCards, inLevel, readNote, run, type G } from './cleared-nav';

/*
 * Follow-ups to items 142 / 143 (owner 148, review of #stale-tab-saves). Helpers copied from
 * stale-tab-saves.test.ts. 148: the note also shows (once) on the game over and the Quit card.
 * Review: a twin tab's clear of the same game is "already cleared in another window"; a clear
 * refused only because storage could not be read is "could not be saved"; a refusal after only
 * the file keys failed says the file already holds a game; a resume's first save is tied to the
 * text it read; the run's own CLEARED file never counts as another window's.
 *
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

/** The hero select, then the WORLD card (a card with the note waits for a press), then the level. */
function backIn(t: G): void {
  pickAtContinue(t);
  t.until(() => t.top() instanceof IntroScene || inLevel(t), 300);
  if (t.top() instanceof IntroScene && NOTE.test(t.said.at(-1) ?? '')) {
    // A card with the note never moves on by itself.
    t.idle(400);
    expect(t.top()).toBeInstanceOf(IntroScene);
    t.tap('jump');
  }
  t.until(() => inLevel(t), 900);
}

const screen = (t: G) =>
  draw(t.game.scenes as never)
    .texts.map((x) => x.str)
    .join(' ');

/** Tab 2 erases `ref`, starts a new game there, and beats the set (the file CLEARED). */
function tab2Clears(ref = A): void {
  tab2NewGame(ref, '8-4');
  const t2 = classic();
  expect(t2.game.resumeClassic(ref)).toBe(true);
  t2.game.showEnding('8-4');
  expect(loadClearedFile(ref)).not.toBeNull();
}

function denyAll(): () => void {
  const ls = globalThis.localStorage;
  const deny = () => {
    throw new Error('denied');
  };
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: deny,
    setItem: deny,
    removeItem: deny,
  };
  return () => void ((globalThis as { localStorage?: unknown }).localStorage = ls);
}

describe('148: the note on the game over and the Quit card, once', () => {
  it('a refusal at a game over: GAME OVER shows and says it; MAIN MENU, and it is not said again', () => {
    const t1 = tab1In();
    tab2NewGame();
    t1.game.gameOver('1-1');
    expect(t1.top()).toBeInstanceOf(GameOverScene);
    expect(notes(t1)).toBe(1);
    expect(screen(t1)).toMatch(/ANOTHER WINDOW/);
    t1.until(() => (t1.top() as GameOverScene).prompting, 900);
    expect(t1.said.at(-1)).not.toMatch(/keep your run/i);
    t1.tap('down');
    t1.tap('jump');
    expect(notes(t1)).toBe(1);
  });

  it('a refusal at a death, then the select’s BACK: the Quit card shows and says it, no "run waits"; not on the next card', () => {
    const t1 = tab1In();
    tab2NewGame();
    t1.game.respawn('1-1', { mode: 'stand' });
    t1.until(() => t1.top() instanceof CharacterSelectScene, 60);
    t1.idle(20);
    t1.tap('attack');
    expect(t1.top()).toBeInstanceOf(QuitRunScene);
    expect(notes(t1)).toBe(1);
    expect(t1.said.at(-1)).not.toMatch(/waits in its file/i);
    expect(screen(t1)).toMatch(/ANOTHER WINDOW/);
    expect(screen(t1)).not.toMatch(/WAITS IN ITS FILE/);
    // NO: back to the select, then the level: the card does not say it again.
    t1.idle(8);
    t1.tap('jump');
    backIn(t1);
    expect(notes(t1)).toBe(1);
  });
});

describe('review: what the beat says', () => {
  it('a twin tab (the same game) cleared it first: "already cleared in another window"', () => {
    saveClassicFile({ ...A, rules: originalFileRules(), continues: 0, run: run(), runId: 'same-game' });
    const t1 = classic();
    expect(t1.game.resumeClassic(A)).toBe(true);
    const t2 = classic();
    expect(t2.game.resumeClassic(A)).toBe(true);
    t2.game.showEnding('8-4');
    expect(loadClearedFile(A)).not.toBeNull();
    t1.game.showEnding('8-4');
    (t1.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    closeUnlockCards(t1);
    const text = readNote(t1).flat().join(' ');
    expect(text).toMatch(/ALREADY CLEARED IN ANOTHER WINDOW/);
    expect(text).not.toMatch(/ANOTHER GAME/);
  });

  it('storage that cannot be read at the beat: "could not be saved", not "another game"', () => {
    const t1 = tab1In(A, '8-4');
    const back = denyAll();
    t1.game.showEnding('8-4');
    back();
    (t1.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    closeUnlockCards(t1);
    const text = readNote(t1).flat().join(' ');
    expect(text).toMatch(/COULD NOT BE SAVED AS CLEARED/);
    expect(text).not.toMatch(/ANOTHER GAME/);
  });

  it('another tab CLEARED the file: a stale death is refused and says another window', () => {
    const t1 = tab1In();
    tab2Clears();
    const cleared = store.get(key);
    t1.game.respawn('1-1', { mode: 'stand' });
    backIn(t1);
    expect(store.get(key)).toBe(cleared);
    expect(notes(t1)).toBe(1);
  });

  it('this run’s own CLEARED file is never "changed in another window"', () => {
    const t1 = tab1In(A, '8-4');
    t1.game.showEnding('8-4');
    expect(loadClearedFile(A)).not.toBeNull();
    t1.game.keepTutorialsSeen(['mario-start']);
    expect((t1.game as unknown as { fileNote: string | null }).fileNote).toBeNull();
    expect((t1.game as unknown as { fileLost: boolean }).fileLost).toBe(false);
  });
});

describe('review: neutral words, one read, quota, CONTINUE', () => {
  it('only the file keys failed when the run started: "already holds a game", not another window', () => {
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '4-1', world: 4, stage: 1 }),
      runId: 'theirs',
    });
    const ls = globalThis.localStorage as Storage;
    const ok = ls.getItem.bind(ls);
    (globalThis as { localStorage?: unknown }).localStorage = {
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
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    t1.game.respawn('1-1', { mode: 'stand' });
    pickAtContinue(t1);
    t1.until(() => t1.top() instanceof IntroScene, 300);
    expect(t1.said.at(-1)).toMatch(/File 1 already holds a game, so this run can't save to it/);
    expect(notes(t1)).toBe(0);
  });

  it('a resume’s first save is tied to the text it read (a later read throwing changes nothing)', () => {
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '2-1', world: 2, stage: 1 }),
    });
    const ls = globalThis.localStorage as Storage;
    const ok = ls.getItem.bind(ls);
    // How many times the migration alone reads the file's key.
    let reads = 0;
    const counting = (k: string) => {
      if (k === key) reads++;
      return ok(k);
    };
    (globalThis as { localStorage?: unknown }).localStorage = {
      ...ls,
      getItem: counting,
      setItem: ls.setItem.bind(ls),
      removeItem: ls.removeItem.bind(ls),
    };
    const probe = classic();
    (probe.game as unknown as { migrateClassicFiles(): void }).migrateClassicFiles();
    const allowed = reads + 1;
    reads = 0;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => {
        if (k === key && ++reads > allowed) throw new Error('denied');
        return ok(k);
      },
      setItem: ls.setItem.bind(ls),
      removeItem: ls.removeItem.bind(ls),
    };
    const t1 = classic();
    expect(t1.game.resumeClassic(A)).toBe(true);
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    t1.game.goToLevel('2-2', { mode: 'stand' });
    expect(loadClassicFile(A)?.run.levelId).toBe('2-2');
  });

  it('storage full (quota): nothing saved, and no "another window"', () => {
    const t1 = tab1In();
    const ls = globalThis.localStorage as Storage;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: ls.getItem.bind(ls),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: ls.removeItem.bind(ls),
    };
    t1.game.respawn('1-1', { mode: 'stand' });
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    backIn(t1);
    expect(notes(t1)).toBe(0);
    // Space again: the next save lands.
    t1.game.goToLevel('1-2', { mode: 'stand' });
    expect(loadClassicFile(A)?.run.levelId).toBe('1-2');
  });

  it('one tab: a game over, then CONTINUE plays on and keeps saving, no note', () => {
    const t1 = tab1In();
    t1.game.gameOver('1-1');
    expect(loadClassicFile(A)?.run.continued).toBe(true);
    t1.until(() => (t1.top() as GameOverScene).prompting, 900);
    expect(t1.said.at(-1)).toMatch(/keep your run/i);
    t1.tap('jump');
    backIn(t1);
    t1.game.goToLevel('1-2', { mode: 'stand' });
    expect(loadClassicFile(A)?.run.levelId).toBe('1-2');
    expect(notes(t1)).toBe(0);
  });
});
