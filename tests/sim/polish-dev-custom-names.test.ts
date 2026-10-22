import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { LIBRARY_KEY } from '@game/level/library';
import { DevCampaignScene } from '@game/scenes/dev-play';
import type { MenuItem } from '@game/scenes/menu';
import { makeGame, store, useStorage } from './heroes-harness';

// P8: Dev > Level select > Campaign > Custom levels lists each level by the name it was saved
// under in the editor (as Options > Custom levels does), the id only when there is none.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);

describe('P8: dev Custom levels show their names', () => {
  it('the saved name, else the id; said the same way', () => {
    store.set(LIBRARY_KEY, JSON.stringify({ v: 1, levels: { 'My Test': 'id: x' } }));
    const h = makeGame({
      dev: true,
      deps: {
        settings: { ...defaultSettings(), dev: true },
        applySettings: () => {},
        listLevels: () => ['1-1', 'custom-my-test', 'custom-gone'],
      },
    });
    h.game.scenes.push(new DevCampaignScene(h.game));
    const campaign = h.top();
    h.idle(8);
    const at = labels(campaign).indexOf('Custom levels');
    for (let i = 0; i < at; i++) h.tap('down');
    h.tap('jump');
    const page = h.top();
    expect(page).not.toBe(campaign);
    expect(labels(page)).toEqual(['My Test', 'gone', 'Back']);
    expect(h.said.at(-1)).toBe('Custom levels. My Test');
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toBe('gone');
  });
});
