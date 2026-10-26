import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

/*
 * Item 120: while saves cannot be read (getItem throws), the CLASSIC map set box says so on each
 * set's row, instead of "No files used" (every file would read as empty). Read out with the row.
 */

useStorage();
afterEach(() => store.clear());

function game() {
  const settings: Settings = { ...defaultSettings() };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}
const items = (s: unknown) => (s as { items: MenuItem[] }).items;

function denyReads(): void {
  const deny = () => {
    throw new Error('denied');
  };
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: deny,
    setItem: deny,
    removeItem: deny,
  };
}

describe('item 120: the CLASSIC map set box while saves cannot be read', () => {
  it('each set row says the saves cannot be read, not "No files used", and it is read out', () => {
    const h = game();
    denyReads();
    h.game.showClassicMenu();
    const m = h.top();
    expect(m).toBeInstanceOf(ClassicMenuScene);
    for (const it of items(m).slice(0, 3)) {
      expect(it.hint).toMatch(/Saves can't be read right now$/);
      expect(it.hint).not.toMatch(/files? used/);
    }
    expect(h.said.join(' ')).toMatch(/Saves can't be read right now/);
    // The box still opens, and says why.
    choose(h, 'Super Mario Bros.');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  });

  it('readable storage: the count as before', () => {
    const h = game();
    h.game.showClassicMenu();
    expect(items(h.top())[0]?.hint).toMatch(/No files used$/);
  });
});
