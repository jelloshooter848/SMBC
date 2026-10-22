import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { EXPANSION_HEROES, expansionReleased } from '@game/characters/registry';
import { classicFileKey, type ClassicFileRef } from '@game/original-files';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicFilesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

// 0.4.73 item 40: a Classic file whose hero is an unreleased Expansion hero, saved WITHOUT the
// 0.4.72 devHero mark (every file saved by v0.4.71 and earlier), shows NOT RELEASED with dev mode
// off and is never rewritten, exactly as a marked one does. Before, it fell to P1: it played as
// Mario and the next save dropped its hero, power and kit. Dev mode on: it plays as its hero.

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
const KEY = classicFileKey(F1);
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const UNRELEASED = EXPANSION_HEROES.filter((id) => !expansionReleased(id));

/** A file exactly as v0.4.71 wrote it (no devHero field), its run at 1-2 with `hero`. */
function v0471File(
  hero: string,
  extra: Record<string, unknown> = {},
  runExtra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    v: 1,
    set: 'smb',
    slot: 1,
    rules: {
      difficulty: 'normal',
      options: {
        lives: 3,
        whenHit: 'lose-everything',
        attack: 'normal',
        drops: 'normal',
        enemySpeed: 'normal',
        piranhas: 'some',
        goombas: 'off',
        gameMode: 'all',
        musicSet: 'character',
        expansion: 'off',
        weapons: {
          bass: 'water-shield',
          billFirst: 'mg',
          billSecond: 'spread',
          link: 'bomb',
          megaman: 'metal-blade',
          ryuStart: 'shuriken',
          ryuExtra: 'windmill',
          samus: 'wave',
          simonStart: 'hand-axe',
          simonExtra: 'cross',
          sophia: 'triple',
        },
      },
      heroesOff: [],
    },
    continues: 0,
    tutorialsSeen: [],
    run: {
      v: 1,
      levelId: '1-2',
      rules: 'classic',
      hero,
      score: 4200,
      coins: 17,
      lives: 5,
      world: 1,
      stage: 2,
      powerState: 'small',
      hp: 0,
      kit: {},
      warped: false,
      checkpoint: null,
      ...runExtra,
    },
    savedAt: 1792000000000,
    ...extra,
  });
}

