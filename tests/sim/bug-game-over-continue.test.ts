import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { GAME_OVER_CARD_FRAMES, GameOverScene } from '@game/scenes/game-over';
import { LevelScene } from '@game/scenes/level';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicSetScene } from '@game/scenes/original-saves';
import { classicResumeKey, loadClassicResume } from '@game/run-resume';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// BUG-05 (owner bug log on 0.4.68): NO at the continue prompt after a game over sent the next run
// back to 1-1 (the game over cleared the set's slot). A Classic mode game over now offers
// CONTINUE and MAIN MENU, and both keep the run: the game over writes the set's slot at its
// continue point, what the original's continue gives (EventManager.continueAfterDying,
// StatManager.continueAfterDyingHandler: resetAllStats(false), so the starting lives, score and
// coins 0, every hero's upgrades, ammo and power back to the defaults; changeToFirstWorldLevel,
// the world's first level from its start; revival allowed; then the select, newLev). CONTINUE plays
// on at once; MAIN MENU goes to the CLASSIC menu, whose Continue on the set goes on from the same
// point. The ending still clears the slot (classic-saves.test.ts).

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** A SMB run in 4-3 with points, coins, Fire Mario and its last life, then its game over. */
function gameOverIn43(h: H): GameOverScene {
  h.game.classicGame(MARIO, '4-1');
  h.game.goToLevel('4-3', { mode: 'stand' });
  const s = h.game.state;
  s.score = 98700;
  s.coins = 55;
  s.lives = 0;
  s.powerState = 'fire';
  h.game.gameOver('4-3');
  expect(h.top()).toBeInstanceOf(GameOverScene);
  h.idle(GAME_OVER_CARD_FRAMES + 2);
  return h.top() as GameOverScene;
}

const used = (h: H & { settings: Settings }) => h.settings.classicCheats.continuesUsed;

describe('BUG-05 a Classic game over keeps the run', () => {
  it('offers CONTINUE and MAIN MENU (no YES / NO), read out', () => {
    const h = classic();
    const go = gameOverIn43(h);
    expect(go.prompting).toBe(true);
    const t = draw(go).texts.map((x) => x.str);
    expect(t).toEqual(expect.arrayContaining(['CONTINUE', 'MAIN MENU']));
    expect(t).not.toContain('YES');
    expect(t).not.toContain('NO');
    expect(h.said.at(-1)).toMatch(/^Continue or main menu\? Both keep your run\. Continue\./);
    h.tap('down');
    expect(h.said.at(-1)).toBe('Main menu');
    h.tap('up');
    expect(h.said.at(-1)).toBe('Continue');
  });

  it('writes the set’s slot at the continue point: world X-1, starting lives, score 0, power-ups gone', () => {
    const h = classic();
    gameOverIn43(h);
    expect(loadClassicResume('smb')).toMatchObject({
      levelId: expect.stringMatching(/^4-1/),
      world: 4,
      stage: 1,
      lives: 3,
      score: 0,
      coins: 0,
      powerState: 'small',
      kit: {},
      checkpoint: null,
      hero: 'mario',
      continued: true,
    });
  });

  it('More Settings > Lives sets the continue point’s lives', () => {
    const h = classic();
    h.settings.classic = { ...h.settings.classic, lives: 7 };
    gameOverIn43(h);
    expect(loadClassicResume('smb')?.lives).toBe(7);
  });

  it('CONTINUE plays on at once: the select, then 4-1 as the slot has it; one continue used', () => {
    const h = classic();
    const before = used(h);
    gameOverIn43(h);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state).toMatchObject({ lives: 3, score: 0, coins: 0 });
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^4-1/);
    expect(used(h)).toBe(before + 1);
  });

  it('MAIN MENU goes to the CLASSIC menu; the set’s Continue goes on from the same point', () => {
    const h = classic();
    const before = used(h);
    gameOverIn43(h);
    h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    expect(h.game.classicRun).toBe(false);
    const slot = store.get(classicResumeKey('smb'));
    // The map set's row: CONTINUE / NEW GAME, Continue first.
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.state).toMatchObject({ lives: 3, score: 0, coins: 0, world: 4, stage: 1 });
    // BACK at that select and Continue again: still the same slot, nothing counted yet.
    h.idle(12);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicSetScene);
    expect(store.get(classicResumeKey('smb'))).toBe(slot);
    expect(used(h)).toBe(before);
    h.idle(8);
    h.tap('jump');
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
    expect((h.top() as LevelScene).world.level.id).toMatch(/^4-1/);
    expect(h.game.state.powerState).toBe('small');
    // Going on from the game over's slot is the continue (counted once).
    expect(used(h)).toBe(before + 1);
    // Its WORLD card writes the slot as any other does.
    expect(loadClassicResume('smb')?.continued).toBeUndefined();
  });

  it('Survival: the continue point has every hero fallen and revival allowed', () => {
    const h = classic();
    h.settings.classic = { ...h.settings.classic, gameMode: 'survival' };
    h.game.classicGame(MARIO, '2-1');
    h.game.goToLevel('2-2', { mode: 'stand' });
    h.game.gameOver('2-2');
    const r = loadClassicResume('smb');
    expect(r?.levelId).toMatch(/^2-1/);
    expect(r?.survival?.reviveAllowed).toBe(true);
    expect(r?.survival?.fallen.length).toBeGreaterThan(0);
  });
});
