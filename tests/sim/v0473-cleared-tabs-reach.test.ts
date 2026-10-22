import { afterEach, describe, expect, it } from 'vitest';
import { loadProgress } from '@engine/save/progress';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import type { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import {
  ClassicNoteScene,
  ClassicReplayLevelsScene,
  ClassicReplayWorldsScene,
  REPLAY_HELP_KEY,
} from '@game/scenes/original-replay';
import {
  eraseClassicFile,
  loadClassicFile,
  loadClearedFile,
  type ClassicFileRef,
} from '@game/original-files';
import { store, useStorage, type H } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { classic, closeUnlockCards, inLevel, keepCleared, openFiles, readNote } from './cleared-nav';

// v0.4.73 owner follow-ups on #209. 95: a run whose file another tab erased and started again
// never writes CLEARED over that new run (the beat is still recorded). 96: a warp zone taken in
// a replay ends at the level box; a real Lost Levels run into World 9 records the worlds it
// reached, and its CLEARED file's replay offers World 9.

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const L: ClassicFileRef = { set: 'lost', slot: 1 };
const labels = (s: unknown) => (s as { items: MenuItem[] }).items.map((i) => i.label);
const levelOf = (h: H) => {
  const l = h.top() as LevelScene;
  return l.level.parent ?? l.level.id;
};

describe('95: another tab started a new game in the file', () => {
  it("the first tab beating the set leaves tab 2's run as it is, and still records the beat", () => {
    const tab1 = classic();
    tab1.game.classicGame(MARIO, '8-4', { ref: A });
    tab1.until(() => inLevel(tab1), 900);
    expect(loadClassicFile(A)?.run.levelId).toBe('8-4');
    // Tab 2: ERASE FILE, then a new game in the same file, which reaches its first WORLD card.
    const tab2 = classic();
    eraseClassicFile(A);
    tab2.game.classicGame(LINK, '1-1', { ref: A });
    tab2.until(() => inLevel(tab2), 900);
    const tab2Run = store.get('smbc-classic-file-smb-1');
    expect(loadClassicFile(A)?.run.hero).toBe('link');
    // Tab 1 beats the set.
    tab1.game.showEnding('8-4');
    expect(store.get('smbc-classic-file-smb-1')).toBe(tab2Run);
    expect(loadClearedFile(A)).toBeNull();
    expect(loadProgress().classicBeat?.smb).toBe('normal');
    expect(tab1.settings.classicCheats.beaten.smb).toBe(true);
    // After the credits the message says the file holds another game (it was not cleared).
    (tab1.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    closeUnlockCards(tab1);
    expect(tab1.top()).toBeInstanceOf(ClassicNoteScene);
    const text = readNote(tab1).flat().join(' ');
    expect(text).toMatch(/YOU BEAT SUPER MARIO BROS\.!/);
    expect(text).toMatch(/ANOTHER GAME/);
    expect(store.get('smbc-classic-file-smb-1')).toBe(tab2Run);
  });

  it('a file erased by another tab (left empty) is not brought back as CLEARED', () => {
    const tab1 = classic();
    tab1.game.classicGame(MARIO, '8-4', { ref: A });
    tab1.until(() => inLevel(tab1), 900);
    eraseClassicFile(A);
    tab1.game.showEnding('8-4');
    expect(store.has('smbc-classic-file-smb-1')).toBe(false);
    expect(loadProgress().classicBeat?.smb).toBe('normal');
  });
});

describe('96 (1): a warp zone taken in a replay', () => {
  it('ends the replay at the level box', () => {
    keepCleared(A);
    store.set(REPLAY_HELP_KEY, 'true');
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-2');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(levelOf(h)).toMatch(/^1-2/);
    // 1-2's warp zone: a pipe into World 4 (LevelScene's warp: Game.warpToLevel).
    h.game.warpToLevel('4-1', { mode: 'stand' });
    expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
    expect(labels(h.top())).toContain('1-2');
  });
});

describe('96 (2): a real Lost Levels run into World 9', () => {
  it('records the worlds it reached, and the replay offers World 9 (and not World A)', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    const h = classic();
    h.game.classicGame(MARIO, 'll-8-4', { ref: L });
    h.until(() => inLevel(h), 900);
    // 8-4's castle: in Classic mode an ordinary castle on to World 9 (Game.classicCastle).
    const next = h.game.classicCastle('ll-8-4')?.next;
    expect(next).toBe('ll-9-1-start');
    (h.top() as LevelScene).world.events.push({ type: 'exit', next: next as string });
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(levelOf(h)).toMatch(/^ll-9-1/);
    // The Level Select cheat in the run, on to D-4, and its castle ends the set.
    h.game.classicLevelSelect('ll-13-4');
    h.until(() => inLevel(h), 900);
    h.game.showEnding('ll-13-4');
    const f = loadClearedFile(L);
    expect(f?.run.worlds).toEqual([8, 9, 13]);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('ll-13-4');
    closeUnlockCards(h);
    readNote(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
    const worlds = labels(h.top());
    expect(worlds).toContain('World 9');
    expect(worlds).toContain('World D');
    expect(worlds).not.toContain('World A');
  });
});
