import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicTitleScene } from '@game/scenes/original-title';
import {
  ClassicDifficultyScene,
  ClassicEraseConfirmScene,
  ClassicEraseScene,
  ClassicFileRulesScene,
  ClassicFilesScene,
} from '@game/scenes/original-files-menu';
import { ClassicOptionRowsScene } from '@game/scenes/original-options';
import { ClassicHeroesScene } from '@game/scenes/disable-heroes';
import { loadClassicFile, originalFileRules, type ClassicFileRef } from '@game/original-files';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';
import { choose, newFile } from './classic-files-nav';

// B-L step 3: the Classic save file screens, in the Classic style. The set box (the three map
// sets and BACK), each set's file box (FILE 1-3, ERASE FILE, BACK), a new file's difficulty box
// and rules box, and ERASE FILE's picker and its "ERASE FILE N?" confirm, NO first. Every box is
// over the CLASSIC title's live demo, with the original's sounds, every line announced, and BACK
// steps back one box.

useStorage();
afterEach(() => store.clear());

type G = H & { settings: Settings };
function classic(over: Partial<Settings> = {}): G {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const values = (s: unknown) => items(s).map((i) => i.value?.() ?? null);
const idx = (s: unknown) => (s as { index: number }).index;
const inLevel = (h: H) => h.top() instanceof LevelScene;
const titles = (h: H) =>
  (h.game.scenes as unknown as { stack: unknown[] }).stack.filter((x) => x instanceof ClassicTitleScene)
    .length;
const sounds = (h: H) => h.audio.sfx.mock.calls.map((c) => c[0] as string);
const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const F2: ClassicFileRef = { set: 'smb', slot: 2 };

/** A run kept in file `ref` at `levelId`'s WORLD card, then the title. */
function keep(h: H, ref: ClassicFileRef, levelId: string, lives = 3, score = 0): void {
  const rules = originalFileRules();
  rules.difficulty = 'hard';
  rules.options.gameMode = 'survival';
  h.game.classicGame(MARIO, levelId, { ref, rules });
  h.game.state.lives = lives;
  h.game.state.score = score;
  h.game.goToLevel(levelId, { mode: 'stand' });
  h.game.showTitle();
}

/** The CLASSIC set box over the title, then set row `label` picked. */
function openSet(h: H, label = 'Super Mario Bros.'): ClassicFilesScene {
  h.game.showClassicMenu();
  choose(h, label);
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  return h.top() as ClassicFilesScene;
}

describe('B-L the set box', () => {
  it('SUPER MARIO BROS. / SMB SPECIAL / THE LOST LEVELS / BACK: no Map difficulty, no Options', () => {
    const h = classic();
    h.game.showClassicTitle('start');
    (h.top() as ClassicTitleScene).items[0]?.select?.();
    const m = h.top() as ClassicMenuScene;
    expect(m).toBeInstanceOf(ClassicMenuScene);
    expect(labels(m)).toEqual(['Super Mario Bros.', 'SMB Special', 'The Lost Levels', 'Back']);
    expect(items(m)[0]?.hint).toMatch(/No files used/);
    keep(h, F1, '1-2');
    h.game.showClassicMenu();
    expect(items(h.top())[0]?.hint).toMatch(/1 file used/);
    // BACK: the Start box again.
    choose(h, 'Back');
    expect(h.top()).toBeInstanceOf(ClassicTitleScene);
  });
});

describe('B-L the file box', () => {
  it('FILE 1-3, ERASE FILE, BACK: a used file shows difficulty, world, lives, score and hero', () => {
    const h = classic();
    keep(h, F2, '4-2', 2, 12300);
    const box = openSet(h);
    expect(labels(box)).toEqual(['File 1', 'File 2', 'File 3', 'Erase file', 'Back']);
    expect(values(box).slice(0, 3)).toEqual(['NEW GAME', 'HARD 4-2 X2', 'NEW GAME']);
    expect(h.said.at(-1)).toMatch(/^Super Mario Bros\. Choose a file\. File 1: NEW GAME\. Empty/);
    expect(box.translucent).toBe(true);
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toBe(
      'File 2: HARD 4-2 X2. Hard, World 4-2, 2 lives, score 12300, Mario, Survival. Continue this file',
    );
    const t = draw(box).texts.map((x) => x.str);
    expect(t).toEqual(expect.arrayContaining(['SUPER MARIO BROS.', 'FILE 2', 'HARD 4-2 X2', 'ERASE FILE']));
    // The hero and score under the box, for the highlighted used file.
    expect(t).toContain('MARIO SCORE 12300');
    expect(titles(h)).toBe(1);
  });

  it('plays on under the demo, with the original sounds; BACK steps back to the set box', () => {
    const h = classic();
    const box = openSet(h);
    const tick = vi.spyOn((box as unknown as { over: ClassicTitleScene }).over, 'tickDemo');
    h.idle(5);
    expect(tick).toHaveBeenCalledTimes(5);
    h.audio.sfx.mockClear();
    h.tap('down');
    h.tap('attack');
    expect(sounds(h)).toEqual(['fireball', 'bump']);
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    expect(idx(h.top())).toBe(0);
  });

  it('a used file goes straight to CONTINUE: the select, then its level; it says what it plays', () => {
    const h = classic();
    keep(h, F1, '3-1');
    openSet(h);
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^3-1/);
    expect(h.said.find((s) => s.startsWith('Continue.'))).toMatch(/^Continue\. Survival, Hard\./);
  });
});

