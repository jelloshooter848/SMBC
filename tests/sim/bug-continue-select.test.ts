import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CHARACTERS } from '@game/characters/registry';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { HUD_TEXT } from '@game/hud/select-hud';
import { MAP_SETS, type ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { originalFileRules, type ClassicFileRules } from '@game/original-files';
import { ClassicTitleScene } from '@game/scenes/original-title';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-03 (owner bug log on 0.4.68): CONTINUE on a map set goes to the hero select first, as the
// original's Load Game does (EventManager.loadGame sets StatManager.newLev, so
// ScreenManager.createLevel shows CharacterSelect before the level). The run then goes on at the
// saved level with its lives and score and the hero picked there; BACK from that select returns
// to the set's file box (B-L), on that file.

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** A SMB run kept at 4-2's WORLD card with 2 lives and 51200 points. */
function keep(h: H, rules: ClassicFileRules = originalFileRules()): void {
  h.game.classicGame(MARIO, '4-1', { ref: { set: 'smb', slot: 1 }, rules });
  h.game.state.lives = 2;
  h.game.state.score = 51200;
  h.game.goToLevel('4-2', { mode: 'stand' });
  h.game.showTitle();
}

/** The CLASSIC menu, SMB's row picked, then its used FILE 1 in its file box. */
function continueSmb(h: H): void {
  h.game.showClassicMenu();
  h.idle(8);
  h.tap('jump');
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  h.idle(8);
  h.tap('jump');
}

const sel = (h: H) => h.top() as CharacterSelectScene;
const said = (h: H) => h.said.at(-1)?.split(', ')[0];

describe('BUG-03 CONTINUE goes through the hero select', () => {
  it('opens the select on the saved hero, its HUD on the saved level, before any WORLD card', () => {
    const h = classic();
    keep(h);
    continueSmb(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state).toMatchObject({ lives: 2, score: 51200, world: 4, stage: 2 });
    const t = draw(sel(h)).texts;
    expect(t.find((x) => x.x === HUD_TEXT.level && x.y === 16)?.str).toBe('4-2');
    expect(t.some((x) => x.str === '0051200')).toBe(true);
  });

  it('the hero picked there plays the saved level with the saved lives and score', () => {
    const h = classic();
    keep(h);
    continueSmb(h);
    h.idle(12);
    const link = CHARACTERS.find((c) => c.id === 'link');
    for (let i = 0; i <= 40 && said(h) !== link?.name; i++) h.tap(i % 12 === 11 ? 'down' : 'right');
    expect(said(h)).toBe(link?.name);
    h.tap('jump');
    if (sel(h).pickerOpen) h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 900);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^4-2/);
    expect(h.game.state.character.id).toBe('link');
    expect(h.game.state).toMatchObject({ lives: 2, score: 51200 });
    expect(h.said.find((s) => s.startsWith('Continue.'))).toMatch(/World 4-2/);
  });

  it('BACK returns to the set’s file box over the CLASSIC title, on that file, the run kept', () => {
    const h = classic();
    keep(h);
    continueSmb(h);
    h.idle(12);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    const files = h.top() as ClassicFilesScene;
    expect(files.set.id).toBe('smb');
    expect((files as unknown as { over: unknown }).over).toBeInstanceOf(ClassicTitleScene);
    expect((files as unknown as { index: number }).index).toBe(0);
    expect(h.said.at(-1)).toMatch(/Choose a file\. File 1: NORMAL 4-2 X2/);
    // No run is on; the slot is untouched.
    expect(h.game.classicRun).toBe(false);
    // BACK from the box: the CLASSIC menu on SMB's row.
    h.idle(8);
    h.tap('attack');
    const menu = h.top() as ClassicMenuScene;
    expect((menu as unknown as { index: number }).index).toBe(MAP_SETS.findIndex((s) => s.id === 'smb'));
    // And CONTINUE again still goes on from the same place.
    h.idle(8);
    h.tap('jump');
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state).toMatchObject({ lives: 2, score: 51200, world: 4, stage: 2 });
  });

  it('Single hero keeps the saved hero (no select), as the original skips it at a new level', () => {
    const h = classic();
    // The run's Game mode is its file's (RC-002, B-L).
    const rules = originalFileRules();
    rules.options.gameMode = 'single';
    keep(h, rules);
    continueSmb(h);
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    h.until(() => h.top() instanceof LevelScene, 900);
    expect(h.game.state.character.id).toBe('mario');
  });
});
