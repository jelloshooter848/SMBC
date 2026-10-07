import { describe, expect, it } from 'vitest';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { MenuScene, MenuItem } from '@game/scenes/menu';
import { WorldMapScene } from '@game/scenes/world-map';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { loadSave } from '@game/save/save-files';
import type { Settings } from '@engine/save/settings';
import { draw, file, makeGame, offered, useStorage, type H } from './heroes-harness';

// Developer mode's map menu "All heroes": every hero can be picked on the open file without
// touching its freed list (docs/HEROES.md). Only has an effect while dev mode is on.

useStorage();

const ALL = new Set(CHARACTERS.map((c) => c.name));
const items = (scene: unknown) => (scene as { items: MenuItem[] }).items;
const labels = (scene: unknown) => items(scene).map((i) => i.label);

function openMenu(h: H): MenuScene {
  h.tap('select');
  expect((h.top() as MenuScene).title).toBe('MAP');
  h.idle(8);
  return h.top() as MenuScene;
}

/** File 1 open on the map with dev mode `dev`. */
function onMap(dev: boolean, over: Parameters<typeof file>[0] = {}) {
  const h = makeGame();
  const settings = { dev } as Settings;
  h.game.deps.settings = settings;
  file(over);
  h.game.openFile(1);
  h.idle(8);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  return { h, settings };
}

/** Flip the map menu's "All heroes" row with left/right, then back to the map. */
function toggleAllHeroes(h: H): void {
  const menu = openMenu(h);
  const row = labels(menu).indexOf('All heroes');
  expect(row).toBeGreaterThan(0);
  for (let i = 0; i < row; i++) h.tap('down');
  h.tap('right');
  h.tap('attack');
  expect(h.top()).toBeInstanceOf(WorldMapScene);
}

/** The heroes the next pick (entering 1-1 from the map) offers, and its drawn text. */
function nextPick(h: H) {
  h.game.enterLevelFromMap('1-1');
  const cs = h.top();
  expect(cs).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  const texts = draw(cs as CharacterSelectScene).texts.map((t) => t.str);
  return { names: new Set(offered(h)), texts };
}

describe('dev "All heroes" toggle', () => {
  it('sits next to "Unlock all" on the map menu, only in dev mode', () => {
    let { h } = onMap(true);
    let menu = openMenu(h);
    const ls = labels(menu);
    expect(ls).toContain('All heroes');
    expect(Math.abs(ls.indexOf('All heroes') - ls.indexOf('Unlock all'))).toBe(1);
    const row = items(menu).find((i) => i.label === 'All heroes');
    expect(row?.value?.()).toBe('off');
    ({ h } = onMap(false));
    menu = openMenu(h);
    expect(labels(menu)).not.toContain('All heroes');
  });

  it('on: the next pick offers every hero, the file freed list is untouched; off locks them again', () => {
    const { h } = onMap(true);
    expect(h.game.heroLocked(LUIGI)).toBe(true);
    toggleAllHeroes(h);
    expect(h.said.some((t) => /^All heroes: on\./.test(t))).toBe(true);
    expect(h.game.devAllHeroes).toBe(true);
    for (const c of CHARACTERS) expect(h.game.heroLocked(c)).toBe(false);
    expect(h.game.heroesToFind).toBe(0);
    expect(loadSave(1)?.devAllHeroes).toBe(true);

    const pick = nextPick(h);
    expect(pick.names).toEqual(ALL);
    expect(pick.texts.some((t) => /TO FIND/.test(t))).toBe(false);
    expect(pick.texts).not.toContain('???');
    expect(h.said.some((t) => /still to be found/i.test(t))).toBe(false);
    // Pick Luigi and play: the autosave keeps the real roster.
    while (h.said.at(-1) !== 'Luigi') h.tap('right');
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(LUIGI);
    h.game.autosave();
    expect(h.game.freed).toEqual(['mario']);
    expect(loadSave(1)?.freed).toEqual(['mario']);

    // Back on the map, off again: the real roster, and Luigi gives way to Mario.
    h.game.showMap();
    h.idle(8);
    toggleAllHeroes(h);
    expect(h.said.some((t) => /^All heroes: off\./.test(t))).toBe(true);
    expect(h.game.heroLocked(LUIGI)).toBe(true);
    expect(h.game.state.character).toBe(MARIO);
    expect(loadSave(1)?.devAllHeroes).toBe(false);
    expect(loadSave(1)?.freed).toEqual(['mario']);
    const again = nextPick(h);
    expect(again.names).toEqual(new Set(['Mario']));
    expect(again.texts).toContain('8 HEROES TO FIND');
  });

  it('with dev mode off the flag does nothing', () => {
    const { h, settings } = onMap(false, { devAllHeroes: true });
    expect(h.game.devAllHeroes).toBe(true);
    expect(h.game.heroLocked(LUIGI)).toBe(true);
    expect(nextPick(h).names).toEqual(new Set(['Mario']));
    // Dev mode back on: the file's flag applies again.
    settings.dev = true;
    expect(h.game.heroLocked(LUIGI)).toBe(false);
  });

  it('persists in the save and reloads', () => {
    const { h } = onMap(true);
    toggleAllHeroes(h);
    h.game.saveAndQuit();
    expect(h.game.devAllHeroes).toBe(false); // the title forgets the file
    const h2 = makeGame();
    h2.game.deps.settings = { dev: true } as Settings;
    h2.game.openFile(1);
    expect(h2.game.devAllHeroes).toBe(true);
    expect(h2.game.freed).toEqual(['mario']);
    expect(h2.game.heroLocked(LUIGI)).toBe(false);
    h2.idle(8);
    const row = items(openMenu(h2)).find((i) => i.label === 'All heroes');
    expect(row?.value?.()).toBe('on');
  });

  it('a file left on a hero it only had through the toggle opens on Mario with dev mode off', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: false } as Settings;
    file({ devAllHeroes: true, freed: ['mario'] }, LUIGI.id);
    h.game.openFile(1);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.freed).toEqual(['mario']);
  });
});