describe('B-L a new file', () => {
  it('difficulty (Easy / Normal / Hard), then its rules box, then START: the select, then play', () => {
    const h = classic();
    openSet(h, 'SMB Special');
    choose(h, 'File 3');
    const d = h.top() as ClassicDifficultyScene;
    expect(d).toBeInstanceOf(ClassicDifficultyScene);
    expect(labels(d)).toEqual(['Easy', 'Normal', 'Hard', 'Back']);
    expect(idx(d)).toBe(1);
    expect(h.said.at(-1)).toMatch(/^File 3, new game\. Choose the map difficulty/);
    choose(h, 'Hard');
    const r = h.top() as ClassicFileRulesScene;
    expect(r).toBeInstanceOf(ClassicFileRulesScene);
    expect(labels(r)).toEqual(['Game mode', 'More settings', 'Weapons', 'Disable heroes', 'Start', 'Back']);
    expect(values(r).slice(0, 4)).toEqual(['All heroes', 'Original', 'Original', 'All on']);
    expect(h.said.at(-1)).toMatch(/^File 3 rules, Hard\. They are fixed once the file starts/);
    choose(h, 'Start');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^sp-1-1/);
    expect(loadClassicFile({ set: 'special', slot: 3 })?.rules.difficulty).toBe('hard');
  });

  it("its rules start at the original's defaults, not the last file's", () => {
    const h = classic();
    keep(h, F1, '1-1');
    openSet(h);
    choose(h, 'File 2');
    choose(h, 'Normal');
    expect(values(h.top()).slice(0, 4)).toEqual(['All heroes', 'Original', 'Original', 'All on']);
  });

  it('the sub-pages are boxes over the demo, changing only the draft', () => {
    const h = classic();
    const before = JSON.stringify(h.settings.classic);
    openSet(h);
    choose(h, 'File 1');
    choose(h, 'Normal');
    const r = h.top() as ClassicFileRulesScene;
    // Game mode, with left and right, the coin (v0.4.73 item 53: UP from START to it).
    h.idle(8);
    for (let i = 0; i < 6 && idx(r) !== 0; i++) h.tap('up');
    h.audio.sfx.mockClear();
    h.tap('right');
    h.tap('left');
    h.tap('jump');
    expect(sounds(h)).toEqual(['coin', 'coin', 'coin']);
    expect(r.draft.options.gameMode).toBe('survival');
    choose(h, 'More settings');
    const more = h.top() as ClassicOptionRowsScene;
    expect(more).toBeInstanceOf(ClassicOptionRowsScene);
    expect(more.translucent).toBe(true);
    h.idle(8);
    h.tap('right');
    expect(r.draft.options.lives).toBe(5);
    h.tap('attack');
    expect(h.top()).toBe(r);
    expect(values(r)[1]).toBe('Changed');
    choose(h, 'Disable heroes');
    expect(h.top()).toBeInstanceOf(ClassicHeroesScene);
    h.idle(8);
    h.tap('right');
    expect(r.draft.heroesOff).toEqual(['mario']);
    h.tap('attack');
    expect(values(r)[3]).toBe('Some off');
    expect(JSON.stringify(h.settings.classic)).toBe(before);
    expect(h.settings.classicHeroesOff).toBeUndefined();
    // START: the run plays the draft.
    choose(h, 'Start');
    expect(h.game.classicRunRules.options).toMatchObject({ gameMode: 'survival', lives: 5 });
    expect(h.game.heroSlots.map((c) => c.id)).not.toContain('mario');
  });

  it('BACK steps back one box: select → rules (kept) → difficulty → files', () => {
    const h = classic();
    openSet(h);
    choose(h, 'File 2');
    choose(h, 'Easy');
    const r = h.top() as ClassicFileRulesScene;
    h.idle(8);
    for (let i = 0; i < 6 && idx(r) !== 0; i++) h.tap('up'); // v0.4.73 item 53: from START
    h.tap('right'); // Game mode: Survival
    choose(h, 'Start');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('attack');
    const again = h.top() as ClassicFileRulesScene;
    expect(again).toBeInstanceOf(ClassicFileRulesScene);
    expect(again).not.toBe(r);
    expect(again.draft).toMatchObject({ difficulty: 'easy', options: { gameMode: 'survival' } });
    expect(titles(h)).toBe(1);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicDifficultyScene);
    expect(idx(h.top())).toBe(0);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(idx(h.top())).toBe(1);
    // The file is still empty: nothing is saved before the first WORLD card.
    expect(loadClassicFile(F2)).toBeNull();
  });

  it('SMB Special asks the difficulty too (the original has Easy and Hard layers for it)', () => {
    const h = classic();
    openSet(h, 'SMB Special');
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicDifficultyScene);
  });
});

