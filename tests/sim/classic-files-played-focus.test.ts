import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { GameOverScene } from '@game/scenes/game-over';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import type { ClassicFileRef } from '@game/original-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { choose } from './classic-files-nav';

// v0.4.72 38e: after leaving a Classic run, picking its set opens the file box on the file
// just played, not FILE 1.

useStorage();
afterEach(() => store.clear());

const game = () => makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
const idx = (s: unknown) => (s as { index: number }).index;
function play(h: H, ref: ClassicFileRef, levelId: string): void {
  h.game.classicGame(MARIO, levelId, { ref });
  h.game.goToLevel(levelId, { mode: 'stand' });
}
function openSet(h: H, label: string): ClassicFilesScene {
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  choose(h, label);
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  return h.top() as ClassicFilesScene;
}

describe('38e: the file box opens on the file just played', () => {
  it('Quit from FILE 3: SMB opens on FILE 3, and says so', () => {
    const h = game();
    play(h, { set: 'smb', slot: 3 }, '1-2');
    h.game.quitClassicRun();
    const box = openSet(h, 'Super Mario Bros.');
    expect(idx(box)).toBe(2);
    expect(h.said.at(-1)).toMatch(/^Super Mario Bros\. Choose a file\. File 3: /);
  });

  it('MAIN MENU after a game over in FILE 2 of The Lost Levels', () => {
    const h = game();
    play(h, { set: 'lost', slot: 2 }, 'll-1-2');
    h.game.gameOver('ll-1-2');
    h.until(() => h.top() instanceof GameOverScene && (h.top() as GameOverScene).prompting, 900);
    h.tap('down');
    h.tap('jump');
    expect(idx(openSet(h, 'The Lost Levels'))).toBe(1);
  });

  it('another set still opens on FILE 1', () => {
    const h = game();
    play(h, { set: 'smb', slot: 3 }, '1-2');
    h.game.quitClassicRun();
    expect(idx(openSet(h, 'SMB Special'))).toBe(0);
  });

  it('with no run played yet: FILE 1', () => {
    const h = game();
    h.game.showClassicMenu();
    expect(idx(openSet(h, 'Super Mario Bros.'))).toBe(0);
  });

  it('leaving a run for the title forgets it: FILE 1', () => {
    const h = game();
    play(h, { set: 'smb', slot: 3 }, '1-2');
    h.game.showTitle();
    h.game.showClassicMenu();
    expect(idx(openSet(h, 'Super Mario Bros.'))).toBe(0);
  });

  it('BACK from the file box and in again: still on the file played', () => {
    const h = game();
    play(h, { set: 'smb', slot: 3 }, '1-2');
    h.game.quitClassicRun();
    openSet(h, 'Super Mario Bros.');
    choose(h, 'Back');
    expect(idx(openSet(h, 'Super Mario Bros.'))).toBe(2);
  });
});
