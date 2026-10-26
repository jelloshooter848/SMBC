import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import type { ClassicGameMode } from '@engine/save/original-options';
import {
  classicFileKey,
  eraseClassicFile,
  loadClassicFile,
  loadClearedFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
  type ClassicFileRules,
} from '@game/original-files';
import { advancedCheatsKey } from '@game/advanced-cheats';
import type { MenuItem } from '@game/scenes/menu';
import { AdvancedCheatsScene } from '@game/scenes/advanced-cheats-menu';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicNoteScene, REPLAY_HELP_KEY, ReplayDeathScene } from '@game/scenes/original-replay';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { classic, keepCleared, openFiles, readNote, run } from './cleared-nav';

// v0.4.73 PR A break-it review (rule 33a: these were written before the fixes).
// 1. A page, help box or row tied to a CLEARED file writes only to that very file: one opened
//    before another tab erased it and cleared it again never writes the new one.
// 2. A run ending while storage cannot be read never empties its slot (it may be CLEARED now).
// 3. The file box that could not read storage notices when it can again.
// 4. Item 66, the safe version: dev mode turned off mid-run with an unreleased hero ends that
//    life without charging it (no life lost, no Survival fall), never during a level's end, and
//    the file keeps its devHero mark.

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const hardRules = (): ClassicFileRules => ({ ...originalFileRules(), difficulty: 'hard' });
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const ls = () => (globalThis as { localStorage: Record<string, unknown> }).localStorage;

describe('1: the file an Advanced cheats page was opened for', () => {
  it('menu open, erase, a new Hard clear, then a toggle: the new file gets nothing', () => {
    keepCleared(A, { score: 1 }, hardRules());
    const h = classic();
    const page = new AdvancedCheatsScene(h.game, A, () => {});
    h.game.scenes.push(page);
    // Another tab.
    eraseClassicFile(A);
    keepCleared(A, { score: 2 }, hardRules());
    items(page)[0]?.adjust?.(1);
    expect(store.has(advancedCheatsKey(A))).toBe(false);
    expect(h.game.advancedCheatsOf(A)?.assist.allowLeftScroll).toBe(false);
  });

  it('the help box: opened for one clear, OK after another tab cleared the slot again: not read', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, { score: 1 }, hardRules());
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    eraseClassicFile(A);
    keepCleared(A, { score: 2 }, hardRules());
    readNote(h);
    expect(store.has(advancedCheatsKey(A))).toBe(false);
    expect(h.game.advancedCheatsOf(A)?.seen).toBe(false);
  });

  it('the same file all along: the page and the box write as before', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, {}, hardRules());
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    readNote(h);
    expect(h.game.advancedCheatsOf(A)?.seen).toBe(true);
    const page = new AdvancedCheatsScene(h.game, A, () => {});
    h.game.scenes.push(page);
    items(page)[0]?.adjust?.(1);
    expect(h.game.advancedCheatsOf(A)?.assist.allowLeftScroll).toBe(true);
  });
});

describe('2: a run ending while storage cannot be read', () => {
  it('never empties the slot (another tab CLEARED it)', () => {
    saveClassicFile({ ...A, rules: originalFileRules(), continues: 0, run: run({ levelId: '1-1' }) });
    const h = classic();
    const g = h.game as unknown as { classicFile: ClassicFileRef | null; dropResume(): void };
    g.classicFile = { ...A };
    // Another tab clears it.
    keepClearedRaw();
    const before = store.get(classicFileKey(A));
    const real = ls().getItem as (k: string) => string | null;
    ls().getItem = () => {
      throw new Error('blocked');
    };
    g.dropResume();
    ls().getItem = real;
    expect(store.get(classicFileKey(A))).toBe(before);
    expect(loadClearedFile(A)).not.toBeNull();
  });
});

