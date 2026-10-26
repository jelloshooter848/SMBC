import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { HUD_TEXT } from '@game/hud/select-hud';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-04 (owner bug log on 0.4.68): the hero select between levels showed WORLD 1-1 in its HUD
// whatever level came next. Its HUD read the run's state, whose world and stage move on only at
// the next level's WORLD card, after the select (or, before a run's first level, the last run's
// or a fresh state's 1-1). It shows the level the select is for, as the original's does (its
// select is a level of its own, created for the level about to be loaded: TopScreenText shows it).

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H {
  const settings = { ...defaultSettings(), ...over };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

/** The WORLD column's value in the select's HUD (the text under WORLD). */
function hudLevel(h: H): string | undefined {
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  const t = draw(h.top() as CharacterSelectScene).texts;
  return t.find((x) => x.x === HUD_TEXT.level && x.y === 16)?.str;
}

describe('BUG-04 the select HUD shows the coming level', () => {
  it('between levels: the next level, not the one just cleared or 1-1', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1');
    h.idle(3);
    h.game.warpToLevel('1-2', { mode: 'stand' }, false);
    expect(hudLevel(h)).toBe('1-2');
    h.game.warpToLevel('4-1', { mode: 'stand' }, true);
    expect(hudLevel(h)).toBe('4-1');
  });

  it('after a death: the level being played again', () => {
    const h = classic();
    h.game.classicGame(MARIO, '3-2');
    h.idle(3);
    h.game.respawn('3-2', { mode: 'stand' });
    expect(hudLevel(h)).toBe('3-2');
  });

  // v0.4.73 item 94: the Level Select jump went with the cheat.
  it('a new game: that level', () => {
    const h = classic();
    // A run played earlier left its state at 5-3.
    h.game.classicGame(MARIO, '5-3');
    h.idle(3);
    h.game.showClassicMenu();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(hudLevel(h)).toBe('1-1');
  });

  it('The Lost Levels: its lettered worlds, as the level HUD shows them', () => {
    const h = classic();
    h.game.classicGame(MARIO, 'll-1-1');
    h.idle(3);
    h.game.warpToLevel('ll-10-1', { mode: 'stand' }, false);
    expect(hudLevel(h)).toBe('A-1');
  });
});
