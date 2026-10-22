import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene } from '@game/scenes/original-game';
import type { ClassicTitleScene } from '@game/scenes/original-title';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// Item 9 (owner): changing a value in a CLASSIC box plays the original's sound, not our menu
// blip. The original's settings boxes play SN_CHOOSE_ITEM (MessageBoxSounds.as:9, the coin)
// after every change (SettingsMenuBox.as:37, afterChooseItem), and MenuBox's LEFT and RIGHT go
// through the same chooseItem (MenuBox.as:442, 450), as OK does. Every other menu keeps the blip.

useStorage();
afterEach(() => store.clear());

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const sounds = (h: H) => h.audio.sfx.mock.calls.map((c) => c[0] as string);

function onRow(h: H, label: string): void {
  const i = items(h.top()).findIndex((it) => it.label === label);
  expect(i, label).toBeGreaterThanOrEqual(0);
  (h.top() as unknown as { index: number }).index = i;
  h.idle(8);
  h.audio.sfx.mockClear();
}

describe('item 9: a CLASSIC box’s value change sounds as the original', () => {
  it('Map difficulty in the map set box: LEFT, RIGHT and OK play the coin', () => {
    const settings = { ...defaultSettings(), classicRules: 'classic' as const };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.showClassicTitle('start');
    const title = h.top() as ClassicTitleScene;
    title.items[0]?.select?.();
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    onRow(h, 'Map difficulty');
    const before = settings.classicMapDifficulty;
    h.tap('right');
    expect(settings.classicMapDifficulty).not.toBe(before);
    h.tap('left');
    h.tap('jump');
    expect(sounds(h)).toEqual(['coin', 'coin', 'coin']);
  });

  it('the same menu as a full-screen page (not over the demo) keeps the blip', () => {
    const settings = { ...defaultSettings(), classicRules: 'classic' as const };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.scenes.push(new ClassicMenuScene(h.game, null));
    onRow(h, 'Map difficulty');
    h.tap('right');
    expect(sounds(h)).toEqual(['select']);
  });
});
