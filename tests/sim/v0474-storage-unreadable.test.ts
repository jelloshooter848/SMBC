import { afterEach, describe, expect, it } from 'vitest';
import { MARIO } from '@game/characters/mario';
import {
  classicFileKey,
  originalFileRules,
  saveClassicFile,
  saveClearedFile,
  type ClassicFileRef,
} from '@game/original-files';
import type { ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFilesScene, UNREADABLE_STORAGE_LINE } from '@game/scenes/original-files-menu';
import { ClassicNoteScene } from '@game/scenes/original-replay';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { draw, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { classic, openFiles, readNote } from './cleared-nav';

// v0.4.74 item 69 (owner-approved; rule 33a: written before the fix). When storage reads throw
// (getItem throws) but writes still work, every file read as empty: the file box showed NEW
// GAME on used files, and a new game there wrote over the real file. Now the file box says
// "SAVES CAN'T BE READ RIGHT NOW" in a Classic box (read out, waiting for OK), and refuses new
// games and erases until reads work again. Nothing is written over a file it cannot read.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '4-2',
  rules: 'classic',
  hero: 'mario',
  score: 12300,
  coins: 0,
  lives: 3,
  world: 4,
  stage: 2,
  powerState: 'small',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const ls = () => (globalThis as { localStorage: Record<string, unknown> }).localStorage;
const screen = (s: unknown) =>
  draw(s as { render(r: never): void })
    .texts.map((x) => x.str)
    .join(' ');
let readsFail = false;
/** getItem throws from now on (setItem and removeItem still work). */
function breakReads(): void {
  const real = ls().getItem as (k: string) => string | null;
  readsFail = true;
  ls().getItem = (k: string) => {
    if (readsFail) throw new Error('SecurityError');
    return real(k);
  };
}

/** The CLASSIC menu, then SMB's file box (its box over it while reads fail). */
function openBroken(h: ReturnType<typeof classic>): ClassicFilesScene {
  h.game.showClassicMenu();
  choose(h, 'Super Mario Bros.');
  const box = h.game.scenes.find((s) => s instanceof ClassicFilesScene);
  expect(box).toBeDefined();
  return box as ClassicFilesScene;
}

describe('69: reads throw, writes work', () => {
  it('the file box opens with the Classic box, read out, waiting for OK; no file shows NEW GAME', () => {
    saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
    const before = store.get(classicFileKey(F1));
    const h = classic();
    breakReads();
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    const note = h.top() as ClassicNoteScene;
    expect(note.lines.join(' ')).toMatch(/SAVES CAN'T BE READ RIGHT NOW/);
    expect(h.said.join(' ')).toMatch(/Saves can't be read right now/i);
    h.idle(900);
    expect(h.top()).toBe(note);
    readNote(h);
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    const box = h.top() as ClassicFilesScene;
    const values = items(box)
      .slice(0, 3)
      .map((i) => i.value?.());
    expect(values).not.toContain('NEW GAME');
    expect(screen(box)).toContain(UNREADABLE_STORAGE_LINE);
    expect(UNREADABLE_STORAGE_LINE.length).toBeLessThanOrEqual(31);
    expect(store.get(classicFileKey(F1))).toBe(before);
  });

  it('a new game is refused (by the box and by Game itself); the real file is intact', () => {
    saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
    const before = store.get(classicFileKey(F1));
    const h = classic();
    breakReads();
    openBroken(h);
    readNote(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    expect(h.said.at(-1)).toMatch(/can't be read/i);
    // Straight in, as a stale page could: still nothing starts, nothing is written.
    h.game.startClassicFile(F1, originalFileRules(), () => {});
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    h.game.classicGame(MARIO, '1-1', { ref: F1 });
    h.idle(60);
    expect(store.get(classicFileKey(F1))).toBe(before);
  });

  it('ERASE FILE is refused while reads fail', () => {
    saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
    const before = store.get(classicFileKey(F1));
    const h = classic();
    breakReads();
    const box = openBroken(h);
    readNote(h);
    choose(h, 'Erase file');
    expect(h.top()).toBe(box);
    expect(h.said.at(-1)).toMatch(/can't be read/i);
    box.eraseFile(1);
    expect(store.get(classicFileKey(F1))).toBe(before);
  });

  it('no writer puts a run over a file it cannot read (a CLEARED one stays CLEARED)', () => {
    expect(saveClearedFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() })).toBe(true);
    const before = store.get(classicFileKey(F1));
    breakReads();
    expect(saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run({ score: 1 }) })).toBe(
      false,
    );
    expect(saveClearedFile({ ...F1, rules: originalFileRules(), continues: 0, run: run({ score: 2 }) })).toBe(
      false,
    );
    expect(store.get(classicFileKey(F1))).toBe(before);
  });

  it('reads work again: the files are back as they were, and new games start in empty files', () => {
    saveClassicFile({ ...F1, rules: originalFileRules(), continues: 0, run: run() });
    const h = classic();
    breakReads();
    openBroken(h);
    readNote(h);
    readsFail = false;
    const box = openFiles(h);
    expect(h.top()).toBe(box);
    expect(items(box)[0]?.value?.()).toMatch(/4-2/);
    expect(items(box)[1]?.value?.()).toBe('NEW GAME');
    expect(screen(box)).not.toContain(UNREADABLE_STORAGE_LINE);
  });

  it('BACK on the box goes back to the file box (still refusing)', () => {
    const h = classic();
    breakReads();
    openBroken(h);
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    h.idle(40);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  });
});
