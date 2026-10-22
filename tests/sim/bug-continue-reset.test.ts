import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { GAME_OVER_CARD_FRAMES, type GameOverScene } from '@game/scenes/game-over';
import type { MenuItem } from '@game/scenes/menu';
import { LevelScene } from '@game/scenes/level';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicOverwriteScene, ClassicSetScene } from '@game/scenes/original-saves';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// Item 8 (owner, option A): Infinite Lives' goal (beat a game without a continue) counts the
// continues of the run, as the original: EventManager.restartGame sets numContinuesUsed = 0
// (EventManager.as:256) on NEW GAME (also over a game over's kept run) and after an ending's
// credits. MAIN MENU after a game over keeps the run, so it keeps its count; Continue counts.

useStorage();
afterEach(() => store.clear());

type G = H & { settings: Settings };
function classic(): G {
  const settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const used = (h: G) => h.settings.classicCheats.continuesUsed;
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const choose = (h: H, label: string) => {
  const i = items(h.top()).findIndex((it) => it.label === label);
  expect(i, label).toBeGreaterThanOrEqual(0);
  (h.top() as unknown as { index: number }).index = i;
  h.idle(8);
  h.tap('jump');
};

/** A SMB run's game over in 1-2, up to its CONTINUE / MAIN MENU prompt. */
function gameOver(h: H): GameOverScene {
  h.game.goToLevel('1-2', { mode: 'stand' });
  h.game.state.lives = 0;
  h.game.gameOver('1-2');
  h.idle(GAME_OVER_CARD_FRAMES + 2);
  return h.top() as GameOverScene;
}
/** MAIN MENU at the prompt, then the SMB set's row: its CONTINUE / NEW GAME box. */
function mainMenuToSet(h: H): void {
  h.tap('down');
  h.tap('jump');
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  h.idle(8);
  h.tap('jump');
  expect(h.top()).toBeInstanceOf(ClassicSetScene);
}

describe('item 8: a fresh run’s continues count from 0', () => {
  it('a continue, then NEW GAME, then a beat without a continue unlocks Infinite Lives', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    gameOver(h);
    h.tap('jump'); // CONTINUE
    pickAtContinue(h);
    expect(used(h)).toBe(1);
    gameOver(h);
    mainMenuToSet(h);
    expect(used(h)).toBe(1); // MAIN MENU kept the run, and its count
    choose(h, 'New game');
    expect(h.top()).toBeInstanceOf(ClassicOverwriteScene);
    choose(h, 'New game');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(used(h)).toBe(0);
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
    expect(used(h)).toBe(0);
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(true);
  });

  it('a continue, then MAIN MENU, then the set’s Continue, then a beat does not unlock it', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    gameOver(h);
    h.tap('jump'); // CONTINUE
    pickAtContinue(h);
    expect(used(h)).toBe(1);
    gameOver(h);
    mainMenuToSet(h);
    choose(h, 'Continue');
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
    expect(used(h)).toBe(2); // going on from the game over's slot is a continue too
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(false);
  });

  it('the restart after an ending’s credits: the beat is judged on the run, then the count is 0', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    h.game.continueGame('1-1');
    expect(used(h)).toBe(1);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(h.settings.classicCheats.beaten.smb).toBe(true);
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(false);
    expect(used(h)).toBe(0);
  });
});
