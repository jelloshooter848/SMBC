import { afterEach, describe, expect, it } from 'vitest';
import { loadProgress } from '@engine/save/progress';
import type { MenuItem } from '@game/scenes/menu';
import { LevelScene } from '@game/scenes/level';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CreditsScene } from '@game/scenes/credits';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import {
  ClassicNoteScene,
  ClassicReplayLevelsScene,
  ClassicReplayWorldsScene,
  REPLAY_HELP_KEY,
  ReplayDeathScene,
} from '@game/scenes/original-replay';
import { originalFileRules, type ClassicFileRef } from '@game/original-files';
import { store, useStorage, type H } from './heroes-harness';
import { choose } from './classic-files-nav';
import { pickAtContinue } from './continue-select';
import { classic, keepCleared, openFiles, readNote, stored, type G } from './cleared-nav';

// v0.4.73 PR 2 (C, D): picking a CLEARED file replays any level of its map set. The first time
// any CLEARED file is picked, an instructions box (once, shared by every file); then a world box
// (The Lost Levels' World 9 and A-D only when the run reached them), a level box (true level
// starts only), the Classic hero select, and the level with the file's rules (its Game mode
// played as the normal hero pick), unlimited lives and the normal timer. A death opens a Classic
// box: RETRY, SELECT CHARACTER, RETURN TO MENU (the file box). A clear goes back to that world's
// level box. BACK steps back one box. The file is never written.

useStorage();
afterEach(() => store.clear());

const A: ClassicFileRef = { set: 'smb', slot: 1 };
const L: ClassicFileRef = { set: 'lost', slot: 1 };
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const index = (s: unknown) => (s as { index: number }).index;
const inLevel = (h: H) => h.top() instanceof LevelScene;
const levelId = (h: H) => {
  const l = h.top() as LevelScene;
  return l.level.parent ?? l.level.id;
};

/** Past the instructions (marked seen), so a test starts at the world box. */
const helpSeen = () => store.set(REPLAY_HELP_KEY, 'true');

/** File box → the CLEARED file → (instructions read) → World `world` → Level `level` → hero. */
function replay(h: G, world = 'World 1', level = '1-1'): void {
  openFiles(h);
  choose(h, 'File 1');
  readNote(h);
  expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
  choose(h, world);
  expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
  choose(h, level);
  pickAtContinue(h);
  h.until(() => inLevel(h), 900);
}

function die(h: H): void {
  const l = h.top() as LevelScene;
  l.world.kill(l.world.player);
  h.until(() => h.top() instanceof ReplayDeathScene, 900);
}

