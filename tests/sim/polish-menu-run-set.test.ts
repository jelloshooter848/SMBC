import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { GameOverScene } from '@game/scenes/game-over';
import { MAP_SETS, ClassicMenuScene } from '@game/scenes/original-game';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// P2: leaving a Classic run (Quit, or MAIN MENU after its game over) lands on the CLASSIC menu
// with the run's own map set focused, not the first.

useStorage();
afterEach(() => store.clear());

function run(levelId: string): H {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  h.game.classicGame(MARIO, levelId);
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
