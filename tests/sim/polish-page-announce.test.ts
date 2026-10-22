import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { DevMenuScene } from '@game/scenes/dev';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// P5: a full page says its title and its focused row on entry, and the page under it says its
// focused row again on the way back, as the boxes do.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label);

function game(dev = false): H {
  const settings = { ...defaultSettings(), ...(dev ? { dev: true } : {}) };
  return makeGame({ dev, deps: { settings, applySettings: () => {} } });
}

/** Moves to row `label` on the page on top and picks it. */
function open(h: H, label: string): void {
  const m = h.top() as MenuScene;
  h.idle(8);
  const at = labels(m).indexOf(label);
  expect(at).toBeGreaterThanOrEqual(0);
  const index = () => (h.top() as unknown as { index: number }).index;
  while (index() !== at) h.tap(index() < at ? 'down' : 'up');
  h.tap('jump');
}

describe('P5: full pages say their title, and the focused row on return', () => {
  for (const [row, said] of [
    ['Video', /^Video\. Integer scale: (On|Off)$/],
    ['Audio', /^Audio\. Mute: (On|Off)$/],
    ['Controls', /^Controls\. Touch pad: /],
  ] as const) {
    it(`Options > ${row}`, () => {
      const h = game();
      h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
      open(h, row);
      expect(h.said.at(-1)).toMatch(said);
      h.idle(8);
      h.tap('attack');
      expect(h.said.at(-1)).toBe(row);
    });
  }

  it('Dev mode, its Assists and Toggle heroes, and back', () => {
    const h = game(true);
    h.game.scenes.push(new DevMenuScene(h.game));
    expect(h.said.at(-1)).toMatch(/^Dev mode\. /);
    open(h, 'Assists');
    expect(h.said.at(-1)).toMatch(/^Assists\. Scroll back: (On|Off)\. Camera can scroll left$/);
    h.idle(8);
    h.tap('attack');
    expect(h.said.at(-1)).toBe('Assists. Only active while dev mode is on');
    open(h, 'Toggle heroes');
    expect(h.said.at(-1)).toMatch(/^Toggle heroes\. Classic\. /);
    open(h, 'Classic');
    expect(h.said.at(-1)).toMatch(/^Toggle heroes: Classic\. /);
    h.idle(8);
    h.tap('attack');
    expect(h.said.at(-1)).toMatch(/^Classic\. Release, On or Off/);
    h.idle(8);
    h.tap('attack');
    expect(h.said.at(-1)).toMatch(/^Toggle heroes\. Classic: who is offered/);
  });

  it('Dev > Level select pages: back (BACK, or the Back row) says the row again', () => {
    const h = game(true);
    h.game.scenes.push(new DevMenuScene(h.game));
    open(h, 'Level select');
    expect(h.said.at(-1)).toMatch(/^Level select\. /);
    open(h, 'Classic');
    expect(h.said.at(-1)).toMatch(/^Classic\. /);
    h.idle(8);
    h.tap('attack');
    expect(h.said.at(-1)).toBe('Classic. Map set, world, level, then the start page');
    open(h, 'Mini games');
    expect(h.said.at(-1)).toMatch(/^Mini games\. /);
    open(h, 'Back');
    expect(h.said.at(-1)).toMatch(/^Mini games\. Play any hero's freeing mini game/);
    open(h, 'Bonus games');
    expect(h.said.at(-1)).toMatch(/^Bonus games\. /);
    h.idle(8);
    h.tap('attack');
    expect(h.said.at(-1)).toMatch(/^Bonus games\. Toad House/);
    open(h, 'Back');
    expect(h.said.at(-1)).toMatch(/^Level select\. Classic, Campaign/);
  });
});