function game(dev: boolean) {
  const settings: Settings = { ...defaultSettings(), dev };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** Dev mode off: the file is NOT RELEASED everywhere it is asked, and nothing plays it. */
function expectNotReleased(h: ReturnType<typeof game>) {
  expect(h.game.classicFileProblem(F1)).toBe('not-released');
  expect(h.game.classicFileState(F1)).toBe('unplayable');
  expect(h.game.classicFileAt(F1)).toBeNull();
  expect(h.game.classicFiles('smb')[0]).toBeNull();
}

/** Title, then CLASSIC > Super Mario Bros.: file 1's row says NOT RELEASED; picking it stays. */
function visitFileBox(h: ReturnType<typeof game>, name: RegExp) {
  h.game.showTitle();
  h.idle(10);
  h.game.showClassicMenu();
  choose(h, 'Super Mario Bros.');
  const box = h.top() as ClassicFilesScene;
  expect(box).toBeInstanceOf(ClassicFilesScene);
  const row = items(box)[0] as MenuItem;
  expect(row.value?.()).toBe('NOT RELEASED');
  expect(row.hint).toMatch(name);
  expect(row.hint).toMatch(/Turn dev mode on to play it/);
  choose(h, 'File 1');
  expect(h.top()).toBe(box);
  expect(h.said.at(-1)).toMatch(/^File 1: its hero, .+, is not released yet/);
  h.idle(30);
  return box;
}

describe('item 40: an unmarked file of an unreleased Expansion hero (dev mode off)', () => {
  it('the Expansion heroes this test covers are all unreleased today', () => {
    expect(UNRELEASED).toEqual(expect.arrayContaining(['vicviper', 'yoshi']));
  });

  for (const hero of UNRELEASED) {
    it(`${hero}: NOT RELEASED, never resumed, the file byte-identical`, () => {
      const saved = v0471File(hero);
      store.set(KEY, saved);
      const h = game(false);
      expectNotReleased(h);
      expect(h.game.resumeClassic(F1)).toBe(false);
      expect(store.get(KEY)).toBe(saved);
    });
  }

  it('vicviper: across a title and menu visit, a picked row and an attempted resume', () => {
    const saved = v0471File('vicviper');
    store.set(KEY, saved);
    const h = game(false);
    visitFileBox(h, /Its hero, Vic Viper, is not released yet/);
    expect(h.game.resumeClassic(F1)).toBe(false);
    h.game.showTitle();
    h.idle(30);
    expectNotReleased(h);
    expect(store.get(KEY)).toBe(saved);
  });

  it('a newer-format file (fields this version does not know) is NOT RELEASED and untouched', () => {
    const saved = v0471File('vicviper', { future: { a: 1 } }, { laterField: [1, 2], devHero: 'later' });
    store.set(KEY, saved);
    const h = game(false);
    expectNotReleased(h);
    visitFileBox(h, /Vic Viper/);
    expect(h.game.resumeClassic(F1)).toBe(false);
    expect(store.get(KEY)).toBe(saved);
  });

  it('a file of a format version this one cannot read is not played or rewritten', () => {
    const saved = v0471File('vicviper', { v: 2 });
    store.set(KEY, saved);
    const h = game(false);
    expect(h.game.classicFileAt(F1)).toBeNull();
    expect(h.game.resumeClassic(F1)).toBe(false);
    expect(h.game.classicFileState(F1)).not.toBe('empty');
    expect(store.get(KEY)).toBe(saved);
  });

  it('a damaged file is not played or rewritten', () => {
    const saved = v0471File('vicviper').slice(0, 120);
    store.set(KEY, saved);
    const h = game(false);
    expect(h.game.classicFileProblem(F1)).toBeNull();
    expect(h.game.classicFileAt(F1)).toBeNull();
    expect(h.game.resumeClassic(F1)).toBe(false);
    expect(h.game.classicFileState(F1)).toBe('unreadable');
    expect(store.get(KEY)).toBe(saved);
  });

  it('storage that throws on write: still NOT RELEASED, nothing breaks', () => {
    const saved = v0471File('vicviper');
    store.set(KEY, saved);
    const ls = (globalThis as { localStorage: Record<string, unknown> }).localStorage;
    ls.setItem = () => {
      throw new Error('quota');
    };
    ls.removeItem = () => {
      throw new Error('quota');
    };
    const h = game(false);
    expectNotReleased(h);
    visitFileBox(h, /Vic Viper/);
    expect(h.game.resumeClassic(F1)).toBe(false);
    expect(store.get(KEY)).toBe(saved);
  });

  it('storage that throws on read: no file plays and nothing is written', () => {
    store.set(KEY, v0471File('vicviper'));
    const saved = store.get(KEY);
    const ls = (globalThis as { localStorage: Record<string, unknown> }).localStorage;
    const writes: string[] = [];
    ls.getItem = () => {
      throw new Error('denied');
    };
    ls.setItem = (k: string) => void writes.push(k);
    const h = game(false);
    expect(() => h.game.classicFileProblem(F1)).not.toThrow();
    expect(h.game.classicFileAt(F1)).toBeNull();
    expect(h.game.resumeClassic(F1)).toBe(false);
    expect(writes).not.toContain(KEY);
    expect(store.get(KEY)).toBe(saved);
  });

  it('a stale tab: a file written by another tab after this one opened its box stays untouched', () => {
    const h = game(false);
    h.game.showClassicMenu();
    choose(h, 'Super Mario Bros.');
    const box = h.top() as ClassicFilesScene;
    expect(box).toBeInstanceOf(ClassicFilesScene);
    // Another tab (an older version, or this one before dev mode was turned off) writes file 1.
    const saved = v0471File('vicviper');
    store.set(KEY, saved);
    choose(h, 'File 1');
    // Whatever the stale row opens, nothing plays the file as Mario or writes over it.
    for (let i = 0; i < 6 && h.top() !== box; i++) h.tap('jump');
    h.idle(30);
    expect(h.top()).not.toBeInstanceOf(LevelScene);
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    expectNotReleased(h);
    expect(h.game.resumeClassic(F1)).toBe(false);
    expect(store.get(KEY)).toBe(saved);
  });
});

describe('item 40: the same file with dev mode on, and released heroes', () => {
  it('dev mode on: it plays as Vic Viper with its lives, score and coins', () => {
    const saved = v0471File('vicviper');
    store.set(KEY, saved);
    const off = game(false);
    expect(off.game.resumeClassic(F1)).toBe(false);
    expect(store.get(KEY)).toBe(saved);
    const on = game(true);
    expect(on.game.classicFileProblem(F1)).toBeNull();
    expect(on.game.resumeClassic(F1)).toBe(true);
    expect(on.game.state.character.id).toBe('vicviper');
    expect(on.game.state.lives).toBe(5);
    expect(on.game.state.score).toBe(4200);
    expect(on.game.state.coins).toBe(17);
  });

  it("a released hero's unmarked file is unaffected (dev mode off)", () => {
    for (const hero of ['mario', 'luigi', 'link']) {
      store.clear();
      store.set(KEY, v0471File(hero, {}, { powerState: 'big' }));
      const h = game(false);
      expect(h.game.classicFileProblem(F1), hero).toBeNull();
      expect(h.game.classicFileState(F1), hero).toBe('used');
      expect(h.game.resumeClassic(F1), hero).toBe(true);
      expect(h.game.state.character.id, hero).toBe(hero);
      expect(h.game.state.lives).toBe(5);
    }
  });
});
