import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type Settings,
} from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { fileSpoken } from '@game/scenes/original-files-menu';
import {
  classicFileKey,
  listClassicFiles,
  loadClassicFile,
  migrateClassicFiles,
  originalFileRules,
  saveClassicFile,
  type ClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import { classicResumeKey } from '@game/run-resume';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { pickAtContinue } from './continue-select';

// B-L QA on b603689b. 1: the Tutorials boxes seen are each file's own (the original keeps them in
// its save file), never the shared setting: a practice Go or another file no longer wipes them.
// 2: migration into a set whose three files are unreadable replaces the first unreadable one,
// never dropping a readable run. 3: the file line reads cleanly.

useStorage();
afterEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

type G = H & { settings: Settings };
function classic(): G {
  const settings: Settings = { ...defaultSettings(), classicTutorials: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const A: ClassicFileRef = { set: 'smb', slot: 1 };
const B: ClassicFileRef = { set: 'smb', slot: 2 };
const inLevel = (h: H) => h.top() instanceof LevelScene;
const settingsWrites = () => JSON.parse(store.get(SETTINGS_KEY) ?? '{}').classicTutorialsSeen as unknown;

describe('B-L QA 1: the Tutorials seen list is the file’s', () => {
  // v0.4.73 item 94: the practice run from the Level Select cheat went with the cheat.
  it('file A keeps its list when file B starts', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 600);
    h.game.classicTutorials.restore(['characterSelect', 'marioStart']);
    // Its next WORLD card writes the list with the run.
    h.game.goToLevel('1-2', { mode: 'stand' });
    expect(loadClassicFile(A)?.tutorialsSeen).toEqual(['characterSelect', 'marioStart']);
    // File B: a new game, its own (empty) list; A's is untouched.
    h.game.showTitle();
    h.game.classicSelect('1-1', () => {}, { file: B, rules: originalFileRules() });
    // (Its select's own box has just shown, so that one is B's.)
    expect(h.game.classicTutorials.seen).not.toContain('marioStart');
    expect(loadClassicFile(A)?.tutorialsSeen).toEqual(['characterSelect', 'marioStart']);
    // Continue A: its list comes back.
    h.game.showTitle();
    expect(h.game.resumeClassic(A)).toBe(true);
    expect(h.game.classicTutorials.seen).toEqual(['characterSelect', 'marioStart']);
  });

  it('a box shown in a file is written into that file at once, never into the settings', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 600);
    h.game.classicTutorials.offer('star', 'mario');
    const pages = (h.game.classicTutorials as unknown as { take(): string[] }).take();
    expect(pages.length).toBeGreaterThan(0);
    expect(loadClassicFile(A)?.tutorialsSeen).toContain('star');
    expect(settingsWrites()).toBeUndefined();
    expect(h.settings.classicTutorialsSeen).toBeUndefined();
  });

  it('a migrated file takes the shared list; the shared setting is then only read', () => {
    const s = defaultSettings();
    s.classicTutorialsSeen = ['characterSelect', 'luigiStart'];
    saveSettings(s);
    const settings = loadSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    store.set(
      classicResumeKey('smb'),
      JSON.stringify({
        v: 1,
        levelId: '2-1',
        rules: 'classic',
        hero: 'mario',
        score: 0,
        coins: 0,
        lives: 3,
        world: 2,
        stage: 1,
        powerState: 'small',
        hp: 0,
        kit: {},
        warped: false,
        checkpoint: null,
      }),
    );
    const before = store.get(SETTINGS_KEY);
    expect(h.game.classicFiles('smb')[0]?.tutorialsSeen).toEqual(['characterSelect', 'luigiStart']);
    expect(h.game.resumeClassic(A)).toBe(true);
    expect(h.game.classicTutorials.seen).toEqual(['characterSelect', 'luigiStart']);
    pickAtContinue(h);
    h.until(() => inLevel(h), 900);
    expect(store.get(SETTINGS_KEY)).toBe(before);
  });
});

describe('B-L QA 2: migration never drops a readable run for an unreadable file', () => {
  const shared = { classic: originalFileRules().options, difficulty: 'normal' as const, continuesUsed: 0 };
  const run = {
    v: 1,
    levelId: '6-1',
    rules: 'classic',
    hero: 'mario',
    score: 600,
    coins: 0,
    lives: 3,
    world: 6,
    stage: 1,
    powerState: 'small',
    hp: 0,
    kit: {},
    warped: false,
    checkpoint: null,
  };

  it('three unreadable files: none is overwritten; the old run waits (31b)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const slot of [1, 2, 3] as const) store.set(classicFileKey({ set: 'smb', slot }), '{"v":1,"run":7}');
    store.set(classicResumeKey('smb'), JSON.stringify(run));
    migrateClassicFiles(shared);
    expect(store.has(classicResumeKey('smb'))).toBe(true);
    for (const slot of [1, 2, 3] as const)
      expect(store.get(classicFileKey({ set: 'smb', slot }))).toBe('{"v":1,"run":7}');
  });

  it('two readable and one unreadable: every file stays; the old run waits (31b)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const slot of [1, 3] as const)
      saveClassicFile({
        set: 'smb',
        slot,
        rules: originalFileRules(),
        continues: 0,
        run: { ...run, score: slot } as ClassicFile['run'],
        savedAt: 99999999999999,
      });
    store.set(classicFileKey(B), 'not json');
    store.set(classicResumeKey('smb'), JSON.stringify({ ...run, savedAt: 1 }));
    migrateClassicFiles(shared);
    expect(listClassicFiles('smb').map((f) => f?.run.score)).toEqual([1, undefined, 3]);
    expect(store.get(classicFileKey(B))).toBe('not json');
    expect(store.has(classicResumeKey('smb'))).toBe(true);
  });
});

describe('B-L QA 3: the file line reads cleanly', () => {
  it('no dangling comma when the Game mode is not one this version names', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-1', { ref: A });
    h.until(() => inLevel(h), 600);
    const f = loadClassicFile(A) as ClassicFile;
    const odd = {
      ...f,
      rules: { ...f.rules, options: { ...f.rules.options, gameMode: 'mystery' as never } },
    };
    const line = fileSpoken(odd);
    expect(line).not.toMatch(/, ?$|, ,/);
    expect(line).toMatch(/score \d+$/);
  });
});
