import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import type { TitleScene } from '@game/scenes/title';
import { makeGame, store, useStorage } from './heroes-harness';

// 32b (v0.4.71, #198 review): when the REMIX title's rift intro plays out with no skip, the menu's
// focused row is said, so "Press any button to skip the intro" is not left as the last thing said.

useStorage();
afterEach(() => store.clear());

describe('32b: the intro ending on its own is announced', () => {
  it('the rift plays out, then the focused title row is said once', () => {
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {}, titleIntro: true } });
    h.game.showTitle();
    const title = h.top() as TitleScene;
    if (title.phase === 'gate') h.tap('jump');
    expect(title.phase).toBe('rift');
    expect(h.said.at(-1)).toContain('Press any button to skip the intro.');
    h.until(() => title.phase !== 'rift', 3000);
    expect(title.phase).toBe('ready');
    const m = title as unknown as { items: MenuItem[]; index: number };
    const it = m.items[m.index];
    const row = `${it?.label}${it?.hint ? `. ${it.hint}` : ''}`;
    expect(h.said.at(-1)).toBe(row);
    // Said once, not again on every frame after.
    const n = h.said.length;
    h.idle(120);
    expect(h.said.length).toBe(n);
  });
});
