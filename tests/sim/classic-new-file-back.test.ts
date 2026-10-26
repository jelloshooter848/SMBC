import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { CharacterSelectScene } from '@game/scenes/character-select';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFileRulesScene, ClassicFilesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

// v0.4.72 38c: BACK from a new file's hero select is the rules box again with the cursor on
// START (the row that opened the select), not on Game mode, and that is what it says.

useStorage();
afterEach(() => store.clear());

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const idx = (s: unknown) => (s as { index: number }).index;

function toSelect(set = 'Super Mario Bros.') {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  h.game.showClassicMenu();
  choose(h, set);
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  choose(h, 'File 3');
  choose(h, 'Hard');
  choose(h, 'Start');
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  return h;
}

describe('38c: BACK from a new file’s select lands on START', () => {
  for (const set of ['Super Mario Bros.', 'The Lost Levels'])
    it(`${set}: the rules box again, on START, saying so`, () => {
      const h = toSelect(set);
      h.idle(12);
      h.tap('attack');
      const r = h.top();
      expect(r).toBeInstanceOf(ClassicFileRulesScene);
      expect(items(r)[idx(r)]?.label).toBe('Start');
      expect(h.said.at(-1)).toMatch(/^File 3 rules, Hard\..*Start/);
      expect(h.said.at(-1)).not.toMatch(/Game mode/);
      // START from there opens the select again.
      h.idle(8);
      h.tap('jump');
      expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    });

  // v0.4.73 item 53 (owner): it opens on START now, as it does back from the select.
  it('a rules box opened from the difficulty box starts on START (item 53)', () => {
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    choose(h, 'File 1');
    choose(h, 'Normal');
    const r = h.top();
    expect(r).toBeInstanceOf(ClassicFileRulesScene);
    expect(items(r)[idx(r)]?.label).toBe('Start');
  });
});
