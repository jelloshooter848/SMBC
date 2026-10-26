import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  loadClassicFile,
  originalFileRules,
  saveClassicFile,
  type ClassicFileRef,
} from '@game/original-files';
import type { ClassicResume } from '@game/run-resume';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicEraseConfirmScene, ClassicFilesScene } from '@game/scenes/original-files-menu';
import { makeGame, store, useStorage } from './heroes-harness';
import { choose } from './classic-files-nav';

// 31d (v0.4.71, #199 review): a file that reads but cannot play now (its hero is off in
// Dev > Toggle heroes, or not in this version; or its level does not load) is not UNREADABLE
// with "Erase it": it says why, and turning the hero back on plays it again.

useStorage();
afterEach(() => store.clear());

const F2: ClassicFileRef = { set: 'smb', slot: 2 };
const run = (over: Partial<ClassicResume> = {}): ClassicResume => ({
  v: 1,
  levelId: '1-2',
  rules: 'classic',
  hero: 'yoshi',
  score: 4100,
  coins: 0,
  lives: 3,
  world: 1,
  stage: 2,
  powerState: 'small',
  hp: 0,
  kit: {},
  warped: false,
  checkpoint: null,
  ...over,
});
const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const values = (s: unknown) => items(s).map((i) => i.value?.() ?? null);
const hints = (s: unknown) => items(s).map((i) => i.hint ?? '');

function game(heroesOff: string[] = []) {
  const settings: Settings = { ...defaultSettings(), dev: true };
  settings.classicDev = { ...settings.classicDev, heroesOff };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
function keep(over: Partial<ClassicResume> = {}) {
  saveClassicFile({ ...F2, rules: originalFileRules(), continues: 0, run: run(over) });
}
function openBox(h: ReturnType<typeof game>): ClassicFilesScene {
  h.game.showClassicMenu();
  choose(h, 'Super Mario Bros.');
  expect(h.top()).toBeInstanceOf(ClassicFilesScene);
  return h.top() as ClassicFilesScene;
}

describe('31d: a readable file that cannot play says why', () => {
  it('its hero is off in Dev > Toggle heroes: HERO OFF, and how to turn him on', () => {
    keep();
    const h = game(['yoshi']);
    expect(h.game.devMode).toBe(true);
    expect(h.game.classicFileState(F2)).toBe('unplayable');
    expect(h.game.classicFileProblem(F2)).toBe('hero-off');
    const box = openBox(h);
    expect(values(box)[1]).toBe('HERO OFF');
    expect(hints(box)[1]).toMatch(
      /Its hero, Yoshi, is off in Dev > Toggle heroes\. Turn Yoshi on there to play it/,
    );
    expect(hints(box)[1]).not.toMatch(/Cannot be read|Erase it/);
    choose(h, 'File 2');
    expect(h.top()).toBe(box);
    expect(h.said.at(-1)).toMatch(/^File 2: its hero, Yoshi, is off in Dev > Toggle heroes/);
    // Never taken for an empty file, and the file itself is untouched.
    h.game.startClassicFile(F2, originalFileRules(), () => {});
    expect(h.top()).toBe(box);
    expect(loadClassicFile(F2)?.run.hero).toBe('yoshi');
  });

  it('with the hero back on, the same file plays', () => {
    keep();
    const h = game([]);
    expect(h.game.classicFileState(F2)).toBe('used');
    expect(h.game.classicFileProblem(F2)).toBeNull();
  });

  it('a hero this version does not have', () => {
    keep({ hero: 'someone-new' });
    const h = game();
    expect(h.game.classicFileProblem(F2)).toBe('hero');
    const box = openBox(h);
    expect(values(box)[1]).toBe('CANNOT PLAY');
    expect(hints(box)[1]).toMatch(/Its hero is not in this version of the game/);
  });

  it('a level that does not load', () => {
    keep({ hero: 'mario', levelId: 'zz-9-9', world: 9, stage: 9 });
    const h = game();
    expect(h.game.classicFileProblem(F2)).toBe('level');
    const box = openBox(h);
    expect(values(box)[1]).toBe('CANNOT PLAY');
    expect(hints(box)[1]).toMatch(/Its level is not in this version of the game/);
  });

  it('ERASE FILE reads it in full, as a used file', () => {
    keep();
    const h = game(['yoshi']);
    openBox(h);
    choose(h, 'Erase file');
    // v0.4.73 (owner item 44): the picker shows the file's state, as the file box does; its
    // hint still reads it in full.
    expect(values(h.top())[1]).toBe('HERO OFF');
    expect(hints(h.top())[1]).toMatch(/Normal, World 1-2, 3 lives, score 4100, Yoshi/);
    choose(h, 'File 2');
    expect(h.top()).toBeInstanceOf(ClassicEraseConfirmScene);
    expect(h.said.at(-1)).toMatch(/^Erase file 2\? Normal, World 1-2, 3 lives, score 4100, Yoshi/);
  });

  it('a damaged file is still UNREADABLE', () => {
    store.set('smbc-classic-file-smb-2', '{"v":1,"run":null}');
    const h = game();
    expect(h.game.classicFileState(F2)).toBe('unreadable');
    expect(values(openBox(h))[1]).toBe('UNREADABLE');
  });
});
