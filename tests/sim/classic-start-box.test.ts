import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { ClassicTitleScene, CLASSIC_AT, START_BOX_CY } from '@game/scenes/original-title';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { BOX_ROW_H, BOX_TOP } from '@game/scenes/menu-box';
import { draw, makeGame, useStorage } from './heroes-harness';

// 0.4.72 (owner, Start box option A): the CLASSIC Start box sits centred between CLASSIC and the
// ground (its top at about y 127); the map set box after START keeps its place under the logo.

useStorage();

function start() {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  h.game.showClassicTitle();
  h.idle(60);
  h.tap('jump'); // OK on the demo: the Start box
  const title = h.top() as ClassicTitleScene;
  expect(title).toBeInstanceOf(ClassicTitleScene);
  expect(title.phase).toBe('start');
  h.idle(30); // fully grown
  return { h, title };
}

/** The first row's text y of the box drawn on top (its labels in `rows`). */
const firstRowY = (texts: { str: string; y: number }[], label: string) =>
  texts.find((t) => t.str === label)?.y ?? NaN;

describe('the CLASSIC Start box (option A)', () => {
  it('is centred between CLASSIC and the ground, its top at about y 127', () => {
    const classicFoot = CLASSIC_AT.y + 29;
    expect(START_BOX_CY).toBe(Math.round((classicFoot + 208) / 2));
    const { title } = start();
    const { texts } = draw(title);
    const y = firstRowY(texts, 'START');
    // Row text sits 5 px (the box's pad) + 2 px under the box's top.
    const top = y - 7;
    expect(top).toBeGreaterThanOrEqual(125);
    expect(top).toBeLessThanOrEqual(129);
    const bottom = top + 3 * BOX_ROW_H + 10;
    // Clear of CLASSIC above and of the demo's ground (and a big hero standing on it) below.
    expect(top).toBeGreaterThan(classicFoot + 20);
    expect(bottom).toBeLessThan(208 - 32);
    expect(Math.abs((top + bottom) / 2 - START_BOX_CY)).toBeLessThanOrEqual(1);
    for (const l of ['OPTIONS', 'BACK']) expect(texts.some((t) => t.str === l)).toBe(true);
  });

  it("the demo's ground and heroes still draw under it", () => {
    const { title } = start();
    const { sprites } = draw(title);
    expect(sprites.some((s) => s.y >= 208)).toBe(true); // the ground
    expect(title.demo.players.length).toBeGreaterThan(1);
  });

  it('the map set box after START stays where it was, just under the logo', () => {
    const { h } = start();
    h.tap('jump'); // START
    const sets = h.top() as ClassicMenuScene;
    expect(sets).toBeInstanceOf(ClassicMenuScene);
    h.idle(30);
    const y = firstRowY(draw(sets).texts, 'SUPER MARIO BROS.');
    expect(y - 7).toBe(BOX_TOP);
  });
});
