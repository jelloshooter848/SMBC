import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { originalFileRules, type ClassicFileRef, type ClassicFileRules } from '@game/original-files';
import { advancedCheatsKey } from '@game/advanced-cheats';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import type { LevelScene } from '@game/scenes/level';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { ClassicNoteScene, ClassicReplayWorldsScene, REPLAY_HELP_KEY } from '@game/scenes/original-replay';
import { AdvancedCheatsScene } from '@game/scenes/advanced-cheats-menu';
import { draw, makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { closeUnlockCards, inLevel, keepCleared, openFiles, readNote } from './cleared-nav';

// v0.4.74 item 60 (owner-approved): the unlock said after the credits with v0.4.73's message;
// the explanation box the first time that file is picked after it (once per file, read out,
// waiting for OK); the ADVANCED CHEATS row next to Cheats (the file's replay boxes and its pause
// menu), a Classic box with every dev Assist.

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const B: ClassicFileRef = { set: 'smb', slot: 2 };
const hardRules = (): ClassicFileRules => ({ ...originalFileRules(), difficulty: 'hard' });
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

function game(over: (s: Settings) => void = () => {}) {
  const settings: Settings = { ...defaultSettings() };
  over(settings);
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

function beatOn(h: ReturnType<typeof game>, ref: ClassicFileRef, rules: ClassicFileRules): void {
  h.game.classicGame(MARIO, '8-4', { ref, rules });
  h.until(() => inLevel(h), 900);
  h.game.showEnding('8-4');
  (h.game as unknown as { afterCredits(from: string): void }).afterCredits('8-4');
  closeUnlockCards(h);
}

describe('60: after the credits', () => {
  it('a Hard clear: the unlock is said with the cleared message, fits the box, waits for OK', () => {
    const h = game();
    beatOn(h, A, hardRules());
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    const note = h.top() as ClassicNoteScene;
    h.idle(900);
    expect(h.top()).toBe(note);
    const said: string[] = [];
    const pages: string[] = [];
    for (let i = 0; i < 6 && h.top() instanceof ClassicNoteScene; i++) {
      pages.push((h.top() as ClassicNoteScene).lines.join(' '));
      for (const l of (h.top() as ClassicNoteScene).lines) expect(l.length).toBeLessThanOrEqual(28);
      said.push(h.said.at(-1) ?? '');
      h.idle(40);
      h.tap('jump');
    }
    const all = pages.join(' ');
    expect(all).toMatch(/FILE 1 IS CLEARED/);
    expect(all).toMatch(/ADVANCED CHEATS/);
    expect(said.join(' ')).toMatch(/Advanced cheats/i);
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  });

  it('a Normal clear: no unlock said', () => {
    const h = game();
    beatOn(h, A, originalFileRules());
    expect(readNote(h).flat().join(' ')).not.toMatch(/ADVANCED/);
  });
});

describe('60: the explanation, the first time the file is picked after the unlock', () => {
  it('after the replay instructions (once, shared), then the file’s own box (once), then the worlds', () => {
    keepCleared(A, {}, hardRules());
    const h = game();
    openFiles(h);
    choose(h, 'File 1');
    const help = readNote(h, 4);
    expect(help.flat().join(' ')).toMatch(/REPLAY ANY LEVEL/);
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    const box = h.top() as ClassicNoteScene;
    expect(box.lines.join(' ')).toMatch(/ADVANCED CHEATS/);
    expect(h.said.at(-1)).toMatch(/Advanced cheats/i);
    h.idle(900);
    expect(h.top()).toBe(box);
    readNote(h);
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
    expect(JSON.parse(store.get(advancedCheatsKey(A))!).seen).toBe(true);
    // Again: straight to the worlds.
    openFiles(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
  });

  it('once per file: another unlocked file has its own; a Normal one has none', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, {}, hardRules());
    keepCleared(B, {}, hardRules());
    keepCleared({ set: 'smb', slot: 3 }, {}, originalFileRules());
    const h = game();
    openFiles(h);
    choose(h, 'File 1');
    readNote(h);
    openFiles(h);
    choose(h, 'File 2');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    readNote(h);
    openFiles(h);
    choose(h, 'File 3');
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
  });

  it('BACK on it: the file box, and it shows again next time (only OK marks it read)', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, {}, hardRules());
    const h = game();
    openFiles(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    h.idle(40);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
  });
});

describe('60 (c): the ADVANCED CHEATS row', () => {
  it('on the file’s world box, opening a Classic box with every dev Assist; a change is kept and said', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, {}, hardRules());
    const h = game();
    h.game.setAdvancedCheats(A, { seen: true });
    openFiles(h);
    choose(h, 'File 1');
    expect(labels(h.top())).toContain('Advanced cheats');
    choose(h, 'Advanced cheats');
    expect(h.top()).toBeInstanceOf(AdvancedCheatsScene);
    const page = h.top() as AdvancedCheatsScene;
    const dev = new AssistOptionsScene(h.game, () => {});
    expect(labels(page)).toEqual(labels(dev));
    expect(h.said.at(-1)).toMatch(/Advanced cheats/i);
    // No damage: on.
    const row = labels(page).indexOf('No damage');
    h.idle(8);
    for (let i = 0; i < 20 && (page as unknown as { index: number }).index !== row; i++) h.tap('down');
    h.tap('right');
    expect(items(page)[row]?.value?.()).toBe('On');
    expect(h.game.advancedCheatsOf(A)?.assist.invulnerable).toBe(true);
    // The dev Assists are not touched.
    expect(h.settings.assist.invulnerable).toBe(false);
    // Drawn as a Classic box (its rows and the BACK line), over the CLASSIC title.
    const text = draw(page)
      .texts.map((t) => t.str)
      .join(' ');
    expect(text).toMatch(/ADVANCED CHEATS/);
    expect(text).toMatch(/NO DAMAGE/);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
  });

  it('not on a Normal file’s world box', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A);
    const h = game();
    openFiles(h);
    choose(h, 'File 1');
    expect(labels(h.top())).not.toContain('Advanced cheats');
  });

  it('in the pause menu of the file’s replay, next to Cheats; not in any other run', () => {
    store.set(REPLAY_HELP_KEY, 'true');
    keepCleared(A, {}, hardRules());
    const h = game();
    h.game.setAdvancedCheats(A, { seen: true });
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    const level = h.top() as LevelScene;
    h.game.scenes.push(new PauseScene(h.game, level.world));
    const rows = labels(h.top());
    expect(rows).toContain('Advanced cheats');
    expect(rows.indexOf('Advanced cheats')).toBe(rows.indexOf('Cheats') + 1);
    choose(h, 'Advanced cheats');
    expect(h.top()).toBeInstanceOf(AdvancedCheatsScene);
    expect(() => draw(h.top() as AdvancedCheatsScene)).not.toThrow();
    // A file run on Hard (not CLEARED): no row.
    const h2 = game();
    h2.game.classicGame(MARIO, '1-1', { ref: B, rules: hardRules() });
    h2.until(() => inLevel(h2), 900);
    h2.game.scenes.push(new PauseScene(h2.game, (h2.top() as LevelScene).world));
    expect(labels(h2.top())).not.toContain('Advanced cheats');
  });
});
