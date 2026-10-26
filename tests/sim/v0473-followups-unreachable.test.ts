import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import * as filesMenu from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';

/*
 * Item 127: item 94 (no Level Select cheat) left code no run reaches any more: a file's run that
 * went into another map set (SET_SHORT, "SP 2-1"), and Game.runSet's fall back to the select's
 * level for a practice run quit before it played a level. Dev Classic and link runs still reach
 * runSet's no-file branch (36a, 38d): it reads the level playing, else the run's last level.
 */

useStorage();
afterEach(() => store.clear());

describe('item 127: what item 94 left unreachable is gone', () => {
  it('no SET_SHORT: a file run never leaves its map set', () => {
    expect('SET_SHORT' in filesMenu).toBe(false);
  });

  for (const [set, level] of [
    ['special', 'sp-1-2'],
    ['lost', 'll-1-2'],
  ] as const) {
    it(`a ${set} dev Classic run with no level on the stack still gives its set (its last level)`, () => {
      const h = makeGame({
        deps: { settings: { ...defaultSettings(), dev: true }, applySettings: () => {} },
      });
      h.game.devClassicGame(MARIO, level, 'classic');
      h.until(() => h.top() instanceof LevelScene, 900);
      expect(h.game.classicFile).toBeNull();
      h.game.scenes.clear();
      expect(h.game.runSet).toBe(set);
    });
  }
});
