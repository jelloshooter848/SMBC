import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { MiniGameMenuScene } from '@game/minigames/menu';
import { DevMenuScene } from '@game/scenes/dev';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import type { TitleScene } from '@game/scenes/title';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// 32a (v0.4.71, #198 review): the developer pages' BACK says the menu under them again (its
// focused row), as every other page's BACK does (backToMenu): Pause > Assists, a mini game's
// menu > Assists, and leaving the Dev menu for the title or the pause menu.

useStorage();
afterEach(() => store.clear());

const items = (m: unknown) => (m as { items: MenuItem[] }).items;
const focusLine = (m: unknown) => (m as { focusLine(): string }).focusLine();

function dev(): H {
  return makeGame({
    dev: true,
    deps: { settings: { ...defaultSettings(), dev: true }, applySettings: () => {} },
  });
}

/** Moves to row `label` on the page on top and picks it. */
function open(h: H, label: string): void {
  const m = h.top() as MenuScene;
  h.idle(8);
  const at = items(m).findIndex((i) => i.label === label);
  expect(at, label).toBeGreaterThanOrEqual(0);
  const index = () => (h.top() as unknown as { index: number }).index;
  for (let i = 0; i < 20 && index() !== at; i++) h.tap(index() < at ? 'down' : 'up');
  h.tap('jump');
}

/** BACK on the page on top; the page under it is on top again and says its focused row. */
function back(h: H, under: MenuScene): void {
  h.idle(8);
  h.said.length = 0;
  h.tap('attack');
  expect(h.top()).toBe(under);
  expect(h.said.at(-1)).toBe(focusLine(under));
  expect(focusLine(under)).toBeTruthy();
}

function inClassicRun(h: H): PauseScene {
  h.game.classicGame(MARIO);
  h.until(() => h.top() instanceof LevelScene, 900);
  h.idle(4);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(PauseScene);
  return h.top() as PauseScene;
}

describe('32a: dev BACK exits say the menu under them again', () => {
  it('Pause > Assists > BACK', () => {
    const h = dev();
    const pause = inClassicRun(h);
    open(h, 'Assists');
    expect(h.top()).toBeInstanceOf(AssistOptionsScene);
    back(h, pause);
    expect(focusLine(pause)).toMatch(/^Assists/);
  });

  it("a mini game's menu > Assists > BACK", () => {
    const h = dev();
    h.game.showTitle();
    const menu = new MiniGameMenuScene(h.game, 'MINI GAME', () => {});
    h.game.scenes.push(menu);
    open(h, 'Assists');
    expect(h.top()).toBeInstanceOf(AssistOptionsScene);
    back(h, menu);
    expect(focusLine(menu)).toMatch(/^Assists/);
  });

  it('Dev menu > BACK to the title', () => {
    const h = dev();
    h.game.showTitle();
    const title = h.top() as TitleScene;
    if (title.phase === 'gate') h.tap('jump');
    open(h, 'Dev mode');
    expect(h.top()).toBeInstanceOf(DevMenuScene);
    back(h, title);
    expect(focusLine(title)).toMatch(/^Dev mode/);
  });

  it('Dev menu > BACK to the pause menu', () => {
    const h = dev();
    const pause = inClassicRun(h);
    open(h, 'Dev mode');
    expect(h.top()).toBeInstanceOf(DevMenuScene);
    back(h, pause);
    expect(focusLine(pause)).toMatch(/^Dev mode/);
  });
});
