import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { defaultClassicSettings } from '@engine/save/original-options';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { draw, makeGame, useStorage } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// O-10 removed the pick's prompt line; revive mode (Survival) keeps its own, and it still fits on
// the screen with a long key name (it drops the key then), as the pick's prompt used to.

useStorage();
isolateClassicRegistry({ hideExtras: true });

function reviveSelect(longKey: boolean): CharacterSelectScene {
  const settings = {
    ...defaultSettings(),
    classic: { ...defaultClassicSettings(), gameMode: 'survival' as const },
  };
  const keys = settings.input.bindings[0];
  if (longKey && keys) keys.keyboard.jump = ['NumpadEnter'];
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  expect(sel.reviving).toBe(true);
  return sel;
}

describe('O-10: the revive prompt always fits on the screen', () => {
  for (const longKey of [false, true])
    it(longKey ? 'with a long key name (dropped)' : 'with the usual key', () => {
      const t = draw(reviveSelect(longKey)).texts.filter((x) => /^OK\b.* TO /.test(x.str));
      expect(t.length).toBeGreaterThan(0);
      for (const x of t) {
        expect(x.x).toBeGreaterThanOrEqual(8);
        expect(x.x + x.str.length * 8).toBeLessThanOrEqual(248);
      }
    });
});