describe('B-L ERASE FILE', () => {
  it('pick a file, then "ERASE FILE N?" with NO first; YES empties it', () => {
    const h = classic();
    keep(h, F1, '2-1');
    keep(h, F2, '5-1');
    openSet(h);
    choose(h, 'Erase file');
    const pick = h.top() as ClassicEraseScene;
    expect(pick).toBeInstanceOf(ClassicEraseScene);
    expect(values(pick).slice(0, 3)).toEqual(['HARD 2-1 X3', 'HARD 5-1 X3', 'EMPTY']);
    choose(h, 'File 2');
    const c = h.top() as ClassicEraseConfirmScene;
    expect(c).toBeInstanceOf(ClassicEraseConfirmScene);
    expect(labels(c)).toEqual(['No', 'Yes']);
    expect(idx(c)).toBe(0);
    expect(h.said.at(-1)).toMatch(/^Erase file 2\? Hard, World 5-1.*It cannot be undone\. No/);
    expect(draw(c).texts.map((x) => x.str)).toContain('ERASE FILE 2?');
    // It waits for a press.
    h.idle(300);
    expect(h.top()).toBe(c);
    choose(h, 'Yes');
    const box = h.top() as ClassicFilesScene;
    expect(box).toBeInstanceOf(ClassicFilesScene);
    expect(values(box).slice(0, 3)).toEqual(['HARD 2-1 X3', 'NEW GAME', 'NEW GAME']);
    expect(idx(box)).toBe(1);
    expect(h.said.at(-1)).toMatch(/^File 2 erased\./);
    expect(loadClassicFile(F2)).toBeNull();
    expect(loadClassicFile(F1)).not.toBeNull();
  });

  it('OK on NO, and BACK, keep the file and step back one box', () => {
    const h = classic();
    keep(h, F1, '2-1');
    openSet(h);
    choose(h, 'Erase file');
    choose(h, 'File 1');
    h.idle(8);
    h.tap('jump'); // NO
    expect(h.top()).toBeInstanceOf(ClassicEraseScene);
    choose(h, 'File 1');
    h.idle(8);
    h.tap('attack'); // BACK means NO
    expect(h.top()).toBeInstanceOf(ClassicEraseScene);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(loadClassicFile(F1)).not.toBeNull();
  });

  it('an empty file cannot be picked; with every file empty ERASE FILE says so', () => {
    const h = classic();
    openSet(h);
    choose(h, 'Erase file');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(h.said.at(-1)).toBe('Every file is empty.');
    keep(h, F1, '2-1');
    openSet(h);
    choose(h, 'Erase file');
    choose(h, 'File 3');
    expect(h.top()).toBeInstanceOf(ClassicEraseScene);
    expect(h.said.at(-1)).toBe('File 3 is empty.');
  });

  it('an erased file starts again at the original rules', () => {
    const h = classic();
    keep(h, F1, '2-1');
    openSet(h);
    choose(h, 'Erase file');
    choose(h, 'File 1');
    choose(h, 'Yes');
    newFile(h, 1);
    expect(h.game.classicRunRules).toEqual(originalFileRules());
  });
});

