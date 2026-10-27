import { afterEach, describe, expect, it } from 'vitest';
import { MARIO } from '@game/characters/mario';
import { ClassicDemo, MARIO_WAIT } from '@game/scenes/title-demo';
import { PROMPT_BLINK, ClassicTitleScene } from '@game/scenes/original-title';
import { DevMenuScene } from '@game/scenes/dev';
import type { MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import * as quitRun from '@game/scenes/quit-run';
import { QuitRunScene } from '@game/scenes/quit-run';
import {
  ClassicFilesScene,
  clearedSpoken,
  fileDetailLine,
  fileRowValue,
  fileSpoken,
} from '@game/scenes/original-files-menu';
import {
  loadClassicFile,
  originalFileRules,
  type ClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import { draw, file, makeGame, store, useStorage } from './heroes-harness';
import { classic, inLevel, keepCleared, openFiles, type G } from './cleared-nav';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

/*
 * v0.4.77 (owner-approved) Classic menus: 179 the title demo's 1 s wait; 190 the pause's Dev mode
 * and Assists rows; 191 / 192 the Options' Save files and Asset packs rows; 195 no "your run
 * waits" line; 198 / 199 the file box without lives or hero.
 */

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

/** From the campaign map: enter `levelId`, keeping the hero (campaign.test.ts). */
function enter(h: H, levelId: string): void {
  h.game.enterLevelFromMap(levelId);
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene);
}

function pausedClassic(h: G): PauseScene {
  h.game.classicGame(MARIO, '1-1', { ref: A });
  h.until(() => inLevel(h), 900);
  h.idle(4);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(PauseScene);
  return h.top() as PauseScene;
}

describe('179: the Classic title demo waits 1 s', () => {
  it('MARIO_WAIT is 60 frames, and the prompt follows it', () => {
    expect(MARIO_WAIT).toBe(60);
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    const ct = new ClassicTitleScene(h.game);
    for (let t = 1; t < MARIO_WAIT + PROMPT_BLINK; t++) {
      ct.demo.update();
      expect(ct.promptShown()).toBe(false);
    }
    ct.demo.update();
    expect(ct.promptShown()).toBe(true);
  });

  it('every loop of the demo uses the short wait', () => {
    const h = classic();
    const d = new ClassicDemo(h.game.ctx);
    d.restart();
    for (let loop = 0; loop < 2; loop++) {
      const x0 = d.world.player.body.x;
      for (let i = 0; i < MARIO_WAIT; i++) d.update();
      expect(d.world.player.body.x).toBe(x0);
      for (let i = 0; i < 30; i++) d.update();
      expect(d.world.player.body.x).toBeGreaterThan(x0);
      d.restart();
      expect(d.t).toBe(0);
    }
  });
});

describe('190: the pause in dev mode', () => {
  it('a Classic run: Dev mode, no Assists row of its own; Dev mode has Assists', () => {
    const h = classic((s) => void (s.dev = true));
    const pause = pausedClassic(h);
    expect(labels(pause)).toContain('Dev mode');
    expect(labels(pause)).not.toContain('Assists');
    const dev = new DevMenuScene(h.game, true);
    expect(labels(dev)).toContain('Assists');
  });

  it('the campaign keeps its own Assists row, and no Dev mode', () => {
    const h = makeGame({ dev: true });
    h.game.openFile(1, file({ story: [...ALL_STORY] }));
    enter(h, '1-1');
    h.idle(4);
    h.tap('start');
    const pause = h.top() as PauseScene;
    expect(pause).toBeInstanceOf(PauseScene);
    expect(labels(pause)).toContain('Assists');
    expect(labels(pause)).not.toContain('Dev mode');
  });
});

describe('191 / 192: Save files and Asset packs in Options', () => {
  it("Save files: the title and campaign Options (dev mode), never Classic mode's", () => {
    const h = classic((s) => void (s.dev = true));
    expect(h.game.campaignOpen).toBe(true);
    expect(labels(new OptionsScene(h.game, () => {}))).toContain('Save files');
    expect(labels(new OptionsScene(h.game, () => {}, true))).toContain('Save files');
    // The CLASSIC menu's Options, and the Classic pause's.
    expect(labels(new OptionsScene(h.game, () => {}, false, true))).not.toContain('Save files');
    expect(labels(new OptionsScene(h.game, () => {}, true, true))).not.toContain('Save files');
  });

  it("Asset packs: the title's and the CLASSIC menu's Options; no pause menu's", () => {
    const h = classic();
    expect(labels(new OptionsScene(h.game, () => {}))).toContain('Asset packs');
    expect(labels(new OptionsScene(h.game, () => {}, false, true))).toContain('Asset packs');
    expect(labels(new OptionsScene(h.game, () => {}, true))).not.toContain('Asset packs');
    expect(labels(new OptionsScene(h.game, () => {}, true, true))).not.toContain('Asset packs');
  });

  it('the Classic pause > Options has neither', () => {
    const h = classic((s) => void (s.dev = true));
    pausedClassic(h);
    h.idle(6);
    const pause = h.top() as PauseScene;
    const row = labels(pause).indexOf('Options');
    for (let n = 0; (pause as unknown as { index: number }).index !== row && n < 20; n++) h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(labels(h.top())).not.toContain('Save files');
    expect(labels(h.top())).not.toContain('Asset packs');
  });

  it('the campaign pause > Options has no Asset packs', () => {
    const h = makeGame({ dev: true });
    h.game.openFile(1, file({ story: [...ALL_STORY] }));
    enter(h, '1-1');
    h.idle(4);
    h.tap('start');
    const pause = h.top() as PauseScene;
    h.idle(6);
    const row = labels(pause).indexOf('Options');
    for (let n = 0; (pause as unknown as { index: number }).index !== row && n < 20; n++) h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(labels(h.top())).not.toContain('Asset packs');
  });
});

describe('195: no "your run waits in its file" line', () => {
  it("neither drawn nor said, on the select's BACK or Pause > Quit; the constant is gone", () => {
    expect('QUIT_RUN_KEPT' in quitRun).toBe(false);
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 900);
    h.game.respawn('1-1', { mode: 'stand' });
    h.idle(12);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
    h.idle(4);
    const shown = draw(h.game.scenes as never)
      .texts.map((t) => t.str)
      .join(' ');
    expect(shown).not.toMatch(/WAITS IN ITS FILE/);
    expect(h.said.at(-1)).not.toMatch(/waits in its file/i);
  });
});

