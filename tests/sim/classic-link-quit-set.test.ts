import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { GameOverScene } from '@game/scenes/game-over';
import { LevelScene } from '@game/scenes/level';
import { MAP_SETS, ClassicMenuScene } from '@game/scenes/original-game';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// v0.4.72 38d: a `?level=` link's Classic run (devClassicGame; no file, no select) on SMB
// Special or The Lost Levels came back to the CLASSIC menu on Super Mario Bros. after its game
// over's MAIN MENU (no level on the stack then, and no select level). It focuses the link
// level's set, as 36a does for practice runs.

useStorage();
afterEach(() => store.clear());

function link(levelId: string, dev = false): H {
  const h = makeGame({ dev, deps: { settings: { ...defaultSettings(), dev }, applySettings: () => {} } });
  h.game.devClassicGame(MARIO, levelId, 'classic', dev);
  h.until(() => h.top() instanceof LevelScene, 900);
  return h;
}
const focused = (h: H) => {
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  return MAP_SETS[(h.top() as unknown as { index: number }).index]?.id;
};
function mainMenuAfterGameOver(h: H, level: string): void {
  h.game.gameOver(level);
  h.until(() => h.top() instanceof GameOverScene && (h.top() as GameOverScene).prompting, 900);
  h.tap('down');
  h.tap('jump');
}

describe('38d: leaving a link run focuses its set', () => {
  for (const [set, level] of [
    ['special', 'sp-1-2'],
    ['lost', 'll-1-2'],
    ['smb', '1-2'],
  ] as const) {
    it(`Quit from a ${set} link run`, () => {
      const h = link(level);
      h.game.quitClassicRun();
      expect(focused(h)).toBe(set);
    });

    it(`MAIN MENU after a ${set} link run's game over`, () => {
      const h = link(level);
      mainMenuAfterGameOver(h, level);
      expect(focused(h)).toBe(set);
    });

    it(`MAIN MENU after a ${set} developer link run's game over`, () => {
      const h = link(level, true);
      mainMenuAfterGameOver(h, level);
      expect(focused(h)).toBe(set);
    });
  }
});