/** A CLEARED file written over A as another tab's clear would (saveClassicFile's v 1 is there). */
function keepClearedRaw(): void {
  const f = loadClassicFile(A)!;
  store.set(
    classicFileKey(A),
    JSON.stringify({
      v: 2,
      cleared: true,
      set: 'smb',
      slot: 1,
      rules: f.rules,
      continues: 0,
      tutorialsSeen: [],
      run: f.run,
      savedAt: 5,
    }),
  );
}

describe('3: the blocked file box notices when reads work again', () => {
  it('a press on a row after reads are back: the box as it is, read out', () => {
    saveClassicFile({
      ...A,
      rules: originalFileRules(),
      continues: 0,
      run: run({ levelId: '4-2', world: 4, stage: 2 }),
    });
    const h = classic();
    const real = ls().getItem as (k: string) => string | null;
    let fail = true;
    ls().getItem = (k: string) => {
      if (fail) throw new Error('blocked');
      return real(k);
    };
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    const box = h.top() as ClassicFilesScene;
    expect(items(box)[0]?.value?.()).toBe("CAN'T READ");
    fail = false;
    choose(h, 'File 2');
    expect(h.top()).toBe(box);
    expect(items(box)[0]?.value?.()).toMatch(/4-2/);
    expect(items(box)[1]?.value?.()).toBe('NEW GAME');
    expect(h.said.at(-1)).not.toMatch(/can't be read/i);
    expect(box.storageBlocked).toBe(false);
  });
});

describe('4: item 66, the safe version', () => {
  const arthur = () => CLASSIC_EXTRAS.find((d) => d.id === 'arthur') as CharacterDef;
  const F1: ClassicFileRef = { set: 'smb', slot: 1 };
  function devRun(gameMode: ClassicGameMode = 'single', lives?: number) {
    const settings: Settings = { ...defaultSettings(), dev: true };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    const rules = originalFileRules();
    rules.options.gameMode = gameMode;
    h.game.classicGame(arthur(), '1-1', { ref: F1, rules });
    h.until(() => h.top() instanceof LevelScene, 600);
    h.idle(30);
    if (lives !== undefined) h.game.state.lives = lives;
    return { h, settings };
  }

  it('the last life: no life lost, no GAME OVER; the select opens and the file stays, marked', () => {
    const { h, settings } = devRun('single', 1);
    settings.dev = false;
    h.until(() => h.top() instanceof CharacterSelectScene, 900);
    expect(h.game.state.lives).toBe(1);
    expect(loadClassicFile(F1)?.run.devHero).toBe(true);
    expect(loadClassicFile(F1)?.run.hero).toBe('arthur');
  });

  it('Survival: no hero falls', () => {
    const { h, settings } = devRun('survival');
    const lives = h.game.state.lives;
    settings.dev = false;
    h.until(() => h.top() instanceof CharacterSelectScene, 900);
    expect(h.game.survival?.isFallen('arthur') ?? false).toBe(false);
    expect(h.game.state.lives).toBe(lives);
  });

  it('a level’s end (the flagpole sequence) is never cut short', () => {
    const { h, settings } = devRun();
    const level = h.top() as LevelScene;
    const w = level.world as unknown as { inControl: boolean };
    Object.defineProperty(w, 'inControl', { get: () => false, configurable: true });
    settings.dev = false;
    h.idle(5);
    expect(h.top()).toBe(level);
    expect(level.world.player.dead).toBe(false);
  });

  it('a replay: the death box, and RETRY opens the hero select', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A);
    const settings: Settings = { ...defaultSettings(), dev: true };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.replaySelect(A, 1, 1, '1-1');
    pickAtContinue(h);
    h.until(() => h.top() instanceof LevelScene, 900);
    h.game.setHero(0, arthur());
    const lives = h.game.state.lives;
    settings.dev = false;
    h.until(() => h.top() instanceof ReplayDeathScene, 900);
    expect(h.game.state.lives).toBe(lives);
    choose(h, 'Retry');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });
});