describe('198 / 199: the file box without lives or hero', () => {
  function usedFile(h: G): ClassicFile {
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 900);
    h.game.state.score = 12300;
    h.game.respawn('1-1', { mode: 'stand' });
    return loadClassicFile(A) as ClassicFile;
  }

  it('the row is "NORMAL 1-1", the line under the box "SCORE 12300"; the read-out has no lives or hero', () => {
    const h = classic();
    const f = usedFile(h);
    expect(fileRowValue(f)).toBe('NORMAL 1-1');
    expect(fileDetailLine(f)).toBe('SCORE 12300');
    const said = fileSpoken(f);
    expect(said).toBe('Normal, World 1-1, score 12300, All heroes');
    expect(said).not.toMatch(/lives?\b|Mario/);
    const box = openFiles(h);
    expect(box).toBeInstanceOf(ClassicFilesScene);
    const texts = draw(box).texts.map((t) => t.str);
    expect(texts).toContain('NORMAL 1-1');
    expect(texts).toContain('SCORE 12300');
    expect(texts.join(' ')).not.toMatch(/MARIO SCORE| X\d/);
  });

  it('a CLEARED file: "SCORE 98700" under the box, read out with no hero or lives', () => {
    keepCleared(A, { score: 98700, lives: 4 }, originalFileRules());
    const h = classic();
    const box = openFiles(h);
    const texts = draw(box).texts.map((t) => t.str);
    expect(texts).toContain('SCORE 98700');
    expect(texts.join(' ')).not.toMatch(/MARIO SCORE/);
    const hint = items(box)[0]?.hint ?? '';
    expect(hint).toMatch(/^Cleared on Normal, score 98700\. /);
    expect(hint).not.toMatch(/Mario|lives/);
    const cleared = h.game.classicClearedAt(A);
    expect(cleared && clearedSpoken(cleared)).toBe('Cleared on Normal, score 98700');
  });
});
