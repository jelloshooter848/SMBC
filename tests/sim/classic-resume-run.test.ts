import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import {
  classicFileKey,
  loadClassicFile,
  originalFileRules,
  type ClassicFileRef,
} from '@game/original-files';
import { loadProgress } from '@engine/save/progress';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// RC-002 (0.5.0 RC audit): the original's save keeps the map set, the Map Difficulty and the Game
// mode with the run (GameSettings.as 407-414). B-L: a file keeps them in its rules, fixed for its
// life, and Continue plays them without writing them back into the shared settings (which
// replaces RC-002's prepareLoadSave write-back).

useStorage();
afterEach(() => store.clear());

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const inLevel = (h: H) => h.top() instanceof LevelScene;
const worldOf = (h: H) => (h.top() as LevelScene).world;
const F1: ClassicFileRef = { set: 'smb', slot: 1 };

/** A Hard Single hero run in FILE 1 at 1-2's WORLD card. */
function hardRun(): H & { settings: Settings } {
  const h = classic();
  const rules = originalFileRules();
  rules.difficulty = 'hard';
  rules.options.gameMode = 'single';
  h.game.classicGame(MARIO, '1-2', { ref: F1, rules });
  h.until(() => inLevel(h), 600);
  return h;
}

describe('RC-002 / B-L a file keeps its Map Difficulty and Game mode', () => {
  it("the file holds the run's difficulty and game mode", () => {
    hardRun();
    expect(loadClassicFile(F1)?.rules).toMatchObject({ difficulty: 'hard', options: { gameMode: 'single' } });
  });

  it('Continue plays on Hard after a reload, and the shared settings are left as they were', () => {
    hardRun();
    // A reload: a fresh Game, with the shared settings as the player left them.
    const h = classic({ classicMapDifficulty: 'easy' });
    h.game.showClassicMenu();
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.classicDifficulty).toBe('hard');
    expect(h.settings.classicMapDifficulty).toBe('easy');
    expect(h.settings.classic.gameMode).toBe('all');
    // Single hero: Continue keeps the saved hero, straight into the level.
    h.until(() => inLevel(h), 600);
    expect(worldOf(h).mapDifficulty).toBe('hard');
    expect(h.game.classicHeroChoice(false)).toBe('keep');
  });

  it('in the same session, Continue does not take the difficulty played last', () => {
    const h = hardRun();
    h.game.showTitle();
    h.game.classicDifficulty = 'easy';
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.classicDifficulty).toBe('hard');
  });

  it('Continue on a Hard file, then the game beaten: BEATEN is recorded on Hard', () => {
    hardRun();
    const h = classic();
    expect(h.game.resumeClassic(F1)).toBe(true);
    h.until(() => inLevel(h), 600);
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(loadProgress().classicBeat?.smb).toBe('hard');
  });

  it('a file with rule values this version does not know reads them as the original and still loads', () => {
    hardRun();
    const bad = JSON.parse(store.get(classicFileKey(F1)) as string) as { rules: Record<string, unknown> };
    bad.rules.difficulty = 'nightmare';
    (bad.rules.options as Record<string, unknown>).gameMode = 42;
    store.set(classicFileKey(F1), JSON.stringify(bad));
    const f = loadClassicFile(F1);
    expect(f?.rules.difficulty).toBe('normal');
    expect(f?.rules.options.gameMode).toBe('all');
    const h = classic();
    expect(h.game.resumeClassic(F1)).toBe(true);
    pickAtContinue(h);
    h.until(() => inLevel(h), 600);
    expect(h.game.classicDifficulty).toBe('normal');
  });
});
