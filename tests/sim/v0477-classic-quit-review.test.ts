import { afterEach, describe, expect, it, vi } from 'vitest';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { eraseClassicFile, originalFileRules, type ClassicFileRef } from '@game/original-files';
import { CharacterSelectScene } from '@game/scenes/character-select';
import type { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import { QUIT_RUN_TITLE, QUIT_SELECT_TITLE, QuitRunScene } from '@game/scenes/quit-run';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { draw, store, useStorage } from './heroes-harness';
import { classic, inLevel, keepCleared, openFiles, stored, type G } from './cleared-nav';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';

/*
 * v0.4.77 break-it review of items 178 and 196/197 (rule 33a: these tests come before the fix).
 * MUST 1: the "can't save" note of a file run that lost its file never shows in a later run's
 * Quit box (a dev or link run). SHOULD 1: Pause > Quit > YES in a CLEARED file's replay goes to
 * the file box (no clear counted, the file unchanged); in a stage round it is not the select, and
 * Give up ends the round. NIT 1: the card always matches where YES goes. NIT 3: Survival, Single
 * hero and the Lost Levels' 9-1 start.
 */

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const NOTE = /another window|can't save/i;
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const idx = (s: unknown) => (s as { index: number }).index;
const screen = (h: G) =>
  draw(h.game.scenes as never)
    .texts.map((x) => x.str)
    .join(' ');

function openPause(h: G): PauseScene {
  h.tap('start');
  const pause = h.top() as PauseScene;
  expect(pause).toBeInstanceOf(PauseScene);
  h.idle(6);
  return pause;
}

function moveTo(h: G, menu: unknown, label: string): void {
  const row = labels(menu).indexOf(label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  for (let n = 0; idx(menu) !== row && n < 20; n++) h.tap(idx(menu) < row ? 'down' : 'up');
}

function pauseQuit(h: G, pause: PauseScene = openPause(h)): QuitRunScene {
  moveTo(h, pause, 'Quit');
  h.tap('jump');
  const card = h.top() as QuitRunScene;
  expect(card).toBeInstanceOf(QuitRunScene);
  return card;
}

function yes(h: G): void {
  h.idle(6);
  h.tap('down');
  h.tap('jump');
}

/** A file run in tab 1 whose file another tab (erased and) started again: tab 1 cannot save. */
function lostFileRun(): G {
  const t1 = classic();
  t1.game.classicGame(MARIO, '1-1', { ref: A });
  t1.until(() => inLevel(t1), 900);
  t1.idle(4);
  const t2 = classic();
  eraseClassicFile(A);
  t2.game.classicGame(LINK, '1-1', { ref: A });
  t2.until(() => inLevel(t2), 900);
  return t1;
}

describe("MUST 1: a lost file's note stays with its run", () => {
  it('a lost file run, then a dev Classic run: its Quit box shows and says no note', () => {
    const t1 = lostFileRun();
    pauseQuit(t1);
    expect(t1.said.at(-1)).toMatch(NOTE);
    // Leave that run for the CLASSIC menu, then start a dev Classic run.
    t1.game.quitClassicRun();
    expect(t1.top()).toBeInstanceOf(ClassicMenuScene);
    t1.game.devClassicGame(MARIO, '1-1', 'classic');
    t1.until(() => inLevel(t1), 900);
    t1.idle(4);
    pauseQuit(t1);
    expect(t1.said.at(-1)).toBe('Quit to character select? No');
    t1.idle(4);
    expect(screen(t1)).not.toMatch(/ANOTHER WINDOW|CAN'T SAVE/);
    expect(t1.game.runFileNote).toBeNull();
  });

  it('a lost file run, then a link run: no note either', () => {
    const t1 = lostFileRun();
    pauseQuit(t1);
    t1.game.showClassicTitle();
    t1.game.devClassicGame(LINK, '1-2', 'classic', false);
    t1.until(() => inLevel(t1), 900);
    t1.idle(4);
    pauseQuit(t1);
    expect(t1.said.at(-1)).not.toMatch(NOTE);
    expect(t1.game.runFileNote).toBeNull();
  });
});

describe('SHOULD 1: the runs that keep their old Quit', () => {
  it("a CLEARED file's replay: Pause > Quit > YES is its file box, no clear counted, the file unchanged", () => {
    keepCleared(A);
    store.set(REPLAY_HELP_KEY, 'true');
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    h.idle(4);
    const before = stored();
    const card = pauseQuit(h);
    expect(card.title).toMatch(/FILE BOX/);
    yes(h);
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(stored()).toBe(before);
    expect(h.game.classicRun).toBe(false);
  });

  it('a stage round: Give up ends the round; Quit is not the select', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 900);
    h.idle(4);
    const done = vi.fn();
    h.game.stageRound = { base: null, done };
    expect(h.game.quitsToSelect).toBe(false);
    const pause = openPause(h);
    expect(labels(pause)).toContain('Give up');
    expect(items(pause).find((i) => i.label === 'Quit')?.hint).toBe('Back to the Classic menu');
    const card = pauseQuit(h, pause);
    expect(card.title).toBe(QUIT_RUN_TITLE);
    h.idle(6);
    h.tap('jump'); // NO
    expect(h.top()).toBe(pause);
    moveTo(h, pause, 'Give up');
    h.tap('jump');
    expect(done).toHaveBeenCalledWith('quit');
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
  });
});

describe('NIT 1: the card matches where YES goes, whenever the pause was built', () => {
  it('the run changes its mind after the pause opened: the card and YES follow it', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 900);
    h.idle(4);
    const pause = openPause(h);
    // A stage round begins while the pause is up: Quit is the CLASSIC menu's now.
    h.game.stageRound = { base: null, done: () => {} };
    const card = pauseQuit(h, pause);
    expect(card.title).toBe(QUIT_RUN_TITLE);
    h.game.stageRound = null;
    h.game.scenes.pop();
    expect(h.top()).toBe(pause);
    const again = pauseQuit(h, pause);
    expect(again.title).toBe(QUIT_SELECT_TITLE);
  });
});