describe('D: the instructions, the first time a CLEARED file is picked', () => {
  it('say how the replay works, wait for OK, and lead to the world box', () => {
    keepCleared(A);
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    expect(h.top()).toBeInstanceOf(ClassicNoteScene);
    const first = h.top() as ClassicNoteScene;
    h.idle(900);
    expect(h.top()).toBe(first);
    expect(h.said.at(-1)).toMatch(/replay/i);
    const text = readNote(h).flat().join(' ');
    expect(text).toMatch(/REPLAY ANY LEVEL/);
    expect(text).toMatch(/WORLD/);
    expect(text).toMatch(/HERO/);
    expect(text).toMatch(/RETRY/);
    expect(text).toMatch(/STAYS CLEARED/);
    expect(text).toMatch(/BACK/);
    // Ability names, never keys.
    expect(text).not.toMatch(/\b(Z|X|ENTER|SPACE|ESC)\b/);
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
  });

  it('show once only, for every CLEARED file, and across a reload', () => {
    keepCleared(A);
    keepCleared({ set: 'smb', slot: 2 });
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    readNote(h);
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
    choose(h, 'Back');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    choose(h, 'File 2');
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
    const again = classic();
    openFiles(again);
    choose(again, 'File 1');
    expect(again.top()).toBeInstanceOf(ClassicReplayWorldsScene);
  });

  it('BACK on them steps back to the file box (they show again next time)', () => {
    keepCleared(A);
    const h = classic();
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

describe('C: the world and level boxes', () => {
  it('SMB: Worlds 1-8; a world: its four levels; BACK one box at a time to the file box', () => {
    keepCleared(A);
    helpSeen();
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    const worlds = h.top() as ClassicReplayWorldsScene;
    expect(labels(worlds)).toEqual([...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `World ${w}`), 'Back']);
    choose(h, 'World 3');
    expect(labels(h.top())).toEqual(['3-1', '3-2', '3-3', '3-4', 'Back']);
    choose(h, '3-2');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(20);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
    expect(labels(h.top())[index(h.top())]).toBe('3-2');
    choose(h, 'Back');
    expect(h.top()).toBeInstanceOf(ClassicReplayWorldsScene);
    expect(labels(h.top())[index(h.top())]).toBe('World 3');
    choose(h, 'Back');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(index(h.top())).toBe(0);
  });

  it('The Lost Levels: World 9 and A-D only when the run reached them', () => {
    keepCleared(L, { levelId: 'll-13-4', world: 13, worlds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    helpSeen();
    const h = classic();
    openFiles(h, 'lost');
    choose(h, 'File 1');
    expect(labels(h.top())).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((w) => `World ${w}`),
      'World A',
      'Back',
    ]);
  });

  it('a Lost file that never reached World 9 has no World 9 (Level Select to D-4)', () => {
    keepCleared(L, { levelId: 'll-13-4', world: 13, worlds: [1, 2, 3, 4, 13] });
    helpSeen();
    const h = classic();
    openFiles(h, 'lost');
    choose(h, 'File 1');
    expect(labels(h.top())).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `World ${w}`),
      'World D',
      'Back',
    ]);
  });

  it('a Lost file from before reach was kept (unknown): Worlds 1-8', () => {
    keepCleared(L, { levelId: 'll-13-4', world: 13 });
    helpSeen();
    const h = classic();
    openFiles(h, 'lost');
    choose(h, 'File 1');
    expect(labels(h.top())).toEqual([...[1, 2, 3, 4, 5, 6, 7, 8].map((w) => `World ${w}`), 'Back']);
  });

  it('a level plays from its true start (Lost 9-1 from its first area)', () => {
    keepCleared(L, { levelId: 'll-13-4', world: 13, worlds: [9] });
    helpSeen();
    const h = classic();
    openFiles(h, 'lost');
    choose(h, 'File 1');
    choose(h, 'World 9');
    expect(labels(h.top())).toEqual(['9-1', '9-2', '9-3', '9-4', 'Back']);
    choose(h, '9-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect((h.top() as LevelScene).level.id).toBe('ll-9-1-start');
  });
});

describe("C: the replay plays the file's rules, free play, and never writes the file", () => {
  it('Map difficulty, More settings and Disable heroes kept; Game mode played as the normal pick', () => {
    const rules = originalFileRules();
    rules.difficulty = 'hard';
    rules.options.attack = 'strong';
    rules.options.gameMode = 'survival';
    rules.heroesOff = ['luigi'];
    keepCleared(A, {}, rules);
    helpSeen();
    // v0.4.73 (item 60): a Hard CLEARED file has Advanced cheats; their box is read already.
    classic().game.setAdvancedCheats(A, { seen: true });
    const before = stored();
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-2');
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    expect(sel.chars.map((c) => c.id)).not.toContain('luigi');
    expect(h.game.survival).toBeNull();
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(levelId(h)).toMatch(/^1-2/);
    expect(h.game.ctx.mapDifficulty).toBe('hard');
    expect(h.game.classicOptions?.attack).toBe('strong');
    expect(h.game.classicHeroChoice(false)).toBe('select');
    expect(h.game.keepsResume).toBe(false);
    expect(h.game.cheatGoalsCount).toBe(false);
    expect(stored()).toBe(before);
  });

  it('Single random still gets the hero select', () => {
    const rules = originalFileRules();
    rules.options.gameMode = 'single-random';
    keepCleared(A, {}, rules);
    helpSeen();
    const h = classic();
    openFiles(h);
    choose(h, 'File 1');
    choose(h, 'World 1');
    choose(h, '1-1');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('a death costs no life and opens RETRY / SELECT CHARACTER / RETURN TO MENU', () => {
    keepCleared(A);
    helpSeen();
    const before = stored();
    const h = classic();
    replay(h, 'World 1', '1-1');
    const lives = h.game.state.lives;
    die(h);
    expect(labels(h.top())).toEqual(['Retry', 'Select character', 'Return to menu']);
    expect(h.said.at(-1)).toMatch(/Retry/);
    expect(h.game.state.lives).toBe(lives);
    // It waits for a press.
    h.idle(600);
    expect(h.top()).toBeInstanceOf(ReplayDeathScene);
    expect(stored()).toBe(before);
  });

  it('RETRY plays the level again', () => {
    keepCleared(A);
    helpSeen();
    const h = classic();
    replay(h, 'World 1', '1-1');
    die(h);
    choose(h, 'Retry');
    h.until(() => inLevel(h), 900);
    expect(levelId(h)).toBe('1-1');
    die(h);
    expect(h.top()).toBeInstanceOf(ReplayDeathScene);
  });

  it('SELECT CHARACTER: the hero select (BACK to the death box), then the level again', () => {
    keepCleared(A);
    helpSeen();
    const before = stored();
    const h = classic();
    replay(h, 'World 1', '1-1');
    die(h);
    choose(h, 'Select character');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(20);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ReplayDeathScene);
    choose(h, 'Select character');
    h.idle(20);
    h.tap('right');
    h.tap('jump');
    if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
    h.until(() => inLevel(h), 900);
    expect(levelId(h)).toBe('1-1');
    expect(stored()).toBe(before);
  });

  it('RETURN TO MENU: the file box, on the file', () => {
    keepCleared({ set: 'smb', slot: 3 });
    helpSeen();
    const before = stored();
    const h = classic();
    openFiles(h);
    choose(h, 'File 3');
    choose(h, 'World 2');
    choose(h, '2-1');
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    die(h);
    choose(h, 'Return to menu');
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
    expect(index(h.top())).toBe(2);
    expect(stored()).toBe(before);
  });

  it('BACK on the death box steps back to the level box', () => {
    keepCleared(A);
    helpSeen();
    const h = classic();
    replay(h, 'World 1', '1-3');
    die(h);
    h.idle(10);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
    expect(labels(h.top())[index(h.top())]).toBe('1-3');
  });

  it("a clear goes back to that world's level box", () => {
    keepCleared(A);
    helpSeen();
    const before = stored();
    const h = classic();
    replay(h, 'World 1', '1-2');
    h.game.levelExitTo('1-3', { world: 1, stage: 2 });
    expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
    expect(labels(h.top())).toContain('1-1');
    // On the next level, and said so.
    expect(labels(h.top())[index(h.top())]).toBe('1-3');
    expect(h.said.at(-1)).toMatch(/^Level clear! World 1\. Choose a level\. 1-3/);
    expect(stored()).toBe(before);
  });

  it("a castle's clear too, and the set's last castle: no credits, nothing recorded", () => {
    keepCleared(A);
    helpSeen();
    const h = classic();
    replay(h, 'World 8', '8-4');
    h.game.showEnding('8-4');
    expect(h.top()).not.toBeInstanceOf(CreditsScene);
    expect(h.top()).toBeInstanceOf(ClassicReplayLevelsScene);
    expect(labels(h.top())).toContain('8-4');
    expect(loadProgress().classicBeat?.smb ?? 'none').toBe('none');
    expect(h.settings.classicCheats.beaten.smb).toBe(false);
  });

  it('Pause > Quit goes back to the file box', () => {
    keepCleared(A);
    helpSeen();
    const h = classic();
    replay(h, 'World 1', '1-1');
    h.game.quitClassicRun();
    expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  });
});

describe('C: a CLEARED file whose hero is off, unreleased or missing', () => {
  for (const [name, hero, dev] of [
    ['missing', 'someone-new', false],
    ['off in Toggle heroes', 'yoshi', true],
    ['unreleased (dev mode off)', 'vicviper', false],
  ] as const) {
    it(`${name}: still CLEARED; the replay offers the select's heroes; the file is untouched`, () => {
      keepCleared(A, { hero, ...(hero === 'vicviper' ? { devHero: true as const } : {}) });
      helpSeen();
      const before = stored();
      const h = classic((s) => {
        if (dev) {
          s.dev = true;
          s.classicDev = { ...s.classicDev, heroesOff: ['yoshi'] };
        }
      });
      const box = openFiles(h);
      expect(items(box)[0]?.value?.()).toMatch(/CLEARED/);
      choose(h, 'File 1');
      choose(h, 'World 1');
      choose(h, '1-1');
      const sel = h.top() as CharacterSelectScene;
      expect(sel).toBeInstanceOf(CharacterSelectScene);
      expect(sel.chars.map((c) => c.id)).not.toContain(hero);
      pickAtContinue(h);
      h.until(() => inLevel(h), 900);
      expect(stored()).toBe(before);
    });
  }
});
