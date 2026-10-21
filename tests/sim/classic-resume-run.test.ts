import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { CLASSIC_RESUME_KEY, loadClassicResume } from '@game/run-resume';
import { loadProgress } from '@engine/save/progress';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// RC-002 (0.5.0 RC audit): the original's save keeps the map set, the Map Difficulty and the Game
// mode with the run (GameSettings.as 407-414). Our resume slot kept neither, so CLASSIC > Continue
// after a reload went on as Normal (and recorded BEATEN on Normal), and in the same session it took
// whatever difficulty was picked last.

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const inLevel = (h: H) => h.top() instanceof LevelScene;
const worldOf = (h: H) => (h.top() as LevelScene).world;

/** A Hard Survival run at 1-2's WORLD card, then the title (as after a reload). */
function hardRun(): H & { settings: Settings } {
  const h = classic({ classicMapDifficulty: 'hard' });
  h.settings.classic = { ...h.settings.classic, gameMode: 'single' };
  h.game.classicDifficulty = 'hard';
  h.game.classicGame(MARIO, '1-2');
  h.until(() => inLevel(h), 600);
  return h;
}

describe('RC-002 the resume slot keeps the Map Difficulty and the Game mode', () => {
  it('the slot holds the run’s difficulty and game mode', () => {
    hardRun();
    expect(loadClassicResume()).toMatchObject({ difficulty: 'hard', gameMode: 'single' });
  });

  it('Continue plays on Hard after a reload, whatever the menu was set to since', () => {
    hardRun();
    // A reload: a fresh Game, with the setting changed in between.
    const h = classic({ classicMapDifficulty: 'easy' });
    h.game.showClassicMenu();
    expect(h.game.resumeClassic()).toBe(true);
    expect(h.game.classicDifficulty).toBe('hard');
    // The CLASSIC menu's Map difficulty shows the run's, as loading the original's file sets it.
    expect(h.settings.classicMapDifficulty).toBe('hard');
    h.until(() => inLevel(h), 600);
    expect(worldOf(h).mapDifficulty).toBe('hard');
    // And the run's Game mode is back (Single hero: no select at the next level).
    expect(h.settings.classic.gameMode).toBe('single');
    expect(h.game.classicHeroChoice(false)).toBe('keep');
  });

  it('in the same session, Continue does not take the difficulty picked last', () => {
    const h = hardRun();
    h.game.showTitle();
    h.game.classicDifficulty = 'easy';
    expect(h.game.resumeClassic()).toBe(true);
    expect(h.game.classicDifficulty).toBe('hard');
  });

  it('an older slot (no difficulty, no game mode) still loads: the menu’s difficulty, the mode kept', () => {
    hardRun();
    const old = JSON.parse(store.get(CLASSIC_RESUME_KEY) as string) as Record<string, unknown>;
    delete old.difficulty;
    delete old.gameMode;
    store.set(CLASSIC_RESUME_KEY, JSON.stringify(old));
    const h = classic({ classicMapDifficulty: 'easy' });
    expect(loadClassicResume()).not.toHaveProperty('difficulty');
    expect(h.game.resumeClassic()).toBe(true);
    expect(h.game.classicDifficulty).toBe('easy');
    expect(h.settings.classicMapDifficulty).toBe('easy');
    expect(h.settings.classic.gameMode).toBe('all');
  });

  it('Continue on a Hard slot, then the game beaten: BEATEN is recorded on Hard', () => {
    hardRun();
    const h = classic({ classicMapDifficulty: 'normal' });
    expect(h.game.resumeClassic()).toBe(true);
    h.until(() => inLevel(h), 600);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(loadProgress().classicBeat?.smb).toBe('hard');
  });

  it('a slot with values this version does not know drops them and still loads', () => {
    hardRun();
    const bad = JSON.parse(store.get(CLASSIC_RESUME_KEY) as string) as Record<string, unknown>;
    bad.difficulty = 'nightmare';
    bad.gameMode = 42;
    store.set(CLASSIC_RESUME_KEY, JSON.stringify(bad));
    const r = loadClassicResume();
    expect(r).not.toBeNull();
    expect(r).not.toHaveProperty('difficulty');
    expect(r).not.toHaveProperty('gameMode');
  });
});