describe('NIT 3: Survival, Single hero, the Lost Levels 9-1 start', () => {
  it('Survival: YES is the select, lives kept, the hero not fallen', () => {
    const h = classic();
    const rules = originalFileRules();
    rules.options.gameMode = 'survival';
    h.game.classicGame(MARIO, '1-1', { ref: A, rules });
    h.until(() => inLevel(h), 900);
    h.idle(4);
    const lives = h.game.state.lives;
    const hero = h.game.slotOf(h.game.state.character).id;
    expect(h.game.survival?.isFallen(hero)).toBe(false);
    const card = pauseQuit(h);
    expect(card.title).toBe(QUIT_SELECT_TITLE);
    yes(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state.lives).toBe(lives);
    expect(h.game.survival?.isFallen(hero)).toBe(false);
  });

  it('Single hero (no select after the first pick): the CLASSIC menu card, and YES goes there', () => {
    const h = classic();
    const rules = originalFileRules();
    rules.options.gameMode = 'single';
    h.game.classicGame(MARIO, '1-1', { ref: A, rules });
    h.until(() => inLevel(h), 900);
    h.idle(4);
    const pause = openPause(h);
    expect(items(pause).find((i) => i.label === 'Quit')?.hint).toBe('Back to the Classic menu');
    const card = pauseQuit(h, pause);
    expect(card.title).toBe(QUIT_RUN_TITLE);
    yes(h);
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  });

  it("the Lost Levels' 9-1: YES is the select for its first area (9-1's start)", () => {
    const h = classic((s) => void (s.dev = true));
    h.game.devClassicGame(MARIO, 'll-9-1', 'classic');
    h.until(() => inLevel(h), 900);
    h.idle(4);
    const main = (h.top() as LevelScene).level;
    expect(main.parent ?? main.id).toMatch(/^ll-9-1/);
    pauseQuit(h);
    yes(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.selectLevel).toBe('ll-9-1-start');
  });
});
