import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFileRulesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { choose } from './classic-files-nav';

/*
 * Item 135: a new file's rules box opens on START, which left and right do not change: what is
 * read out there does not say "Left and right to change". A row they do change (Game mode) says
 * it when it is highlighted.
 */

useStorage();
afterEach(() => store.clear());

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const idx = (s: unknown) => (s as { index: number }).index;

function rulesBox(): H {
  const settings: Settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.showClassicMenu();
  choose(h, 'Super Mario Bros.');
  choose(h, 'File 1');
  choose(h, 'Hard');
  expect(h.top()).toBeInstanceOf(ClassicFileRulesScene);
  return h;
}

describe('item 135: the rules box on START', () => {
  it('opens on START and says its title and START, without "Left and right to change"', () => {
    const h = rulesBox();
    const box = h.top();
    expect(items(box)[idx(box)]?.label).toBe('Start');
    const said = h.said.at(-1) ?? '';
    expect(said).toMatch(/^File 1 rules, Hard\. They are fixed once the file starts\. Start\b/);
    expect(said).not.toMatch(/Left and right/);
  });

  it('moving onto Game mode says Left and right to change; back on START it does not', () => {
    const h = rulesBox();
    const box = h.top();
    h.idle(8);
    for (let i = 0; i < 8 && items(box)[idx(box)]?.label !== 'Game mode'; i++) h.tap('up');
    expect(items(box)[idx(box)]?.label).toBe('Game mode');
    expect(h.said.at(-1)).toMatch(/Left and right to change/);
    for (let i = 0; i < 8 && items(box)[idx(box)]?.label !== 'Start'; i++) h.tap('down');
    expect(items(box)[idx(box)]?.label).toBe('Start');
    expect(h.said.at(-1)).not.toMatch(/Left and right/);
  });

  it('changing Game mode with left / right does not repeat "Left and right to change" on each press', () => {
    const h = rulesBox();
    const box = h.top();
    h.idle(8);
    for (let i = 0; i < 8 && items(box)[idx(box)]?.label !== 'Game mode'; i++) h.tap('up');
    expect(h.said.at(-1)).toMatch(/Left and right to change/);
    h.tap('right');
    expect(h.said.at(-1)).toMatch(/^Game mode: /);
    expect(h.said.at(-1)).not.toMatch(/Left and right/);
    h.tap('left');
    expect(h.said.at(-1)).not.toMatch(/Left and right/);
  });
});
