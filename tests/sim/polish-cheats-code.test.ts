import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { CheatsScene } from '@game/scenes/cheats-menu';
import type { MenuItem } from '@game/scenes/menu';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// The Cheats page's code entry (CheatMenu.as): leaving it plays the original's bump
// (cancelCodeInput: SFX_GAME_HIT_CEILING), and its line names BACK's key as the page does.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);

function codeEntry(scheme?: 'keyboard' | 'touch'): H {
  const settings = defaultSettings();
  const h = makeGame({
    deps: { settings, applySettings: () => {}, ...(scheme ? { controlScheme: () => scheme } : {}) },
  });
  const page = new CheatsScene(h.game, () => h.game.scenes.pop(), { all: false });
  h.game.scenes.push(page);
  h.idle(8);
  for (let i = 0; i < labels(page).indexOf('Enter code'); i++) h.tap('down');
  h.tap('jump');
  return h;
}

describe('Cheats > Enter code', () => {
  it("SELECT leaves the code with the original's bump, not the menu blip", () => {
    const h = codeEntry();
    h.audio.sfx.mockClear();
    h.tap('select');
    expect(h.said.at(-1)).toBe('Back. Enter code.');
    expect(h.audio.sfx).toHaveBeenCalledWith('bump');
    expect(h.audio.sfx).not.toHaveBeenCalledWith('select');
  });
});