describe('B-L an unreadable file', () => {
  it('shows UNREADABLE, never starts a new game over it, and ERASE FILE empties it', () => {
    const h = classic();
    store.set('smbc-classic-file-smb-2', '{"v":1,"run":{"broken":true}}');
    const box = openSet(h);
    expect(values(box).slice(0, 3)).toEqual(['NEW GAME', 'UNREADABLE', 'NEW GAME']);
    choose(h, 'File 2');
    expect(h.top()).toBe(box);
    expect(h.said.at(-1)).toBe('File 2 cannot be read. Erase it to use it again.');
    // START on it is refused too (a run is never started into it).
    h.game.startClassicFile(F2, originalFileRules(), () => {});
    expect(h.top()).toBe(box);
    choose(h, 'Erase file');
    expect(values(h.top()).slice(0, 3)).toEqual(['EMPTY', 'UNREADABLE', 'EMPTY']);
    choose(h, 'File 2');
    expect(h.said.at(-1)).toMatch(/^Erase file 2\? It cannot be read\./);
    choose(h, 'Yes');
    expect(store.has('smbc-classic-file-smb-2')).toBe(false);
    expect(values(h.top()).slice(0, 3)).toEqual(['NEW GAME', 'NEW GAME', 'NEW GAME']);
  });

  it('a Survival run with no lives left is kept and goes on (lives only revive heroes)', () => {
    const h = classic();
    const rules = originalFileRules();
    rules.options.gameMode = 'survival';
    h.game.classicGame(MARIO, '2-1', { ref: F1, rules });
    h.game.state.lives = 0;
    h.game.goToLevel('2-2', { mode: 'stand' });
    expect(loadClassicFile(F1)?.run.lives).toBe(0);
    h.game.showTitle();
    const box = openSet(h);
    // No "X0": a Survival run's lives only revive heroes.
    expect(values(box)[0]).toBe('NORMAL 2-2');
    expect(items(box)[0]?.hint).not.toMatch(/lives|, ,/);
    expect(h.game.resumeClassic(F1)).toBe(true);
  });
});

describe('B-L phone touch', () => {
  it('every box shows OK and BACK', () => {
    const h = classic();
    keep(h, F1, '2-1');
    openSet(h);
    for (const step of ['Erase file', 'File 1']) {
      expect(h.top()?.touchLabels?.()).toMatchObject({ jump: 'OK', attack: 'BACK' });
      choose(h, step);
    }
    expect(h.top()?.touchLabels?.()).toMatchObject({ jump: 'OK', attack: 'BACK' });
  });
});
