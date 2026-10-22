import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import type { TitleScene } from '@game/scenes/title';
import { makeGame, store, useStorage } from './heroes-harness';

// P6: skipping the REMIX title's rift intro says what comes next (the menu's focused row), so
// "Press any button to skip the intro" is not left as the last thing said.

useStorage();
afterEach(() => store.clear());

describe('P6: the intro skip is announced', () => {
  it('a press during the rift says the focused title row', () => {
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {}, titleIntro: true } });
    h.game.showTitle();
    const title = h.top() as TitleScene;
    if (title.phase === 'gate') h.tap('jump');
    expect(title.phase).toBe('rift');
    expect(h.said.at(-1)).toContain('Press any button to skip the intro.');
    h.idle(30);
    h.tap('jump');
    expect(title.phase).toBe('ready');
    const it = (title as unknown as { items: MenuItem[]; index: number }).items[
      (title as unknown as { index: number }).index
    ];
    expect(h.said.at(-1)).toBe(`${it?.label}${it?.hint ? `. ${it.hint}` : ''}`);
    expect(h.said.at(-1)).not.toContain('skip');
  });
});
