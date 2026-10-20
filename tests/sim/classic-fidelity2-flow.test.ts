import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import { makeGame, useStorage, type H } from './heroes-harness';

// F2 fidelity: Classic mode shows character select before every new level, as the original's
// default All Characters mode does (ScreenManager.as 290-318 createLevel with newLev set by
// loadNewLevel 581-588, reached from every Level.completeLevel, Level.as 1951-1956 and
// 3470-3486). Free play and the campaign go straight on.

useStorage();

const inLevel = (h: H) => h.top() instanceof LevelScene;
const level = (h: H) => h.top() as LevelScene;

function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  expect(inLevel(h)).toBe(true);
  return level(h);
}

function classic(): H {
  return makeGame({ deps: { settings: { ...defaultSettings() }, applySettings: () => {} } });
}

/** The level's flagpole exit to `next`. */
function clear(h: H, next: string): void {
  level(h).world.events.push({ type: 'exit', next });
  h.step();
}

describe('Classic mode: character select between levels (F2)', () => {
  it('a clear goes through character select, announced, and waits for a press', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    enterLevel(h);
    clear(h, '1-2');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.said.some((s) => s.startsWith('Choose your hero.'))).toBe(true);
    // Never auto-advances.
    h.idle(600);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    // OK keeps the hero. G-053, G-055 (0.5.0): Mario's looks open first (OK keeps his own), and
    // his pick performance plays before the card.
    h.tap('jump');
    if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
    h.until(() => h.top() instanceof IntroScene, 300);
    expect(h.top()).toBeInstanceOf(IntroScene);
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-2');
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.classicRun).toBe(true);
  });

  it('the same hero keeps its power; another hero can be picked', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    enterLevel(h);
    level(h).world.player.powerState = 'fire';
    clear(h, '1-2');
    h.idle(12);
    h.tap('jump');
    // G-053 (0.5.0): Mario's looks open first; OK keeps his own.
    if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
    enterLevel(h);
    expect(h.game.state.powerState).toBe('fire');
    clear(h, '1-3');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    for (let i = 0; i < 12 && h.said.at(-1)?.split(', ')[0] !== LINK.name; i++) h.tap('right');
    h.tap('jump');
    // G-050 (0.5.0): Link's looks open first; OK keeps his own.
    if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-3');
    expect(h.game.state.character).toBe(LINK);
  });

  it('free play (not a Classic run) goes straight to the next level', () => {
    const h = classic();
    h.game.newGame(MARIO, '1-1', null, { rules: 'classic' });
    enterLevel(h);
    clear(h, '1-2');
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(enterLevel(h).level.id).toBe('1-2');
  });

  it('a campaign file never takes the Classic path (levelExitTo goes straight on)', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    enterLevel(h);
    // The one decision point: a campaign file open means no select, whatever else is set.
    (h.game as unknown as { campaign: unknown }).campaign = { slot: 1 };
    h.game.levelExitTo('1-2');
    expect(h.top()).toBeInstanceOf(IntroScene);
  });
});
