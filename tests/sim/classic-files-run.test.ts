import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { LevelScene } from '@game/scenes/level';
import type { GameOverScene } from '@game/scenes/game-over';
import { GAME_OVER_CARD_FRAMES } from '@game/scenes/game-over';
import {
  eraseClassicFile,
  loadClassicFile,
  originalFileRules,
  type ClassicFileRef,
  type ClassicFileRules,
} from '@game/original-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// B-L step 2: a file's rules are fixed as it starts and apply to its run only (nothing written
// back into the shared settings); each file keeps its own continues count; practice runs (the
// menus' Level Select) never count and never unlock.

useStorage();
afterEach(() => store.clear());

type G = H & { settings: Settings };
/** The shared rows a file's rules once wrote back into (RC-002's prepareLoadSave). */
const sharedRows = (s: Settings) =>
  JSON.stringify([
    s.classic,
    s.classicMapDifficulty,
    s.classicHeroesOff ?? null,
    s.classicCheats.continuesUsed,
  ]);
function classic(): G {
  const settings: Settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const A: ClassicFileRef = { set: 'smb', slot: 1 };
const B: ClassicFileRef = { set: 'smb', slot: 2 };
const inLevel = (h: H) => h.top() instanceof LevelScene;

function gameOver(h: H, level = '1-2'): GameOverScene {
  h.game.goToLevel(level, { mode: 'stand' });
  h.game.state.lives = 0;
  h.game.gameOver(level);
  h.idle(GAME_OVER_CARD_FRAMES + 2);
  return h.top() as GameOverScene;
}

const rules = (over: (r: ClassicFileRules) => void): ClassicFileRules => {
  const r = originalFileRules();
  over(r);
  return r;
};

describe("B-L a file's rules", () => {
  it('play its run and are kept with it; nothing goes into the shared settings', () => {
    const h = classic();
    const before = sharedRows(h.settings);
    const r = rules((x) => {
      x.difficulty = 'hard';
      x.options.lives = 7;
      x.options.attack = 'strong';
    });
    h.game.classicGame(MARIO, '1-1', { ref: A, rules: r });
    h.until(() => inLevel(h), 600);
    expect(h.game.state.lives).toBe(7);
    expect(h.game.classicOptions?.attack).toBe('strong');
    expect(h.game.classicDifficulty).toBe('hard');
    expect(h.game.ctx.mapDifficulty).toBe('hard');
    const f = loadClassicFile(A);
    expect(f?.rules).toMatchObject({ difficulty: 'hard', options: { lives: 7, attack: 'strong' } });
    expect(sharedRows(h.settings)).toBe(before);
    // Continue plays the file's rules again, whatever another file plays.
    h.game.showTitle();
    h.game.classicGame(LINK, '1-1', { ref: B });
    h.until(() => inLevel(h), 600);
    expect(h.game.classicOptions?.attack).toBe('normal');
    h.game.showTitle();
    expect(h.game.resumeClassic(A)).toBe(true);
    pickAtContinue(h);
    h.until(() => inLevel(h), 600);
    expect(h.game.classicOptions?.attack).toBe('strong');
    expect(h.game.classicDifficulty).toBe('hard');
    expect(sharedRows(h.settings)).toBe(before);
  });

  it("Disable heroes and Game mode are the file's", () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', {
      ref: A,
      rules: rules((x) => {
        x.heroesOff = ['link'];
        x.options.gameMode = 'single';
      }),
    });
    expect(h.game.heroSlots.map((c) => c.id)).not.toContain('link');
    expect(h.game.classicHeroChoice(false)).toBe('keep');
    h.game.showTitle();
    h.game.classicGame(MARIO, '1-1', { ref: B });
    expect(h.game.heroSlots.map((c) => c.id)).toContain('link');
    expect(h.game.classicHeroChoice(false)).toBe('select');
  });
});

describe('B-L continues, per file', () => {
  it('file A continued, file B fresh: B beats with 0 and unlocks, A beats and does not', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    gameOver(h);
    h.tap('jump'); // CONTINUE
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(h.game.fileContinues).toBe(1);
    expect(loadClassicFile(A)?.continues).toBe(1);
    // A different file starts at 0, and A keeps its count.
    h.game.showTitle();
    h.game.classicGame(MARIO, '1-1', { ref: B });
    h.until(() => inLevel(h), 600);
    expect(h.game.fileContinues).toBe(0);
    expect(loadClassicFile(A)?.continues).toBe(1);
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(true);
    // A beats with its continue: no unlock (reset it to see).
    h.settings.classicCheats.unlocked.infiniteLives = false;
    h.game.showTitle();
    expect(h.game.resumeClassic(A)).toBe(true);
    pickAtContinue(h);
    h.until(() => inLevel(h), 600);
    expect(h.game.fileContinues).toBe(1);
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(false);
  });

  it("going on from a game over's file counts once, in that file only", () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    gameOver(h);
    expect(loadClassicFile(A)?.run.continued).toBe(true);
    h.game.showTitle();
    expect(h.game.resumeClassic(A)).toBe(true);
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(h.game.fileContinues).toBe(1);
    expect(loadClassicFile(A)).toMatchObject({
      continues: 1,
      run: { levelId: expect.stringMatching(/^1-1/) },
    });
    expect(loadClassicFile(A)?.run.continued).toBeUndefined();
  });

  it('erasing A resets its count: a new game there starts at 0', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    gameOver(h);
    h.tap('jump');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(loadClassicFile(A)?.continues).toBe(1);
    h.game.showTitle();
    eraseClassicFile(A);
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 600);
    expect(loadClassicFile(A)?.continues).toBe(0);
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(true);
  });

  it('never reads or writes the retired shared count', () => {
    const h = classic();
    h.settings.classicCheats.continuesUsed = 5;
    h.game.classicGame(MARIO, '1-1', { ref: A });
    gameOver(h);
    h.tap('jump');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(h.settings.classicCheats.continuesUsed).toBe(5);
    h.game.showTitle();
    h.game.classicGame(MARIO, '1-1', { ref: B });
    h.game.cheatEvent({ beat: 'smb' });
    // B has 0 of its own: the shared 5 does not keep it locked.
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(true);
    expect(h.settings.classicCheats.continuesUsed).toBe(5);
  });

  it("the credits empty the file, after the beat is judged on the file's count", () => {
    const h = classic();
    h.game.classicGame(MARIO, '8-4', { ref: A });
    h.until(() => inLevel(h), 600);
    expect(loadClassicFile(A)).not.toBeNull();
    h.game.showEnding('8-4');
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
    expect(loadClassicFile(A)).toBeNull();
    expect(h.settings.classicCheats.beaten.smb).toBe(true);
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(true);
  });
});
