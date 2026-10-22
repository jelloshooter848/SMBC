import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { CheatsScene } from '@game/scenes/cheats-menu';
import { abilityHint } from '@game/scenes/hints';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicOptionsScene } from '@game/scenes/original-game';
import type { ClassicTitleScene } from '@game/scenes/original-title';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// Item 6 (owner): a CLASSIC box's BACK hint names the page's own BACK action (MenuScene
// backAction), as the full-screen page does. While the boxed Cheats page takes the code, BACK is
// SELECT there (ATTACK is a code input), and the hint said ATTACK's key.

useStorage();
afterEach(() => store.clear());

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const pick = (h: H, label: string) => {
  const i = items(h.top()).findIndex((it) => it.label === label);
  expect(i, label).toBeGreaterThanOrEqual(0);
  (h.top() as unknown as { index: number }).index = i;
  h.idle(8);
  h.tap('jump');
};
const texts = (h: H) => draw(h.top() as never).texts.map((t) => t.str);

describe('item 6: the boxed BACK hint follows the page’s BACK action', () => {
  it('Cheats over the CLASSIC demo: ATTACK normally, SELECT while the code is entered, ATTACK again after', () => {
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    h.game.showClassicTitle('start');
    const title = h.top() as ClassicTitleScene;
    title.index = title.items.findIndex((i) => i.label === 'Options');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
    pick(h, 'Cheats');
    expect(h.top()).toBeInstanceOf(CheatsScene);
    const byAttack = abilityHint(h.game, 'BACK', 'attack');
    const bySelect = abilityHint(h.game, 'BACK', 'select');
    expect(byAttack).not.toBe(bySelect);
    expect(texts(h)).toContain(byAttack);
    pick(h, 'Enter code');
    expect(texts(h)).toContain(bySelect);
    expect(texts(h)).not.toContain(byAttack);
    h.tap('select'); // BACK: the code entry stops
    expect(texts(h)).toContain(byAttack);
  });
});
