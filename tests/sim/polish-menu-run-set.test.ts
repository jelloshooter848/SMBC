import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { GameOverScene } from '@game/scenes/game-over';
import { LevelScene } from '@game/scenes/level';
import { MAP_SETS, ClassicMenuScene, mapSetOf } from '@game/scenes/original-game';
import { pickAtContinue } from './continue-select';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// P2: leaving a Classic run (Quit, or MAIN MENU after its game over) lands on the CLASSIC menu
// with the run's own map set focused, not the first.

useStorage();
afterEach(() => store.clear());

function run(levelId: string): H {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  // B-L: a Classic run plays in a file of its set.
  h.game.classicGame(MARIO, levelId, { ref: { set: mapSetOf(levelId).id, slot: 1 } });
  h.game.goToLevel(levelId, { mode: 'stand' });
  return h;
}

const focused = (h: H) => {
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  return MAP_SETS[(h.top() as unknown as { index: number }).index]?.id;
};

describe('P2: the CLASSIC menu after a run focuses its set', () => {
  for (const [set, level] of [
    ['special', 'sp-1-2'],
    ['lost', 'll-1-2'],
    ['smb', '1-2'],
  ] as const) {
    it(`Quit from a ${set} run`, () => {
      const h = run(level);
      h.game.quitClassicRun();
      expect(focused(h)).toBe(set);
    });

    it(`MAIN MENU after a ${set} run's game over`, () => {
      const h = run(level);
      h.game.gameOver(level);
      h.until(() => h.top() instanceof GameOverScene && (h.top() as GameOverScene).prompting, 900);
      h.tap('down');
      h.tap('jump');
      expect(focused(h)).toBe(set);
    });
  }
});

// 36a (v0.4.71): a practice run (the menus' Level Select) has no file; leaving it focuses the
// set of the level it was playing, not SMB.
describe('36a: the CLASSIC menu after a practice run focuses its set', () => {
  function practice(levelId: string): H {
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    h.game.classicLevelSelect(levelId);
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
    expect(h.game.practiceRun).toBe(true);
    return h;
  }

  for (const [set, level] of [
    ['special', 'sp-1-2'],
    ['lost', 'll-1-2'],
    ['smb', '1-2'],
  ] as const) {
    it(`Quit from a ${set} practice run`, () => {
      const h = practice(level);
      h.game.quitClassicRun();
      expect(focused(h)).toBe(set);
    });

    it(`MAIN MENU after a ${set} practice run's game over`, () => {
      const h = practice(level);
      h.game.gameOver(level);
      h.until(() => h.top() instanceof GameOverScene && (h.top() as GameOverScene).prompting, 900);
      h.tap('down');
      h.tap('jump');
      expect(focused(h)).toBe(set);
    });
  }
});
